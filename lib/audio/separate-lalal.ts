/**
 * LALAL.AI vocal separation — PRIMARY path, opt-in per track.
 *
 * Server-side, runs synchronously within the upload request (upload → split →
 * poll → download both stems) and returns the SAME SeparationResult contract as
 * the Demucs path, so it drops into the existing upload + alignment flow with no
 * downstream changes.
 *
 * Fail-safe: ANY failure/timeout returns { success: false } so the caller falls
 * back to Demucs. Enabled only when the uploaded track id matches
 * LALAL_DEMO_TRACK_ID — unset that env var to revert to pure Demucs.
 *
 * IMPORTANT: stem *cleanliness* cannot be verified programmatically — confirm by
 * listening. API contract per https://www.lalal.ai/api/v1/ (X-License-Key auth).
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { SeparationResult } from "./separate";

const LALAL_BASE = "https://www.lalal.ai/api/v1";
const IS_VERCEL = Boolean(process.env.VERCEL);
const TEMP_DIR = IS_VERCEL
  ? path.join("/tmp", "lalal")
  : path.join(process.cwd(), ".demucs-tmp");
const PUBLIC_OUTPUT_DIR = IS_VERCEL
  ? path.join("/tmp", "separated")
  : path.join(process.cwd(), "public", "separated");

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 4 * 60 * 1000;

type LalalTrack = { type: "stem" | "back"; label?: string; url?: string };

/** Whether LALAL should handle this track.
 *  On Vercel: always true (Demucs can't run in serverless).
 *  Locally: only for the single env-gated demo track. */
export function shouldUseLalal(trackId: string | null): boolean {
  if (IS_VERCEL) return true;
  const demo = process.env.LALAL_DEMO_TRACK_ID;
  return Boolean(trackId && demo && trackId === demo);
}

function apiKey(): string {
  const key = process.env.LALAL_API_KEY;
  if (!key) throw new Error("LALAL_API_KEY is not configured.");
  return key;
}

async function lalalFetch<T>(endpoint: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${LALAL_BASE}${endpoint}`, {
    ...init,
    headers: { "X-License-Key": apiKey(), ...(init.headers as Record<string, string>) },
  });
  if (!res.ok) {
    let detail = `LALAL.AI ${endpoint} returned ${res.status}`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (body.detail) {
        detail =
          typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      // non-JSON body — keep generic message
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function downloadTo(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength === 0) throw new Error("Downloaded stem is empty.");
  await writeFile(destPath, new Uint8Array(buf));
}

export async function separateVocalsLalal(
  fileBuffer: Buffer | null,
  filename: string | null,
  existingSourceId?: string | null,
): Promise<SeparationResult> {
  const jobId = randomUUID();
  try {
    await mkdir(TEMP_DIR, { recursive: true });
    await mkdir(PUBLIC_OUTPUT_DIR, { recursive: true });

    let sourceId = existingSourceId;
    if (!sourceId) {
      if (!fileBuffer || !filename) {
        return { success: false, error: "No file buffer or source id provided." };
      }
      // 1) Upload the audio binary → source id
      const upload = await lalalFetch<{ id: string }>("/upload/", {
        method: "POST",
        headers: {
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Type": "application/octet-stream",
        },
        body: new Uint8Array(fileBuffer),
      });
      sourceId = upload.id;
    }

    // 2) Start a vocals split (also yields the "back" instrumental)
    const split = await lalalFetch<{ task_id: string }>("/split/stem_separator/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_id: sourceId, presets: { stem: "vocals" } }),
    });
    const taskId = split.task_id;

    // 3) Poll until success / error / timeout
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let tracks: LalalTrack[] | null = null;
    while (Date.now() < deadline) {
      const check = await lalalFetch<{
        result: Record<
          string,
          | { status: "progress"; progress: number }
          | { status: "success"; result: { tracks: LalalTrack[] } }
          | { status: "error"; error?: { detail?: string } }
          | { status: "server_error"; error?: string }
          | { status: "cancelled" }
        >;
      }>("/check/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_ids: [taskId] }),
      });

      const entry = check.result[taskId];
      if (!entry) return { success: false, error: "LALAL task not found." };

      if (entry.status === "success") {
        tracks = entry.result.tracks;
        break;
      }
      if (entry.status === "error") {
        return { success: false, error: entry.error?.detail ?? "LALAL processing error." };
      }
      if (entry.status === "server_error") {
        return {
          success: false,
          error: typeof entry.error === "string" ? entry.error : "LALAL server error.",
        };
      }
      if (entry.status === "cancelled") {
        return { success: false, error: "LALAL task cancelled." };
      }
      await sleep(POLL_INTERVAL_MS);
    }

    if (!tracks) return { success: false, error: "LALAL timed out." };

    // 4) Download stems. "back" = instrumental (served); "stem" = vocals (temp).
    const instrumentalTrack = tracks.find((t) => t.type === "back" && t.url);
    const vocalsTrack = tracks.find((t) => t.type === "stem" && t.url);
    if (!instrumentalTrack?.url) {
      return { success: false, error: "LALAL returned no instrumental track." };
    }

    // On Vercel, public/ is read-only — return the LALAL CDN URL directly.
    // Locally, download to public/separated/ so Next.js can serve it.
    let instrumentalUrl: string;
    if (IS_VERCEL) {
      instrumentalUrl = instrumentalTrack.url;
    } else {
      const outputFilename = `${jobId}.mp3`;
      const publicPath = path.join(PUBLIC_OUTPUT_DIR, outputFilename);
      await mkdir(PUBLIC_OUTPUT_DIR, { recursive: true });
      await downloadTo(instrumentalTrack.url, publicPath);
      instrumentalUrl = `/separated/${outputFilename}`;
    }

    let vocalsPath: string | null = null;
    if (vocalsTrack?.url) {
      const vp = path.join(TEMP_DIR, `${jobId}-lalal-vocals.mp3`);
      try {
        await downloadTo(vocalsTrack.url, vp);
        vocalsPath = vp;
      } catch (err) {
        // Vocals download is only needed for alignment — non-fatal.
        console.error("[LALAL] vocals download failed (alignment will skip):", err);
      }
    }

    return { success: true, instrumentalUrl, vocalsPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown LALAL error.";
    console.error("[LALAL] separation failed:", message);
    return { success: false, error: message };
  }
}
