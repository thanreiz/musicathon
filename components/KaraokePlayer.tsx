"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { RichsyncLine } from "@/lib/types";

type KaraokePlayerProps = {
  audioUrl: string;
  richsyncData: RichsyncLine[];
  trackTitle: string;
  trackArtist: string;
};

export default function KaraokePlayer({
  audioUrl,
  richsyncData,
  trackTitle,
  trackArtist,
}: KaraokePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLInputElement>(null);
  const currentTimeTextRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [activeLine, setActiveLine] = useState(-1);
  const [activeWord, setActiveWord] = useState(-1);
  const [semitoneShift, setSemitoneShift] = useState(0);
  const [playbackStatus, setPlaybackStatus] = useState<"before" | "during" | "after">("before");

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
          // Check if there's a next line coming soon (within 2s gap)
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

    // Update DOM directly for smooth progress/time display (avoiding 60fps React state updates)
    if (progressBarRef.current) {
      progressBarRef.current.value = String(timeSec);
    }
    if (currentTimeTextRef.current) {
      currentTimeTextRef.current.textContent = formatTime(timeSec);
    }

    // Apply sync offset
    const adjustedTimeMs = timeMs + syncOffsetMs;

    const lineIdx = findCurrentLine(adjustedTimeMs);
    const wordIdx = findCurrentWord(lineIdx, adjustedTimeMs);

    setActiveLine((prev) => (prev !== lineIdx ? lineIdx : prev));
    setActiveWord((prev) => (prev !== wordIdx ? wordIdx : prev));

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
  }, [findCurrentLine, findCurrentWord, richsyncData, syncOffsetMs, formatTime]);

  // ── Start/stop animation loop when playing ─────────────────────────
  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(animationRef.current);
    }
    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying, tick]);

  // ── Auto-scroll to active line ─────────────────────────────────────
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeLine]);

  // ── Web Audio API for pitch shifting ───────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Initialize AudioContext on first interaction (lazy)
    if (!audioContextRef.current) {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(audio);
      source.connect(ctx.destination);
      audioContextRef.current = ctx;
      sourceNodeRef.current = source;
    }

    // preservesPitch = false means playbackRate changes both pitch AND tempo
    audio.preservesPitch = false;
    audio.playbackRate = Math.pow(2, semitoneShift / 12);
  }, [semitoneShift]);

  // ── Play/Pause ─────────────────────────────────────────────────────
  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    // Resume AudioContext if suspended (browser autoplay policy)
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

    if (progressBarRef.current) {
      progressBarRef.current.value = "0";
    }
    if (currentTimeTextRef.current) {
      currentTimeTextRef.current.textContent = "0:00";
    }

    setActiveLine(-1);
    setActiveWord(-1);
    setPlaybackStatus("before");
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = Number(e.target.value);
    audio.currentTime = newTime;

    if (currentTimeTextRef.current) {
      currentTimeTextRef.current.textContent = formatTime(newTime);
    }
  }, [formatTime]);

  return (
    <div className="flex flex-col gap-5">
      {/* Track info */}
      <div className="text-center">
        <h2 className="text-lg font-black uppercase tracking-[0.2em] text-[#ffcf66]">
          {trackTitle}
        </h2>
        <p className="mt-1 text-sm font-semibold text-[#ffe8c2]/70">
          {trackArtist}
        </p>
      </div>

      {/* Lyrics area */}
      <div
        ref={lyricsContainerRef}
        className="relative mx-auto w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-[#ffcf66]/12 bg-[#0c060d]/80 p-6 sm:p-8"
        style={{ maxHeight: "55vh" }}
      >
        {/* Pre-first-lyric indicator */}
        {isPlaying && playbackStatus === "before" && (
          <div className="mb-6 text-center">
            <span className="animate-pulse text-lg font-bold text-[#ffb84d]">
              Get ready…
            </span>
          </div>
        )}

        {/* Post-last-lyric indicator */}
        {playbackStatus === "after" && (
          <div className="mb-6 text-center">
            <span className="text-lg font-bold text-emerald-400">
              🎉 Great job!
            </span>
          </div>
        )}

        {/* Lyrics lines */}
        <div className="space-y-4">
          {richsyncData.map((line, lineIdx) => {
            const isActive = lineIdx === activeLine;
            const isPast = lineIdx < activeLine;

            return (
              <div
                key={lineIdx}
                ref={isActive ? activeLineRef : undefined}
                className={`transition-all duration-300 ${
                  isActive
                    ? "scale-[1.02]"
                    : isPast
                      ? "opacity-40"
                      : playbackStatus === "before"
                        ? "opacity-30"
                        : "opacity-50"
                }`}
              >
                <p className="text-2xl font-bold leading-relaxed sm:text-3xl">
                  {line.words.map((word, wordIdx) => {
                    let color: string;

                    if (!isActive) {
                      color = isPast ? "text-[#ffe8c2]/60" : "text-[#fff8eb]/80";
                    } else if (wordIdx < activeWord) {
                      color = "text-[#ffe8c2]/70";
                    } else if (wordIdx === activeWord) {
                      color = "text-[#ffcf66] drop-shadow-[0_0_12px_rgba(255,207,102,0.5)]";
                    } else {
                      color = "text-[#fff8eb]/80";
                    }

                    return (
                      <span
                        key={wordIdx}
                        className={`inline transition-colors duration-75 ${color}`}
                      >
                        {word.text}
                      </span>
                    );
                  })}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls bar */}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-[2rem] border border-[#ffcf66]/12 bg-[#0c060d]/80 p-4 sm:p-5">
        {/* Seek bar */}
        <div className="flex items-center gap-3">
          <span
            ref={currentTimeTextRef}
            className="min-w-[3rem] text-right text-xs font-bold text-[#ffe8c2]/60"
          >
            0:00
          </span>
          <input
            ref={progressBarRef}
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            defaultValue={0}
            onChange={handleSeek}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[#ffcf66]/15 accent-[#ffb84d] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#ffb84d]"
          />
          <span className="min-w-[3rem] text-xs font-bold text-[#ffe8c2]/60">
            {formatTime(duration)}
          </span>
        </div>

        {/* Buttons row */}
        <div className="flex items-center justify-center gap-4 flex-wrap sm:flex-nowrap">
          {/* Restart */}
          <button
            type="button"
            onClick={restart}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#ffcf66]/25 text-[#ffefcf] transition hover:border-[#ffcf66] hover:bg-[#ffcf66]/10"
            title="Restart"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            type="button"
            onClick={togglePlayback}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ffb84d] text-[#1a0b10] shadow-[0_14px_40px_rgba(255,184,77,0.28)] transition hover:bg-[#ffd166]"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Pitch controls */}
          <div className="flex items-center gap-1.5 border-l border-[#ffcf66]/15 pl-4">
            <button
              type="button"
              onClick={() => setSemitoneShift((s) => Math.max(s - 1, -6))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#ffcf66]/25 text-xs font-bold text-[#ffefcf] transition hover:border-[#ffcf66] hover:bg-[#ffcf66]/10"
              title="Pitch down"
            >
              ▼
            </button>
            <button
              type="button"
              onClick={() => setSemitoneShift(0)}
              className={`flex h-8 min-w-[2.5rem] items-center justify-center rounded-full px-2 text-xs font-bold transition ${
                semitoneShift === 0
                  ? "bg-[#ffcf66]/10 text-[#ffcf66]"
                  : "border border-[#ffcf66]/25 text-[#ffefcf] hover:border-[#ffcf66] hover:bg-[#ffcf66]/10"
              }`}
              title="Reset pitch"
            >
              {semitoneShift > 0 ? `+${semitoneShift}` : semitoneShift === 0 ? "0" : String(semitoneShift)}
            </button>
            <button
              type="button"
              onClick={() => setSemitoneShift((s) => Math.min(s + 1, 6))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#ffcf66]/25 text-xs font-bold text-[#ffefcf] transition hover:border-[#ffcf66] hover:bg-[#ffcf66]/10"
              title="Pitch up"
            >
              ▲
            </button>
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-[#ffe8c2]/40">
              Key
            </span>
          </div>

          {/* Sync offset controls */}
          <div className="flex items-center gap-1.5 border-l border-[#ffcf66]/15 pl-4">
            <button
              type="button"
              onClick={() => {
                const newOffset = Math.max(syncOffsetMs - 100, -2000);
                setSyncOffsetMs(newOffset);
                localStorage.setItem("karaoke_sync_offset", String(newOffset));
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#ffcf66]/25 text-xs font-bold text-[#ffefcf] transition hover:border-[#ffcf66] hover:bg-[#ffcf66]/10"
              title="Lyrics later (delay highlight)"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => {
                setSyncOffsetMs(0);
                localStorage.setItem("karaoke_sync_offset", "0");
              }}
              className={`flex h-8 min-w-[3.5rem] items-center justify-center rounded-full px-2 text-xs font-bold transition ${
                syncOffsetMs === 0
                  ? "bg-[#ffcf66]/10 text-[#ffcf66]"
                  : "border border-[#ffcf66]/25 text-[#ffefcf] hover:border-[#ffcf66] hover:bg-[#ffcf66]/10"
              }`}
              title="Reset lyrics sync"
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
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#ffcf66]/25 text-xs font-bold text-[#ffefcf] transition hover:border-[#ffcf66] hover:bg-[#ffcf66]/10"
              title="Lyrics earlier (advance highlight)"
            >
              +
            </button>
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-[#ffe8c2]/40">
              Sync
            </span>
          </div>
        </div>
      </div>

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
