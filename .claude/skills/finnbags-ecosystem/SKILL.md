---
name: finnbags-ecosystem
description: "Comprehensive knowledge of Finnbags, Bags.fm, and the BagsApp ecosystem. Use when building on Bags.fm, integrating with Bags API/SDK, understanding creator tokenomics, working with Meteora DBC bonding curves, analyzing Bags tokens, building creator-focused memecoin tools, or discussing the platform mechanics. Triggers on: Finnbags, Finn Bags, finnbags, Bags.fm, bags.fm, BagsApp, Bags SDK, Bags API, creator royalties, 1% trading fees, Meteora DBC, token graduation, fee sharing, DividendsBot, Hunter Isaacson, BTH token, NYAN token, memecoin launchpad comparisons with pump.fun."
---

# Finnbags & Bags.fm Ecosystem

Complete knowledge base for building on and integrating with the Bags.fm platform.

## Platform Overview

**Bags.fm** is a Solana-native memecoin launchpad and trading app focused on creator monetization. Unlike competitors, creators earn **1% of all trading volume forever** on tokens assigned to them.

### Key Differentiators from Pump.fun
- **Creator royalties**: 1% perpetual trading fees (Pump.fun has no creator fees)
- **Mobile-first**: iOS + Android apps (Pump.fun is web-only)
- **Social integration**: Group chats, friend activity, real-time trade notifications
- **Income Assignment**: Community can assign royalties to meme creators who didn't launch the token
- **Dividends**: Optional holder rewards via @DividendsBot
- **Fiat onramps**: Apple Pay, Coinbase, MoonPay, Robinhood integration

### Founding Team
- **Finn (@finnbags)**: Founder & CEO, 102K+ followers, based in Los Angeles
- **Hunter Isaacson (@hunterjisaacson)**: Co-founder, creator of NGL.link (250M+ downloads), product designer
- Team members: Stu Bags, Ramo Bags

## Technical Architecture

### Bonding Curve Mechanics
Bags uses **Meteora Dynamic Bonding Curve (DBC)**:

1. **Pre-graduation**: Token trades on bonding curve, price increases with buys
2. **Graduation**: When SOL threshold met, token migrates to Meteora DAMM v1/v2
3. **Post-graduation**: Token tradeable on DEX with locked LP, fees go to creator/partner

### Program IDs (Mainnet)
```
Bags Creator Signer:     BAGSB9TpGrZxQbEsrEznv5jXXdwyP6AXerN8aVRiAmcv
Bags Fee Share V1:       FEEhPbKVKnco9EXnaY3i4R5rQVUx91wgVfu8qokixywi
Bags Fee Share V2:       FEE2tBhCKAt7shrod19QttSVREUYPiyMzoku1mL1gqVK
Meteora DAMM v2:         cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG
Meteora DBC:             dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN
Address Lookup Table:    Eq1EVs15EAWww1YtPTtWPzJRLPJoS6VYP9oW9SbNr3yp
```

### Fee Distribution
- **Creator**: 1% of all trading volume (configurable split)
- **Partner**: Configurable percentage for platforms building on Bags
- **Protocol**: Meteora/Bags take small protocol fee

## API & SDK Integration

### Getting Started
```bash
npm install @bagsfm/bags-sdk @solana/web3.js
```

Get API key at: https://dev.bags.fm

### SDK Setup
```typescript
import { BagsSDK } from '@bagsfm/bags-sdk';
import { Connection, PublicKey } from '@solana/web3.js';

const connection = new Connection('https://api.mainnet-beta.solana.com');
const sdk = new BagsSDK(process.env.BAGS_API_KEY, connection, 'processed');
```

### Common Operations
See `references/api-patterns.md` for:
- Token launch flow
- Getting token creators
- Claiming fees
- Trading tokens
- Lifetime fees queries

### API Base URL
```
https://public-api-v2.bags.fm/api/v1/
```

### Rate Limits
- 1,000 requests/hour per user
- Applies across all API keys
- Check `X-RateLimit-Remaining` header

## Dividends System

Creators can enable holder rewards via **@DividendsBot**:

1. Creator adds @DividendsBot as fee claimer when launching
2. Automatic distribution every 24 hours
3. Requires ≥10 SOL in unclaimed earnings
4. Top 100 holders receive proportional payouts
5. Dividends deposited directly to wallets

## Notable Ecosystem Tokens

| Token | Significance |
|-------|-------------|
| BTH (BuyTheHat) | Flagship token, funded dogwifhat purchase |
| NYAN | Creator royalties go to Nyan Cat artist Chris Torres |
| WATER | Community charity token |

## Market Position (Jan 2026)

- ~47% launchpad market share (competing with Pump.fun, LetsBonk)
- $2B+ cumulative trading volume
- $1M hackathon announced for builders

## Building on Bags

### Use Cases
1. **Creator tools**: Fee tracking dashboards, holder analytics
2. **Trading bots**: Automated trading with SDK
3. **Community tools**: Holder management, dividend tracking
4. **Analytics**: Token performance, creator earnings

### Reference Files
- `references/api-patterns.md` - Complete API code examples
- `references/ecosystem-accounts.md` - Key X/Twitter accounts and resources
