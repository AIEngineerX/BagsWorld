# Action Layer Patterns

## Browser Actions

```javascript
const browserActions = {
  async navigate(page, { url }) {
    await page.goto(url, { waitUntil: 'networkidle' });
    return `Navigated to ${url}`;
  },

  async click(page, { selector }) {
    await page.click(selector);
    return `Clicked ${selector}`;
  },

  async type(page, { selector, text }) {
    await page.fill(selector, text);
    return `Typed "${text}" into ${selector}`;
  },

  async extract(page, { selector }) {
    const text = await page.innerText(selector);
    return text;
  },

  async screenshot(page) {
    const base64 = await page.screenshot({ encoding: 'base64' });
    return `Screenshot captured (${base64.length} bytes)`;
  },

  async scroll(page, { direction = 'down', amount = 500 }) {
    const delta = direction === 'down' ? amount : -amount;
    await page.mouse.wheel(0, delta);
    return `Scrolled ${direction} by ${amount}px`;
  },

  async waitForElement(page, { selector, timeout = 5000 }) {
    await page.waitForSelector(selector, { timeout });
    return `Element ${selector} appeared`;
  },

  async selectOption(page, { selector, value }) {
    await page.selectOption(selector, value);
    return `Selected "${value}" in ${selector}`;
  },
};
```

## API Actions

```javascript
const apiActions = {
  async httpGet({ url, headers = {} }) {
    const res = await fetch(url, { headers });
    const data = await res.json();
    return JSON.stringify(data, null, 2);
  },

  async httpPost({ url, body, headers = {} }) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return JSON.stringify(data, null, 2);
  },

  async delay({ ms }) {
    await new Promise(resolve => setTimeout(resolve, ms));
    return `Waited ${ms}ms`;
  },
};
```

## Solana Actions

```javascript
import { Connection, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';

const solanaActions = {
  async getBalance(connection, { address }) {
    const pubkey = new PublicKey(address);
    const balance = await connection.getBalance(pubkey);
    return `Balance: ${balance / 1e9} SOL`;
  },

  async getTokenBalance(connection, { walletAddress, tokenMint }) {
    const wallet = new PublicKey(walletAddress);
    const mint = new PublicKey(tokenMint);
    const ata = await getAssociatedTokenAddress(mint, wallet);
    
    try {
      const account = await connection.getTokenAccountBalance(ata);
      return `Token balance: ${account.value.uiAmount}`;
    } catch {
      return 'Token balance: 0';
    }
  },

  async transferToken(connection, wallet, { tokenMint, toAddress, amount, decimals }) {
    const mint = new PublicKey(tokenMint);
    const to = new PublicKey(toAddress);
    
    const fromAta = await getAssociatedTokenAddress(mint, wallet.publicKey);
    const toAta = await getAssociatedTokenAddress(mint, to);
    
    const tx = new Transaction().add(
      createTransferInstruction(fromAta, toAta, wallet.publicKey, amount * (10 ** decimals))
    );
    
    const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
    return `Transfer complete: ${sig}`;
  },
};
```

## Notification Actions

```javascript
const notificationActions = {
  async sendTelegram({ botToken, chatId, message }) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
    return 'Telegram message sent';
  },

  async sendDiscordWebhook({ webhookUrl, content }) {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    return 'Discord message sent';
  },

  async log({ message, level = 'info' }) {
    console[level](`[AGENT] ${message}`);
    return `Logged: ${message}`;
  },
};
```

## Control Actions

```javascript
const controlActions = {
  complete({ summary }) {
    return { done: true, summary };
  },

  abort({ reason }) {
    return { done: true, aborted: true, reason };
  },

  requestHumanInput({ question }) {
    return { needsInput: true, question };
  },
};
```

## Action Executor

```javascript
async function executeAction(actionName, params, context) {
  const allActions = {
    ...browserActions,
    ...apiActions,
    ...solanaActions,
    ...notificationActions,
    ...controlActions,
  };

  const action = allActions[actionName];
  if (!action) throw new Error(`Unknown action: ${actionName}`);

  try {
    return await action(context, params);
  } catch (error) {
    return `ERROR: ${error.message}`;
  }
}
```
