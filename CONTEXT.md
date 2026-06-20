# Myusika - Project Context

## Project Overview
- **Name:** Myusika (Musicathon 2026 submission)
- **Concept:** Hackathon karaoke web app. "Search a song. Sing it. Play it."
- **Tech Stack:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, Vercel, Postgres (via Neon).

## Current Status
We have completed Phase 1 (Scaffold) and Phase 2 (Search & Confirmation Flow).
The workspace is currently at the end of **Phase 2**, but the Phase 2 changes are **uncommitted**.

### Completed Work
**Phase 1: Project Scaffold (Committed on `main`)**
- Initialized Next.js with App Router, TypeScript, and Tailwind.
- Set up directory structure (`/app`, `/components`, `/lib/api`).
- Added a minimal landing page (`/app/page.tsx`).
- Created empty API placeholder stubs (`musixmatch.ts`, `lalal.ts`, `cyanite.ts`, `songstats.ts`).
- Set up Neon DB connection scaffold in `/lib/db.ts` (no schema yet).
- Created `.env.local.example` and configured Vercel (`vercel.json`).

**Phase 2: Song Search & Confirmation Flow (Uncommitted changes)**
- **Musixmatch API Integration:** Implemented `/lib/api/musixmatch.ts` utilizing `track.search` and `track.get` endpoints.
- **Server API Routes:** Added `/app/api/search/route.ts` and `/app/api/track/[trackId]/route.ts` to keep Musixmatch API key secure on the server.
- **UI Screens:** 
  - Search screen (`/app/search/page.tsx`) with debounced search and robust error/empty states.
  - Confirmation screen (`/app/confirm/[trackId]/page.tsx`) to show track details and a placeholder upload UI.
- **Verified:** 
  - `npm test` passes (Vitest coverage for normalization and routes).
  - Search successfully retrieves real data from Musixmatch. *(Note: The current Musixmatch plan seems to return null for cover art on most tracks, so the app gracefully uses a stylized fallback cover).*
  - `MUSIXMATCH_API_KEY` and `LALAL_API_KEY` have been successfully added to the local `.env.local`.

## Next Steps
1. **Commit Phase 2:** Review and commit the uncommitted Phase 2 changes to `main`.
2. **Begin Phase 3:** Start implementing the next phase (likely audio upload logic or database schema integration).
