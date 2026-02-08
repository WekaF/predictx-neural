/**
 * Binance API Connection Test
 * Run this to verify your Binance API credentials are working
 */

import { 
    testConnection, 
    isConfigured, 
    getAccountInfo,
    getAccountBalances 
} from './binanceTradingService';

async function runTest() {
    console.log('='.repeat(60));
    console.log('🔧 BINANCE API CONNECTION TEST');
    console.log('='.repeat(60));
    console.log('');

    // Check if configured
    console.log('1️⃣ Checking API credentials...');
    if (!isConfigured()) {
        console.error('❌ Binance API credentials not found!');
        console.log('Please set VITE_BINANCE_API_KEY and VITE_BINANCE_SECRET_KEY in .env.local');
        return;
    }
    console.log('✅ API credentials found');
    console.log('');

    // Test connection
    console.log('2️⃣ Testing connection to Binance...');
    const connected = await testConnection();
    if (!connected) {
        console.error('❌ Connection failed!');
        console.log('Please check:');
        console.log('  - API key is correct');
        console.log('  - Secret key is correct');
        console.log('  - API restrictions (IP whitelist, permissions)');
        return;
    }
    console.log('');

    // Get account info
    console.log('3️⃣ Fetching account information...');
    const accountInfo = await getAccountInfo();
    console.log('✅ Account Info:');
    console.log(`   - Can Trade: ${accountInfo.canTrade}`);
    console.log(`   - Can Withdraw: ${accountInfo.canWithdraw}`);
    console.log(`   - Can Deposit: ${accountInfo.canDeposit}`);
    console.log(`   - Account Type: ${accountInfo.accountType}`);
    console.log('');

    // Get balances
    console.log('4️⃣ Fetching account balances...');
    const balances = await getAccountBalances();
    console.log(`✅ Found ${balances.length} assets with balance:`);
    balances.slice(0, 10).forEach(balance => {
        const free = parseFloat(balance.free);
        const locked = parseFloat(balance.locked);
        const total = free + locked;
        if (total > 0) {
            console.log(`   - ${balance.asset}: ${total.toFixed(8)} (Free: ${free.toFixed(8)}, Locked: ${locked.toFixed(8)})`);
        }
    });
    if (balances.length > 10) {
        console.log(`   ... and ${balances.length - 10} more`);
    }
    console.log('');

    console.log('='.repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log('Your Binance API is configured correctly and ready to use.');
    console.log('='.repeat(60));
}

// Run test
runTest().catch(error => {
    console.error('');
    console.error('='.repeat(60));
    console.error('❌ TEST FAILED');
    console.error('='.repeat(60));
    console.error('Error:', error.message);
    console.error('');
    if (error.message.includes('Invalid API-key')) {
        console.error('💡 Tip: Your API key appears to be invalid.');
        console.error('   Please double-check the key in .env.local');
    } else if (error.message.includes('Signature')) {
        console.error('💡 Tip: Signature validation failed.');
        console.error('   Please double-check the secret key in .env.local');
    } else if (error.message.includes('IP')) {
        console.error('💡 Tip: IP restriction issue.');
        console.error('   Check your API key IP whitelist settings on Binance');
    }
    console.error('');
});
