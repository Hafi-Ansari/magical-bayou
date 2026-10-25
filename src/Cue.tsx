import type { CSSProperties } from 'react'

/**
 * The cue that wakes the bayou, lying on the water and rippling as if it floated: each letter bobs
 * and sways a beat behind the one before it. Words hold together so lines wrap between them. It's
 * a button over the whole screen, so a tap anywhere wakes it (theme.css, `.wake-cue`). Hidden, it
 * can't be reached or tapped, but it's never a disabled button, which would swallow the tap.
 */
export function Cue({
  text,
  shown,
  onPress,
}: {
  text: string
  shown: boolean
  onPress: () => void
}) {
  let i = 0
  const words = text.split(' ').map((word, w) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: the cue is fixed text
    <span key={w} className="cue-word">
      {[...word].map((ch) => (
        <span key={i} style={{ '--i': i++ } as CSSProperties}>
          {ch}
        </span>
      ))}
    </span>
  ))
  return (
    <button
      type="button"
      className="wake-cue"
      data-shown={shown || undefined}
      aria-hidden={!shown || undefined}
      tabIndex={shown ? 0 : -1}
      onClick={shown ? onPress : undefined}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{words.flatMap((word, w) => (w ? [' ', word] : [word]))}</span>
    </button>
  )
}
