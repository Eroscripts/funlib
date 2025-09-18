# Funscript Multi-Axis Format Specification

```json
{
  "version": "2.0",
  "metadata": {
    "title": "Example Script",
    "creator": "John Doe",
    "tags": [
      "non-vr",
      "animation"
    ],
    "topic_url": "https://example.com/topic",
    "duration": 180.017,
    "durationTime": "00:03:00.017"
  },
  "actions": [{ "at": 0, "pos": 50 }],
  "channels": {
    "random_text": {
      "actions": [{ "at": 0, "pos": 50 }]
    },
    "roll": {
      "actions": [{ "at": 1000, "pos": 75 }]
    },
    "vibe": {
      "actions": [{ "at": 2000, "pos": 25 }]
    }
  }
}
```

Both scripts with just `actions` or `channels` are valid.
```json
{ "actions": [{ "at": 0, "pos": 50 }] }
```
```json
{ "channels": { "stroke": { "actions": [{ "at": 0, "pos": 50 }] } } }
```

For single-axis devices like Handy, `actions` array should be preferred over `channels`.
For multi-axis devices like SR6, `stroke` channel should override `actions` array.
This allows to provide a single script for both device categories.
