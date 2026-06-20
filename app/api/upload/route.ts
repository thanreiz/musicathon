import { uploadAndSplit } from "@/lib/api/lalal";

/**
 * Maximum file size: 20 MB.
 *
 * We cap at 20 MB because:
 *  - A typical 3-minute MP3 at 320 kbps is ~7 MB; 20 MB covers even
 *    uncompressed-ish formats for short clips.
 *  - LALAL.AI's own limit is 10 GB, so this is well within their bounds.
 *  - Vercel's Hobby tier has a 4.5 MB *request body* limit for serverless
 *    functions, so files > ~4.5 MB will fail on the deployed version (but
 *    work fine locally). We validate against 20 MB to catch truly huge
 *    files; Vercel's own limit will kick in before ours in production.
 *    This is documented in the upload UI so users know to keep clips short.
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

    // ── Upload to LALAL.AI and start split ────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { taskId } = await uploadAndSplit(buffer, file.name);

    return Response.json({ taskId });
  } catch (error) {
    console.error("[/api/upload] Error:", error);

    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";

    return Response.json(
      {
        error:
          "We could not process your upload right now. Please try again. " +
          `(${message})`,
      },
      { status: 502 },
    );
  }
}
