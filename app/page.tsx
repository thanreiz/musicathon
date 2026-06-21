import Link from "next/link";

export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center overflow-hidden bg-bg px-6 py-16 text-foreground sm:px-10 lg:px-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,184,77,0.28),_transparent_32%),radial-gradient(circle_at_80%_18%,_rgba(255,43,118,0.22),_transparent_30%),linear-gradient(135deg,_rgba(255,255,255,0.06),_transparent_42%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-amber/15 to-transparent" />

      <section className="relative mx-auto flex w-full max-w-6xl flex-col gap-10">
        <div className="max-w-3xl">
          <h1 className="font-display text-6xl leading-none text-gold drop-shadow-[0_0_28px_rgba(255,184,77,0.38)] sm:text-7xl lg:text-8xl">
            Myusika
          </h1>
          <p className="mt-6 max-w-2xl text-xl font-medium leading-8 text-cream sm:text-2xl">
            Search a song. Sing it. Play it.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Link
            href="/search"
            className="inline-flex h-12 items-center justify-center rounded-full bg-amber px-7 text-sm font-bold uppercase tracking-wide text-surface shadow-[0_14px_40px_rgba(255,184,77,0.28)] transition hover:bg-gold-hover focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-bg"
          >
            Search a song
          </Link>
          <Link
            href="/my-songs"
            className="inline-flex h-12 items-center justify-center rounded-full border border-gold/35 px-7 text-sm font-bold uppercase tracking-wide text-cream-light transition hover:border-gold hover:bg-gold/10 focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-bg"
          >
            My Songs
          </Link>
        </div>
      </section>
    </main>
  );
}
