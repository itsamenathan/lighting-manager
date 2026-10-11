import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { PublicState, PublicTalk } from "../../../shared/types";
import { formatClock, formatDuration, timerView, useLiveState, useNow, type Phase } from "../live";
import { CrtOverlay, Glitch, MatrixRain, Typewriter, initials, posterStyle } from "../components/fx";
import { QrCode } from "../components/QrCode";

const PHASE_COLOR: Record<Phase, string> = {
  standby: "#00f0ff",
  normal: "#39ff14",
  warning: "#ffb000",
  critical: "#ff2a6d",
  zero: "#ff00ff",
  overtime: "#ff2a6d",
};

const PHASE_STATUS: Record<Phase, string> = {
  standby: "> STAND BY FOR TRANSMISSION",
  normal: "> UPLOADING PAYLOAD",
  warning: "> WARNING: INTRUSION DETECTED // 60 SECONDS TO WRAP UP",
  critical: "> THE GIBSON IS GOING DOWN",
  zero: "> HACK THE PLANET!",
  overtime: "> TIME'S UP",
};

const OVERTIME_LINES = [
  "WRAP IT UP, ZERO COOL",
  "Mess with the best, die like the rest.",
  "CTRL+ALT+DEL WON'T SAVE YOU NOW",
  "There is no right and wrong. There's only fun and boring.",
  "CRASH OVERRIDE ENGAGED",
  "RISC architecture is gonna change everything.",
  "THE PRAETORIAN HAS NOTICED YOU",
  'Type "cookie", you idiot.',
  "CLICK THE π TO ESCAPE",
  "HACK THE PLANET!",
];

export function ScreenPage() {
  const { state, offset, connected } = useLiveState();
  const now = useNow(offset);
  useWakeLock();
  const idleCursor = useIdleCursor();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!state) {
    return (
      <div className="screen phase-standby">
        <MatrixRain color="#00f0ff" />
        <div className="screen-boot">
          <Typewriter text="> ESTABLISHING UPLINK TO THE GIBSON..." />
        </div>
        <CrtOverlay />
      </div>
    );
  }

  const view = timerView(state.timer, now);
  const phase: Phase = state.current ? view.phase : "standby";
  const color = PHASE_COLOR[phase];
  const signupUrl = state.signupUrl ?? `${window.location.origin}/`;
  const signupLabel = signupUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <div
      className={`screen phase-${phase} ${state.timer.status === "paused" ? "is-paused" : ""} ${idleCursor ? "hide-cursor" : ""}`}
      style={{ "--accent": color } as React.CSSProperties}
      onDoubleClick={toggleFullscreen}
    >
      <MatrixRain
        color={color}
        speed={phase === "critical" || phase === "zero" ? 3 : phase === "overtime" ? 1.8 : 1}
        opacity={0.28}
      />

      <TopBar state={state} connected={connected} now={now} phase={phase} />

      {state.current ? (
        <LiveView
          state={state}
          current={state.current}
          view={view}
          phase={phase}
          signupUrl={signupUrl}
          signupLabel={signupLabel}
        />
      ) : (
        <IdleView state={state} signupUrl={signupUrl} signupLabel={signupLabel} />
      )}

      {phase === "zero" && <HackThePlanet />}

      <Link to="/admin" className="pi" title="π">
        π
      </Link>
      <CrtOverlay />
    </div>
  );
}

function TopBar({
  state,
  connected,
  now,
  phase,
}: {
  state: PublicState;
  connected: boolean;
  now: number;
  phase: Phase;
}) {
  const status = !state.current
    ? "STANDBY"
    : state.timer.status === "paused"
      ? "HALTED"
      : state.timer.status === "idle"
        ? "READY"
        : phase === "overtime" || phase === "zero"
          ? "OVERTIME"
          : "LIVE";
  return (
    <header className="topbar">
      <div className="brand">
        <span className="prompt">&gt;_</span> {state.eventName}
      </div>
      {state.banner ? (
        <div className="banner">
          <span>{state.banner}</span>
        </div>
      ) : (
        <div />
      )}
      <div className="topbar-right">
        <span className={`pill pill-${status.toLowerCase()}`}>
          <span className="dot" /> {status}
        </span>
        <span className="wallclock">
          {new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
        {!connected && <span className="pill pill-offline">NO CARRIER</span>}
      </div>
    </header>
  );
}

function LiveView({
  state,
  current,
  view,
  phase,
  signupUrl,
  signupLabel,
}: {
  state: PublicState;
  current: PublicTalk;
  view: ReturnType<typeof timerView>;
  phase: Phase;
  signupUrl: string;
  signupLabel: string;
}) {
  const clock = formatClock(view.remaining);
  const overtimeSec = Math.floor(Math.max(0, -view.remaining) / 1000);
  const statusLine =
    phase === "overtime"
      ? `${PHASE_STATUS.overtime} // ${OVERTIME_LINES[Math.floor(overtimeSec / 6) % OVERTIME_LINES.length]}`
      : state.timer.status === "paused"
        ? "> SYSTEM HALTED // STAND BY"
        : PHASE_STATUS[phase];
  const pct = Math.round(view.progress * 100);
  const next = state.upNext[0];

  return (
    <main className="live">
      <div className="now-label">{phase === "standby" ? "// NEXT TO JACK IN" : "// NOW HACKING"}</div>
      <h1 className="speaker">
        <Glitch text={current.speakerName} />
      </h1>
      {current.title && <h2 className="talk-title">“{current.title}”</h2>}
      <p className="talk-desc">{current.description}</p>

      <div className="clock-wrap">
        <div className="clock" aria-live="off">
          {clock.sign && <span className="clock-sign">{clock.sign}</span>}
          <Glitch text={clock.text} className="clock-digits" />
        </div>
      </div>

      <div className="progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="progress-meta">
          <span>{view.overtime ? "PAYLOAD DELIVERED" : `${pct}% COMPLETE`}</span>
          <span>SLOT {formatDuration(Math.round(state.timer.durationMs / 1000))}</span>
        </div>
      </div>

      <div className="status-line">
        <Typewriter text={statusLine} />
      </div>

      <footer className="live-footer">
        <div className="jack-in">
          <QrCode url={signupUrl} size={110} />
          <div>
            <div className="jack-in-title">JACK IN</div>
            <div className="jack-in-url">{signupLabel}</div>
            <div className="jack-in-sub">Scan or visit to sign up for a talk</div>
          </div>
        </div>
        {next ? (
          <NextUp talk={next} more={state.upNext.length - 1} view={view} phase={phase} />
        ) : (
          <div className="queue-empty">QUEUE EMPTY // YOUR TALK COULD BE NEXT</div>
        )}
      </footer>
    </main>
  );
}

function NextUp({
  talk,
  more,
  view,
  phase,
}: {
  talk: PublicTalk;
  more: number;
  view: ReturnType<typeof timerView>;
  phase: Phase;
}) {
  const imminent = phase === "warning" || phase === "critical" || phase === "zero" || phase === "overtime";
  const eta =
    phase === "standby" ? "QUEUED" : view.overtime ? "ANY SECOND NOW" : `IN ~${formatClock(view.remaining).text}`;
  return (
    <aside className={`nextup ${imminent ? "nextup-imminent" : ""}`}>
      <div className="poster" style={posterStyle(talk.speakerName)}>
        <span>{initials(talk.speakerName)}</span>
      </div>
      <div className="nextup-body">
        <div className="nextup-label">
          NEXT UP <span className="nextup-eta">{eta}</span>
        </div>
        <div className="nextup-speaker">{talk.speakerName}</div>
        <div className="nextup-title">{talk.title || talk.description}</div>
        <div className="nextup-meta">
          {formatDuration(talk.durationSec)}
          {more > 0 && ` · +${more} more in queue`}
        </div>
        <div className="nextup-bar">
          <div style={{ width: `${Math.round(view.progress * 100)}%` }} />
        </div>
      </div>
    </aside>
  );
}

function IdleView({ state, signupUrl, signupLabel }: { state: PublicState; signupUrl: string; signupLabel: string }) {
  return (
    <main className="idle">
      <h1 className="idle-title">
        <Glitch text={state.eventName} />
      </h1>
      <div className="idle-sub">
        <Typewriter text="AWAITING TRANSMISSION" speed={60} />
      </div>
      <div className="idle-grid">
        <section className="terminal">
          <div className="terminal-bar">
            <span /> <span /> <span /> root@gibson:~/queue
          </div>
          <pre className="terminal-body">
            <span className="term-cmd">$ ls -la ./lineup</span>
            {"\n"}
            {state.upNext.length === 0 ? (
              <span className="term-dim">total 0 — no talks queued. Be the first.</span>
            ) : (
              state.upNext.map((t, i) => (
                <span key={t.id} className="term-row">
                  <span className="term-idx">{String(i + 1).padStart(2, "0")}</span>{" "}
                  <span className="term-name">{t.speakerName}</span>
                  {t.title && <span className="term-title"> — {t.title}</span>}
                  {"\n"}
                </span>
              ))
            )}
          </pre>
        </section>
        <section className="jack-in big">
          <QrCode url={signupUrl} size={220} />
          <div className="jack-in-title">JACK IN</div>
          <div className="jack-in-url">{signupLabel}</div>
        </section>
      </div>
    </main>
  );
}

function HackThePlanet() {
  const words = useMemo(() => ["HACK", "THE", "PLANET!"], []);
  return (
    <div className="htp" aria-live="assertive">
      <div className="htp-inner">
        {words.map((w, i) => (
          <div key={w} className="htp-word" style={{ animationDelay: `${i * 0.25}s` }}>
            <Glitch text={w} />
          </div>
        ))}
      </div>
    </div>
  );
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const acquire = () => {
      if (document.visibilityState === "visible" && "wakeLock" in navigator) {
        navigator.wakeLock.request("screen").then(
          (l) => (lock = l),
          () => {},
        );
      }
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      document.removeEventListener("visibilitychange", acquire);
      lock?.release();
    };
  }, []);
}

function useIdleCursor(ms = 3000) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let t = setTimeout(() => setIdle(true), ms);
    const move = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), ms);
    };
    window.addEventListener("mousemove", move);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousemove", move);
    };
  }, [ms]);
  return idle;
}
