export type TrackMetadata = {
  trackId: string;
  title: string;
  artist: string;
  albumName: string;
  coverArtUrl: string | null;
};

export type RichsyncWord = {
  text: string;
  startTimeMs: number;
  endTimeMs: number;
};

export type RichsyncLine = {
  text: string;
  words: RichsyncWord[];
  // 0–1 alignment confidence for "auto" timing, when the aligner provides it.
  // Absent for studio-grade richsync (which has no such score).
  syncConfidence?: number;
};

// Where a song's timing came from:
//  - "richsync": Musixmatch studio-grade word timing
//  - "auto":     auto-aligned/estimated fallback (forced alignment or LRC spread)
export type SyncSource = "richsync" | "auto";

export type RichsyncData =
  | { available: true; lines: RichsyncLine[]; syncSource: SyncSource }
  | { available: false; reason: string };

export type SongHistoryRecord = {
  id: string;
  deviceId: string;
  trackId: string;
  title: string;
  artist: string;
  coverArtUrl: string | null;
  instrumentalUrl: string;
  createdAt: string;
};
