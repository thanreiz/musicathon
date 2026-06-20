import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/api/musixmatch", () => ({
  MusixmatchApiError: class MusixmatchApiError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
      super(message);
      this.name = "MusixmatchApiError";
      this.statusCode = statusCode;
    }
  },
  searchTracks: vi.fn(async () => [
    {
      albumName: "The Fame Monster",
      artist: "Lady Gaga",
      coverArtUrl: "https://s.mxmcdn.net/500.jpg",
      title: "Alejandro",
      trackId: "5920049",
    },
  ]),
}));

describe("GET /api/search", () => {
  it("returns 400 for empty queries", async () => {
    const response = await GET(new Request("http://myusika.test/api/search"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Search query is required.",
      results: [],
    });
  });

  it("returns normalized search results", async () => {
    const response = await GET(
      new Request("http://myusika.test/api/search?q=alejandro"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      results: [
        {
          albumName: "The Fame Monster",
          artist: "Lady Gaga",
          coverArtUrl: "https://s.mxmcdn.net/500.jpg",
          title: "Alejandro",
          trackId: "5920049",
        },
      ],
    });
  });
});
