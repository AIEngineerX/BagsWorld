/**
 * Agent Testing Utility
 *
 * Run locally to test agent functionality without GitHub Actions.
 * Usage: npx ts-node scripts/test-agents.ts [command]
 *
 * Commands:
 *   status     - Check all agent statuses
 *   claim      - Trigger auto-claim agent
 *   buyback    - Trigger buyback agent
 *   scout      - Check scout agent status
 *   full       - Run full agent test cycle
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const AGENT_SECRET = process.env.AGENT_SECRET || 'local-dev-secret-change-in-production';

interface AgentResponse {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

async function callAgentApi(action: string, body?: Record<string, unknown>): Promise<AgentResponse> {
  try {
    const response = await fetch(`${BASE_URL}/api/agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AGENT_SECRET}`,
      },
      body: JSON.stringify({ action, ...body }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkStatus(): Promise<void> {
  console.log('\n📊 Checking Agent Status...\n');

  // Auto-Claim Status
  console.log('🤖 Auto-Claim Agent:');
  const claimStatus = await callAgentApi('status');
  if (claimStatus.success) {
    console.log(`   Running: ${(claimStatus.agent as any)?.isRunning ?? 'unknown'}`);
    console.log(`   Total Claimed: ${(claimStatus.agent as any)?.totalClaimed ?? 0} SOL`);
    console.log(`   Wallet Balance: ${(claimStatus.wallet as any)?.balance ?? 'unknown'} SOL`);
  } else {
    console.log(`   Error: ${claimStatus.error}`);
  }

  // Buyback Status
  console.log('\n💰 Buyback Agent:');
  const buybackStatus = await callAgentApi('buyback-status');
  if (buybackStatus.success) {
    console.log(`   Running: ${(buybackStatus.buyback as any)?.isRunning ?? 'unknown'}`);
    console.log(`   Total Buybacks: ${(buybackStatus.buyback as any)?.totalBuybacksSol ?? 0} SOL`);
    console.log(`   Tokens Burned: ${(buybackStatus.buyback as any)?.totalTokensBurned ?? 0}`);
  } else {
    console.log(`   Error: ${buybackStatus.error}`);
  }

  // Scout Status
  console.log('\n🔍 Scout Agent:');
  const scoutStatus = await callAgentApi('scout-status');
  if (scoutStatus.success) {
    console.log(`   Running: ${(scoutStatus.scout as any)?.isRunning ?? 'unknown'}`);
    console.log(`   Launches Scanned: ${(scoutStatus.scout as any)?.launchesScanned ?? 0}`);
    console.log(`   Alerts Sent: ${(scoutStatus.scout as any)?.alertsSent ?? 0}`);
  } else {
    console.log(`   Error: ${scoutStatus.error}`);
  }
}

async function triggerClaim(): Promise<void> {
  console.log('\n🚀 Triggering Auto-Claim...\n');

  const result = await callAgentApi('trigger');

  if (result.success) {
    const claimResult = result.result as any;
    console.log('✅ Claim triggered successfully');
    console.log(`   Positions Claimed: ${claimResult?.positionsClaimed ?? 0}`);
    console.log(`   SOL Claimed: ${claimResult?.totalSolClaimed ?? 0}`);
    if (claimResult?.signatures?.length > 0) {
      console.log(`   Signatures:`);
      claimResult.signatures.forEach((sig: string) => {
        console.log(`     - ${sig}`);
      });
    }
    if (claimResult?.errors?.length > 0) {
      console.log(`   Errors: ${claimResult.errors.join(', ')}`);
    }
  } else {
    console.log(`❌ Claim failed: ${result.error}`);
  }
}

async function triggerBuyback(): Promise<void> {
  console.log('\n💰 Triggering Buyback...\n');

  const result = await callAgentApi('buyback-trigger');

  if (result.success) {
    const buybackResult = result.result as any;
    console.log('✅ Buyback triggered successfully');
    console.log(`   SOL Spent: ${buybackResult?.solSpent ?? 0}`);
    console.log(`   Tokens Bought: ${buybackResult?.tokensBought ?? 0}`);
    console.log(`   Tokens Burned: ${buybackResult?.tokensBurned ?? 0}`);
  } else {
    console.log(`❌ Buyback failed: ${result.error}`);
  }
}

async function checkScout(): Promise<void> {
  console.log('\n🔍 Checking Scout Agent...\n');

  const launches = await callAgentApi('scout-launches', { count: 5 });

  if (launches.success) {
    console.log(`Found ${(launches as any).count} recent launches:\n`);
    const recentLaunches = (launches as any).launches || [];
    recentLaunches.forEach((launch: any, i: number) => {
      console.log(`${i + 1}. ${launch.symbol} (${launch.name})`);
      console.log(`   Market Cap: $${launch.marketCap?.toLocaleString() ?? 'unknown'}`);
      console.log(`   Holders: ${launch.holders ?? 'unknown'}`);
      console.log(`   Creator: ${launch.creator?.slice(0, 8) ?? 'unknown'}...`);
      console.log('');
    });
  } else {
    console.log(`❌ Scout check failed: ${launches.error}`);
  }
}

async function runFullTest(): Promise<void> {
  console.log('═'.repeat(50));
  console.log('🧪 FULL AGENT TEST CYCLE');
  console.log('═'.repeat(50));

  await checkStatus();

  console.log('\n' + '─'.repeat(50));

  await triggerClaim();

  console.log('\n' + '─'.repeat(50));

  await checkScout();

  console.log('\n' + '═'.repeat(50));
  console.log('✅ Test cycle complete');
  console.log('═'.repeat(50));
}

// Main
const command = process.argv[2] || 'status';

console.log(`\n🔧 Agent Testing Utility`);
console.log(`   URL: ${BASE_URL}`);
console.log(`   Command: ${command}\n`);

switch (command) {
  case 'status':
    checkStatus();
    break;
  case 'claim':
    triggerClaim();
    break;
  case 'buyback':
    triggerBuyback();
    break;
  case 'scout':
    checkScout();
    break;
  case 'full':
    runFullTest();
    break;
  default:
    console.log('Unknown command. Use: status, claim, buyback, scout, or full');
}
