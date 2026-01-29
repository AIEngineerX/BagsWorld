---
name: agent-learning-coach
description: Self-learning skill that tracks your coding patterns, prompting approaches, and agent-building decisions over time. Use when you want to improve your coding skills, learn better prompting, or have Claude remember your patterns across sessions. Triggers on "help me improve", "learn my patterns", "track my progress", "coaching", "what patterns do I use", "how can I prompt better", or when building agents and wanting personalized guidance.
---

# Agent Learning Coach

A self-learning system that tracks your patterns and helps you improve over time.

## How It Works

Claude Code doesn't have persistent memory between sessions. This skill externalizes learning to files that persist in `~/.agent-coach/`:

```
~/.agent-coach/
├── profile.md           # Your background, goals, preferences
├── sessions/            # Logged sessions with decisions and outcomes
├── patterns/
│   ├── effective.md     # Patterns that worked well
│   ├── anti-patterns.md # Patterns to avoid
│   └── prompting.md     # Your prompting style evolution
├── curriculum.md        # Current focus areas and exercises
└── evolution.md         # Progress tracking over time
```

## Setup

Run the init script to create the directory structure:

```bash
python3 scripts/init_coach.py
```

Then edit `~/.agent-coach/profile.md` with your details:
- Background (tech experience, languages, frameworks)
- Current goals (what you're trying to learn/build)
- Preferred style (verbose/concise, languages, frameworks)

## Workflow

### During Sessions

When building agents or coding, the coach:
1. Reads your profile and past patterns on startup
2. Observes your decisions and approaches
3. Notes what works and what doesn't
4. Provides personalized suggestions based on your history

### After Sessions

Run the reflection script:

```bash
python3 scripts/reflect.py
```

This analyzes recent sessions and updates:
- Effective patterns you've discovered
- Anti-patterns to avoid
- Your prompting evolution
- Suggested exercises for weak areas

## Session Logging

Log important moments during sessions:

```python
from coach import log_decision, log_outcome

# When making a key decision
log_decision("architecture", "Chose event-driven over polling", "Better for real-time")

# When something works or fails
log_outcome("success", "ReAct loop worked first try", {"pattern": "explicit tool definitions"})
log_outcome("failure", "Agent got stuck in loop", {"cause": "ambiguous objective"})
```

## Pattern Categories

### Prompting Patterns

Tracks how your prompting style evolves:
- System prompt structures that work for you
- How you phrase objectives
- Tool definition styles
- Error handling approaches

### Architecture Patterns

Tracks your technical decisions:
- When you choose certain tools/frameworks
- How you structure agent loops
- Memory management approaches
- Error recovery strategies

### Debugging Patterns

Tracks how you solve problems:
- Common errors you encounter
- Debugging approaches that work
- Time-to-resolution trends

## Reflection Questions

The coach periodically prompts you to reflect:

1. **What worked well this session?**
2. **Where did you get stuck?**
3. **What would you do differently?**
4. **What's one thing to try next time?**

## Curriculum System

Based on your patterns, the coach suggests:

### Exercises

Small, focused challenges:
- "Build an agent with only 3 tools"
- "Refactor this prompt to be half the length"
- "Add error recovery to your last agent"

### Focus Areas

Bigger themes to work on:
- "Your objectives tend to be vague - practice specificity"
- "You rarely use memory - try adding short-term context"
- "Your agents lack safety limits - add max_steps"

## Integration with Claude Code

Add to your Claude Code settings to auto-load context:

```json
{
  "contextFiles": ["~/.agent-coach/profile.md", "~/.agent-coach/patterns/effective.md"]
}
```

This ensures every session starts with your learned patterns.

## Reference Files

- `references/session-format.md` — How to structure session logs
- `references/pattern-categories.md` — Full list of tracked patterns
- `references/reflection-prompts.md` — Questions for self-reflection

## Scripts

- `scripts/init_coach.py` — Initialize the ~/.agent-coach directory
- `scripts/reflect.py` — Analyze sessions and update patterns
- `scripts/coach.py` — Importable logging functions
