# Musicathon 2026 — Submission Checklist

> Delete this file once submitted. Tracks what's actually done vs. pending —
> not an official rules doc (none was found in this repo or its parent
> folder), just an honest status list.

## Done

- [x] GitHub repo public and up to date (`thanreiz/musicathon`)
- [x] README rewritten for submission format — problem/vision/purpose,
      screenshots, architecture diagram, roadmap, team
- [x] Three built-in demo songs ship with zero setup required
- [x] Core flow verified end-to-end: search → confirm/upload → Demucs
      separation → karaoke playback, on all 4 screens
- [x] WhisperX forced alignment proven through the real upload route on a
      genuine non-richsync track
- [x] Responsive layout checked at 375 / 768 / 1280px, two real bugs found
      and fixed (header wrap, contrast failures)
- [x] Interaction animations, design tokens, typography pass shipped

## Not done — needs you, not more code

- [ ] **Human ear/eye pass on the 3 built-in songs.** I verified these
      technically (network 200s, badges, sync behavior) but no one has
      actually sat through "Perfect," "Ang Huling El Bimbo," and "Fly Me to
      the Moon" end-to-end yet. Do this before recording the demo — it's
      the cheapest way to catch something a screenshot can't show.
- [ ] **Demo video** (the README links to "coming soon"). Suggested order,
      based on what's actually built and verified:
      1. Home → search → pick a built-in song (zero-setup path first)
      2. Karaoke screen: per-word lyric sweep, key transposition, lyric
         size, instrumental-break banner
      3. Upload flow on a real song: Demucs separation running, then
         singing it
      4. (Optional, riskier) WhisperX auto-sync badge on a non-richsync song
- [ ] **Pitch deck** (also "coming soon" in the README). The README's
      Problem / Vision / Purpose / Features sections are already
      pitch-deck-shaped — reorganizing them into slides is most of the work.
- [ ] **Live deployment decision.** Currently intentionally undeployed
      (vocal separation needs local Python). If judges need a clickable
      link even for browsing-only, a Vercel deploy with upload disabled
      is possible — your call, not something I should decide for you.
- [ ] **Find and read the actual hackathon rules** for required submission
      fields (team size, eligibility, format). I didn't find a rules
      document anywhere in this repo or the local Musicathon folder —
      check the hackathon's official page/portal directly.
