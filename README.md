# Myusika

Search a song. Strip the vocals. Sing it karaoke-style. — Musicathon 2026.

Myusika is a Filipino-culture karaoke/videoke web app: search a song (Musixmatch),
upload your own audio, remove the vocals locally, and sing along to a full-screen
videoke screen with time-synced, per-word lyric highlighting.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Musixmatch API — search + synced lyrics (richsync / LRC)
- Local vocal separation: Demucs (default) with optional LALAL.AI for a demo track
- Optional forced alignment: WhisperX (for songs without word-level richsync)
- Song history: Neon Postgres if configured, else a local JSON file under `data/`

> **Local-only processing:** vocal separation (Demucs/LALAL) and WhisperX run as
> local Python processes. They do **not** run on Vercel — uploads must be done on
> a local machine. A deployed build returns a clear "run locally" message.

## Setup

```bash
cp .env.local.example .env.local   # then fill in values
npm install
npm run dev                        # http://localhost:3000 (port is pinned)
```

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MUSIXMATCH_API_KEY` | yes | Song search + synced lyrics |
| `LALAL_API_KEY` | optional | LALAL.AI vocal separation |
| `LALAL_DEMO_TRACK_ID` | optional | Musixmatch `commontrack_id` of the one track LALAL should handle. Blank = Demucs for everything. Any LALAL failure falls back to Demucs. |
| `DATABASE_URL` | optional | Neon Postgres for history; blank = local JSON under `data/` |
| `CYANITE_API_KEY`, `SONGSTATS_API_KEY` | optional | Unused in current scope |

### Local processing prerequisites (for upload / vocal removal)

Demucs (default vocal separation), via Python:

```bash
pip install demucs soundfile certifi
# ffmpeg must be installed and on PATH
```

WhisperX (optional — auto-alignment fallback for songs without word-level richsync):

```bash
pip install whisperx
```

If WhisperX is not installed, non-richsync songs still work using an estimated
line-spread timing, shown in the UI as **"Auto-synced (approximate)"** (vs.
**"Studio-grade sync"** for Musixmatch richsync).

## Build

```bash
npm run build
```

## Notes

- API keys are read only in server-side route handlers under `/app/api` and never
  reach the browser. Do not hardcode keys; keep them in `.env.local` (gitignored).
- `data/` and `public/separated/` hold per-user generated files and are gitignored.
