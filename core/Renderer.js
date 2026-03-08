
/**
 * GOS Framework — Renderer.js
 * 职责：初始化 PixiJS，创建并管理所有渲染图层
 * 接口：constructor(app)，与文档一致
 */

import { Container } from 'pixi.js'

export class Renderer {

  /** @param {import('pixi.js').Application} app */
  constructor(app) {
    this._app = app

    // 创建图层（按渲染顺序从下到上）
    this._layers = {
      background: new Container(),  // 背景瓦片
      terrain:    new Container(),  // 地形瓦片（山/水/陨石坑）
      decoration: new Container(),  // 点缀层
      highlight:  new Container(),  // 格子高亮
      units:      new Container(),  // 单位
      effects:    new Container(),  // 特效
      ui:         new Container(),  // UI（血条等）
      dialog:     new Container(),  // 对话框（最顶层）
    }

    // 挂到舞台
    Object.values(this._layers).forEach(layer => {
      this._app.stage.addChild(layer)
    })
  }

  /** @returns {object} 所有图层的只读引用 */
  get layers() { return this._layers }

  /** @returns {{ width: number, height: number }} */
  get size() {
    return {
      width:  this._app.renderer.width,
      height: this._app.renderer.height,
    }
  }

  /** PixiJS Application 实例 */
  get app() { return this._app }
}
