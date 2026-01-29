#!/usr/bin/env python3
"""Initialize the agent learning coach directory structure."""

import os
from pathlib import Path
from datetime import datetime

COACH_DIR = Path.home() / ".agent-coach"

def init_coach():
    """Create the coach directory structure with starter files."""
    
    # Create directories
    dirs = [
        COACH_DIR,
        COACH_DIR / "sessions",
        COACH_DIR / "patterns",
    ]
    
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
        print(f"✅ Created {d}")
    
    # Create profile.md
    profile_path = COACH_DIR / "profile.md"
    if not profile_path.exists():
        profile_path.write_text("""# Your Profile

## Background
<!-- Your tech experience, languages you know, frameworks you use -->
- Experience level: 
- Primary languages: 
- Frameworks: 
- Domain focus: 

## Goals
<!-- What are you trying to learn or build? -->
- Short-term: 
- Long-term: 

## Preferences
<!-- How do you like to work? -->
- Verbosity: concise / detailed
- Code style: 
- Favorite tools: 

## Strengths
<!-- What are you good at? -->
- 

## Growth Areas
<!-- What do you want to improve? -->
- 
""")
        print(f"✅ Created {profile_path}")
    
    # Create effective patterns
    effective_path = COACH_DIR / "patterns" / "effective.md"
    if not effective_path.exists():
        effective_path.write_text("""# Effective Patterns

Patterns that have worked well for you. Updated by reflection sessions.

## Prompting
<!-- Prompt structures and approaches that work -->

## Architecture
<!-- Technical decisions that worked -->

## Debugging
<!-- Debugging approaches that were effective -->

---
*Last updated: Never*
""")
        print(f"✅ Created {effective_path}")
    
    # Create anti-patterns
    anti_path = COACH_DIR / "patterns" / "anti-patterns.md"
    if not anti_path.exists():
        anti_path.write_text("""# Anti-Patterns

Patterns to avoid. Learn from past mistakes.

## Prompting
<!-- Prompt approaches that didn't work -->

## Architecture
<!-- Technical decisions that caused problems -->

## Common Mistakes
<!-- Errors you've made multiple times -->

---
*Last updated: Never*
""")
        print(f"✅ Created {anti_path}")
    
    # Create prompting patterns
    prompting_path = COACH_DIR / "patterns" / "prompting.md"
    if not prompting_path.exists():
        prompting_path.write_text("""# Prompting Evolution

How your prompting style has evolved over time.

## Current Style
<!-- Your current approach to prompting -->

## What Works
<!-- Specific techniques that get good results -->

## Iterations
<!-- How your prompts have changed -->

---
*Last updated: Never*
""")
        print(f"✅ Created {prompting_path}")
    
    # Create curriculum
    curriculum_path = COACH_DIR / "curriculum.md"
    if not curriculum_path.exists():
        curriculum_path.write_text("""# Learning Curriculum

Your personalized learning path. Updated by reflection sessions.

## Current Focus
<!-- What you should work on now -->
- 

## Exercises
<!-- Small, focused challenges -->
1. 

## Completed
<!-- Past exercises and lessons learned -->

---
*Last updated: Never*
""")
        print(f"✅ Created {curriculum_path}")
    
    # Create evolution log
    evolution_path = COACH_DIR / "evolution.md"
    if not evolution_path.exists():
        evolution_path.write_text(f"""# Evolution Log

Track your progress over time.

## Timeline

### {datetime.now().strftime('%Y-%m-%d')} - Started
- Initialized agent-learning-coach
- Set up tracking structure

---

## Milestones
<!-- Key achievements -->

## Metrics
<!-- Quantitative progress -->
- Sessions logged: 0
- Patterns discovered: 0
- Exercises completed: 0
""")
        print(f"✅ Created {evolution_path}")
    
    print(f"\n🎉 Agent Learning Coach initialized at {COACH_DIR}")
    print(f"\nNext steps:")
    print(f"1. Edit {profile_path} with your details")
    print(f"2. Start building! The coach will learn your patterns")
    print(f"3. Run reflect.py after sessions to update patterns")


if __name__ == "__main__":
    init_coach()
