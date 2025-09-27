import * as Fun from '..'
import * as svg from '../rendering/svg'
import * as types from '../types'
import * as chapters from '../utils/chapters'
import * as converter from '../utils/converter'
import * as manipulations from '../utils/manipulations'
import * as misc from '../utils/misc'

Object.assign(window, {
  Fun: {
    ...Fun,
    svg: { ...svg },

    misc: { ...misc },

    converter: { ...converter },
    manipulations: { ...manipulations },
    chapters: { ...chapters },
    types: { ...types },
  },
})
