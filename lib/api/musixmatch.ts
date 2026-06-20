import type { TrackMetadata } from "@/lib/types";

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
  method: "track.search" | "track.get",
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
  return {
    albumName: track.album_name ?? "Unknown album",
    artist: track.artist_name ?? "Unknown artist",
    coverArtUrl: getBestCoverArt(track),
    title: track.track_name ?? "Untitled track",
    trackId: String(track.commontrack_id),
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
