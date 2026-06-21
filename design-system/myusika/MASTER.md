# Design System Master File — Myusika

> Generated via `ui-ux-pro-max`, then deliberately overridden where the
> auto-match didn't fit. See **Override Rationale** below before changing
> colors — this is not the raw tool output.

**Project:** Myusika
**Category:** Karaoke / Videoke (not a generic "Music Streaming" app — no
app-store presence, so the tool's default "App Store Style Landing" pattern
was dropped entirely)

---

## Override Rationale

The raw `--design-system` query matched **"Vibrant & Block-based"** style on a
light rose/pink palette, tuned for an App Store landing page. Rejected:
Myusika is a web app with an already-distinctive **dark, cinematic videoke
stage** look (dark plum-black + gold spotlight), verified working on screen
across 3 sessions. Repainting it pink would trade a working, characterful
look for a generic SaaS template.

Instead, two follow-up domain searches matched far better:
- **Style → "Dark Mode (OLED)"**: deep black/grey base, neon accents incl.
  gold, WCAG AAA, excellent performance — describes what's already built.
- **Color → "Theater/Cinema"**: *"Dramatic dark + spotlight gold"* — the
  literal concept of singing under a spotlight on a stage.

So: **keep the proven palette, formalize it into real tokens, upgrade only
what was actually generic** (the font — Geist is the default Next.js font,
present in thousands of unstyled scaffolds).

---

## Color Palette (formalized from the 180 existing hex literals across the app)

| Token | Hex | Role |
|---|---|---|
| `--color-bg` | `#120913` | Page background |
| `--color-bg-deep` | `#0c060d` | Deepest background (loading states, overlays) |
| `--color-surface` | `#1a0b10` | Card / panel surface |
| `--color-surface-alt` | `#1f0d13` | Search result row surface |
| `--color-surface-hover` | `#281018` | Hover state for surface-alt |
| `--color-gold` | `#ffcf66` | Primary brand color — headings, active states, borders (115 prior uses) |
| `--color-gold-hover` | `#ffd166` | Gold hover/active variant |
| `--color-gold-light` | `#ffd98a` | Lighter gold for glows/accents |
| `--color-amber` | `#ffb84d` | Secondary accent / CTA buttons |
| `--color-cream` | `#ffe8c2` | Muted body text on dark |
| `--color-cream-light` | `#ffefcf` | Alt muted text |
| `--color-foreground` | `#fff8eb` | Primary text |

**Do not introduce new hues.** Every screen draws from this one palette —
that consistency is the actual win here, not new colors.

## Typography (the real upgrade)

- **Heading / display font:** Righteous — bold, rounded, built for
  music/entertainment branding. Replaces Geist Sans for headings only.
- **Body font:** Poppins — friendly geometric sans, pairs cleanly with
  Righteous, good readability at small sizes.
- **Google Fonts:** https://fonts.google.com/share?selection.family=Poppins:wght@300;400;500;600;700|Righteous

## Style Guidelines

**Style:** Dark Mode (OLED) — minimal glow effects (`text-shadow: 0 0 Npx`),
vibrant gold neon accents, high contrast, low-complexity, excellent
performance.

**Thematic pattern:** Theater/Cinema — dramatic dark stage + spotlight gold.
Karaoke = performing under a spotlight; the existing plum-black (theater
curtain / velvet) and gold accent already embody this without changing hue.

## Spacing & Shadow Scale (adopted as-is — these are sound regardless of palette)

| Token | Value |
|---|---|
| `--space-xs` | 4px |
| `--space-sm` | 8px |
| `--space-md` | 16px |
| `--space-lg` | 24px |
| `--space-xl` | 32px |
| `--space-2xl` | 48px |

## Anti-Patterns (do NOT introduce)

- ❌ New hues outside the palette above
- ❌ Emojis as icons — this app already uses SVG icons correctly, keep it that way
- ❌ Missing `cursor-pointer` on clickable elements
- ❌ Layout-shifting hover transforms
- ❌ Instant (non-transitioned) state changes

## Pre-Delivery Checklist (apply per screen)

- [ ] Headings use Righteous, body text uses Poppins
- [ ] All colors come from the token table above (no new magic hex values)
- [ ] `cursor-pointer` on every clickable element
- [ ] Hover states use 150–300ms transitions
- [ ] Focus states visible for keyboard nav
- [ ] `prefers-reduced-motion` respected for any new animation
- [ ] Responsive at 375px / 768px / 1024px / 1440px
