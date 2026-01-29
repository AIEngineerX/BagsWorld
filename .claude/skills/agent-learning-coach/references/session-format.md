# Session Format

Sessions are stored as JSON files in `~/.agent-coach/sessions/`.

## File Naming

```
session-YYYY-MM-DD.json
```

One file per day. Multiple sessions on the same day append to the same file.

## Structure

```json
{
  "date": "2025-01-18",
  "timestamp": "2025-01-18T10:30:00Z",
  "decisions": [
    {
      "timestamp": "2025-01-18T10:35:00Z",
      "category": "architecture",
      "decision": "Chose ReAct pattern over plan-then-execute",
      "reasoning": "Need iterative feedback for dynamic website"
    }
  ],
  "outcomes": [
    {
      "timestamp": "2025-01-18T11:00:00Z",
      "result": "success",
      "description": "Agent successfully extracted all product prices",
      "context": {
        "pattern": "explicit CSS selectors in tools",
        "steps": 12
      }
    },
    {
      "timestamp": "2025-01-18T11:30:00Z",
      "result": "failure",
      "description": "Agent got stuck trying to log in",
      "context": {
        "cause": "2FA not handled",
        "attempted": "click-type-submit flow"
      }
    }
  ],
  "notes": [
    {
      "timestamp": "2025-01-18T11:45:00Z",
      "note": "Need to add 2FA handling to my agent template"
    }
  ],
  "prompt_iterations": [
    {
      "timestamp": "2025-01-18T10:40:00Z",
      "original": "Extract prices from the page",
      "revised": "Navigate to example.com/products, wait for load, extract all elements matching '.price' and return as JSON array",
      "improvement": "Added specificity: URL, wait condition, selector, output format"
    }
  ]
}
```

## Categories

### Decision Categories

- `architecture` - Overall approach (ReAct, plan-execute, etc.)
- `prompting` - How objectives/instructions are phrased
- `tooling` - Which tools/libraries to use
- `memory` - How context is managed
- `safety` - Safeguards and limits
- `debugging` - How to troubleshoot issues

### Outcome Results

- `success` - Task completed as expected
- `failure` - Task failed or had issues
- `partial` - Partial success, some issues

### Context Keys

Common keys to include in outcome context:

- `pattern` - What pattern/approach was used
- `cause` - Why something failed
- `steps` - Number of steps taken
- `time` - How long it took
- `tokens` - Token usage
- `retries` - Number of retry attempts
