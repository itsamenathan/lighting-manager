import { useEffect, useState } from "react";
import type { PublicState, TimerState } from "../../shared/types";

interface Live {
  state: PublicState | null;
  /** serverNow - clientNow, so `Date.now() + offset` approximates server time. */
  offset: number;
  connected: boolean;
  /** Bumps whenever the talk list changes (admin uses this to refetch). */
  talksVersion: number;
}

export function useLiveState(): Live {
  const [live, setLive] = useState<Live>({ state: null, offset: 0, connected: false, talksVersion: 0 });

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.addEventListener("state", (e) => {
      const state = JSON.parse((e as MessageEvent).data) as PublicState;
      setLive((l) => ({ ...l, state, offset: state.serverNow - Date.now(), connected: true }));
    });
    es.addEventListener("talks", () => setLive((l) => ({ ...l, talksVersion: l.talksVersion + 1 })));
    es.onopen = () => setLive((l) => ({ ...l, connected: true }));
    es.onerror = () => setLive((l) => ({ ...l, connected: false }));
    return () => es.close();
  }, []);

  return live;
}

/** Re-renders on an interval and returns the current (server-corrected) time. */
export function useNow(offset: number, intervalMs = 100) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    setNow(Date.now() + offset);
    const id = setInterval(() => setNow(Date.now() + offset), intervalMs);
    return () => clearInterval(id);
  }, [offset, intervalMs]);
  return now;
}

export type Phase = "standby" | "normal" | "warning" | "critical" | "zero" | "overtime";

export const WARNING_MS = 60_000;
export const CRITICAL_MS = 10_000;
export const ZERO_BURST_MS = 4_000;

export function timerView(t: TimerState, now: number) {
  const elapsed = t.elapsedMs + (t.status === "running" && t.startedAt ? now - t.startedAt : 0);
  const remaining = t.durationMs - elapsed;
  const progress = t.durationMs > 0 ? Math.min(1, Math.max(0, elapsed / t.durationMs)) : 1;

  let phase: Phase;
  if (t.status === "idle") phase = "standby";
  else if (remaining <= -ZERO_BURST_MS) phase = "overtime";
  else if (remaining <= 0) phase = "zero";
  else if (remaining <= CRITICAL_MS) phase = "critical";
  else if (remaining <= WARNING_MS) phase = "warning";
  else phase = "normal";

  return { elapsed, remaining, progress, phase, overtime: remaining < 0 };
}

/** Countdown rounds up (so 4.2s shows 0:05); overtime counts whole seconds up from zero. */
export function formatClock(remainingMs: number) {
  const over = remainingMs < 0;
  const total = over ? Math.floor(-remainingMs / 1000) : Math.ceil(remainingMs / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const body = `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
  return { text: body, sign: over && total > 0 ? "+" : "" };
}

export const formatDuration = (sec: number) =>
  sec % 60 === 0 ? `${sec / 60} min` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
