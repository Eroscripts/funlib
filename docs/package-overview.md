# Funlib Package Overview

## Project Structure
```
funlib/
├── src/
│   ├── index.ts              # Main entry point (531 lines) - Core classes
│   ├── types.ts             # Type definitions with branded types
│   ├── misc.ts              # Utilities (makeNonEnumerable, speedBetween, etc.)
│   ├── converter.ts         # Format/conversion utilities (TCode, time, speed)
│   ├── manipulations.ts     # Analysis functions (439 lines) - Heavy linking usage
│   ├── chapters.ts          # Chapter utilities
│   ├── iife.ts             # Browser build entry
│   ├── rendering/
│   │   ├── svg.ts          # SVG generation (463 lines)
│   │   └── canvas.ts       # Canvas rendering (446 lines)
│   ├── playback/
│   │   ├── tcode.ts        # WeakMap stub (5 lines) - Ready for expansion
│   │   └── player.ts       # Playback functionality
│   └── flavors/            # Empty - Ready for LinkedFunAction subclasses
├── tests/
│   └── manipulations.test.ts # Basic test coverage
└── dist/                   # Build outputs
```

## Core Architecture Analysis

### Current FunAction Class (Mixed Concerns)
Located in `src/index.ts` (lines 8-124)

#### Core Data (Should Stay)
- `at: ms` - Timestamp
- `pos: pos` - Position (0-100)
- `clerpAt(at: ms): pos` - Interpolation method
- JSON serialization (`toJSON()`, `clone()`)

#### Linking Behavior (Should Be Extracted)
- `#prevAction?: FunAction` - Private field causing Vue reactivity issues
- `#nextAction?: FunAction` - Private field causing Vue reactivity issues
- `#parent?: Funscript` - Private field causing Vue reactivity issues
- `static linkList()` - Links actions in a list
- Getters: `nextAction`, `prevAction`, `parent`

#### Speed Calculations (Depends on Linking)
- `get speedTo(): speed` - Speed from previous action
- `get speedFrom(): speed` - Speed to next action
- Uses `speedBetween()` utility from `misc.ts`

#### Peak Detection (Depends on Linking)
- `get isPeak(): -1 | 0 | 1` - Direction change detection
- Logic: Compares `speedTo` and `speedFrom` sign changes

#### Navigation Helpers (Depends on Linking)
- `get datNext(): ms` - Time to next action
- `get datPrev(): ms` - Time from previous action
- `get dposNext(): pos` - Position difference to next
- `get dposPrev(): pos` - Position difference from previous

### Current Funscript Class
Located in `src/index.ts` (lines 298-531)

#### Core Functionality (Should Stay)
- Actions management (`actions: FunAction[]`)
- Multi-axis support (`axes: AxisScript[]`)
- Metadata handling (`metadata: FunMetadata`)
- File operations (`normalize()`, `clone()`, `toJSON()`)
- Static class references for extensibility

#### TCode Generation (Should Be Moved)
- `getAxesPosAt(at: ms)` - Get positions across all axes
- `getTCodeAt(at: ms)` - Generate TCode at timestamp
- `getTCodeFrom(at: ms, since?: ms)` - Generate movement TCode
- `#searchActionIndex` - Private search optimization (should use WeakMap)
- `getActionAfter(at: ms)` - Find action after timestamp
- `getPosAt(at: ms)` - Get interpolated position

## Dependency Analysis

### Heavy Linking Dependencies
**manipulations.ts** (5 usages of isPeak, extensive speed calculations):
```typescript
// Uses: isPeak, speedTo, speedFrom, nextAction, prevAction, datNext
actionsToZigzag() // Filters by isPeak
actionsAverageSpeed() // Uses speedTo, datNext
actionsRequiredMaxSpeed() // Uses nextAction navigation
limitPeakSpeed() // Uses speedFrom for calculations
```

**rendering/svg.ts** (imports FunAction):
```typescript
// Uses linking behavior for speed visualization
actionsToLines() // Converts actions to speed lines
toSvgLines() // Renders speed-colored paths
```

**rendering/canvas.ts** (direct speed usage):
```typescript
// Uses: speedFrom, nextAction
// Speed-based color coding and line drawing
```

### Search Dependencies
**Current search implementation** (`src/index.ts` line 409):
```
#searchActionIndex = -1  // Private field optimization
getActionAfter(at: ms)   // Uses #searchActionIndex for caching
```

**Planned WeakMap optimization** (`src/playback/tcode.ts`):
```typescript
const searchActionIndices = new WeakMap<Funscript, number>()
// Ready for implementation
```

## Type System

### Branded Types (src/types.ts)
```typescript
export type ms = number & B<['time', 'ms']>
export type pos = number & B<['axis', 'u']> // 0-100
export type speed = number & B<['speed', 'u/s']>
export type axis = `${'L' | 'R' | 'A'}${0 | 1 | 2}` & B<['axis', 'name']>
```

### Multi-Axis Support
- 7 axis types: L0 (stroke), L1 (surge), L2 (sway), R0 (twist), R1 (roll), R2 (pitch), A1 (suck)
- AxisScript extends Funscript for individual axes
- Multi-axis merging via `Funscript.mergeMultiAxis()`

## Utility Functions

### misc.ts (Ready for Use)
```
makeNonEnumerable<T, K>(target: T, key: K, value?: T[K]): T
speedBetween(a?: FunAction, b?: FunAction): speed
clamplerp(value, inMin, inMax, outMin, outMax): number
```

### converter.ts (Speed/Color System)
```
speedToOklch(speed: speed): [l, c, h, a]
speedToHex(speed: speed): string
speedToHexCached(speed: speed): string  // Cached version
TCodeList.from(tcode: TCodeTuple[]): TCodeList
```

## Build System & Dependencies

### Package Configuration
- **Name**: `@eroscripts/funlib`
- **Type**: ES Module
- **Build Tool**: Bun (not Node.js)
- **TypeScript**: First-class support
- **Single Dependency**: `colorizr@^3.0.7`

### Exports
```
// Main entry
".": "./src/index.ts"
// Individual files
"./*": "./src/*.ts"
```

### Scripts
```json
{
  "build:esm": "bun build src/index.ts --target browser --outfile dist/funlib.js",
  "build:dts": "bunx dts-bundle-generator -o dist/funlib.d.ts src/index.ts",
  "build:iife": "bun build src/iife.ts --target browser --format iife"
}
```

## Refactoring Implications

### Critical Dependencies to Address
1. **manipulations.ts**: Heavily uses `isPeak`, speed calculations
2. **rendering/**: Both SVG and Canvas depend on linking behavior
3. **Search optimization**: Current private field needs WeakMap replacement
4. **Vue reactivity**: Private fields need conversion to non-enumerable properties

### Ready Infrastructure
1. **makeNonEnumerable()**: Already implemented in misc.ts
2. **WeakMap stub**: Already exists in playbook/tcode.ts
3. **flavors/ directory**: Empty and ready for LinkedFunAction
4. **Static class references**: Funscript has extensibility system

### Test Coverage
- Basic manipulation tests exist
- Focus on `limitPeakSpeed()` functionality
- Need to expand for refactored architecture

## Implementation Strategy

### Phase 1: TCode Extraction
- Move TCode methods from Funscript to `src/playback/tcode.ts`
- Implement WeakMap-based search optimization
- Update all TCode-related imports

### Phase 2: Property System
- Convert private fields to non-enumerable properties
- Ensure Vue reactivity compatibility
- Update all property access patterns

### Phase 3: FunAction Split
- Create base `FunAction` (core data only)
- Create `LinkedFunAction` in `src/flavors/` (with linking behavior)
- Update manipulations.ts to use LinkedFunAction
- Ensure backward compatibility

### Phase 4: Clean Architecture
- Verify SVG generation works with core classes
- Update imports across codebase
- Test all functionality with new architecture
