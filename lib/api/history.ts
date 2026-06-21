import { createNeonClient } from "@/lib/db";
import type { SongHistoryRecord } from "@/lib/types";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Persistent, stable location for local (no-database) song history. Lives in a
// dedicated data/ dir — NOT in the throwaway .demucs-tmp temp folder — so the
// library survives dev-server restarts. Gitignored (it is per-user data).
const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "data")
  : path.join(process.cwd(), "data");
const LOCAL_DB_PATH = path.join(DATA_DIR, "song_history.json");
// Legacy location used before storage was made stable; read once so existing
// records are migrated automatically and never lost.
const LEGACY_DB_PATH = process.env.VERCEL
  ? path.join("/tmp", "local_history.json")
  : path.join(process.cwd(), ".demucs-tmp", "local_history.json");

async function readLocalHistory(): Promise<SongHistoryRecord[]> {
  for (const candidate of [LOCAL_DB_PATH, LEGACY_DB_PATH]) {
    if (!existsSync(candidate)) continue;
    try {
      const parsed = JSON.parse(await readFile(candidate, "utf-8"));
      if (Array.isArray(parsed)) return parsed as SongHistoryRecord[];
    } catch {
      // Corrupted/unreadable — fall through to the next candidate.
    }
  }
  return [];
}

async function saveToLocalJSON(record: Omit<SongHistoryRecord, "id" | "createdAt">): Promise<void> {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const history = await readLocalHistory();

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

    // Replace any prior record for the same track so re-uploading updates the
    // entry instead of piling up duplicates.
    const deduped = history.filter((item) => item.trackId !== record.trackId);
    deduped.unshift(newRecord);

    // Atomic write: write to a temp file then rename, so a crash mid-write
    // can't corrupt or truncate the library.
    const tmpPath = `${LOCAL_DB_PATH}.${randomUUID()}.tmp`;
    await writeFile(tmpPath, JSON.stringify(deduped, null, 2), "utf-8");
    await rename(tmpPath, LOCAL_DB_PATH);
  } catch (error) {
    console.error("[history] Failed to save to local JSON:", error);
    throw error;
  }
}

async function getFromLocalJSON(): Promise<SongHistoryRecord[]> {
  // The local store is single-machine, single-user. Return everything saved on
  // this machine regardless of deviceId — the browser's deviceId changes when
  // the dev-server port changes (localStorage is per-origin), and filtering by
  // it would make saved songs vanish after a port change.
  const history = await readLocalHistory();
  return history
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50);
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
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return saveToLocalJSON(record);
  }

  const sql = createNeonClient();
  await initHistoryTable();
  await sql`
    INSERT INTO song_history (device_id, track_id, title, artist, cover_art_url, instrumental_url)
    VALUES (${record.deviceId}, ${record.trackId}, ${record.title}, ${record.artist}, ${record.coverArtUrl}, ${record.instrumentalUrl})
    RETURNING id
  `;
}

export async function getSongHistory(
  deviceId: string,
): Promise<SongHistoryRecord[]> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return getFromLocalJSON();
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

