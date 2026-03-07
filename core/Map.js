
/**
 * GOS Framework — Map.js
 * 职责：加载瓦片图集，渲染三层地图，坐标转换，寻路
 * 依赖：Renderer.js, PixiJS v8
 */

import { Sprite, Texture, Graphics, Assets } from 'pixi.js'

// ─────────────────────────────────────────────────────────
// Map
// ─────────────────────────────────────────────────────────

export class Map {

  /**
   * @param {Renderer} renderer
   * @param {MapData}  mapData
   */
  constructor(renderer, mapData) {
    this._renderer = renderer
    this._data     = mapData
    this._textures = []   // 切割好的瓦片 Texture 数组，下标即瓦片 ID
    this._highlights = [] // 当前高亮的 Graphics 对象
  }

  // ─────────────────────────────────────────────────────
  // 初始化 & 渲染
  // ─────────────────────────────────────────────────────

  /**
   * 加载图集并渲染三层瓦片
   * @returns {Promise<void>}
   */
  async render() {
    await this._loadTileset()
    this._renderLayer('background')
    this._renderLayer('terrain')
    this._renderLayer('decoration')
  }

  /**
   * 加载图集，切割成独立 Texture
   * @private
   */
  async _loadTileset() {
    const { tilesetPath, tilesetCols, tileSize } = this._data

    const baseTexture = await Assets.load(tilesetPath)

    // 计算图集总行数
    const tilesetRows = Math.floor(baseTexture.height / tileSize)

    for (let row = 0; row < tilesetRows; row++) {
      for (let col = 0; col < tilesetCols; col++) {
        const id = row * tilesetCols + col
        this._textures[id] = new Texture({
          source: baseTexture.source,
          frame:  {
            x: col * tileSize,
            y: row * tileSize,
            width:  tileSize,
            height: tileSize,
          },
        })
      }
    }
  }

  /**
   * 渲染单层瓦片到对应 Container
   * @private
   * @param {'background'|'terrain'|'decoration'} layerName
   */
  _renderLayer(layerName) {
    const { cols, rows, tileSize, layers } = this._data
    const container = this._renderer.layers[layerName]
    const grid      = layers[layerName]

    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const id = grid[ty]?.[tx]
        if (!id) continue  // 0 或 undefined = 透明，跳过

        const texture = this._textures[id]
        if (!texture) continue

        const sprite = new Sprite(texture)
        sprite.x = tx * tileSize
        sprite.y = ty * tileSize
        container.addChild(sprite)
      }
    }
  }

  // ─────────────────────────────────────────────────────
  // 坐标转换
  // ─────────────────────────────────────────────────────

  /**
   * 格子坐标 → 像素坐标（格子左上角）
   * @param   {[number, number]} tile
   * @returns {{ px: number, py: number }}
   */
  tileToPixel([tx, ty]) {
    const { tileSize } = this._data
    return {
      px: tx * tileSize,
      py: ty * tileSize,
    }
  }

  /**
   * 像素坐标 → 格子坐标（向下取整）
   * @param   {{ px: number, py: number }} pixel
   * @returns {[number, number]}
   */
  pixelToTile({ px, py }) {
    const { tileSize } = this._data
    return [
      Math.floor(px / tileSize),
      Math.floor(py / tileSize),
    ]
  }

  // ─────────────────────────────────────────────────────
  // 格子查询
  // ─────────────────────────────────────────────────────

  /**
   * 判断格子是否可通行
   * @param   {[number, number]} tile
   * @returns {boolean}
   */
  isPassable([tx, ty]) {
    if (!this._inBounds([tx, ty])) return false
    const props = this.getTileProps([tx, ty])
    return props?.passable ?? true
  }

  /**
   * 获取格子属性（terrain 层优先，否则取 background 层）
   * @param   {[number, number]} tile
   * @returns {TileProps}
   */
  getTileProps([tx, ty]) {
    const { layers, tileProps } = this._data

    // terrain 层有值时优先取
    const terrainId = layers.terrain[ty]?.[tx]
    if (terrainId) return tileProps[terrainId] ?? { passable: true, type: 'ground' }

    const bgId = layers.background[ty]?.[tx]
    return tileProps[bgId] ?? { passable: true, type: 'ground' }
  }

  /**
   * 获取四邻格（过滤越界）
   * @param   {[number, number]} tile
   * @returns {[number, number][]}
   */
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

  /**
   * 高亮若干格子（可多次调用叠加不同颜色）
   * @param {[number, number][]} tiles
   * @param {number} color  0xRRGGBB
   * @param {number} alpha  默认 0.4
   */
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

  /**
   * 清除所有高亮
   */
  clearHighlight() {
    const container = this._renderer.layers.highlight
    this._highlights.forEach(g => container.removeChild(g))
    this._highlights = []
  }

  // ─────────────────────────────────────────────────────
  // 寻路
  // ─────────────────────────────────────────────────────

  /**
   * A* 寻路（不穿越不可通行格，不穿越单位）
   * @param   {[number, number]} from
   * @param   {[number, number]} to
   * @param   {number}           maxSteps
   * @returns {[number, number][]}  含起点和终点，无路返回 []
   */
  findPath(from, to, maxSteps = Infinity) {
    const key   = ([tx, ty]) => `${tx},${ty}`
    const heur  = ([tx, ty]) => Math.abs(tx - to[0]) + Math.abs(ty - to[1])

    const open   = new Map()   // key → { tile, g, f, parent }
    const closed = new Set()

    const startNode = { tile: from, g: 0, f: heur(from), parent: null }
    open.set(key(from), startNode)

    while (open.size > 0) {
      // 取 f 最小节点
      let current = null
      for (const node of open.values()) {
        if (!current || node.f < current.f) current = node
      }

      const [cx, cy] = current.tile
      if (cx === to[0] && cy === to[1]) {
        return this._reconstructPath(current)
      }

      open.delete(key(current.tile))
      closed.add(key(current.tile))

      if (current.g >= maxSteps) continue

      for (const neighbor of this.getNeighbors(current.tile)) {
        const nKey = key(neighbor)
        if (closed.has(nKey)) continue
        if (!this.isPassable(neighbor)) continue

        const g = current.g + 1
        const existing = open.get(nKey)

        if (!existing || g < existing.g) {
          open.set(nKey, {
            tile: neighbor,
            g,
            f: g + heur(neighbor),
            parent: current,
          })
        }
      }
    }

    return []  // 无路
  }

  /**
   * BFS 获取从 origin 出发 steps 步内所有可达格
   * @param   {[number, number]} origin
   * @param   {number}           steps
   * @returns {[number, number][]}
   */
  getReachable(origin, steps) {
    const visited = new Set()
    const result  = []
    const queue   = [{ tile: origin, remaining: steps }]
    visited.add(`${origin[0]},${origin[1]}`)

    while (queue.length > 0) {
      const { tile, remaining } = queue.shift()

      // 起点本身不加入结果
      if (tile !== origin) result.push(tile)

      if (remaining <= 0) continue

      for (const neighbor of this.getNeighbors(tile)) {
        const nKey = `${neighbor[0]},${neighbor[1]}`
        if (visited.has(nKey)) continue
        if (!this.isPassable(neighbor)) continue
        visited.add(nKey)
        queue.push({ tile: neighbor, remaining: remaining - 1 })
      }
    }

    return result
  }

  // ─────────────────────────────────────────────────────
  // 工具
  // ─────────────────────────────────────────────────────

  /** @private */
  _inBounds([tx, ty]) {
    return tx >= 0 && ty >= 0 && tx < this._data.cols && ty < this._data.rows
  }

  /** @private 从 A* 节点反推路径 */
  _reconstructPath(node) {
    const path = []
    let cur = node
    while (cur) {
      path.unshift(cur.tile)
      cur = cur.parent
    }
    return path
  }

  get cols() { return this._data.cols }
  get rows() { return this._data.rows }
}
