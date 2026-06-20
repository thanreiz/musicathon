import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getTrackDetails,
  MusixmatchApiError,
  searchTracks,
} from "./musixmatch";

const originalApiKey = process.env.MUSIXMATCH_API_KEY;

function mockMusixmatchResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
      status: 200,
    }),
  );
}

describe("Musixmatch API client", () => {
  beforeEach(() => {
    process.env.MUSIXMATCH_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        mockMusixmatchResponse({
          message: {
            header: { status_code: 200 },
            body: {
              track_list: [
                {
                  track: {
                    commontrack_id: 5920049,
                    track_id: 84584600,
                    track_name: "Alejandro",
                    artist_name: "Lady Gaga",
                    album_name: "The Fame Monster",
                    album_coverart_800x800: "http://s.mxmcdn.net/800.jpg",
                    album_coverart_500x500: "http://s.mxmcdn.net/500.jpg",
                    album_coverart_350x350: "",
                    album_coverart_100x100: "http://s.mxmcdn.net/100.jpg",
                  },
                },
              ],
            },
          },
        }),
      ),
    );
  });

  afterEach(() => {
    process.env.MUSIXMATCH_API_KEY = originalApiKey;
    vi.unstubAllGlobals();
  });

  it("searchTracks calls track.search with q_track_artist and normalizes results", async () => {
    const results = await searchTracks("alejandro");

    expect(fetch).toHaveBeenCalledOnce();
    const requestUrl = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
    expect(requestUrl.pathname).toBe("/ws/1.1/track.search");
    expect(requestUrl.searchParams.get("q_track_artist")).toBe("alejandro");
    expect(requestUrl.searchParams.get("s_track_rating")).toBe("desc");
    expect(requestUrl.searchParams.get("apikey")).toBe("test-key");
    expect(results).toEqual([
      {
        albumName: "The Fame Monster",
        artist: "Lady Gaga",
        coverArtUrl: "https://s.mxmcdn.net/800.jpg",
        title: "Alejandro",
        trackId: "5920049",
      },
    ]);
  });

  it("getTrackDetails calls track.get with commontrack_id and normalizes metadata", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      await mockMusixmatchResponse({
        message: {
          header: { status_code: 200 },
          body: {
            track: {
              commontrack_id: 5920049,
              track_id: 84584600,
              track_name: "Alejandro",
              artist_name: "Lady Gaga",
              album_name: "The Fame Monster",
              album_coverart_500x500: "http://s.mxmcdn.net/500.jpg",
              album_coverart_100x100: "http://s.mxmcdn.net/100.jpg",
            },
          },
        },
      }),
    );

    const details = await getTrackDetails("5920049");

    const requestUrl = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
    expect(requestUrl.pathname).toBe("/ws/1.1/track.get");
    expect(requestUrl.searchParams.get("commontrack_id")).toBe("5920049");
    expect(details).toEqual({
      albumName: "The Fame Monster",
      artist: "Lady Gaga",
      coverArtUrl: "https://s.mxmcdn.net/500.jpg",
      title: "Alejandro",
      trackId: "5920049",
    });
  });

  it("throws a typed not-found error for Musixmatch 404 responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      await mockMusixmatchResponse({
        message: {
          header: { status_code: 404 },
          body: [],
        },
      }),
    );

    await expect(getTrackDetails("missing")).rejects.toMatchObject({
      name: "MusixmatchApiError",
      statusCode: 404,
    } satisfies Partial<MusixmatchApiError>);
  });

  it("throws before fetch when MUSIXMATCH_API_KEY is missing", async () => {
    delete process.env.MUSIXMATCH_API_KEY;

    await expect(searchTracks("alejandro")).rejects.toMatchObject({
      name: "MusixmatchApiError",
      statusCode: 500,
    } satisfies Partial<MusixmatchApiError>);
    expect(fetch).not.toHaveBeenCalled();
  });
});
