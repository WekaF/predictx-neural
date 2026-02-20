import binanceTradingService from './binanceTradingService';

// Extract getApiBase logic directly or use binanceTradingService if exposed.
// Since getApiBase isn't exported from binanceTradingService, we fetch candles via binanceService instead, OR just replicate the logic briefly for the bot.
import * as binanceService from './binanceService';

import { Candle } from '../types';

/**
 * Rule: Order Block Detection
 * Mencari zona OB berdasarkan data candlestick terbaru
 */
export function detectOrderBlock(klines: Candle[]) {
    if (klines.length < 5) return null;

    const latest = klines[klines.length - 1];
    const prev = klines[klines.length - 2];
    const prev2 = klines[klines.length - 3];

    // parse as floats
    const latestClose = latest.close;
    const prev2High = prev2.high;
    const prev2Low = prev2.low;
    
    const prevOpen = prev.open;
    const prevHigh = prev.high;
    const prevLow = prev.low;
    const prevClose = prev.close;

    // Bullish OB: Close terbaru menembus High 2 candle sebelumnya (Break of Structure)
    // Dan candle sebelumnya adalah candle merah (Bearish)
    if (latestClose > prev2High && prevClose < prevOpen) {
        return {
            type: 'BULLISH',
            entry: prevHigh, // High candle merah sebagai entry limit
            sl: prevLow,     // Low candle merah sebagai SL
            color: 'green'
        };
    }

    // Bearish OB: Close terbaru menembus Low 2 candle sebelumnya
    // Dan candle sebelumnya adalah candle hijau (Bullish)
    if (latestClose < prev2Low && prevClose > prevOpen) {
        return {
            type: 'BEARISH',
            entry: prevLow,  // Low candle hijau sebagai entry limit
            sl: prevHigh,    // High candle hijau sebagai SL
            color: 'red'
        };
    }

    return null;
}

// Custom event for UI integration
const logToUI = (msg: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    console.log(msg);
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('simpleBotLog', { detail: { msg, type } }));
    }
};

/**
 * The Loop: Implementasi Alur Kerja Bot
 */
export async function tradingBotLogic(symbol = 'BTCUSDT', leverage = 10, quantity = 0.01) {
    logToUI(`[Simple Bot] 🤖 Menjalankan scan market untuk ${symbol}...`, 'info');
    try {
        // 1. Ambil data Candle (15m) menggunakan binanceService 
        const klines = await binanceService.getHistoricalKlines(symbol.replace('/', ''), '15m', 20);
        
        if (!klines || klines.length === 0) {
            logToUI('[Simple Bot] ❌ Gagal mengambil data klines', 'error');
            return;
        }

        // 2. Cek apakah ada posisi aktif
        const positions = await binanceTradingService.getPositions(symbol);
        
        if (positions.length === 0) {
            // --- LOGIKA ENTRY ---
            const ob = detectOrderBlock(klines);
            
            if (ob) {
                logToUI(`[Simple Bot] ✨ OB Terdeteksi: ${ob.type}`, 'success');
                
                // Hitung TP menggunakan Fibonacci sederhana (1.618 dari range OB)
                const range = Math.abs(ob.entry - ob.sl);
                const tpPrice = ob.type === 'BULLISH' ? ob.entry + (range * 1.618) : ob.entry - (range * 1.618);

                // Pembulatan harga sesuai filter Binance
                const roundedEntry = await binanceTradingService.roundPrice(symbol, ob.entry);
                const roundedSL = await binanceTradingService.roundPrice(symbol, ob.sl);
                const roundedTP = await binanceTradingService.roundPrice(symbol, tpPrice);

                logToUI(`[Simple Bot] 🚀 Menempatkan Entry ${ob.type} LIMIT @ ${roundedEntry} (SL: ${roundedSL}, TP: ${roundedTP})`, 'success');

                // Rule: Auto Entry + SL + TP sekaligus
                await binanceTradingService.placeOrderWithSLTP({
                    symbol,
                    side: ob.type === 'BULLISH' ? 'BUY' : 'SELL',
                    type: 'LIMIT',
                    quantity: quantity, 
                    price: roundedEntry,
                    slPrice: roundedSL,
                    tpPrice: roundedTP,
                    leverage: leverage
                });
            } else {
                // Keep this one quiet in UI so it doesn't spam every 30s, but console log it
                console.log('[Simple Bot] ⏳ Tidak ada OB yang valid. Menunggu...');
            }
        } else {
            // --- LOGIKA MAINTENANCE ---
            // Rule: Auto Move SL (+2% ke BE, +4% ke Lock Profit)
            console.log('[Simple Bot] 🛡️ Posisi aktif ditemukan. Menjalankan Trailing Stop...');
            await binanceTradingService.manageTrailingStop(symbol, leverage);
        }
    } catch (e: any) {
        logToUI(`[Simple Bot] ❌ Error: ${e.message || e}`, 'error');
        console.error('[Simple Bot] Trace:', e);
    }
}

// Control variables
let botInterval: any = null;

export function startSimpleBot(symbol = 'BTCUSDT', intervalMs = 30000) {
    if (botInterval) {
        console.log('[Simple Bot] Bot sudah berjalan!');
        return;
    }
    console.log(`[Simple Bot] 🟢 Memulai bot untuk ${symbol} setiap ${intervalMs / 1000} detik`);
    // Run once immediately
    tradingBotLogic(symbol);
    // Then set interval
    botInterval = setInterval(() => tradingBotLogic(symbol), intervalMs);
}

export function stopSimpleBot() {
    if (botInterval) {
        clearInterval(botInterval);
        botInterval = null;
        console.log('[Simple Bot] 🔴 Bot dihentikan.');
    }
}

export default {
    detectOrderBlock,
    tradingBotLogic,
    startSimpleBot,
    stopSimpleBot
};
