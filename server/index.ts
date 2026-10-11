import path from "node:path";
import fs from "node:fs";
import express from "express";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { talks } from "./schema";
import { checkPassword, clearSession, isAdmin, requireAdmin, setSession } from "./auth";
import {
  addClient,
  broadcastState,
  broadcastTalksChanged,
  getScreen,
  nextPosition,
  timer,
  updateScreen,
} from "./state";
import { DEFAULT_TALK_SEC, LIMITS } from "../shared/types";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? "0.0.0.0";

if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY);
app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());

const api = express.Router();
app.use("/api", api);

// Strip control characters (keep newlines/tabs) and trim.
const clean = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim())
    .pipe(z.string().max(max));

const signupSchema = z.object({
  speakerName: clean(LIMITS.speakerName).pipe(z.string().min(1, "Speaker name is required")),
  title: clean(LIMITS.title).optional().default(""),
  description: clean(LIMITS.description).pipe(z.string().min(1, "Talk description is required")),
});

function parse<T extends z.ZodType>(schema: T, body: unknown, res: express.Response): z.output<T> | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0]?.message ?? "Invalid input" });
    return null;
  }
  return result.data;
}

// ---------- Public ----------

api.get("/events", (_req, res) => addClient(res));

api.post(
  "/talks",
  rateLimit({ windowMs: 10 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: false }),
  (req, res) => {
    const data = parse(signupSchema, req.body, res);
    if (!data) return;
    db.insert(talks)
      .values({ ...data, createdAt: Date.now() })
      .run();
    broadcastTalksChanged();
    res.status(201).json({ ok: true });
  },
);

// ---------- Auth ----------

api.post(
  "/auth/login",
  rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false }),
  (req, res) => {
    const pw = typeof req.body?.password === "string" ? req.body.password : "";
    if (!checkPassword(pw)) return res.status(401).json({ error: "ACCESS DENIED" });
    setSession(req, res);
    res.json({ ok: true });
  },
);
api.post("/auth/logout", (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});
api.get("/auth/me", (req, res) => res.json({ admin: isAdmin(req) }));

// ---------- Admin ----------

const admin = express.Router();
admin.use(requireAdmin);
api.use("/admin", admin);

admin.get("/talks", (_req, res) => {
  res.json(db.select().from(talks).orderBy(asc(talks.position), desc(talks.createdAt)).all());
});

const idParam = z.coerce.number().int().positive();

const patchSchema = z.object({
  speakerName: clean(LIMITS.speakerName).pipe(z.string().min(1)).optional(),
  title: clean(LIMITS.title).optional(),
  description: clean(LIMITS.description).pipe(z.string().min(1)).optional(),
  status: z.enum(["pending", "approved", "rejected", "done"]).optional(),
  durationSec: z
    .number()
    .int()
    .min(10)
    .max(60 * 60)
    .optional(),
});

admin.patch("/talks/:id", (req, res) => {
  const id = idParam.safeParse(req.params.id);
  if (!id.success) return res.status(400).end();
  const data = parse(patchSchema, req.body, res);
  if (!data) return;

  const existing = db.select().from(talks).where(eq(talks.id, id.data)).get();
  if (!existing) return res.status(404).json({ error: "not found" });

  const update: Partial<typeof talks.$inferInsert> = { ...data };
  // Newly approved talks go to the back of the line.
  if (data.status === "approved" && existing.status !== "approved") update.position = nextPosition();
  db.update(talks).set(update).where(eq(talks.id, id.data)).run();

  const screen = getScreen();
  if (screen.currentTalkId === id.data) {
    if (data.status && data.status !== "approved") timer.load(null);
    else if (data.durationSec && screen.timerStatus === "idle") updateScreen({ durationMs: data.durationSec * 1000 });
  }
  broadcastTalksChanged();
  broadcastState();
  res.json({ ok: true });
});

admin.delete("/talks/:id", (req, res) => {
  const id = idParam.safeParse(req.params.id);
  if (!id.success) return res.status(400).end();
  db.delete(talks).where(eq(talks.id, id.data)).run();
  if (getScreen().currentTalkId === id.data) timer.load(null);
  broadcastTalksChanged();
  broadcastState();
  res.json({ ok: true });
});

admin.post("/talks/reorder", (req, res) => {
  const data = parse(z.object({ ids: z.array(z.number().int().positive()).max(500) }), req.body, res);
  if (!data) return;
  db.transaction((tx) => {
    data.ids.forEach((id, i) =>
      tx
        .update(talks)
        .set({ position: i + 1 })
        .where(eq(talks.id, id))
        .run(),
    );
  });
  broadcastTalksChanged();
  broadcastState();
  res.json({ ok: true });
});

const timerSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("load"), talkId: z.number().int().positive().nullable() }),
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("reset") }),
  z.object({ action: z.literal("next") }),
  z.object({ action: z.literal("adjust"), deltaMs: z.number().int().min(-3_600_000).max(3_600_000) }),
]);

admin.post("/timer", (req, res) => {
  const cmd = parse(timerSchema, req.body, res);
  if (!cmd) return;
  switch (cmd.action) {
    case "load":
      timer.load(cmd.talkId);
      break;
    case "adjust":
      timer.adjust(cmd.deltaMs);
      break;
    default:
      timer[cmd.action]();
  }
  if (cmd.action === "next") broadcastTalksChanged();
  broadcastState();
  res.json({ ok: true });
});

// Accepts "talks.example.com" or a full URL; stores a normalized http(s) URL, or null when blank.
const publicUrl = clean(200).transform((s, ctx) => {
  if (!s) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(s) ? s : `https://${s}`);
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
  } catch {}
  ctx.addIssue({ code: "custom", message: "Public URL must be a domain or http(s) URL" });
  return z.NEVER;
});

const settingsSchema = z.object({
  eventName: clean(80).pipe(z.string().min(1)).optional(),
  publicUrl: publicUrl.nullable().optional(),
  banner: clean(200)
    .transform((s) => s || null)
    .nullable()
    .optional(),
});

admin.post("/settings", (req, res) => {
  const data = parse(settingsSchema, req.body, res);
  if (!data) return;
  updateScreen(data);
  broadcastState();
  res.json({ ok: true });
});

api.use((_req, res) => res.status(404).json({ error: "not found" }));

// ---------- Static client (production) ----------

const distDir = path.resolve(import.meta.dirname, "../dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false, maxAge: "1h" }));
  // Using `root` keeps send()'s dotfile check off the parent path (e.g. ~/.something/app).
  app.get(/.*/, (_req, res) => res.sendFile("index.html", { root: distDir }));
}

app.listen(PORT, HOST, () => {
  console.log(`[lightning] listening on http://${HOST}:${PORT} (default talk ${DEFAULT_TALK_SEC}s)`);
});
