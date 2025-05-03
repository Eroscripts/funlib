// Import Funscript types (optional, for clarity)
import type { Funscript } from './funscript.schema'
import path from 'node:path' // Import the path module
import { Glob } from 'bun'

const glob = new Glob('**/*.funscript')
const SEARCH_PATH = 'D:/projects/discourse-funscript/.cache/uploads/' // Define the search path constant

console.log(`Searching in ${SEARCH_PATH} for .funscript files and counting field value occurrences...`)

let fileCount = 0 // Initialize file counter
// Store collected value counts: CollectedValueCounts[typeName][fieldName] = Map<value, count>
const collectedValueCounts: Record<string, Record<string, Map<any, number>>> = {}

// Recursive function to traverse the object and count value occurrences per script
function collectAndCountFieldValues(
  obj: any,
  typeName: string,
  collectedCounts: Record<string, Record<string, Map<any, number>>>,
  scriptValuesSeen: Set<string>, // Tracks values seen in the current script
) {
  if (!obj || typeof obj !== 'object') return

  if (!collectedCounts[typeName]) {
    collectedCounts[typeName] = {}
  }

  for (const fieldName in obj) {
    if (Object.hasOwn(obj, fieldName)) { // Check own properties
      // Skip ignored fields
      if (typeName === 'Action' && (fieldName === 'at' || fieldName === 'pos')) {
        continue
      }

      const value = obj[fieldName]

      if (!collectedCounts[typeName][fieldName]) {
        collectedCounts[typeName][fieldName] = new Map()
      }
      const valueCountMap = collectedCounts[typeName][fieldName]

      // Helper to process a single value
      const processValue = (item: any, currentTypeName: string, currentFieldName: string) => {
        if (item === null || item === undefined) return

        // Create a unique key for this value within the script
        let itemKeyString = ''
        try {
          itemKeyString = JSON.stringify(item)
        } catch {
          // Handle potential circular structures or unstringifiable values gracefully
          console.warn(`Could not stringify value for ${currentTypeName}.${currentFieldName}:`, item)
          itemKeyString = `__unstringifiable_${Math.random()}__`
        }
        const seenKey = `${currentTypeName}-${currentFieldName}-${itemKeyString}`

        // If this exact value (for this type/field) hasn't been seen in *this script* yet, count it
        if (!scriptValuesSeen.has(seenKey)) {
          scriptValuesSeen.add(seenKey)
          const currentCount = valueCountMap.get(item) || 0
          valueCountMap.set(item, currentCount + 1)
        }
      }

      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === 'object' && item !== null) {
            // Determine nested type based on field name (simplified mapping)
            let nestedTypeName = ''
            if (fieldName === 'actions') nestedTypeName = 'Action'
            else if (fieldName === 'axes') nestedTypeName = 'Axis'
            else if (fieldName === 'chapters') nestedTypeName = 'Chapter'
            else if (fieldName === 'bookmarks') nestedTypeName = 'Bookmark'
            // Arrays of primitives (like performers, tags) are handled below

            if (nestedTypeName) {
              collectAndCountFieldValues(item, nestedTypeName, collectedCounts, scriptValuesSeen)
            } else { // Handle arrays of primitives directly
              processValue(item, typeName, fieldName)
            }
          } else { // Primitive value in array
            processValue(item, typeName, fieldName)
          }
        })
      } else if (typeof value === 'object' && value !== null) {
        // Determine nested type based on field name
        let nestedTypeName = ''
        if (fieldName === 'metadata') nestedTypeName = 'Metadata'
        // Add other potential object fields here if needed

        if (nestedTypeName) {
          collectAndCountFieldValues(value, nestedTypeName, collectedCounts, scriptValuesSeen)
        } else {
          // Could be an object we don't have a specific type for, treat its value? Or ignore?
          // Current logic ignores untyped objects. Let's process its value as a whole.
          processValue(value, typeName, fieldName)
        }
      } else { // Primitive value
        processValue(value, typeName, fieldName)
      }
    }
  }
}

// Scan the specified directory and its subdirectories
for await (const filePath of glob.scan(SEARCH_PATH)) { // Use the constant here
  fileCount++ // Increment counter for each file found
  const fullPath = path.join(SEARCH_PATH, filePath) // Construct the full path
  const scriptValuesSeenThisFile = new Set<string>() // Track unique values *for this file*
  try {
    // Read and parse the JSON content of the file using the full path
    const funscriptContent = await Bun.file(fullPath).json() as Funscript // Use fullPath here

    // Collect values from the parsed funscript
    collectAndCountFieldValues(funscriptContent, 'Funscript', collectedValueCounts, scriptValuesSeenThisFile)
  } catch (error) {
    // Log errors for files that couldn't be read or parsed, but continue searching
    console.error(`Error processing file ${fullPath}:`, error instanceof Error ? error.message : 'Unknown error') // Log fullPath in error too
  }
}

console.log(`\nTotal .funscript files scanned: ${fileCount}`) // Log the total count

// Print collected values and their counts
console.log('\nCollected Field Value Counts (Value: Count in files / Count NOT in files):')
for (const typeName in collectedValueCounts) {
  // No top-level type heading anymore, context is added to each field
  // console.log(`\n--- ${typeName} ---`);
  const fields = collectedValueCounts[typeName]
  for (const fieldName in fields) {
    const valueMap = fields[fieldName]
    const sortedValues = Array.from(valueMap.entries()).sort(([, countA], [, countB]) => countB - countA)

    const displayValues = sortedValues.length > 30
      ? sortedValues.slice(0, 30).concat([['...', -1]] as any)
      : sortedValues

    // Log the fully qualified field name
    const qualifiedFieldName = `${typeName}.${fieldName}`
    console.log(`\n  ${qualifiedFieldName}: (${valueMap.size} unique values found across ${fileCount} files)`)

    displayValues.forEach(([value, count]) => {
      const notInCount = count === -1 ? '...' : fileCount - count
      const countDisplay = count === -1 ? '...' : count
      try {
        // Indent values under the qualified field name
        console.log(`    ${JSON.stringify(value)}: ${countDisplay} / ${notInCount}`)
      } catch {
        console.log(`    __unstringifiable_value__: ${countDisplay} / ${notInCount}`)
      }
    })
  }
}

console.log('\nSearch complete.')
