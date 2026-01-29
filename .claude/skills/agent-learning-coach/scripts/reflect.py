#!/usr/bin/env python3
"""Reflect on recent sessions and update patterns."""

import os
import json
from pathlib import Path
from datetime import datetime

COACH_DIR = Path.home() / ".agent-coach"

def load_recent_sessions(days=7):
    """Load sessions from the last N days."""
    sessions_dir = COACH_DIR / "sessions"
    sessions = []
    
    if not sessions_dir.exists():
        return sessions
    
    for f in sessions_dir.glob("*.json"):
        try:
            data = json.loads(f.read_text())
            sessions.append(data)
        except:
            pass
    
    # Sort by date, most recent first
    sessions.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return sessions[:20]  # Last 20 sessions max


def generate_reflection_prompt(sessions, profile, patterns):
    """Generate a prompt for Claude to analyze sessions."""
    
    return f"""You are a coding coach analyzing a developer's recent sessions.

## Developer Profile
{profile}

## Current Effective Patterns
{patterns.get('effective', 'None documented yet')}

## Current Anti-Patterns
{patterns.get('anti', 'None documented yet')}

## Recent Sessions
{json.dumps(sessions, indent=2) if sessions else 'No sessions logged yet'}

---

ANALYZE recent sessions for patterns:
1. What prompting approaches worked/didn't work?
2. What architecture decisions were made?
3. What errors kept recurring?

UPDATE the pattern files with new observations:
- Add effective patterns discovered
- Add anti-patterns to avoid
- Note any debugging insights

UPDATE the curriculum:
- What should they focus on improving?
- Suggest 1-2 specific exercises

UPDATE evolution.md:
- Note any progress or milestones

PROVIDE a brief summary:
- Key insight from this reflection
- One specific thing to try next session
"""


def main():
    """Run reflection analysis."""
    
    if not COACH_DIR.exists():
        print("❌ Coach directory not found. Run init_coach.py first.")
        return
    
    print("🔍 Loading recent sessions...")
    sessions = load_recent_sessions()
    
    print("📖 Loading profile and patterns...")
    profile = ""
    profile_path = COACH_DIR / "profile.md"
    if profile_path.exists():
        profile = profile_path.read_text()
    
    patterns = {}
    effective_path = COACH_DIR / "patterns" / "effective.md"
    if effective_path.exists():
        patterns['effective'] = effective_path.read_text()
    
    anti_path = COACH_DIR / "patterns" / "anti-patterns.md"
    if anti_path.exists():
        patterns['anti'] = anti_path.read_text()
    
    print("\n" + "="*50)
    print("REFLECTION PROMPT")
    print("="*50)
    print("\nCopy this prompt to Claude for analysis:\n")
    print(generate_reflection_prompt(sessions, profile, patterns))
    print("\n" + "="*50)
    
    print("\nAfter Claude analyzes, manually update:")
    print(f"  - {COACH_DIR}/patterns/effective.md")
    print(f"  - {COACH_DIR}/patterns/anti-patterns.md")
    print(f"  - {COACH_DIR}/curriculum.md")
    print(f"  - {COACH_DIR}/evolution.md")


if __name__ == "__main__":
    main()
