# Development Workflow Skill

A structured methodology for building production-quality code through systematic planning, implementation, and validation phases.

## Overview

This skill defines a numbered workflow system (1-0) for taking projects from concept to production-ready code. Each phase has specific requirements and deliverables. The system emphasizes:

- **Real code over stubs** - No placeholders, TODOs, or simplified implementations
- **Verification over assertion** - Prove it works, don't claim it works
- **Integration over mocking** - Test against real running code
- **Simplicity over abstraction** - Remove unnecessary complexity

## Workflow Phases

### Phase 1: Plan & Research

**Trigger:** User says "1", "plan", or "let's plan this"

Before writing any code, analyze the problem space thoroughly.

**Requirements:**
1. Clarify the goal - what exactly needs to be built and why
2. Identify constraints, dependencies, and edge cases
3. Research existing patterns, APIs, or libraries that apply
4. Outline the architecture and data flow
5. List unknowns and risks

**Deliverable:** A written plan for review before implementation begins. Ask clarifying questions if requirements are ambiguous. Do not simplify anything or stub it.

---

### Phase 2: Implement Plan

**Trigger:** User says "2", "implement", or "build it"

Execute the agreed plan step-by-step.

**Requirements:**
1. Follow the plan sequentially, noting any deviations
2. Write real, functional code - no stubs, placeholders, or TODOs
3. Handle errors and edge cases as you go
4. Commit logical chunks with clear explanations

**Rules:**
- If blockers arise or the plan needs revision, stop and discuss before proceeding
- No try/catch or fallbacks unless genuinely necessary
- No stubbed code, TODOs, or simplifications
- Always implement the complete version, even if complex

---

### Phase 3: Keep Going

**Trigger:** User says "3", "continue", or "keep going"

Continue working through all remaining tasks until complete.

**Process:**
- For each item: implement fully → verify it works → move to next
- Don't stop to ask permission between items
- Provide final summary of completed work and any blocked items

**Rules:**
- Fully finished, production-ready code only
- No defensive programming unless necessary
- No stubs, TODOs, or simplifications
- Complete the most thorough version possible

---

### Phase 4: Code Quality Pass

**Trigger:** User says "4", "refactor", or "quality pass"

Review and refactor current code for quality.

**Criteria:**
1. **Compact** - Remove dead code, redundancy, over-abstraction
2. **Concise** - Simplify verbose logic, use idiomatic patterns
3. **Clean** - Consistent naming, clear structure, proper formatting
4. **Capable** - Handles edge cases, fails gracefully, performs well

**Deliverable:** Refactored code with brief explanations of changes.

---

### Phase 5: Thorough Testing

**Trigger:** User says "5", "test", or "add tests"

Review and expand test coverage beyond the happy path.

**Requirements:**
1. Test boundary conditions and edge cases
2. Test error handling and invalid inputs
3. Test integration points with real dependencies where possible
4. Test concurrent/async behavior if applicable
5. Verify actual outputs match expected - inspect the data

**Critical Rule:** Tests must exercise real code paths. Never mock the code under test. Focus on integration tests against real running code.

---

### Phase 6: LARP Assessment

**Trigger:** User says "6", "larp check", or "reality check"

Critically evaluate whether this code is real or performative.

**Check for:**
1. Stubbed functions that return fake data
2. Hardcoded values masquerading as dynamic behavior
3. Tests that mock away the actual logic being tested
4. Error handling that silently swallows failures
5. Async code that doesn't actually await
6. Validation that doesn't validate
7. Any code path that hasn't been executed and verified

**Process:**
1. Report findings honestly
2. Flag anything that looks functional but isn't proven
3. Create TODOs for all issues found
4. Fix every issue, from most complicated to simplest

*This is the most important validation phase - run repeatedly to find issues.*

---

### Phase 7: Clean Up Slop

**Trigger:** User says "7", "deslop", or "clean up"

Remove AI-generated cruft and over-engineering.

**Target for removal:**
1. Unnecessary abstractions and wrapper functions
2. Verbose comments that restate the obvious
3. Defensive code for impossible conditions
4. Over-generic solutions for specific problems
5. Redundant null checks and type assertions
6. Enterprise patterns in simple scripts
7. Filler words and hedging in strings/docs

**Rule:** Keep what adds value, delete what adds noise.

---

### Phase 8: Production Readiness Validation

**Trigger:** User says "8", "prod check", or "deployment ready"

Final checklist before deployment.

**Verify with evidence (not assertions):**
1. All tests pass with real execution, not mocked
2. Error handling covers failure modes with proper logging
3. Configuration is externalized, no hardcoded secrets
4. Performance is acceptable under expected load
5. Dependencies are pinned and security-scanned
6. Rollback path exists
7. Monitoring/alerting is in place

**Process:** If any issues found, create TODOs and fix all of them.

---

### Phase 9: Review Last Task

**Trigger:** User says "9" or "review"

Audit what was just completed.

**Questions to answer:**
1. Does it actually work - did you verify the output?
2. Does it solve the original problem or just part of it?
3. Did anything get skipped or deferred?
4. Are there assumptions that should be documented?
5. What could break this in production?

**Deliverable:** Honest assessment, not confident summary. Create TODOs for incomplete items and fix them.

---

### Phase 0: Fix All Remaining Issues

**Trigger:** User says "0", "fix all", or "finish it"

Systematically resolve everything outstanding.

**Process:**
1. List every open issue - bugs, TODOs, skipped tests, known limitations
2. Prioritize by impact
3. Fix each one completely before moving to the next
4. Verify each fix with actual execution
5. Re-run full test suite after each fix to catch regressions

**Completion criteria:** Zero issues remain. All code is fully finished, production-ready, with no stubs or simplifications.

---

## Core Principles

### What "Real Code" Means
- Functions that perform actual operations, not return hardcoded values
- API calls that hit real endpoints
- Database operations that read/write actual data
- Validation that rejects invalid input
- Error handling that surfaces problems, not hides them

### What to Avoid
- `// TODO: implement later`
- `return mockData;`
- `catch (e) { /* ignore */ }`
- `async function() { return hardcodedValue; }`
- Tests that mock the system under test
- Abstractions with single implementations
- Comments that describe what code obviously does

### Testing Philosophy
- Integration tests over unit tests with mocks
- Real dependencies over test doubles
- Actual execution over coverage metrics
- Verified outputs over green checkmarks

## Usage

Simply reference the phase number or keyword during development:

```
User: 1
Claude: [Enters planning mode, asks clarifying questions]

User: 2  
Claude: [Implements the agreed plan]

User: 6
Claude: [Performs LARP assessment, finds and fixes issues]
```

Phases can be repeated as needed. Phase 6 (LARP Assessment) and Phase 7 (Clean Up Slop) are particularly valuable to run multiple times.
