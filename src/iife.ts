import * as Fun from '.'
// import { drawFunscriptGraph, drawFunscriptsCanvas, makeGradient } from './canvas'
import { TCodePlayer } from './player'

Object.assign(window, {
  Fun: {
    ...Fun,
    TCodePlayer,
    // drawFunscriptGraph,
    // makeGradient,
    // drawFunscriptsCanvas,
  },
})
