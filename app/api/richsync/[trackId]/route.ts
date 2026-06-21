import { getRichsync } from "@/lib/api/musixmatch";

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
