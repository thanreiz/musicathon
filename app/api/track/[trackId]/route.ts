import { getTrackDetails } from "@/lib/api/musixmatch";

type TrackRouteContext = {
  params: Promise<{
    trackId: string;
  }>;
};

export async function GET(_request: Request, context: TrackRouteContext) {
  const { trackId } = await context.params;

  if (!trackId) {
    return Response.json({ error: "Track not found." }, { status: 404 });
  }

  try {
    const track = await getTrackDetails(trackId);

    return Response.json(
      { track },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 404) {
      return Response.json({ error: "Track not found." }, { status: 404 });
    }

    return Response.json(
      { error: "We could not load this song right now. Please try again." },
      { status: 502 },
    );
  }
}

function getStatusCode(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
    ? error.statusCode
    : 500;
}
