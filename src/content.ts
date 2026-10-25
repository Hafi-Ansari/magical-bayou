import type { Part } from './scene/Hut'

/** Every word the page shows or reads out: the wake cue, the sound menu, and the hut's parts. */
export const UI: Record<Part, string> & {
  wakeBayou: string
  sound: string
  tune: string
  ambience: string
  touches: string
} = {
  wakeBayou: 'Tap to let the bayou sing',
  sound: 'Sound',
  tune: 'The tune',
  ambience: 'The bayou',
  touches: 'Touches',
  moon: 'The moon',
  chimney: 'The chimney',
  door: 'The door',
  cats: 'The two cats',
  toadstools: 'The toadstools',
  turret: 'The turret window',
  tower: 'The tower window',
  attic: 'The attic window',
  candle: 'The candlelit window',
  potion: 'The window hung with moss',
  embers: 'The shuttered window',
  kitchen: 'The kitchen window',
  parlour: 'The parlour window',
}
