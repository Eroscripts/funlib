import type { Funscript } from '../index'
import type { JsonAction, ms, pos, seconds, speed } from '../types'
import { orderTrimJson } from '../converter'
import { FunAction } from '../index'
import { clamplerp, clone, makeNonEnumerable, speedBetween } from '../misc'

export class LinkedFunAction extends FunAction {
  // --- Static Methods ---
  static linkList(list: LinkedFunAction[], extras: { parent?: Funscript | true }) {
    if (extras?.parent === true) extras.parent = list[0]?.parent
    for (let i = 1; i < list.length; i++) {
      list[i].prevAction = list[i - 1]
      list[i - 1].nextAction = list[i]
      if (extras?.parent) list[i].parent = extras.parent
    }
    return list
  }

  static cloneList(list: JsonAction[], extras: { parent?: Funscript | true }) {
    const parent = extras?.parent === true ? (list[0] as LinkedFunAction)?.parent : extras?.parent
    const newList = list.map(e => new LinkedFunAction(e, { parent }))
    return LinkedFunAction.linkList(newList, extras)
  }

  // --- Non-enumerable Properties ---
  parent?: Funscript
  prevAction?: LinkedFunAction
  nextAction?: LinkedFunAction

  // --- Constructor ---
  constructor(action?: JsonAction, extras?: { parent?: Funscript }) {
    super(action)
    this.parent = extras && 'parent' in extras
      ? extras.parent
      : (action instanceof LinkedFunAction ? action.parent : undefined)

    makeNonEnumerable(this, 'parent')
    makeNonEnumerable(this, 'prevAction')
    makeNonEnumerable(this, 'nextAction')
  }

  // --- Speed Calculations ---
  /** speed from prev to this */
  get speedTo(): speed {
    return speedBetween(this.prevAction, this)
  }

  /** speed from this to next */
  get speedFrom(): speed {
    return speedBetween(this, this.nextAction)
  }

  // --- Peak Detection ---
  get isPeak(): -1 | 0 | 1 {
    const { speedTo, speedFrom } = this
    // if there is no prev or next action, it's a peak because we need peaks at corners
    if (!this.prevAction && !this.nextAction) return 1
    if (!this.prevAction) return speedFrom < 0 ? 1 : 1
    if (!this.nextAction) return speedTo > 0 ? -1 : -1

    if (Math.sign(speedTo) === Math.sign(speedFrom)) return 0

    if (speedTo > speedFrom) return 1
    if (speedTo < speedFrom) return -1
    return 0
  }

  // --- Navigation Helpers ---
  /** Time difference to next action in milliseconds */
  get datNext(): ms {
    if (!this.nextAction) return 0 as ms
    return (this.nextAction.at - this.at) as ms
  }

  get datPrev(): ms {
    if (!this.prevAction) return 0 as ms
    return (this.at - this.prevAction.at) as ms
  }

  get dposNext(): pos {
    if (!this.nextAction) return 0 as pos
    return this.nextAction.pos - this.pos
  }

  get dposPrev(): pos {
    if (!this.prevAction) return 0 as pos
    return this.pos - this.prevAction.pos
  }

  // --- Enhanced Interpolation ---
  clerpAt(at: ms): pos {
    if (at === this.at) return this.pos
    if (at < this.at) {
      if (!this.prevAction) return this.pos
      return clamplerp(at, this.prevAction.at, this.at, this.prevAction.pos, this.pos)
    }
    if (at > this.at) {
      if (!this.nextAction) return this.pos
      return clamplerp(at, this.at, this.nextAction.at, this.pos, this.nextAction.pos)
    }
    return this.pos
  }

  // --- Clone with linking support ---
  clone(): this {
    // NOTE: This creates a shallow clone. The prevAction, nextAction
    // will be undefined in the new clone. They need to be relinked if the clone
    // is part of a list (e.g., using LinkedFunAction.linkList).
    return clone(this, { parent: this.parent })
  }
}
