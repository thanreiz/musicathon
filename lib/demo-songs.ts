export type DemoSong = {
  trackId: string;
  title: string;
  artist: string;
  instrumentalUrl: string;
};

/**
 * Built-in demo songs. Their instrumentals are committed under public/demo/ so
 * the app ships with playable karaoke out of the box — no upload/Demucs needed.
 * `trackId` is the Musixmatch commontrack_id used to load synced lyrics, so
 * these get the same richsync/auto timing pipeline as uploaded songs.
 */
export const DEMO_SONGS: DemoSong[] = [
  {
    trackId: "69182670",
    title: "Perfect",
    artist: "Ed Sheeran",
    instrumentalUrl: "/demo/perfect.mp3",
  },
  {
    trackId: "3042390",
    title: "Ang Huling El Bimbo",
    artist: "Eraserheads",
    instrumentalUrl: "/demo/el-bimbo.mp3",
  },
  {
    trackId: "45886843",
    title: "Fly Me to the Moon",
    artist: "Frank Sinatra",
    instrumentalUrl: "/demo/fly-me-to-the-moon.mp3",
  },
];
