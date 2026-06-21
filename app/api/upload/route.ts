// import { uploadAndSplit } from "@/lib/api/lalal";  // DISABLED — replaced by local Demucs
import { separateVocals } from "@/lib/audio/separate";

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
  // Vocal separation runs Demucs as a local child process (python3 + ffmpeg),
  // which isn't available on Vercel's serverless runtime. Degrade gracefully
  // with a clear message instead of leaking a "spawn python3 ENOENT" error.
  if (process.env.VERCEL) {
    return Response.json(
      {
        error:
          "Audio upload & vocal removal run in the local demo environment only " +
          "(they need on-device AI processing). Please run Myusika locally to upload songs.",
      },
      { status: 503 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

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

    // ── Run Demucs locally for vocal separation ───────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await separateVocals(buffer, file.name);

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
