/**
 * Forced-alignment wrapper (WhisperX) — best-effort, LOCAL-ONLY.
 *
 * Given a separated vocal stem and the known lyric lines (from Musixmatch LRC),
 * produces word-level timing by running scripts/run_whisperx.py. Any failure
 * (whisperx not installed, no align model for the language, alignment error,
 * running on Vercel) resolves to null so the caller falls back to the LRC
 * line-spread estimate. This must never throw into the upload flow.
 */

import { execFile } from "node:child_process";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { distributeWordTimings } from "@/lib/api/musixmatch";
import type { RichsyncLine } from "@/lib/types";

const SCRIPTS_DIR = path.join(process.cwd(), "scripts");
const WHISPERX_WRAPPER = path.join(SCRIPTS_DIR, "run_whisperx.py");
const TEMP_DIR = path.join(process.cwd(), ".demucs-tmp");

const ALIGN_TIMEOUT_MS = 8 * 60 * 1000; // alignment can be slow on CPU

export type AlignSegment = {
  text: string;
  startMs: number;
  endMs: number;
};

type WhisperxLine = {
  text: string;
  syncConfidence: number | null;
  words: { text: string; startTimeMs: number; endTimeMs: number }[];
};

/**
 * Aligns known lyric lines to a vocal stem. Returns word-level RichsyncLine[]
 * on success, or null if alignment is unavailable for any reason.
 */
export async function alignLyrics(
  vocalsPath: string,
  segments: AlignSegment[],
  language?: string,
): Promise<RichsyncLine[] | null> {
  // Demucs/alignment can't run on Vercel; don't even try.
  if (process.env.VERCEL) return null;
  if (!vocalsPath || segments.length === 0) return null;

  const jobId = randomUUID();
  const linesPath = path.join(TEMP_DIR, `${jobId}-align-in.json`);
  const outPath = path.join(TEMP_DIR, `${jobId}-align-out.json`);

  try {
    await mkdir(TEMP_DIR, { recursive: true });
    await writeFile(linesPath, JSON.stringify(segments), "utf-8");

    await runWhisperx(vocalsPath, linesPath, outPath, language);

    const raw = await readFile(outPath, "utf-8");
    const parsed = JSON.parse(raw) as WhisperxLine[];
    if (!Array.isArray(parsed) || parsed.length !== segments.length) {
      console.error("[align] Output line count mismatch — falling back.");
      return null;
    }

    // Map to RichsyncLine[]. For any line WhisperX couldn't align (empty
    // words), fall back to even distribution of that line's LRC window so every
    // line still has word timings.
    return parsed.map((line, i): RichsyncLine => {
      const seg = segments[i];
      const words =
        line.words && line.words.length > 0
          ? line.words
          : distributeWordTimings(seg.text, seg.startMs, seg.endMs);
      return {
        text: seg.text,
        words,
        ...(line.syncConfidence != null
          ? { syncConfidence: line.syncConfidence }
          : {}),
      };
    });
  } catch (error) {
    console.error("[align] Forced alignment unavailable:", error);
    return null;
  } finally {
    await unlink(linesPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}

function runWhisperx(
  vocalsPath: string,
  linesPath: string,
  outPath: string,
  language?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [WHISPERX_WRAPPER, vocalsPath, linesPath, outPath];
    if (language) args.push(language);

    execFile(
      "python3",
      args,
      {
        timeout: ALIGN_TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env },
      },
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(`whisperx exited: ${error.message}\n${stderr}`.slice(0, 500)));
          return;
        }
        resolve();
      },
    );
  });
}
