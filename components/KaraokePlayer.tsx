"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { RichsyncLine } from "@/lib/types";

type KaraokePlayerProps = {
  audioUrl: string;
  richsyncData: RichsyncLine[];
  trackTitle: string;
  trackArtist: string;
};

const BACKGROUND_VIDEOS = [
  "/videos/video1.mp4",
  "/videos/video2.mp4",
  "/videos/video3.mp4",
];

const VIDEO_NAMES = [
  "City Skyline Sunset",
  "Highway & Traffic Motion",
  "Shopping Mall Bustle",
];

export default function KaraokePlayer({
  audioUrl,
  richsyncData,
  trackTitle,
  trackArtist,
}: KaraokePlayerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDev = searchParams.get("dev") === "true";

  const audioRef = useRef<HTMLAudioElement>(null);
  const progressIndicatorRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [activeLine, setActiveLine] = useState(-1);
  const [activeWord, setActiveWord] = useState(-1);
  const [semitoneShift, setSemitoneShift] = useState(0);
  const [playbackStatus, setPlaybackStatus] = useState<"before" | "during" | "after">("before");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Pick background video index based on a hash of track metadata by default
  const [videoIndex, setVideoIndex] = useState<number>(() => {
    let hash = 0;
    const str = trackTitle + trackArtist;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % BACKGROUND_VIDEOS.length;
  });

  // Sync offset in milliseconds: positive means lyrics appear earlier, negative means later
  const [syncOffsetMs, setSyncOffsetMs] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("karaoke_sync_offset");
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return 300; // Default 300ms advance offset for optimal singing alignment
  });

  // ── Format time ────────────────────────────────────────────────────
  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  // ── Binary search for current line ──────────────────────────────────
  const findCurrentLine = useCallback(
    (timeMs: number): number => {
      if (richsyncData.length === 0) return -1;

      let low = 0;
      let high = richsyncData.length - 1;
      let result = -1;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const lineStart = richsyncData[mid].words[0]?.startTimeMs ?? 0;

        if (lineStart <= timeMs) {
          result = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      // Check if we're past the end of the found line
      if (result >= 0) {
        const lastWord = richsyncData[result].words[richsyncData[result].words.length - 1];
        if (lastWord && timeMs > lastWord.endTimeMs) {
          // Check if there's a next line coming soon
          if (result + 1 < richsyncData.length) {
            const nextLineStart = richsyncData[result + 1].words[0]?.startTimeMs ?? 0;
            if (timeMs < nextLineStart) {
              return result; // Stay on current line in gaps
            }
          }
        }
      }

      return result;
    },
    [richsyncData],
  );

  // ── Find active word in the current line ───────────────────────────
  const findCurrentWord = useCallback(
    (lineIndex: number, timeMs: number): number => {
      if (lineIndex < 0 || lineIndex >= richsyncData.length) return -1;

      const words = richsyncData[lineIndex].words;
      for (let i = words.length - 1; i >= 0; i--) {
        if (timeMs >= words[i].startTimeMs) {
          return i;
        }
      }
      return -1;
    },
    [richsyncData],
  );

  // ── Animation loop ─────────────────────────────────────────────────
  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const timeSec = audio.currentTime;
    const timeMs = timeSec * 1000;

    // Update non-interactive progress bar directly in the DOM
    if (progressIndicatorRef.current && duration > 0) {
      const pct = (timeSec / duration) * 100;
      progressIndicatorRef.current.style.width = `${pct}%`;
    }

    // Apply sync offset
    const adjustedTimeMs = timeMs + syncOffsetMs;

    const lineIdx = findCurrentLine(adjustedTimeMs);
    const wordIdx = findCurrentWord(lineIdx, adjustedTimeMs);

    // Update states only when they change to eliminate React rendering lag
    setActiveLine((prev) => (prev !== lineIdx ? lineIdx : prev));
    setActiveWord((prev) => (prev !== wordIdx ? wordIdx : prev));

    // Handle smooth visual sweep/fill progress for the active word directly in DOM
    const activeWordEl = document.getElementById("active-word-el");
    if (activeWordEl && lineIdx >= 0 && wordIdx >= 0) {
      const activeWordData = richsyncData[lineIdx]?.words[wordIdx];
      if (activeWordData) {
        const wordStart = activeWordData.startTimeMs;
        const wordEnd = activeWordData.endTimeMs;
        const wordDuration = wordEnd - wordStart;
        if (wordDuration > 0) {
          const progress = Math.max(0, Math.min(1, (adjustedTimeMs - wordStart) / wordDuration));
          activeWordEl.style.setProperty("--progress", `${progress * 100}%`);
        } else {
          activeWordEl.style.setProperty("--progress", "100%");
        }
      }
    }

    // Update playback status
    const firstLineStart = richsyncData[0]?.words[0]?.startTimeMs ?? 0;
    const lastLine = richsyncData[richsyncData.length - 1];
    const lastLineEnd = lastLine?.words[lastLine.words.length - 1]?.endTimeMs ?? 0;

    const status =
      adjustedTimeMs < firstLineStart
        ? "before"
        : lastLineEnd > 0 && adjustedTimeMs > lastLineEnd
          ? "after"
          : "during";

    setPlaybackStatus((prev) => (prev !== status ? status : prev));

    animationRef.current = requestAnimationFrame(tick);
  }, [findCurrentLine, findCurrentWord, richsyncData, syncOffsetMs, duration]);

  // ── Start/stop animation loop when playing ─────────────────────────
  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(animationRef.current);
    }
    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying, tick]);

  // ── Web Audio API for pitch shifting ───────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audioContextRef.current) {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(audio);
      source.connect(ctx.destination);
      audioContextRef.current = ctx;
      sourceNodeRef.current = source;
    }

    audio.preservesPitch = false;
    audio.playbackRate = Math.pow(2, semitoneShift / 12);
  }, [semitoneShift]);

  // ── Play/Pause ─────────────────────────────────────────────────────
  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audioContextRef.current?.state === "suspended") {
      await audioContextRef.current.resume();
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      await audio.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const restart = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;

    if (progressIndicatorRef.current) {
      progressIndicatorRef.current.style.width = "0%";
    }

    setActiveLine(-1);
    setActiveWord(-1);
    setPlaybackStatus("before");
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden font-sans text-white select-none">
      {/* CSS Stylesheet Injector for smooth text gradient clipping */}
      <style>{`
        .karaoke-word {
          display: inline-block;
          font-weight: 900;
          color: rgba(255, 255, 255, 0.4);
          -webkit-text-fill-color: rgba(255, 255, 255, 0.4);
          transition: -webkit-text-fill-color 0.15s ease, color 0.15s ease;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9);
        }
        .karaoke-word-sung {
          color: #ffcf66;
          -webkit-text-fill-color: #ffcf66;
          text-shadow: 0 0 16px rgba(255, 207, 102, 0.9), 0 2px 4px rgba(0, 0, 0, 0.9);
        }
        .karaoke-word-active {
          background-image: linear-gradient(to right, #ffcf66 var(--progress, 0%), rgba(255, 255, 255, 0.4) var(--progress, 0%));
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 10px rgba(255, 207, 102, 0.8));
          text-shadow: none;
        }
      `}</style>

      {/* ── Background Video Backdrop ─────────────────────────────────── */}
      <div className="absolute inset-0 -z-20 h-full w-full overflow-hidden bg-[#0c060d]">
        <video
          key={BACKGROUND_VIDEOS[videoIndex]}
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover scale-[1.02]"
        >
          <source src={BACKGROUND_VIDEOS[videoIndex]} type="video/mp4" />
        </video>
      </div>

      {/* ── Dark Gradient Legibility Overlay ───────────────────────────── */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-gradient-to-b from-black/50 via-black/30 to-black/85" />

      {/* ── Top-Right Hamburger Button ──────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsDrawerOpen(true)}
        className="absolute top-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-black/40 border border-white/10 text-white backdrop-blur-md transition hover:bg-black/60 hover:border-[#ffcf66]/50 shadow-lg"
        title="Open Settings Menu"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* ── Main Viewport Content (Bottom-Third Anchored Lyrics) ─────────── */}
      <div className="relative flex h-full w-full flex-col justify-end p-8 sm:p-12 pb-16">
        <div className="mx-auto mb-12 flex w-full max-w-5xl flex-col items-center justify-end pb-8">
          
          {/* State 1: Before Song Starts */}
          {playbackStatus === "before" && (
            <div className="mb-10 text-center animate-fade-in">
              <span className="text-xs font-black uppercase tracking-[0.3em] text-[#ffcf66] drop-shadow-md">
                Get Ready to Sing
              </span>
              <h1 className="mt-3 text-4xl font-black uppercase tracking-wider text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)] sm:text-5xl lg:text-6xl">
                {trackTitle}
              </h1>
              <p className="mt-2 text-lg font-bold text-[#ffe8c2]/80 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {trackArtist}
              </p>
              {isPlaying && (
                <div className="mt-6 flex justify-center">
                  <span className="inline-block animate-pulse rounded-full bg-[#ffb84d]/20 px-6 py-2 text-sm font-bold uppercase tracking-wider text-[#ffcf66] border border-[#ffcf66]/30">
                    Intro Playing…
                  </span>
                </div>
              )}
            </div>
          )}

          {/* State 2: Great Job (Finished) */}
          {playbackStatus === "after" && (
            <div className="mb-10 text-center animate-bounce-slow">
              <span className="text-5xl sm:text-6xl lg:text-7xl font-black text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.6)]">
                🎉 GREAT JOB!
              </span>
              <p className="mt-3 text-lg font-bold text-[#ffe8c2]/80 drop-shadow-md">
                You just sang "{trackTitle}"
              </p>
              <button
                type="button"
                onClick={restart}
                className="mt-6 rounded-full bg-[#ffb84d] px-6 py-2.5 text-xs font-black uppercase tracking-wider text-[#1a0b10] shadow-lg transition hover:bg-[#ffd166]"
              >
                Sing Again
              </button>
            </div>
          )}

          {/* ── Active Lyrics Area ────────────────────────────────────────── */}
          {playbackStatus === "during" && activeLine >= 0 && (
            <div className="w-full text-center space-y-8">
              
              {/* CURRENT ACTIVE LINE (Large & Bold with Sweep-Fill) */}
              <div className="min-h-[4rem] sm:min-h-[5rem] lg:min-h-[6rem] flex items-center justify-center">
                <p className="text-3xl font-black leading-tight tracking-wide uppercase sm:text-4xl md:text-5xl lg:text-6xl">
                  {richsyncData[activeLine].words.map((word, wordIdx) => {
                    let wordClass = "karaoke-word";
                    let isWordActive = false;

                    if (wordIdx < activeWord) {
                      wordClass = "karaoke-word-sung";
                    } else if (wordIdx === activeWord) {
                      wordClass = "karaoke-word-active";
                      isWordActive = true;
                    }

                    return (
                      <span
                        key={wordIdx}
                        id={isWordActive ? "active-word-el" : undefined}
                        className={`${wordClass} mr-3 sm:mr-4`}
                      >
                        {word.text}
                      </span>
                    );
                  })}
                </p>
              </div>

              {/* NEXT PREVIEW LINE (Smaller, Dimmer, Italicized) */}
              <div className="min-h-[2rem] sm:min-h-[3rem] flex items-center justify-center opacity-60">
                {activeLine + 1 < richsyncData.length ? (
                  <p className="text-lg font-bold italic tracking-wide text-[#ffe8c2]/60 sm:text-xl md:text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                    {richsyncData[activeLine + 1].text}
                  </p>
                ) : (
                  <p className="text-sm font-bold tracking-widest text-[#ffcf66]/30 uppercase">
                    Instrumental Outro
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Fallback Preview when playbackStatus is "before" */}
          {playbackStatus === "before" && richsyncData.length > 0 && (
            <div className="mt-8 opacity-40 text-center">
              <p className="text-xs font-black uppercase tracking-widest text-[#ffcf66]/40 mb-2">
                Up Next
              </p>
              <p className="text-lg font-bold italic text-[#ffe8c2]/65 drop-shadow-md">
                {richsyncData[0].text}
              </p>
            </div>
          )}

        </div>
      </div>

      {/* ── Play/Pause Trigger (Bottom-Right Corner) ──────────────────── */}
      <button
        type="button"
        onClick={togglePlayback}
        className="absolute bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-black/40 border border-white/10 text-white backdrop-blur-md shadow-2xl transition hover:bg-black/60 hover:border-[#ffcf66]/50 active:scale-95"
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="h-6 w-6 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* ── Subtle elapsed progress bar (Non-Interactive) ───────────────── */}
      <div className="absolute bottom-0 left-0 h-1.5 w-full bg-white/10">
        <div
          ref={progressIndicatorRef}
          className="h-full bg-[#ffb84d] shadow-[0_0_8px_#ffb84d] transition-all duration-100"
          style={{ width: "0%" }}
        />
      </div>

      {/* ── Settings Drawer (Part 4) ──────────────────────────────────── */}
      {isDrawerOpen && (
        <>
          {/* Overlay Backdrop */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          />

          {/* Drawer Sidebar */}
          <div className="fixed top-0 right-0 z-50 h-full w-80 max-w-[85vw] bg-[#0c060d]/95 border-l border-[#ffcf66]/20 p-6 flex flex-col justify-between shadow-2xl overflow-y-auto">
            <div className="flex flex-col gap-6">
              
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h3 className="text-lg font-black uppercase tracking-wider text-[#ffcf66]">
                  Karaoke Deck
                </h3>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="text-white/60 hover:text-white transition"
                  title="Close Menu"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Controls: Pitch Transposition */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#ffe8c2]/50">
                  Transpose (Key Shift)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSemitoneShift((s) => Math.max(s - 1, -6))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white transition hover:bg-white/15"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={() => setSemitoneShift(0)}
                    className="flex-1 h-10 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-white transition hover:bg-white/15"
                  >
                    {semitoneShift > 0 ? `+${semitoneShift}` : semitoneShift === 0 ? "Normal" : semitoneShift}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSemitoneShift((s) => Math.min(s + 1, 6))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white transition hover:bg-white/15"
                  >
                    ▲
                  </button>
                </div>
              </div>

              {/* Controls: Lyric Sync Offset */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#ffe8c2]/50">
                  Lyric Timing Calibration
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const newOffset = Math.max(syncOffsetMs - 100, -2000);
                      setSyncOffsetMs(newOffset);
                      localStorage.setItem("karaoke_sync_offset", String(newOffset));
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white transition hover:bg-white/15"
                    title="Make lyrics appear later"
                  >
                    -0.1s
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSyncOffsetMs(0);
                      localStorage.setItem("karaoke_sync_offset", "0");
                    }}
                    className="flex-1 h-10 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-white transition hover:bg-white/15"
                  >
                    {syncOffsetMs >= 0 ? `+${(syncOffsetMs / 1000).toFixed(1)}s` : `${(syncOffsetMs / 1000).toFixed(1)}s`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const newOffset = Math.min(syncOffsetMs + 100, 2000);
                      setSyncOffsetMs(newOffset);
                      localStorage.setItem("karaoke_sync_offset", String(newOffset));
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white transition hover:bg-white/15"
                    title="Make lyrics appear earlier"
                  >
                    +0.1s
                  </button>
                </div>
              </div>

              {/* Controls: Background Video */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#ffe8c2]/50">
                  Select Video Backdrop
                </span>
                <div className="flex flex-col gap-1.5">
                  {BACKGROUND_VIDEOS.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setVideoIndex(idx)}
                      className={`w-full h-10 rounded-xl border text-xs font-bold text-left px-4 transition ${
                        videoIndex === idx
                          ? "bg-[#ffcf66]/10 border-[#ffcf66] text-[#ffcf66]"
                          : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                      }`}
                    >
                      {VIDEO_NAMES[idx] || `Looping Backdrop ${idx + 1}`}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Navigation Options */}
            <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  router.push("/search");
                }}
                className="w-full h-11 rounded-xl bg-[#ffb84d] text-sm font-black uppercase tracking-wider text-[#1a0b10] flex items-center justify-center transition hover:bg-[#ffd166]"
              >
                Back to Search
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  router.push("/my-songs");
                }}
                className="w-full h-11 rounded-xl bg-white/5 border border-white/15 text-sm font-bold text-white flex items-center justify-center transition hover:bg-white/10"
              >
                My Songs library
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  router.push("/");
                }}
                className="w-full h-11 rounded-xl bg-white/5 border border-white/15 text-sm font-bold text-white flex items-center justify-center transition hover:bg-white/10"
              >
                Home page
              </button>
            </div>

          </div>
        </>
      )}

      {/* ── Dev-only Fast-Forward Panel (Part 7) ───────────────────────── */}
      {isDev && (
        <div className="fixed bottom-24 left-6 z-50 flex flex-col gap-2 rounded-2xl border-2 border-red-500 bg-black/90 p-4 shadow-2xl w-60">
          <div className="text-xs font-black uppercase tracking-wider text-red-500 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
            Dev Testing Console
          </div>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              type="button"
              onClick={() => {
                const audio = audioRef.current;
                if (audio) audio.currentTime += 30;
              }}
              className="rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2 transition"
            >
              +30 Seconds
            </button>
            <button
              type="button"
              onClick={() => {
                const audio = audioRef.current;
                const firstLineStart = richsyncData[0]?.words[0]?.startTimeMs ?? 0;
                if (audio) {
                  audio.currentTime = Math.max(0, (firstLineStart - 3000) / 1000);
                }
              }}
              className="rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2 transition"
            >
              Skip to Lyrics
            </button>
            <button
              type="button"
              onClick={() => {
                const audio = audioRef.current;
                const lastLine = richsyncData[richsyncData.length - 1];
                const lastLineEnd = lastLine?.words[lastLine.words.length - 1]?.endTimeMs ?? 0;
                if (audio) {
                  audio.currentTime = Math.max(0, (lastLineEnd - 5000) / 1000);
                }
              }}
              className="col-span-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2 transition"
            >
              Skip to End (Last 5s)
            </button>
          </div>
        </div>
      )}

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        crossOrigin="anonymous"
        preload="auto"
        onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />
    </div>
  );
}
