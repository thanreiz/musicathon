"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { TrackMetadata } from "@/lib/types";

type TrackResponse = {
  error?: string;
  track?: TrackMetadata;
};

export default function ConfirmTrackPage() {
  const params = useParams<{ trackId: string }>();
  const trackId = params.trackId ?? "";
  const [track, setTrack] = useState<TrackMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(trackId));
  const [error, setError] = useState<string | null>(null);
  const visibleError = trackId ? error : "We could not find that song.";
  const showLoading = Boolean(trackId) && isLoading;

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
                <div className="grid aspect-square place-items-center rounded-[1.5rem] bg-[#ffb84d]/15 text-7xl font-black text-[#ffcf66]">
                  {track.title.slice(0, 1).toUpperCase()}
                </div>
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

              <div className="rounded-[2rem] border border-dashed border-[#ffcf66]/35 bg-[#0c060d]/80 p-8 text-center">
                <p className="text-sm font-black uppercase tracking-[0.24em] text-[#ffb84d]">
                  Upload your audio
                </p>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#ffe8c2]/70">
                  Drop your vocal take here in the next phase. For now, this is
                  a placeholder so the confirmation flow stays focused.
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

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
