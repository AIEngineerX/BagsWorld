#!/usr/bin/env python3
"""Coach module - import to log decisions and outcomes during sessions."""

import json
from pathlib import Path
from datetime import datetime

COACH_DIR = Path.home() / ".agent-coach"
SESSIONS_DIR = COACH_DIR / "sessions"


def ensure_dirs():
    """Ensure coach directories exist."""
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)


def get_session_file():
    """Get the current session file path."""
    ensure_dirs()
    today = datetime.now().strftime("%Y-%m-%d")
    return SESSIONS_DIR / f"session-{today}.json"


def load_session():
    """Load or create today's session."""
    session_file = get_session_file()
    if session_file.exists():
        return json.loads(session_file.read_text())
    return {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "timestamp": datetime.now().isoformat(),
        "decisions": [],
        "outcomes": [],
        "notes": [],
    }


def save_session(session):
    """Save the session to file."""
    session_file = get_session_file()
    session_file.write_text(json.dumps(session, indent=2))


def log_decision(category: str, decision: str, reasoning: str = ""):
    """
    Log a key decision made during the session.
    
    Args:
        category: Type of decision (architecture, prompting, tooling, etc.)
        decision: What was decided
        reasoning: Why this decision was made
    
    Example:
        log_decision("architecture", "Chose ReAct pattern", "Need iterative reasoning")
    """
    session = load_session()
    session["decisions"].append({
        "timestamp": datetime.now().isoformat(),
        "category": category,
        "decision": decision,
        "reasoning": reasoning,
    })
    save_session(session)
    print(f"📝 Logged decision: [{category}] {decision}")


def log_outcome(result: str, description: str, context: dict = None):
    """
    Log an outcome (success or failure).
    
    Args:
        result: 'success' or 'failure'
        description: What happened
        context: Additional context (cause, pattern used, etc.)
    
    Example:
        log_outcome("success", "Agent completed task first try", {"pattern": "explicit tools"})
        log_outcome("failure", "Agent got stuck", {"cause": "ambiguous objective"})
    """
    session = load_session()
    session["outcomes"].append({
        "timestamp": datetime.now().isoformat(),
        "result": result,
        "description": description,
        "context": context or {},
    })
    save_session(session)
    emoji = "✅" if result == "success" else "❌"
    print(f"{emoji} Logged outcome: {description}")


def log_note(note: str):
    """
    Log a general note or observation.
    
    Args:
        note: Any observation worth remembering
    
    Example:
        log_note("Claude works better with numbered steps than bullets")
    """
    session = load_session()
    session["notes"].append({
        "timestamp": datetime.now().isoformat(),
        "note": note,
    })
    save_session(session)
    print(f"📌 Logged note: {note}")


def log_prompt_iteration(original: str, revised: str, improvement: str):
    """
    Log a prompt improvement iteration.
    
    Args:
        original: The original prompt (or summary)
        revised: The improved prompt (or summary)
        improvement: What was improved
    
    Example:
        log_prompt_iteration(
            "Do the thing",
            "Navigate to example.com and extract the h1 text",
            "Made objective specific and actionable"
        )
    """
    session = load_session()
    if "prompt_iterations" not in session:
        session["prompt_iterations"] = []
    
    session["prompt_iterations"].append({
        "timestamp": datetime.now().isoformat(),
        "original": original,
        "revised": revised,
        "improvement": improvement,
    })
    save_session(session)
    print(f"🔄 Logged prompt iteration: {improvement}")


def get_session_summary():
    """Get a summary of today's session."""
    session = load_session()
    return {
        "decisions": len(session.get("decisions", [])),
        "successes": len([o for o in session.get("outcomes", []) if o["result"] == "success"]),
        "failures": len([o for o in session.get("outcomes", []) if o["result"] == "failure"]),
        "notes": len(session.get("notes", [])),
        "prompt_iterations": len(session.get("prompt_iterations", [])),
    }


# Quick access functions
def success(description: str, context: dict = None):
    """Shorthand for log_outcome('success', ...)"""
    log_outcome("success", description, context)


def failure(description: str, context: dict = None):
    """Shorthand for log_outcome('failure', ...)"""
    log_outcome("failure", description, context)


def note(text: str):
    """Shorthand for log_note(...)"""
    log_note(text)


if __name__ == "__main__":
    # Demo usage
    print("Coach module loaded. Example usage:\n")
    print("from coach import log_decision, log_outcome, log_note, success, failure")
    print("")
    print('log_decision("architecture", "Using Playwright for browser", "Need JS support")')
    print('success("Agent completed navigation task")')
    print('failure("Agent stuck in loop", {"cause": "no exit condition"})')
    print('note("Explicit tool descriptions work better than vague ones")')
