
/**
 * GOS Framework — Map.js
 * 职责：加载瓦片图集，渲染三层地图，坐标转换，寻路
 * 注意：tileSize 在 mapData 中定义，从16px改为64px只需改 mapData.tileSize
 */

import { Sprite, Texture, Graphics, Assets } from 'pixi.js'

export class Map {

  /**
   * @param {import('./Renderer.js').Renderer} renderer
   * @param {object} mapData
   */
  constructor(renderer, mapData) {
    this._renderer   = renderer
    this._data       = mapData
    this._textures   = []
    this._highlights = []
  }

  // ─────────────────────────────────────────────────────
  // 渲染
  // ─────────────────────────────────────────────────────

  /** @returns {Promise<void>} */
  async render() {
    await this._loadTileset()
    this._renderLayer('background')
    this._renderLayer('terrain')
    this._renderLayer('decoration')
  }

  /** @private */
  async _loadTileset() {
    const { tilesetPath, tilesetCols, tileSize } = this._data
    // 原始图集每格固定 16px（无论 tileSize 是多少）
    const SRC_TILE = 16

    const baseTexture = await Assets.load(tilesetPath)
    const tilesetRows = Math.floor(baseTexture.height / SRC_TILE)
    const totalCols   = tilesetCols

    for (let row = 0; row < tilesetRows; row++) {
      for (let col = 0; col < totalCols; col++) {
        const id = row * totalCols + col
        this._textures[id] = new Texture({
          source: baseTexture.source,
          frame: {
            x: col * SRC_TILE,
            y: row * SRC_TILE,
            width:  SRC_TILE,
            height: SRC_TILE,
          },
        })
      }
    }
  }

  /** @private */
  _renderLayer(layerName) {
    const { cols, rows, tileSize, layers } = this._data
    // 原始图集每格16px，缩放比例
    const SRC_TILE = 16
    const scale    = tileSize / SRC_TILE

    const container = this._renderer.layers[layerName]
    const grid      = layers[layerName]

    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const id = grid[ty]?.[tx]
        if (!id) continue

        const texture = this._textures[id]
        if (!texture) continue

        const sprite   = new Sprite(texture)
        sprite.scale.set(scale)
        sprite.x = tx * tileSize
        sprite.y = ty * tileSize
        container.addChild(sprite)
      }
    }
  }

  // ─────────────────────────────────────────────────────
  // 坐标转换
  // ─────────────────────────────────────────────────────

  tileToPixel([tx, ty]) {
    const { tileSize } = this._data
    return { px: tx * tileSize, py: ty * tileSize }
  }

  pixelToTile({ px, py }) {
    const { tileSize } = this._data
    return [Math.floor(px / tileSize), Math.floor(py / tileSize)]
  }

  // ─────────────────────────────────────────────────────
  // 格子查询
  // ─────────────────────────────────────────────────────

  isPassable([tx, ty]) {
    if (!this._inBounds([tx, ty])) return false
    return this.getTileProps([tx, ty])?.passable ?? true
  }

  getTileProps([tx, ty]) {
    const { layers, tileProps } = this._data
    const terrainId = layers.terrain[ty]?.[tx]
    if (terrainId) return tileProps[terrainId] ?? { passable: false, type: 'ground' }
    const bgId = layers.background[ty]?.[tx]
    return tileProps[bgId] ?? { passable: true, type: 'ground' }
  }

  getNeighbors([tx, ty]) {
    return [
      [tx,     ty - 1],
      [tx,     ty + 1],
      [tx - 1, ty    ],
      [tx + 1, ty    ],
    ].filter(t => this._inBounds(t))
  }

  // ─────────────────────────────────────────────────────
  // 高亮
  // ─────────────────────────────────────────────────────

  highlight(tiles, color, alpha = 0.4) {
    const { tileSize } = this._data
    const container    = this._renderer.layers.highlight
    tiles.forEach(([tx, ty]) => {
      const g = new Graphics()
      g.rect(0, 0, tileSize, tileSize)
      g.fill({ color, alpha })
      g.x = tx * tileSize
      g.y = ty * tileSize
      container.addChild(g)
      this._highlights.push(g)
    })
  }

  clearHighlight() {
    const container = this._renderer.layers.highlight
    this._highlights.forEach(g => container.removeChild(g))
    this._highlights = []
  }

  // ─────────────────────────────────────────────────────
  // 寻路
  // ─────────────────────────────────────────────────────

  findPath(from, to, maxSteps = Infinity) {
    const key  = ([x, y]) => `${x},${y}`
    const heur = ([x, y]) => Math.abs(x - to[0]) + Math.abs(y - to[1])
    const open   = new globalThis.Map()
    const closed = new Set()

    open.set(key(from), { tile: from, g: 0, f: heur(from), parent: null })

    while (open.size > 0) {
      let current = null
      for (const node of open.values()) {
        if (!current || node.f < current.f) current = node
      }
      const [cx, cy] = current.tile
      if (cx === to[0] && cy === to[1]) return this._reconstructPath(current)

      open.delete(key(current.tile))
      closed.add(key(current.tile))
      if (current.g >= maxSteps) continue

      for (const nb of this.getNeighbors(current.tile)) {
        const nk = key(nb)
        if (closed.has(nk) || !this.isPassable(nb)) continue
        const g = current.g + 1
        const existing = open.get(nk)
        if (!existing || g < existing.g) {
          open.set(nk, { tile: nb, g, f: g + heur(nb), parent: current })
        }
      }
    }
    return []
  }

  getReachable(origin, steps) {
    const visited = new Set()
    const result  = []
    const queue   = [{ tile: origin, remaining: steps }]
    const key     = ([x, y]) => `${x},${y}`
    visited.add(key(origin))

    while (queue.length > 0) {
      const { tile, remaining } = queue.shift()
      const isOrigin = tile[0] === origin[0] && tile[1] === origin[1]
      if (!isOrigin) result.push(tile)
      if (remaining <= 0) continue
      for (const nb of this.getNeighbors(tile)) {
        const nk = key(nb)
        if (visited.has(nk) || !this.isPassable(nb)) continue
        visited.add(nk)
        queue.push({ tile: nb, remaining: remaining - 1 })
      }
    }
    return result
  }

  // ─────────────────────────────────────────────────────
  // 工具
  // ─────────────────────────────────────────────────────

  _inBounds([tx, ty]) {
    return tx >= 0 && ty >= 0 && tx < this._data.cols && ty < this._data.rows
  }

  _reconstructPath(node) {
    const path = []
    let cur = node
    while (cur) { path.unshift(cur.tile); cur = cur.parent }
    return path
  }

  get cols()     { return this._data.cols }
  get rows()     { return this._data.rows }
  get tileSize() { return this._data.tileSize }
}
