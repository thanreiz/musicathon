"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import GeneratedCover from "@/components/GeneratedCover";
import type { TrackMetadata } from "@/lib/types";

type SearchResponse = {
  error?: string;
  results?: TrackMetadata[];
};

const SUGGESTED_SONGS = [
  { title: "Buwan", artist: "Juan Karlos", query: "Buwan Juan Karlos" },
  { title: "Dilaw", artist: "Maki", query: "Dilaw Maki" },
  { title: "Cruel Summer", artist: "Taylor Swift", query: "Cruel Summer Taylor Swift" },
  { title: "Bohemian Rhapsody", artist: "Queen", query: "Bohemian Rhapsody Queen" },
  { title: "Dancing Queen", artist: "ABBA", query: "Dancing Queen ABBA" },
  { title: "Ang Huling El Bimbo", artist: "Eraserheads", query: "Ang Huling El Bimbo Eraserheads" },
  { title: "Fly Me to the Moon", artist: "Frank Sinatra", query: "Fly Me to the Moon Frank Sinatra" },
  { title: "Perfect", artist: "Ed Sheeran", query: "Perfect Ed Sheeran" },
];

export default function SearchPage() {
  const router = useRouter();
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
    <main className="min-h-screen bg-bg px-5 py-8 text-foreground sm:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex items-center justify-between gap-4 border-b border-gold/10 pb-4">
          <div className="flex items-center gap-3">
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
              className="flex items-center gap-1 text-sm font-bold text-cream-light hover:text-gold transition"
            >
              ← Back
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold uppercase tracking-[0.22em] text-gold">
              Search
            </span>
            <span className="text-gold/30">|</span>
            <Link
              href="/my-songs"
              className="text-xs font-bold uppercase tracking-[0.22em] text-cream/75 hover:text-gold transition"
            >
              My Songs
            </Link>
          </div>
        </header>

        <section className="rounded-[2rem] border border-gold/15 bg-surface/80 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.32)] sm:p-8">
          <div className="space-y-3">
            <h1 className="font-display text-4xl leading-tight text-gold sm:text-5xl">
              Find your song
            </h1>
            <p className="max-w-2xl text-base leading-7 text-cream/80">
              Search by title or artist, then pick the exact track before we add
              your audio.
            </p>
          </div>

          <label className="mt-8 block">
            <span className="sr-only">Search for a song</span>
            <input
              autoComplete="off"
              autoFocus
              className="h-14 w-full rounded-2xl border border-gold/25 bg-bg-deep px-5 text-base font-semibold text-foreground outline-none transition placeholder:text-cream/35 focus:border-amber focus:ring-4 focus:ring-amber/15"
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
              {visibleResults.map((track, idx) => (
                <Link
                  className="group grid grid-cols-[4.5rem_1fr] gap-4 rounded-3xl border border-gold/12 bg-surface-alt/85 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:border-amber/45 hover:bg-surface-hover active:translate-y-0 active:scale-[0.99] animate-fade-in-up"
                  href={`/confirm/${track.trackId}`}
                  key={track.trackId}
                  style={{ animationDelay: `${Math.min(idx, 6) * 40}ms` }}
                >
                  <TrackArtwork track={track} size={72} />
                  <div className="min-w-0 self-center">
                    <h2 className="truncate text-base font-extrabold text-foreground group-hover:text-gold">
                      {track.title}
                    </h2>
                    <p className="truncate text-sm font-semibold text-cream/80">
                      {track.artist}
                    </p>
                    <p className="truncate text-xs font-medium uppercase tracking-wide text-cream/45">
                      {track.albumName}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}

          {!showLoading && !visibleError && trimmedQuery.length === 0 ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-1.5 border-l-4 border-gold pl-4">
                <h2 className="text-xl font-black tracking-wider text-gold uppercase">
                  Browse the Songbook
                </h2>
                <p className="text-sm font-semibold text-cream/55">
                  Choose a favorite to load its lyrics and album cover instantly:
                </p>
              </div>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                {SUGGESTED_SONGS.map((song, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setQuery(song.query);
                      setDebouncedQuery(song.query);
                    }}
                    className="flex flex-col gap-3 rounded-2xl border border-gold/12 bg-surface-alt/85 p-4 text-left transition hover:-translate-y-0.5 hover:border-amber/45 hover:bg-surface-hover active:translate-y-0 active:scale-[0.98] shadow-[0_12px_36px_rgba(0,0,0,0.15)] group animate-fade-in-up"
                    style={{ animationDelay: `${Math.min(idx, 7) * 40}ms` }}
                  >
                    {/* Mic Icon */}
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber/10 text-gold transition group-hover:bg-amber/20">
                      <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-black text-foreground group-hover:text-gold">
                        {song.title}
                      </h3>
                      <p className="truncate text-xs font-semibold text-cream/60 mt-0.5">
                        {song.artist}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
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
          className="grid animate-pulse grid-cols-[4.5rem_1fr] gap-4 rounded-3xl border border-gold/10 bg-surface-alt/70 p-3"
          key={item}
        >
          <div className="h-[72px] w-[72px] rounded-2xl bg-gold/12" />
          <div className="space-y-3 self-center">
            <div className="h-4 w-2/3 rounded bg-gold/15" />
            <div className="h-3 w-1/2 rounded bg-gold/10" />
            <div className="h-3 w-1/3 rounded bg-gold/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StateMessage({ message, title }: { message: string; title: string }) {
  return (
    <div className="rounded-[2rem] border border-gold/12 bg-surface/70 p-8 text-center">
      <h2 className="text-xl font-black text-gold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-cream/70">
        {message}
      </p>
    </div>
  );
}
