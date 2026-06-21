"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SongHistoryRecord } from "@/lib/types";
import GeneratedCover from "@/components/GeneratedCover";
import { DEMO_SONGS } from "@/lib/demo-songs";

function getDeviceId(): string {
  const KEY = "myusika_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export default function MySongsPage() {
  const router = useRouter();
  const [history, setHistory] = useState<SongHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const deviceId = getDeviceId();
        const res = await fetch(`/api/history?deviceId=${encodeURIComponent(deviceId)}`);
        const data = (await res.json()) as { history?: SongHistoryRecord[] };
        const apiHistory = data.history ?? [];

        // Load local history backup
        let localHistory: SongHistoryRecord[] = [];
        try {
          const stored = localStorage.getItem("myusika_local_history");
          if (stored) {
            localHistory = JSON.parse(stored) as SongHistoryRecord[];
          }
        } catch (e) {
          console.error("Failed to load local history:", e);
        }

        // Merge both, sorting by createdAt descending, and deduping by trackId
        const mergedMap = new Map<string, SongHistoryRecord>();
        localHistory.forEach((item) => mergedMap.set(item.trackId, item));
        apiHistory.forEach((item) => mergedMap.set(item.trackId, item));

        const mergedList = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

        setHistory(mergedList);
      } catch {
        // Fallback to purely localStorage if API fails
        try {
          const stored = localStorage.getItem("myusika_local_history");
          if (stored) {
            setHistory(JSON.parse(stored) as SongHistoryRecord[]);
          } else {
            setHistory([]);
          }
        } catch {
          setHistory([]);
        }
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  const handleClearHistory = async () => {
    if (!confirm("Are you sure you want to clear your song history?")) {
      return;
    }
    try {
      const deviceId = getDeviceId();
      localStorage.removeItem("myusika_local_history");
      
      await fetch(`/api/history?deviceId=${encodeURIComponent(deviceId)}`, {
        method: "DELETE",
      });

      setHistory([]);
    } catch (e) {
      console.error("Failed to clear history:", e);
    }
  };

  return (
    <main className="min-h-screen bg-[#120913] px-5 py-8 text-[#fff8eb] sm:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex items-center justify-between gap-4 border-b border-[#ffcf66]/10 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-2xl font-black text-[#ffcf66] transition hover:text-[#ffd98a]"
            >
              Myusika
            </Link>
            <span className="text-[#ffcf66]/30">|</span>
            <button
              onClick={() => {
                if (window.history.length > 1) {
                  router.back();
                } else {
                  router.push("/");
                }
              }}
              className="flex items-center gap-1 text-sm font-bold text-[#ffefcf] hover:text-[#ffcf66] transition"
            >
              ← Back
            </button>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/search"
              className="text-xs font-bold uppercase tracking-[0.22em] text-[#ffe8c2]/75 hover:text-[#ffcf66] transition"
            >
              Search
            </Link>
            <span className="text-[#ffcf66]/30">|</span>
            <span className="text-xs font-bold uppercase tracking-[0.22em] text-[#ffcf66]">
              My Songs
            </span>
          </div>
        </header>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-[#ffcf66] sm:text-5xl">
              My Songs
            </h1>
            <p className="mt-2 text-sm font-medium text-[#ffe8c2]/65">
              Your recent karaoke sessions
            </p>
          </div>
          {history.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="rounded-full border border-red-500/35 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-400 transition hover:border-red-500 hover:bg-red-500/10 active:scale-[0.97]"
            >
              Clear History
            </button>
          )}
        </div>

        {/* Featured (built-in) songs — always available, no upload needed */}
        <section>
          <h2 className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-[#ffcf66]/80">
            Featured — ready to sing
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DEMO_SONGS.map((song) => (
              <Link
                key={song.trackId}
                href={`/karaoke/${song.trackId}?instrumentalUrl=${encodeURIComponent(song.instrumentalUrl)}`}
                className="group overflow-hidden rounded-[1.5rem] border border-[#ffcf66]/20 bg-[#1a0b10]/80 transition hover:border-[#ffcf66]/40 hover:bg-[#1a0b10]"
              >
                <div className="aspect-square overflow-hidden bg-[#ffcf66]/5">
                  <GeneratedCover
                    title={song.title}
                    artist={song.artist}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <h3 className="truncate font-bold text-[#fff8eb] group-hover:text-[#ffcf66]">
                    {song.title}
                  </h3>
                  <p className="mt-1 truncate text-sm text-[#ffe8c2]/60">
                    {song.artist}
                  </p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-wider text-[#ffcf66]/40">
                    Featured
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {isLoading ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#ffcf66]/20 border-t-[#ffb84d]" />
            <p className="text-sm font-bold text-[#ffe8c2]/50">Loading…</p>
          </div>
        ) : history.length === 0 ? (
          <section className="rounded-[2rem] border border-[#ffcf66]/12 bg-[#1a0b10]/80 p-10 text-center">
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
            <h2 className="text-xl font-black text-[#ffcf66]">
              No songs yet
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#ffe8c2]/60">
              Search for a song and start your first karaoke session. Your
              history will appear here.
            </p>
            <Link
              href="/search"
              className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-[#ffb84d] px-7 text-sm font-bold uppercase tracking-wide text-[#1a0b10] shadow-[0_14px_40px_rgba(255,184,77,0.28)] transition hover:bg-[#ffd166]"
            >
              Search a song
            </Link>
          </section>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {history.map((song) => (
              <Link
                key={song.id}
                href={`/karaoke/${song.trackId}?instrumentalUrl=${encodeURIComponent(song.instrumentalUrl)}`}
                className="group overflow-hidden rounded-[1.5rem] border border-[#ffcf66]/12 bg-[#1a0b10]/80 transition hover:border-[#ffcf66]/30 hover:bg-[#1a0b10]"
              >
                <div className="aspect-square overflow-hidden bg-[#ffcf66]/5">
                  {song.coverArtUrl ? (
                    <Image
                      alt={`${song.title} cover`}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                      height={400}
                      src={song.coverArtUrl}
                      width={400}
                    />
                  ) : (
                    <GeneratedCover
                      title={song.title}
                      artist={song.artist}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="truncate font-bold text-[#fff8eb] group-hover:text-[#ffcf66]">
                    {song.title}
                  </h3>
                  <p className="mt-1 truncate text-sm text-[#ffe8c2]/60">
                    {song.artist}
                  </p>
                  <p className="mt-2 text-xs text-[#ffe8c2]/35">
                    {new Date(song.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
