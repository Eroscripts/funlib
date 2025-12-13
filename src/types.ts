export declare const B: unique symbol
export interface B<Brand> {
  [B]?: Brand
}

export type axisPairs = [
  ['L0', 'stroke'],
  ['L1', 'surge'],
  ['L2', 'sway'],
  ['R0', 'twist'],
  ['R1', 'roll'],
  ['R2', 'pitch'],
  ['A1', 'suck'],
  // [string & B<'axis'>, string & B<'channel'>],
]

export type mantissa = number & B<[any, 'mantissa']>
export type mantissaText = string & B<[any, 'mantissa']>

// time variants
export type ms = number & B<['time', 'ms']>
export type seconds = number & B<['time', 's']>
export type timeSpan = string & B<['time', 'TimeSpan']>

export type speed = number & B<['speed', 'u/s']>
// export type speed10 = number & B<['speed', '0.1u/s']>

// axis value variants
/** 0-100 */
export type pos = number & B<['axis', 'u']> // 0-100
// export type axisNorm = number & B<['axis', 'mantissa']> // 0-1
// export type axisAngle = number & B<['axis', 'deg']> // in degrees
// export type axisRaw = number & B<['axis', 'deg' | 'mantissa']>

// axes
/** Identifier for an axis (L0-L2, R0-R2, A0-A2, V0-V2). Further axes /[LRAV][3-9]/ are not used by any known device. */
export type axisId = 'L0' | 'L1' | 'L2' | 'R0' | 'R1' | 'R2' | 'A0' | 'A1' | 'A2' | 'V0' | 'V1' | 'V2'
export type axis = axisPairs[number][0] | string & B<'axis'>
export type channel = string & B<'channel'>
export type channelName = axisPairs[number][1] & channel
export type axisLike = axis | channel
export type AxisToName = { [K in axisPairs[number] as K[0]]: K[1] } & { [K in axisPairs[number] as K[1]]: K[0] }

export type chapterName = string & B<['chapter', 'name']>

export type TCodeTuple = [axis: axis, pos: pos]
  | [axis: axis, pos: pos, 'I', interval: ms]
  | [axis: axis, pos: pos, 'S', speed: speed]

/** A single action point with time and position. */
export interface JsonAction {
  /** Time in milliseconds. Should be an integer, as some players don't support floats. Minimum: 0. */
  at: number
  /** Position value (0-100). Should be an integer, as some players don't support floats. Minimum: 0, Maximum: 100. */
  pos: number
}
/** Defines a chapter or segment within the script. */
export interface JsonChapter {
  /** Name of the chapter. */
  name: chapterName
  /** Start time of the chapter. */
  startTime: timeSpan
  /** End time of the chapter. */
  endTime: timeSpan
}
/** Optional metadata about the script. */
export interface JsonMetadata {
  /** Title of the script or video. */
  title?: string
  /** Duration of the video in seconds, with milliseconds precision. Minimum: 0. */
  duration?: seconds
  /** Human-readable duration hint (e.g. '00:03:00.017'). */
  durationTime?: timeSpan
  /** List of chapters. */
  chapters?: JsonChapter[]
  /** List of bookmarks. */
  bookmarks?: { name: string, time: timeSpan }[]
  /** Name of the script creator. */
  creator?: string
  /** General description. */
  description?: string
  /** License information. */
  license?: string
  /** Additional notes. */
  notes?: string
  /** Names of performers. */
  performers?: string[]
  /** Tags associated with the script. We recommend adding 'handy' tag for scripts supporting one. */
  tags?: string[]
  /** Type of the script. */
  type?: string
  /** URL to the topic or discussion thread. Format: uri. */
  topic_url?: string
  /** URL to the script source. Format: uri. */
  script_url?: string
  /** URL to the associated video. Format: uri. */
  video_url?: string
}
/** Schema for the Funscript format. */
export interface JsonFunscript {
  /** Funscript version string. Supports 1.0 (single-axis), 1.1 (multi-axis with axes array), and 2.0 (multi-axis with channels object). */
  version?: '1.0' | '1.1' | '2.0'
  /** Indicates if the axes movement is inverted. Deprecated: Not widely supported. */
  /** @deprecated Not widely supported */
  inverted?: boolean
  /** Specifies the range of motion (0-100). Deprecated: Not widely supported. Minimum: 0, Maximum: 100. */
  /** @deprecated Not widely supported */
  range?: number
  /** Default actions for the primary axis. The primary axis is L0 (stroke), or inferred from file extension prefix (e.g. 'video.roll.funscript' → R1). In version 2.0, if both `actions` and `channels.stroke` are present, player should prefer `actions` for single-axis devices (e.g., Handy), and `channels.stroke` for multi-axis devices (e.g., SR6). Required unless `channels` is provided. */
  actions?: JsonAction[]
  /** Actions defined per axis. Used in version 1.1 for multi-axis scripts. */
  axes?: { id: axisId, actions: JsonAction[] }[]
  /** Actions defined per channel. Used in version 2.0 for multi-axis scripts with named channels (e.g., stroke, roll, pitch, surge, sway, twist, suck). */
  channels?: Record<channel, { actions: JsonAction[] }>
  /** Human-readable channel name hint for the `actions` array. */
  channel?: channel
  metadata?: JsonMetadata
}
