# Myusika

Search a song. Sing it. Play it.

Myusika is a hackathon karaoke web app scaffold for Musicathon 2026. This phase proves the Next.js and Vercel deployment pipeline before product features are added.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Vercel deployment
- Neon Postgres connection scaffold

## Setup

Copy the example environment file and fill in values locally:

```bash
cp .env.local.example .env.local
```

Required environment variables:

- `MUSIXMATCH_API_KEY`
- `LALAL_API_KEY`
- `CYANITE_API_KEY`
- `SONGSTATS_API_KEY`
- `DATABASE_URL`

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the landing page.

Build for production:

```bash
npm run build
```

## Notes

This is a Musicathon 2026 submission using the Musixmatch Pro API. API keys must never be hardcoded or exposed to the browser. Future API integrations should go through Next.js route handlers under `/app/api`.
