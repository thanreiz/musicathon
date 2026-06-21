import type { TrackMetadata, RichsyncData, RichsyncLine, RichsyncWord } from "@/lib/types";

const MUSIXMATCH_BASE_URL = "https://api.musixmatch.com/ws/1.1";
const DEFAULT_PAGE_SIZE = "12";

type MusixmatchHeader = {
  status_code?: number;
  hint?: string;
};

type MusixmatchTrack = {
  album_coverart_100x100?: string;
  album_coverart_350x350?: string;
  album_coverart_500x500?: string;
  album_coverart_800x800?: string;
  album_name?: string;
  artist_name?: string;
  commontrack_id?: number | string;
  track_id?: number | string;
  track_name?: string;
};

type MusixmatchResponse<TBody> = {
  message?: {
    body?: TBody;
    header?: MusixmatchHeader;
  };
};

type TrackSearchBody = {
  track_list?: Array<{ track?: MusixmatchTrack }>;
};

type TrackGetBody = {
  track?: MusixmatchTrack;
};

export class MusixmatchApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "MusixmatchApiError";
    this.statusCode = statusCode;
  }
}

// Server-side only: call this client from /app/api route handlers so the API key
// never reaches browser bundles or client-side network requests.
export async function searchTracks(query: string): Promise<TrackMetadata[]> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const data = await requestMusixmatch<TrackSearchBody>("track.search", {
    page: "1",
    page_size: DEFAULT_PAGE_SIZE,
    q_track_artist: trimmedQuery,
    s_track_rating: "desc",
  });

  if (!isObjectBody(data.message?.body)) {
    return [];
  }

  return (data.message.body.track_list ?? [])
    .map((item) => item.track)
    .filter(isUsableTrack)
    .map(normalizeTrack);
}

export async function getTrackDetails(trackId: string): Promise<TrackMetadata> {
  const trimmedTrackId = trackId.trim();

  if (!trimmedTrackId) {
    throw new MusixmatchApiError("Track not found.", 404);
  }

  const data = await requestMusixmatch<TrackGetBody>("track.get", {
    commontrack_id: trimmedTrackId,
  });

  if (!isObjectBody(data.message?.body) || !isUsableTrack(data.message.body.track)) {
    throw new MusixmatchApiError("Track not found.", 404);
  }

  return normalizeTrack(data.message.body.track);
}

async function requestMusixmatch<TBody>(
  method: "track.search" | "track.get" | "track.richsync.get" | "track.subtitle.get",
  params: Record<string, string>,
): Promise<MusixmatchResponse<TBody>> {
  const apiKey = process.env.MUSIXMATCH_API_KEY;

  if (!apiKey) {
    throw new MusixmatchApiError("Musixmatch API key is not configured.", 500);
  }

  const url = new URL(`${MUSIXMATCH_BASE_URL}/${method}`);
  url.searchParams.set("apikey", apiKey);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), { cache: "no-store" });

  if (!response.ok) {
    throw new MusixmatchApiError(
      "Musixmatch request failed.",
      response.status || 502,
    );
  }

  const data = (await response.json()) as MusixmatchResponse<TBody>;
  const statusCode = data.message?.header?.status_code ?? 500;

  if (statusCode !== 200) {
    throw new MusixmatchApiError(
      statusCode === 404 ? "Track not found." : "Musixmatch request failed.",
      statusCode,
    );
  }

  return data;
}

function normalizeTrack(track: MusixmatchTrack): TrackMetadata {
  const commontrackId = String(track.commontrack_id);
  
  // Task 3: Mock cover art for testing juan karlos's "Buwan"
  const coverArtUrl = commontrackId === "84709164"
    ? "/images/mock_cover.png"
    : getBestCoverArt(track);

  return {
    albumName: track.album_name ?? "Unknown album",
    artist: track.artist_name ?? "Unknown artist",
    coverArtUrl,
    title: track.track_name ?? "Untitled track",
    trackId: commontrackId,
  };
}

function isObjectBody<TBody>(body: TBody | unknown[] | undefined): body is TBody {
  return Boolean(body && !Array.isArray(body));
}

function isUsableTrack(track: MusixmatchTrack | undefined): track is MusixmatchTrack {
  return Boolean(track?.commontrack_id && track.track_name && track.artist_name);
}

function getBestCoverArt(track: MusixmatchTrack): string | null {
  const coverUrl = [
    track.album_coverart_800x800,
    track.album_coverart_500x500,
    track.album_coverart_350x350,
    track.album_coverart_100x100,
  ].find((url) => url && !url.includes("/nocover."));

  return coverUrl ? coverUrl.replace(/^http:\/\//, "https://") : null;
}

// ---------------------------------------------------------------------------
// Richsync / subtitle types
// ---------------------------------------------------------------------------

type RichsyncRawWord = {
  c: string;
  o: number;
};

type RichsyncRawLine = {
  ts: number;
  te: number;
  l: RichsyncRawWord[];
  x: string;
};

type RichsyncBody = {
  richsync: { richsync_id: number; richsync_body: string };
};

type SubtitleBody = {
  subtitle: { subtitle_id: number; subtitle_body: string };
};

// ---------------------------------------------------------------------------
// getRichsync — tries richsync first, falls back to subtitle (LRC)
// ---------------------------------------------------------------------------

export async function getRichsync(trackId: string): Promise<RichsyncData> {
  const trimmedTrackId = trackId.trim();

  if (!trimmedTrackId) {
    return { available: false, reason: "No track ID provided." };
  }

  // 1) Try richsync
  try {
    const data = await requestMusixmatch<RichsyncBody>("track.richsync.get", {
      commontrack_id: trimmedTrackId,
    });

    const body = data.message?.body;
    if (body?.richsync?.richsync_body) {
      const lines = parseRichsyncBody(body.richsync.richsync_body);
      if (lines.length > 0) {
        return { available: true, lines };
      }
    }
  } catch {
    // richsync not available — fall through to subtitle
  }

  // 2) Fallback: subtitle (LRC)
  try {
    const data = await requestMusixmatch<SubtitleBody>("track.subtitle.get", {
      commontrack_id: trimmedTrackId,
    });

    const body = data.message?.body;
    if (body?.subtitle?.subtitle_body) {
      const lines = parseLrcSubtitle(body.subtitle.subtitle_body);
      if (lines.length > 0) {
        return { available: true, lines };
      }
    }
  } catch {
    // subtitle not available either
  }

  return {
    available: false,
    reason: "Synced lyrics are not available for this track.",
  };
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function parseRichsyncBody(raw: string): RichsyncLine[] {
  let parsed: RichsyncRawLine[];
  try {
    parsed = JSON.parse(raw) as RichsyncRawLine[];
  } catch {
    return [];
  }

  return parsed
    .filter((line) => line.x && line.l && line.l.length > 0)
    .map((line) => {
      const words: RichsyncWord[] = line.l
        .filter((w) => w.c.trim().length > 0)
        .map((w, i, arr) => {
          const startTimeMs = (line.ts + w.o) * 1000;
          const nextStart =
            i < arr.length - 1
              ? (line.ts + arr[i + 1].o) * 1000
              : line.te * 1000;
          return {
            text: w.c,
            startTimeMs: Math.round(startTimeMs),
            endTimeMs: Math.round(nextStart),
          };
        });

      return {
        text: line.x,
        words,
      };
    })
    .filter((line) => line.words.length > 0);
}

function parseLrcSubtitle(lrc: string): RichsyncLine[] {
  const LRC_REGEX = /\[(\d{1,2}):(\d{2})\.(\d{2,3})\](.*)$/;
  const entries: { timeMs: number; text: string }[] = [];

  for (const raw of lrc.split("\n")) {
    const match = raw.match(LRC_REGEX);
    if (!match) continue;

    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const centiseconds = match[3].length === 2
      ? parseInt(match[3], 10) * 10
      : parseInt(match[3], 10);
    const timeMs = (minutes * 60 + seconds) * 1000 + centiseconds;
    const text = match[4].trim();

    if (text) {
      entries.push({ timeMs, text });
    }
  }

  return entries.map((entry, i, arr) => {
    const endTimeMs =
      i < arr.length - 1 ? arr[i + 1].timeMs : entry.timeMs + 5000;

    return {
      text: entry.text,
      words: [
        {
          text: entry.text,
          startTimeMs: entry.timeMs,
          endTimeMs,
        },
      ],
    };
  });
}
