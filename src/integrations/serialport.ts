import type { TCodeTuple } from '../types'

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
    if (this.readable || this.writable) await this.close().catch(() => {})

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
  }

  // --- I/O ---
  async write(command: string | TCodeTuple): Promise<void> {
    if (!this._writer) throw new Error('Serial port is not open')
    const line = typeof command === 'string' ? command : tcodeTupleToString(command)
    await this._writer.write(line + '\n')
  }

  /** Read a chunk of decoded text (may be a partial line). */
  async read(): Promise<string | undefined> {
    const reader = this._reader
    if (!reader) return undefined
    const { value, done } = await reader.read()
    if (done) return undefined
    return value
  }

  async close() {
    // Stop any piping and settle streams
    try { await this._writer?.close() } catch {}
    try { await this._reader?.cancel() } catch {}

    this._writer?.releaseLock()
    this._reader?.releaseLock()

    this._ac?.abort()
    await Promise.allSettled([this._encoderClosed, this._decoderClosed])

    try { await super.close() } catch {}

    this._ac = undefined
    this._encoder = undefined
    this._encoderClosed = undefined
    this._writer = undefined
    this._decoder = undefined
    this._decoderClosed = undefined
    this._reader = undefined
  }
}

function tcodeTupleToString(tuple: TCodeTuple): string {
  const [axis, pos, tag, arg] = tuple as any
  const p = Math.round(pos as number)
  if (tag === 'I' || tag === 'S') return `${axis}${p}${tag}${Math.round(arg as number)}`
  return `${axis}${p}`
}
