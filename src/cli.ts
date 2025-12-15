#!/usr/bin/env bun
import { parseArgs } from 'node:util'
import JSZip from 'jszip'
import { Funscript } from './index'

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    'help': { type: 'boolean', short: 'h' },
    'missing-stroke': { type: 'string', default: 'error' },
    'dry-run': { type: 'boolean', short: 'n', default: false },
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
  const missingStroke = values['missing-stroke'] as 'error' | 'empty-base' | 'leave'
  if (!['error', 'empty-base', 'leave'].includes(missingStroke)) {
    console.error(`Error: Invalid --missing-stroke value: ${missingStroke}`)
    console.error('Valid values: error, empty-base, leave')
    process.exit(1)
  }
  await mergeCommand(folder, { dryRun: values['dry-run'] ?? false, missingStroke })
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
  bunx @eroscripts/funlib merge ./scripts --missing-stroke=leave

Options:
  -h, --help                  Show this help message
  -n, --dry-run               Show what would be done without making changes
  --missing-stroke=<mode>     What to do when secondary axes have no main stroke script
                              error (default) - throw an error
                              empty-base - merge with empty stroke channel
                              leave - leave unmerged (still processed)
`)
}

async function mergeCommand(folder: string, options: { dryRun: boolean, missingStroke: 'error' | 'empty-base' | 'leave' }) {
  const { dryRun, missingStroke } = options
  if (dryRun) {
    console.log('[DRY RUN] Previewing changes (no files will be modified)\n')
  }
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
  let merged: Funscript[]
  try {
    merged = Funscript.mergeMultiAxis(scripts, {
      missingStroke,
    })
  }
  catch (e) {
    if (e instanceof Error && e.message.includes('no base script')) {
      console.error(`Error: ${e.message}`)
      console.error('\nUse --missing-stroke to handle secondary axes without a main stroke:')
      console.error('  --missing-stroke=empty-base  Merge with empty stroke channel')
      console.error('  --missing-stroke=leave       Leave unmerged')
      process.exit(1)
    }
    throw e
  }

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
  if (!dryRun) {
    await Bun.write(zipPath, zipContent)
  }
  console.log(`${dryRun ? '[DRY RUN] Would create backup' : 'Backup created'}: ${zipPath}`)

  // Delete original files
  if (!dryRun) {
    for (const filePath of files) {
      await Bun.file(filePath).delete!()
    }
  }

  // Write merged scripts
  for (const script of merged) {
    if (!script.file) {
      console.warn('Warning: Script has no file path, skipping')
      continue
    }
    const outputPath = script.file.filePath
    const content = script.toJsonText()
    if (!dryRun) {
      await Bun.write(outputPath, content)
    }
    console.log(`${dryRun ? '[DRY RUN] Would write' : 'Written'}: ${outputPath}`)

    // Log which files were merged
    if (script.file.mergedFiles && script.file.mergedFiles.length > 1) {
      const mergedNames = script.file.mergedFiles.map(f => f.filePath.split(/[\\/]/).pop()).join(', ')
      console.log(`  (merged from: ${mergedNames})`)
    }
  }

  console.log(dryRun ? '\n[DRY RUN] No changes were made' : 'Done!')
}
