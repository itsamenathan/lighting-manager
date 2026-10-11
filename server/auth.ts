import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const COOKIE = "lm_admin";
const SESSION_MS = 1000 * 60 * 60 * 24; // 24h

const password = process.env.ADMIN_PASSWORD ?? "";
if (!password) {
  console.warn("[auth] ADMIN_PASSWORD is not set — admin login is disabled.");
}
const secret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.SESSION_SECRET) {
  console.warn("[auth] SESSION_SECRET not set — admin sessions will reset on restart.");
}

const sign = (value: string) => crypto.createHmac("sha256", secret).update(value).digest("base64url");

function safeEqual(a: string, b: string) {
  // Hash both sides so lengths match and comparison is constant-time.
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function checkPassword(candidate: string) {
  return password.length > 0 && safeEqual(candidate, password);
}

export function isAdmin(req: Request) {
  const raw: unknown = req.signedCookies?.[COOKIE] ?? req.cookies?.[COOKIE];
  if (typeof raw !== "string") return false;
  const [exp, mac] = raw.split(".");
  if (!exp || !mac || !safeEqual(mac, sign(exp))) return false;
  return Number(exp) > Date.now();
}

export function setSession(req: Request, res: Response) {
  const exp = String(Date.now() + SESSION_MS);
  res.cookie(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: req.secure,
    maxAge: SESSION_MS,
    path: "/",
  });
}

export function clearSession(res: Response) {
  res.clearCookie(COOKIE, { path: "/" });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isAdmin(req)) return res.status(401).json({ error: "unauthorized" });
  next();
}
