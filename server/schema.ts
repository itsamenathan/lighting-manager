import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { DEFAULT_TALK_SEC } from "../shared/types";

export const talks = sqliteTable("talks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  speakerName: text("speaker_name").notNull(),
  title: text("title").notNull().default(""),
  description: text("description").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected", "done"] })
    .notNull()
    .default("pending"),
  position: integer("position").notNull().default(0),
  durationSec: integer("duration_sec").notNull().default(DEFAULT_TALK_SEC),
  createdAt: integer("created_at").notNull(),
});

// Single-row table (id = 1) holding the live screen state so it survives restarts.
export const screenState = sqliteTable("screen_state", {
  id: integer("id").primaryKey(),
  eventName: text("event_name").notNull().default("LIGHTNING TALKS"),
  banner: text("banner"),
  /** Public sign-up URL shown (and QR-encoded) on the screen. Falls back to $PUBLIC_URL. */
  publicUrl: text("public_url"),
  timerStatus: text("timer_status", { enum: ["idle", "running", "paused"] })
    .notNull()
    .default("idle"),
  durationMs: integer("duration_ms").notNull().default(DEFAULT_TALK_SEC * 1000),
  elapsedMs: integer("elapsed_ms").notNull().default(0),
  startedAt: integer("started_at"),
  currentTalkId: integer("current_talk_id"),
  /** Show the full-screen "HACK THE PLANET" burst when the countdown hits zero. */
  zeroAlert: integer("zero_alert", { mode: "boolean" }).notNull().default(true),
  /** Approve new sign-ups straight into the running order, skipping review. */
  autoApprove: integer("auto_approve", { mode: "boolean" }).notNull().default(false),
  /** Length given to new sign-ups. */
  defaultDurationSec: integer("default_duration_sec").notNull().default(DEFAULT_TALK_SEC),
});
