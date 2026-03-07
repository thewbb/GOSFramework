import { Application } from 'pixi.js'
import { Renderer }    from './core/Renderer.js'
import { EventBus }    from './core/Event.js'
import level1          from './levels/level1.js'

async function main() {
  // 让 Pixi 自适应窗口，并去掉 body 默认边距
  document.body.style.margin = '0'
  document.body.style.overflow = 'hidden'

  const app = new Application()
  await app.init({
    resizeTo: window,
    backgroundColor: 0x0a0a1a,
    antialias: false,
    resolution: 1,
  })
  document.body.appendChild(app.canvas)

  const renderer = new Renderer(app)
  const events   = new EventBus()

  await level1.start(renderer, events)
}

main().catch(console.error)