# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A living bayou after dusk, made to be a live wallpaper (run in Lively Wallpaper from its URL, with
mouse input on). A static Vite + React + TypeScript site on Vercel. See README.md.

**This repository is public.** Keep everything in it about the bayou itself: no personal names,
messages, photos, dates or places, in code, comments, docs or commit messages.

## Commands

```sh
npm run dev          # dev server at localhost:5173
npm test             # unit tests (test/)
npm run lint         # Biome lint + format check; `npm run format` auto-fixes
npm run typecheck
npm run build
npm run check        # with `npm run dev` running: wakes the bayou in headless Chromium, touches
                     # every part and checks each sound plays, works the sound menu (each box
                     # silences its layer, choices last a reload, nothing ticked opens awake),
                     # checks `?fps` holds the animations and the console stays clean.
                     # `npm run check -- <url>`; VIEWPORT=2560x1440 tries a desktop.
```

After any change you can see, run `npm run check` and look at shots/.

## Code map

- `src/App.tsx`: the bayou, the wake cue and the sound menu. A browser plays nothing before a tap,
  so it opens on "Tap to let the bayou sing" (`Cue.tsx`, `.wake-cue`); that tap starts the sound
  and wakes the bayou (`awake`). With every sound layer off (or `?sound=off`) it opens awake.
- `src/content.ts`: every word shown or read out (the cue, the menu, each hut part's label).
- `src/scene/`:
  - `Bayou.tsx`: the calm CSS layers (sky, glow, trunks, water with waves, two lanterns on cords),
    where the lantern streaks on the water lie (`ripples`), and the touches of the lanterns, water
    and sky.
  - `wilds.ts`: what's drawn on canvases every tick: fog, the canopy's limbs and moss in the wind
    with lanterns on them, and the fireflies (many gathered round the hut). Limbs and foliage are
    painted once per screen size and stamped; the canopy is redrawn at most 30 times a second.
  - `streaks.ts`: the lantern streaks on the water, on a canvas in `.water`, drawn from wilds.ts's
    loop. They were 50 animated elements; each is painted once per water size (bar and
    box-shadow-like glow) and stamped every tick, stretched and faded exactly as their old
    `@keyframes ripple` (`ease-in-out infinite alternate`, `shiver`) moved them, and snapped to
    whole px as the browser snapped the elements.
  - `Hut.tsx`: the witch's hut on its hill, its reflection, its lights, and the unseen buttons over
    its parts (`SPOTS`) with what each touch sets going (`Effect`). `HutCats.tsx`: the two cats on
    the ridge, in their own small SVG so their animation repaints only that; the stars and the
    candle's window are laid over the hut the same way (`Lights`), for the same reason.
    `props.ts`: the star, crescent, ghost, heart and cauldron shapes.
  - `moss.ts` and `rng.ts`: every shape from fixed seeds, so it's the same on every visit.
  - `bursts.ts`: one-off effects, removed by timer, capped per part.
  - `pace.ts`: draws everything at most `?fps` times a second (30 by default): the canvas loop
    (`frame`) and every CSS animation are held and stepped on one timer. Left alone, a browser draws
    on every screen refresh while anything moves; on a 165 Hz monitor that held a desktop GPU at a
    quarter of its power, and 30 fps brought it near idle. Capping the canvases alone saves nothing
    while CSS animations run free. Left alone 10 s (no pointer over it), it's drawn at `?idle` (15)
    instead, back to `?fps` at the first move; ticks come from `setInterval`, not a timeout per
    tick (on Windows that cost the GPU process more CPU). A full-screen `mix-blend-mode` layer cost
    the GPU a third of its work every tick, so there's none; measure GPU cost by board power
    (`nvidia-smi`), not Task Manager. What's left is CPU: stepping an animation costs about the same
    whatever it moves, so every running animation costs a step every tick (about 60 at rest, with
    the bayou awake). Each one's end is read once, as it's held. Keep the count down: draw many
    small moving things on a canvas instead, and stop animations no one can see (the reflection's
    stars, the wake cue once it's gone).
  - **The 10 s cycle** (`CYCLE`, `SWEEP` in wilds.ts): a wave of light runs through the lanterns
    every 10 s, and the hut's parts glint after it. The CSS animations join the same clock through
    their delay, `-(performance.now() / 1000 % CYCLE)` taken as they mount. Change `CYCLE` and the
    CSS's `10s` together.
- `src/sound/`:
  - `engine.ts`: Web Audio outside React. Three layers (`Layers`: tune, ambience, touches), each
    switched in the sound menu and remembered in localStorage. Every file in public/audio/ is
    decoded after load on an `OfflineAudioContext`, so the sound starts at once on the first tap.
    One master, a limiter, three panned effect buses; at most six effects at once; out of sight or
    with everything off, the context sleeps and effects are skipped.
  - `soundscape.ts`: the tune and the crickets looping without a seam (loop points in
    `sound.json`), the frogs and owls calling (`critters.ts`, pure and unit-tested), each layer
    faded on its own.
  - `touches.ts`: what each touch plays (`TOUCH`), timed to start as its animation does (`delay`,
    read off theme.css's keyframes). `takes.ts`: which effects have several takes.
  - `cues.ts`: the scene calls `cue('touch', …)`; only the sound listens.
  - `SoundMenu.tsx` and `sound.css`: the gilt crescent and its menu of checkboxes.
- `src/theme.css`: tokens on `:root`, the wake cue, then the whole bayou.
- `public/audio/`: the sound files and `sound.json` (loop points, levels, mix).

## Rules

- **Keep the bayou cheap.** Its CSS animations move by `transform` and `opacity` only, and
  anything drawn every tick is measured before it's added to. Check a change's cost with the
  wallpaper in mind: it runs all day.
- **Every touch that sets something going calls the `touch` cue, and only then.** A window still
  playing, or a part kept still by reduced motion, is silent too.
- **Mobile first, desktop too.** Design for 390×844 and check a wide desktop (2560×1440), with
  no scrolling.

## Deploying

Vercel builds from the repo root (Vite is detected). `vercel.json` sets `noindex` headers and
serves the page itself `no-cache`, so a wallpaper always loads the latest. Every push to `main`
deploys to production.
