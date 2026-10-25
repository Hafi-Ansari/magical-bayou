// Plays the bayou in headless Chromium, as someone would, and fails on anything that doesn't work:
// it must open on the wake cue with nothing touchable, and a tap must wake it and start the
// sound. Then every part of the hut, a lantern, the water and the sky are touched, and each must
// play its sound (a dev build counts them on window.__sound). The sound menu must open and close
// (Esc, a tap elsewhere), never set the bayou going itself, and silence each layer it unticks;
// what's ticked must last a reload, and with nothing ticked the bayou must open awake. `?fps`
// must be holding the animations (30 a second unless the URL says otherwise). The console must
// stay clean. Screenshots go to shots/. Exits 1 on a problem.
//
//   npm run dev                        # in another terminal
//   npm run check                      # or: npm run check -- http://localhost:5174/
//   VIEWPORT=2560x1440 npm run check   # another screen size (default 390x844)

import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const URL = process.argv[2] ?? 'http://localhost:5173/'
const OUT = 'shots'
mkdirSync(OUT, { recursive: true })

const [width, height] = (process.env.VIEWPORT ?? '390x844').split('x').map(Number)
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width, height } })
const page = await context.newPage()
const errors = []
const problems = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })
const count = (selector) => page.locator(selector).count()
const played = () => page.evaluate(() => ({ ...(window.__sound ?? {}) }))
const layers = () => page.evaluate(() => window.__layers?.() ?? null)

await page.goto(URL)
await page.waitForTimeout(2500)

// It opens on the wake cue, with nothing to touch yet.
if (!(await count('.wake-cue[data-shown]'))) problems.push('it did not open on the wake cue')
if (await count('.hut-spot')) problems.push('the hut could be touched before the bayou woke')
if (!(await count('.sound-toggle'))) problems.push('there was no sound menu')
const held = await page.evaluate(
  () => document.getAnimations().filter((a) => a.playState === 'paused').length,
)
if (held < 50) problems.push(`?fps was not holding the animations (${held} held)`)
await shot('wake')

// A tap wakes it and starts the sound.
await page.mouse.click(width / 2, height * 0.9)
await page.waitForTimeout(2500)
if (await count('.wake-cue[data-shown]')) problems.push('a tap did not take the wake cue away')
if ((await count('.hut-spot')) !== 13) problems.push('once awake, the hut could not be touched')
if (!(await layers())) problems.push('the sound did not start')

// Every part of the hut, then a lantern, the water and the sky.
const part = (name) => page.locator(`.hut-spot[data-part="${name}"]`)
await part('moon').click()
await part('door').click()
await part('cats').click()
await page.waitForTimeout(900)
if (!(await count('.hut[data-moon="full"]')))
  problems.push('touching the moon did not make it full')
if (!(await count('.hut[data-door="open"]'))) problems.push('touching the door did not open it')
if (!(await count('.hut-float-heart'))) problems.push('touching the cats did not raise hearts')
await shot('play')
await part('moon').click()
await page.waitForTimeout(200)
if (await count('.hut[data-moon]')) problems.push('touching the full moon did not wane it')
for (const name of ['chimney', 'turret', 'tower', 'attic', 'candle', 'potion', 'embers'])
  await part(name).click()
for (const name of ['kitchen', 'parlour', 'toadstools', 'door']) await part(name).click()
const spots = await page.evaluate(() => {
  const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect()
  const [lantern, water, moon] = [rect('.lantern'), rect('.water'), rect('[data-part=moon]')]
  return {
    lantern: lantern && [lantern.left + lantern.width / 2, lantern.bottom + 6.5],
    water: water && [water.left + water.width * 0.06, water.top + water.height * 0.8],
    sky: moon && [window.innerWidth / 2, Math.max(8, moon.top - 24)],
  }
})
for (const [name, at] of Object.entries(spots)) {
  if (!at) problems.push(`no ${name} to touch`)
  else await page.mouse.click(at[0], at[1])
}
await page.waitForTimeout(1200)
const SOUNDS = ['moon-wax', 'moon-wane', 'creak', 'door-shut', 'puff', 'meow', 'mew', 'spores']
SOUNDS.push('bat', 'witchlights', 'hoot', 'candle', 'potion', 'shutter', 'cackle', 'ghost')
SOUNDS.push('lantern', 'plip', 'star')
const heard = await played()
const unheard = SOUNDS.filter((kind) => !heard[kind])
if (unheard.length) problems.push(`touches that never sounded: ${unheard.join(', ')}`)

// The sound menu: opens, never sets the bayou going, and each box silences its layer.
const toggle = page.locator('.sound-toggle')
const box = (name) => page.locator('.sound-layer', { hasText: name }).locator('input')
await toggle.click()
if (!(await page.locator('.sound-layers').isVisible())) problems.push('the sound menu did not open')
const stars = await count('.shooting-star')
const ripples = await count('.tap-ripple')
await page.locator('.sound-layers').click({ position: { x: 6, y: 6 } })
if ((await count('.shooting-star')) > stars || (await count('.tap-ripple')) > ripples)
  problems.push('a tap in the sound menu set the bayou going')
await shot('menu')
await box('The tune').uncheck()
await box('The bayou').uncheck()
await page.waitForTimeout(700)
const off = await layers()
if (off?.tune !== 0) problems.push('unticking the tune did not silence it')
if (off?.ambience !== 0) problems.push('unticking the bayou did not silence its creatures')
await box('Touches').uncheck()
const before = (await played()).plip ?? 0
await page.keyboard.press('Escape')
if (await page.locator('.sound-layers').isVisible()) problems.push('Esc did not close the menu')
if (!(await count('.sound-toggle[data-hushed]')))
  problems.push('with everything off, the crescent did not hush')
if (spots.water) await page.mouse.click(spots.water[0], spots.water[1])
await page.waitForTimeout(500)
if (((await played()).plip ?? 0) !== before) problems.push('unticked, a touch still sounded')
await toggle.click()
await box('The tune').check()
await page.waitForTimeout(700)
if ((await layers())?.tune !== 1) problems.push('ticking the tune again did not bring it back')
await page.mouse.click(width / 2, height / 2)
if (await page.locator('.sound-layers').isVisible())
  problems.push('a tap elsewhere did not close the menu')

// What's ticked lasts a reload: the tune alone now.
await page.reload()
await page.waitForTimeout(1500)
await toggle.click()
const ticked = await page.evaluate(() =>
  [...document.querySelectorAll('.sound-layer input')].map((i) => i.checked),
)
if (ticked.join() !== 'true,false,false')
  problems.push(`a reload did not keep what was ticked (${ticked.join()})`)
// With nothing ticked, there's nothing to wake for: it opens awake.
await box('The tune').uncheck()
await page.reload()
await page.waitForTimeout(1500)
if (await count('.wake-cue[data-shown]')) problems.push('with no sound, it still asked to be woken')
if ((await count('.hut-spot')) !== 13) problems.push('with no sound, it did not open awake')
await shot('silent')

await browser.close()
console.log('sounds played:', heard)
console.log(`\nscreenshots in ${OUT}/`)
console.log('problems:', problems.length ? problems : 'none')
console.log('console errors:', errors.length ? errors : 'none')
if (problems.length || errors.length) process.exit(1)
