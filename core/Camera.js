
/**
 * GOS Framework — Camera.js
 * 职责：控制世界视角，支持跟随单位、拖拽、边界限制
 * 依赖：Renderer.js
 *
 * 设计思路：
 *   所有"世界内容"图层（background/terrain/decoration/highlight/units/effects）
 *   统一挂在 worldContainer 下，Camera 只移动 worldContainer 的 x/y。
 *   ui/dialog 图层不受 Camera 影响，始终固定在屏幕坐标。
 */

export class Camera {

  /**
   * @param {import('./Renderer.js').Renderer} renderer
   * @param {{ cols: number, rows: number, tileSize: number }} mapInfo
   */
  constructor(renderer, mapInfo) {
    this._renderer  = renderer
    this._mapInfo   = mapInfo
    this._targetX   = 0
    this._targetY   = 0
    this._currentX  = 0
    this._currentY  = 0
    this._lerp      = 0.12   // 插值速度，0~1，越大越快
    this._isDragging   = false
    this._dragStartX   = 0
    this._dragStartY   = 0
    this._dragOriginX  = 0
    this._dragOriginY  = 0

    // 把世界图层统一放进一个 worldContainer
    this._worldLayers = [
      'background', 'terrain', 'decoration', 'highlight', 'units', 'effects',
    ]

    this._setupTicker()
    this._setupDrag()
  }

  // ─────────────────────────────────────────────────────
  // 公共接口
  // ─────────────────────────────────────────────────────

  /**
   * 立即将视角中心对准某格子（无动画）
   * @param {[number, number]} tile
   */
  centerOn([tx, ty]) {
    const { tileSize } = this._mapInfo
    const { width, height } = this._renderer.size
    const x = -(tx * tileSize - width  / 2 + tileSize / 2)
    const y = -(ty * tileSize - height / 2 + tileSize / 2)
    const clamped = this._clamp(x, y)
    this._currentX = this._targetX = clamped.x
    this._currentY = this._targetY = clamped.y
    this._applyPosition(clamped.x, clamped.y)
  }

  /**
   * 平滑移动视角中心到某格子（有插值动画）
   * @param {[number, number]} tile
   */
  moveTo([tx, ty]) {
    const { tileSize } = this._mapInfo
    const { width, height } = this._renderer.size
    const x = -(tx * tileSize - width  / 2 + tileSize / 2)
    const y = -(ty * tileSize - height / 2 + tileSize / 2)
    const clamped = this._clamp(x, y)
    this._targetX = clamped.x
    this._targetY = clamped.y
  }

  /**
   * 跟随单位（每帧自动调用 moveTo，由 Battle 在单位移动后调用）
   * @param {import('./Unit.js').Unit} unit
   */
  follow(unit) {
    this.moveTo(unit.tile)
  }

  // ─────────────────────────────────────────────────────
  // 内部
  // ─────────────────────────────────────────────────────

  /** @private 每帧平滑插值 */
  _setupTicker() {
    this._renderer.app.ticker.add(() => {
      const dx = this._targetX - this._currentX
      const dy = this._targetY - this._currentY
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        this._currentX += dx * this._lerp
        this._currentY += dy * this._lerp
        this._applyPosition(this._currentX, this._currentY)
      }
    })
  }

  /** @private 鼠标拖拽平移 */
  _setupDrag() {
    const canvas = this._renderer.app.canvas
    canvas.addEventListener('pointerdown', (e) => {
      this._isDragging  = true
      this._dragStartX  = e.clientX
      this._dragStartY  = e.clientY
      this._dragOriginX = this._currentX
      this._dragOriginY = this._currentY
    })
    canvas.addEventListener('pointermove', (e) => {
      if (!this._isDragging) return
      const dx = e.clientX - this._dragStartX
      const dy = e.clientY - this._dragStartY
      const clamped = this._clamp(this._dragOriginX + dx, this._dragOriginY + dy)
      this._currentX = this._targetX = clamped.x
      this._currentY = this._targetY = clamped.y
      this._applyPosition(clamped.x, clamped.y)
    })
    canvas.addEventListener('pointerup',     () => { this._isDragging = false })
    canvas.addEventListener('pointerleave',  () => { this._isDragging = false })
  }

  /** @private 把 x/y 应用到所有世界图层 */
  _applyPosition(x, y) {
    const layers = this._renderer.layers
    this._worldLayers.forEach(name => {
      layers[name].x = x
      layers[name].y = y
    })
  }

  /**
   * @private 将偏移量限制在地图边界内，不让地图滚出屏幕
   * @returns {{ x: number, y: number }}
   */
  _clamp(x, y) {
    const { cols, rows, tileSize } = this._mapInfo
    const { width, height } = this._renderer.size
    const mapW = cols * tileSize
    const mapH = rows * tileSize

    // x 范围：右边界 0，左边界 -(mapW - width)
    const minX = mapW > width  ? -(mapW - width)  : (width  - mapW) / 2
    const maxX = mapW > width  ? 0                : (width  - mapW) / 2
    const minY = mapH > height ? -(mapH - height) : (height - mapH) / 2
    const maxY = mapH > height ? 0                : (height - mapH) / 2

    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y)),
    }
  }
}
