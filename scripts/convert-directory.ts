import { existsSync, mkdirSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { join, parse, relative } from 'node:path'
import { Funscript } from '../src'

// Process command line arguments
const args = process.argv.slice(2)
let recursive = false
let dirPath = ''

// Parse arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--recurse' || args[i] === '-r') {
    recursive = true
  }
  else {
    dirPath = args[i]
  }
}

if (!dirPath) {
  console.error('Usage: bun scripts/convert-directory.ts [--recurse|-r] <folder_path>')
  process.exit(1)
}

const directoryPath = dirPath

// Ensure directory exists
if (!existsSync(directoryPath)) {
  console.error(`Directory does not exist: ${directoryPath}`)
  process.exit(1)
}

// Function to get all files recursively, grouped by directory
function getAllFiles(rootDir: string): string[][] {
  const filesByDir = new Map<string, string[]>()

  function traverse(dir: string) {
    // Initialize array for this directory if it doesn't exist
    if (!filesByDir.has(dir)) {
      filesByDir.set(dir, [])
    }

    const files = readdirSync(dir)

    files.forEach((file) => {
      const filePath = join(dir, file)

      // Skip .processed directories
      if (file === '.processed') return

      if (statSync(filePath).isDirectory()) {
        if (recursive) {
          traverse(filePath)
        }
      }
      else {
        // Add file to its directory's array
        filesByDir.get(dir)!.push(filePath)
      }
    })
  }

  traverse(rootDir)

  // Convert Map to array of arrays and return
  return Array.from(filesByDir.values())
}

// Create a single .processed directory at the root
const processedDir = join(directoryPath, '.processed')
if (!existsSync(processedDir)) {
  mkdirSync(processedDir)
}

// Helper function to ensure a directory exists, creating it if necessary
function ensureDirExists(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

// Get all files in the directory (recursively if specified), grouped by directory
const fileGroups = getAllFiles(directoryPath)

// Flatten and filter for funscript files
const funscriptPaths = fileGroups.flat().filter(path => path.endsWith('.funscript'))
// Keep all files for media file detection
const allFiles = fileGroups.flat()

// Check if a script needs processing
async function shouldProcessScript(mergedScript: Funscript): Promise<boolean> {
  const { dir: scriptDir, name: scriptName } = parse(mergedScript.filePath)

  // Get base name without axis specifier
  const baseNameMatch = scriptName.match(/^(.+?)(?:\.(stroke|surge|sway|twist|roll|pitch|L0|L1|L2|R0|R1|R2))?$/)
  if (!baseNameMatch) return false

  let baseName = baseNameMatch[1]

  // If the base name already ends with .max, strip it for consistency
  if (baseName.endsWith('.max')) {
    baseName = baseName.slice(0, -4)
  }

  // Check if it's truly multi-axis
  const isMultiAxis = mergedScript.axes && mergedScript.axes.length > 0
  const outputSuffix = isMultiAxis ? '.max.funscript' : '.funscript'

  // The output path for the merged script
  const outputPath = join(scriptDir, `${baseName}${outputSuffix}`)

  // Get the merged content as text for comparison
  const mergedContent = mergedScript.toJsonText()

  // First check if the output file already exists with identical content
  if (existsSync(outputPath)) {
    const existingContent = await Bun.file(outputPath).text()
    if (existingContent === mergedContent) {
      console.log(`  No changes needed for ${outputPath}, skipping`)
      return false
    }
  }

  // Also check if they exist as regular funscript with identical content
  // Only needed for non-multi-axis scripts to avoid duplicate processing
  if (!isMultiAxis) {
    const regularPath = join(scriptDir, `${baseName}.funscript`)
    if (existsSync(regularPath)) {
      const existingContent = await Bun.file(regularPath).text()
      if (existingContent === mergedContent) {
        console.log(`  No changes needed for ${regularPath}, skipping`)
        return false
      }
    }
  }

  return true
}

// Process a single script (file operations)
function processScript(mergedScript: Funscript): void {
  const { dir: scriptDir, name: scriptName } = parse(mergedScript.filePath)

  // Get base name without axis specifier
  const baseNameMatch = scriptName.match(/^(.+?)(?:\.(stroke|surge|sway|twist|roll|pitch|L0|L1|L2|R0|R1|R2))?$/)
  if (!baseNameMatch) return

  let baseName = baseNameMatch[1]

  // If the base name already ends with .max, strip it for consistency
  if (baseName.endsWith('.max')) {
    baseName = baseName.slice(0, -4)
  }

  // Check if it's truly multi-axis
  const isMultiAxis = mergedScript.axes && mergedScript.axes.length > 0
  const outputSuffix = isMultiAxis ? '.max.funscript' : '.funscript'

  // The output path for the merged script
  const outputPath = join(scriptDir, `${baseName}${outputSuffix}`)

  console.log(`Processing ${baseName}...`)

  // Find all related funscripts and media files for this base name
  const relatedFunscripts = funscriptPaths.filter((path) => {
    // Skip the output path itself to avoid moving it
    if (path === outputPath) return false

    const { dir, name } = parse(path)
    const match = name.match(/^(.+?)(?:\.(stroke|surge|sway|twist|roll|pitch|L0|L1|L2|R0|R1|R2))?$/)
    if (!match) return false

    let matchBaseName = match[1]
    if (matchBaseName.endsWith('.max')) {
      matchBaseName = matchBaseName.slice(0, -4)
    }

    return matchBaseName === baseName && dir === scriptDir
  })

  const mediaFiles = allFiles.filter((path) => {
    if (path.endsWith('.funscript')) return false
    const { dir, name } = parse(path)

    // Match files in the same directory with the same base name
    let mediaName = name
    if (mediaName.endsWith('.max')) {
      mediaName = mediaName.slice(0, -4)
    }

    return dir === scriptDir && mediaName === baseName
  })

  // Move original funscripts to .processed folder while preserving directory structure
  for (const path of relatedFunscripts) {
    // Get relative path from the root directory
    const relPath = relative(directoryPath, path)
    // Create destination path with same relative structure
    const destPath = join(processedDir, relPath)
    // Ensure the parent directory exists
    const destDir = parse(destPath).dir
    ensureDirExists(destDir)

    // Move the file
    try {
      renameSync(path, destPath)
      console.log(`  Moved ${path} to ${destPath}`)
    }
    catch (err) {
      console.error(`  Error moving ${path}: ${err}`)
    }
  }

  // Write the merged funscript
  try {
    writeFileSync(outputPath, mergedScript.toJsonText())
    console.log(`  Created ${outputPath}`)
  }
  catch (err) {
    console.error(`  Error writing ${outputPath}: ${err}`)
  }

  // Rename matching media files only if multi-axis
  if (isMultiAxis) {
    for (const mediaPath of mediaFiles) {
      const { dir: mediaDir, name: mediaName, ext: mediaExt } = parse(mediaPath)

      // If the name already has .max, skip it
      if (mediaName.endsWith('.max')) continue

      const maxMediaPath = join(mediaDir, `${baseName}.max${mediaExt}`)

      // Skip if the target already exists
      if (existsSync(maxMediaPath)) {
        console.log(`  Media file ${maxMediaPath} already exists, skipping rename`)
        continue
      }

      try {
        renameSync(mediaPath, maxMediaPath)
        console.log(`  Renamed media file to ${baseName}.max${mediaExt}`)
      }
      catch (err) {
        console.error(`  Error renaming ${mediaPath}: ${err}`)
      }
    }
  }
}

// Process all funscripts
async function processScripts() {
  if (funscriptPaths.length === 0) {
    console.log('No funscripts found!')
    return
  }

  console.log(`Found ${funscriptPaths.length} funscripts to process`)

  // Load all funscripts at once
  const allFunscripts: Funscript[] = []
  for (const path of funscriptPaths) {
    const content = await Bun.file(path).json()
    allFunscripts.push(new Funscript(content, { filePath: path }))
  }

  console.log(`Loaded ${allFunscripts.length} funscripts successfully`)

  // Merge all funscripts at once - mergeMultiAxis intelligently groups
  // related funscripts by filename and returns one merged script per group
  const mergedScripts = Funscript.mergeMultiAxis(allFunscripts)

  console.log(`Merged into ${mergedScripts.length} output scripts`)

  // First check which scripts need processing
  const scriptsToProcess: Funscript[] = []

  for (const mergedScript of mergedScripts) {
    const needsProcessing = await shouldProcessScript(mergedScript)
    if (needsProcessing) {
      scriptsToProcess.push(mergedScript)
    }
  }

  console.log(`${scriptsToProcess.length} out of ${mergedScripts.length} scripts need processing`)

  // Then process only the ones that need it
  for (const script of scriptsToProcess) {
    processScript(script)
  }

  console.log('Conversion complete!')
}

// Start the processing
processScripts()
