import { searchTracks } from "@/lib/api/musixmatch";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return Response.json(
      { error: "Search query is required.", results: [] },
      { status: 400 },
    );
  }

  try {
    const results = await searchTracks(query);

    return Response.json(
      { results },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return Response.json(
      {
        error: "We could not search songs right now. Please try again.",
        results: [],
      },
      { status: 502 },
    );
  }
}
