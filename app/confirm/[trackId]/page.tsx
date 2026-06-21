"use client";

import GeneratedCover from "@/components/GeneratedCover";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { TrackMetadata } from "@/lib/types";

type TrackResponse = {
  error?: string;
  track?: TrackMetadata;
};

// ---------------------------------------------------------------------------
// Upload state machine
// ---------------------------------------------------------------------------

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "processing"; taskId: string; progress: number }
  | { phase: "complete"; instrumentalUrl: string }
  | { phase: "error"; message: string };

// Friendly rotating status messages shown during LALAL.AI processing
const PROCESSING_MESSAGES = [
  "Analyzing your audio…",
  "Removing vocals…",
  "Isolating the instrumental track…",
  "Still working — this can take a minute or two…",
  "Almost there…",
];

/** Polling interval for status checks (ms). 4 s ≈ 15 req/min, well under
 *  LALAL.AI's 30 req/min rate limit on /check/. */
const POLL_INTERVAL_MS = 4_000;

/** Stop polling after this many attempts (75 × 4 s = 5 minutes). */
const MAX_POLL_ATTEMPTS = 75;

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ConfirmTrackPage() {
  const params = useParams<{ trackId: string }>();
  const trackId = params.trackId ?? "";
  const router = useRouter();

  const [track, setTrack] = useState<TrackMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(trackId));
  const [error, setError] = useState<string | null>(null);

  const visibleError = trackId ? error : "We could not find that song.";
  const showLoading = Boolean(trackId) && isLoading;

  // ── Fetch track metadata ───────────────────────────────────────────
  useEffect(() => {
    if (!trackId) {
      return;
    }

    const controller = new AbortController();

    async function loadTrack() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/track/${trackId}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as TrackResponse;

        if (!response.ok || !payload.track) {
          throw new Error(payload.error ?? "Track not found.");
        }

        setTrack(payload.track);
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setTrack(null);
        setError("We could not load that song. Try searching again.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadTrack();

    return () => controller.abort();
  }, [trackId]);

  // ── Upload state ──────────────────────────────────────────────────
  const [uploadState, setUploadState] = useState<UploadState>({
    phase: "idle",
  });

  // ── Polling logic (processing phase) ──────────────────────────────
  const pollCountRef = useRef(0);

  const isProcessing = uploadState.phase === "processing";
  const taskId = isProcessing ? (uploadState as { taskId: string }).taskId : undefined;

  useEffect(() => {
    if (!isProcessing || !taskId) {
      pollCountRef.current = 0;
      return;
    }

    const interval = setInterval(async () => {
      pollCountRef.current += 1;

      if (pollCountRef.current > MAX_POLL_ATTEMPTS) {
        clearInterval(interval);
        setUploadState({
          phase: "error",
          message:
            "Processing is taking longer than expected. Please try again with a shorter audio clip.",
        });
        return;
      }

      try {
        const res = await fetch(`/api/upload/status/${taskId}`);
        const data = (await res.json()) as {
          status: "processing" | "complete" | "error";
          progress?: number;
          instrumentalUrl?: string;
          error?: string;
        };

        if (data.status === "complete" && data.instrumentalUrl) {
          clearInterval(interval);
          setUploadState({
            phase: "complete",
            instrumentalUrl: data.instrumentalUrl,
          });
        } else if (data.status === "error") {
          clearInterval(interval);
          setUploadState({
            phase: "error",
            message:
              data.error ??
              "Something went wrong during processing. Please try again.",
          });
        } else if (data.status === "processing") {
          setUploadState({
            phase: "processing",
            taskId,
            progress: data.progress ?? 0,
          });
        }
      } catch {
        // Network hiccup — don't fail immediately, keep polling
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isProcessing, taskId]);

  // ── File upload handler ────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    setUploadState({ phase: "uploading" });

    try {
      const body = new FormData();
      body.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body });
      const data = (await res.json()) as {
        taskId?: string;
        error?: string;
      };

      if (!res.ok || !data.taskId) {
        setUploadState({
          phase: "error",
          message:
            data.error ?? "Upload failed. Please check your file and try again.",
        });
        return;
      }

      setUploadState({
        phase: "processing",
        taskId: data.taskId,
        progress: 0,
      });
    } catch {
      setUploadState({
        phase: "error",
        message:
          "Could not connect to the server. Check your connection and try again.",
      });
    }
  }, []);

  // ── Navigate to karaoke ────────────────────────────────────────────
  const handleStartKaraoke = useCallback(() => {
    if (uploadState.phase !== "complete" || !track) return;

    // Save to history (fire-and-forget — don't block navigation)
    try {
      const KEY = "myusika_device_id";
      let deviceId = localStorage.getItem(KEY);
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem(KEY, deviceId);
      }

      void fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          trackId,
          title: track.title,
          artist: track.artist,
          coverArtUrl: track.coverArtUrl,
          instrumentalUrl: uploadState.instrumentalUrl,
        }),
      });
    } catch {
      // Saving history is best-effort
    }

    const url = `/karaoke/${trackId}?instrumentalUrl=${encodeURIComponent(uploadState.instrumentalUrl)}`;
    router.push(url);
  }, [router, track, trackId, uploadState]);

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#120913] px-5 py-8 text-[#fff8eb] sm:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/search"
            className="rounded-full border border-[#ffcf66]/25 px-4 py-2 text-sm font-bold text-[#ffefcf] transition hover:border-[#ffcf66] hover:bg-[#ffcf66]/10"
          >
            Back to search
          </Link>
          <span className="text-xs font-bold uppercase tracking-[0.22em] text-[#ffe8c2]/55">
            Confirm track
          </span>
        </header>

        {showLoading ? <ConfirmSkeleton /> : null}

        {visibleError ? (
          <section className="rounded-[2rem] border border-[#ffcf66]/12 bg-[#1a0b10]/80 p-8 text-center">
            <h1 className="text-3xl font-black text-[#ffcf66]">
              Song not found
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#ffe8c2]/75">
              {visibleError}
            </p>
          </section>
        ) : null}

        {!showLoading && !visibleError && track ? (
          <section className="grid gap-8 lg:grid-cols-[22rem_1fr] lg:items-start">
            <div className="overflow-hidden rounded-[2rem] border border-[#ffcf66]/15 bg-[#1a0b10]/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
              {track.coverArtUrl ? (
                <Image
                  alt={`${track.title} album art`}
                  className="aspect-square w-full rounded-[1.5rem] object-cover"
                  height={640}
                  priority
                  src={track.coverArtUrl}
                  width={640}
                />
              ) : (
                <GeneratedCover
                  title={track.title}
                  artist={track.artist}
                  className="aspect-square w-full rounded-[1.5rem]"
                />
              )}
            </div>

            <div className="space-y-6">
              <div className="rounded-[2rem] border border-[#ffcf66]/15 bg-[#1a0b10]/80 p-6 sm:p-8">
                <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#ffb84d]">
                  This is the right song
                </p>
                <h1 className="mt-4 text-4xl font-black leading-tight text-[#ffcf66] sm:text-5xl">
                  {track.title}
                </h1>
                <div className="mt-5 space-y-2 text-[#ffe8c2]/80">
                  <p className="text-lg font-bold">{track.artist}</p>
                  <p className="text-sm font-semibold uppercase tracking-wide text-[#ffe8c2]/55">
                    {track.albumName}
                  </p>
                </div>
              </div>

              <AudioUploadZone
                uploadState={uploadState}
                onFile={handleFile}
                onRetry={() => setUploadState({ phase: "idle" })}
                onStartKaraoke={handleStartKaraoke}
              />
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Audio Upload Zone — the 5-state UI
// ---------------------------------------------------------------------------

function AudioUploadZone({
  uploadState,
  onFile,
  onRetry,
  onStartKaraoke,
}: {
  uploadState: UploadState;
  onFile: (file: File) => void;
  onRetry: () => void;
  onStartKaraoke: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  // ── Idle ───────────────────────────────────────────────────────────
  if (uploadState.phase === "idle") {
    return (
      <button
        type="button"
        className={`group w-full cursor-pointer rounded-[2rem] border-2 border-dashed p-8 text-center transition-all ${
          isDragOver
            ? "border-[#ffb84d] bg-[#ffb84d]/10"
            : "border-[#ffcf66]/30 bg-[#0c060d]/80 hover:border-[#ffcf66]/60 hover:bg-[#0c060d]"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Upload icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#ffb84d]/15 transition group-hover:bg-[#ffb84d]/25">
          <svg
            className="h-7 w-7 text-[#ffcf66]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6h.1a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>

        <p className="text-sm font-black uppercase tracking-[0.24em] text-[#ffb84d]">
          Upload your audio
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#ffe8c2]/70">
          Upload an audio file of this song so we can prepare your instrumental
          track. Drag &amp; drop or click to browse.
        </p>
        <p className="mt-2 text-xs text-[#ffe8c2]/40">
          MP3, WAV, M4A, OGG, FLAC — max 20 MB
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac"
          className="hidden"
          onChange={handleChange}
        />
      </button>
    );
  }

  // ── Uploading ──────────────────────────────────────────────────────
  if (uploadState.phase === "uploading") {
    return (
      <div className="rounded-[2rem] border border-[#ffcf66]/15 bg-[#0c060d]/80 p-8 text-center">
        <UploadSpinner />
        <p className="mt-4 text-sm font-black uppercase tracking-[0.24em] text-[#ffb84d]">
          Uploading your audio…
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#ffe8c2]/60">
          Sending your file to our audio processor. This should only take a few
          seconds.
        </p>
      </div>
    );
  }

  // ── Processing ─────────────────────────────────────────────────────
  if (uploadState.phase === "processing") {
    return (
      <div className="rounded-[2rem] border border-[#ffcf66]/15 bg-[#0c060d]/80 p-8 text-center">
        <ProcessingAnimation progress={uploadState.progress} />
        <p className="mt-4 text-sm font-black uppercase tracking-[0.24em] text-[#ffb84d]">
          <RotatingText messages={PROCESSING_MESSAGES} intervalMs={5000} />
        </p>
        <div className="mx-auto mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-[#ffcf66]/15">
          <div
            className="h-full rounded-full bg-[#ffb84d] transition-all duration-700"
            style={{ width: `${Math.max(uploadState.progress, 5)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[#ffe8c2]/45">
          {uploadState.progress}% complete
        </p>
        <p className="mx-auto mt-3 max-w-md text-xs leading-5 text-[#ffe8c2]/40">
          Vocal removal typically takes 1–2 minutes. Please keep this page open.
        </p>
      </div>
    );
  }

  // ── Complete ───────────────────────────────────────────────────────
  if (uploadState.phase === "complete") {
    return (
      <div className="rounded-[2rem] border border-[#ffcf66]/15 bg-[#0c060d]/80 p-8 text-center">
        {/* Success icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
          <svg
            className="h-8 w-8 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald-400">
          Instrumental track ready!
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#ffe8c2]/65">
          We&rsquo;ve removed the vocals from your audio. Ready to start your
          karaoke session?
        </p>
        <button
          type="button"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-[#ffb84d] px-8 text-sm font-bold uppercase tracking-wide text-[#1a0b10] shadow-[0_14px_40px_rgba(255,184,77,0.28)] transition hover:bg-[#ffd166] focus:outline-none focus:ring-2 focus:ring-[#ffcf66] focus:ring-offset-2 focus:ring-offset-[#120913]"
          onClick={onStartKaraoke}
        >
          Start Karaoke
        </button>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────
  return (
    <div className="rounded-[2rem] border border-red-500/25 bg-[#0c060d]/80 p-8 text-center">
      {/* Error icon */}
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15">
        <svg
          className="h-8 w-8 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>
      <p className="text-sm font-black uppercase tracking-[0.24em] text-red-400">
        Something went wrong
      </p>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#ffe8c2]/65">
        {uploadState.message}
      </p>
      <button
        type="button"
        className="mt-6 inline-flex h-10 items-center justify-center rounded-full border border-[#ffcf66]/35 px-6 text-sm font-bold uppercase tracking-wide text-[#ffefcf] transition hover:border-[#ffcf66] hover:bg-[#ffcf66]/10"
        onClick={onRetry}
      >
        Try again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helper components
// ---------------------------------------------------------------------------

function ConfirmSkeleton() {
  return (
    <section className="grid animate-pulse gap-8 lg:grid-cols-[22rem_1fr]">
      <div className="aspect-square rounded-[2rem] bg-[#ffcf66]/10" />
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-[#ffcf66]/10 bg-[#1a0b10]/70 p-8">
          <div className="h-4 w-40 rounded bg-[#ffcf66]/15" />
          <div className="mt-5 h-10 w-2/3 rounded bg-[#ffcf66]/15" />
          <div className="mt-5 h-5 w-1/2 rounded bg-[#ffcf66]/10" />
          <div className="mt-3 h-4 w-1/3 rounded bg-[#ffcf66]/10" />
        </div>
        <div className="h-40 rounded-[2rem] border border-dashed border-[#ffcf66]/20 bg-[#0c060d]/70" />
      </div>
    </section>
  );
}

/** Pulsing spinner used during the upload phase. */
function UploadSpinner() {
  return (
    <div className="mx-auto flex h-16 w-16 items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#ffcf66]/20 border-t-[#ffb84d]" />
    </div>
  );
}

/** Animated rings shown during vocal-removal processing. */
function ProcessingAnimation({ progress }: { progress: number }) {
  return (
    <div className="relative mx-auto h-20 w-20">
      {/* Outer ring */}
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          stroke="rgba(255,207,102,0.12)"
          strokeWidth="4"
        />
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          stroke="#ffb84d"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(progress / 100) * 226} 226`}
          className="transition-all duration-700"
        />
      </svg>
      {/* Inner pulsing dot */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-4 w-4 animate-pulse rounded-full bg-[#ffb84d]/60" />
      </div>
    </div>
  );
}

/** Cycles through a list of messages at a given interval. */
function RotatingText({
  messages,
  intervalMs,
}: {
  messages: string[];
  intervalMs: number;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [messages.length, intervalMs]);

  return <>{messages[index]}</>;
}
