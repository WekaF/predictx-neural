import crypto from 'crypto';

// Testnet credentials
const API_KEY = '49aEXed1BhiQsXglDmqQo2Spbz2QiDOZzN4znUiW2UailyddEr3a5RDFhYplgHop';
const API_SECRET = 'dSVz3QOz3YvwpmbRYnp70cWmjqGGnO2TmWEbAn3CWRTGvAOev3sk68eB7bDWkwiN';
const BASE_URL = 'https://testnet.binance.vision';

// Generate signature
function generateSignature(queryString, secret) {
    return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
}

// Test API connection
async function testAPI() {
    console.log('🧪 Testing Binance Testnet API...\n');
    console.log('API Base:', BASE_URL);
    console.log('API Key:', API_KEY.substring(0, 20) + '...\n');

    try {
        // 1. Test server time (no auth required)
        console.log('1️⃣ Testing server connection...');
        const timeResponse = await fetch(`${BASE_URL}/api/v3/time`);
        const timeData = await timeResponse.json();
        console.log('✅ Server time:', new Date(timeData.serverTime).toISOString());
        console.log('');

        // 2. Test account info (auth required)
        console.log('2️⃣ Testing authenticated endpoint (account info)...');
        
        // Sync with server time first
        const serverTimeResponse = await fetch(`${BASE_URL}/api/v3/time`);
        const serverTimeData = await serverTimeResponse.json();
        const serverTime = serverTimeData.serverTime;
        
        const queryString = `timestamp=${serverTime}`;
        const signature = generateSignature(queryString, API_SECRET);
        
        const accountUrl = `${BASE_URL}/api/v3/account?${queryString}&signature=${signature}`;
        const accountResponse = await fetch(accountUrl, {
            headers: {
                'X-MBX-APIKEY': API_KEY
            }
        });

        if (!accountResponse.ok) {
            const errorText = await accountResponse.text();
            console.error('❌ Account API Error:', accountResponse.status);
            console.error('Response:', errorText);
            return;
        }

        const accountData = await accountResponse.json();
        console.log('✅ Account authenticated successfully!');
        console.log('Account Type:', accountData.accountType);
        console.log('Can Trade:', accountData.canTrade);
        console.log('Can Withdraw:', accountData.canWithdraw);
        console.log('');

        // 3. Show balances
        console.log('3️⃣ Account Balances:');
        const balances = accountData.balances.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
        
        if (balances.length === 0) {
            console.log('⚠️  NO BALANCES FOUND!');
            console.log('');
            console.log('📝 You need to claim test funds from Binance Testnet:');
            console.log('   1. Go to: https://testnet.binance.vision/');
            console.log('   2. Login with your testnet account');
            console.log('   3. Click "Get Test Funds" or "Faucet"');
            console.log('   4. Claim free BTC, USDT, BNB, etc.');
        } else {
            balances.forEach(balance => {
                const free = parseFloat(balance.free);
                const locked = parseFloat(balance.locked);
                const total = free + locked;
                console.log(`   ${balance.asset}: ${total.toFixed(8)} (Free: ${free.toFixed(8)}, Locked: ${locked.toFixed(8)})`);
            });
        }

    } catch (error) {
        console.error('❌ Error testing API:', error.message);
        console.error(error);
    }
}

testAPI();
