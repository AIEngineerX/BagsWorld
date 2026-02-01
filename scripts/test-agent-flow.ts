/**
 * Test the full agent economy flow:
 * 1. Launch a token for an external agent
 * 2. Check claimable fees
 * 3. Generate claim transactions
 * 
 * Run with: npx tsx scripts/test-agent-flow.ts
 */

// MUST load env BEFORE any other imports
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const envPath = resolve(projectRoot, '.env.local');

if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const eqIdx = trimmed.indexOf('=');
      const key = trimmed.substring(0, eqIdx);
      let value = trimmed.substring(eqIdx + 1);
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

console.log('[Env] BAGS_API_KEY:', !!process.env.BAGS_API_KEY);
console.log('[Env] AGENT_WALLET_PRIVATE_KEY:', !!process.env.AGENT_WALLET_PRIVATE_KEY);
console.log('[Env] BAGSWORLD_LAUNCHER_PRIVATE_KEY:', !!process.env.BAGSWORLD_LAUNCHER_PRIVATE_KEY);

// Now do the dynamic imports AFTER env is loaded
async function main() {
  console.log('\n=== Agent Economy Flow Test ===\n');

  // Dynamic import to ensure env is loaded first
  const launcher = await import('../src/lib/agent-economy/launcher.js');
  const { 
    launchForExternal, 
    isLauncherConfigured, 
    getLauncherWallet,
    getLauncherBalance,
    getClaimableForWallet,
    generateClaimTxForWallet
  } = launcher;

  // Step 0: Check configuration
  console.log('📋 Checking launcher configuration...');
  const config = isLauncherConfigured();
  
  if (!config.configured) {
    console.error('❌ Launcher not configured. Missing:', config.missing.join(', '));
    process.exit(1);
  }
  console.log('✅ Launcher configured');

  const launcherWallet = getLauncherWallet();
  console.log(`📍 Launcher wallet: ${launcherWallet}`);

  const balance = await getLauncherBalance();
  console.log(`💰 Launcher balance: ${balance.toFixed(4)} SOL`);

  if (balance < 0.05) {
    console.error('❌ Insufficient balance for launch (need ~0.03 SOL)');
    process.exit(1);
  }

  // Test wallet (Ghost's wallet for testing)
  const testCreatorWallet = process.env.TEST_CREATOR_WALLET || launcherWallet!;
  console.log(`🎯 Test creator wallet: ${testCreatorWallet}`);

  // Step 1: Test Launch
  console.log('\n--- Step 1: Launch Token ---\n');
  
  const timestamp = Date.now().toString().slice(-6);
  const testLaunch = {
    creatorWallet: testCreatorWallet,
    name: `Test Agent ${timestamp}`,
    symbol: `TAGT${timestamp.slice(-3)}`,
    description: 'Test token for agent economy flow validation',
    imageUrl: '', // Will use placeholder
  };

  console.log('🚀 Launching token:', testLaunch.name, `($${testLaunch.symbol})`);
  
  let launchSuccess = false;
  try {
    const launchResult = await launchForExternal(testLaunch);
    
    if (launchResult.success) {
      console.log('\n✅ TOKEN LAUNCHED!');
      console.log(`   Mint: ${launchResult.tokenMint}`);
      console.log(`   Bags.fm: ${launchResult.bagsUrl}`);
      console.log(`   Solscan: ${launchResult.explorerUrl}`);
      launchSuccess = true;
    } else {
      console.error('❌ Launch failed:', launchResult.error);
    }
  } catch (err) {
    console.error('❌ Launch error:', err);
  }

  // Step 2: Test Claim (check what's claimable for the wallet)
  console.log('\n--- Step 2: Check Claimable Fees ---\n');
  
  try {
    const claimable = await getClaimableForWallet(testCreatorWallet);
    console.log(`📊 Claimable positions: ${claimable.positions.length}`);
    console.log(`💰 Total claimable: ${(claimable.totalClaimableLamports / 1e9).toFixed(6)} SOL`);
    
    if (claimable.positions.length > 0) {
      console.log('\nPositions:');
      for (const pos of claimable.positions.slice(0, 5)) {
        const virtual = parseInt(pos.virtualPoolClaimableAmount || pos.totalClaimableLamportsUserShare || '0', 10);
        const damm = parseInt(pos.dammPoolClaimableAmount || '0', 10);
        const total = (virtual + damm) / 1e9;
        console.log(`   ${pos.baseMint.slice(0, 8)}... = ${total.toFixed(6)} SOL`);
      }
      if (claimable.positions.length > 5) {
        console.log(`   ... and ${claimable.positions.length - 5} more`);
      }
    }
  } catch (err) {
    console.error('❌ Claimable check error:', err);
  }

  // Step 3: Generate claim transactions (if any)
  console.log('\n--- Step 3: Generate Claim Transactions ---\n');
  
  try {
    const claimResult = await generateClaimTxForWallet(testCreatorWallet);
    
    if (claimResult.success) {
      console.log(`✅ Generated ${claimResult.transactions?.length || 0} claim transaction(s)`);
      console.log(`💰 Total to claim: ${((claimResult.totalClaimableLamports || 0) / 1e9).toFixed(6)} SOL`);
      
      if (claimResult.transactions && claimResult.transactions.length > 0) {
        console.log('\n📝 Transaction(s) ready for signing:');
        claimResult.transactions.forEach((tx, i) => {
          console.log(`   Tx ${i + 1}: ${tx.slice(0, 40)}...`);
        });
        console.log('\n⚠️  These transactions need to be signed by the wallet owner');
      }
    } else {
      console.error('❌ Claim generation failed:', claimResult.error);
    }
  } catch (err) {
    console.error('❌ Claim error:', err);
  }

  console.log('\n=== Test Complete ===\n');
  console.log(launchSuccess ? '✅ Launch succeeded' : '❌ Launch failed');
}

main().catch(console.error);
