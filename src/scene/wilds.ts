/*
 * The living parts of the bayou, drawn on canvases every frame: fog banks drifting and
 * breathing, Spanish moss bending in a gusting wind, and fireflies, many of them gathered round
 * the hut. The fog and the moss are behind the hut's lanterns; the fireflies are in front of
 * everything. Canvas because hundreds of strands and fireflies each moving on their own would be
 * far heavier as elements. Once the bayou is awake, a lantern touched flares up a moment
 * (`poke`).
 */
import {
  CANOPY_VIEW,
  canopy,
  type Firefly,
  fireflies,
  fogBanks,
  type Lantern,
  lanterns,
  type MossBranch,
} from './moss'
import { cancelFrame, frame } from './pace'

const LEFT = canopy(11)
const RIGHT = canopy(23)
const LEFT_LANTERNS = lanterns(13, LEFT)
const RIGHT_LANTERNS = lanterns(29, RIGHT)
/** Seconds a lantern burns brighter when it's touched, or the wave reaches it. */
const FLARE = 1.2
/**
 * Every `CYCLE` seconds a wave of light runs left to right through the lanterns on the limbs,
 * taking `SWEEP` seconds to cross the screen. Once the bayou is awake, the hut's
 * parts glint just after it, on the same clock (Hut.tsx, `.hut-spot::before`), and the two
 * lanterns hung in CSS flare with it (Bayou.tsx).
 */
export const CYCLE = 10
export const SWEEP = 2.4
/** How near a touch must be to a lantern to set it flaring, in px. */
const REACH = 26
const FOG = fogBanks(31)
const FLIES = [...fireflies(17, 80, 0.6), ...fireflies(41, 18, 1)]
/**
 * Fog is soft anyway, so it's painted at this fraction of the screen's resolution on its own
 * canvas and scaled up by CSS: it looks the same and costs a sixteenth as much to fill.
 */
const MIST_SCALE = 0.25
/** Seconds between redraws of the canopy (a hair under 1/30, so a 60 Hz screen hits every other frame). */
const CANOPY_STEP = 1 / 30 - 0.002

const FOG_RGB = '143,163,160'
const NEAR = '#030606'
const CORD = 'rgba(0,0,0,0.85)'

interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** A soft round sprite, drawn once and stamped many times (much cheaper than gradients per frame). */
function sprite(size: number, stops: [number, string][], squash = 1): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = size
  c.height = Math.round(size * squash)
  const g = c.getContext('2d')
  if (!g) return c
  g.scale(1, squash)
  const r = size / 2
  const grad = g.createRadialGradient(r, r, 0, r, r, r)
  for (const [at, color] of stops) grad.addColorStop(at, color)
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return c
}

/**
 * A lantern's body, 9 by 13 px like the ones hung in CSS (Bayou.tsx): drawn once at twice the
 * size, so it stays sharp on a dense screen.
 */
function lanternBody(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 18
  c.height = 26
  const g = c.getContext('2d')
  if (!g) return c
  g.scale(2, 2)
  const grad = g.createRadialGradient(4.5, 7.15, 0, 4.5, 7.15, 8.45)
  grad.addColorStop(0, '#ffe2a8')
  grad.addColorStop(0.45, 'rgb(242,165,65)')
  grad.addColorStop(1, '#b5561c')
  g.fillStyle = grad
  g.beginPath()
  g.roundRect(0, 0, 9, 13, [3, 3, 4, 4])
  g.fill()
  return c
}

/** Where a lantern was last drawn on screen (its middle), and when it was last touched. */
interface Spot {
  x: number
  y: number
  flare: number
}
const spots = (hung: Lantern[]): Spot[] =>
  hung.map(() => ({ x: Number.NaN, y: Number.NaN, flare: Number.NEGATIVE_INFINITY }))

/** How much brighter a lantern touched at `flare` burns at `t`: flaring up at once, dying slowly. */
function flaring(t: number, flare: number): number {
  const k = t - flare
  if (k < 0 || k > FLARE) return 0
  return k < 0.12 ? k / 0.12 : (1 - (k - 0.12) / (FLARE - 0.12)) ** 2
}

/** The wind across the whole scene: slow swells, a little flutter, and now and then a gust. */
function wind(t: number): number {
  const swell = 0.55 * Math.sin(0.37 * t) + 0.3 * Math.sin(0.83 * t + 1.3)
  const flutter = 0.15 * Math.sin(1.9 * t + 0.4)
  const gust = 1.6 * Math.max(0, Math.sin(0.13 * t + 2)) ** 10
  return swell + flutter + gust
}

/** Eases `box` a step toward `target`, so the fireflies drift after the hut when it moves. */
function follow(box: Box, target: Box, step: number): void {
  const k = box.w === 0 ? 1 : step
  box.x += (target.x - box.x) * k
  box.y += (target.y - box.y) * k
  box.w += (target.w - box.w) * k
  box.h += (target.h - box.h) * k
}

/** Where a point `around` a box's edge is (0–1 clockwise from top-left), `offset` px outside. */
function aroundBox(box: Box, around: number, offset: number): { x: number; y: number } {
  const perimeter = 2 * (box.w + box.h)
  let d = around * perimeter
  if (d < box.w) return { x: box.x + d, y: box.y - offset }
  d -= box.w
  if (d < box.h) return { x: box.x + box.w + offset, y: box.y + d }
  d -= box.h
  if (d < box.w) return { x: box.x + box.w - d, y: box.y + box.h + offset }
  d -= box.w
  return { x: box.x - offset, y: box.y + box.h - d }
}

/** Where a corner's limbs and foliage reach, in canopy units, with a little to spare. */
function limbBox(branches: MossBranch[]): Box {
  const points = branches.flatMap((b) => [...b.outline, ...b.sprays.flatMap((s) => s.lines.flat())])
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const x = Math.min(...xs) - 2
  const y = Math.min(...ys) - 2
  return { x, y, w: Math.max(...xs) + 2 - x, h: Math.max(...ys) + 2 - y }
}

/** A corner's dark limbs and their cypress foliage, which only ever rock as a whole. */
function paintLimbs(g: CanvasRenderingContext2D, branches: MossBranch[], color: string): void {
  g.fillStyle = color
  g.strokeStyle = color
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (const { outline } of branches) {
    g.beginPath()
    for (const [i, p] of outline.entries()) i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)
    g.fill()
  }
  g.lineWidth = 1.1
  g.beginPath()
  for (const branch of branches) {
    for (const { lines } of branch.sprays) {
      for (const line of lines) {
        for (const [i, p] of line.entries()) i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)
      }
    }
  }
  g.stroke()
}

function drawMoss(
  g: CanvasRenderingContext2D,
  branches: MossBranch[],
  t: number,
  /** -1 on the mirrored side, so the wind blows the same way across the screen. */
  facing: 1 | -1,
  color: string,
): void {
  g.strokeStyle = color
  g.lineCap = 'round'
  g.lineJoin = 'round'
  // Strands batched into three thicknesses: one stroke each, rather than one per strand.
  for (const [min, max, width] of [
    [0, 0.85, 0.7],
    [0.85, 1.2, 1],
    [1.2, 9, 1.4],
  ] as const) {
    g.lineWidth = width
    g.beginPath()
    for (const branch of branches) {
      for (const s of branch.strands) {
        if (s.width < min || s.width >= max) continue
        // The wind reaches tufts along the limb a moment apart, and each tuft has its own sway.
        const blow = wind(t - s.anchor.x * 0.004) * 13 * facing
        const sway = Math.sin(1.6 * t + s.anchor.x * 0.035 + s.anchor.y * 0.02) * 3.5
        const scale = s.length / 200
        for (const [i, p] of s.points.entries()) {
          const depth = Math.min(1, Math.max(0, (p.y - s.anchor.y) / s.length))
          const bend = (blow + sway * (0.6 + depth)) * depth ** 1.5 * scale
          const x = p.x + bend
          const y = p.y - Math.abs(bend) * 0.12 * depth
          i ? g.lineTo(x, y) : g.moveTo(x, y)
        }
      }
    }
    g.stroke()
  }
}

/** The drawing, once started. */
export interface Wilds {
  stop: () => void
  /** Sets a lantern flaring if one hangs near (x, y) on screen, and says whether one did. */
  poke: (x: number, y: number) => boolean
}

/**
 * Starts drawing; returns the means to stop it and to touch its lanterns. `mist` takes the fog
 * and `back` the moss, `front` the fireflies. `around` finds the hut on screen, so the fireflies
 * can gather round it. With `still` (reduced motion), it draws one quiet frame instead.
 */
export function startWilds(
  mist: HTMLCanvasElement,
  back: HTMLCanvasElement,
  front: HTMLCanvasElement,
  around: () => DOMRect | null,
  still: boolean,
): Wilds {
  const mg = mist.getContext('2d')
  const bg = back.getContext('2d')
  const fg = front.getContext('2d')
  if (!mg || !bg || !fg) return { stop: () => {}, poke: () => false }
  const fog = sprite(
    256,
    [
      [0, `rgba(${FOG_RGB},1)`],
      [0.55, `rgba(${FOG_RGB},0.45)`],
      [1, `rgba(${FOG_RGB},0)`],
    ],
    0.5,
  )
  const glow = sprite(64, [
    [0, 'rgba(255,240,190,1)'],
    [0.12, 'rgba(255,214,130,0.95)'],
    [0.4, 'rgba(242,165,65,0.32)'],
    [1, 'rgba(242,165,65,0)'],
  ])
  // A lantern's light round it: bright close in, and a wide faint warmth.
  const halo = sprite(160, [
    [0, 'rgba(242,165,65,0.75)'],
    [0.12, 'rgba(242,165,65,0.5)'],
    [0.25, 'rgba(232,137,58,0.3)'],
    [0.5, 'rgba(232,137,58,0.13)'],
    [1, 'rgba(232,137,58,0)'],
  ])
  const body = lanternBody()
  const hung = [spots(LEFT_LANTERNS), spots(RIGHT_LANTERNS)]

  let w = 0
  let h = 0
  let dpr = 1
  /** Canopy units to screen pixels. */
  let scale = 1
  /**
   * When the canopy was last drawn. It sways slowly, so it's redrawn at most 30 times a second,
   * whatever the screen's rate: its moss is most of the bayou's drawing, and this halves it with
   * no visible difference.
   */
  let canopyAt = Number.NEGATIVE_INFINITY
  /**
   * Each corner's limbs and foliage, painted once per screen size at the size they're drawn and
   * stamped every frame with the corner's rocking: thousands of little strokes, re-stroked every
   * frame, cost more than everything else in the bayou together.
   */
  const limbs = [LEFT, RIGHT].map((near) => ({
    near,
    box: limbBox(near),
    canvas: document.createElement('canvas'),
  }))
  /** The hut, which the fireflies gather round. */
  const spread: Box = { x: 0, y: 0, w: 0, h: 0 }

  const measure = () => {
    const r = around()
    if (!r) return
    const target = { x: r.left, y: r.top, w: r.width, h: r.height }
    // Drawn once, a still frame jumps straight there.
    follow(spread, target, still ? 1 : 0.08)
  }
  const resize = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1)
    w = window.innerWidth
    h = window.innerHeight
    for (const c of [back, front]) {
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
    }
    mist.width = Math.ceil(w * MIST_SCALE)
    mist.height = Math.ceil(h * MIST_SCALE)
    // Resizing clears the canvas, so the canopy is drawn again on the next frame.
    canopyAt = Number.NEGATIVE_INFINITY
    scale = Math.min(w * 0.8, 620) / CANOPY_VIEW.width
    const k = scale * dpr
    for (const { near, box, canvas } of limbs) {
      canvas.width = Math.ceil(box.w * k)
      canvas.height = Math.ceil(box.h * k)
      const g = canvas.getContext('2d')
      if (!g) continue
      g.setTransform(k, 0, 0, k, -box.x * k, -box.y * k)
      paintLimbs(g, near, NEAR)
    }
    measure()
    if (still) draw(20)
  }

  const drawFlies = (g: CanvasRenderingContext2D, flies: Firefly[], t: number) => {
    g.globalCompositeOperation = 'lighter'
    for (const f of flies) {
      const home =
        f.kind === 'ring' ? aroundBox(spread, f.around, f.offset) : { x: f.x * w, y: f.y * h }
      const wander = f.wander
      const x = home.x + wander * Math.sin(t * f.speed[0] + f.phase)
      const y = home.y + wander * 0.7 * Math.cos(t * f.speed[1] + f.phase * 1.3)
      // A slow glow and fade, with a quick bright flash at the top of each glow.
      const pulse = Math.max(0, Math.sin((t / f.blink) * Math.PI * 2 + f.phase))
      const light = 0.06 + 0.94 * pulse ** 3
      const r = 9 * f.size * (0.55 + 0.45 * light)
      g.globalAlpha = light
      g.drawImage(glow, x - r, y - r, r * 2, r * 2)
    }
    g.globalAlpha = 1
    g.globalCompositeOperation = 'source-over'
  }

  // Fog banks, drifting across and wrapping round, thickening and thinning as they go.
  const drawMist = (t: number) => {
    mg.setTransform(MIST_SCALE, 0, 0, MIST_SCALE, 0, 0)
    mg.clearRect(0, 0, w, h)
    for (const b of FOG) {
      const span = 1 + b.width
      const cx = ((((b.x + b.speed * t) % span) + span) % span) - b.width / 2
      const cy = b.y + 0.012 * Math.sin(t / b.breath + b.phase)
      mg.globalAlpha = b.alpha * (0.7 + 0.3 * Math.sin((t / b.breath) * Math.PI * 2 + b.phase))
      const bw = b.width * w
      const bh = b.height * h
      mg.drawImage(fog, cx * w - bw / 2, cy * h - bh / 2, bw, bh)
    }
    mg.globalAlpha = 1
  }

  const drawBack = (t: number) => {
    const g = bg
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)

    // The canopy in each top corner, the whole limb rocking a little as the moss blows.
    const s = scale
    for (const side of [1, -1] as const) {
      const near = side === 1 ? LEFT : RIGHT
      const cached = limbs[side === 1 ? 0 : 1]
      const rock = 0.012 * Math.sin(0.4 * t + (side === 1 ? 0 : 2)) + 0.004 * wind(t)
      const cos = Math.cos(rock * side)
      const sin = Math.sin(rock * side)
      const x0 = side === 1 ? 0 : w
      g.setTransform(
        dpr * s * side * cos,
        dpr * s * sin,
        -dpr * s * side * sin,
        dpr * s * cos,
        dpr * x0,
        0,
      )
      g.globalAlpha = 1
      if (cached) {
        const { canvas, box } = cached
        g.drawImage(canvas, box.x, box.y, box.w, box.h)
      }
      drawMoss(g, near, t, side, NEAR)
      const [lanterns, where] = side === 1 ? [LEFT_LANTERNS, hung[0]] : [RIGHT_LANTERNS, hung[1]]
      drawLanterns(g, lanterns, where ?? [], t, (x, y) => ({
        x: x0 + s * side * (cos * x - sin * y),
        y: s * (sin * x + cos * y),
      }))
    }
  }

  /**
   * Lanterns on their limbs, `at` taking where each is tied (canopy units) to the screen, so they
   * ride the limb as it rocks. Each hangs straight down and swings on its cord, swung further
   * when the wind gusts, and flickers, and flares up a moment when it's touched or the wave
   * reaches it. Where each is drawn goes in `where`, for `poke` to find.
   */
  const drawLanterns = (
    g: CanvasRenderingContext2D,
    hung: Lantern[],
    where: Spot[],
    t: number,
    at: (x: number, y: number) => { x: number; y: number },
  ) => {
    g.fillStyle = CORD
    // Smaller trees on a narrow screen crowd their lanterns together, so their light is smaller too.
    const r = 80 * Math.min(1, scale)
    for (const [i, l] of hung.entries()) {
      const p = at(l.x, l.y)
      const angle = 0.07 * Math.sin((t / l.swing) * Math.PI * 2 + l.phase) - 0.03 * wind(t)
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      g.setTransform(dpr * cos, dpr * sin, -dpr * sin, dpr * cos, dpr * p.x, dpr * p.y)
      const drop = l.drop * scale
      g.globalAlpha = 1
      g.fillRect(-0.5, 0, 1, drop)
      g.globalAlpha =
        0.9 +
        0.06 * Math.sin((t / 4.3) * Math.PI * 2 + l.phase) +
        0.04 * Math.sin(3.7 * t + l.phase * 2)
      g.drawImage(halo, -r, drop + 6.5 - r, r * 2, r * 2)
      g.drawImage(body, -4.5, drop, 9, 13)
      const spot = where[i]
      if (!spot) continue
      spot.x = p.x - sin * (drop + 6.5)
      spot.y = p.y + cos * (drop + 6.5)
      const wave = still
        ? 0
        : flaring(t, Math.floor(t / CYCLE) * CYCLE + SWEEP * Math.min(1, Math.max(0, spot.x / w)))
      const flare = Math.max(flaring(t, spot.flare), wave)
      if (flare > 0) {
        // Its light swells and its flame burns white-hot, then both die back.
        const big = r * (1 + flare)
        g.globalCompositeOperation = 'lighter'
        g.globalAlpha = flare
        g.drawImage(halo, -big, drop + 6.5 - big, big * 2, big * 2)
        g.drawImage(glow, -22, drop + 6.5 - 22, 44, 44)
        g.globalCompositeOperation = 'source-over'
      }
    }
    g.globalAlpha = 1
  }

  const drawFront = (t: number) => {
    fg.setTransform(dpr, 0, 0, dpr, 0, 0)
    fg.clearRect(0, 0, w, h)
    drawFlies(fg, FLIES, t)
  }

  const draw = (t: number) => {
    // The hut moves with the screen's size, so it's found again every frame (one rect).
    measure()
    drawMist(t)
    if (t - canopyAt >= CANOPY_STEP) {
      canopyAt = t
      drawBack(t)
    }
    drawFront(t)
  }

  let id = 0
  const loop = (now: number) => {
    draw(now / 1000)
    id = frame(loop)
  }

  resize()
  window.addEventListener('resize', resize)
  if (!still) id = frame(loop)
  // Drawn once, a lantern can't flare.
  const all = still ? [] : hung.flat()
  return {
    stop: () => {
      cancelFrame(id)
      window.removeEventListener('resize', resize)
    },
    poke: (x, y) => {
      let near: Spot | undefined
      let best = REACH
      for (const spot of all) {
        const d = Math.hypot(spot.x - x, spot.y - y)
        if (d < best) [near, best] = [spot, d]
      }
      if (near) near.flare = performance.now() / 1000
      return Boolean(near)
    },
  }
}
