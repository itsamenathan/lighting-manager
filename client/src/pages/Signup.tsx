import { useState } from "react";
import { Link } from "react-router-dom";
import { LIMITS } from "../../../shared/types";
import { api } from "../api";
import { useLiveState } from "../live";
import { CrtOverlay, Glitch, MatrixRain, Typewriter } from "../components/fx";

const EMPTY = { speakerName: "", title: "", description: "" };

export function SignupPage() {
  const { state } = useLiveState();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/talks", { body: form });
      setSent(true);
      setForm(EMPTY);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transmission failed");
    } finally {
      setBusy(false);
    }
  }

  const lineup = [state?.current, ...(state?.upNext ?? [])].filter((t) => t != null);

  return (
    <div className="page">
      <MatrixRain opacity={0.18} />
      <div className="page-inner">
        <header className="page-header">
          <h1>
            <Glitch text={state?.eventName ?? "LIGHTNING TALKS"} />
          </h1>
          <p className="tagline">
            <Typewriter text="Got five minutes and something to say? Hack the planet." speed={35} />
          </p>
        </header>

        <section className="terminal">
          <div className="terminal-bar">
            <span /> <span /> <span /> root@gibson:~# ./submit_talk.sh
          </div>
          {sent ? (
            <div className="terminal-body sent">
              <p className="ok">&gt; TRANSMISSION RECEIVED.</p>
              <p>Your talk is in the review queue. Watch the big screen to see when you're up.</p>
              <button className="btn" onClick={() => setSent(false)}>
                Submit another
              </button>
            </div>
          ) : (
            <form className="terminal-body form" onSubmit={submit}>
              <label>
                <span className="label">&gt; HANDLE / SPEAKER NAME *</span>
                <input
                  value={form.speakerName}
                  onChange={set("speakerName")}
                  maxLength={LIMITS.speakerName}
                  required
                  autoComplete="name"
                  placeholder="Zero Cool"
                />
              </label>
              <label>
                <span className="label">&gt; TALK TITLE</span>
                <input
                  value={form.title}
                  onChange={set("title")}
                  maxLength={LIMITS.title}
                  placeholder="RISC architecture is gonna change everything"
                />
              </label>
              <label>
                <span className="label">&gt; TALK DESCRIPTION *</span>
                <textarea
                  value={form.description}
                  onChange={set("description")}
                  maxLength={LIMITS.description}
                  required
                  rows={5}
                  placeholder="What are you going to show us?"
                />
                <span className="counter">
                  {form.description.length}/{LIMITS.description}
                </span>
              </label>
              {error && <p className="err">&gt; ERROR: {error}</p>}
              <button className="btn btn-primary" disabled={busy}>
                {busy ? "UPLOADING..." : "[ TRANSMIT ]"}
              </button>
            </form>
          )}
        </section>

        <section className="terminal">
          <div className="terminal-bar">
            <span /> <span /> <span /> root@gibson:~/queue
          </div>
          <pre className="terminal-body">
            <span className="term-cmd">$ cat lineup.txt</span>
            {"\n"}
            {lineup.length === 0 ? (
              <span className="term-dim">No talks approved yet.</span>
            ) : (
              lineup.map((t, i) => (
                <span key={t.id} className="term-row">
                  <span className="term-idx">{state?.current ? (i === 0 ? ">>" : String(i).padStart(2, "0")) : String(i + 1).padStart(2, "0")}</span>{" "}
                  <span className="term-name">{t.speakerName}</span>
                  {t.title && <span className="term-title"> — {t.title}</span>}
                  {"\n"}
                </span>
              ))
            )}
          </pre>
        </section>

        <footer className="page-footer">
          <Link to="/screen">&gt; VIEW THE MAINFRAME</Link>
        </footer>
      </div>
      <CrtOverlay />
    </div>
  );
}
