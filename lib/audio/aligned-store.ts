/**
 * Persistent store for WhisperX-aligned ("auto") lyric timing, keyed by
 * Musixmatch track id. Written during upload (best-effort) and read by the
 * richsync route when a song has no studio-grade richsync. Lives in the
 * gitignored data/ dir so it survives dev-server restarts.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { RichsyncLine } from "@/lib/types";

const ALIGNED_DIR = process.env.VERCEL
  ? path.join("/tmp", "data", "aligned")
  : path.join(process.cwd(), "data", "aligned");

function filePathFor(trackId: string): string {
  // Sanitize so the trackId can't escape the directory.
  const safe = trackId.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(ALIGNED_DIR, `${safe}.json`);
}

export async function writeAlignedLyrics(
  trackId: string,
  lines: RichsyncLine[],
): Promise<void> {
  if (!trackId || lines.length === 0) return;
  await mkdir(ALIGNED_DIR, { recursive: true });
  await writeFile(filePathFor(trackId), JSON.stringify({ lines }), "utf-8");
}

export async function readAlignedLyrics(
  trackId: string,
): Promise<RichsyncLine[] | null> {
  if (!trackId) return null;
  const file = filePathFor(trackId);
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(await readFile(file, "utf-8")) as {
      lines?: RichsyncLine[];
    };
    return parsed.lines && parsed.lines.length > 0 ? parsed.lines : null;
  } catch {
    return null;
  }
}
