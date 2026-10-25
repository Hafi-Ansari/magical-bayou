import { type CSSProperties, Fragment, type ReactNode, useId, useState } from 'react'
import { UI } from '../content'
import { cue } from '../sound/cues'
import { reducedMotion, useBursts } from './bursts'
import { CATS_BOX, CATS_GLOW, HutCats } from './HutCats'
import { CAULDRON, crescent, ghost, heart, star } from './props'
import { createRng, type Rng } from './rng'
import { CYCLE } from './wilds'

/*
 * The witch's hut, on a mossy, rocky hill that rises out of the water in the middle of the bayou,
 * with lower mounds and rocks in front of it (lichen on the stones, cattails at the water's edge,
 * a few glowing toadstools): two crooked storeys of old, warped planks, gone mossy and climbed by
 * ivy, under a big swaybacked roof, a turret under a bent witch's hat, a leaning chimney breathing
 * witchfire smoke, and a dormer. On the ridge two cats sit with their backs turned, gazing up
 * at the crescent moon hanging over them among a few stars (HutCats.tsx). Stone steps climb
 * the hill to a lantern on a post. A silhouette like the rest of the scene, its edges catching the
 * fog's light, lit from inside: amber firelight downstairs; upstairs a candle flickering in a
 * pointed window, a swamp-green glow through a round one hung with moss, and embers behind a
 * shuttered one; the turret's high window in witch-fire violet. Static, but for the light
 * flickering, the stars, the smoke and the cats; its reflection lies in the water below
 * it. The drawing is 400 wide, from the sky above the moon (y -150) to the water (y 460).
 *
 * Once the bayou is awake it can be touched (`Hut`, below): the moon, the chimney, every window,
 * the cats, the door and the toadstools are unseen buttons laid over it.
 */

const VIEW = { y: -150, width: 400, height: 610 }

type Light = 'amber' | 'pale' | 'witch' | 'potion' | 'ember' | 'shroom'

/**
 * The round windows: downstairs, the moss-hung one upstairs, the dormer, and the turret's two,
 * each named for its part (`Part`, below).
 */
const ROUND: { x: number; y: number; r: number; light: Light; part: Part }[] = [
  { x: 138, y: 298, r: 15, light: 'amber', part: 'kitchen' },
  { x: 268, y: 294, r: 15, light: 'amber', part: 'parlour' },
  { x: 228, y: 215, r: 12, light: 'potion', part: 'potion' },
  { x: 158, y: 164, r: 7, light: 'pale', part: 'attic' },
  { x: 113, y: 150, r: 9, light: 'pale', part: 'tower' },
  { x: 113, y: 94, r: 8, light: 'witch', part: 'turret' },
]

/** Where light glows: the windows, the door, the lanterns and the toadstools. `candle` gutters. */
const GLOWS: { x: number; y: number; size: number; light: Light; candle?: boolean; part?: Part }[] =
  [
    ...ROUND.map(({ x, y, r, light, part }) => ({
      x,
      y,
      size: r * (light === 'amber' ? 6 : 4.5),
      light,
      part,
    })),
    { x: 172, y: 218, size: 56, light: 'pale', candle: true, part: 'candle' },
    { x: 280, y: 214, size: 46, light: 'ember', part: 'embers' },
    { x: 206, y: 326, size: 60, light: 'amber' },
    { x: 236, y: 285, size: 44, light: 'amber' },
    { x: 100, y: 315, size: 50, light: 'amber' },
    { x: 66, y: 410, size: 34, light: 'shroom' },
  ]

const DOOR = 'M192 344V312A14 14 0 0 1 220 312V344Z'

/**
 * Where the moon shows: the crescent is a disc at (212, -26), r 26, bitten from the upper right,
 * so what's lit of it sits lower left of that. Its glow, and the full moon it waxes into, are
 * centered there, the full moon about as big as the crescent looks, so it stays in its place.
 */
const MOON = { x: 204, y: -25, r: 23 }

const f = (v: number) => v.toFixed(1)
const rng = createRng(53)

/** Rows of scalloped shingles across the roof, below the ridge, each row offset half a shingle. */
function shingles(): string {
  let d = ''
  for (let y = 146, row = 0; y <= 178; y += 8, row++) {
    const right = 306 + ((y - 110) * 30) / 66 - 6
    for (let x = 136 + (row % 2) * 5; x + 10 <= right; x += 10) d += `M${x} ${y}a5 4 0 0 0 10 0`
  }
  return d
}

/**
 * Old planks laid across a wall from `x0` to `x1`, rows from `y0` to `y1`: each seam warped a
 * little and broken here and there, the planks' ends staggered, and now and then a knot.
 */
function planks(rng: Rng, x0: number, x1: number, y0: number, y1: number): string {
  let d = ''
  for (let y = y0; y <= y1; y += 8 + rng.float() * 3) {
    for (let x = x0; x < x1; ) {
      const run = Math.min(x1 - x, 18 + rng.float() * 40)
      if (rng.chance(0.85)) {
        const sag = (rng.float() - 0.5) * 2.4
        d += `M${f(x)} ${f(y)}Q${f(x + run / 2)} ${f(y + sag)} ${f(x + run)} ${f(y)}`
      }
      x += run + (rng.chance(0.3) ? 3 + rng.float() * 5 : 0)
    }
    const joint = x0 + 10 + rng.float() * (x1 - x0 - 20)
    d += `M${f(joint)} ${f(y)}V${f(y + 8)}`
    if (rng.chance(0.35)) {
      const kx = x0 + rng.float() * (x1 - x0 - 6)
      d += `M${f(kx)} ${f(y + 4)}a3 1.4 0 1 0 6 0a3 1.4 0 1 0 -6 0`
    }
  }
  return d
}

/**
 * A cushion of moss on a ledge from `x0` to `x1` at `y`: soft lumps on top, its underside lying
 * over the edge in wide, shallow drapes, now and then one hanging lower.
 */
function cushion(rng: Rng, x0: number, x1: number, y: number, lump: number): string {
  let d = `M${x0} ${y}`
  for (let x = x0; x < x1; ) {
    const step = Math.min(x1 - x, 5 + rng.float() * 8)
    d += `a${f(step / 2)} ${f(1 + rng.float() * lump)} 0 0 1 ${f(step)} 0`
    x += step
  }
  for (let x = x1; x > x0; ) {
    const step = Math.min(x - x0, 9 + rng.float() * 10)
    const drop = rng.chance(0.2) ? lump * (1.6 + rng.float()) : lump * (0.3 + rng.float() * 0.5)
    d += `Q${f(x - step / 2)} ${f(y + drop * 2)} ${f(x - step)} ${y}`
    x -= step
  }
  return `${d}Z`
}

/** A lumpy patch of moss grown over a wall or a stone, about `rx` by `ry` round (cx, cy). */
function patch(rng: Rng, cx: number, cy: number, rx: number, ry: number): string {
  const n = 9
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const k = 0.7 + rng.float() * 0.45
    return { x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k }
  })
  // Curving through the midpoints between the jittered points, so it's lumpy but never sharp.
  const mids = pts.map((p, i) => {
    const q = pts[(i + 1) % n] ?? p
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
  })
  const last = mids[n - 1] ?? { x: cx, y: cy }
  let d = `M${f(last.x)} ${f(last.y)}`
  for (const [i, p] of pts.entries()) {
    const m = mids[i] ?? p
    d += `Q${f(p.x)} ${f(p.y)} ${f(m.x)} ${f(m.y)}`
  }
  return `${d}Z`
}

/** Lichen speckled over a stone: `n` little pale dots and rosettes within `spread` of (cx, cy). */
function lichen(rng: Rng, cx: number, cy: number, spread: number, n: number): string {
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = rng.float() * Math.PI * 2
    const dist = spread * Math.sqrt(rng.float())
    const x = cx + Math.cos(a) * dist
    const y = cy + Math.sin(a) * dist * 0.6
    const r = 0.5 + rng.float() * 1.3
    d += `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0`
  }
  return d
}

const SHINGLES = shingles()
const PLANKS = planks(rng, 106, 304, 263, 338) + planks(rng, 136, 308, 187, 246)

const MOSS = [
  // The ledge the house stands on, and the main hill's shoulders.
  cushion(rng, 92, 318, 346, 4),
  cushion(rng, 50, 80, 407, 3),
  cushion(rng, 70, 96, 389, 3),
  cushion(rng, 318, 346, 360, 3),
  cushion(rng, 340, 366, 375, 3),
  cushion(rng, 362, 384, 396, 3),
  // The mounds and stones in front.
  cushion(rng, 28, 84, 414, 3),
  cushion(rng, 14, 46, 418, 2.5),
  cushion(rng, 96, 116, 433, 2),
  cushion(rng, 298, 322, 428, 2.5),
  cushion(rng, 318, 346, 430, 3),
  cushion(rng, 342, 364, 436, 2),
  cushion(rng, 160, 196, 451, 2),
  // On the house: the beam between the floors, the sills, and patches grown up the walls.
  cushion(rng, 90, 200, 254, 2.5),
  cushion(rng, 200, 320, 251, 2.5),
  cushion(rng, 126, 150, 314, 1.8),
  cushion(rng, 256, 280, 310, 1.8),
  cushion(rng, 212, 244, 203, 2.5),
  patch(rng, 110, 334, 10, 11),
  patch(rng, 296, 330, 7, 10),
  patch(rng, 140, 244, 7, 5),
  patch(rng, 300, 240, 7, 6),
  patch(rng, 150, 192, 6, 4),
  // Ivy's leaves, up the right-hand corner.
  ...[
    [302, 334],
    [309, 320],
    [300, 306],
    [307, 290],
    [301, 276],
    [306, 258],
    [312, 236],
    [307, 220],
    [312, 206],
  ].map(([x, y], i) => `M${x} ${y}q3 ${i % 2 ? 4 : -4} 6 0q-3 ${i % 2 ? -4 : 4} -6 0Z`),
].join('')

const LICHEN = [
  lichen(rng, 82, 400, 10, 14),
  lichen(rng, 338, 374, 8, 10),
  lichen(rng, 30, 428, 12, 16),
  lichen(rng, 106, 442, 7, 8),
  lichen(rng, 310, 438, 9, 12),
  lichen(rng, 352, 444, 7, 8),
  lichen(rng, 180, 455, 5, 5),
  lichen(rng, 150, 372, 14, 10),
].join('')

function Drawing() {
  return (
    <svg
      className="hut-art"
      viewBox={`0 ${VIEW.y} ${VIEW.width} ${VIEW.height}`}
      aria-hidden="true"
    >
      {/* The crescent moon over them, among a few stars. */}
      <path className="hut-moon" d={crescent(212, -26, 26)} />
      <path
        className="hut-stars"
        d={`${star(140, -96, 3.2)} ${star(286, -116, 2.4)} ${star(116, -36, 2)} ${star(330, -74, 2.6)} ${star(176, -128, 1.8)}`}
      />
      <g fill="currentColor">
        {/* The hill, rising out of the water. */}
        <path d="M0 460C6 448 14 440 24 436C26 426 36 420 46 420C50 410 58 404 68 404C70 394 78 388 86 386C84 376 88 368 94 364C92 356 94 350 98 346L310 342C316 346 322 352 326 358C336 356 346 362 350 372C360 374 368 382 370 392C380 398 386 408 386 418C394 426 398 440 400 460Z" />
        {/* The house: downstairs, the beam it's built up from, and upstairs, leaning a little. */}
        <path d="M100 346L310 342L306 252L104 256Z" />
        <path d="M94 258L316 254L312 176L98 180Z" />
        <path d="M88 262L322 256V250L88 256Z" />
        {/* The swaybacked roof, its ridge dipping flat where they sit. */}
        <path d="M66 190L74 184L108 116C165 140 255 140 306 110L336 176L344 182Q205 170 66 190Z" />
      </g>
      <g className="hut-rim" fill="none" strokeLinecap="round">
        {/* Rock faces and ledges catching the fog's light, the planks, the shingles. */}
        <path
          d="M60 404C62 392 78 386 92 390C104 392 108 402 104 410C92 414 70 414 60 404ZM318 372C322 362 338 358 350 364C358 370 356 382 346 386C334 388 320 384 318 372ZM110 362C150 368 200 362 250 369M128 392C178 400 240 393 300 402M84 426C130 418 170 428 230 420"
          strokeWidth="1.2"
        />
        <path d={PLANKS} strokeWidth="0.75" />
        <path d={SHINGLES} strokeWidth="0.8" />
        {/* The ridge, the right gable's edge, and the eaves. */}
        <path
          d="M134 124C180 138 255 140 306 110L336 176M74 186Q205 168 342 180M90 257L320 252"
          strokeWidth="1.4"
        />
      </g>
      <g fill="currentColor">
        {/* The dormer, the chimney and its cap, and the turret under its hat. */}
        <path d="M142 178L174 177L173 152L143 153Z" />
        <path d="M136 157L158 138L180 155L176 158L158 143L140 160Z" />
        <path d="M268 128L288 122L294 60L274 58Z" />
        <path d="M270 60L300 62V52L270 50Z" />
        <path d="M92 192L134 190L132 62L94 64Z" />
        <path d="M80 66C98 46 104 28 98 14C95 8 88 4 78 4C94 8 108 16 114 28C122 42 132 54 146 60Z" />
        {/* Stone steps up the hill, the door, and a board nailed over a crack upstairs. */}
        <path d="M52 404h15v4h-15zM60 391h15v4h-15zM68 378h14v4h-14zM76 365h14v4h-14zM84 352h13v4h-13z" />
        <path d="M240 240L262 233L263 238L241 245Z" />
        {/* The door, with the crescent cut in it, swinging out on its hinge when it's touched
            (Hut below): firelight inside, and a cauldron bubbling by the hearth. */}
        <g className="hut-door-inside">
          <path className="hut-door-room" d={DOOR} />
          <g transform="translate(206 343.5) scale(0.3) translate(-132 -122)">
            <path d={`${CAULDRON.pot}${CAULDRON.legs}`} />
            <path className="hut-light-potion" d={CAULDRON.brew} />
          </g>
        </g>
        <g className="hut-door-leaf">
          <path d={DOOR} />
          <path
            className="hut-light-amber hut-door-cut"
            d="M209 318A8 8 0 1 0 209 334A11 11 0 0 1 209 318Z"
          />
          <path className="hut-door-edge" d={DOOR} fill="none" strokeWidth="1.4" />
        </g>
        {/* The upstairs shutters: one hanging open, one by a single hinge (below). */}
        <path d="M255 199L266 200L265 229L253 227Z" />
      </g>
      <g className="hut-rim" fill="none" strokeLinecap="round" strokeWidth="1.2">
        <path d="M136 157L158 138L180 155M134 190L132 62M114 28C122 42 132 54 146 60M294 60L288 122M270 50H300" />
        <path d="M52 404h15M60 391h15M68 378h14M76 365h14M84 352h13" />
        <path d="M240 240L262 233M243 242v.1M259 236v.1" />
        <path
          d="M255 199L266 200L265 229L253 227ZM254 208L265 209M254 218L265 219"
          strokeWidth="0.8"
        />
      </g>
      {/* The shutter hanging by a single hinge, which rattles when its window is touched. */}
      <g className="hut-shutter">
        <path fill="currentColor" d="M293 201L304 198L311 225L299 229Z" />
        <path
          className="hut-rim"
          fill="none"
          strokeLinecap="round"
          strokeWidth="0.8"
          d="M293 201L304 198L311 225L299 229ZM296 210L306 207M298 219L309 216"
        />
      </g>
      {/* The mounds and the low stone in front of the hill, nearer and darker, with their rocks. */}
      <g className="hut-near">
        <path d="M-30 460C-24 446 -10 436 6 432C14 420 30 412 48 412C66 410 82 418 92 428C106 430 122 438 132 448C138 452 142 456 144 460Z" />
        <path d="M250 460C256 450 268 444 282 442C292 432 310 426 328 428C346 426 362 432 372 442C390 444 404 452 412 460Z" />
        <path d="M150 460C156 452 170 448 184 450C196 449 206 454 210 460Z" />
      </g>
      {/* Their tops catching the fog's light, so they stand apart from the hill behind. */}
      <path
        className="hut-rim-strong"
        fill="none"
        strokeLinecap="round"
        strokeWidth="1.4"
        d="M-24 446C-10 436 6 432 6 432C14 420 30 412 48 412C66 410 82 418 92 428C106 430 122 438 132 448M256 450C268 444 282 442 282 442C292 432 310 426 328 428C346 426 362 432 372 442C390 444 404 452 412 460M156 452C170 448 184 450 184 450C196 449 206 454 210 460"
      />
      <path
        className="hut-rim"
        fill="none"
        strokeWidth="1.1"
        d="M8 434C10 422 24 414 38 416C50 416 56 426 52 434C40 438 20 440 8 434ZM92 440C96 432 108 430 116 436C122 440 120 448 112 450C102 452 92 448 92 440ZM292 440C294 430 306 424 318 428C328 430 330 440 324 446C312 450 298 448 292 440ZM338 444C340 436 352 432 362 436C370 440 368 450 360 452C350 454 338 452 338 444ZM156 456C164 451 176 450 186 452"
      />
      <path className="hut-moss" d={MOSS} />
      <path className="hut-lichen" d={LICHEN} />
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        {/* The lantern post at the top of the steps, its arm, and the porch lantern's bracket. */}
        <path d="M88 346V300M88 302H101M100 302V310M226 276H237M236 276V280" strokeWidth="2.5" />
        {/* Moss hanging off the eaves. */}
        <path
          d="M70 189c1 6-2 10 0 17s-1 9 1 14M80 187c-1 7 2 11 0 19M90 186c1 5-1 9 1 13M318 180c-1 6 2 9 0 15s1 10-1 16M328 181c1 5-1 10 1 15M338 182c0 6-2 10 0 18"
          strokeWidth="1.1"
        />
      </g>
      {/* Cattails and reeds at the water's edge, and the toadstools' stems. */}
      <g className="hut-near-line" fill="none" strokeLinecap="round">
        <path
          d="M128 458C127 446 129 432 126 418M134 458C134 448 133 438 136 426M140 459C141 452 140 444 143 436M256 458C257 448 255 436 258 424M262 459C261 450 263 442 261 434M100 429l-3 -7M100 429l0 -9M100 429l3 -7M270 443l-3 -6M270 443l1 -8M372 441l-2 -7M372 441l2 -6"
          strokeWidth="1.2"
        />
        <path d="M61 414V408M67 414V405M72 414V409" strokeWidth="1.4" />
      </g>
      <path
        className="hut-near-fill"
        d="M124.4 412a1.6 6 0 1 0 3.2 0a1.6 6 0 1 0 -3.2 0ZM134.4 420a1.6 5.5 0 1 0 3.2 0a1.6 5.5 0 1 0 -3.2 0ZM256.4 418a1.6 6 0 1 0 3.2 0a1.6 6 0 1 0 -3.2 0Z"
      />
      <path
        className="hut-light-shroom"
        d="M57.5 408a3.5 2.6 0 0 1 7 0ZM63 405a4 3 0 0 1 8 0ZM69 409a3 2.2 0 0 1 6 0Z"
      />
      {/* The windows: light behind a rim, crossed by mullions. */}
      {ROUND.map(({ x, y, r, light }) => (
        <g key={`${x} ${y}`}>
          <circle className={`hut-light-${light}`} cx={x} cy={y} r={r} />
          <circle className="hut-rim" cx={x} cy={y} r={r + 1.5} fill="none" strokeWidth="1.5" />
          <path
            d={`M${x - r} ${y}H${x + r}M${x} ${y - r}V${y + r}`}
            stroke="currentColor"
            strokeWidth={r > 10 ? 2.4 : 1.8}
          />
        </g>
      ))}
      {/* Upstairs: a candle in a pointed window, and embers behind the shuttered one. */}
      <path
        className="hut-light-pale hut-candle"
        d="M160 240V210Q160 197 172 190Q184 197 184 210V240Z"
      />
      <path className="hut-light-ember" d="M268 201H292V228H268Z" />
      <g fill="none" stroke="currentColor">
        <path d="M172 191V240M160 214H184M160 227H184M280 201V228M268 214H292" strokeWidth="1.8" />
        <path d="M157 241h30M265 229h30" strokeWidth="3" />
      </g>
      <path
        className="hut-rim"
        fill="none"
        strokeWidth="1.4"
        d="M158 241V210Q158 196 172 188Q186 196 186 210V241M266 199H294V230H266Z"
      />
      {/* Moss strands hanging down over the round window. */}
      <path
        className="hut-moss-line"
        fill="none"
        strokeLinecap="round"
        strokeWidth="1.2"
        d="M216 205c1 6-1 9 0 15M221 204c-1 8 1 12 0 19s1 5 0 8M227 204c1 5-1 8 0 12M233 204c-1 7 1 11 0 17M238 205c1 4-1 7 0 10"
      />
      {/* The two lanterns. */}
      <path className="hut-light-amber" d="M96 310h8l-1 10h-6zM232 280h8l-1 10h-6z" />
      {/* Light round the arched door. */}
      <path
        className="hut-door"
        d="M192 344V312A14 14 0 0 1 220 312V344"
        fill="none"
        strokeWidth="1.4"
      />
      {/* Ivy up the right-hand corner. */}
      <path
        className="hut-moss-line"
        fill="none"
        strokeWidth="1.3"
        d="M306 344C300 330 310 318 304 304C298 290 308 280 303 266C300 258 306 250 310 240C314 228 306 214 311 200"
      />
    </svg>
  )
}

const left = (x: number) => `${((x / VIEW.width) * 100).toFixed(2)}%`
const top = (y: number) => `${(((y - VIEW.y) / VIEW.height) * 100).toFixed(2)}%`
const tall = (h: number) => `${((h / VIEW.height) * 100).toFixed(2)}%`

/** Placed at (x, y) in the drawing's units, with any CSS variables. */
const at = (x: number, y: number, vars: Record<string, string | number> = {}) =>
  ({ left: left(x), top: top(y), ...vars }) as CSSProperties

export type Part =
  | 'moon'
  | 'chimney'
  | 'turret'
  | 'tower'
  | 'cats'
  | 'attic'
  | 'candle'
  | 'potion'
  | 'embers'
  | 'kitchen'
  | 'parlour'
  | 'door'
  | 'toadstools'

/**
 * What can be touched once the bayou is awake: each part's middle and reach, in the drawing's
 * units, from the sky down, the order they glint in. Each is a fingertip at least (theme.css),
 * a `small` one (the windows upstairs) a little less, so neighbors don't overlap.
 */
const SPOTS: { part: Part; x: number; y: number; w: number; h: number; small?: boolean }[] = [
  { part: 'moon', x: 212, y: -26, w: 64, h: 64 },
  { part: 'chimney', x: 282, y: 84, w: 40, h: 92 },
  { part: 'turret', x: 113, y: 94, w: 30, h: 30, small: true },
  { part: 'tower', x: 113, y: 150, w: 30, h: 30, small: true },
  { part: 'cats', x: 205, y: 103, w: 104, h: 74 },
  { part: 'attic', x: 158, y: 164, w: 24, h: 24, small: true },
  { part: 'candle', x: 172, y: 215, w: 28, h: 52, small: true },
  { part: 'potion', x: 228, y: 215, w: 28, h: 28, small: true },
  { part: 'embers', x: 280, y: 214, w: 28, h: 30, small: true },
  { part: 'kitchen', x: 138, y: 298, w: 34, h: 34 },
  { part: 'parlour', x: 268, y: 294, w: 34, h: 34 },
  { part: 'door', x: 206, y: 328, w: 36, h: 44 },
  { part: 'toadstools', x: 66, y: 407, w: 32, h: 22 },
]

/** A window plays its own effect through, so another touch meanwhile does nothing. */
const WINDOWS = new Set<Part>([
  'tower',
  'attic',
  'candle',
  'potion',
  'embers',
  'kitchen',
  'parlour',
])

/** Which way each puff, spark, heart, spore, bubble and ember drifts, in percent of its size. */
const PUFFS = [30, -25, 70, 5, 110, -50]
const SPARKS = [180, -120, 320, 40]
const HEARTS = [
  { x: -14, dx: -160 },
  { x: 12, dx: 120 },
  { x: -4, dx: -60 },
  { x: 18, dx: 200 },
  { x: 3, dx: 40 },
]
const SPORES = [-120, 60, -40, 140, 0, -180, 100]
const BUBBLES = [
  { x: -6, dx: -120, s: 1 },
  { x: 3, dx: 80, s: 0.7 },
  { x: -1, dx: -30, s: 1.3 },
  { x: 6, dx: 150, s: 0.85 },
  { x: -3, dx: 20, s: 1.1 },
  { x: 1, dx: -90, s: 0.6 },
]
const EMBERS = [
  { dx: 380, dy: -900 },
  { dx: 700, dy: -500 },
  { dx: 120, dy: -1300 },
  { dx: 900, dy: -1100 },
  { dx: 520, dy: -1500 },
  { dx: 260, dy: -700 },
]
/** The witchlights the tower window runs through. */
const TOWER = ['#b98cff', '#7fe0cf', '#ff9cc6', '#ffd36e']
const HEART = heart(0, 0, 1)
const GHOST = ghost(268, 312, 22, 'right')
/** A witch's shadow, hat, head and shoulders, as if crossing the room past the kitchen window. */
const WITCH =
  'M128 296.5H148V298.5H128ZM133 297L139.5 281L143 297ZM133 303a5 5 0 1 0 10 0a5 5 0 1 0 -10 0ZM126 318Q127 309 138 308Q149 309 150 318Z'
const CANDLE_WINDOW = 'M160 240V210Q160 197 172 190Q184 197 184 210V240Z'

/** A drawing laid over part of the hut (`box`: x, y, width, height in its units). */
function Overlay({
  box: [x, y, w, h],
  className,
  children,
}: {
  box: [number, number, number, number]
  className?: string
  children: ReactNode
}) {
  return (
    <svg
      className={className ? `hut-over ${className}` : 'hut-over'}
      viewBox={`${x} ${y} ${w} ${h}`}
      aria-hidden="true"
      style={{ left: left(x), top: top(y), width: left(w), height: tall(h) }}
    >
      {children}
    </svg>
  )
}

/** Something seen through a round window: clipped to it, its mullions drawn back over it. */
function Through({
  x,
  y,
  r,
  className,
  children,
}: {
  x: number
  y: number
  r: number
  className: string
  children: ReactNode
}) {
  const clip = useId().replace(/[^\w-]/g, '')
  return (
    <Overlay box={[x - r - 2, y - r - 2, 2 * r + 4, 2 * r + 4]} className={className}>
      <clipPath id={clip}>
        <circle cx={x} cy={y} r={r} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>{children}</g>
      <path
        d={`M${x - r} ${y}H${x + r}M${x} ${y - r}V${y + r}`}
        stroke="currentColor"
        strokeWidth={r > 10 ? 2.4 : 1.8}
      />
    </Overlay>
  )
}

/** A little bat, its wings flapping about its middle (12, 7). */
function Bat() {
  return (
    <svg className="hut-bat" viewBox="0 0 24 14" aria-hidden="true" style={at(113, 94)}>
      <path
        className="hut-bat-wings"
        d="M11 6.5C8 3.5 4 3 0.5 5C2 5.5 2.8 6.6 3 8C4.2 7.2 5.5 7.4 6.3 8.4C7.4 7.6 9 7.8 10.6 8.6ZM13 6.5C16 3.5 20 3 23.5 5C22 5.5 21.2 6.6 21 8C19.8 7.2 18.5 7.4 17.7 8.4C16.6 7.6 15 7.8 13.4 8.6Z"
      />
      <path d="M12 4.5C13.3 4.5 14 5.7 14 7.3S13.2 10.5 12 10.5S10 8.9 10 7.3S10.7 4.5 12 4.5ZM10.8 5L10.6 3.3L11.5 4.6ZM13.2 5L13.4 3.3L12.5 4.6Z" />
    </svg>
  )
}

/** What a touch sets going, by part: each plays once (theme.css). `hue` colors the chimney's. */
function Effect({ part, hue }: { part: Part; hue: number }) {
  switch (part) {
    case 'chimney':
      return (
        <>
          {PUFFS.map((dx, i) => (
            <span
              key={dx}
              className="hut-puff"
              style={at(285, 52, { '--i': i, '--dx': `${dx}%`, '--h': i % 2 ? hue + 40 : hue })}
            />
          ))}
          {SPARKS.map((dx, i) => (
            <span
              key={dx}
              className="hut-burst-spark"
              style={at(281 + i * 3, 54, { '--i': i, '--dx': `${dx}%`, '--h': hue })}
            />
          ))}
        </>
      )
    case 'cats':
      return (
        <>
          <span className="hut-cats-flush" style={at(CATS_GLOW.x, CATS_GLOW.y)} />
          {HEARTS.map(({ x, dx }, i) => (
            <svg
              key={dx}
              className="hut-float-heart"
              viewBox="-0.55 -0.65 1.1 1.05"
              aria-hidden="true"
              style={at(CATS_GLOW.x + x, CATS_GLOW.y - 6, { '--i': i, '--dx': `${dx}%` })}
            >
              <path d={HEART} />
            </svg>
          ))}
        </>
      )
    case 'toadstools':
      return (
        <>
          <span className="hut-flash hut-flash-shroom" style={at(66, 407)} />
          {SPORES.map((dx, i) => (
            <span
              key={dx}
              className="hut-spore"
              style={at(59 + i * 2.4, 406, { '--i': i, '--dx': `${dx}%` })}
            />
          ))}
        </>
      )
    case 'turret':
      return (
        <>
          <span className="hut-flash hut-flash-witch" style={at(113, 94)} />
          <Bat />
        </>
      )
    // The tower window runs through the witchlights, one after another.
    case 'tower':
      return (
        <Through x={113} y={150} r={9} className="hut-tower">
          {TOWER.map((color, k) => (
            <circle
              key={color}
              className="hut-tower-light"
              cx={113}
              cy={150}
              r={9}
              fill={color}
              style={{ '--k': k } as CSSProperties}
            />
          ))}
        </Through>
      )
    // The attic goes dark, and an owl blinks out of it.
    case 'attic':
      return (
        <>
          <span className="hut-flash hut-flash-owl" style={at(158, 164)} />
          <Through x={158} y={164} r={7} className="hut-owl">
            <circle className="hut-owl-dark" cx={158} cy={164} r={7} />
            <g className="hut-owl-eyes">
              {/* In the two upper panes, clear of the mullions. */}
              <circle cx={155.2} cy={160.8} r={2.3} />
              <circle cx={160.8} cy={160.8} r={2.3} />
              <path
                className="hut-owl-pupils"
                d="M154.4 160.8a0.8 1.2 0 1 0 1.6 0a0.8 1.2 0 1 0 -1.6 0ZM160 160.8a0.8 1.2 0 1 0 1.6 0a0.8 1.2 0 1 0 -1.6 0Z"
              />
            </g>
          </Through>
        </>
      )
    // The candle is blown out, its smoke curls up, and it catches again.
    case 'candle':
      return (
        <Overlay box={[150, 150, 44, 100]} className="hut-snuff">
          <path className="hut-snuff-shade" d={CANDLE_WINDOW} />
          <path className="hut-snuff-light" d={CANDLE_WINDOW} />
          <path
            className="hut-snuff-wisp"
            d="M172 196c-2.5 -5 2.5 -9 0 -14s2.5 -9 0 -14s2 -8 0 -12"
            fill="none"
            strokeLinecap="round"
            strokeWidth="1.3"
          />
          <path d="M172 191V240M160 214H184M160 227H184" stroke="currentColor" strokeWidth="1.8" />
        </Overlay>
      )
    case 'potion':
      return (
        <>
          <span className="hut-flash hut-flash-potion" style={at(228, 215)} />
          {BUBBLES.map(({ x, dx, s }, i) => (
            <span
              key={dx}
              className="hut-bubble"
              style={at(228 + x, 212, { '--i': i, '--dx': `${dx}%`, '--s': s })}
            />
          ))}
        </>
      )
    // The loose shutter rattles (`data-playing`, below) and embers blow out.
    case 'embers':
      return (
        <>
          <span className="hut-flash hut-flash-ember" style={at(280, 214)} />
          {EMBERS.map(({ dx, dy }, i) => (
            <span
              key={dx}
              className="hut-ember"
              style={at(284, 212 + (i % 3) * 4, {
                '--i': i,
                '--dx': `${dx}%`,
                '--dy': `${dy}%`,
              })}
            />
          ))}
        </>
      )
    // A witch's shadow passes the kitchen window.
    case 'kitchen':
      return (
        <Through x={138} y={298} r={15} className="hut-witch">
          <path className="hut-witch-shadow" d={WITCH} />
        </Through>
      )
    // A little ghost rises into the parlour window, waves, and ducks away again.
    case 'parlour':
      return (
        <Through x={268} y={294} r={15} className="hut-ghost">
          <g className="hut-ghost-rise">
            <path className="hut-ghost-sheet" d={GHOST.ink} />
            <path className="hut-ghost-cut" d={GHOST.cut} />
          </g>
        </Through>
      )
    default:
      return null
  }
}

/** The buttons over the hut's parts, glinting in turn every `CYCLE` (theme.css). */
function Spots({
  touch,
  full,
  open,
}: {
  /** `x`: how far across the screen the part is, 0–1, for the side its sound comes from. */
  touch: (part: Part, x: number) => void
  full: boolean
  open: boolean
}) {
  // Where the lanterns' cycle (wilds.ts) is as these mount, which is when the glints start, so
  // they glint just after each wave of the lanterns.
  const [glintAt] = useState(() => -((performance.now() / 1000) % CYCLE))
  return (
    <div className="hut-spots" style={{ '--glint-at': `${glintAt.toFixed(3)}s` } as CSSProperties}>
      {SPOTS.map(({ part, x, y, w, h, small }, n) => (
        <button
          key={part}
          type="button"
          className="hut-spot"
          data-part={part}
          data-small={small ? '' : undefined}
          aria-label={UI[part]}
          aria-pressed={part === 'moon' ? full : part === 'door' ? open : undefined}
          style={at(x, y, { width: left(w), height: tall(h), '--n': n })}
          onClick={(event) => {
            const { left, width } = event.currentTarget.getBoundingClientRect()
            touch(part, (left + width / 2) / window.innerWidth)
          }}
        />
      ))}
    </div>
  )
}

const byPart = (p: { part: Part }) => p.part

/**
 * The hut on its hill, standing in the water, with its reflection below it. Once the bayou is
 * awake, it can be touched: the moon waxes full and wanes again, the door swings open and
 * shut, the chimney puffs, hearts rise over the cats, the toadstools breathe out spores, a
 * bat flutters out of the turret, and every other window has something of its own.
 */
export function Hut({ awake }: { awake: boolean }) {
  const [full, setFull] = useState(false)
  const [open, setOpen] = useState(false)
  const [plays, play] = useBursts<{ part: Part; hue: number }>(4200, 2, byPart)

  // Each touch is heard (cue, touches.ts) only when something happens.
  const touch = (part: Part, x: number) => {
    if (part === 'moon') {
      setFull(!full)
      cue('touch', { part, x, on: !full })
    } else if (part === 'door') {
      setOpen(!open)
      cue('touch', { part, x, on: !open })
    }
    // The rest only move, so with reduced motion they keep still.
    else if (reducedMotion()) return
    else if (WINDOWS.has(part) && plays.some((p) => p.at.part === part)) return
    else {
      play({ part, hue: Math.round(Math.random() * 360) })
      cue('touch', { part, x })
    }
  }

  const playing = [...new Set(plays.map((p) => p.at.part))].join(' ')
  const state = {
    'data-moon': full ? 'full' : undefined,
    'data-door': open ? 'open' : undefined,
    // What's playing, for what's drawn in both (the shutter) and the windows' own glows.
    'data-playing': playing || undefined,
  }
  return (
    <>
      <div className="hut-reflection" {...state}>
        <Drawing />
      </div>
      <div className="hut" {...state}>
        {/* The house, its roof and the cats on it, without the sky: the fireflies gather round
            this (Bayou.tsx). */}
        <span
          className="hut-heart"
          style={{ left: left(60), top: top(0), width: left(290), height: tall(350) }}
        />
        <span className="hut-moon-glow" style={at(MOON.x, MOON.y)} />
        <span className="hut-moon-halo" style={at(MOON.x, MOON.y)} />
        <Drawing />
        {/* Touched, the moon waxes full: glowing through the fog, which drifts across it. */}
        <span className="hut-full-moon" style={at(MOON.x, MOON.y, { width: left(2 * MOON.r) })}>
          <span className="hut-full-moon-disc" />
          <span className="hut-full-moon-mist" />
          <span className="hut-full-moon-mist hut-full-moon-mist-high" />
        </span>
        <span className="hut-cats-glow" style={at(CATS_GLOW.x, CATS_GLOW.y)} />
        <HutCats
          style={{
            left: left(CATS_BOX.x),
            top: top(CATS_BOX.y),
            width: left(CATS_BOX.width),
            height: tall(CATS_BOX.height),
          }}
        />
        {GLOWS.map((g, i) => (
          <span
            key={`${g.x} ${g.y}`}
            className={`hut-glow hut-glow-${g.light}${g.candle ? ' hut-candle' : ''}`}
            data-part={g.part}
            style={at(g.x, g.y, { '--size': left(g.size), '--i': i })}
          />
        ))}
        {/* Firelight out of the open door: the hearth, and a pool of it on the ledge. */}
        <span className="hut-door-light">
          <span className="hut-door-hearth" style={at(206, 336)} />
          <span className="hut-door-pool" style={at(206, 349)} />
        </span>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={i % 2 ? 'hut-smoke hut-smoke-teal' : 'hut-smoke'}
            style={at(285, 50, { '--i': i })}
          />
        ))}
        {[0, 1, 2].map((i) => (
          <span key={i} className="hut-spark" style={at(283 + i * 4, 52, { '--i': i })} />
        ))}
        {plays.map(({ id, at: p }) => (
          <Fragment key={id}>
            <Effect part={p.part} hue={p.hue} />
          </Fragment>
        ))}
        {awake && <Spots touch={touch} full={full} open={open} />}
      </div>
    </>
  )
}
