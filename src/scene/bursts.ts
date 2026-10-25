import { useCallback, useEffect, useRef, useState } from 'react'

/*
 * Things in the bayou that play once when they're touched (a puff of smoke, hearts, a ripple)
 * and are gone again. Each is a few elements with a CSS animation of their own (theme.css).
 */

export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** All bursts in one group. (Module-level, so `add` stays the same from render to render.) */
const together = () => null

/** One of them: a fresh `id` (its key, so it plays from the start) and where it is. */
export interface Burst<T> {
  id: number
  at: T
}

/**
 * Bursts that last `ms`: `add(at)` starts one. At most `cap` of a `group` play at once (the oldest
 * goes first), so quick taps can't pile them up. Each is taken away by a timer, not
 * `animationend`, which never fires with reduced motion.
 */
export function useBursts<T>(ms: number, cap: number, group: (at: T) => unknown = together) {
  const [bursts, setBursts] = useState<Burst<T>[]>([])
  const next = useRef(0)
  const [timers] = useState(() => new Set<number>())
  useEffect(
    () => () => {
      for (const id of timers) clearTimeout(id)
    },
    [timers],
  )
  const add = useCallback(
    (at: T) => {
      const id = next.current++
      setBursts((all) => {
        const mine = all.filter((b) => group(b.at) === group(at))
        const old = new Set(mine.slice(0, Math.max(0, mine.length + 1 - cap)).map((b) => b.id))
        return [...all.filter((b) => !old.has(b.id)), { id, at }]
      })
      const timer = window.setTimeout(() => {
        timers.delete(timer)
        setBursts((all) => all.filter((b) => b.id !== id))
      }, ms)
      timers.add(timer)
    },
    [ms, cap, group, timers],
  )
  return [bursts, add] as const
}
