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
 *
 * As a wallpaper it's mostly left alone, under windows or with the pointer on another screen, and
 * then it's drawn slower: `?idle` times a second (IDLE_FPS unless the URL says otherwise) once no
 * pointer has moved over it for IDLE_AFTER, back to `?fps` at the first move or touch. Every
 * step goes by the time that passed, so nothing moves slower, only in fewer steps. On the same
 * GPU, left alone it draws about half what it does at 30 (0.8 W over idle, against 1.6 W).
 * `?idle=0` keeps it at `?fps`.
 */

const DEFAULT_FPS = 30
const IDLE_FPS = 15
/** How long without a pointer moving over the bayou before it's drawn at the idle rate, in ms. */
const IDLE_AFTER = 10_000
const query = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search)
/** Milliseconds a step, from a rate in the URL or its default: 0 for no cap. */
function stepOf(name: string, fallback: number): number {
  const asked = query?.get(name) ?? null
  const fps = asked === null ? fallback : Number(asked)
  return Number.isFinite(fps) && fps > 0 ? 1000 / fps : 0
}
const STEP_MS = stepOf('fps', DEFAULT_FPS)
/** Never quicker than the awake rate; with no idle rate, the awake one. */
const IDLE_MS = Math.max(STEP_MS, stepOf('idle', IDLE_FPS))

/** Draws waiting for the next tick, by id. */
let waiting = new Map<number, FrameRequestCallback>()
let nextId = 1
/**
 * The animations held, to be stepped (only those, not any paused by their own CSS), and when each
 * ends, read once as it's held: Infinity for one that never does, which is most of them.
 */
const held = new WeakMap<Animation, number>()
let last = 0

function tick() {
  const now = performance.now()
  const dt = now - last
  last = now
  for (const a of document.getAnimations()) {
    if (a.playState === 'running') {
      a.pause()
      const end = a.effect?.getComputedTiming().endTime
      held.set(a, typeof end === 'number' ? end : Number.POSITIVE_INFINITY)
      continue
    }
    const end = held.get(a)
    if (end === undefined || a.playState !== 'paused') continue
    const at = Number(a.currentTime ?? 0) + dt
    // A one-off lets go at its end, so it finishes as it would have (its fill, its `finished`).
    if (at >= end) a.finish()
    else a.currentTime = at
  }
  const due = waiting
  waiting = new Map()
  for (const draw of due.values()) draw(now)
}

/** When a pointer last moved over the bayou or touched it. */
let stirred = 0
let timer = 0
/** The step the timer runs at now. */
let pace = 0

/**
 * Ticks every `step` ms. An interval, not a timeout set again after each tick: a timeout for the
 * rest of a step asks for less than 32 ms, and on Windows that cost the GPU process about a fifth
 * more CPU, as the browser woke more finely for it.
 */
function run(step: number) {
  window.clearInterval(timer)
  pace = step
  timer = window.setInterval(() => {
    tick()
    if (pace !== IDLE_MS && performance.now() - stirred > IDLE_AFTER) run(IDLE_MS)
  }, step)
}

/** A pointer moving: back to the full rate, at once if it was drawing at the idle one. */
function stir() {
  stirred = performance.now()
  if (pace !== STEP_MS) run(STEP_MS)
}

if (STEP_MS) {
  last = performance.now()
  stirred = last
  run(STEP_MS)
  window.addEventListener('pointermove', stir, { passive: true })
  window.addEventListener('pointerdown', stir, { passive: true })
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
