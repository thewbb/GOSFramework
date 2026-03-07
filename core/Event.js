
/**
 * GOS Framework — Event.js
 * 职责：全局事件总线 + 事件名常量表
 * 依赖：无
 */

// ─────────────────────────────────────────────────────────
// EventBus
// ─────────────────────────────────────────────────────────

export class EventBus {

  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map()
  }

  /**
   * 监听事件
   * @param {string}   event   - 使用 Events.XXX 常量
   * @param {Function} handler
   */
  on(event, handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set())
    }
    this._listeners.get(event).add(handler)
  }

  /**
   * 监听一次，触发后自动移除
   * @param {string}   event
   * @param {Function} handler
   */
  once(event, handler) {
    const wrapper = (payload) => {
      handler(payload)
      this.off(event, wrapper)
    }
    this.on(event, wrapper)
  }

  /**
   * 移除监听
   * @param {string}   event
   * @param {Function} handler
   */
  off(event, handler) {
    this._listeners.get(event)?.delete(handler)
  }

  /**
   * 触发事件
   * @param {string} event
   * @param {object} payload
   */
  emit(event, payload = {}) {
    this._listeners.get(event)?.forEach(handler => handler(payload))
  }
}

// ─────────────────────────────────────────────────────────
// Events 常量表
// ─────────────────────────────────────────────────────────

export const Events = {

  // 回合
  TURN_START:    'turnStart',    // { team: 'player'|'enemy', turn: number }
  TURN_END:      'turnEnd',      // { team: 'player'|'enemy' }

  // 单位行动
  UNIT_MOVED:    'unitMoved',    // { unit: Unit, from: [tx,ty], to: [tx,ty] }
  UNIT_ATTACKED: 'unitAttacked', // { attacker: Unit, target: Unit, damage: number }
  UNIT_HP_BELOW: 'unitHpBelow', // { unit: Unit, threshold: number }
  UNIT_DIED:     'unitDied',     // { unit: Unit }

  // 阵营
  TEAM_WIPED:    'teamWiped',    // { team: 'player'|'enemy' }

  // 地图
  TILE_ENTERED:  'tileEntered',  // { unit: Unit, tile: [tx,ty] }

  // 叙事
  DIALOG_DONE:   'dialogDone',   // { key: string }

  // 关卡结果
  LEVEL_WIN:     'levelWin',     // {}
  LEVEL_LOSE:    'levelLose',    // {}
}
