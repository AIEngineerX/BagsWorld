// Simple test script for BagsWorld agents
// Tests character definitions and basic functionality without full ElizaOS runtime

import Anthropic from '@anthropic-ai/sdk';

// Character definitions (simplified for testing)
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
};

async function testAgent(characterId: string, message: string) {
  const character = characters[characterId as keyof typeof characters];
  if (!character) {
    console.log(`Character "${characterId}" not found`);
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('\n[FALLBACK MODE - No API Key]');
    console.log(`${character.name}: *would respond to "${message}"*`);
    return;
  }

  const client = new Anthropic({ apiKey });

  console.log(`\n[Testing ${character.name}]`);
  console.log(`User: ${message}`);

  try {
    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      system: character.system,
      messages: [{ role: 'user', content: message }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    console.log(`${character.name}: ${text}`);
  } catch (error) {
    console.log(`Error: ${error}`);
  }
}

async function runTests() {
  console.log('========================================');
  console.log('   BAGSWORLD AGENT TEST SUITE');
  console.log('========================================');

  // Test each character
  await testAgent('neo', 'what do you see on the chain?');
  await testAgent('cj', 'market is dumping hard');
  await testAgent('finn', 'why should I launch on bags.fm?');
  await testAgent('bags-bot', 'gm fren');

  console.log('\n========================================');
  console.log('   SCENARIO TESTS');
  console.log('========================================');

  // Test specific scenarios
  await testAgent('neo', 'scan for new token launches');
  await testAgent('cj', 'I just got rugged');
  await testAgent('finn', 'how do creators make money?');
  await testAgent('bags-bot', 'what can you do?');

  console.log('\n========================================');
  console.log('   TESTS COMPLETE');
  console.log('========================================');
}

runTests();
