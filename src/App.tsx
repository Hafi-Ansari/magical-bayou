import { useCallback, useState, useSyncExternalStore } from 'react'
import { Cue } from './Cue'
import { UI } from './content'
import { Bayou } from './scene/Bayou'
import { anyOn, getSoundState, SOUND_OFF, subscribe } from './sound/engine'
import { SoundMenu } from './sound/SoundMenu'
import './sound/soundscape'
import './sound/touches'

/**
 * The bayou, and its sound. A browser plays nothing before a tap, so it opens with a cue on the
 * water, "Tap to let the bayou sing": that tap, anywhere, starts the sound and wakes the bayou to
 * be played in. Any first tap that starts the sound wakes it too (the sound menu's, say). With
 * every layer of sound off (or `?sound=off`) there's nothing to wait for: it's awake at once.
 */
export default function App() {
  const { started } = useSyncExternalStore(subscribe, getSoundState)
  const [woken, setWoken] = useState(() => SOUND_OFF || !anyOn(getSoundState().layers))
  const wake = useCallback(() => setWoken(true), [])
  const awake = woken || started
  return (
    <>
      <Bayou awake={awake} />
      <Cue text={UI.wakeBayou} shown={!awake} onPress={wake} />
      {SOUND_OFF ? null : <SoundMenu />}
    </>
  )
}
