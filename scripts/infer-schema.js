// infer-schema.ts
console.clear();
var structureGroups = {};
console.log(`Processing ${all_jsons.length} valid JSON files...`);
console.time("process");
for (const j of all_jsons) {
  if (typeof j !== "object" || j === null)
    continue;
  inc("files");
  const keys = Object.keys(j).sort();
  const signature = keys.join(",");
  structureGroups[signature] ??= { fileCount: 0, keyCounts: {} };
  const group = structureGroups[signature];
  group.fileCount++;
  for (let [k, v] of Object.entries(j)) {
    if (!group.keyCounts[k]) {
      group.keyCounts[k] = { n: 0, types: new Set, map: new Map };
      Object.defineProperty(group.keyCounts[k], "map", {
        value: new Map,
        writable: false,
        enumerable: false,
        configurable: false
      });
    }
    const keyInfo = group.keyCounts[k];
    keyInfo.n++;
    const type = typeof v;
    keyInfo.types.add(type);
    if (typeof v === "object") {
      v = v === null ? "null" : Array.isArray(v) ? "array" : "object";
    }
    const currentCount = keyInfo.map.get(v) || 0;
    keyInfo.map.set(v, currentCount + 1);
  }
  if ("metadata" in j && typeof j.metadata === "object" && j.metadata !== null) {
    group.metadataKeyCounts ??= {};
    const metadataCounts = group.metadataKeyCounts;
    for (let [mk, mv] of Object.entries(j.metadata)) {
      if (!metadataCounts[mk]) {
        metadataCounts[mk] = { n: 0, types: new Set, map: new Map };
        Object.defineProperty(metadataCounts[mk], "map", {
          value: new Map,
          writable: false,
          enumerable: false,
          configurable: false
        });
      }
      if (typeof mv === "object") {
        mv = mv === null ? "null" : Array.isArray(mv) ? "array" : "object";
      }
      const metaKeyInfo = metadataCounts[mk];
      metaKeyInfo.n++;
      const metaType = typeof mv;
      metaKeyInfo.types.add(metaType);
      const currentMetaCount = metaKeyInfo.map.get(mv) || 0;
      metaKeyInfo.map.set(mv, currentMetaCount + 1);
    }
  }
}
console.timeEnd("process");
for (const groupData of Object.values(structureGroups)) {
  for (const keyInfo of Object.values(groupData.keyCounts)) {
    const sortedValues = Array.from(keyInfo.map.entries()).sort((a, b) => b[1] - a[1]);
    keyInfo.topValues = sortedValues.slice(0, 3).map(([value, count]) => ({ value, count }));
    keyInfo.typeList = Array.from(keyInfo.types);
  }
  if (groupData.metadataKeyCounts) {
    for (const keyInfo of Object.values(groupData.metadataKeyCounts)) {
      const sortedValues = Array.from(keyInfo.map.entries()).sort((a, b) => b[1] - a[1]);
      keyInfo.topValues = sortedValues.slice(0, 3).map(([value, count]) => ({ value, count }));
      keyInfo.typeList = Array.from(keyInfo.types);
    }
  }
}
var totalFiles = all_jsons.length;
var totalVariants = Object.keys(structureGroups).length;
console.log(`
--- Funscript Structure Analysis (${totalFiles} total files, ${totalVariants} unique structure variants) ---`);
function printKeyInfo(key, info) {
  console.log(`    - ${key}: (Count: ${info.n}, Types: [${info.typeList?.join(", ")}])`);
  if (info.topValues && info.topValues.length > 0) {
    info.topValues.forEach((item, index) => {
      const percentage = (item.count / info.n * 100).toFixed(1);
      const displayValue = ["object", "array", "null"].includes(item.value) ? item.value : JSON.stringify(item.value);
      console.log(`        Top ${index + 1}: ${displayValue} (${item.count} times, ${percentage}%)`);
    });
  }
}
for (const [signature, groupData] of Object.entries(structureGroups).sort((a, b) => b[1].fileCount - a[1].fileCount)) {
  const percentage = (groupData.fileCount / totalFiles * 100).toFixed(1);
  console.log(`
Structure Signature: ${signature}`);
  console.log(`  File Count: ${groupData.fileCount} (${percentage}%)`);
  console.log("  Root Keys:");
  for (const [key, info] of Object.entries(groupData.keyCounts).sort((a, b) => b[1].n - a[1].n)) {
    printKeyInfo(key, info);
  }
  if (groupData.metadataKeyCounts && Object.keys(groupData.metadataKeyCounts).length > 0) {
    console.log("  Metadata Keys:");
    for (const [key, info] of Object.entries(groupData.metadataKeyCounts).sort((a, b) => b[1].n - a[1].n)) {
      printKeyInfo(key, info);
    }
  } else if (groupData.keyCounts.metadata) {
    console.log("  Metadata Keys: (Metadata field present but not an object or empty)");
  }
  console.log("------------------------------------");
}
function inc(name) {
  let vv = inc.vv ??= {};
  vv[name] ??= 0;
  let N = ++vv[name];
  if (N % 1000 == 0)
    console.log(name, N);
  return N;
}
