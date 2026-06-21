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
  | { phase: "processing" }
  | { phase: "complete"; instrumentalUrl: string }
  | { phase: "error"; message: string };

// Friendly rotating status messages shown during upload + Demucs processing
const PROCESSING_MESSAGES = [
  "Uploading your audio…",
  "Analyzing your audio…",
  "Removing vocals with AI…",
  "Isolating the instrumental track…",
  "Still working — this can take a minute or two…",
  "Almost there…",
];

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

  // ── File upload + Demucs separation (single request) ───────────────
  const handleFile = useCallback(async (file: File) => {
    setUploadState({ phase: "processing" });

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("trackId", trackId);

      const res = await fetch("/api/upload", { method: "POST", body });
      const data = (await res.json()) as {
        instrumentalUrl?: string;
        error?: string;
      };

      if (!res.ok || !data.instrumentalUrl) {
        setUploadState({
          phase: "error",
          message:
            data.error ?? "Separation failed. Please check your file and try again.",
        });
        return;
      }

      setUploadState({
        phase: "complete",
        instrumentalUrl: data.instrumentalUrl,
      });

      // Auto-save to library when processing completes successfully.
      // Best-effort: failures here must not block the karaoke flow.
      if (track) {
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
              instrumentalUrl: data.instrumentalUrl,
            }),
          }).catch(() => {
            // Saving history is best-effort; ignore network failures.
          });
        } catch {
          // localStorage may be unavailable (e.g. private mode) — skip saving.
        }
      }
    } catch {
      setUploadState({
        phase: "error",
        message:
          "Could not connect to the server. Check your connection and try again.",
      });
    }
  }, [track, trackId]);

  // ── Navigate to karaoke ────────────────────────────────────────────
  const handleStartKaraoke = useCallback(() => {
    if (uploadState.phase !== "complete") return;
    const url = `/karaoke/${trackId}?instrumentalUrl=${encodeURIComponent(uploadState.instrumentalUrl)}`;
    router.push(url);
  }, [router, trackId, uploadState]);

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-bg px-5 py-8 text-foreground sm:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 border-b border-gold/10 pb-4">
          <div className="flex items-center gap-3 whitespace-nowrap">
            <Link
              href="/"
              className="font-display text-2xl text-gold transition hover:text-gold-light"
            >
              Myusika
            </Link>
            <span className="text-gold/30">|</span>
            <button
              onClick={() => {
                if (window.history.length > 1) {
                  router.back();
                } else {
                  router.push("/");
                }
              }}
              className="flex items-center gap-1 text-sm font-bold text-cream-light hover:text-gold transition whitespace-nowrap"
            >
              ← Back
            </button>
          </div>
          <div className="flex items-center gap-4 whitespace-nowrap">
            <Link
              href="/search"
              className="text-xs font-bold uppercase tracking-[0.22em] text-cream/75 hover:text-gold transition whitespace-nowrap"
            >
              Search
            </Link>
            <span className="text-gold/30">|</span>
            <Link
              href="/my-songs"
              className="text-xs font-bold uppercase tracking-[0.22em] text-cream/75 hover:text-gold transition whitespace-nowrap"
            >
              My Songs
            </Link>
          </div>
        </header>

        {showLoading ? <ConfirmSkeleton /> : null}

        {visibleError ? (
          <section className="rounded-[2rem] border border-gold/12 bg-surface/80 p-8 text-center">
            <h1 className="font-display text-3xl text-gold">
              Song not found
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-cream/75">
              {visibleError}
            </p>
          </section>
        ) : null}

        {!showLoading && !visibleError && track ? (
          <section className="grid grid-cols-1 gap-8 lg:grid-cols-[22rem_1fr] lg:items-start">
            <div className="overflow-hidden rounded-[2rem] border border-gold/15 bg-surface/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
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
              <div className="rounded-[2rem] border border-gold/15 bg-surface/80 p-6 sm:p-8">
                <p className="text-sm font-bold uppercase tracking-[0.24em] text-amber">
                  This is the right song
                </p>
                <h1 className="font-display mt-4 text-4xl leading-tight text-gold sm:text-5xl">
                  {track.title}
                </h1>
                <div className="mt-5 space-y-2 text-cream/80">
                  <p className="text-lg font-bold">{track.artist}</p>
                  <p className="text-sm font-semibold uppercase tracking-wide text-cream/55">
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
        className={`group w-full cursor-pointer rounded-[2rem] border-2 border-dashed p-8 text-center transition-all active:scale-[0.99] ${
          isDragOver
            ? "border-amber bg-amber/10 scale-[1.01]"
            : "border-gold/30 bg-bg-deep/80 hover:border-gold/60 hover:bg-bg-deep"
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
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber/15 transition group-hover:bg-amber/25">
          <svg
            className="h-7 w-7 text-gold"
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

        <p className="text-sm font-black uppercase tracking-[0.24em] text-amber">
          Upload your audio
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-cream/70">
          Upload an audio file of this song so we can prepare your instrumental
          track. Drag &amp; drop or click to browse.
        </p>
        <p className="mt-2 text-xs text-cream/55">
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

  // ── Processing ─────────────────────────────────────────────────────
  if (uploadState.phase === "processing") {
    return (
      <div className="rounded-[2rem] border border-gold/15 bg-bg-deep/80 p-8 text-center">
        <ProcessingAnimation progress={50} />
        <p className="mt-4 text-sm font-black uppercase tracking-[0.24em] text-amber">
          <RotatingText messages={PROCESSING_MESSAGES} intervalMs={5000} />
        </p>
        <div className="mx-auto mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-gold/15">
          <div
            className="h-full animate-pulse rounded-full bg-amber"
            style={{ width: "60%" }}
          />
        </div>
        <p className="mx-auto mt-3 max-w-md text-xs leading-5 text-cream/55">
          Vocal removal typically takes 30–90 seconds. Please keep this page open.
        </p>
      </div>
    );
  }

  // ── Complete ───────────────────────────────────────────────────────
  if (uploadState.phase === "complete") {
    return (
      <div className="rounded-[2rem] border border-gold/15 bg-bg-deep/80 p-8 text-center animate-fade-in-up">
        {/* Success icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 animate-fade-in-up">
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
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-cream/65">
          We&rsquo;ve removed the vocals from your audio. Ready to start your
          karaoke session?
        </p>
        <button
          type="button"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-amber px-8 text-sm font-bold uppercase tracking-wide text-surface shadow-[0_14px_40px_rgba(255,184,77,0.28)] transition hover:bg-gold-hover active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-bg"
          onClick={onStartKaraoke}
        >
          Start Karaoke
        </button>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────
  return (
    <div className="rounded-[2rem] border border-red-500/25 bg-bg-deep/80 p-8 text-center animate-fade-in-up">
      {/* Error icon */}
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 animate-fade-in-up">
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
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-cream/65">
        {uploadState.message}
      </p>
      <button
        type="button"
        className="mt-6 inline-flex h-10 items-center justify-center rounded-full border border-gold/35 px-6 text-sm font-bold uppercase tracking-wide text-cream-light transition hover:border-gold hover:bg-gold/10 active:scale-[0.97]"
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
    <section className="grid grid-cols-1 animate-pulse gap-8 lg:grid-cols-[22rem_1fr]">
      <div className="aspect-square rounded-[2rem] bg-gold/10" />
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-gold/10 bg-surface/70 p-8">
          <div className="h-4 w-40 rounded bg-gold/15" />
          <div className="mt-5 h-10 w-2/3 rounded bg-gold/15" />
          <div className="mt-5 h-5 w-1/2 rounded bg-gold/10" />
          <div className="mt-3 h-4 w-1/3 rounded bg-gold/10" />
        </div>
        <div className="h-40 rounded-[2rem] border border-dashed border-gold/20 bg-bg-deep/70" />
      </div>
    </section>
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
          stroke="var(--color-amber)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(progress / 100) * 226} 226`}
          className="transition-all duration-700"
        />
      </svg>
      {/* Inner pulsing dot */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-4 w-4 animate-pulse rounded-full bg-amber/60" />
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
