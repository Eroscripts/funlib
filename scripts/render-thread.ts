// bun scripts/render-thread.ts <thread-id> --allow-edit

import { Funscript } from '@eroscripts/funlib'
import { Post } from '../scr/post'

const threadId = +process.argv[2]
if (!threadId) {
    console.error('Thread ID is required')
    process.exit(1)
}

const post = await new Post(threadId).load()

const robotSection = post.sections.find(s => s.name.includes('robot'))
    || post.addSection({ name: ':robot:', type: 'heading' })

const scripts = await post.fetchAllScripts(
    post.sections.filter(s => !s.name.includes('robot'))
)

const mul = Funscript.mergeMultiAxis(
    scripts.map(s => new Funscript(s.json, { filePath: s.name }))
)

const md: string[] = []


for (const fun of mul) {
    const upload = await post.uploadFunscriptWithPreview(fun, {
        handy: 'preview' // 'preview' | 'script' | undefined
    })
    md.push(upload.md)
}

await post.changeSection(robotSection, md.join('\n\n---\n\n'))

