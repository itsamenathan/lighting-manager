import type { Response } from "express";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { screenState, talks } from "./schema";
import type { PublicState, PublicTalk, TimerState } from "../shared/types";

const UP_NEXT_LIMIT = 5;

const toPublic = (t: typeof talks.$inferSelect): PublicTalk => ({
  id: t.id,
  speakerName: t.speakerName,
  title: t.title,
  description: t.description,
  durationSec: t.durationSec,
});

export function getScreen() {
  return db.select().from(screenState).where(eq(screenState.id, 1)).get()!;
}

export function updateScreen(values: Partial<typeof screenState.$inferInsert>) {
  db.update(screenState).set(values).where(eq(screenState.id, 1)).run();
}

export function getTimer(): TimerState {
  const s = getScreen();
  return {
    status: s.timerStatus,
    durationMs: s.durationMs,
    elapsedMs: s.elapsedMs,
    startedAt: s.startedAt,
    currentTalkId: s.currentTalkId,
  };
}

/** Approved talks in running order. */
export function queue() {
  return db
    .select()
    .from(talks)
    .where(eq(talks.status, "approved"))
    .orderBy(asc(talks.position), asc(talks.id))
    .all();
}

export function nextPosition() {
  const row = db
    .select({ max: sql<number | null>`max(${talks.position})` })
    .from(talks)
    .where(eq(talks.status, "approved"))
    .get();
  return (row?.max ?? 0) + 1;
}

export function buildPublicState(): PublicState {
  const s = getScreen();
  const current = s.currentTalkId
    ? db.select().from(talks).where(eq(talks.id, s.currentTalkId)).get()
    : undefined;
  const upNext = db
    .select()
    .from(talks)
    .where(and(eq(talks.status, "approved"), s.currentTalkId ? ne(talks.id, s.currentTalkId) : undefined))
    .orderBy(asc(talks.position), asc(talks.id))
    .limit(UP_NEXT_LIMIT)
    .all();
  return {
    serverNow: Date.now(),
    eventName: s.eventName,
    banner: s.banner,
    signupUrl: s.publicUrl || process.env.PUBLIC_URL || null,
    timer: getTimer(),
    current: current ? toPublic(current) : null,
    upNext: upNext.map(toPublic),
  };
}

// ---- Server-Sent Events hub ----

const clients = new Set<Response>();

function send(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function addClient(res: Response) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 2000\n\n");
  clients.add(res);
  send(res, "state", buildPublicState());
  res.on("close", () => clients.delete(res));
}

export function broadcastState() {
  const state = buildPublicState();
  for (const c of clients) send(c, "state", state);
}

/** Tells admin clients to refetch the full talk list (payload-free so nothing private leaks). */
export function broadcastTalksChanged() {
  for (const c of clients) send(c, "talks", {});
}

// Periodic resync keeps proxies from idling out and refreshes client clock offsets.
setInterval(broadcastState, 20_000).unref();

// ---- Timer operations ----

function elapsedNow(t: TimerState, now = Date.now()) {
  return t.elapsedMs + (t.status === "running" && t.startedAt ? now - t.startedAt : 0);
}

export const timer = {
  load(talkId: number | null) {
    const talk = talkId ? db.select().from(talks).where(eq(talks.id, talkId)).get() : undefined;
    updateScreen({
      currentTalkId: talk?.id ?? null,
      durationMs: (talk?.durationSec ?? getScreen().durationMs / 1000) * 1000,
      elapsedMs: 0,
      startedAt: null,
      timerStatus: "idle",
    });
  },
  start() {
    const t = getTimer();
    if (t.status === "running" || !t.currentTalkId) return;
    updateScreen({ timerStatus: "running", startedAt: Date.now() });
  },
  pause() {
    const t = getTimer();
    if (t.status !== "running") return;
    updateScreen({ timerStatus: "paused", elapsedMs: elapsedNow(t), startedAt: null });
  },
  reset() {
    updateScreen({ timerStatus: "idle", elapsedMs: 0, startedAt: null });
  },
  adjust(deltaMs: number) {
    const t = getTimer();
    updateScreen({ durationMs: Math.max(0, t.durationMs + deltaMs) });
  },
  /** Mark the current talk done and load the next one in the queue. */
  next() {
    const t = getTimer();
    if (t.currentTalkId) {
      db.update(talks).set({ status: "done" }).where(eq(talks.id, t.currentTalkId)).run();
    }
    const [upcoming] = queue();
    this.load(upcoming?.id ?? null);
  },
};
