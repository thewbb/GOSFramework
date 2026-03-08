
/**
 * GOS Framework — main.js
 * 职责：初始化 PixiJS Application，组装核心模块，启动第一关
 */

import { Application } from 'pixi.js'
import { Renderer }    from './core/Renderer.js'
import { EventBus }    from './core/Event.js'
import level1          from './levels/level1.js'

async function main() {
  // 去除浏览器默认边距
  document.body.style.margin   = '0'
  document.body.style.overflow = 'hidden'
  document.body.style.background = '#0a0a1a'

  // 初始化 PixiJS，铺满窗口
  const app = new Application()
  await app.init({
    resizeTo:        window,
    backgroundColor: 0x0a0a1a,
    antialias:       false,   // 像素风保持锐利
    resolution:      1,
  })
  document.body.appendChild(app.canvas)

  // 组装模块（与文档接口一致：new Renderer(app)）
  const renderer = new Renderer(app)
  const events   = new EventBus()

  // 启动第一关
  await level1.start(renderer, events)
}

main().catch(console.error)
