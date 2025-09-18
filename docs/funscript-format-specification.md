# Funscript Multi-Axis Format Specification

## Overview

This document outlines the agreed-upon format for single-file multi-axis funscripts, based on the RFC discussion. The format aims to combine multiple axis scripts into a single file while maintaining backward compatibility.

## Core Format (Agreed Upon)

### Basic Structure

```json
{
  "version": "1.0",
  "inverted": false,
  "range": 100,
  "actions": [
    { "at": 0, "pos": 50 }
  ],
  "metadata": {
    "title": "Example Script",
    "duration": 180
  },
  "tracks": {
    "twist": {
      "actions": [
        { "at": 0, "pos": 50 }
      ]
    },
    "pitch": {
      "actions": [
        { "at": 1000, "pos": 75 }
      ],
      "metadata": {
        "custom_property": "value"
      }
    },
    "V3": {
      "actions": [
        { "at": 2000, "pos": 25 }
      ]
    }
  }
}
```

### Key Principles

1. **Backward Compatibility**: Root `actions` array represents the primary stroke (L0) axis
2. **Human-Readable Names**: Use descriptive axis names instead of TCode identifiers
   - Preferred: `twist`, `roll`, `pitch`, `sway`, `surge`, `stroke`
   - Avoid: `R0`, `R1`, `L0`, `L1` (TCode-specific)
3. **Dictionary Structure**: `tracks` as a dictionary/object for easy lookup and to prevent duplicates
4. **Full Funscript Objects**: Each track can contain complete funscript data including metadata

## Axis Naming Conventions

### Recommended Axis Names
- `stroke` - Primary linear motion (L0 equivalent)
- `twist` - Rotational motion around vertical axis
- `roll` - Rotational motion around longitudinal axis
- `pitch` - Rotational motion around lateral axis
- `sway` - Side-to-side motion
- `surge` - Forward-backward motion
- `vib`, `vib1`, `vib2`, etc. - Vibration channels
- `lube` - Lubrication control

### Rationale for Human-Readable Names
- **Clarity**: No need to reference TCode documentation
- **Future-Proof**: Not tied to any specific device protocol
- **User-Friendly**: Clear meaning for content creators and consumers
- **Standard Agnostic**: Works with any device type, not just TCode

## File Extensions

### Current Implementation
- **Primary**: `.funscript` (recommended default)
- **Optional**: `.max.funscript` (indicates multi-axis, requires player configuration)

### Extension Strategy
- Default to `.funscript` for maximum compatibility
- `.max` prefix optional for user preference but not recommended by default
- Avoid creating new extensions that break existing player compatibility

## Device Configuration and Ranges

### Proposed Range Configuration
```json
{
  "ranges": {
    "roll": {
      "device": "SR6",
      "pos": [0, 100],
      "devicePos": [-25, 25],
      "deviceUnit": "deg"
    },
    "twist": {
      "device": "OSR2",
      "pos": [0, 100],
      "devicePos": [-120, 120],
      "deviceUnit": "deg"
    }
  }
}
```

### Range Properties
- `device`: Target device identifier
- `pos`: Script value range (typically [0, 100])
- `devicePos`: Physical device range
- `deviceUnit`: Physical unit (deg, L0, Hz, etc.)

## Implementation Considerations

### Player Support Requirements
- **Root actions**: Must be preserved for backward compatibility
- **Unknown tracks**: Should be safely ignored
- **Metadata**: Should be optional and ignorable
- **Error handling**: Graceful degradation for unsupported features

### Scripter Guidelines
- Avoid duplicate axis names between root and tracks
- Use empty root `actions: []` if no primary stroke axis
- Include meaningful track names for user interface display
- Consider device limitations when setting ranges

## Migration Path

### From Separate Files
```
video.funscript       → actions (root)
video.twist.funscript → tracks.twist
video.pitch.funscript → tracks.pitch
```

### Legacy Support
- Players should continue supporting separate axis files
- Conversion tools should be provided for both directions
- Multi-file and single-file formats should coexist

## Alternative Formats Considered

### ZIP/Archive Approach
- **Pros**: Maintains separate files, easy editing
- **Cons**: Not widely supported, upload restrictions, complex naming
- **Status**: Not adopted due to compatibility concerns

### TCode-Based Format (SLR/MFP existing)
```json
{
  "actions": [...],
  "axes": [
    { "id": "R0", "actions": [...] }
  ]
}
```
- **Status**: Existing in MFP but not recommended for new implementations
- **Issues**: Ties format to TCode protocol, less user-friendly

## Future Considerations

### Proposed Funscript 2.0 Features
- Bezier curve support for smooth motion
- UTC timestamps for recordings
- Enhanced metadata structure
- Multiple device variants per axis

### Extensibility
- Additional metadata fields should be optional
- New axis types can be added to tracks
- Configuration files for device-specific settings
- Possible chapter/bookmark integration

## Implementation Status

### Current Support
- **MultiFunPlayer**: Supports SLR format (TCode-based)
- **XTPlayer**: Limited support
- **OpenFunScripter**: Requires updates for new format

### Next Steps
1. Finalize track-based format specification
2. Update OpenFunScripter for multi-axis editing
3. Implement in popular players
4. Create conversion utilities
5. Update site upload/download systems

## Compatibility Matrix

| Feature | Legacy Players | Updated Players | Notes |
|---------|---------------|-----------------|--------|
| Root actions | ✅ | ✅ | Full compatibility |
| Single track | ⚠️ | ✅ | Ignored by legacy |
| Multiple tracks | ⚠️ | ✅ | Ignored by legacy |
| Metadata | ✅ | ✅ | Optional everywhere |
| Range config | ❌ | ✅ | Future feature |

## Conclusion

The track-based format provides the best balance of:
- Backward compatibility with existing players
- Forward compatibility for future features
- Human-readable axis naming
- Flexible metadata support
- Standard-agnostic design

This format should serve as the foundation for multi-axis funscript distribution while maintaining the simplicity and compatibility that made the original funscript format successful.
