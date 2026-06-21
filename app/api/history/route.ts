import { type NextRequest } from "next/server";
import { getSongHistory, saveSongToHistory } from "@/lib/api/history";

export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("deviceId");

  if (!deviceId) {
    return Response.json({ history: [] });
  }

  try {
    const history = await getSongHistory(deviceId);
    return Response.json({ history });
  } catch {
    // If DATABASE_URL is missing or DB is unreachable, return empty
    return Response.json({ history: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      deviceId?: string;
      trackId?: string;
      title?: string;
      artist?: string;
      coverArtUrl?: string | null;
      instrumentalUrl?: string;
    };

    if (
      !body.deviceId ||
      !body.trackId ||
      !body.title ||
      !body.artist ||
      !body.instrumentalUrl
    ) {
      return Response.json(
        { error: "Missing required fields." },
        { status: 400 },
      );
    }

    await saveSongToHistory({
      deviceId: body.deviceId,
      trackId: body.trackId,
      title: body.title,
      artist: body.artist,
      coverArtUrl: body.coverArtUrl ?? null,
      instrumentalUrl: body.instrumentalUrl,
    });

    return Response.json({ success: true });
  } catch {
    // Fail silently — don't break the user flow for history saving
    return Response.json({ success: true });
  }
}
