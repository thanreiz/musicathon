import { createNeonClient } from "@/lib/db";
import type { SongHistoryRecord } from "@/lib/types";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const LOCAL_DB_DIR = path.join(process.cwd(), ".demucs-tmp");
const LOCAL_DB_PATH = path.join(LOCAL_DB_DIR, "local_history.json");

async function saveToLocalJSON(record: Omit<SongHistoryRecord, "id" | "createdAt">): Promise<void> {
  console.log("[DB LOCAL] Invoking saveToLocalJSON with record:", record);
  try {
    await mkdir(LOCAL_DB_DIR, { recursive: true });
    let history: SongHistoryRecord[] = [];
    if (existsSync(LOCAL_DB_PATH)) {
      const data = await readFile(LOCAL_DB_PATH, "utf-8");
      try {
        history = JSON.parse(data) as SongHistoryRecord[];
      } catch (err) {
        console.error("[DB LOCAL] Error parsing local JSON file, resetting:", err);
      }
    }

    const newRecord: SongHistoryRecord = {
      id: randomUUID(),
      deviceId: record.deviceId,
      trackId: record.trackId,
      title: record.title,
      artist: record.artist,
      coverArtUrl: record.coverArtUrl,
      instrumentalUrl: record.instrumentalUrl,
      createdAt: new Date().toISOString(),
    };

    history.unshift(newRecord);
    await writeFile(LOCAL_DB_PATH, JSON.stringify(history, null, 2), "utf-8");
    console.log("[DB LOCAL] Successfully saved to JSON file. New record:", newRecord);
  } catch (error) {
    console.error("[DB LOCAL] Failed to save to JSON file:", error);
    throw error;
  }
}

async function getFromLocalJSON(deviceId: string): Promise<SongHistoryRecord[]> {
  if (!existsSync(LOCAL_DB_PATH)) {
    return [];
  }
  try {
    const data = await readFile(LOCAL_DB_PATH, "utf-8");
    const history = JSON.parse(data) as SongHistoryRecord[];
    return history
      .filter((item) => item.deviceId === deviceId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);
  } catch (error) {
    console.error("[DB LOCAL] Failed to read from JSON file:", error);
    return [];
  }
}

export async function initHistoryTable() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    // Gracefully bypass if no Neon database configured
    return;
  }
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
  console.log("[DB SAVE] saveSongToHistory function invoked with trackId:", record.trackId);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log("[DB SAVE] DATABASE_URL is missing. Falling back to local JSON storage.");
    return saveToLocalJSON(record);
  }

  console.log("[DB SAVE] DATABASE_URL is present. Attempting Neon Postgres database write.");
  const sql = createNeonClient();
  await initHistoryTable();
  const result = await sql`
    INSERT INTO song_history (device_id, track_id, title, artist, cover_art_url, instrumental_url)
    VALUES (${record.deviceId}, ${record.trackId}, ${record.title}, ${record.artist}, ${record.coverArtUrl}, ${record.instrumentalUrl})
    RETURNING id
  `;
  console.log("[DB SAVE] Neon Postgres write completed. Result:", result);
}

export async function getSongHistory(
  deviceId: string,
): Promise<SongHistoryRecord[]> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log("[DB GET] DATABASE_URL is missing. Fetching from local JSON storage.");
    return getFromLocalJSON(deviceId);
  }

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

