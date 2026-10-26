# Magical Bayou

A living bayou after dusk, made to be a live wallpaper: a witch's hut on a mossy hill out on dark
water, two cats on its roof gazing up at a crescent moon, Spanish moss swaying from the cypresses,
lanterns swinging and flaring, fog drifting, fireflies, and a witchy tune over crickets, frogs and
owls.

Touch it and it answers: the moon waxes full, the door swings open on firelight, the chimney puffs
colored smoke, a bat flutters out of the turret, an owl blinks from the attic, a ghost waves from
the parlour, hearts rise over the cats, lanterns flare, the water ripples, and shooting stars
cross the sky. Each has its own sound.

Vite + React + TypeScript, drawn with CSS, SVG and canvas, with sound through Web Audio. A static
site, deployed on Vercel.

## As a live wallpaper (Windows)

1. Install [Lively Wallpaper](https://www.rocksdanister.com/lively/) (free, from the Microsoft
   Store).
2. Add a wallpaper from a URL, using the site's address.
3. In Lively's settings, turn on mouse input for wallpapers, so the bayou can be touched.

Tap once to wake it (a browser plays no sound before a tap). The crescent in the top-right corner
opens the sound menu: tick which sounds play (the tune, the bayou's creatures, the sounds of
touching it). The choice is remembered.

It's drawn at most 30 times a second, which looks the same for something this slow and keeps a
desktop GPU nearly idle, and 15 times a second once no pointer has moved over it for 10 seconds.
Add `?fps=20` (or any number) to the URL to change the first, `?idle=` the second, or `?fps=0` to
draw at the screen's own rate. `?sound=off` leaves the sound out altogether.

## Running it

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests
npm run lint         # Biome lint and format check (`npm run format` fixes)
npm run typecheck
npm run build
npm run check        # with `npm run dev` running: plays the bayou in headless Chromium and
                     # fails on anything that doesn't work (screenshots in shots/)
```
