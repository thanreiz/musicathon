/**
 * GeneratedCover — deterministic gradient album art placeholder.
 *
 * Generates a unique, polished cover image from the track title + artist name
 * so that tracks missing real cover art still look intentional and visually
 * distinct. Pure CSS — no external assets or runtime randomness.
 */

/* ------------------------------------------------------------------ */
/*  Deterministic hash                                                */
/* ------------------------------------------------------------------ */

/** Simple 32-bit integer hash (djb2-style) that is stable across runs. */
function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function GeneratedCover({
  title,
  artist,
  size,
  className = "",
}: {
  title: string;
  artist: string;
  size?: number;
  className?: string;
}) {
  const seed = hashString(title + artist);

  // Derive three hues spread across the colour wheel so they always feel
  // varied but harmonious (≈80–160° apart).
  const hue1 = seed % 360;
  const hue2 = (hue1 + 80 + (seed % 80)) % 360;
  const hue3 = (hue2 + 80 + ((seed >> 4) % 80)) % 360;

  // Saturation 45-65%, lightness 35-55% — vibrant but not neon.
  const sat = (seed1: number) => 45 + (seed1 % 21); // 45-65
  const lit = (seed1: number) => 35 + (seed1 % 21); // 35-55

  const c1 = `hsl(${hue1}, ${sat(seed)}%, ${lit(seed)}%)`;
  const c2 = `hsl(${hue2}, ${sat(seed >> 3)}%, ${lit(seed >> 5)}%)`;
  const c3 = `hsl(${hue3}, ${sat(seed >> 7)}%, ${lit(seed >> 9)}%)`;

  // Gradient angle derived from the hash — full 0-360°.
  const angle = ((seed >> 2) % 360);

  const gradient = `linear-gradient(${angle}deg, ${c1} 0%, ${c2} 55%, ${c3} 100%)`;

  const initial = title.slice(0, 1).toUpperCase();

  const sizeStyle =
    size !== undefined ? { width: size, height: size } : undefined;

  return (
    <div
      className={`relative grid place-items-center overflow-hidden rounded-2xl ${className}`}
      style={{
        background: gradient,
        ...sizeStyle,
      }}
    >
      {/* ---- noise / texture overlay ---- */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "4px 4px",
          mixBlendMode: "overlay",
        }}
      />

      {/* ---- soft vignette for depth ---- */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.12) 0%, transparent 60%)",
        }}
      />

      {/* ---- letter ---- */}
      <span
        className="relative z-10 select-none font-black text-white"
        style={{
          fontSize: size ? size * 0.42 : "2.6rem",
          lineHeight: 1,
          textShadow: "0 2px 12px rgba(0,0,0,0.35), 0 0 40px rgba(0,0,0,0.18)",
        }}
      >
        {initial}
      </span>
    </div>
  );
}
