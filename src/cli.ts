#!/usr/bin/env bun
import { parseArgs } from 'node:util'
import JSZip from 'jszip'
import { Funscript } from './index'

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
})

const command = positionals[0]

if (values.help || !command) {
  printHelp()
  process.exit(0)
}

if (command === 'merge') {
  const folder = positionals[1]
  if (!folder) {
    console.error('Error: Please specify a folder to merge.')
    console.error('Usage: bunx @eroscripts/funlib merge <folder>')
    console.error('Example: bunx @eroscripts/funlib merge .')
    process.exit(1)
  }
  await mergeCommand(folder)
}
else {
  console.error(`Unknown command: ${command}`)
  printHelp()
  process.exit(1)
}

function printHelp() {
  console.log(`
@eroscripts/funlib CLI

Usage:
  bunx @eroscripts/funlib <command> [options]

Commands:
  merge <folder>    Merge multi-axis funscript files in a folder

Examples:
  bunx @eroscripts/funlib merge .
  bunx @eroscripts/funlib merge ./scripts

Options:
  -h, --help        Show this help message
`)
}

async function mergeCommand(folder: string) {
  const glob = new Bun.Glob('**/*.funscript')
  const files = await Array.fromAsync(glob.scan({ cwd: folder, absolute: true }))

  if (files.length === 0) {
    console.log(`No .funscript files found in ${folder}`)
    return
  }

  console.log(`Found ${files.length} funscript file(s)`)

  // Read and parse all scripts
  const scripts: Funscript[] = []
  for (const filePath of files) {
    const content = await Bun.file(filePath).text()
    const json = JSON.parse(content)
    const script = new Funscript(json, { file: filePath })
    scripts.push(script)
  }

  // Merge multi-axis scripts
  const merged = Funscript.mergeMultiAxis(scripts)

  if (merged.length === scripts.length) {
    console.log('No scripts to merge (all scripts are already standalone)')
    return
  }

  console.log(`Merged into ${merged.length} script(s)`)

  // Create backup zip
  const now = new Date()
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const zipPath = `${folder}/.processed-${timestamp}.zip`

  const zip = new JSZip()

  // Add all original files to zip
  for (const filePath of files) {
    const content = await Bun.file(filePath).text()
    const fileName = filePath.split(/[\\/]/).pop()!
    zip.file(fileName, content)
  }

  // Generate and write zip
  const zipContent = await zip.generateAsync({ type: 'nodebuffer' })
  await Bun.write(zipPath, zipContent)
  console.log(`Backup created: ${zipPath}`)

  // Delete original files
  for (const filePath of files) {
    await Bun.file(filePath).delete!()
  }

  // Write merged scripts
  for (const script of merged) {
    if (!script.file) {
      console.warn('Warning: Script has no file path, skipping')
      continue
    }
    const outputPath = script.file.filePath
    const content = script.toJsonText()
    await Bun.write(outputPath, content)
    console.log(`Written: ${outputPath}`)

    // Log which files were merged
    if (script.file.mergedFiles && script.file.mergedFiles.length > 1) {
      const mergedNames = script.file.mergedFiles.map(f => f.filePath.split(/[\\/]/).pop()).join(', ')
      console.log(`  (merged from: ${mergedNames})`)
    }
  }

  console.log('Done!')
}
