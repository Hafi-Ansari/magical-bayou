import { describe, expect, it } from 'vitest'
import { shiver } from '../src/scene/streaks'

describe('a streak on the water', () => {
  const s = { duration: 2, delay: -0.5 }

  it('shivers there and back over each duration, as `alternate` does', () => {
    // Its delay is how far into its shiver it starts.
    expect(shiver(s, -0.5)).toBeCloseTo(0, 4)
    expect(shiver(s, 0.5)).toBeCloseTo(0.5, 4)
    expect(shiver(s, 1.5)).toBeCloseTo(1, 4)
    expect(shiver(s, 2.5)).toBeCloseTo(0.5, 4)
    expect(shiver(s, 3.5)).toBeCloseTo(0, 4)
    expect(shiver(s, 1.5 + 4 * 100)).toBeCloseTo(1, 4)
  })

  it('eases in and out, as `ease-in-out` does', () => {
    // cubic-bezier(0.42, 0, 0.58, 1) at a quarter of the way: about 0.129.
    expect(shiver(s, 0)).toBeCloseTo(0.1291, 3)
    expect(shiver(s, 3)).toBeCloseTo(0.1291, 3)
    expect(shiver(s, 1)).toBeCloseTo(1 - 0.1291, 3)
  })
})
