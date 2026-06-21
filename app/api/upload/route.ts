import { separateVocals } from "@/lib/audio/separate";
import { separateVocalsLalal, shouldUseLalal } from "@/lib/audio/separate-lalal";
import { getRichsync } from "@/lib/api/musixmatch";
import { alignLyrics, type AlignSegment } from "@/lib/audio/align";
import { writeAlignedLyrics } from "@/lib/audio/aligned-store";

/**
 * Best-effort forced alignment for songs WITHOUT studio richsync. Uses the
 * separated vocal stem + the known LRC lyric lines to produce word-level
 * timing, stored for the richsync route to serve. Never throws into the upload
 * flow — any failure just leaves the LRC estimate in place.
 */
async function maybeAlignLyrics(
  trackId: string | null,
  vocalsPath: string | null,
): Promise<void> {
  if (!trackId || !vocalsPath) return;
  try {
    const mxm = await getRichsync(trackId);
    // Studio richsync already exists, or no lyrics at all → nothing to align.
    if (!mxm.available || mxm.syncSource === "richsync") return;

    const segments: AlignSegment[] = mxm.lines
      .filter((line) => line.words.length > 0)
      .map((line) => ({
        text: line.text,
        startMs: line.words[0].startTimeMs,
        endMs: line.words[line.words.length - 1].endTimeMs,
      }));
    if (segments.length === 0) return;

    const aligned = await alignLyrics(vocalsPath, segments);
    if (aligned) {
      await writeAlignedLyrics(trackId, aligned);
      console.log(`[/api/upload] Stored WhisperX alignment for track ${trackId}`);
    }
  } catch (error) {
    console.error("[/api/upload] Alignment skipped:", error);
  }
}

/**
 * Maximum file size: 20 MB.
 */
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

/**
 * Allowed audio MIME types. We also check file extensions as a fallback
 * because some browsers report generic MIME types for audio files.
 */
const ALLOWED_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/x-m4a",
  "audio/m4a",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  "audio/x-flac",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".m4a",
  ".ogg",
  ".flac",
  ".aac",
]);

function hasAllowedExtension(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

export async function POST(request: Request) {

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const trackId = (formData.get("trackId") as string | null) ?? null;

    // ── Validate presence ─────────────────────────────────────────────
    if (!file || !(file instanceof File)) {
      return Response.json(
        { error: "No audio file provided. Please select a file to upload." },
        { status: 400 },
      );
    }

    // ── Validate file type ────────────────────────────────────────────
    const mimeOk = ALLOWED_MIME_TYPES.has(file.type);
    const extOk = hasAllowedExtension(file.name);

    if (!mimeOk && !extOk) {
      return Response.json(
        {
          error:
            `Unsupported file format "${file.name.split(".").pop() ?? "unknown"}". ` +
            "Please upload an MP3, WAV, M4A, OGG, FLAC, or AAC file.",
        },
        { status: 400 },
      );
    }

    // ── Validate file size ────────────────────────────────────────────
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return Response.json(
        {
          error:
            `File is too large (${sizeMB} MB). ` +
            "Maximum size is 20 MB. Try a shorter audio clip.",
        },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return Response.json(
        { error: "The file appears to be empty. Please select a valid audio file." },
        { status: 400 },
      );
    }

    // ── Vocal separation ──────────────────────────────────────────────
    // On Vercel: LALAL.AI handles ALL tracks (Demucs can't run in serverless).
    // Locally: LALAL.AI is the primary path for the env-gated demo track;
    // any failure/timeout falls back to Demucs. All other local tracks use
    // Demucs directly.
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let result = null as Awaited<ReturnType<typeof separateVocals>> | null;
    if (shouldUseLalal(trackId)) {
      console.log(`[/api/upload] Trying LALAL.AI for demo track ${trackId}`);
      const lalal = await separateVocalsLalal(buffer, file.name);
      if (lalal.success) {
        result = lalal;
      } else {
        console.warn(
          `[/api/upload] LALAL failed (${lalal.error}); falling back to Demucs.`,
        );
      }
    }
    if (!result) {
      result = await separateVocals(buffer, file.name);
    }

    if (!result.success) {
      // Log the raw cause server-side; show the user a clean, generic message
      // (the raw error can contain Demucs stderr and absolute file paths).
      console.error("[/api/upload] Separation failed:", result.error);
      return Response.json(
        {
          error:
            "We couldn't remove the vocals from this file. Please try a different audio file.",
        },
        { status: 502 },
      );
    }

    // Best-effort: force-align lyrics for non-richsync songs before responding,
    // so the karaoke page sees the improved "auto" timing on first load.
    await maybeAlignLyrics(trackId, result.vocalsPath);

    // Return the instrumental URL directly — no polling needed
    return Response.json({
      instrumentalUrl: result.instrumentalUrl,
    });
  } catch (error) {
    console.error("[/api/upload] Error:", error);

    return Response.json(
      { error: "We could not process your upload right now. Please try again." },
      { status: 502 },
    );
  }
}
