import type { JsonFunscript } from '../src'

console.time('reading')

const all_files = Array.from(
  { length: 28 },
  (_, i) => Bun.file(`./out/uploads/batches/batch.${i}000.lite.json`),
)

const all_jsons = (await Promise.all(all_files.map(f => f.json())) as JsonFunscript[][]).flat()

// Filter for funscripts with named chapters
const with_chapters = all_jsons.filter(f => f.metadata?.chapters?.some(c => c.name))

// Extract the names of the chapters for each funscript
const chapterNamesArrays = with_chapters.map(f =>
  // Get chapters, filter those with a name, map to the name, provide empty array if no chapters
  f.metadata?.chapters?.filter(c => c.name).map(c => c.name!) ?? [],
)

// Print each array of chapter names
chapterNamesArrays.forEach((names) => {
  if (names.length > 0) { // Only print if there are names (filter might be redundant, but safe)
    console.log(names)
  }
})

console.log(`Found ${chapterNamesArrays.length} scripts with named chapters out of ${all_jsons.length}.`)

console.timeEnd('reading')
