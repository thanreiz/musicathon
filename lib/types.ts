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
};

export type RichsyncData =
  | { available: true; lines: RichsyncLine[] }
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
