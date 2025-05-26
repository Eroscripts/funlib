import * as Fun from '.'
import { drawFunscriptGraph, drawFunscriptsCanvas, makeGradient } from './canvas'
import { orderByAxis } from './converter'
import { TCodePlayer } from './player'

Object.assign(window, {
  Fun: {
    ...Fun,
    TCodePlayer,
    drawFunscriptGraph,
    makeGradient,
    drawFunscriptsCanvas,
    misc: {
      orderByAxis,
    },
  },
})
