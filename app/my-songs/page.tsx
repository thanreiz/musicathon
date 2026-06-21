"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { SongHistoryRecord } from "@/lib/types";

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
  const [history, setHistory] = useState<SongHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const deviceId = getDeviceId();
        const res = await fetch(`/api/history?deviceId=${encodeURIComponent(deviceId)}`);
        const data = (await res.json()) as { history?: SongHistoryRecord[] };
        setHistory(data.history ?? []);
      } catch {
        setHistory([]);
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <main className="min-h-screen bg-[#120913] px-5 py-8 text-[#fff8eb] sm:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="rounded-full border border-[#ffcf66]/25 px-4 py-2 text-sm font-bold text-[#ffefcf] transition hover:border-[#ffcf66] hover:bg-[#ffcf66]/10"
          >
            Home
          </Link>
          <span className="text-xs font-bold uppercase tracking-[0.22em] text-[#ffe8c2]/55">
            My Songs
          </span>
        </header>

        <div>
          <h1 className="text-4xl font-black text-[#ffcf66] sm:text-5xl">
            My Songs
          </h1>
          <p className="mt-2 text-sm font-medium text-[#ffe8c2]/65">
            Your recent karaoke sessions
          </p>
        </div>

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
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#ffb84d]/20 to-[#120913]">
                      <svg
                        className="h-16 w-16 text-[#ffcf66]/30"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                        />
                      </svg>
                    </div>
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
