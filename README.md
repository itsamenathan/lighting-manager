<img src="client/public/favicon.svg" width="64" height="64" alt="">

# lighting-manager

Lightning-talk manager for a security conference. Anyone can sign up; an admin approves talks, sets the running order, and drives a public countdown screen themed after *Hackers* and *The Net*.

| Route     | Who        | What                                                                 |
| --------- | ---------- | -------------------------------------------------------------------- |
| `/`       | Everyone   | Sign-up form (speaker name, optional title, description) and the current lineup |
| `/screen` | Everyone   | Countdown for the projector. Counts down, then counts up in overtime, with a Netflix-style "Next up" card |
| `/admin`  | Admin only | Approve or reject talks, reorder the queue, and control the timer       |

## Running it

```sh
npm install
cp .env.example .env        # set ADMIN_PASSWORD and SESSION_SECRET (openssl rand -hex 32)
npm run dev                 # API on :4000, Vite dev server on :5173 (open http://localhost:5173)
```

Production:

```sh
npm run build               # builds the React app into dist/
npm start                   # Express serves the API and dist/ on $PORT (default 4000)
```

Docker:

```sh
cp .env.example .env        # set ADMIN_PASSWORD and SESSION_SECRET
docker compose up -d --build
```

The app is published on `$PORT` (default 4000). The database lives in the `lightning-data` volume at `/data/lightning.db`, so it survives rebuilds. `docker compose down -v` deletes it.

SQLite lives at `DATABASE_PATH` (default `./data/lightning.db`). Drizzle migrations in `drizzle/` run automatically at startup. After changing `server/schema.ts`, run `npm run db:generate`.

### Environment

| Var              | Notes                                                                        |
| ---------------- | ---------------------------------------------------------------------------- |
| `ADMIN_PASSWORD` | Required for `/admin`. Admin login is disabled if it's unset.                |
| `SESSION_SECRET` | Signs the admin cookie. If unset, a random secret is used and sessions reset on restart. |
| `PUBLIC_URL`     | Fallback sign-up URL for the screen's JACK IN text and QR code. Normally you'd set this in the admin's **Screen settings → Public URL** instead (e.g. `talks.example.com`). If both are empty, the screen uses its own origin. |
| `TRUST_PROXY`    | Set when running behind a reverse proxy (e.g. `1`) so rate limiting and secure cookies see the real client. |
| `HOST`, `PORT`, `DATABASE_PATH` | Optional. Defaults: `0.0.0.0`, `4000`, `./data/lightning.db` |

If you run behind nginx or another proxy, disable response buffering for `/api/events` (SSE).

## Running a session

1. Talks come in through `/` and land in **Pending review**.
2. **Approve** a talk to add it to the end of the **Running order**. Reorder with ▲/▼, and use the dropdown to change a talk's length (default 5 min).
3. Open `/screen` on the projector. Double-click or press **F** to go fullscreen.
4. In `/admin`, **Next talk** loads the first talk in the queue and **Start** (or **Space**) starts the clock. When the talk ends, **Next talk** (or **N**) marks it done and loads the following one.
5. Use **+30s / −30s / +1m** to change the current slot, **Reset** (or **R**) to restart it, and **Clear** to return the screen to the idle lineup. The scrolling banner is for announcements.

Screen phases: green while running → amber at 60 s ("intrusion detected") → pink and shaking at 10 s → **HACK THE PLANET!** at zero → red overtime counting up, with rotating quotes.

The timer state is stored on the server, and each screen computes the display locally from that state, corrected for clock skew. Any number of screens stay in sync, and a server restart doesn't lose the clock.
