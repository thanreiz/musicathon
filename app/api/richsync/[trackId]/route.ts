import { getRichsync } from "@/lib/api/musixmatch";
import { readAlignedLyrics } from "@/lib/audio/aligned-store";

type RichsyncRouteContext = {
  params: Promise<{
    trackId: string;
  }>;
};

export async function GET(_request: Request, context: RichsyncRouteContext) {
  const { trackId } = await context.params;

  if (!trackId) {
    return Response.json(
      { available: false, reason: "Track ID is required." },
      { status: 400 },
    );
  }

  try {
    const richsync = await getRichsync(trackId);

    // Priority: studio-grade richsync > WhisperX forced alignment > LRC spread.
    // Only look for an aligned result when there's no studio richsync, and
    // never degrade the richsync path.
    if (!(richsync.available && richsync.syncSource === "richsync")) {
      const aligned = await readAlignedLyrics(trackId);
      if (aligned) {
        return Response.json(
          { available: true, lines: aligned, syncSource: "auto" },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
    }

    return Response.json(richsync, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      {
        available: false,
        reason: "We could not load lyrics for this song right now. Please try again.",
      },
      { status: 502 },
    );
  }
}
