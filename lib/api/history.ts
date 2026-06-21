import { createNeonClient } from "@/lib/db";
import type { SongHistoryRecord } from "@/lib/types";

export async function initHistoryTable() {
  const sql = createNeonClient();
  await sql`
    CREATE TABLE IF NOT EXISTS song_history (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      device_id TEXT NOT NULL,
      track_id TEXT NOT NULL,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      cover_art_url TEXT,
      instrumental_url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function saveSongToHistory(
  record: Omit<SongHistoryRecord, "id" | "createdAt">,
): Promise<void> {
  const sql = createNeonClient();
  await initHistoryTable();
  await sql`
    INSERT INTO song_history (device_id, track_id, title, artist, cover_art_url, instrumental_url)
    VALUES (${record.deviceId}, ${record.trackId}, ${record.title}, ${record.artist}, ${record.coverArtUrl}, ${record.instrumentalUrl})
  `;
}

export async function getSongHistory(
  deviceId: string,
): Promise<SongHistoryRecord[]> {
  const sql = createNeonClient();
  await initHistoryTable();
  const rows = await sql`
    SELECT id, device_id as "deviceId", track_id as "trackId", title, artist,
           cover_art_url as "coverArtUrl", instrumental_url as "instrumentalUrl",
           created_at as "createdAt"
    FROM song_history
    WHERE device_id = ${deviceId}
    ORDER BY created_at DESC
    LIMIT 50
  `;
  return rows as unknown as SongHistoryRecord[];
}
