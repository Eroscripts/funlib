import type { Funscript, TCodeTuple } from '..'
import { getTCodeAt, getTCodeFrom } from '../utils/tcode'
import { TCodeSerialPort } from './serialport'

/**
 * A reliable timer that ticks approximately every 4ms, synchronized with video frame updates.
 *
 * Uses `setInterval` for consistent timing and `requestAnimationFrame` to resync with the
 * browser's rendering cycle, ensuring ticks align with video frame boundaries. This provides
 * smooth, frame-accurate timing for video synchronization tasks.
 */
export class Ticker {
  ontick: () => (void | Promise<void>) = () => {}
  constructor(ontick?: () => void) {
    this.ontick = ontick ?? (() => {})
  }

  _interval = 0

  async tick() {
    try {
      await this.ontick()
    } catch (e) {
      console.error(e)
    }
  }

  start() {
    if (this._interval) clearInterval(this._interval)
    let int = this._interval = +setInterval(() => this.tick())

    void (async () => {
      while (true) {
        await new Promise(requestAnimationFrame)
        if (this._interval !== int) break
        clearInterval(this._interval)
        int = this._interval = +setInterval(() => this.tick())
        void this.tick()
      }
    })()
  }

  stop() {
    if (this._interval) clearInterval(this._interval)
    this._interval = 0
  }
}

export class TCodePlayer {
  video: HTMLVideoElement | undefined
  funscript: Funscript | undefined
  ticker: Ticker
  port: TCodeSerialPort | undefined

  constructor(video: HTMLVideoElement | undefined, funscript: Funscript | undefined) {
    this.video = video
    this.funscript = funscript
    this.ticker = new Ticker()
  }

  async requestPort() {
    await this.port?.close()
    this.port = undefined
    this.port = await TCodeSerialPort.requestPort()
  }

  run() {
    this.ticker.ontick = () => {
      const tcode = this.tCodeForState()
      if (tcode.length) {
        void this.port?.write(tcode)
      }
    }
    this.ticker.start()
  }

  stop() {
    this.ticker.stop()
  }

  prevState = { paused: true, currentTime: 0, seeking: false, since: undefined as number | undefined }
  tCodeForState(): TCodeTuple[] {
    if (!this.video || !this.funscript || !this.port) return []

    const { paused, currentTime, seeking } = this.video
    const at = currentTime * 1000
    const since = this.prevState.since
    let tcode: TCodeTuple[] = []
    if (seeking) { // Jumped
      tcode = [
        ...getTCodeAt(this.funscript, at),
        ...paused ? [] : getTCodeFrom(this.funscript, at),
      ]
    } else if (!this.prevState.paused && paused) { // Paused
      tcode = getTCodeAt(this.funscript, at)
    } else if (this.prevState.paused && !paused) { // Unpaused
      tcode = getTCodeFrom(this.funscript, at)
    } else if (!paused) { // Playing
      tcode = getTCodeFrom(this.funscript, at, since)
    }
    this.prevState = { paused, currentTime, seeking, since: at }
    return tcode
  }
}
