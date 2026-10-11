export type TalkStatus = "pending" | "approved" | "rejected" | "done";

export interface Talk {
  id: number;
  speakerName: string;
  title: string;
  description: string;
  status: TalkStatus;
  position: number;
  durationSec: number;
  createdAt: number;
}

export type PublicTalk = Pick<Talk, "id" | "speakerName" | "title" | "description" | "durationSec">;

export type TimerStatus = "idle" | "running" | "paused";

export interface TimerState {
  status: TimerStatus;
  /** Length of the current slot. */
  durationMs: number;
  /** Elapsed time banked before the current running segment. */
  elapsedMs: number;
  /** Server epoch ms when the current running segment began (null unless running). */
  startedAt: number | null;
  currentTalkId: number | null;
}

export interface PublicState {
  serverNow: number;
  eventName: string;
  banner: string | null;
  signupUrl: string | null;
  timer: TimerState;
  current: PublicTalk | null;
  upNext: PublicTalk[];
}

export const DEFAULT_TALK_SEC = 300;
export const LIMITS = { speakerName: 80, title: 120, description: 1000 } as const;
