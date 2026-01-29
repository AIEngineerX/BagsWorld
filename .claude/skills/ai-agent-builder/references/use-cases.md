# Use Case Implementations

## 1. Price Monitor Agent

Monitors token prices and alerts on threshold.

```javascript
import Anthropic from '@anthropic-ai/sdk';

const CONFIG = {
  tokenAddress: 'YOUR_TOKEN_ADDRESS',
  alertThresholds: { above: 0.01, below: 0.005 },
  checkInterval: 60000, // 1 minute
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
};

async function getPrice(tokenAddress) {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
  const data = await res.json();
  return parseFloat(data.pairs?.[0]?.priceUsd || 0);
}

async function sendAlert(message) {
  await fetch(`https://api.telegram.org/bot${CONFIG.telegramBotToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CONFIG.telegramChatId, text: message }),
  });
}

async function monitor() {
  let lastAlert = 0;
  
  setInterval(async () => {
    const price = await getPrice(CONFIG.tokenAddress);
    const now = Date.now();
    
    if (now - lastAlert < 300000) return; // 5 min cooldown
    
    if (price > CONFIG.alertThresholds.above) {
      await sendAlert(`🚀 Price above $${CONFIG.alertThresholds.above}: $${price}`);
      lastAlert = now;
    } else if (price < CONFIG.alertThresholds.below) {
      await sendAlert(`⚠️ Price below $${CONFIG.alertThresholds.below}: $${price}`);
      lastAlert = now;
    }
  }, CONFIG.checkInterval);
}

monitor();
```

## 2. Social Media Agent

Posts content and engages on Twitter/X.

```javascript
const CONFIG = {
  objective: 'Post daily crypto insights and engage with community',
  postSchedule: '0 9,15,21 * * *', // 9am, 3pm, 9pm
};

const tools = [
  { name: 'compose_tweet', description: 'Write a tweet', input: { topic: 'string' } },
  { name: 'post_tweet', description: 'Post to Twitter', input: { content: 'string' } },
  { name: 'search_mentions', description: 'Find mentions to reply to' },
  { name: 'reply_tweet', description: 'Reply to a tweet', input: { tweetId: 'string', content: 'string' } },
  { name: 'analyze_engagement', description: 'Check recent post performance' },
];

async function runSocialAgent(claude) {
  const systemPrompt = `
You are a crypto social media agent. Your personality:
- Knowledgeable but approachable
- Uses occasional emojis
- Engages authentically, not spammy
- Stays on topic (crypto, DeFi, Solana)

Rules:
1. Never shill or give financial advice
2. Be respectful in all interactions
3. Add value with insights, not noise
`;

  // Daily routine
  const routine = async () => {
    // 1. Check engagement on recent posts
    const engagement = await executeAction('analyze_engagement');
    
    // 2. Compose new content based on trends
    const topic = await claude.decide(
      systemPrompt,
      `Current engagement: ${engagement}\nWhat topic should I post about?`,
      tools
    );
    
    // 3. Post
    if (topic.tool === 'compose_tweet') {
      const tweet = await claude.decide(
        systemPrompt,
        `Write a tweet about: ${topic.input.topic}`,
        tools
      );
      await executeAction('post_tweet', tweet.input);
    }
    
    // 4. Engage with mentions
    const mentions = await executeAction('search_mentions');
    for (const mention of mentions.slice(0, 5)) {
      const reply = await claude.decide(
        systemPrompt,
        `Reply to this mention: "${mention.text}"`,
        tools
      );
      if (reply.tool === 'reply_tweet') {
        await executeAction('reply_tweet', reply.input);
      }
    }
  };

  // Schedule with cron
  // cron.schedule(CONFIG.postSchedule, routine);
}
```

## 3. Research Agent

Gathers and synthesizes information from multiple sources.

```javascript
const tools = [
  { name: 'web_search', description: 'Search the web', input: { query: 'string' } },
  { name: 'fetch_page', description: 'Get page content', input: { url: 'string' } },
  { name: 'extract_data', description: 'Extract structured data', input: { content: 'string', schema: 'string' } },
  { name: 'save_finding', description: 'Save a research finding', input: { finding: 'string', source: 'string' } },
  { name: 'generate_report', description: 'Compile findings into report' },
  { name: 'complete', description: 'Research complete', input: { summary: 'string' } },
];

async function researchAgent(claude, topic) {
  const memory = new ShortTermMemory(50);
  const findings = [];

  const systemPrompt = `
You are a research agent. Your task: ${topic}

Process:
1. Search for relevant sources
2. Fetch and analyze each source
3. Extract key findings
4. Save important data points
5. Generate comprehensive report

Be thorough but efficient. Cite sources.
`;

  for (let step = 0; step < 30; step++) {
    const decision = await claude.decide(
      systemPrompt,
      memory.getContext() + `\n\nFindings so far: ${findings.length}`,
      tools
    );

    const result = await executeAction(decision.tool, decision.input);
    memory.addAction(decision.tool, decision.input);
    memory.addObservation(result);

    if (decision.tool === 'save_finding') {
      findings.push(decision.input);
    }

    if (decision.tool === 'complete') {
      return { findings, summary: decision.input.summary };
    }
  }
}
```

## 4. Trading Signal Agent

Analyzes market data and generates trading signals.

```javascript
const CONFIG = {
  tokens: ['TOKEN1_ADDRESS', 'TOKEN2_ADDRESS'],
  indicators: ['price_change', 'volume_spike', 'holder_growth'],
  signalThresholds: {
    bullish: { priceChange: 10, volumeSpike: 200 },
    bearish: { priceChange: -10, volumeSpike: 150 },
  },
};

async function getMarketData(tokenAddress) {
  const [dex, holders] = await Promise.all([
    fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`).then(r => r.json()),
    fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${process.env.HELIUS_KEY}`, {
      method: 'POST',
      body: JSON.stringify({ mintAccounts: [tokenAddress] }),
    }).then(r => r.json()),
  ]);

  const pair = dex.pairs?.[0];
  return {
    price: parseFloat(pair?.priceUsd || 0),
    priceChange24h: parseFloat(pair?.priceChange?.h24 || 0),
    volume24h: parseFloat(pair?.volume?.h24 || 0),
    liquidity: parseFloat(pair?.liquidity?.usd || 0),
  };
}

async function analyzeSignals(claude, marketData) {
  const systemPrompt = `
You are a trading signal analyst. Analyze market data and generate signals.

Rules:
1. Only generate HIGH CONFIDENCE signals
2. Consider multiple indicators
3. Factor in market conditions
4. This is NOT financial advice - for informational purposes only

Output format: { signal: 'bullish'|'bearish'|'neutral', confidence: 0-100, reasoning: string }
`;

  const response = await claude.decide(
    systemPrompt,
    `Market data:\n${JSON.stringify(marketData, null, 2)}`,
    [{ name: 'generate_signal', description: 'Output trading signal', input: { signal: 'string', confidence: 'number', reasoning: 'string' } }]
  );

  return response.input;
}

async function tradingAgent() {
  for (const token of CONFIG.tokens) {
    const data = await getMarketData(token);
    const signal = await analyzeSignals(claude, data);
    
    if (signal.confidence > 70) {
      await sendAlert(`${signal.signal.toUpperCase()} signal for ${token}\nConfidence: ${signal.confidence}%\n${signal.reasoning}`);
    }
  }
}
```

## 5. Form Filler Agent

Automatically fills web forms.

```javascript
async function formFillerAgent(page, claude, formData) {
  const tools = [
    { name: 'identify_fields', description: 'Find form fields on page' },
    { name: 'fill_field', description: 'Fill a form field', input: { selector: 'string', value: 'string' } },
    { name: 'click_button', description: 'Click button', input: { selector: 'string' } },
    { name: 'verify_filled', description: 'Check if form is complete' },
    { name: 'submit', description: 'Submit the form' },
    { name: 'complete', description: 'Done', input: { summary: 'string' } },
  ];

  const systemPrompt = `
You are a form filling agent. Fill forms accurately with provided data.

Data available:
${JSON.stringify(formData, null, 2)}

Rules:
1. Identify all required fields first
2. Match data to appropriate fields
3. Verify before submitting
4. Handle dropdowns and checkboxes appropriately
`;

  const memory = new ShortTermMemory();

  for (let step = 0; step < 20; step++) {
    const screenshot = await page.screenshot({ encoding: 'base64' });
    const html = await page.content();

    const decision = await claude.decide(
      systemPrompt,
      `${memory.getContext()}\n\nCurrent page HTML (truncated): ${html.slice(0, 5000)}`,
      tools
    );

    if (decision.tool === 'fill_field') {
      await page.fill(decision.input.selector, decision.input.value);
    } else if (decision.tool === 'click_button') {
      await page.click(decision.input.selector);
    } else if (decision.tool === 'submit') {
      await page.click('button[type="submit"], input[type="submit"]');
    } else if (decision.tool === 'complete') {
      return { success: true, summary: decision.input.summary };
    }

    memory.addAction(decision.tool, decision.input);
  }
}
```
