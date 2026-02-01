# Shaw's Development Rules

Extracted from elizaOS `.cursorrules` — the principles Shaw uses for agent development.

## Core Development Principles

### 1. Flow - Always Plan First

- **Bug Fixes**: First identify the bug, research ALL related files, create complete change plan
- **Impact Analysis**: Identify all possible errors and negative outcomes from changes
- **Documentation**: Create thorough PRD and implementation plan BEFORE writing any code
- **Identify Risks**: Thoroughly outline all risks and offer multiple approaches, choosing your favorite
- **Just Do It**: Once the plan is in place, start writing code. Don't wait for response from the user.

### 2. No Stubs or Incomplete Code

- **Never** use stubs, fake code, or incomplete implementations
- **Always** continue writing until all stubs are replaced with finished, working code
- **No POCs**: Never deliver proof-of-concepts — only finished, detailed code
- **Iteration**: Work on files until they are perfect, looping testing and fixing until all tests pass

### 3. Test-Driven Development

- Models hallucinate frequently — thorough testing is critical
- Verify tests are complete and passing before declaring changes correct
- First attempts are usually incorrect — test thoroughly
- Write tests before implementation when possible

## Testing Infrastructure

### Command Structure

- **Main Command**: `elizaos test` (run from packages/cli)
- **Test Framework**: bun:test
- **Subcommands**:
  - `component`: Run component tests using bun:test
  - `e2e`: Run end-to-end runtime tests
  - `all`: Run both component and e2e tests (default)

### Test Types

**E2E Tests**:

- Use actual runtime
- Cannot use bun:test state (interferes with internal elizaos bun:test instance)
- Test real integrations and workflows

**Unit Tests**:

- Use bun:test with standard primitives
- Test individual components in isolation

## Architecture Details

### Core Dependencies

- **Central Dependency**: Everything depends on @elizaos/core or packages/core
- **No Circular Dependencies**: Core cannot depend on other packages
- **Import Pattern**: Use @elizaos/core in package code, packages/core in internal references

### Key Files

- **Types**: `packages/core/src/types.ts` — All core type definitions
- **Runtime**: `packages/core/src/runtime.ts` — Main runtime implementation

### Abstraction Layers

**Channel → Room Mapping**:

- Discord/Twitter/GUI channels become "rooms"
- All IDs swizzled with agent's UUID into deterministic UUIDs
- Maintains consistency across platforms

**Server → World Mapping**:

- Servers become "worlds" in agent memory
- Some connectors (MMO games) may use "world" on both sides

**Messaging Server Abstractions**:

- CLI uses: server, channel, user
- Frontend client unaware of worlds/rooms
- These are purely agent-side abstractions

### Service Architecture

- Services maintain system state
- Access pattern: `getService(serviceName)`
- Services can call each other
- Actions can access services

## Component Specifications

### Actions

**Purpose**: Define agent capabilities and response mechanisms

**Decision Flow**:

1. Message received
2. Agent evaluates all actions via validation functions
3. Valid actions provided to LLM via actionsProvider
4. LLM decides which action(s) to execute
5. Handler generates response with "thought" component
6. Response processed and sent

### Providers

**Purpose**: Supply dynamic contextual information — agent's "senses"

**Functionality**:

- Inject real-time information into agent context
- Bridge between agent and external systems
- Format information for conversation templates
- Maintain consistent data access

**Examples**:

- News provider: Fetch and format news
- Terminal provider: Game terminal information
- Wallet provider: Current asset information
- Time provider: Current date/time injection

**Execution**: Run during or before action execution

### Evaluators

**Purpose**: Post-interaction cognitive processing

**Capabilities**:

- Knowledge extraction and storage
- Relationship tracking between entities
- Conversation quality self-reflection
- Goal tracking and achievement
- Tone analysis for future adjustments

**Execution**: Run after response generation with AgentRuntime

### Tasks

**Purpose**: Manage deferred, scheduled, and interactive operations

**Features**:

- Queue work for later execution
- Repeat actions at defined intervals
- Await user input
- Implement multi-interaction workflows
- Task workers registered by name with runtime

### Plugins

**Purpose**: Modular extensions for enhanced capabilities

**Features**:

- Add new functionality
- Integrate external services
- Customize agent behavior
- Platform-specific enhancements

**HTTP Routes**:

- "public" routes exposed as HTML tabs
- Must have "name" property for tab display

### Services

**Purpose**: Enable AI agents to interact with external platforms

**Characteristics**:

- Specialized interface per platform
- Maintain consistent agent behavior
- Core component of the system

### Events

Messages are passed by events, so that individual services are decoupled from generic agent event handlers.

## Package Structure

```
packages/core        - @elizaos/core - the runtime and types
packages/client      - The frontend GUI displayed by CLI
packages/app         - Desktop/mobile app (Tauri)
packages/cli         - CLI with REST API, GUI, agent loader
packages/plugin-bootstrap - Default event handlers, actions, providers
packages/plugin-sql  - DatabaseAdapter for Postgres and PGLite
```

## Shaw's Philosophy

From interviews and dev school:

> "The secret to making a billion dollars is to use the existing agent framework to deliver apps to people on social media that they want."

> "Prompt engineering is the most easy improvement" for AI agents.

> "Grind 15 hours a day — this is the best opportunity of your life."

Focus on:

1. Building applications, not new frameworks
2. Iterating on prompts before complex architecture
3. Shipping fast, testing thoroughly
4. Using what exists (elizaOS) rather than reinventing
