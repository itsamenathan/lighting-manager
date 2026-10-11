import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LIMITS, type PublicState, type Talk, type TalkStatus } from "../../../shared/types";
import { ApiError, api } from "../api";
import { formatClock, formatDuration, timerView, useLiveState, useNow } from "../live";
import { CrtOverlay, Glitch } from "../components/fx";

export function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    api<{ admin: boolean }>("/auth/me").then(
      (r) => setAuthed(r.admin),
      () => setAuthed(false),
    );
  }, []);

  if (authed === null) return <div className="admin-loading">&gt; CONNECTING...</div>;
  return authed ? <Dashboard onLogout={() => setAuthed(false)} /> : <Login onLogin={() => setAuthed(true)} />;
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/auth/login", { body: { password } });
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ACCESS DENIED");
      setPassword("");
    }
  }

  return (
    <div className="page login">
      <form className="terminal login-box" onSubmit={submit}>
        <div className="terminal-bar">
          <span /> <span /> <span /> praetorian://admin
        </div>
        <div className="terminal-body form">
          <div className="login-pi">π</div>
          <label>
            <span className="label">&gt; ENTER PASSWORD</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </label>
          {error && (
            <p className="err">
              <Glitch text={error.toUpperCase()} />
            </p>
          )}
          <button className="btn btn-primary">[ AUTHENTICATE ]</button>
        </div>
      </form>
      <CrtOverlay />
    </div>
  );
}

type Timer = Parameters<typeof timerView>[0];

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const { state, offset, connected, talksVersion } = useLiveState();
  const [talks, setTalks] = useState<Talk[]>([]);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(
    async (path: string, init?: { method?: string; body?: unknown }) => {
      setError(null);
      try {
        return await api(path, init);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) onLogout();
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [onLogout],
  );

  useEffect(() => {
    call("/admin/talks").then((t) => t && setTalks(t as Talk[]));
  }, [call, talksVersion]);

  const timer = (body: object) => call("/admin/timer", { body });
  const patch = (id: number, body: Partial<Talk>) => call(`/admin/talks/${id}`, { method: "PATCH", body });
  const remove = (t: Talk) => {
    if (confirm(`Delete "${t.speakerName}"? This can't be undone.`)) call(`/admin/talks/${t.id}`, { method: "DELETE" });
  };

  const by = (s: TalkStatus) => talks.filter((t) => t.status === s);
  const queue = by("approved").sort((a, b) => a.position - b.position || a.id - b.id);
  const pending = by("pending").sort((a, b) => a.createdAt - b.createdAt);

  const move = (index: number, dir: -1 | 1) => {
    const ids = queue.map((t) => t.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    // Optimistic update so the list doesn't jump while waiting on the server.
    setTalks((all) => all.map((t) => (ids.includes(t.id) ? { ...t, position: ids.indexOf(t.id) + 1 } : t)));
    call("/admin/talks/reorder", { body: { ids } });
  };

  // Keyboard shortcuts: Space = start/pause, N = next, R = reset.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, summary") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!state) return;
      if (e.code === "Space") {
        // Stop a focused button from also being "clicked" by the space bar.
        e.preventDefault();
        if (el instanceof HTMLButtonElement) el.blur();
        timer({ action: state.timer.status === "running" ? "pause" : "start" });
      } else if (e.key === "n" || e.key === "N") timer({ action: "next" });
      else if (e.key === "r" || e.key === "R") timer({ action: "reset" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function logout() {
    await api("/auth/logout", { body: {} });
    onLogout();
  }

  return (
    <div className="admin">
      <header className="admin-header">
        <h1>
          <span className="prompt">&gt;_</span> MISSION CONTROL
        </h1>
        <nav>
          <span className={`pill ${connected ? "pill-live" : "pill-offline"}`}>
            <span className="dot" /> {connected ? "UPLINK OK" : "NO CARRIER"}
          </span>
          <a href="/screen" target="_blank" rel="noreferrer" className="btn">
            Open screen ↗
          </a>
          <Link to="/" className="btn">
            Sign-up page
          </Link>
          <button className="btn" onClick={logout}>
            Log out
          </button>
        </nav>
      </header>

      {error && (
        <div className="admin-error" onClick={() => setError(null)}>
          &gt; ERROR: {error}
        </div>
      )}

      <div className="admin-grid">
        <div className="admin-col">
          {state && <TimerPanel state={state} offset={offset} timer={timer} />}
          {state && <SettingsPanel state={state} save={(body) => call("/admin/settings", { body })} />}
        </div>

        <div className="admin-col">
          <section className="panel pending-panel">
            <h2>
              Pending review <span className="count">{pending.length}</span>
            </h2>
            {pending.length === 0 && <p className="muted">No submissions waiting.</p>}
            {pending.map((t) => (
              <TalkCard key={t.id} talk={t} onSave={(b) => patch(t.id, b)}>
                <button className="btn btn-ok" onClick={() => patch(t.id, { status: "approved" })}>
                  Approve
                </button>
                <button className="btn btn-warn" onClick={() => patch(t.id, { status: "rejected" })}>
                  Reject
                </button>
                <button className="btn btn-danger" onClick={() => remove(t)}>
                  Delete
                </button>
              </TalkCard>
            ))}
          </section>

          <section className="panel queue-panel">
            <h2>
              Running order <span className="count">{queue.length}</span>
            </h2>
            {queue.length === 0 && <p className="muted">Approve some talks to build the lineup.</p>}
            {queue.map((t, i) => {
              const live = state?.timer.currentTalkId === t.id;
              return (
                <TalkCard
                  key={t.id}
                  talk={t}
                  index={i + 1}
                  live={live}
                  onSave={(b) => patch(t.id, b)}
                  reorder={{
                    up: () => move(i, -1),
                    down: () => move(i, 1),
                    first: i === 0,
                    last: i === queue.length - 1,
                  }}
                >
                  {!live && (
                    <button className="btn btn-ok" onClick={() => timer({ action: "load", talkId: t.id })}>
                      Load on screen
                    </button>
                  )}
                  <button className="btn" onClick={() => patch(t.id, { status: "done" })}>
                    Mark done
                  </button>
                  <button className="btn" onClick={() => patch(t.id, { status: "pending" })}>
                    Unapprove
                  </button>
                  <button className="btn btn-danger" onClick={() => remove(t)}>
                    Delete
                  </button>
                </TalkCard>
              );
            })}
          </section>

          <Archive
            title="Done"
            talks={by("done")}
            action={(t) => (
              <button className="btn" onClick={() => patch(t.id, { status: "approved" })}>
                Requeue
              </button>
            )}
            onDelete={remove}
          />
          <Archive
            title="Rejected"
            talks={by("rejected")}
            action={(t) => (
              <button className="btn" onClick={() => patch(t.id, { status: "pending" })}>
                Restore
              </button>
            )}
            onDelete={remove}
          />
        </div>
      </div>
      <p className="shortcuts">
        Shortcuts: <kbd>Space</kbd> start/pause · <kbd>N</kbd> next talk · <kbd>R</kbd> reset
      </p>
    </div>
  );
}

function TimerPanel({ state, offset, timer }: { state: PublicState; offset: number; timer: (b: object) => void }) {
  const now = useNow(offset, 200);
  const t: Timer = state.timer;
  const view = timerView(t, now);
  const clock = formatClock(view.remaining);
  const running = t.status === "running";
  const phaseClass = `phase-${state.current ? view.phase : "standby"}`;

  // On phones the panel scrolls away while managing the queue, so a compact dock
  // with the essentials slides up whenever the full panel is off-screen.
  const panelRef = useRef<HTMLElement>(null);
  const [panelVisible, setPanelVisible] = useState(true);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setPanelVisible(e.isIntersecting));
    io.observe(panelRef.current!);
    return () => io.disconnect();
  }, []);

  const startPause = (
    <button
      className="btn btn-primary btn-big"
      disabled={!state.current}
      onClick={() => timer({ action: running ? "pause" : "start" })}
    >
      {running ? "❚❚ Pause" : t.status === "paused" ? "▶ Resume" : "▶ Start"}
    </button>
  );
  const next = (
    <button className="btn btn-big" onClick={() => timer({ action: "next" })}>
      ⏭ Next
    </button>
  );

  return (
    <>
      <div className={`timer-dock ${phaseClass} ${panelVisible ? "" : "is-visible"}`} aria-hidden={panelVisible}>
        <div className="td-info">
          <div className="td-clock">
            {clock.sign}
            {clock.text}
          </div>
          <div className="td-speaker">{state.current?.speakerName ?? "Idle"}</div>
        </div>
        {startPause}
        {next}
      </div>
      <section ref={panelRef} className={`panel timer-panel ${phaseClass}`}>
        <h2>On screen</h2>
        {state.current ? (
          <>
            <div className="tp-speaker">{state.current.speakerName}</div>
            {state.current.title && <div className="tp-title">{state.current.title}</div>}
          </>
        ) : (
          <div className="tp-speaker muted">Nothing loaded (idle screen)</div>
        )}
        <div className="tp-clock">
          {clock.sign}
          {clock.text}
        </div>
        <div className="tp-status">
          {t.status.toUpperCase()} · slot {formatDuration(Math.round(t.durationMs / 1000))}
        </div>

        <div className="tp-controls">
          {startPause}
          {next}
        </div>
        <div className="tp-controls tp-adjust">
          <button className="btn" onClick={() => timer({ action: "reset" })}>
            ↺ Reset
          </button>
          <button className="btn" onClick={() => timer({ action: "adjust", deltaMs: -30_000 })}>
            −30s
          </button>
          <button className="btn" onClick={() => timer({ action: "adjust", deltaMs: 30_000 })}>
            +30s
          </button>
          <button className="btn" onClick={() => timer({ action: "adjust", deltaMs: 60_000 })}>
            +1m
          </button>
          <button className="btn" onClick={() => timer({ action: "load", talkId: null })}>
            ⏏ Clear
          </button>
        </div>
        <p className="muted small">
          “Next talk” marks the current talk done and loads the next one in the running order, ready to start.
        </p>
        {state.upNext[0] && (
          <div className="tp-next">
            Up next: <strong>{state.upNext[0].speakerName}</strong>
            {state.upNext[0].title && ` — ${state.upNext[0].title}`}
          </div>
        )}
      </section>
    </>
  );
}

function SettingsPanel({ state, save }: { state: PublicState; save: (b: object) => void }) {
  const [eventName, setEventName] = useState(state.eventName);
  const [banner, setBanner] = useState(state.banner ?? "");
  const [publicUrl, setPublicUrl] = useState(state.signupUrl ?? "");
  useEffect(() => setEventName(state.eventName), [state.eventName]);
  useEffect(() => setPublicUrl(state.signupUrl ?? ""), [state.signupUrl]);
  useEffect(() => setBanner(state.banner ?? ""), [state.banner]);

  return (
    <section className="panel settings-panel">
      <h2>Screen settings</h2>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          save({ eventName });
        }}
      >
        <label>
          <span className="label">Event name</span>
          <div className="row">
            <input value={eventName} onChange={(e) => setEventName(e.target.value)} maxLength={80} />
            <button className="btn">Save</button>
          </div>
        </label>
      </form>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          save({ publicUrl });
        }}
      >
        <label>
          <span className="label">Public URL (shown under JACK IN + QR code)</span>
          <div className="row">
            <input
              value={publicUrl}
              onChange={(e) => setPublicUrl(e.target.value)}
              maxLength={200}
              placeholder={window.location.host}
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button className="btn">Save</button>
          </div>
        </label>
      </form>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          save({ banner });
        }}
      >
        <label>
          <span className="label">Scrolling banner</span>
          <div className="row">
            <input
              value={banner}
              onChange={(e) => setBanner(e.target.value)}
              maxLength={200}
              placeholder="e.g. Next block starts at 15:00"
            />
            <button className="btn">Show</button>
            {state.banner && (
              <button type="button" className="btn" onClick={() => save({ banner: null })}>
                Hide
              </button>
            )}
          </div>
        </label>
      </form>
    </section>
  );
}

const DURATIONS = [180, 300, 420, 600, 900];

function TalkCard({
  talk,
  index,
  live,
  onSave,
  reorder,
  children,
}: {
  talk: Talk;
  index?: number;
  live?: boolean;
  onSave: (b: Partial<Talk>) => void;
  reorder?: { up: () => void; down: () => void; first: boolean; last: boolean };
  children?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(talk);
  const durations = DURATIONS.includes(talk.durationSec)
    ? DURATIONS
    : [...DURATIONS, talk.durationSec].sort((a, b) => a - b);

  return (
    <article className={`talk-card ${live ? "is-live" : ""}`}>
      <div className="tc-head">
        {reorder && (
          <div className="tc-order">
            <button className="btn btn-icon" disabled={reorder.first} onClick={reorder.up} aria-label="Move up">
              ▲
            </button>
            <span>{index}</span>
            <button className="btn btn-icon" disabled={reorder.last} onClick={reorder.down} aria-label="Move down">
              ▼
            </button>
          </div>
        )}
        <div className="tc-main">
          {editing ? (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                onSave({ speakerName: draft.speakerName, title: draft.title, description: draft.description });
                setEditing(false);
              }}
            >
              <input
                value={draft.speakerName}
                maxLength={LIMITS.speakerName}
                onChange={(e) => setDraft({ ...draft, speakerName: e.target.value })}
                required
              />
              <input
                value={draft.title}
                maxLength={LIMITS.title}
                placeholder="Title"
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
              <textarea
                value={draft.description}
                maxLength={LIMITS.description}
                rows={4}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                required
              />
              <div className="row">
                <button className="btn btn-ok">Save</button>
                <button type="button" className="btn" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="tc-speaker">
                {live && <span className="pill pill-live">ON SCREEN</span>} {talk.speakerName}
              </div>
              {talk.title && <div className="tc-title">{talk.title}</div>}
              <p className="tc-desc">{talk.description}</p>
              <div className="tc-meta">
                Submitted {new Date(talk.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
              </div>
            </>
          )}
        </div>
      </div>
      {!editing && (
        <div className="tc-actions">
          <select
            value={talk.durationSec}
            onChange={(e) => onSave({ durationSec: Number(e.target.value) })}
            aria-label="Talk length"
          >
            {durations.map((d) => (
              <option key={d} value={d}>
                {formatDuration(d)}
              </option>
            ))}
          </select>
          {children}
          <button
            className="btn"
            onClick={() => {
              setDraft(talk);
              setEditing(true);
            }}
          >
            Edit
          </button>
        </div>
      )}
    </article>
  );
}

function Archive({
  title,
  talks,
  action,
  onDelete,
}: {
  title: string;
  talks: Talk[];
  action: (t: Talk) => React.ReactNode;
  onDelete: (t: Talk) => void;
}) {
  if (talks.length === 0) return null;
  return (
    <details className="panel archive">
      <summary>
        <h2>
          {title} <span className="count">{talks.length}</span>
        </h2>
      </summary>
      {talks.map((t) => (
        <div key={t.id} className="archive-row">
          <span>
            <strong>{t.speakerName}</strong>
            {t.title && ` — ${t.title}`}
          </span>
          <span className="row">
            {action(t)}
            <button className="btn btn-danger" onClick={() => onDelete(t)}>
              Delete
            </button>
          </span>
        </div>
      ))}
    </details>
  );
}
