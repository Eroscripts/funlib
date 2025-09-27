import type { axis, TCodeTuple } from '../types'
import { channelNameToAxis } from '../utils/converter'
import { toMantissa } from '../utils/misc'

/**
 * Lightweight subclass wrapper over Web Serial `SerialPort` that wires up
 * text encoder/decoder and provides tcode-friendly write helpers.
 */
export class TCodeSerialPort extends SerialPort {
  private _ac?: AbortController
  private _encoder?: TextEncoderStream
  private _encoderClosed?: Promise<void>
  private _writer?: WritableStreamDefaultWriter<string>
  private _decoder?: TextDecoderStream
  private _decoderClosed?: Promise<void>
  private _reader?: ReadableStreamDefaultReader<string>

  _initialBuffer!: string[]
  device!: string
  tcodeVersion!: string
  limits!: Record<axis, {
    axis: axis
    min: number
    max: number
    label: string
    respect: 'clamp' | 'scale' | 'ignore'
  }>

  // --- Static helpers ---
  static async requestPort(): Promise<TCodeSerialPort> {
    const port = await navigator.serial.requestPort()
    return Object.setPrototypeOf(port, this.prototype) as TCodeSerialPort
  }

  static async open(options: SerialOptions = { baudRate: 115200 }): Promise<TCodeSerialPort> {
    const port = await this.requestPort()
    await port.open(options)
    return port
  }

  // --- Lifecycle ---
  async open(options: SerialOptions = { baudRate: 115200 }) {
    if (this.readable || this.writable) await this.close().catch(() => { })

    await super.open(options)
    this._ac = new AbortController()

    // writer: string -> Uint8Array -> serial
    this._encoder = new TextEncoderStream()
    const serialWritable = this.writable as unknown as WritableStream<Uint8Array>
    this._encoderClosed = this._encoder.readable.pipeTo(serialWritable, { signal: this._ac.signal })
    this._writer = this._encoder.writable.getWriter()

    // reader: serial -> Uint8Array -> string
    this._decoder = new TextDecoderStream()
    const decoderWritable = this._decoder.writable as unknown as WritableStream<Uint8Array>
    this._decoderClosed = this.readable!.pipeTo(decoderWritable, { signal: this._ac.signal })
    this._reader = this._decoder.readable.getReader()

    void this._pull()
    await sleep(200)
    this._initialBuffer = this._dumpBuffer()
    this.device = (await this._runCommand('D0')).pop()!
    this.tcodeVersion = (await this._runCommand('D1')).pop()!
    const axesParameters = await this._runCommand('D2')
    this.limits = Object.fromEntries(axesParameters.map((e) => {
      const [axis, min, max, label] = e.split(' ')
      const respect: 'clamp' | 'scale' | 'ignore'
        = ['L0', 'R0'].includes(axis)
          ? 'scale'
          : 'clamp'
      return [axis, { axis, min: +min / 100, max: +max / 100, label, respect }]
    })) as any
  }

  // --- I/O ---
  async write(command: string | TCodeTuple): Promise<void> {
    if (!this._writer) throw new Error('Serial port is not open')
    if (typeof command !== 'string') command = this.tcodeTupleToString(command)
    command = command.replaceAll('_', '')
    await this._writer.write(command + '\n')
  }

  _partialRead?: string
  _readBuffer?: string[]
  _pullPromise?: PromiseWithResolvers<void>
  async _pull() {
    this._partialRead = ''
    this._readBuffer = []
    this._pullPromise = Promise.withResolvers()
    while (this._reader) {
      const { value, done } = await this._reader!.read()
      if (done) {
        break
      }
      this._partialRead += value
      const lines: string[] = this._partialRead!.split(/\r?\n/)
      this._partialRead = lines.pop()!
      this._readBuffer.push(...lines)
      const pp = this._pullPromise
      this._pullPromise = Promise.withResolvers()
      pp.resolve()
    }
  }

  _dumpBuffer() {
    const buffer = this._readBuffer ?? []
    this._readBuffer = []
    return buffer
  }

  async close() {
    // Stop any piping and settle streams
    try { await this._writer?.close() } catch { }
    try { await this._reader?.cancel() } catch { }

    this._writer?.releaseLock()
    this._reader?.releaseLock()

    this._ac?.abort()
    await Promise.allSettled([this._encoderClosed, this._decoderClosed])

    try { await super.close() } catch { }

    this._ac = undefined
    this._encoder = undefined
    this._encoderClosed = undefined
    this._writer = undefined
    this._decoder = undefined
    this._decoderClosed = undefined
    this._reader = undefined
  }

  async _runCommand(command: string) {
    this._dumpBuffer()
    await this.write(command)
    while (!this._readBuffer?.includes('')) {
      await this._pullPromise?.promise
      await sleep(50)
    }
    return this._dumpBuffer().filter(line => line !== '')
  }

  move(...args: TCodeTuple) {
    return this.write(this.tcodeTupleToString(args))
  }

  tcodeTupleToString(tuple: TCodeTuple): string {
    let [axis, pos, tag, arg] = [...tuple]
    axis = channelNameToAxis(axis as any, axis)

    const { min, max, respect } = this.limits[axis]
    if (respect === 'clamp') {
      pos = Math.min(Math.max(pos, min), max)
    } else if (respect === 'scale') {
      pos = min + pos * (max - min)
      if (tag === 'S') arg! *= (max - min) / 100
    }

    if (!axis.match(/^[LRVA]\d$/)) throw new Error(`Invalid axis: ${axis}`)
    const text = toMantissa(pos)
    if (tag === 'I' || tag === 'S') return `${axis}${text}${tag}${Math.round(arg as number)}`
    return `${axis}${text}`
  }

  async setLimits(axis: axis, min: number, max: number) {
    this.limits[axis].min = min
    this.limits[axis].max = max
    // $L0-0000-9999
    await this.write(`$${axis}-${toMantissa(min)}-${toMantissa(max)}`)
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
