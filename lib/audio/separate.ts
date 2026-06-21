/**
 * Local Demucs-based vocal separator — replaces LALAL.AI.
 *
 * Runs Meta's Demucs (htdemucs model) as a child process to separate
 * vocals from a song, producing a no_vocals.mp3 instrumental file.
 *
 * This is designed to run LOCALLY (dev server / demo machine) only.
 * Vercel's serverless functions have execution time limits that make
 * running Demucs infeasible in a deployed environment.
 */

import { execFile } from "node:child_process";
import { mkdir, copyFile, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const SCRIPTS_DIR = path.join(process.cwd(), "scripts");
const DEMUCS_WRAPPER = path.join(SCRIPTS_DIR, "run_demucs.py");
const TEMP_DIR = path.join(process.cwd(), ".demucs-tmp");
const PUBLIC_OUTPUT_DIR = path.join(process.cwd(), "public", "separated");

export type SeparationResult =
  | { success: true; instrumentalUrl: string; vocalsPath: string | null }
  | { success: false; error: string };

/**
 * Separates vocals from an audio file using local Demucs.
 *
 * @param fileBuffer - The uploaded audio file as a Buffer
 * @param filename - Original filename (used for extension detection)
 * @returns The URL path to the instrumental (no_vocals) MP3
 */
export async function separateVocals(
  fileBuffer: Buffer,
  filename: string,
): Promise<SeparationResult> {
  const jobId = randomUUID();
  const ext = path.extname(filename) || ".wav";
  const inputPath = path.join(TEMP_DIR, `${jobId}${ext}`);
  const outputDir = path.join(TEMP_DIR, `${jobId}-output`);

  try {
    // Ensure directories exist
    await mkdir(TEMP_DIR, { recursive: true });
    await mkdir(outputDir, { recursive: true });
    await mkdir(PUBLIC_OUTPUT_DIR, { recursive: true });

    // Write the uploaded file to disk
    await writeFile(inputPath, new Uint8Array(fileBuffer));

    // Run Demucs via the wrapper script
    const trackName = path.basename(filename, ext);
    await runDemucs(inputPath, outputDir);

    // Find the output file. Demucs outputs to:
    //   <outputDir>/htdemucs/<trackName>/no_vocals.mp3
    const noVocalsPath = path.join(
      outputDir,
      "htdemucs",
      trackName,
      "no_vocals.mp3",
    );

    if (!existsSync(noVocalsPath)) {
      // Try the jobId-based name (Demucs uses the input filename stem)
      const altPath = path.join(
        outputDir,
        "htdemucs",
        jobId,
        "no_vocals.mp3",
      );
      if (!existsSync(altPath)) {
        return {
          success: false,
          error: "Demucs completed but no instrumental file was found.",
        };
      }
      // Use the alt path
      const outputFilename = `${jobId}.mp3`;
      const publicPath = path.join(PUBLIC_OUTPUT_DIR, outputFilename);
      await copyFile(altPath, publicPath);
      // The vocals stem (--two-stems=vocals) sits next to no_vocals.mp3; kept
      // in temp for optional forced alignment.
      const altVocals = path.join(outputDir, "htdemucs", jobId, "vocals.mp3");
      return {
        success: true,
        instrumentalUrl: `/separated/${outputFilename}`,
        vocalsPath: existsSync(altVocals) ? altVocals : null,
      };
    }

    // Copy to public directory so Next.js can serve it
    const outputFilename = `${jobId}.mp3`;
    const publicPath = path.join(PUBLIC_OUTPUT_DIR, outputFilename);
    await copyFile(noVocalsPath, publicPath);

    const vocalsPath = path.join(outputDir, "htdemucs", trackName, "vocals.mp3");
    return {
      success: true,
      instrumentalUrl: `/separated/${outputFilename}`,
      vocalsPath: existsSync(vocalsPath) ? vocalsPath : null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error during separation.";
    console.error("[separateVocals] Error:", message);
    return { success: false, error: message };
  } finally {
    // Clean up temp files (best-effort)
    try {
      await unlink(inputPath).catch(() => {});
      // Don't recursively remove outputDir here — it's cleaned up lazily
    } catch {
      // ignore
    }
  }
}

function runDemucs(inputPath: string, outputDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      "python3",
      [DEMUCS_WRAPPER, inputPath, outputDir],
      {
        timeout: 5 * 60 * 1000, // 5-minute timeout
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env },
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error("[Demucs stderr]:", stderr);
          reject(
            new Error(
              `Demucs failed: ${error.message}\n${stderr}`.slice(0, 500),
            ),
          );
          return;
        }
        // Demucs prints progress to stderr on success — that's normal, ignore.
        resolve();
      },
    );
  });
}
