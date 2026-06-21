import { type NextRequest } from "next/server";
import { getSongHistory, saveSongToHistory, clearSongHistory } from "@/lib/api/history";

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
  } catch (err) {
    // Report the failure honestly instead of masking it as success. The
    // client treats this save as best-effort and won't block the user flow.
    console.error("[history] Failed to save song:", err);
    return Response.json(
      { success: false, error: "Failed to save song to history." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("deviceId");

  if (!deviceId) {
    return Response.json(
      { error: "Missing deviceId." },
      { status: 400 },
    );
  }

  try {
    await clearSongHistory(deviceId);
    return Response.json({ success: true });
  } catch (err) {
    console.error("[history] Failed to clear history:", err);
    return Response.json(
      { success: false, error: "Failed to clear history." },
      { status: 500 },
    );
  }
}
