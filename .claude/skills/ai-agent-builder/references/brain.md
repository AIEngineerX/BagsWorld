# Brain Layer Patterns

## Claude Integration (Anthropic)

```javascript
import Anthropic from '@anthropic-ai/sdk';

class ClaudeBrain {
  constructor(apiKey) {
    this.client = new Anthropic({ apiKey });
  }

  async decide(systemPrompt, userContext, tools) {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: {
          type: 'object',
          properties: t.input || {},
          required: Object.keys(t.input || {}),
        },
      })),
      messages: [{ role: 'user', content: userContext }],
    });

    const toolUse = response.content.find(c => c.type === 'tool_use');
    if (toolUse) {
      return { tool: toolUse.name, input: toolUse.input };
    }
    
    const text = response.content.find(c => c.type === 'text');
    return { tool: null, reasoning: text?.text };
  }
}
```

## OpenAI Integration

```javascript
import OpenAI from 'openai';

class OpenAIBrain {
  constructor(apiKey) {
    this.client = new OpenAI({ apiKey });
  }

  async decide(systemPrompt, userContext, tools) {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContext },
      ],
      tools: tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: {
            type: 'object',
            properties: t.input || {},
            required: Object.keys(t.input || {}),
          },
        },
      })),
    });

    const toolCall = response.choices[0].message.tool_calls?.[0];
    if (toolCall) {
      return {
        tool: toolCall.function.name,
        input: JSON.parse(toolCall.function.arguments),
      };
    }
    
    return { tool: null, reasoning: response.choices[0].message.content };
  }
}
```

## System Prompt Template

```javascript
const buildSystemPrompt = (objective, allowedActions) => `
You are an autonomous agent. Your objective: ${objective}

You can use these actions:
${allowedActions.map(a => `- ${a.name}: ${a.description}`).join('\n')}

Rules:
1. Take one action at a time
2. Observe results before next action
3. If stuck, try alternative approach
4. Call 'complete' when objective achieved
5. Never exceed safety limits

Think step-by-step. Choose the most efficient action.
`;
```

## ReAct Prompting Pattern

```javascript
const buildReActPrompt = (objective, history, currentState) => `
OBJECTIVE: ${objective}

HISTORY:
${history}

CURRENT STATE:
${currentState}

Think through this step-by-step:
1. What have I accomplished so far?
2. What remains to be done?
3. What's the most efficient next action?
4. Are there any risks or blockers?

Choose your next action.
`;
```

## Error Recovery Prompt

```javascript
const buildErrorRecoveryPrompt = (error, lastAction, history) => `
ERROR ENCOUNTERED:
Action: ${lastAction}
Error: ${error}

HISTORY:
${history}

Analyze the error and decide:
1. Should I retry the same action?
2. Should I try an alternative approach?
3. Is this a fatal error requiring abort?

Choose recovery strategy.
`;
```
