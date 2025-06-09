import type { ms, speed } from '.'
import { FunAction } from '.'
import { absSpeedBetween, lerp, listToSum, minBy, speedBetween, unlerp } from './misc'

/**
 * Converts an array of actions into an array of lines with speed calculations
 */
export function actionsToLines(actions: FunAction[]) {
  return actions.map((e, i, a) => {
    const p = a[i - 1]
    if (!p) return null!
    const speed = speedBetween(p, e)
    return Object.assign([p, e, Math.abs(speed)] as [FunAction, FunAction, number], {
      speed,
      absSpeed: Math.abs(speed),
      speedSign: Math.sign(speed),
      dat: e.at - p.at,
      atStart: p.at,
      atEnd: e.at,
    })
  }).slice(1).filter(e => e[0].at < e[1].at)
}

/**
 * Filters actions to create a zigzag pattern by removing actions with same direction changes
 */
export function actionsToZigzag(actions: FunAction[]) {
  return FunAction.cloneList(actions.filter(e => e.isPeak), {
    parent: true,
  })
}

/**
 * Merges line segments with similar speeds within a time limit
 */
export function mergeLinesSpeed(lines: ReturnType<typeof actionsToLines>, mergeLimit: number) {
  if (!mergeLimit) return lines
  let j = 0
  for (let i = 0; i < lines.length - 1; i = j + 1) {
    for (j = i; j < lines.length - 1; j++) {
      if (lines[i].speedSign !== lines[j + 1].speedSign) break
    }
    const f = lines.slice(i, j + 1)
    if (i === j) continue
    if (listToSum(f.map(e => e.dat)) > mergeLimit) continue
    const avgSpeed = listToSum(f.map(e => e.absSpeed * e.dat)) / listToSum(f.map(e => e.dat))
    f.map(e => e[2] = avgSpeed)
  }
  return lines
}

/**
 * Calculates weighted average speed from a set of lines
 */
export function calculateWeightedSpeed(lines: ReturnType<typeof actionsToLines>): number {
  if (lines.length === 0) return 0
  return listToSum(lines.map(e => e.absSpeed * e.dat)) / listToSum(lines.map(e => e.dat))
}

/**
 * Smooths out action positions using a moving average
 */
export function smoothActions(actions: FunAction[], windowSize: number = 3): FunAction[] {
  if (windowSize < 2) return actions
  return FunAction.cloneList(actions.map((action, i, arr) => {
    const start = Math.max(0, i - Math.floor(windowSize / 2))
    const end = Math.min(arr.length, start + windowSize)
    const window = arr.slice(start, end)
    const avgPos = window.reduce((sum, a) => sum + a.pos, 0) / window.length
    return new FunAction({
      at: action.at,
      pos: avgPos,
    })
  }), { parent: actions[0]?.parent })
}

export function actionsAverageSpeed(actions: FunAction[]) {
  const zigzag = actionsToZigzag(actions)
  const fast = zigzag.filter(e => Math.abs(e.speedTo) > 30)

  return listToSum(fast.map(e => Math.abs(e.speedTo) * e.datNext)) / (listToSum(fast.map(e => e.datNext)) || 1)
}
/**
 * while the device speed may be lower then the script's max speed
 * the device doesn't have to actually reach it - it needs just enough so to reach the next peak fast enough
 */
export function actionsRequiredMaxSpeed(actions: FunAction[]): speed {
  if (actions.length < 2) return 0

  const requiredSpeeds: [speed, ms][] = []

  let nextPeak: FunAction | undefined = actions[0]
  for (const a of actions) {
    if (nextPeak === a) {
      nextPeak = nextPeak.nextAction
      while (nextPeak && !nextPeak.isPeak) nextPeak = nextPeak.nextAction
    }
    if (!nextPeak) break
    requiredSpeeds.push([Math.abs(speedBetween(a, nextPeak)), nextPeak.at - a.at])
  }

  // sort by speed descending
  const sorted = requiredSpeeds.sort((a, b) => a[0] - b[0]).reverse()

  // return speed that is active for at least 50ms
  return sorted.find(e => e[1] >= 50)?.[0] ?? 0
}

/**
 * Smooths a 1D animation curve using a weighted moving average
 * @param curve - The original curve data points with time and position
 * @param timeRadius - Number of neighboring points to consider (odd number recommended)
 * @param iterations - Number of smoothing passes to apply
 * @param preserveEnds - Whether to keep the start/end points unchanged
 * @returns The smoothed curve (modified in place)
 */
export function smoothCurve(
  curve: FunAction[],
  timeRadius: ms = 50,
  iterations: number = 1,
  preserveEnds: boolean = false,
): FunAction[] {
  const radius = 5

  const positions = curve.map(e => e.pos)

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < curve.length; i++) {
      if (preserveEnds && (i === 0 || i === curve.length - 1)) {
        continue
      }

      let sum = 0
      let weightSum = 0

      for (let j = -radius; j <= radius; j++) {
        const index = i + j
        if (index >= 0 && index < curve.length) {
          // triangular weight distribution
          const weight = Math.max(0, timeRadius - Math.abs(curve[index].at - curve[i].at))
          sum += positions[index] * weight
          weightSum += weight
        }
      }

      curve[i].pos = positions[i] = sum / weightSum
    }
  }

  return FunAction.linkList(curve, {})
}

/**
 * Splits a curve into segments between peaks
 */
export function splitToSegments(actions: FunAction[]): FunAction[][] {
  const segments: FunAction[][] = []
  let prevPeakIndex = -1

  // Find segments between peaks
  for (let i = 0; i < actions.length; i++) {
    if (actions[i].isPeak !== 0) {
      if (prevPeakIndex !== -1) {
        segments.push(actions.slice(prevPeakIndex, i + 1))
      }
      prevPeakIndex = i
    }
  }

  return segments
}

/**
 * Connects segments back into a single array of actions
 */
export function connectSegments(segments: FunAction[][]): FunAction[] {
  return FunAction.linkList(
    segments.flat()
      .filter((e, i, a) => e !== a[i - 1]),
    { parent: true },
  )
}

/**
 * Removes redundant points from a curve where points lie on nearly straight lines
 */
export function simplifyLinearCurve(
  curve: FunAction[],
  threshold: number,
) {
  if (curve.length <= 2) {
    return FunAction.linkList(curve, { parent: true }) // Nothing to simplify
  }

  const segments = splitToSegments(curve)
  const simplifiedSegments = segments.map((segment) => {
    // First check if the entire segment can be simplified to just endpoints
    if (lineDeviation(segment) <= threshold) {
      return [segment[0], segment.at(-1)!]
    }

    const result = [segment[0]]
    let startIdx = 0

    // Examine each potential line segment
    while (startIdx < segment.length - 1) {
      let endIdx = startIdx + 2 // At least consider the next point

      // Try to extend the current line segment as far as possible
      while (endIdx <= segment.length - 1) {
        // Check if the current segment is straight enough
        if (lineDeviation(segment.slice(startIdx, endIdx + 1)) > threshold) {
          break
        }
        endIdx++
      }

      // We've found the longest valid line segment
      endIdx = Math.max(startIdx + 1, endIdx - 1)

      // Add the endpoint of this segment to our result
      result.push(segment[endIdx])

      // Move to the next segment
      startIdx = endIdx
    }

    return result
  })

  return connectSegments(simplifiedSegments)
}

const HANDY_MAX_SPEED = 550
const HANDY_MIN_INTERVAL = 60
const HANDY_MAX_STRAIGHT_THRESHOLD = 3
/**
 * Handy has a max speed and a min interval between actions
 * This function will smooth the actions to fit those constraints
 */
export function handySmooth(actions: FunAction[]): FunAction[] {
  actions = FunAction.cloneList(actions, { parent: true })
  // pass 0: round at values
  actions.map(e => e.pos = Math.round(e.pos))

  // pass 1: split into segments of [peak, ...nonpeaks, peak]
  const segments = splitToSegments(actions)

  // pass 2: remove non-peak actions that are too close to peaks
  function simplifySegment(segment: FunAction[]): FunAction[] {
    if (segment.length <= 2) return segment
    const first = segment[0], last = segment.at(-1)!
    let middle = segment.slice(1, -1)

    if (lineDeviation(segment) <= HANDY_MAX_STRAIGHT_THRESHOLD) return [first, last]
    if (absSpeedBetween(first, last) > HANDY_MAX_SPEED) return [first, last]

    // split to 2 parts cannot create too high speed
    middle = middle.filter((e) => {
      const speed = absSpeedBetween(first, e)
      const restSpeed = absSpeedBetween(e, last)
      return speed < HANDY_MAX_SPEED && restSpeed < HANDY_MAX_SPEED
    })

    // middle cannot contain points too close to first or last
    middle = middle.filter((e) => {
      return e.at - first.at >= HANDY_MIN_INTERVAL && last.at - e.at >= HANDY_MIN_INTERVAL
    })

    if (!middle.length) return [first, last]
    if (middle.length === 1) {
      return straigten([first, middle[0], last])
    }

    const middleDuration = middle.at(-1)!.at - middle[0].at
    if (middleDuration < HANDY_MIN_INTERVAL) {
      // can place only a single point in the middle
      // find the point that is closest to the middle of the segment
      const middlePoint = minBy(middle, e => Math.abs(e.at - middleDuration / 2))
      return straigten([first, middlePoint, last])
    }

    function straigten(segment: FunAction[]): FunAction[] {
      if (segment.length <= 2) return segment
      if (lineDeviation(segment) <= HANDY_MAX_STRAIGHT_THRESHOLD) return [segment[0], segment.at(-1)!]
      return segment
    }

    return [first, ...simplifySegment(middle), last]
  }

  const filteredSegments = segments.map((segment) => {
    return simplifySegment(segment)
  })
  let filteredActions = connectSegments(filteredSegments)

  // pass 3: merge points that are too close to each other
  for (let i = 1; i < filteredActions.length; i++) {
    // merge only poins that have <30 speed
    const current = filteredActions[i]
    const prev = filteredActions[i - 1]
    if (!current.isPeak && !prev.isPeak) continue
    const speed = absSpeedBetween(prev, current)
    if (speed > 10) continue

    prev.pos = lerp(prev.pos, current.pos, 0.5)
    prev.at = lerp(prev.at, current.at, 0.5)
    // remove current point
    filteredActions.splice(i, 1)
    i--

    // // If points are too close, remove the current point and adjust the previous point
    // if (current.at - prev.at < HANDY_MIN_INTERVAL) {
    //   // If points are too close, remove the current point and adjust the previous point
    //   // to be at the weighted average position based on time
    //   const nextPoint = filteredActions[i + 1]
    //   if (!nextPoint) continue // Skip if this is the last point

    //   const totalTime = nextPoint.at - prev.at
    //   const t = (current.at - prev.at) / totalTime
    //   prev.pos = lerp(prev.pos, nextPoint.pos, t)

    //   // Remove the current point
    //   filteredActions.splice(i, 1)
    //   i-- // Adjust index since we removed an element
    // }
  }

  filteredActions = FunAction.linkList(filteredActions, { parent: true })

  // pass 4: if the speed between two points is too high, move them closer together

  filteredActions = limitPeakSpeed(filteredActions, HANDY_MAX_SPEED)

  // pass 5: simplify the curve
  filteredActions = simplifyLinearCurve(filteredActions, HANDY_MAX_STRAIGHT_THRESHOLD)

  // pass 6: round at and pos values
  filteredActions.forEach((e) => {
    e.at = Math.round(e.at)
    e.pos = Math.round(e.pos)
  })

  return FunAction.linkList(filteredActions, { parent: true })
}

/**
 * Calculates maximum deviation of points from a straight line between endpoints
 */
export function lineDeviation(actions: FunAction[]): number {
  if (actions.length <= 2) return 0

  const first = actions[0]
  const last = actions.at(-1)!

  let maxDeviation = 0
  // Check each point's distance from the line between first and last
  for (let i = 1; i < actions.length - 1; i++) {
    const t = (actions[i].at - first.at) / (last.at - first.at)
    const expectedPos = first.pos + (last.pos - first.pos) * t
    const deviation = Math.abs(actions[i].pos - expectedPos)

    if (deviation > maxDeviation) maxDeviation = deviation
  }
  return maxDeviation
}

export function limitPeakSpeed(actions: FunAction[], maxSpeed: number): FunAction[] {
  const peaks = actionsToZigzag(actions)

  const poss = peaks.map(e => e.pos)
  for (let i = 0; i < 10; i++) {
    let retry = false
    // First calculate all changes
    const lchanges = Array.from({ length: poss.length }, () => 0)
    const rchanges = Array.from({ length: poss.length }, () => 0)
    for (let l = 0, r = 1; r < poss.length; l++, r++) {
      const left = peaks[l], right = peaks[r], absSpeed = Math.abs(left.speedFrom)
      if (absSpeed <= maxSpeed) continue
      const height = right.pos - left.pos
      const changePercent = (absSpeed - maxSpeed) / absSpeed
      const totalChange = height * changePercent
      // Split into left and right changes
      lchanges[l] += totalChange / 2
      rchanges[r] -= totalChange / 2
    }
    // Merge changes first
    const changes = Array.from({ length: poss.length }, (_, i) => {
      const lchange = lchanges[i]
      const rchange = rchanges[i]
      // If signs are different, use the max absolute value with original sign
      // If signs are same, sum them
      return Math.sign(lchange) === Math.sign(rchange)
        ? (Math.abs(lchange) > Math.abs(rchange) ? lchange : rchange)
        : lchange + rchange
    })
    // Apply all changes at once
    for (let i = 0; i < poss.length; i++) {
      poss[i] += changes[i]
      peaks[i].pos = poss[i]
    }

    const speed = Math.max(...peaks.map(peak => Math.abs(peak.speedFrom)))
    if (speed > maxSpeed) {
      retry = true
    }

    if (!retry) break
  }

  const segments = splitToSegments(actions)
  for (let i = 0; i < segments.length; i++) {
    const newLeftPos = peaks[i].pos, newRightPos = peaks[i + 1].pos
    const segment = segments[i]
    const leftAt = segment[0].at, rightAt = segment.at(-1)!.at
    for (let j = 0; j < segment.length; j++) {
      segment[j].pos = lerp(newLeftPos, newRightPos, unlerp(leftAt, rightAt, segment[j].at))
    }
  }

  return connectSegments(segments)
}
