import type { Funscript } from '..'

class Ticker {
  ontick = () => {}
  constructor(ontick?: () => void) {
    this.ontick = ontick ?? (() => {})
  }

  #interval = 0

  async tick() {
    try {
      await this.ontick()
    } catch (e) {
      console.error(e)
    }
  }

  async start() {
    if (this.#interval) clearInterval(this.#interval)
    let int = this.#interval = +setInterval(() => this.tick)

    while (true) {
      await new Promise(requestAnimationFrame)
      if (this.#interval !== int) break
      clearInterval(this.#interval)
      int = this.#interval = +setInterval(() => this.tick)
      this.tick()
    }
  }

  async stop() {
    if (this.#interval) clearInterval(this.#interval)
    this.#interval = 0
  }
}

export class TCodePlayer {
  video: HTMLVideoElement | undefined
  funscript: Funscript | undefined
  ticker: Ticker

  constructor(video: HTMLVideoElement | undefined, funscript: Funscript | undefined) {
    this.video = video
    this.funscript = funscript
    this.ticker = new Ticker()
  }

  port?: SerialPort
  writer?: WritableStreamDefaultWriter<string>

  async requestPort(disconnect = false) {
    if (this.port && !disconnect) return
    if (disconnect) {
      this.port?.close()
      this.port = undefined
      this.writer?.close()
      this.writer = undefined
    }
    this.port = await navigator.serial.requestPort()
    this.port.ondisconnect = () => {
      this.port?.close()
      this.port = undefined
      this.writer?.close()
      this.writer = undefined
    }
    await this.port.open({ baudRate: 115200 })
    const encoder = new TextEncoderStream()
    encoder.readable.pipeTo(this.port.writable!)
    this.writer = encoder.writable.getWriter()
  }

  write(output: string) {
    output = output.replaceAll('_', '')
    if (!output.trim()) return
    console.log('TCodePlayer: Writing', JSON.stringify(output))
    this.writer?.write(output)
  }

  run() {
    this.ticker.ontick = () => {
      const tcode = this.tCodeForState()
      if (tcode) {
        this.write(tcode)
      }
    }
    this.ticker.start()
  }

  stop() {
    this.ticker.stop()
  }

  tcodeOptions = { format: true, precision: 2 }
  prevState = { paused: true, currentTime: 0, seeking: false }
  tCodeForState(): string {
    if (!this.video || !this.funscript) return ''

    const { paused, currentTime, seeking } = this.video
    const at = currentTime * 1000
    let tcode = ''
    if (seeking) { // Jumped
      tcode = this.funscript.getTCodeAt(at).toString(this.tcodeOptions)
      if (!paused) {
        tcode = tcode.slice(0, -1) + ' '
        tcode += this.funscript.getTCodeFrom(at).toString(this.tcodeOptions)
      }
    } else if (!this.prevState.paused && paused) { // Paused
      tcode = this.funscript.getTCodeAt(at).toString(this.tcodeOptions)
    } else if (this.prevState.paused && !paused) { // Unpaused
      tcode = this.funscript.getTCodeFrom(at).toString(this.tcodeOptions)
    } else if (!paused) { // Playing
      tcode = this.funscript.getTCodeFrom(at, this.prevState.currentTime * 1000).toString(this.tcodeOptions)
    }
    this.prevState = { paused, currentTime, seeking }
    return tcode
  }
}
