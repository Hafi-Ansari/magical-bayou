/*
 * Lantern light broken up on the water (Bayou.tsx, `ripples`): short amber streaks, each
 * shivering on its own, stretching and brightening and shrinking back. Fifty of them as elements
 * each cost a step every tick (pace.ts), so they're drawn on one canvas in the water instead, from
 * the canvases' loop (wilds.ts). Each looks as its element did, a bar in a soft glow like a
 * box-shadow: painted once per water size and stamped every tick, stretched and faded as the
 * element's CSS animation moved it. At most 2 canvas px a CSS px, as wilds.ts draws.
 */

/** A streak: where it lies on the water, how long it is, and its shiver's timing, in seconds. */
export interface Streak {
  /** Across the water in percent, plus `dx` px. */
  x: number
  dx: number
  /** Down the water in percent. */
  y: number
  width: number
  duration: number
  /** Negative: how far into its shiver it starts. */
  delay: number
  /** The wide faint ones under the glow in the middle, rather than under a lantern. */
  glow: boolean
}

/** `cubic-bezier(x1, 0, x2, 1)` for 0 ≤ x ≤ 1, as CSS has it. */
function bezier(x1: number, x2: number): (x: number) => number {
  const at = (u: number, a: number, b: number) =>
    3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3
  return (x) => {
    let lo = 0
    let hi = 1
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2
      if (at(mid, x1, x2) < x) lo = mid
      else hi = mid
    }
    return at((lo + hi) / 2, 0, 1)
  }
}
const easeInOut = bezier(0.42, 0.58)

/**
 * How far through its shiver a streak is at `t` seconds, from 0 (short and dim) to 1 (long and
 * bright): `ease-in-out infinite alternate`, there and back over each `duration`.
 */
export function shiver(s: Pick<Streak, 'duration' | 'delay'>, t: number): number {
  const turns = (t - s.delay) / s.duration
  const n = Math.floor(turns)
  const f = turns - n
  return easeInOut(n % 2 ? 1 - f : f)
}

/**
 * Each kind of streak: its bar's height and color, and its glow's blur and color (theme.css's
 * `--amber` and `--peach`).
 */
const LOOK = {
  lantern: { height: 2, fill: 'rgba(242,165,65,0.85)', blur: 6, shadow: 'rgba(242,165,65,0.6)' },
  glow: { height: 1.5, fill: 'rgba(233,180,138,0.4)', blur: 8, shadow: 'rgba(233,180,138,0.25)' },
}

/**
 * A streak as it's drawn, in the canvas's px: its bar where the element's box was, snapped to
 * whole px as a browser snaps a box, and where its bar and glow are painted on the sheet.
 */
interface Laid {
  left: number
  top: number
  width: number
  height: number
  /** Room for its glow on every side of the bar. */
  margin: number
  /** Its row on the sheet: the bar lies `margin` in from the row's top and left. */
  row: number
}

/**
 * Draws `streaks` on `canvas`, which fills the water: the returned `draw(t)` draws them at `t`
 * seconds. With `still` (reduced motion), they lie still at full length, as the elements did.
 */
export function startStreaks(
  canvas: HTMLCanvasElement,
  streaks: Streak[],
  still: boolean,
): (t: number) => void {
  const g = canvas.getContext('2d')
  if (!g) return () => {}
  /** Every streak painted once, a row each. */
  const sheet = document.createElement('canvas')
  let laid: Laid[] = []
  let seen = ''

  const paint = (r: DOMRect, dpr: number) => {
    // Snapped to whole px on the screen, as a box is, so every streak lies as its element did.
    const snap = (x: number) => Math.round(x * dpr)
    const [ox, oy] = [snap(r.left), snap(r.top)]
    canvas.width = snap(r.right) - ox
    canvas.height = snap(r.bottom) - oy
    let row = 0
    laid = streaks.map((s) => {
      const look = LOOK[s.glow ? 'glow' : 'lantern']
      const x = r.left + (s.x / 100) * r.width + s.dx
      const y = r.top + (s.y / 100) * r.height
      const left = snap(x) - ox
      const top = snap(y) - oy
      const margin = Math.ceil(look.blur * 1.5 * dpr)
      const at = row
      // Moving, an element was laid out in a layer of its own, from a whole px, so a 1.5 px bar
      // was a 2 px one; still, it was snapped where it lay.
      const height = still ? snap(y + look.height) - oy - top : snap(look.height)
      row += height + 2 * margin
      return { left, top, width: snap(x + s.width) - ox - left, height, margin, row: at }
    })
    sheet.width = Math.max(...laid.map((l) => l.width + 2 * l.margin))
    sheet.height = row
    const p = sheet.getContext('2d')
    if (!p) return
    for (const [i, s] of streaks.entries()) {
      const look = LOOK[s.glow ? 'glow' : 'lantern']
      const l = laid[i]
      if (!l) continue
      const bar = () => {
        p.beginPath()
        p.roundRect(l.margin, l.row + l.margin, l.width, l.height, 2 * dpr)
      }
      // Its glow alone, cast from a bar drawn off the sheet, and none under the bar itself, as
      // with a box-shadow.
      p.save()
      p.shadowColor = look.shadow
      p.shadowBlur = look.blur * dpr
      p.shadowOffsetX = sheet.width
      p.translate(-sheet.width, 0)
      bar()
      p.fill()
      p.restore()
      p.globalCompositeOperation = 'destination-out'
      bar()
      p.fill()
      p.globalCompositeOperation = 'source-over'
      p.fillStyle = look.fill
      bar()
      p.fill()
    }
  }

  return (t) => {
    // The water's size goes with the screen's (one rect, and the hut's is read every tick too).
    const r = canvas.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const size = `${r.left} ${r.top} ${r.width} ${r.height} ${dpr}`
    if (size !== seen) {
      seen = size
      paint(r, dpr)
    }
    g.clearRect(0, 0, canvas.width, canvas.height)
    for (const [i, s] of streaks.entries()) {
      const l = laid[i]
      if (!l) continue
      // As `@keyframes ripple` moved it: from translateX(-62%) scaleX(0.45) at opacity 0.25 to
      // translateX(-38%) scaleX(1.3) at full, about the bar's middle.
      const k = still ? null : shiver(s, t)
      const shift = k === null ? 0 : (-0.62 + 0.24 * k) * l.width
      const stretch = k === null ? 1 : 0.45 + 0.85 * k
      const across = l.width + 2 * l.margin
      const tall = l.height + 2 * l.margin
      g.globalAlpha = k === null ? 1 : 0.25 + 0.75 * k
      g.drawImage(
        sheet,
        0,
        l.row,
        across,
        tall,
        l.left + l.width / 2 + shift - (across * stretch) / 2,
        l.top - l.margin,
        across * stretch,
        tall,
      )
    }
    g.globalAlpha = 1
  }
}
