/**
 * Debug script to test Binance API balance fetching
 * Run with: node debug_balance.js
 */

import crypto from 'crypto';

// Read from .env.local
const USE_TESTNET = true; // Set to false for production

const API_KEY = USE_TESTNET 
  ? '49aEXed1BhiQsXglDmqQo2Spbz2QiDOZzN4znUiW2UailyddEr3a5RDFhYplgHop'
  : 'YOUR_PRODUCTION_KEY';

const API_SECRET = USE_TESTNET
  ? 'dSVz3QOz3YvwpmbRYnp70cWmjqGGnO2TmWEbAn3CWRTGvAOev3sk68eB7bDWkwiN'
  : 'YOUR_PRODUCTION_SECRET';

const BASE_URL = USE_TESTNET
  ? 'https://testnet.binance.vision'
  : 'https://api.binance.com';

console.log('\n🔍 BINANCE BALANCE DEBUG TOOL\n');
console.log('Mode:', USE_TESTNET ? '🧪 TESTNET' : '💎 PRODUCTION');
console.log('API Base:', BASE_URL);
console.log('API Key:', API_KEY.substring(0, 20) + '...\n');

// Generate signature
function generateSignature(queryString, secret) {
    return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
}

async function getBalance() {
    try {
        // 1. Sync server time
        console.log('1️⃣ Syncing server time...');
        const timeResponse = await fetch(`${BASE_URL}/api/v3/time`);
        const timeData = await timeResponse.json();
        const serverTime = timeData.serverTime;
        console.log('✅ Server time:', new Date(serverTime).toISOString());
        
        // 2. Get account balance
        console.log('\n2️⃣ Fetching account balance...');
        const queryString = `timestamp=${serverTime}`;
        const signature = generateSignature(queryString, API_SECRET);
        
        const url = `${BASE_URL}/api/v3/account?${queryString}&signature=${signature}`;
        const response = await fetch(url, {
            headers: { 'X-MBX-APIKEY': API_KEY }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error:', response.status);
            console.error('Response:', errorText);
            return;
        }

        const accountData = await response.json();
        console.log('✅ Account retrieved successfully!');
        
        // 3. Filter and display balances
        console.log('\n3️⃣ Account Balances (non-zero only):\n');
        const balances = accountData.balances.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
        
        console.log(`Total assets with balance: ${balances.length}\n`);
        
        // Show top 20 balances
        const sorted = balances
            .map(b => ({
                asset: b.asset,
                free: parseFloat(b.free),
                locked: parseFloat(b.locked),
                total: parseFloat(b.free) + parseFloat(b.locked)
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 20);

        console.log('Top 20 Balances:');
        console.log('─────────────────────────────────────');
        sorted.forEach((b, i) => {
            console.log(`${(i + 1).toString().padStart(2)}. ${b.asset.padEnd(10)} │ ${b.total.toFixed(8).padStart(15)} (Free: ${b.free.toFixed(8)})`);
        });
        console.log('─────────────────────────────────────');

        // 4. Check specific assets
        console.log('\n4️⃣ Specific Asset Balances:');
        const checkAssets = ['BTC', 'ETH', 'BNB', 'USDT', 'SOL', 'ADA'];
        checkAssets.forEach(asset => {
            const balance = accountData.balances.find(b => b.asset === asset);
            if (balance) {
                const total = parseFloat(balance.free) + parseFloat(balance.locked);
                console.log(`   ${asset.padEnd(6)}: ${total.toFixed(8)} (Free: ${parseFloat(balance.free).toFixed(8)})`);
            } else {
                console.log(`   ${asset.padEnd(6)}: 0.00000000`);
            }
        });

        console.log('\n✅ Done!\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error);
    }
}

getBalance();
