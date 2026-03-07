import { Container } from 'pixi.js'

export class Renderer {
  /** @param {import('pixi.js').Application} app */
  constructor(app) {
    this._app = app

    // 创建图层（按渲染顺序从下到上）
    this._layers = {
      background: new Container(),
      terrain:    new Container(),
      decoration: new Container(),
      highlight:  new Container(),
      units:      new Container(),
      effects:    new Container(),
      ui:         new Container(),
      dialog:     new Container(),
    }

    // 挂到舞台
    Object.values(this._layers).forEach(layer => {
      this._app.stage.addChild(layer)
    })
  }

  get layers() {
    return this._layers
  }

  get size() {
    return {
      width:  this._app.renderer.width,
      height: this._app.renderer.height,
    }
  }

  get app() {
    return this._app
  }
}