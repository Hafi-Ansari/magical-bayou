/**
 * The audio underneath everything the bayou plays: the context, the mix, loading, and the rules
 * that keep it light and easy on the ear. One for the page, outside React.
 *
 * - **Layers.** Three, each switched on or off in the sound menu (`SoundMenu.tsx`) and remembered
 *   on this device: the tune, the bayou's own night sounds (crickets, frogs, owls), and the
 *   sounds of touching it. `soundscape.ts` plays the first two, `touches.ts` the third.
 * - **Loading.** Once the page has loaded and gone quiet, every file in public/audio/ is fetched
 *   and decoded, small effects first and the tune last, on an `OfflineAudioContext` (allowed
 *   before any tap), so the sound starts the instant of the first tap. With every layer off,
 *   nothing is loaded until one is switched on.
 * - **Starting.** Browsers play nothing until the page is touched, so the context is made inside
 *   the first gesture, with iOS's `playback` session so it plays through the silent switch, and
 *   fades in. `onStart` hears when.
 * - **The mix.** Everything runs into one master, then a limiter, so nothing clips. Effects run
 *   through three panned buses (left, middle, right) and a gentle compressor, at their levels
 *   from `sound.json`.
 * - **Lightness.** Effects never stack past `MAX_VOICES`, sounds of one kind close together are
 *   softened, and out of sight or with every layer off the context sleeps and every effect is
 *   skipped, never saved up for later.
 * - `?sound=off` leaves all of it out, nothing loaded: to compare how the page runs without it.
 */

const BASE = `${import.meta.env.BASE_URL}audio/`
/** How long the sound takes to fade in at first, and a layer to go quiet or come back. */
const FADE_IN_S = 4
export const MUTE_S = 0.4
/** The most effects sounding at once; past this the quietest gives way. */
const MAX_VOICES = 6
/** Sounds of one kind closer together than this are softened, so a flurry never piles up. */
const CROWD_S = 0.25
/** Where the layers chosen are remembered, on this device. */
const STORE = 'bayou-sound'

export const SOUND_OFF =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('sound') === 'off'

export interface Loop {
  start: number
  end: number
}
export interface Manifest {
  melody: Loop
  crickets: Loop
  /** The creatures' calls. */
  takes: string[]
  /** Every effect, by file name. */
  sfx: Record<string, { loop?: Loop }>
  /** Gains; `effects` is what the effects' levels are measured from. */
  mix: { melody: number; crickets: number; calls: number; effects: number }
  /** Each kind of effect's level in dB against the tune (`plip-3` is a `plip`). */
  levels: Record<string, number>
}

export interface Layers {
  /** The tune, looping. */
  tune: boolean
  /** Crickets, frogs and owls. */
  ambience: boolean
  /** The sounds of touching the bayou. */
  touches: boolean
}
export const ALL_ON: Layers = { tune: true, ambience: true, touches: true }
export const anyOn = (layers: Layers) => layers.tune || layers.ambience || layers.touches

export interface SoundState {
  /** Playing since the first tap. */
  started: boolean
  layers: Layers
}

function remembered(): Layers {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? 'null')
    if (saved && typeof saved === 'object')
      return {
        tune: saved.tune !== false,
        ambience: saved.ambience !== false,
        touches: saved.touches !== false,
      }
  } catch {
    // Storage unavailable (a private window, blocked site data): every layer on.
  }
  return ALL_ON
}

let state: SoundState = {
  started: false,
  layers: SOUND_OFF ? { tune: false, ambience: false, touches: false } : remembered(),
}
const listeners = new Set<() => void>()
function update(next: Partial<SoundState>) {
  state = { ...state, ...next }
  for (const listener of listeners) listener()
}
export const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export const getSoundState = () => state

export interface Graph {
  ctx: AudioContext
  master: GainNode
  /** Effects in: left, middle, right. */
  sides: [StereoPannerNode, StereoPannerNode, StereoPannerNode]
}
let graph: Graph | null = null
let manifest: Manifest | null = null
const buffers = new Map<string, AudioBuffer>()
/** Each one-shot's decoder padding, in seconds: where its sound really starts. */
const leads = new Map<string, number>()
let sleepTimer = 0

/** What's been played, by kind, in a dev build (`npm run check` reads it). */
const stats: Record<string, number> = {}
if (import.meta.env.DEV && typeof window !== 'undefined')
  (window as Window & { __sound?: typeof stats }).__sound = stats

/** An effect's kind: `plip-3` is a `plip`, `door-shut` is itself. */
export const kind = (name: string) => name.replace(/-\d+$/, '')
const db = (d: number) => 10 ** (d / 20)

// ─── Loading ─────────────────────────────────────────────────────────────────────────────────

let decoding: Promise<void> | null = null
/** Fetches and decodes everything, once: effects first, the tune last. */
function decodeAll(): Promise<void> {
  decoding ??= (async () => {
    const m: Manifest = await (await fetch(`${BASE}sound.json`)).json()
    const names = [...Object.keys(m.sfx), ...m.takes, 'crickets', 'melody']
    const bytes = names.map((name) => fetch(`${BASE}${name}.mp3`).then((r) => r.arrayBuffer()))
    // Decoded here, before any tap; a buffer plays in any context.
    const offline = new OfflineAudioContext(1, 1, 44100)
    for (const [k, name] of names.entries()) {
      const buffer = await offline.decodeAudioData(await (bytes[k] as Promise<ArrayBuffer>))
      buffers.set(name, buffer)
      leads.set(name, onset(buffer))
    }
    manifest = m
  })()
  return decoding
}

/** Where a sound starts, past the silence an MP3 decoder may put in front of it. */
function onset(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0)
  const limit = Math.min(data.length, Math.round(buffer.sampleRate * 0.2))
  for (let i = 0; i < limit; i++) if (Math.abs(data[i] ?? 0) > 1e-4) return i / buffer.sampleRate
  return 0
}

// ─── Starting ────────────────────────────────────────────────────────────────────────────────

const starters: ((graph: Graph, manifest: Manifest) => void)[] = []
/** Runs once the sound has started (the first tap, the files decoded). */
export function onStart(start: (graph: Graph, manifest: Manifest) => void) {
  starters.push(start)
}

/** The gestures a browser lets start sound. `pointerdown` isn't one on a touch screen. */
const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'] as const

function arm() {
  for (const g of GESTURES) window.addEventListener(g, unlock, { capture: true, passive: true })
}
function disarm() {
  for (const g of GESTURES) window.removeEventListener(g, unlock, { capture: true })
}

/** Inside a gesture: makes the audio context and wakes it, then starts once decoded. */
function unlock() {
  // With every layer off there's nothing to start; the next gesture may find one switched on.
  if (!anyOn(state.layers)) return
  if (!graph) {
    // Play through an iPhone's silent switch, as music does (Safari 16.4+).
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
    if (session) session.type = 'playback'
    graph = build(new AudioContext())
  }
  const { ctx } = graph
  // An older iPhone only wakes once something has played inside the gesture: a blank instant.
  const blank = ctx.createBufferSource()
  blank.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
  blank.connect(ctx.destination)
  blank.start()
  ctx.resume().then(
    () => {
      if (ctx.state !== 'running') return
      disarm()
      void start()
    },
    () => {},
  )
}

function build(ctx: AudioContext): Graph {
  // A limiter last of all, so effects over the tune can never clip.
  const limit = ctx.createDynamicsCompressor()
  limit.threshold.value = -3
  limit.knee.value = 0
  limit.ratio.value = 20
  limit.attack.value = 0.002
  limit.release.value = 0.1
  limit.connect(ctx.destination)
  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(limit)
  // A gentle compressor on the effects only, so a pile-up never jumps out.
  const squeeze = ctx.createDynamicsCompressor()
  squeeze.threshold.value = -10
  squeeze.knee.value = 10
  squeeze.ratio.value = 3
  squeeze.attack.value = 0.005
  squeeze.release.value = 0.2
  squeeze.connect(master)
  const side = (pan: number) => {
    const node = ctx.createStereoPanner()
    node.pan.value = pan
    node.connect(squeeze)
    return node
  }
  return { ctx, master, sides: [side(-0.3), side(0), side(0.3)] }
}

let starting = false
async function start() {
  if (starting || !graph) return
  starting = true
  try {
    await decodeAll()
  } catch (error) {
    // Without its sound the bayou still plays.
    console.warn('No sound:', error)
    return
  }
  const { ctx, master } = graph
  master.gain.setValueAtTime(0, ctx.currentTime)
  master.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE_IN_S)
  update({ started: true })
  for (const begin of starters) if (manifest) begin(graph, manifest)
}

/** A decoded file. */
export const buffer = (name: string) => buffers.get(name) ?? null

/** Whether a sound now would be heard: started, awake and in sight. Layers are checked by each. */
export const live = () =>
  !!manifest && graph?.ctx.state === 'running' && anyOn(state.layers) && !document.hidden

/** The audio clock, in seconds. */
export const now = () => graph?.ctx.currentTime ?? 0

// ─── Effects ─────────────────────────────────────────────────────────────────────────────────

const voices = new Map<AudioBufferSourceNode, { gain: GainNode; level: number }>()
/** When each kind last played, and how crowded it's been. */
const recent = new Map<string, { at: number; crowd: number }>()

export interface PlayOptions {
  /** On the audio clock; now if left out. */
  at?: number
  /** On top of its level, as a gain. */
  gain?: number
  rate?: number
  /** Which side: -1 left, 0 the middle, 1 right. */
  side?: -1 | 0 | 1
}

/** Plays an effect at its level, or does nothing if it wouldn't be heard. */
export function play(name: string, options: PlayOptions = {}): void {
  const data = buffers.get(name)
  if (!graph || !manifest || !data || !live()) return
  const { ctx } = graph
  const source = ctx.createBufferSource()
  source.buffer = data
  source.playbackRate.value = options.rate ?? 1
  const at = Math.max(ctx.currentTime, options.at ?? ctx.currentTime)
  const k = kind(name)
  // A flurry of one kind (plips, stars) softens as it crowds, rather than piling up.
  const last = recent.get(k)
  const crowd = last && at - last.at < CROWD_S ? last.crowd + 1 : 0
  recent.set(k, { at, crowd })
  const level = db(manifest.levels[k] ?? -20) * manifest.mix.effects * (options.gain ?? 1)
  const gain = ctx.createGain()
  const g = level / Math.sqrt(crowd + 1)
  gain.gain.setValueAtTime(g, at)
  const [left, middle, right] = graph.sides
  source.connect(gain).connect(options.side === -1 ? left : options.side === 1 ? right : middle)
  makeRoom()
  voices.set(source, { gain, level: g })
  source.onended = () => voices.delete(source)
  source.start(at, leads.get(name) ?? 0)
  stats[k] = (stats[k] ?? 0) + 1
}

/** Past `MAX_VOICES`, the quietest sounding effect gives way, quickly but without a click. */
function makeRoom() {
  if (voices.size < MAX_VOICES || !graph) return
  let quietest: [AudioBufferSourceNode, { gain: GainNode; level: number }] | null = null
  for (const entry of voices) if (!quietest || entry[1].level < quietest[1].level) quietest = entry
  if (!quietest) return
  const [source, { gain }] = quietest
  voices.delete(source)
  const t = graph.ctx.currentTime
  gain.gain.cancelScheduledValues(t)
  gain.gain.setValueAtTime(gain.gain.value, t)
  gain.gain.linearRampToValueAtTime(0, t + 0.03)
  try {
    source.stop(t + 0.05)
  } catch {
    // Already stopped.
  }
}

// ─── Layers, sleeping ────────────────────────────────────────────────────────────────────────

/**
 * Switches layers on or off (from the sound menu, so inside a gesture: a sleeping context can
 * wake again) and remembers them. Each layer fades itself (`soundscape.ts`); with none left on,
 * the master fades too and the context sleeps.
 */
export function setLayers(next: Partial<Layers>) {
  const layers = { ...state.layers, ...next }
  update({ layers })
  try {
    localStorage.setItem(STORE, JSON.stringify(layers))
  } catch {
    // Not remembered, but it still plays.
  }
  if (!graph || !state.started) {
    // Not started yet: switching one on from nothing loads the files, ready for the first tap.
    if (anyOn(layers)) void decodeAll().catch(() => {})
    return
  }
  const { ctx, master } = graph
  const on = anyOn(layers)
  clearTimeout(sleepTimer)
  const t = ctx.currentTime
  master.gain.cancelScheduledValues(t)
  master.gain.setValueAtTime(master.gain.value, t)
  master.gain.linearRampToValueAtTime(on ? 1 : 0, t + MUTE_S)
  // Silent, it sleeps, to spare the battery.
  if (!on) sleepTimer = window.setTimeout(() => void ctx.suspend(), MUTE_S * 1000 + 50)
  else void ctx.resume()
}

if (typeof window !== 'undefined' && !SOUND_OFF) {
  arm()
  // Decode once the page has loaded and settled, off the main thread.
  const later = () =>
    setTimeout(() => {
      if (anyOn(state.layers)) void decodeAll().catch(() => {})
    }, 1500)
  if (document.readyState === 'complete') later()
  else window.addEventListener('load', later, { once: true })
  // Out of sight (another tab, a locked phone), it sleeps; back, it wakes, unless all is off.
  document.addEventListener('visibilitychange', () => {
    if (!graph || !state.started) return
    if (document.hidden) void graph.ctx.suspend()
    else if (anyOn(state.layers)) void graph.ctx.resume()
  })
}
