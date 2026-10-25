import { describe, expect, it } from 'vitest'
import { CANOPY_VIEW, canopy, fireflies, fogBanks, lanterns } from '../src/scene/moss'

describe('canopy', () => {
  it('is the same for the same seed, and different for another', () => {
    expect(canopy(7)).toEqual(canopy(7))
    expect(canopy(7)).not.toEqual(canopy(8))
  })

  it('hangs every strand inside the box, from its tuft down', () => {
    for (const branch of canopy(7)) {
      expect(branch.strands.length).toBeGreaterThan(30)
      expect(branch.outline.length).toBeGreaterThan(10)
      for (const strand of branch.strands) {
        for (const { x, y } of strand.points) {
          expect(x).toBeGreaterThanOrEqual(-40)
          expect(x).toBeLessThanOrEqual(CANOPY_VIEW.width + 40)
          expect(y).toBeGreaterThanOrEqual(0)
          expect(y).toBeLessThanOrEqual(CANOPY_VIEW.height)
        }
        const ys = strand.points.map((p) => p.y)
        expect(ys).toEqual([...ys].sort((a, b) => a - b))
      }
    }
  })

  it('feathers the near limbs with cypress, each spray starting on its limb', () => {
    for (const branch of canopy(7)) {
      expect(branch.sprays.length).toBeGreaterThan(5)
      for (const { anchor, lines } of branch.sprays) {
        expect(lines[0]?.[0]).toEqual({ ...anchor, out: 0 })
        expect(lines.length).toBeGreaterThan(10)
      }
    }
  })
})

describe('lanterns', () => {
  it('hangs at least one from every limb, more from the long ones, tied on along it', () => {
    const limbs = canopy(7)
    const hung = lanterns(3, limbs)
    expect(hung.length).toBeGreaterThan(limbs.length)
    for (const { spine } of limbs) {
      const [from, , to] = spine
      const on = hung.filter((l) => l.x > from.x + (to.x - from.x) * 0.2 && l.x <= to.x)
      expect(on.length).toBeGreaterThan(0)
    }
    for (const l of hung) {
      expect(l.y).toBeGreaterThanOrEqual(0)
      expect(l.y).toBeLessThan(CANOPY_VIEW.height)
      expect(l.drop).toBeGreaterThan(0)
    }
  })

  it('leaves the limbs as they were', () => {
    const limbs = canopy(7)
    lanterns(3, limbs)
    expect(limbs).toEqual(canopy(7))
  })
})

describe('fog and fireflies', () => {
  it('puts some fog low over the water', () => {
    const banks = fogBanks(9)
    expect(banks.filter((b) => b.y >= 0.7).length).toBeGreaterThan(3)
  })

  it('draws most fireflies to the hut', () => {
    const flies = fireflies(5, 200, 0.7)
    const ring = flies.filter((f) => f.kind === 'ring').length
    expect(ring).toBeGreaterThan(120)
    expect(ring).toBeLessThan(170)
    expect(flies.every((f) => f.around >= 0 && f.around < 1)).toBe(true)
  })
})
