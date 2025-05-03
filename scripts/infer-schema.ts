/* eslint-disable */ // disable all rules

declare global {
    var all_jsons: unknown[]
}
console.clear()

// Helper to stringify primitives for use as object keys
function stringifyPrimitive(value: any): string | null {
    const type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean') {
        // Distinguish empty string from others
        return type === 'string' && value === '' ? '""' : String(value);
    }
    if (value === null) {
        return 'null';
    }
    // Ignore objects, arrays, undefined for default value tracking
    return null;
}

// Helper to parse stringified primitive back to its value
function parsePrimitive(valueStr: string): string | number | boolean | null {
     if (valueStr === 'null') return null;
     if (valueStr === 'true') return true;
     if (valueStr === 'false') return false;
     if (valueStr === '""') return ""; // Handle empty string case
     // Try parsing as number, otherwise keep as string
     const num = Number(valueStr);
     return !isNaN(num) ? num : valueStr;
}


type KeyInfo = {
    n: number; // Total occurrences of the key
    types: Set<string>; // Using Set for unique types
    map: Map<any, number>; // Stores counts for ALL distinct values (objects normalized)
    topValues?: Array<{ value: any, count: number }>; // Store the top N most frequent values
    typeList?: string[]; // Add this to store array form for final output
};

type StructureGroup = {
    fileCount: number,
    keyCounts: Record<string, KeyInfo>
    metadataKeyCounts?: Record<string, KeyInfo>
}

const structureGroups: Record<string, StructureGroup> = {}

console.log(`Processing ${all_jsons.length} valid JSON files...`)
console.time('process')
for (const j of all_jsons) {
    if (typeof j !== 'object' || j === null) continue; // Skip non-objects
    inc('files')

    const keys = Object.keys(j).sort()
    const signature = keys.join(',')

    // Initialize group if it doesn't exist
    structureGroups[signature] ??= { fileCount: 0, keyCounts: {} }
    const group = structureGroups[signature];
    group.fileCount++

    // Process root keys
    for (let [k, v] of Object.entries(j)) {
        if (!group.keyCounts[k]) {
            group.keyCounts[k] = { n: 0, types: new Set(), map: new Map() }
            Object.defineProperty(group.keyCounts[k], 'map', {
                value: new Map(),
                writable: false,
                enumerable: false,
                configurable: false
            })
        }
        const keyInfo = group.keyCounts[k];
        keyInfo.n++
        const type = typeof v
        keyInfo.types.add(type);

        if (typeof v === 'object') {
            v = v === null ? 'null' : Array.isArray(v) ? 'array' : 'object'
        }

        const currentCount = keyInfo.map.get(v) || 0;
        keyInfo.map.set(v, currentCount + 1);
    }

    // Process metadata keys if metadata exists and is an object
    if ('metadata' in j && typeof j.metadata === 'object' && j.metadata !== null) {
        group.metadataKeyCounts ??= {}
        const metadataCounts = group.metadataKeyCounts!; // Assert non-null after check

        for (let [mk, mv] of Object.entries(j.metadata)) {
            if (!metadataCounts[mk]) {
                metadataCounts[mk] = { n: 0, types: new Set(), map: new Map() };
                Object.defineProperty(metadataCounts[mk], 'map', {
                    value: new Map(),
                    writable: false,
                    enumerable: false,
                    configurable: false
                })
            }
            if (typeof mv === 'object') {
                mv = mv === null ? 'null' : Array.isArray(mv) ? 'array' : 'object'
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

console.timeEnd('process')

// --- Post-processing: Calculate most frequent values using the map ---
for (const groupData of Object.values(structureGroups)) {
    // Process root keys
    for (const keyInfo of Object.values(groupData.keyCounts)) {
        // Convert map entries to array, sort by count descending
        const sortedValues = Array.from(keyInfo.map.entries()).sort((a, b) => b[1] - a[1]);
        // Take top 3
        keyInfo.topValues = sortedValues.slice(0, 3).map(([value, count]) => ({ value, count }));
        keyInfo.typeList = Array.from(keyInfo.types); // Store types as array for printing
    }
     // Process metadata keys
     if (groupData.metadataKeyCounts) {
         for (const keyInfo of Object.values(groupData.metadataKeyCounts)) {
            const sortedValues = Array.from(keyInfo.map.entries()).sort((a, b) => b[1] - a[1]);
            keyInfo.topValues = sortedValues.slice(0, 3).map(([value, count]) => ({ value, count }));
            keyInfo.typeList = Array.from(keyInfo.types); // Store types as array for printing
         }
     }
}


// --- Custom stringifier ---
const totalFiles = all_jsons.length;
const totalVariants = Object.keys(structureGroups).length;
console.log(`\n--- Funscript Structure Analysis (${totalFiles} total files, ${totalVariants} unique structure variants) ---`);

// Helper function for printing key info
function printKeyInfo(key: string, info: KeyInfo) {
    console.log(`    - ${key}: (Count: ${info.n}, Types: [${info.typeList?.join(', ')}])`);
    if (info.topValues && info.topValues.length > 0) {
        info.topValues.forEach((item, index) => {
            const percentage = ((item.count / info.n) * 100).toFixed(1);
            // Display normalized strings directly, JSON.stringify others
            const displayValue = ['object', 'array', 'null'].includes(item.value) ? 
                               item.value : 
                               JSON.stringify(item.value); 
            console.log(`        Top ${index + 1}: ${displayValue} (${item.count} times, ${percentage}%)`);
        });
    }
}

for (const [signature, groupData] of Object.entries(structureGroups).sort((a,b) => b[1].fileCount - a[1].fileCount)) {
    const percentage = ((groupData.fileCount / totalFiles) * 100).toFixed(1);
    console.log(`\nStructure Signature: ${signature}`);
    console.log(`  File Count: ${groupData.fileCount} (${percentage}%)`);
    console.log("  Root Keys:");
    for (const [key, info] of Object.entries(groupData.keyCounts).sort((a,b) => b[1].n - a[1].n)) {
       printKeyInfo(key, info);
    }

    if (groupData.metadataKeyCounts && Object.keys(groupData.metadataKeyCounts).length > 0) {
        console.log("  Metadata Keys:");
        for (const [key, info] of Object.entries(groupData.metadataKeyCounts).sort((a,b) => b[1].n - a[1].n)) {
           printKeyInfo(key, info);
        }
    } else if (groupData.keyCounts.metadata) {
        console.log("  Metadata Keys: (Metadata field present but not an object or empty)");
    }
    console.log("------------------------------------");
}

// console.log(JSON.stringify(structureGroups, null, 2)) // Keep original log commented out for now



function inc(name: string) {
    let vv = ((inc as any as { vv: Record<string, number> }).vv ??= {}); vv[name] ??= 0
    let N = ++vv[name]
    if (N % 1000 == 0) console.log(name, N)
    return N
  }