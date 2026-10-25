import './sound.css'
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { UI } from '../content'
import { anyOn, getSoundState, type Layers, setLayers, subscribe } from './engine'

const LAYERS: readonly (keyof Layers)[] = ['tune', 'ambience', 'touches']

/**
 * The sound's sigil in the bayou's top-right corner, a gilt crescent singing (or hushed, with
 * every layer off), and the menu it opens: a box for each layer of sound (`Layers` in engine.ts),
 * remembered on this device. Esc or a tap anywhere else closes it.
 */
export function SoundMenu() {
  const { layers } = useSyncExternalStore(subscribe, getSoundState)
  const [open, setOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
  const panel = useId()

  useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) => {
      if (!(event.target instanceof Node && menu.current?.contains(event.target))) setOpen(false)
    }
    const esc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', away)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('pointerdown', away)
      window.removeEventListener('keydown', esc)
    }
  }, [open])

  const singing = anyOn(layers)
  return (
    <div ref={menu} className="sound-menu">
      <button
        type="button"
        className="sound-toggle"
        data-hushed={singing ? undefined : ''}
        aria-label={UI.sound}
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path className="sound-moon" d="M10 4A8 8 0 1 0 10 20A9.5 9.5 0 0 1 10 4Z" />
          {singing ? (
            <path className="sound-mark" d="M15 9.2q2.2 2.8 0 5.6M18 6.8q4.2 5.2 0 10.4" />
          ) : (
            <path className="sound-mark" d="M15.5 9.5l5 5M20.5 9.5l-5 5" />
          )}
        </svg>
      </button>
      <fieldset id={panel} className="sound-layers" hidden={!open}>
        <legend className="sr-only">{UI.sound}</legend>
        {LAYERS.map((layer) => (
          <label key={layer} className="sound-layer">
            <input
              type="checkbox"
              checked={layers[layer]}
              onChange={(event) => setLayers({ [layer]: event.currentTarget.checked })}
            />
            <span>{UI[layer]}</span>
          </label>
        ))}
      </fieldset>
    </div>
  )
}
