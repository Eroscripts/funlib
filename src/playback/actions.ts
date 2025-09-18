import type { axis, JsonAction, ms } from '..'
import { FunAction, Funscript } from '..'

import { binaryFindLeftBorder, clerpAt } from '../manipulations'

export function getNextState(
  script: Funscript,
  at: ms,
): Record<axis, JsonAction | null> {
  const state: Record<string, JsonAction | null> = {}
  for (const axis of script.getAxes()) {
    const index = binaryFindLeftBorder(axis.actions, at)
    const nextAction = axis.actions[index + 1]

    if (nextAction) {
      state[axis.id] = nextAction
    } else if (axis.actions.length > 0) {
      // If we're after the last action, create a fake action 1s after the last one at pos 50
      const lastAction = axis.actions[axis.actions.length - 1]
      state[axis.id] = {
        at: lastAction.at + 1000,
        pos: 50,
      }
    } else {
      state[axis.id] = null
    }
  }
  return state
}

const _testScript = new Funscript({
  actions: [],
  axes: [
    {
      id: 'R1',
      actions: [
        { at: 0, pos: 0 },
        { at: 1000, pos: 100 },
        { at: 2000, pos: 0 },
      ],
    },
    {
      id: 'L1',
      actions: [{ at: 0, pos: 0 }, { at: 500, pos: 100 }, { at: 1500, pos: 0 }],
    },
  ],
})

export function scriptToOsr2(script: Funscript): Funscript {
  script = script.clone()

  const _L0 = script.getAxes(['L0']).pop()!
  const _L1 = script.getAxes(['L1']).pop()!
  const _L2 = script.getAxes(['L2']).pop()!
  const _R1 = script.getAxes(['R1']).pop()!
  const _R2 = script.getAxes(['R2']).pop()!

  return script
}

function mergeLintoR(L0: FunAction[], Lx: FunAction[], Ry: FunAction[]) {
  const allTimestamps = [...new Set([...L0, ...Lx, ...Ry].map(a => a.at))].sort((a, b) => a - b)
  return allTimestamps.map((at) => {
    const l0 = clerpAt(L0, at)
    const lx = clerpAt(Lx, at)
    const ry = clerpAt(Ry, at)

    const r1 = ry + Math.atan2(l0, l2) * (180 / Math.PI)
    const r2 = ry + Math.atan2(lx, l0) * (180 / Math.PI)

    return new FunAction({ at, pos: r1 })
  })
  //   L0 = L0.slice(); Lx = Lx.slice(); Ry = Ry.slice()

  //   // Collect all unique timestamps from all three arrays
  //   const allTimestamps = [...new Set([...L0, ...Lx, ...Ry].map(a => a.at))].sort((a, b) => a - b)

  //   // Helper function to ensure an array has actions at all timestamps
  //   function fillMissingActions(actions: FunAction[], timestamps: ms[]) {
  //     const existingTimes = new Set(actions.map(a => a.at))

  //     for (const timestamp of timestamps) {
  //       if (!existingTimes.has(timestamp)) {
  //         // Interpolate position at this timestamp
  //         const interpolatedPos = clerpAt(actions, timestamp)

  //         // Create new action and insert it in the correct position
  //         const newAction = new FunAction({ at: timestamp, pos: interpolatedPos })

  //         // Find insertion point to maintain sorted order
  //         const insertIndex = actions.findIndex(a => a.at > timestamp)
  //         if (insertIndex === -1) {
  //           actions.push(newAction)
  //         } else {
  //           actions.splice(insertIndex, 0, newAction)
  //         }
  //       }
  //     }
  //   }

//   // Fill missing actions for each array
//   fillMissingActions(L0, allTimestamps)
//   fillMissingActions(Lx, allTimestamps)
//   fillMissingActions(Ry, allTimestamps)
}
