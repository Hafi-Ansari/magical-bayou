import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
import { cue } from '../sound/cues'
import { reducedMotion, useBursts } from './bursts'
import { Hut } from './Hut'
import { createRng } from './rng'
import { CYCLE, SWEEP, startWilds, type Wilds } from './wilds'

/*
 * The bayou after dusk. The calm parts are CSS: the sky and its glow, the near cypress trunks,
 * the water with its moving waves and broken lantern light, the witch's hut out on the water
 * (Hut.tsx), and the lanterns. The living parts (fog, moss in the wind, fireflies) are drawn by
 * wilds.ts on canvases, the fog and moss behind the lanterns and the fireflies in front of it all.
 * Everything is generated from fixed seeds, so it's the same on every visit.
 *
 * Once it's awake (`awake`, App.tsx), it can be played in: the hut's parts can be touched
 * (Hut.tsx), a lantern touched flares up, the water ripples where it's touched, and a shooting
 * star crosses the sky where that's touched. The lanterns flare in a wave every 10 s (wilds.ts).
 */

/** Where the lanterns hang, in percent of the screen width. */
const LANTERNS = [
  { x: 13, drop: 11 },
  { x: 86, drop: 8 },
]

interface Ripple {
  left: string
  top: string
  width: number
  duration: number
  delay: number
  glow: boolean
}

/**
 * Light broken up on the water: short streaks under each lantern, and wide faint ones under the
 * glow in the middle, each shivering on its own.
 */
function ripples(): Ripple[] {
  const rng = createRng(29)
  const out: Ripple[] = []
  const streak = (x: number, spread: number, wide: number, glow: boolean) => {
    const depth = rng.float()
    out.push({
      left: `calc(${x}% + ${((rng.float() - 0.5) * spread * (0.4 + depth)).toFixed(0)}px)`,
      top: `${(4 + depth * 88).toFixed(1)}%`,
      width: Math.round((6 + rng.float() * wide) * (0.5 + depth)),
      duration: 1.4 + rng.float() * 2.4,
      delay: -rng.float() * 4,
      glow,
    })
  }
  for (const { x } of LANTERNS) for (let i = 0; i < 14; i++) streak(x, 26, 26, false)
  for (let i = 0; i < 22; i++) streak(50, 220, 60, true)
  return out
}
const RIPPLES = ripples()

/**
 * A cypress trunk at the screen's edge, its buttressed base standing in the water. Static. Its
 * outer side runs off the screen, so the canopy's limbs (wilds.ts, drawn from the edge) grow out
 * of it rather than poking out past it.
 */
function Trunk({ side }: { side: 'left' | 'right' }) {
  return (
    <svg
      aria-hidden="true"
      className={`trunk trunk-${side}`}
      viewBox="0 0 100 600"
      preserveAspectRatio="none"
    >
      <path d="M18 0C21 180 17 380 13 500C10 548 4 580 0 600H100C89 582 76 552 72 506C65 388 63 190 66 0Z" />
    </svg>
  )
}

/** How near a touch must be to a lantern hung in CSS to set it flaring, in px. */
const REACH = 26
/** Where the specks of dust a shooting star leaves lie along its path, from 0 to 1. */
const DUST = [0.2, 0.36, 0.52, 0.68, 0.84]

/** The scene. `awake`, it can be played in. */
export function Bayou({ awake }: { awake: boolean }) {
  const mist = useRef<HTMLCanvasElement>(null)
  const back = useRef<HTMLCanvasElement>(null)
  const front = useRef<HTMLCanvasElement>(null)
  const wilds = useRef<Wilds | null>(null)
  const water = useRef<HTMLDivElement>(null)
  const hung = useRef<(HTMLDivElement | null)[]>([])
  /** How often each lantern hung in CSS has flared: a fresh key, so it flares from the start. */
  const [flares, setFlares] = useState(() => LANTERNS.map(() => 0))
  const flare = useCallback(
    (which: number) => setFlares((all) => all.map((n, i) => (i === which ? n + 1 : n))),
    [],
  )
  const [rings, ripple] = useBursts<{ x: number; y: number; width: number }>(2400, 6)
  const [stars, shoot] = useBursts<{ x: number; y: number; angle: number; length: number }>(2400, 3)
  // The CSS lanterns' part in the lanterns' wave (wilds.ts): where its cycle is as they mount,
  // which is when their animation starts.
  const [waveAt] = useState(() => -((performance.now() / 1000) % CYCLE))

  useEffect(() => {
    if (!awake || reducedMotion()) return
    const touch = (event: PointerEvent) => {
      if (!event.isPrimary || event.button > 0) return
      // The hut's parts are buttons of their own (Hut.tsx), and the sound menu isn't the bayou.
      if (event.target instanceof Element && event.target.closest('button, .sound-menu')) return
      const { clientX: x, clientY: y } = event
      // Where across the screen, for the side its sound comes from (touches.ts).
      const across = x / window.innerWidth
      if (wilds.current?.poke(x, y)) {
        cue('touch', { part: 'lantern', x: across })
        return
      }
      const lantern = hung.current.findIndex((el) => {
        const r = el?.getBoundingClientRect()
        return r && Math.hypot(r.left + r.width / 2 - x, r.bottom + 6.5 - y) < REACH
      })
      if (lantern >= 0) {
        flare(lantern)
        cue('touch', { part: 'lantern', x: across })
        return
      }
      // The hut and its hill, but for the sky over it, aren't for stars or ripples.
      const hut = document.querySelector('.hut')?.getBoundingClientRect()
      const house = document.querySelector('.hut-heart')?.getBoundingClientRect()
      if (hut && house && x > hut.left && x < hut.right && y > house.top && y < hut.bottom) return
      const sea = water.current?.getBoundingClientRect()
      if (sea && y > sea.top) {
        // Further off, toward the far bank, a ripple looks smaller.
        const near = Math.min(1, (y - sea.top) / sea.height)
        ripple({ x, y, width: Math.round(40 + 120 * near) })
        cue('touch', { part: 'water', x: across, near })
      } else {
        // Falling either way, at its own slant and length.
        const slant = 14 + Math.random() * 20
        shoot({
          x,
          y,
          angle: Math.random() < 0.5 ? slant : 180 - slant,
          length: Math.round(Math.min(150 + Math.random() * 110, window.innerWidth * 0.7)),
        })
        cue('touch', { part: 'sky', x: across })
      }
    }
    window.addEventListener('pointerdown', touch)
    return () => window.removeEventListener('pointerdown', touch)
  }, [awake, flare, ripple, shoot])

  useEffect(() => {
    if (!mist.current || !back.current || !front.current) return
    const drawn = startWilds(
      mist.current,
      back.current,
      front.current,
      // The fireflies gather round the house and its roof.
      () => document.querySelector('.hut-heart')?.getBoundingClientRect() ?? null,
      reducedMotion(),
    )
    wilds.current = drawn
    return () => {
      drawn.stop()
      wilds.current = null
    }
  }, [])

  return (
    <>
      <div className="bayou" aria-hidden={!awake} data-awake={awake ? '' : undefined}>
        <div className="sky" />
        <div className="glow" />
        {/* Shooting stars set going by a touch, behind the hut and the trees. */}
        <div className="bayou-taps">
          {stars.map(({ id, at }) => (
            <span
              key={id}
              className="shooting-star"
              style={
                {
                  left: at.x,
                  top: at.y,
                  '--angle': `${at.angle.toFixed(1)}deg`,
                  '--len': `${at.length}px`,
                } as CSSProperties
              }
            >
              <span className="star-flight">
                <span className="star-tail" />
                <span className="star-head" />
              </span>
              {DUST.map((f) => (
                <span key={f} className="star-dust" style={{ '--f': f } as CSSProperties} />
              ))}
            </span>
          ))}
        </div>
        <div ref={water} className="water">
          <div className="waves waves-far" />
          <div className="waves waves-mid" />
          <div className="waves waves-near" />
          {RIPPLES.map((r) => (
            <span
              key={`${r.left} ${r.top}`}
              className={r.glow ? 'ripple ripple-glow' : 'ripple'}
              style={{
                left: r.left,
                top: r.top,
                width: `${r.width}px`,
                animationDuration: `${r.duration.toFixed(2)}s`,
                animationDelay: `${r.delay.toFixed(2)}s`,
              }}
            />
          ))}
        </div>
        <Hut awake={awake} />
        {/* Ripples spreading from where the water's been touched. */}
        <div className="bayou-taps">
          {rings.map(({ id, at }) => (
            <span
              key={id}
              className="tap-ripple"
              style={{ left: at.x, top: at.y, width: at.width }}
            />
          ))}
        </div>
        <canvas ref={mist} className="wilds" />
        <Trunk side="left" />
        <Trunk side="right" />
        <canvas ref={back} className="wilds" />
        {LANTERNS.map((l, i) => (
          <div
            key={l.x}
            ref={(el) => {
              hung.current[i] = el
            }}
            className="lantern"
            style={{ left: `${l.x}%`, '--drop': `${l.drop}dvh`, '--i': i } as CSSProperties}
          >
            <span
              className="lantern-wave"
              style={{ '--wave': `${(waveAt + (l.x / 100) * SWEEP).toFixed(3)}s` } as CSSProperties}
            />
            {flares[i] ? <span key={flares[i]} className="lantern-flare" /> : null}
          </div>
        ))}
        <div className="vignette" />
      </div>
      <canvas ref={front} className="glimmer" />
    </>
  )
}
