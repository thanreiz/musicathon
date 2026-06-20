"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import GeneratedCover from "@/components/GeneratedCover";
import type { TrackMetadata } from "@/lib/types";

type SearchResponse = {
  error?: string;
  results?: TrackMetadata[];
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<TrackMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmedQuery = useMemo(() => debouncedQuery.trim(), [debouncedQuery]);
  const visibleResults = trimmedQuery.length > 0 ? results : [];
  const visibleError = trimmedQuery.length > 0 ? error : null;
  const showLoading = trimmedQuery.length > 0 && isLoading;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (trimmedQuery.length === 0) {
      return;
    }

    const controller = new AbortController();

    async function search() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmedQuery)}`,
          {
            signal: controller.signal,
          },
        );
        const payload = (await response.json()) as SearchResponse;

        if (!response.ok) {
          throw new Error(payload.error ?? "Search failed.");
        }

        setResults(payload.results ?? []);
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setResults([]);
        setError("We could not search songs right now. Please try again.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void search();

    return () => controller.abort();
  }, [trimmedQuery]);

  const showEmptyState =
    trimmedQuery.length > 0 &&
    !showLoading &&
    !visibleError &&
    visibleResults.length === 0;

  return (
    <main className="min-h-screen bg-[#120913] px-5 py-8 text-[#fff8eb] sm:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-2xl font-black text-[#ffcf66] transition hover:text-[#ffd98a]"
          >
            Myusika
          </Link>
          <span className="text-xs font-bold uppercase tracking-[0.22em] text-[#ffe8c2]/55">
            Song search
          </span>
        </header>

        <section className="rounded-[2rem] border border-[#ffcf66]/15 bg-[#1a0b10]/80 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.32)] sm:p-8">
          <div className="space-y-3">
            <h1 className="text-4xl font-black leading-tight text-[#ffcf66] sm:text-5xl">
              Find your song
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[#ffe8c2]/80">
              Search by title or artist, then pick the exact track before we add
              your audio.
            </p>
          </div>

          <label className="mt-8 block">
            <span className="sr-only">Search for a song</span>
            <input
              autoComplete="off"
              autoFocus
              className="h-14 w-full rounded-2xl border border-[#ffcf66]/25 bg-[#0c060d] px-5 text-base font-semibold text-[#fff8eb] outline-none transition placeholder:text-[#ffe8c2]/35 focus:border-[#ffb84d] focus:ring-4 focus:ring-[#ffb84d]/15"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try “Buwan”, “Cruel Summer”, or “Dilaw”"
              type="search"
              value={query}
            />
          </label>
        </section>

        <section aria-live="polite" className="min-h-72">
          {showLoading ? <SearchSkeleton /> : null}

          {visibleError ? (
            <StateMessage
              title="Search hit a snag"
              message="Something went wrong while talking to Musixmatch. Your key may be invalid or the service may be busy."
            />
          ) : null}

          {showEmptyState ? (
            <StateMessage
              title="No songs found"
              message="Try a different title, artist, or spelling. Shorter searches often work better."
            />
          ) : null}

          {!showLoading && !visibleError && visibleResults.length > 0 ? (
            <div className="grid gap-3">
              {visibleResults.map((track) => (
                <Link
                  className="group grid grid-cols-[4.5rem_1fr] gap-4 rounded-3xl border border-[#ffcf66]/12 bg-[#1f0d13]/85 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:border-[#ffb84d]/45 hover:bg-[#281018] active:translate-y-0"
                  href={`/confirm/${track.trackId}`}
                  key={track.trackId}
                >
                  <TrackArtwork track={track} size={72} />
                  <div className="min-w-0 self-center">
                    <h2 className="truncate text-base font-extrabold text-[#fff8eb] group-hover:text-[#ffcf66]">
                      {track.title}
                    </h2>
                    <p className="truncate text-sm font-semibold text-[#ffe8c2]/80">
                      {track.artist}
                    </p>
                    <p className="truncate text-xs font-medium uppercase tracking-wide text-[#ffe8c2]/45">
                      {track.albumName}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}

          {!showLoading && !visibleError && trimmedQuery.length === 0 ? (
            <StateMessage
              title="What are we singing?"
              message="Start typing a song title or artist. Results will appear here as you search."
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}

function TrackArtwork({
  size,
  track,
}: {
  size: number;
  track: TrackMetadata;
}) {
  if (!track.coverArtUrl) {
    return (
      <GeneratedCover
        title={track.title}
        artist={track.artist}
        size={size}
        className="rounded-2xl"
      />
    );
  }

  return (
    <Image
      alt={`${track.title} album art`}
      className="rounded-2xl object-cover"
      height={size}
      src={track.coverArtUrl}
      width={size}
    />
  );
}

function SearchSkeleton() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((item) => (
        <div
          className="grid animate-pulse grid-cols-[4.5rem_1fr] gap-4 rounded-3xl border border-[#ffcf66]/10 bg-[#1f0d13]/70 p-3"
          key={item}
        >
          <div className="h-[72px] w-[72px] rounded-2xl bg-[#ffcf66]/12" />
          <div className="space-y-3 self-center">
            <div className="h-4 w-2/3 rounded bg-[#ffcf66]/15" />
            <div className="h-3 w-1/2 rounded bg-[#ffcf66]/10" />
            <div className="h-3 w-1/3 rounded bg-[#ffcf66]/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StateMessage({ message, title }: { message: string; title: string }) {
  return (
    <div className="rounded-[2rem] border border-[#ffcf66]/12 bg-[#1a0b10]/70 p-8 text-center">
      <h2 className="text-xl font-black text-[#ffcf66]">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#ffe8c2]/70">
        {message}
      </p>
    </div>
  );
}
