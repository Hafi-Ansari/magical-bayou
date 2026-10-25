import type { CSSProperties } from 'react'

/*
 * Two cats on the hut's ridge, seen from behind, gazing up at the crescent moon hanging between
 * them: the same slight cat twice, one on the left and one on the right, their tails lying out
 * along the ridge either way. The moon behind them catches their top edges and a few
 * whiskers, and a soft pink glow pulses round them (Hut.tsx) so the eye finds them. Alive,
 * but unhurried: they breathe, their tail tips curl and flick, an ear twitches now and then, and
 * every so often the second leans its head in against the first's, which tilts to meet it.
 *
 * Drawn in its own small SVG laid over the hut's roof, so animating them repaints only this, not
 * the whole hut. Every part moves by CSS `transform` (theme.css, `.hut-cat-*`) about a pivot set
 * here, in this SVG's units: its viewBox starts at 0 0, so `transform-box: view-box` puts the
 * pivot exactly there in every browser.
 */

/** Where this drawing sits in the hut's drawing (Hut.tsx), in its units. */
export const CATS_BOX = { x: 150, y: 70, width: 120, height: 76 }

type Point = readonly [number, number]

/**
 * One cat, drawn sitting with its back to us, about 100 tall, its base's middle at 0 0 (y down),
 * its tail lying out to the left. Only absolute commands with coordinate pairs (M L Q C Z), so
 * `place` can move and scale it.
 */
const CAT = {
  /** Haunches, back and shoulder blades, wide where it sits. */
  body: 'M0 0C16 0 28 -2 29 -14C30 -24 25 -32 20.5 -39C18 -44 18 -50 16.5 -55C15 -61 10.5 -64 7 -65C2.5 -66 -2.5 -66 -7 -65C-10.5 -64 -15 -61 -16.5 -55C-18 -50 -18 -44 -20.5 -39C-25 -32 -30 -24 -29 -14C-28 -2 -16 0 0 0Z',
  /** The back of the head, widest at the cheeks, sunk a little into the shoulders. */
  head: 'M-17 -73C-17 -82 -10 -89.5 0 -89.5C10 -89.5 17 -82 17 -73C17 -66 9.5 -62 0 -62C-9.5 -62 -17 -66 -17 -73Z',
  /** The ear that twitches (the outer one), and the one that doesn't. */
  twitch: 'M-16.2 -78Q-16.6 -92 -15.5 -99Q-15 -100.5 -13.6 -99.4L-4 -88Z',
  ear: 'M16.2 -78Q16.6 -92 15.5 -99Q15 -100.5 13.6 -99.4L4 -88Z',
  /** The tail, from under the haunch along the ridge, and its tip, hooked up. */
  tail: 'M-26 -4C-38 -6 -46 -9 -52 -14',
  tip: 'M-52 -14C-57 -18 -59 -24 -57 -29C-56 -31.5 -54 -32 -53 -31',
  /** The moon's light along the top edges: shoulders, sides, head, between the ears, each ear. */
  rim: {
    body: 'M-20.5 -39C-18 -44 -18 -50 -16.5 -55C-15 -61 -10.5 -64 -7 -65C-2.5 -66 2.5 -66 7 -65C10.5 -64 15 -61 16.5 -55C18 -50 18 -44 20.5 -39',
    sides: 'M-20.5 -39C-25 -32 -30 -24 -29 -14M20.5 -39C25 -32 30 -24 29 -14',
    head: 'M-17 -71C-17 -75 -16.8 -78 -16.3 -80.5M-5 -89Q0 -90 5 -89M16.3 -80.5C16.8 -78 17 -75 17 -71',
    twitch: 'M-16.3 -80.5Q-16.6 -92 -15.5 -99Q-15 -100.5 -13.6 -99.4L-5 -89',
    ear: 'M16.3 -80.5Q16.6 -92 15.5 -99Q15 -100.5 13.6 -99.4L5 -89',
  },
  whiskers: 'M-17 -72L-27 -74.5M-17 -70L-26.5 -69.5M17 -72L27 -74.5M17 -70L26.5 -69.5',
  /** What each part turns about: the tail's root and joint, the neck, the twitching ear. */
  root: [-26, -4] as Point,
  joint: [-52, -14] as Point,
  neck: [0, -63] as Point,
  ears: [-10, -88] as Point,
}

/** Where each sits: side by side in the ridge's dip, the same size, the moon between them. */
const LEFT = { x: 198, y: 136, s: 0.51, flip: false }
const RIGHT = { x: 226, y: 136, s: 0.51, flip: true }

/** The middle of the glow round them, in the hut's units. */
export const CATS_GLOW = { x: 212, y: 112 }

type At = typeof LEFT

const f = (v: number) => v.toFixed(2)

/** A point of a cat, moved to where it sits (the right one mirrored, its tail out to the right). */
function point([x, y]: Point, at: At): Point {
  return [at.x + (at.flip ? -x : x) * at.s - CATS_BOX.x, at.y + y * at.s - CATS_BOX.y]
}

/** A cat's path, moved to where it sits: its numbers alternate x, y. */
function place(d: string, at: At): string {
  let i = 0
  return d.replace(/-?\d*\.?\d+/g, (v) => {
    const [x, y] = point([Number(v), Number(v)], at)
    return f(i++ % 2 ? y : x)
  })
}

const pivot = (p: Point, at: At): CSSProperties => {
  const [x, y] = point(p, at)
  return { transformOrigin: `${f(x)}px ${f(y)}px` }
}

function Cat({ who, at }: { who: 'one' | 'two'; at: At }) {
  const base = pivot([0, 0], at)
  return (
    <g className={`hut-cat hut-cat-${who}`}>
      <g className="hut-cat-tail" style={pivot(CAT.root, at)}>
        <path
          className="hut-cat-tail-line"
          d={place(CAT.tail, at)}
          strokeWidth={f(6 * at.s * 1.1)}
        />
        <g className="hut-cat-tip" style={pivot(CAT.joint, at)}>
          <path
            className="hut-cat-tail-line"
            d={place(CAT.tip, at)}
            strokeWidth={f(5.4 * at.s * 1.1)}
          />
        </g>
      </g>
      <g className="hut-cat-breath" style={base}>
        <g className="hut-cat-lean" style={base}>
          <path d={place(CAT.body, at)} />
          <path className="hut-cat-rim" d={place(CAT.rim.body, at)} />
          <path className="hut-cat-rim hut-cat-rim-faint" d={place(CAT.rim.sides, at)} />
          <g className="hut-cat-head" style={pivot(CAT.neck, at)}>
            <path d={place(CAT.head, at)} />
            <path d={place(CAT.ear, at)} />
            <path className="hut-cat-rim" d={place(`${CAT.rim.head}${CAT.rim.ear}`, at)} />
            <g className="hut-cat-ear" style={pivot(CAT.ears, at)}>
              <path d={place(CAT.twitch, at)} />
              <path className="hut-cat-rim" d={place(CAT.rim.twitch, at)} />
            </g>
            <path className="hut-cat-whiskers" d={place(CAT.whiskers, at)} />
          </g>
        </g>
      </g>
    </g>
  )
}

/** The two cats on the ridge, placed over the hut by `style` (in Hut.tsx's units). */
export function HutCats({ style }: { style: CSSProperties }) {
  return (
    <svg
      className="hut-cats"
      viewBox={`0 0 ${CATS_BOX.width} ${CATS_BOX.height}`}
      style={style}
      aria-hidden="true"
    >
      <Cat who="one" at={LEFT} />
      <Cat who="two" at={RIGHT} />
    </svg>
  )
}
