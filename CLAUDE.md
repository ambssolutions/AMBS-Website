# AMBS Solutions website notes

These notes apply to this site and to any other AMBS Solutions website.

## Working style
- Make changes locally and show screenshots or a video first.
- Publish to the live site only when the owner says "push live".

## Design preferences
- Stacked card sections (like "How it works"): use native CSS `position: sticky` stacking.
  - Cards scroll normally and stick near the top, one under the next, each leaving its number row showing.
  - Then they release together.
  - Don't pin sections or move the cards with scroll-driven JavaScript. The owner wants the effortless, native feel.
- Expanding cards (like "What we do" on phones): unfold slowly and smoothly with a native CSS fold (`grid-template-rows` transition, about 1.3s), with the content fading in.
- Colours: use the logo's green for all greens, and brand blue and purple from the logo.
- Dark mode logos light up from grey to full colour with no glow or halo around them.
