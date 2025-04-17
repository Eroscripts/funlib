/* eslint-disable regexp/no-super-linear-backtracking */
import { Funscript, handySmooth } from '@eroscripts/funlib'
import { api, fetchScript } from './api'
import { renderFunscript } from './rendering'

export interface ApiTopic extends Awaited<ReturnType<typeof api.getTopic>> { }
export interface ApiPost extends Awaited<ReturnType<typeof api.getPost>> { }
export interface UploadResult extends Awaited<ReturnType<typeof api.createUpload>> { }
export type sectionId = string & { _?: 'sectionId' }

let allowEdit = process.argv.includes('--allow-edit')
console.log('[Post] Allow edit:', allowEdit)

export class Post {
  readonly topicId: number

  get allowEdit() {
    return allowEdit
  }

  constructor(
    topicId: number,
  ) {
    this.topicId = topicId
  }

  readonly post!: ApiPost
  readonly topic!: ApiTopic

  readonly sections!: PostSection[]

  async load(): Promise<this> {
    console.log('[Post] Loading topic', this.topicId, '...')
    const topic = await api.getTopic({ id: `${this.topicId}` })
    Object.assign(this, { topic })
    return this._loadPost(this.topicId, topic, topic.post_stream.posts[0].id)
  }

  async loadPost(postId: number): Promise<Post> {
    if (postId < 10_000) {
      let _postId = postId
      postId = this.topic.post_stream.stream[postId - 1] as number
      console.log(`[Post] Converting postId ${_postId} to stream index ${postId}`)
    }
    let post = new Post(this.topicId)
    return await post._loadPost(this.topicId, this.topic, postId)
  }

  async _loadPost(topicId: number, topic: ApiTopic, postId: number): Promise<this> {
    console.log('[Post] Loading post', postId, '...')
    const post = await api.getPost({ id: `${postId}` })
    const sections: Omit<PostSection, 'raw' | 'scripts'>[] = []
    let rest = post.raw.replaceAll(
      /(?<open><!-- (?<name>\S.*?\S) --> *\n?)(?<content>[\s\S]*)(?<close><!-- \/?\2 -->\n?)/g,
      (...a) => {
        const { open, close, name, content } = a.pop()!
        sections.push({ type: 'section', name, content, wraps: [open, close] })
        return ''
      },
    ).replaceAll(
      /(?<open>(?<=\n|^)###\s+(?<name>.+?) *\n)(?<content>[\s\S]*?)(?=\n###|\n<!-- .* -->|$)/g,
      (...a) => {
        const { open, name, content } = a.pop()!
        sections.push({ type: 'heading', name, content, wraps: [open, ''] })
        return ''
      },
    )

    sections.push({ name: 'rest', type: 'rest', content: rest, wraps: ['', ''] })

    for (let s of sections) {
      let text = s.wraps[0] + s.content + s.wraps[1]
      if (!post.raw.includes(text) && s.type !== 'rest') {
        throw new Error('text not found')
      }
      Object.defineProperty(s, 'raw', { get: () => s.wraps[0] + s.content + s.wraps[1] })
      Object.assign(s, {
        scripts: Array.from((s as PostSection).raw.matchAll(/(?<!!)\[(?<name>[^|\n]*?)(?<attachment>\|attachment)?\]\(upload:\/\/(?<upload>.*?)\)/g))
          .map(m => ({
            name: m.groups!.name,
            upload: m.groups!.upload,
          })),
      })
    }

    Object.assign(this, { topic, post, sections })

    return this
  }

  async fetchAllScripts(sections?: PostSection[] | PostSection | sectionId) {
    if (typeof sections === 'string')
      sections = this.sections.find(s => s.name === sections)!
    if (sections && !Array.isArray(sections))
      sections = [sections]
    sections ??= this.sections

    const scripts = sections.flatMap(s => s.scripts)

    return await Promise.all(scripts.map(async ({ name, upload }) => {
      console.log('[Post] Fetching script', name, '...')
      const { json, filename } = await fetchScript(upload)
      if (name !== filename) {
        console.log({ name, filename })
        throw new Error('name !== filename', { cause: [name, filename] })
      }
      return { name, upload, json, filename }
    }))
  }

  async generateAndUploadFunscriptPreview(fun: Funscript) {
    console.log('[Post] Generating preview for', fun.filePath, '...')
    const { webp, width, height } = await renderFunscript(fun)

    console.log('[Post] Uploading preview for', fun.filePath, '...')
    const uploadResult = await api.createUpload({
      type: 'composer',
      file: new File([webp], `${fun.filePath}.webp`, { type: 'image/webp' }),
    })
    return Object.assign(uploadResult, {
      x: `${width}x${height}`,
    })
  }

  async uploadFunscript(fun: Funscript) {
    const jsonText = new Funscript(fun).normalize().toJsonText()
    console.log(`[Post] Uploading ${fun.axes.length + 1}-axis funscript ${fun.filePath}...`)
    let uploadResult = await api.createUpload({
      type: 'composer',
      file: new File([jsonText], `${fun.filePath}`, { type: 'application/json' }),
    })
    console.log('[Post] Uploaded funscript', fun.filePath, 'to', uploadResult.original_filename)
    if (fun.filePath !== uploadResult.original_filename) {
      console.log('[Post] Reuploading funscript', fun.filePath, '...')
      uploadResult = await api.createUpload({
        type: 'composer',
        file: new File([`${jsonText} `], `${fun.filePath}`, { type: 'application/json' }),
      })
      console.log('[Post] re-uploaded funscript', fun.filePath, 'to', uploadResult.original_filename)
      if (fun.filePath !== uploadResult.original_filename) {
        throw new Error('fun.filePath !== uploadResult.original_filename')
      }
    }
    Object.defineProperty(uploadResult, 'funscript', { get: () => fun })
    return uploadResult as UploadResult & { get funscript(): Funscript }
  }

  async uploadFunscriptWithPreview(fun: Funscript, options: {
    handy?: 'script' | 'preview'
  } = {}) {
    if (!fun)
      throw new Error('fun is undefined')
    const cleanMul = new Funscript(fun)
    cleanMul.axes.map((e: { filePath: string }) => e.filePath = ' ')

    const preview = await this.generateAndUploadFunscriptPreview(cleanMul)
    const mul = await this.uploadFunscript(fun)

    const parts = fun.axes.length === 0
      ? []
      : [fun, ...fun.axes].map(e => new Funscript(e))
    parts.map(e => e.axes = [])

    let uploadedParts = await Promise.all(parts.map(f => this.uploadFunscript(f)))
    let handy: Awaited<ReturnType<typeof this.uploadFunscript>> | undefined
    let handyPreview: Awaited<ReturnType<typeof this.generateAndUploadFunscriptPreview>> | undefined
    let handyMd = ''

    if (options.handy) {
      let handyScript = new Funscript(fun)
      handyScript.actions = handySmooth(fun.actions)
      handyScript.axes = []
      handyScript._isForHandy = true as any
      handy = await this.uploadFunscript(handyScript)
      if (options.handy === 'script') {
        handyMd = `\n\n[:ok_hand: ${handy.original_filename}](${handy.short_url}) - for Handy (${handy.human_filesize})`
      }
      else if (options.handy === 'preview') {
        handyPreview = await this.generateAndUploadFunscriptPreview(handyScript)
        let previewMd = `![${handyPreview.original_filename}|${handyPreview.x}](${handyPreview.short_url})`
        handyMd = `\n\n[${previewMd}\n:ok_hand: ${handy.original_filename}](${handy.short_url}) (${handy.human_filesize})`
      }
    }

    // [![shaggysusu-citlali-animation_1080p_4x.webp|690x160](https://eroscripts-discourse.eroscripts.com/original/4X/b/f/f/bffb54d0e3812dbe11334c57cc00a732bdaa9b91.webp)
    //     :input_symbols: shaggysusu-citlali-animation_1080p.funscript](upload://dwY4NJi4MMYGjEwUPVSM4BZ6xn4.funscript) (155.3 KB)
    //     [small] ^ single-file multi-axis for MFP, should work as single-axis in other players [/small]

    //     [details="Split axes"]
    //     [shaggysusu-citlali-animation_1080p.funscript|attachment](upload://dwY4NJi4MMYGjEwUPVSM4BZ6xn4.funscript) (155.3 KB)
    //     [shaggysusu-citlali-animation_1080p.surge.funscript|attachment](upload://grzk60miHjDuGBHn6o5pXeyhufk.funscript) (50.9 KB)
    //     [shaggysusu-citlali-animation_1080p.pitch.funscript|attachment](upload://iaJQUNQdexi7Re2nGeG1JmiEAvw.funscript) (32.3 KB)
    //     [/details]

    const isMulti = fun.axes.length > 0
    const previewMd = `![${preview.original_filename}|${preview.x}](${preview.short_url})`
    const scriptMd = `[${previewMd}\n${isMulti ? ':input_symbols: ' : ''}${mul.original_filename}](${mul.short_url}) (${mul.human_filesize})`

    const axesMd = uploadedParts.map(e => `[${e.original_filename}](${e.short_url}) (${e.human_filesize})`).join('\n')
    const smallMd = `[small] ^ single-file multi-axis for MFP, should work as single-axis in other players [/small]`
    const detailsMd = `[details="Split axes"]\n${axesMd}\n[/details]`
    const md = !isMulti ? `${scriptMd}${handyMd}` : `${scriptMd}\n\n${smallMd}${handyMd}\n\n${detailsMd}`

    return {
      preview,
      script: mul,
      axes: uploadedParts,
      handy,
      md,
    }
  }

  async changeSection(section: PostSection, content: string) {
    let sraw = section.raw
    if (typeof sraw === 'string' && !this.post.raw.includes(sraw)) {
      throw new Error('section not found')
    }
    const newContent = section.wraps[0] + content + section.wraps[1]

    let newRaw = this.post.raw = this.post.raw.replace(sraw, newContent)
    if (this.allowEdit) {
      if (newContent === sraw) {
        console.log(`Section ${section.name} is already ${newContent.replaceAll(/^|\n/g, '\n= ')}`)
        return
      }
      await api.updatePost({
        id: `${this.post.id}`,
        post: {
          raw: newRaw,
        },
      })
      console.log(`[Post] Edited section ${section.name}: ${sraw.replaceAll(/^|\n/g, '\n- ')}${newContent.replaceAll(/^|\n/g, '\n+ ')}`)
    }
    else {
      console.log('[Post] Edits are disabled, here\'s result:', newContent === sraw ? '(no changes)' : '')
      console.log(newContent)
    }
  }

  addSection({ type, name }: Pick<PostSection, 'type' | 'name'>) {
    if (this.sections.find(s => s.name === name)) {
      throw new Error(`Section ${name} already exists`)
    }
    this.sections.push({
      name,
      content: '',
      type,
      wraps: type === 'heading' ? [`\n\n### ${name}\n`, '\n']
      :    [`\n\n<!-- ${name} -->\n`, `\n<!-- /${name} -->\n`],
      raw: /$/ as any,
      scripts: [],
    })
    return this.sections.at(-1)!
  }

  async changeRaw(raw: string) {
    if (this.allowEdit) {
      await api.updatePost({
        id: `${this.post.id}`,
        post: { raw },
      })
    }
    else {
      console.log('[Post] Edits are disabled, here\'s result:', raw === this.post.raw ? '(no changes)' : '')
      console.log(raw)
    }
  }
}

/**
 * Section is a part of post that starts with ### or starts and ends with <!-- section -->
 */
interface PostSection {
  type: 'heading' | 'section' | 'rest'
  name: string
  content: string
  wraps: [string, string]
  get raw(): string
  scripts: {
    name: string
    upload: string
  }[]
}
