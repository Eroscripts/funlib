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
export type axis = `${'L' | 'R' | 'A'}${0 | 1 | 2}` & B<['axis', 'name']>
export type axisName = axisPairs[number][1]
export type axisLike = axis | axisName
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
  // creator?: string
  // description?: string
  // license?: string
  // notes?: string
  // performers?: []
  // script_url?: string
  // tags?: []
  title?: string
  // type?: string
  // video_url?: string
}
export interface JsonFunscript {
  id?: axis
  actions: JsonAction[]
  // ids are L0..R2
  axes?: { id: axis, actions: JsonAction[] }[]
  metadata?: JsonMetadata
  // inverted?: boolean
  // range?: number
  // version?: string
}
