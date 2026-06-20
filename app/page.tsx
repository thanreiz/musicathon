import Link from "next/link";

export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center overflow-hidden bg-[#120913] px-6 py-16 text-[#fff8eb] sm:px-10 lg:px-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,184,77,0.28),_transparent_32%),radial-gradient(circle_at_80%_18%,_rgba(255,43,118,0.22),_transparent_30%),linear-gradient(135deg,_rgba(255,255,255,0.06),_transparent_42%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#ffb84d]/15 to-transparent" />

      <section className="relative mx-auto flex w-full max-w-6xl flex-col gap-10">
        <div className="max-w-3xl">
          <h1 className="text-6xl font-black leading-none text-[#ffcf66] drop-shadow-[0_0_28px_rgba(255,184,77,0.38)] sm:text-7xl lg:text-8xl">
            Myusika
          </h1>
          <p className="mt-6 max-w-2xl text-xl font-medium leading-8 text-[#ffe8c2] sm:text-2xl">
            Search a song. Sing it. Play it.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Link
            href="/search"
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#ffb84d] px-7 text-sm font-bold uppercase tracking-wide text-[#1a0b10] shadow-[0_14px_40px_rgba(255,184,77,0.28)] transition hover:bg-[#ffd166] focus:outline-none focus:ring-2 focus:ring-[#ffcf66] focus:ring-offset-2 focus:ring-offset-[#120913]"
          >
            Search a song
          </Link>
          <a
            href="#"
            className="inline-flex h-12 items-center justify-center rounded-full border border-[#ffcf66]/35 px-7 text-sm font-bold uppercase tracking-wide text-[#ffefcf] transition hover:border-[#ffcf66] hover:bg-[#ffcf66]/10 focus:outline-none focus:ring-2 focus:ring-[#ffcf66] focus:ring-offset-2 focus:ring-offset-[#120913]"
          >
            My Songs
          </a>
        </div>
      </section>
    </main>
  );
}
