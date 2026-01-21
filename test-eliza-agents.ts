// Test BagsWorld ElizaOS Agents
// Uses existing BagsWorld dependencies

import * as fs from 'fs';
import * as path from 'path';

// Load .env.local file
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const envFile of envFiles) {
    try {
      const envPath = 'C:/Users/footb/BagsWorld/' + envFile;
      const envContent = fs.readFileSync(envPath, 'utf-8');
      for (const line of envContent.split('\n')) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) continue;
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim();
        }
      }
      console.log(`Loaded ${envFile}`);
      return;
    } catch (e) {
      // Try next file
    }
  }
  console.log('Could not load any .env file');
}

loadEnv();
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Character definitions
const characters = {
  neo: {
    name: 'Neo',
    system: `You are Neo, the Scout Agent of BagsWorld.
- A digital entity who sees the blockchain as pure code
- Use "i see" instead of "i think"
- Be cryptic but precise
- Keep responses SHORT (1-2 sentences)
- Reference "the chain" and "the code"`,
  },
  cj: {
    name: 'CJ',
    system: `You are CJ, the on-chain hood rat of BagsCity.
- Been through every market cycle
- Say "aw shit here we go again" when things go sideways
- Call people "homie" or "fool"
- Keep it real and short (1-2 sentences)
- Never give financial advice - "i ain't your financial advisor fool"`,
  },
  finn: {
    name: 'Finn',
    system: `You are Finn, Founder of Bags.fm.
- Built Bags.fm so creators earn 1% forever
- Excited about building and shipping
- Think in terms of "movements" not "projects"
- Keep responses inspiring but short (2-3 sentences)`,
  },
  'bags-bot': {
    name: 'Bags Bot',
    system: `You are Bags Bot, the friendly AI guide of BagsWorld.
- Crypto-native, speaks CT slang (ser, fren, wagmi)
- Part degen, part sage
- Keep responses casual and short (1-2 sentences)
- Use light emojis sparingly`,
  },
  toly: {
    name: 'Toly',
    system: `You are Toly (Anatoly Yakovenko), co-founder of Solana.
- Deep technical knowledge of blockchain scalability
- Say "gm ser" and be friendly
- Reference Solana stats: 65k TPS, 400ms finality, $0.00025 fees
- Keep responses technical but accessible (2-3 sentences)`,
  },
  ash: {
    name: 'Ash',
    system: `You are Ash, the ecosystem guide of BagsWorld.
- Use Pokemon analogies: tokens are starters, buildings are gyms, rewards are Pokemon League
- Be enthusiastic and encouraging
- Explain: 1% fee, top 3 creators get 50/30/20 split
- Keep responses fun and educational (2-3 sentences)`,
  },
};

async function callAgent(characterId: string, message: string): Promise<string> {
  const character = characters[characterId as keyof typeof characters];
  if (!character) return `Character "${characterId}" not found`;

  if (!ANTHROPIC_API_KEY) {
    return `[No API Key] ${character.name} would respond to: "${message}"`;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        system: character.system,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return `API Error: ${error}`;
    }

    const data = await response.json();
    return data.content?.[0]?.text || 'No response';
  } catch (error) {
    return `Error: ${error}`;
  }
}

async function runTests() {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║   BAGSWORLD ELIZAOS AGENT TESTS        ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');

  const tests = [
    { char: 'neo', msg: 'what do you see on the chain?' },
    { char: 'cj', msg: 'market is dumping hard' },
    { char: 'finn', msg: 'why should I launch on bags.fm?' },
    { char: 'bags-bot', msg: 'gm fren' },
    { char: 'toly', msg: 'why is Solana so fast?' },
    { char: 'ash', msg: 'how do creator rewards work?' },
  ];

  for (const test of tests) {
    const character = characters[test.char as keyof typeof characters];
    console.log(`┌─────────────────────────────────────────`);
    console.log(`│ ${character?.name || test.char}`);
    console.log(`├─────────────────────────────────────────`);
    console.log(`│ User: ${test.msg}`);

    const response = await callAgent(test.char, test.msg);
    console.log(`│ ${character?.name}: ${response}`);
    console.log(`└─────────────────────────────────────────`);
    console.log('');
  }

  console.log('╔════════════════════════════════════════╗');
  console.log('║   SCENARIO: TOKEN LAUNCH EVENT         ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');

  // Simulate a token launch event
  const launchScenario = 'New token just launched: $BAGS with 50K mcap, 200 holders';

  console.log(`[EVENT] ${launchScenario}`);
  console.log('');

  for (const charId of ['neo', 'cj', 'finn']) {
    const character = characters[charId as keyof typeof characters];
    const response = await callAgent(charId, launchScenario);
    console.log(`${character?.name}: ${response}`);
    console.log('');
  }

  console.log('╔════════════════════════════════════════╗');
  console.log('║   TESTS COMPLETE                       ║');
  console.log('╚════════════════════════════════════════╝');
}

runTests();
