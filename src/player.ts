import type { Funscript } from '.'

export class TCodePlayer {
  video: HTMLVideoElement | undefined
  funscript: Funscript | undefined

  constructor(video: HTMLVideoElement | undefined, funscript: Funscript | undefined) {
    this.video = video
    this.funscript = funscript
    this.run()
  }

  port?: SerialPort
  writer?: WritableStreamDefaultWriter<string>

  async requestPort() {
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

  async run() {
    while (true) {
      await new Promise(requestAnimationFrame)
      const tcode = this.tCodeForState()
      if (tcode) {
        this.write(tcode)
      }
    }
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
