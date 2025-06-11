import * as Fun from '.'
import * as chapters from './chapters'
import * as converter from './converter'
import * as manipulations from './manipulations'
import * as misc from './misc'
import * as player from './playback/player'
import * as renderingCanvas from './rendering/canvas'
import * as renderingHybrid from './rendering/hybrid'
import * as svg from './rendering/svg'
import * as types from './types'

Object.assign(window, {
  Fun: {
    ...Fun,
    svg: { ...svg },

    misc: { ...misc },
    player: { ...player },
    canvas: { ...renderingCanvas },
    hybrid: { ...renderingHybrid },

    converter: { ...converter },
    manipulations: { ...manipulations },
    chapters: { ...chapters },
    types: { ...types },
  },
})
