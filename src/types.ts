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
export type pos = number & B<['axis', 'u']> // 0-100
// export type axisNorm = number & B<['axis', 'mantissa']> // 0-1
// export type axisAngle = number & B<['axis', 'deg']> // in degrees
// export type axisRaw = number & B<['axis', 'deg' | 'mantissa']>

// axes
export type axis = axisPairs[number][0] | string & B<'axis'>
export type channel = string & B<'channel'>
export type channelName = axisPairs[number][1] & channel
export type axisLike = axis | channel
export type AxisToName = { [K in axisPairs[number] as K[0]]: K[1] } & { [K in axisPairs[number] as K[1]]: K[0] }

export type chapterName = string & B<['chapter', 'name']>

export type TCodeTuple = [axis: axis, pos: pos]
  | [axis: axis, pos: pos, 'I', interval: ms]
  | [axis: axis, pos: pos, 'S', speed: speed]

export interface JsonAction {
  at: ms
  pos: pos
}
export interface JsonChapter {
  name: chapterName
  startTime: timeSpan
  endTime: timeSpan
}
export interface JsonMetadata {
  bookmarks?: { name: string, time: timeSpan }[]
  chapters?: JsonChapter[]
  duration?: seconds
  durationTime?: timeSpan
  // creator?: string
  // description?: string
  // license?: string
  // notes?: string
  // performers?: []
  // script_url?: string
  // type?: string
  // video_url?: string
  title?: string
  topic_url?: string
  tags?: string[]
}
export interface JsonFunscript {
  // ids are L0..R2
  /** @deprecated Use channel instead */
  id?: axis
  /** @deprecated Use channels instead */
  axes?: { id: axis, actions: JsonAction[], channel?: channel }[]
  // inverted?: boolean
  // range?: number
  // version?: string

  metadata?: JsonMetadata
  actions: JsonAction[]
  channel?: channel
  channels?: Record<channel, { actions: JsonAction[] }>
}
