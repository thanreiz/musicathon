"use client";

import KaraokePlayer from "@/components/KaraokePlayer";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { RichsyncData, RichsyncLine, TrackMetadata } from "@/lib/types";

type TrackResponse = {
  error?: string;
  track?: TrackMetadata;
};

export default function KaraokePage() {
  const params = useParams<{ trackId: string }>();
  const trackId = params.trackId ?? "";
  const searchParams = useSearchParams();
  const instrumentalUrl = searchParams.get("instrumentalUrl") ?? "";

  const [track, setTrack] = useState<TrackMetadata | null>(null);
  const [richsync, setRichsync] = useState<RichsyncData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!trackId) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    async function load() {
      setIsLoading(true);

      try {
        const [trackRes, richsyncRes] = await Promise.all([
          fetch(`/api/track/${trackId}`, { signal: controller.signal }),
          fetch(`/api/richsync/${trackId}`, { signal: controller.signal }),
        ]);

        const trackData = (await trackRes.json()) as TrackResponse;
        const richsyncData = (await richsyncRes.json()) as RichsyncData;

        if (trackData.track) {
          setTrack(trackData.track);
        }

        setRichsync(richsyncData);
      } catch {
        if (controller.signal.aborted) return;
        setRichsync({ available: false, reason: "Failed to load lyrics." });
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [trackId]);

  // ── Loading ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#120913] text-[#fff8eb]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#ffcf66]/20 border-t-[#ffb84d]" />
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#ffb84d]">
            Loading your karaoke session…
          </p>
        </div>
      </main>
    );
  }

  // ── Richsync unavailable ───────────────────────────────────────────
  if (!richsync || !richsync.available) {
    const reason = richsync && !richsync.available
      ? richsync.reason
      : "Synced lyrics are not available for this track.";

    return (
      <main className="min-h-screen bg-[#120913] px-5 py-8 text-[#fff8eb] sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8">
          <header className="flex w-full items-center justify-between gap-4">
            <Link
              href="/search"
              className="rounded-full border border-[#ffcf66]/25 px-4 py-2 text-sm font-bold text-[#ffefcf] transition hover:border-[#ffcf66] hover:bg-[#ffcf66]/10"
            >
              Back to search
            </Link>
          </header>

          <section className="w-full rounded-[2rem] border border-[#ffcf66]/12 bg-[#1a0b10]/80 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#ffb84d]/15">
              <svg
                className="h-8 w-8 text-[#ffcf66]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-[#ffcf66]">
              {track?.title ?? "Unknown track"}
            </h1>
            {track?.artist && (
              <p className="mt-2 text-sm font-semibold text-[#ffe8c2]/70">
                {track.artist}
              </p>
            )}
            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#ffe8c2]/65">
              {reason}
            </p>
            <Link
              href="/search"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-full border border-[#ffcf66]/35 px-6 text-sm font-bold uppercase tracking-wide text-[#ffefcf] transition hover:border-[#ffcf66] hover:bg-[#ffcf66]/10"
            >
              Search another song
            </Link>
          </section>

          <p className="text-xs text-[#ffe8c2]/35">Lyrics by Musixmatch</p>
        </div>
      </main>
    );
  }

  // ── Ready to sing ──────────────────────────────────────────────────
  const lines: RichsyncLine[] = richsync.lines;

  return (
    <main className="min-h-screen bg-[#120913] px-5 py-8 text-[#fff8eb] sm:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/search"
            className="rounded-full border border-[#ffcf66]/25 px-4 py-2 text-sm font-bold text-[#ffefcf] transition hover:border-[#ffcf66] hover:bg-[#ffcf66]/10"
          >
            Back to search
          </Link>
          <span className="text-xs font-bold uppercase tracking-[0.22em] text-[#ffe8c2]/55">
            Karaoke
          </span>
        </header>

        <KaraokePlayer
          audioUrl={instrumentalUrl}
          richsyncData={lines}
          trackTitle={track?.title ?? "Unknown track"}
          trackArtist={track?.artist ?? "Unknown artist"}
        />

        <p className="text-center text-xs text-[#ffe8c2]/35">
          Lyrics by Musixmatch
        </p>
      </div>
    </main>
  );
}
