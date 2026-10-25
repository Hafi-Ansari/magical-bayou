/**
 * The bayou's sound: the witchy tune looping forever, the crickets' chorus under it, and frogs and
 * owls calling now and then from either side (`critters.ts`), all in public/audio/. It starts with
 * the first tap (`engine.ts`) and fades in. The tune is one layer and the crickets and calls
 * another, each faded in or out on its own as the sound menu switches it (`setLayers`).
 */

import { createRng } from '../scene/rng'
import { type Call, nextCall, nextSwell, VOICES, type Voice } from './critters'
import {
  buffer,
  type Graph,
  getSoundState,
  type Loop,
  live,
  MUTE_S,
  onStart,
  subscribe,
} from './engine'

const rng = createRng((Math.random() * 2 ** 32) >>> 0)

onStart((graph, manifest) => {
  const { ctx } = graph
  // Each layer's switch, on or off, between its sounds and the master.
  const layer = (on: boolean) => {
    const node = ctx.createGain()
    node.gain.value = on ? 1 : 0
    node.connect(graph.master)
    return node
  }
  const { layers } = getSoundState()
  const tune = layer(layers.tune)
  const night = layer(layers.ambience)
  const level = (to: GainNode, gain: number) => {
    const node = ctx.createGain()
    node.gain.value = gain
    node.connect(to)
    return node
  }
  const melody = level(tune, manifest.mix.melody)
  const crickets = level(night, manifest.mix.crickets)
  const calls = level(night, manifest.mix.calls)
  loop(graph, 'melody', manifest.melody, melody)
  loop(graph, 'crickets', manifest.crickets, crickets)
  for (const voice of Object.values(VOICES))
    schedule(nextCall(voice, rng, true), voice, (call) => sing(graph, call, calls))
  swell(graph, crickets, manifest.mix.crickets)

  const fadeTo = (node: GainNode, on: boolean) => {
    const t = ctx.currentTime
    node.gain.cancelScheduledValues(t)
    node.gain.setValueAtTime(node.gain.value, t)
    node.gain.linearRampToValueAtTime(on ? 1 : 0, t + MUTE_S)
  }
  // A dev build shows each layer's switch (`npm run check` reads it).
  if (import.meta.env.DEV)
    (window as Window & { __layers?: () => object }).__layers = () => ({
      tune: tune.gain.value,
      ambience: night.gain.value,
    })
  let was = layers
  subscribe(() => {
    const now = getSoundState().layers
    if (now.tune !== was.tune) fadeTo(tune, now.tune)
    if (now.ambience !== was.ambience) fadeTo(night, now.ambience)
    was = now
  })
})

/** Plays a file round and round between its loop points, which hold one whole cycle. */
function loop(graph: Graph, name: string, { start, end }: Loop, to: GainNode) {
  const source = graph.ctx.createBufferSource()
  source.buffer = buffer(name)
  source.loop = true
  source.loopStart = start
  source.loopEnd = end
  source.connect(to)
  source.start(graph.ctx.currentTime + 0.05, start)
}

/** Plays a voice's calls when they come, then waits for its next. */
function schedule(calls: Call[], voice: Voice, sing: (call: Call) => void) {
  for (const call of calls) setTimeout(() => sing(call), call.delayMs)
  setTimeout(() => schedule(nextCall(voice, rng), voice, sing), calls.at(-1)?.delayMs ?? 0)
}

function sing(graph: Graph, call: Call, to: GainNode) {
  // Out of sight or switched off, a call is skipped rather than saved up for later.
  if (!live() || !getSoundState().layers.ambience) return
  const { ctx } = graph
  const source = ctx.createBufferSource()
  source.buffer = buffer(call.take)
  source.playbackRate.value = call.rate
  const gain = ctx.createGain()
  gain.gain.value = call.gain
  const pan = ctx.createStereoPanner()
  pan.pan.value = call.pan
  source.connect(gain).connect(pan).connect(to)
  source.start()
}

/** The crickets' chorus drifts louder and softer. */
function swell(graph: Graph, crickets: GainNode, level: number) {
  const next = nextSwell(rng)
  crickets.gain.setTargetAtTime(level * next.level, graph.ctx.currentTime, next.ms / 3000)
  setTimeout(() => swell(graph, crickets, level), next.ms)
}
