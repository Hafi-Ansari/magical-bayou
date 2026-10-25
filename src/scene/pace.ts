/*
 * How often the bayou is drawn. Left alone, a browser draws a frame on every refresh of the
 * screen while anything moves: on a 165 Hz monitor, 165 a second, each one recompositing the
 * whole bayou. As a desktop's live wallpaper, running all day, that kept a desktop GPU at a quarter
 * of its power. So the bayou is drawn at most `?fps` times a second, 30 unless the URL says
 * otherwise: the canvases' loop (wilds.ts, through `frame`) and every CSS animation are held and
 * stepped on one timer, so nothing changes, and nothing is drawn, between its ticks. The bayou
 * moves slowly, so it looks the same; measured on an RTX 4060 Ti at 1440p, its draw fell from
 * about 15 W to 2.5 W. Capping the canvases alone saves nothing while the CSS animations run free.
 * `?fps=0` lets it run at the screen's own rate.
 */

const DEFAULT_FPS = 30
const asked =
  typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('fps')
const FPS = asked === null ? DEFAULT_FPS : Number(asked)
const STEP_MS = Number.isFinite(FPS) && FPS > 0 ? 1000 / FPS : 0

/** Draws waiting for the next tick, by id. */
let waiting = new Map<number, FrameRequestCallback>()
let nextId = 1
/** The animations held, to be stepped: only those, not any paused by their own CSS. */
const held = new WeakSet<Animation>()
let last = 0

function tick() {
  const now = performance.now()
  const dt = now - last
  last = now
  for (const a of document.getAnimations()) {
    if (a.playState === 'running') {
      a.pause()
      held.add(a)
      continue
    }
    if (a.playState !== 'paused' || !held.has(a)) continue
    const at = Number(a.currentTime ?? 0) + dt
    // A one-off lets go at its end, so it finishes as it would have (its fill, its `finished`).
    const end = a.effect?.getComputedTiming().endTime
    if (typeof end === 'number' && Number.isFinite(end) && at >= end) a.finish()
    else a.currentTime = at
  }
  const due = waiting
  waiting = new Map()
  for (const draw of due.values()) draw(now)
}

if (STEP_MS) {
  last = performance.now()
  window.setInterval(tick, STEP_MS)
}

/** `requestAnimationFrame`, or with `?fps`, the next tick. */
export function frame(draw: FrameRequestCallback): number {
  if (!STEP_MS) return requestAnimationFrame(draw)
  const id = nextId++
  waiting.set(id, draw)
  return id
}

/** `cancelAnimationFrame`, or with `?fps`, a draw still waiting for the next tick. */
export function cancelFrame(id: number) {
  if (!STEP_MS) cancelAnimationFrame(id)
  else waiting.delete(id)
}
