/*
 * The bayou's shapes, generated once from a seed so the scene is the same on every visit:
 * Spanish moss hanging from cypress limbs, the lanterns strung along them, fog banks, and the
 * fireflies. Pure data; wilds.ts
 * animates and draws it, Bayou.tsx draws the static parts.
 */
import { createRng, type Rng } from './rng'

export interface Point {
  x: number
  y: number
}

/** One hanging strand: points from its anchor down, so wind can bend it more toward the tip. */
export interface Strand {
  points: Point[]
  width: number
  /** Where its tuft hangs from; strands of one tuft sway together. */
  anchor: Point
  length: number
}

/** A point on a spray, with how far out along it it is (0 at the limb, 1 at the tip). */
export interface SprayPoint extends Point {
  out: number
}

/**
 * A spray of bald cypress foliage: a slender branchlet off the limb, feathered with short flat
 * needles in two rows. `lines` are the branchlet and each needle, every one drawn as a line.
 */
export interface Spray {
  anchor: Point
  lines: SprayPoint[][]
}

export interface MossBranch {
  /** The limb's middle line: from the trunk, the point it bows toward, and the tip. */
  spine: [Point, Point, Point]
  /** A closed outline: thick at the trunk, thin at the tip. */
  outline: Point[]
  strands: Strand[]
  sprays: Spray[]
}

/** The canopy is drawn for the top-left corner in this box; the right side is a mirror. */
export const CANOPY_VIEW = { width: 500, height: 360 } as const

function onCurve(a: Point, c: Point, b: Point, t: number): Point {
  const u = 1 - t
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  }
}

/** The outline of a curved limb, `base` wide at the trunk and tapering to `tip`. */
function taper(from: Point, control: Point, to: Point, base: number, tip: number): Point[] {
  const top: Point[] = []
  const bottom: Point[] = []
  const steps = 16
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const p = onCurve(from, control, to, t)
    const q = onCurve(from, control, to, Math.min(1, t + 0.01))
    const r = onCurve(from, control, to, Math.max(0, t - 0.01))
    const len = Math.hypot(q.x - r.x, q.y - r.y) || 1
    const half = (base + (tip - base) * t) / 2
    const nx = (-(q.y - r.y) / len) * half
    const ny = ((q.x - r.x) / len) * half
    top.push({ x: p.x + nx, y: p.y + ny })
    bottom.push({ x: p.x - nx, y: p.y - ny })
  }
  return [...top, ...bottom.reverse()]
}

/**
 * A tuft of moss: a few kinked strands from around one point on the limb, tapering together
 * toward the bottom the way Spanish moss hangs.
 */
function tuft(rng: Rng, at: Point, length: number): Strand[] {
  const strands: Strand[] = []
  const count = 4 + rng.int(0, 6)
  const tip = { x: at.x + (rng.float() - 0.5) * length * 0.25, y: at.y + length }
  for (let i = 0; i < count; i++) {
    const start = { x: at.x + (rng.float() - 0.5) * 16, y: at.y + rng.float() * 4 }
    const reach = 0.55 + rng.float() * 0.45
    const points = [start]
    const segments = 5 + rng.int(0, 2)
    for (let k = 1; k <= segments; k++) {
      const t = (k / segments) * reach
      points.push({
        x: start.x + (tip.x - start.x) * t + (rng.float() - 0.5) * 6,
        y: start.y + (tip.y - start.y) * t,
      })
    }
    strands.push({ points, width: 0.5 + rng.float() * 1.1, anchor: at, length })
  }
  return strands
}

/**
 * A spray of cypress foliage leaving the limb at `at`, heading along `heading` (radians): a
 * branchlet curling a little, with needles in two rows, longest in the middle of the spray.
 */
function spray(rng: Rng, at: Point, heading: number, length: number): Spray {
  const steps = 10 + rng.int(0, 3)
  const curl = (rng.float() - 0.5) * 0.8
  const stem: SprayPoint[] = [{ ...at, out: 0 }]
  const lines: SprayPoint[][] = [stem]
  let angle = heading
  let p = at
  for (let k = 1; k <= steps; k++) {
    angle += curl / steps
    p = { x: p.x + (Math.cos(angle) * length) / steps, y: p.y + (Math.sin(angle) * length) / steps }
    const out = k / steps
    stem.push({ ...p, out })
    if (k < 2) continue
    const needle = (3 + rng.float() * 2.5) * (1.2 - Math.abs(out - 0.55))
    for (const side of [-1, 1]) {
      const a = angle + side * (0.9 + rng.float() * 0.3)
      lines.push([
        { ...p, out },
        { x: p.x + Math.cos(a) * needle, y: p.y + Math.sin(a) * needle, out },
      ])
    }
  }
  return { anchor: at, lines }
}

/** One limb: from the trunk to its tip, bowed by `sag`, `base` thick where it leaves the trunk. */
interface Limb {
  from: Point
  to: Point
  sag: number
  base: number
  /** Clumps of moss, hanging up to `reach`. */
  tufts: number
  reach: number
  /** Sprays of cypress foliage. */
  sprays: number
}

/**
 * One limb reaching out from the trunk, with clumps of moss and sprays of foliage along it. Most
 * clumps are short and a few hang long, as it grows; the sprays mostly droop, a few reach up.
 */
export function mossBranch(rng: Rng, limb: Limb): MossBranch {
  const { from, to, sag, base, tufts, reach } = limb
  const control = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 + sag }
  const strands: Strand[] = []
  for (let i = 0; i < tufts; i++) {
    const at = onCurve(from, control, to, 0.1 + rng.float() * 0.88)
    strands.push(...tuft(rng, at, reach * (0.25 + rng.float() ** 1.8 * 0.75)))
  }
  const sprays: Spray[] = []
  for (let i = 0; i < limb.sprays; i++) {
    const t = 0.2 + rng.float() * 0.8
    const at = onCurve(from, control, to, t)
    const ahead = onCurve(from, control, to, Math.min(1, t + 0.02))
    const along = Math.atan2(ahead.y - at.y, ahead.x - at.x)
    const up = rng.chance(0.3)
    const heading = along + (up ? -1 : 1) * (0.45 + rng.float() * 0.7)
    sprays.push(spray(rng, at, heading, 20 + rng.float() * 26))
  }
  return {
    spine: [from, control, to],
    outline: taper(from, control, to, base, base * 0.15),
    strands,
    sprays,
  }
}

/**
 * The near canopy for one corner: four dark limbs that rise from the trunk and droop toward their
 * tips, hung with moss and feathered with cypress foliage. Each corner's limbs sit a little
 * differently, so the two sides don't mirror each other exactly.
 */
export function canopy(seed: number): MossBranch[] {
  const rng = createRng(seed)
  // A fainter layer of moss once hung behind these limbs. It's no longer drawn (too faint to be
  // worth its cost every frame), but its draws are still taken so the limbs keep their shapes.
  mossBranch(rng, {
    from: { x: 0, y: 2 },
    to: { x: 480, y: 6 },
    sag: 0,
    base: 0,
    tufts: 26,
    reach: 160,
    sprays: 0,
  })
  mossBranch(rng, {
    from: { x: 120, y: 26 },
    to: { x: 500, y: 34 },
    sag: 8,
    base: 0,
    tufts: 14,
    reach: 110,
    sprays: 0,
  })
  const near = (y: number, tip: number, sag: number, base: number, tufts: number, reach: number) =>
    mossBranch(rng, {
      from: { x: 0, y: y + (rng.float() - 0.5) * 16 },
      to: { x: tip + (rng.float() - 0.5) * 40, y: y - 14 + (rng.float() - 0.5) * 60 },
      sag,
      base,
      tufts,
      reach,
      sprays: Math.round(tip / 20),
    })
  return [
    near(52, 470, -64, 30, 24, 210),
    near(122, 380, -52, 24, 18, 180),
    near(186, 280, -44, 20, 14, 150),
    near(244, 170, -28, 16, 10, 88),
  ]
}

/** A lantern hung from a limb on a cord, tied on at `x`, `y` (canopy units). */
export interface Lantern extends Point {
  /** How long its cord is, in canopy units. */
  drop: number
  /** Seconds per swing there and back, and where in it it starts. */
  swing: number
  phase: number
}

/**
 * Lanterns strung along each limb, about one for every 150 units it reaches out (at least one),
 * spaced out from a little way from the trunk to near the tip so no two hang close together. A
 * seed of their own, so the limbs keep their shapes.
 */
export function lanterns(seed: number, branches: MossBranch[]): Lantern[] {
  const rng = createRng(seed)
  return branches.flatMap(({ spine: [from, control, to] }) => {
    const count = Math.max(1, Math.round((to.x - from.x) / 150))
    return Array.from({ length: count }, (_, i) => ({
      ...onCurve(from, control, to, 0.3 + ((i + 0.25 + rng.float() * 0.5) / count) * 0.62),
      drop: 20 + rng.float() * 40,
      swing: 9 + rng.float() * 4,
      phase: rng.float() * Math.PI * 2,
    }))
  })
}

export interface FogBank {
  /** Fractions of the screen. */
  x: number
  y: number
  width: number
  height: number
  /** Screen widths per second; negative drifts left. */
  speed: number
  alpha: number
  /** Seconds per breath of thickening and thinning. */
  breath: number
  phase: number
}

/** Fog banks: big slow ones over the whole scene, and low faster wisps over the water. */
export function fogBanks(seed: number): FogBank[] {
  const rng = createRng(seed)
  const bank = (low: boolean): FogBank => ({
    x: rng.float(),
    y: low ? 0.7 + rng.float() * 0.16 : 0.05 + rng.float() * 0.6,
    width: low ? 0.6 + rng.float() * 0.6 : 0.9 + rng.float() * 0.9,
    height: low ? 0.06 + rng.float() * 0.06 : 0.18 + rng.float() * 0.2,
    speed:
      (rng.chance(0.5) ? 1 : -1) *
      (low ? 0.012 + rng.float() * 0.012 : 0.004 + rng.float() * 0.006),
    alpha: low ? 0.3 + rng.float() * 0.25 : 0.16 + rng.float() * 0.18,
    breath: 8 + rng.float() * 10,
    phase: rng.float() * Math.PI * 2,
  })
  return [
    ...Array.from({ length: 7 }, () => bank(false)),
    ...Array.from({ length: 6 }, () => bank(true)),
  ]
}

export interface Firefly {
  /**
   * `ring`: hovers round the hut, at `around` (0–1 clockwise from its top-left corner) and
   * `offset` px outside its edge (negative is just inside it). `free`: anywhere, at
   * `x`, `y` fractions of the screen.
   */
  kind: 'ring' | 'free'
  around: number
  offset: number
  x: number
  y: number
  /** px it wanders from home. */
  wander: number
  /** Radians per second, two of them, for a looping path that doesn't repeat. */
  speed: [number, number]
  phase: number
  /** Seconds between glows. */
  blink: number
  size: number
}

/** Fireflies, `ringShare` of them drawn to the hut. */
export function fireflies(seed: number, count: number, ringShare: number): Firefly[] {
  const rng = createRng(seed)
  return Array.from({ length: count }, () => ({
    kind: rng.chance(ringShare) ? 'ring' : 'free',
    around: rng.float(),
    offset: -14 + rng.float() ** 1.5 * 80,
    x: rng.float(),
    y: 0.04 + rng.float() * 0.92,
    wander: 10 + rng.float() * 34,
    speed: [0.25 + rng.float() * 0.5, 0.4 + rng.float() * 0.7],
    phase: rng.float() * Math.PI * 2,
    blink: 2.2 + rng.float() * 3.5,
    size: 0.7 + rng.float() * 0.8,
  }))
}
