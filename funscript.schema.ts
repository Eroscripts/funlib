// Based on funscript.schema.json

/**
 * Identifier for an axis (L0-L2, R0-R2, A0-A2, V0-V2).
 * Further axes /[LRAV][0-9]/ are not used by any known device.
 */
export type AxisId =
  | 'L0' | 'L1' | 'L2' // Linear axes (e.g., up/down)
  | 'R0' | 'R1' | 'R2' // Rotation axes (e.g., twist)
  | 'A0' | 'A1' | 'A2' // Auxiliary axes (e.g., suction)
  | 'V0' | 'V1' | 'V2' // Vibration axes

/** A single action point with time and position */
export interface Action {
  /**
   * Position value (0-100).
   * Should be an integer, as some players don't support floats.
   */
  pos: number
  /**
   * Time in milliseconds.
   * Should be an integer, as some players don't support floats.
   */
  at: number
}

export interface Axis {
  id: AxisId
  /** Actions for this specific axis */
  actions: Action[]
}

/** Time represented as a string, typically HH:MM:SS.ms or just seconds */
export type TimeSpan = string

/** Defines a chapter or segment within the script */
export interface Chapter {
  /** Name of the chapter */
  name: string
  /** Start time of the chapter */
  startTime: TimeSpan
  /** End time of the chapter */
  endTime: TimeSpan
}

/** A named time marker */
export interface Bookmark {
  /** Name of the bookmark */
  name: string
  /** Time position of the bookmark */
  time: TimeSpan
}

export interface Metadata {
  /** Title of the script or video */
  title?: string
  /**
   * Duration of the video in seconds.
   * Should be an integer, as some players don't support floats.
   */
  duration?: number
  /** List of chapters */
  chapters?: Chapter[]
  /** List of bookmarks */
  bookmarks?: Bookmark[]
  /** Name of the script creator */
  creator?: string
  /** General description */
  description?: string
  /** License information */
  license?: string
  /** Additional notes */
  notes?: string
  /** Names of performers */
  performers?: string[]
  /** URL to the script source */
  script_url?: string
  /**
   * Tags associated with the script
   * We recommend adding "handy" tag for scripts supporting one
   */
  tags?: string[]
  /** Type of the script */
  type?: string
  /** URL to the associated video */
  video_url?: string
}

/** Schema for the Funscript format */
export interface Funscript {
  /** Funscript version string */
  version?: '1.0' | '1.1'
  /**
   * Indicates if the axes movement is inverted
   * @deprecated This property is not widely supported
   */
  inverted?: boolean
  /**
   * Specifies the range of motion (0-100)
   * @deprecated This property is not widely supported
   */
  range?: number
  /** Default actions for the primary axis (usually L0/stroke) */
  actions: Action[]
  /** Actions defined per axis */
  axes?: Axis[]
  /** Optional metadata about the script */
  metadata?: Metadata
}
