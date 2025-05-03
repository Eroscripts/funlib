/* eslint-disable */ // exclude from eslint

const fs = require('node:fs')
const fsPromise = require('node:fs/promises')

const SEARCH_PATH = 'D:/projects/discourse-funscript/.cache/uploads/short-url/'
const BATCH_PATH = 'D:/projects/discourse-funscript/.cache/uploads/'

const all_files = fs.readdirSync(SEARCH_PATH)

const UPDATE_BATCHES = false

let all_jsons, all_texts, skip_files
if (UPDATE_BATCHES) {
  console.time('reading')
  all_texts = {}
  for (let f of all_files) {
    all_texts[f] = fs.readFileSync(SEARCH_PATH + f, 'utf-8')
    inc('reading')
  }
  console.timeEnd('reading')

  skip_files = []
  for (let i = 1000; i < 100_000; i += 1000) {
    skip_files.push(...JSON.parse(fs.readFileSync(BATCH_PATH + i + '.keys.json', 'utf-8')))
  }

  console.time('parsing')
  all_jsons = {}
  bad_texts = {}
  for (let k in all_texts) {
    try { all_jsons[k] = JSON.parse(all_texts[k]) }
    catch { bad_texts[k] = all_texts[k] }
    let N = inc('parsing')
    if (N % 1000 == 0) {
      fs.writeFileSync(BATCH_PATH + N + '.json', JSON.stringify(all_jsons, null, 2))
      fs.writeFileSync(BATCH_PATH + N + '.keys.json', JSON.stringify(Object.keys(all_jsons), null, 2))
      all_jsons = {}
    }
  }
  console.timeEnd('parsing')

  function inc(name) {
    let vv = (inc.vv ??= {}); vv[name] ??= 0
    let N = ++vv[name]
    if (N % 1000 == 0) console.log(name, N)
    return N
  }
} else {
  all_jsons = {}
  for (let i = 1000; i < 100_000; i += 1000) {
    console.log(i)
    if (!fs.existsSync(BATCH_PATH + i + '.json')) break;
    let obj = JSON.parse(fs.readFileSync(BATCH_PATH + i + '.json', 'utf-8'))
    Object.assign(all_jsons, obj)
  }
}
