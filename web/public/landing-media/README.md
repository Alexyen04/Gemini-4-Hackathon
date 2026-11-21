# landing-media (gitignored — never commit media, see AGENTS.md §2B)

Drop these files here locally. Every slot falls back to a screentone placeholder if the file is missing.

| File | Used in | Notes |
| --- | --- | --- |
| `hero.mp4` | CH.00 hero panel | short muted loop, real game footage you have rights to |
| `hero-frame.jpg` | CH.00 halftone layer | one raw frame from `hero.mp4`: `ffmpeg -ss 3 -i hero.mp4 -frames:v 1 -vf scale=1280:-2 hero-frame.jpg` |
| `hero.jpg` | CH.00 manga page | finished portrait manga page made from `hero.mp4` (12:17) |
| `peel-ink.jpg` | CH.02 ink panel | `peel-raw.jpg` deterministically inked (same size, pixel-aligned) |
| `peel-raw.jpg` | CH.02 X-ray lens | `hero.mp4` at 3.0s, cropped 1280×640 (scoreboard removed) |
| `system-ink.jpg` | CH.01 panel 06 | `system-raw.jpg` deterministically inked |
| `system-raw.jpg` | CH.01 panel 06 flip | `hero.mp4` at 0.8s, 440×440 crop on the action |
