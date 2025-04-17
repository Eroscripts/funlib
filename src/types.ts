/* eslint-disable ts/no-redeclare */

export declare const B: unique symbol
export interface B<Brand> {
  [B]?: Brand
}

export type axisPairs = [['L0', 'stroke'], ['L1', 'surge'], ['L2', 'sway'], ['R0', 'twist'], ['R1', 'roll'], ['R2', 'pitch']]

export type mantissa = number & B<[any, 'mantissa']>

// time variants
export type ms = number & B<['time', 'ms']>
export type seconds = number & B<['time', 's']>
export type timeSpan = string & B<['time', 'TimeSpan']>

export type speed = number & B<['speed', 'u/s']>

// axis value variants
export type axisValue = number & B<['axis', 'u']> // 0-100
export type axisNorm = number & B<['axis', 'mantissa']> // 0-1
export type axisAngle = number & B<['axis', 'deg']> // in degrees
export type axisRaw = number & B<['axis', 'deg' | 'mantissa']>

// axes
export type axis = `${'L' | 'R' | 'A'}${0 | 1 | 2}` & B<['axis', 'name']>
export type axisName = 'stroke' | 'surge' | 'sway' | 'twist' | 'roll' | 'pitch'
export type axisLike = axis | axisName
export type AxisToName = { [K in axisPairs[number] as K[0]]: K[1] } & { [K in axisPairs[number] as K[1]]: K[0] }

export type chapterName = string & B<['chapter', 'name']>

// aliases:
export type pos = axisValue
export type at = ms

export interface JsonAction {
  at: ms
  pos: axisValue
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
  actions: JsonAction[]
  // ids are L0..R2
  axes?: { id: axis, actions: JsonAction[] }[]
  metadata?: JsonMetadata
  // inverted?: boolean
  // range?: number
  // version?: string
}

declare global {
    type mantissa = import('./types').mantissa
    type ms = import('./types').ms
    type seconds = import('./types').seconds
    type timeSpan = import('./types').timeSpan
    type speed = import('./types').speed
    type axisValue = import('./types').axisValue
    type axisNorm = import('./types').axisNorm
    type axisAngle = import('./types').axisAngle
    type axisRaw = import('./types').axisRaw
    type axis = import('./types').axis
    type axisName = import('./types').axisName
    type axisLike = import('./types').axisLike
    type AxisToName = import('./types').AxisToName
    type chapterName = import('./types').chapterName
    type pos = import('./types').pos
    type at = import('./types').at
    type JsonAction = import('./types').JsonAction
    type JsonChapter = import('./types').JsonChapter
    type JsonMetadata = import('./types').JsonMetadata
    type JsonFunscript = import('./types').JsonFunscript
}
