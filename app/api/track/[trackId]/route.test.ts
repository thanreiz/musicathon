import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/api/musixmatch", () => ({
  getTrackDetails: vi.fn(async (trackId: string) => {
    if (trackId === "missing") {
      const error = new Error("Track not found.") as Error & {
        statusCode: number;
      };
      error.name = "MusixmatchApiError";
      error.statusCode = 404;
      throw error;
    }

    return {
      albumName: "The Fame Monster",
      artist: "Lady Gaga",
      coverArtUrl: "https://s.mxmcdn.net/500.jpg",
      title: "Alejandro",
      trackId,
    };
  }),
}));

describe("GET /api/track/[trackId]", () => {
  it("returns track metadata", async () => {
    const response = await GET(
      new Request("http://myusika.test/api/track/5920049"),
      {
        params: Promise.resolve({ trackId: "5920049" }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      track: {
        albumName: "The Fame Monster",
        artist: "Lady Gaga",
        coverArtUrl: "https://s.mxmcdn.net/500.jpg",
        title: "Alejandro",
        trackId: "5920049",
      },
    });
  });

  it("returns 404 when the track is not found", async () => {
    const response = await GET(
      new Request("http://myusika.test/api/track/missing"),
      {
        params: Promise.resolve({ trackId: "missing" }),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Track not found.",
    });
  });
});
