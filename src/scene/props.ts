/**
 * Set dressing drawn by hand for the hut (Hut.tsx): path data in the drawing's units. Draw `ink`
 * in `currentColor` and `cut` (a ghost's eyes and mouth) in the color behind it.
 */

/** Unit points [x, y] to path commands, scaled by `r` around (x, y). */
function at(x: number, y: number, r: number) {
  return ([u, v]: [number, number]) => `${+(x + u * r).toFixed(2)} ${+(y + v * r).toFixed(2)}`
}

/** A four-pointed star at (x, y), `r` from its center to each point. */
export function star(x: number, y: number, r: number): string {
  const k = r / 4
  return `M${x} ${y - r} L${x + k} ${y - k} L${x + r} ${y} L${x + k} ${y + k} L${x} ${y + r} L${x - k} ${y + k} L${x - r} ${y} L${x - k} ${y - k} Z`
}

/** A crescent moon: a disc of radius `r` at (x, y), bitten from the upper right. */
export function crescent(x: number, y: number, r: number): string {
  const p = at(x, y, r)
  return `M${p([0.31, -0.95])} A${r} ${r} 0 1 0 ${p([0.98, 0.62])} A${r * 0.86} ${r * 0.86} 0 0 1 ${p([0.31, -0.95])} Z`
}

/**
 * A sheet ghost hovering with its hem at (x, y), `h` tall. `wave` raises an arm on that side.
 * Its eyes are a separate `cut`.
 */
export function ghost(
  x: number,
  y: number,
  h: number,
  wave?: 'left' | 'right',
): { ink: string; cut: string } {
  const w = h * 0.62
  const p = at(x, y, h)
  const half = w / h / 2
  const top = -1 + half
  // An arm is a little rounded nub centered at (u, v), tilted `deg` from upright.
  const arm = (u: number, v: number, deg: number, len: number) => {
    const t = (deg * Math.PI) / 180
    const [du, dv] = [(-Math.sin(t) * len) / 2, (Math.cos(t) * len) / 2]
    const [rx, ry] = [0.075 * h, (len / 2) * h]
    return `M${p([u - du, v - dv])} A${rx} ${ry} ${deg} 1 1 ${p([u + du, v + dv])} A${rx} ${ry} ${deg} 1 1 ${p([u - du, v - dv])} Z`
  }
  const armL =
    wave === 'left' ? arm(-half - 0.1, -0.78, -30, 0.36) : arm(-half - 0.06, -0.5, 45, 0.3)
  const armR =
    wave === 'right' ? arm(half + 0.1, -0.78, 30, 0.36) : arm(half + 0.06, -0.5, -45, 0.3)
  const ink =
    `M${p([-half - 0.06, 0])} Q${p([-half, -0.3])} ${p([-half, top])} A${w / 2} ${w / 2} 0 0 1 ${p([half, top])}` +
    ` Q${p([half, -0.3])} ${p([half + 0.06, 0])} Q${p([half * 0.66, -0.12])} ${p([half * 0.33, 0.02])}` +
    ` Q${p([0, -0.12])} ${p([-half * 0.33, 0.02])} Q${p([-half * 0.66, -0.12])} ${p([-half - 0.06, 0])} Z` +
    ` ${armL} ${armR}`
  const eye = (u: number) => {
    const [cx, cy] = [x + u * h, y + (top - 0.04) * h]
    const [rx, ry] = [h * 0.045, h * 0.075]
    return `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`
  }
  const mouth = (() => {
    const [cx, cy] = [x, y + (top + 0.16) * h]
    const r = h * 0.05
    return `M${cx - r} ${cy} a${r} ${r * 1.3} 0 1 0 ${2 * r} 0 a${r} ${r * 1.3} 0 1 0 ${-2 * r} 0 Z`
  })()
  return { ink, cut: `${eye(-half * 0.42)} ${eye(half * 0.42)} ${mouth}` }
}

/** A heart at (x, y), `s` across. */
export function heart(x: number, y: number, s: number): string {
  const p = at(x, y, s)
  return `M${p([0, 0.36])} C${p([-0.12, 0.26])} ${p([-0.5, 0.02])} ${p([-0.5, -0.24])} C${p([-0.5, -0.56])} ${p([-0.1, -0.62])} ${p([0, -0.3])} C${p([0.1, -0.62])} ${p([0.5, -0.56])} ${p([0.5, -0.24])} C${p([0.5, 0.02])} ${p([0.12, 0.26])} ${p([0, 0.36])} Z`
}

/**
 * The witch's cauldron, seen through the open door: its pot, its legs, and the brew bubbling over
 * its rim. Fixed shapes (the pot is 40 wide at x 112–152, its rim at y 92); move it with a
 * transform.
 */
export const CAULDRON = {
  pot: 'M112 92 H 152 Q 156 92 154 96 Q 152 116 132 116 Q 112 116 110 96 Q 108 92 112 92 Z',
  legs: 'M117 112 L 113 122 H 116 L 120 114 Z M147 112 L 151 122 H 148 L 144 114 Z',
  brew: 'M113 92 Q 118 88 122 91 Q 127 87 132 91 Q 137 87 142 91 Q 147 88 151 92 Z',
}
