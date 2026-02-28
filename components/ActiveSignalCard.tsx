import React from 'react';
import { 
  PauseCircle, PlayCircle, Target, TrendingUp, Activity, 
  Layers, Zap, ShieldCheck, DollarSign, CheckCircle2, 
  XCircle, BrainCircuit, RefreshCw, Radio 
} from 'lucide-react';
import { TradeSignal, Asset } from '../types';
import binanceTradingService from '../services/binanceTradingService';
import { storageService } from '../services/storageService';

interface ActiveSignalCardProps {
  activeSignal: TradeSignal | null;
  selectedAsset: Asset;
  currentPrice: number;
  handleAnalyze: () => void;
  handleFeedback: (outcome: 'WIN' | 'LOSS') => void;
  isAnalyzing: boolean;
  showNotification: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  setActiveSignal: React.Dispatch<React.SetStateAction<TradeSignal | null>>;
}

export const ActiveSignalCard: React.FC<ActiveSignalCardProps> = React.memo(({
  activeSignal,
  selectedAsset,
  currentPrice,
  handleAnalyze,
  handleFeedback,
  isAnalyzing,
  showNotification,
  setActiveSignal
}) => {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden group shrink-0`}>
      <div className={`absolute top-0 right-0 w-32 h-32 bg-blue-500/5 group-hover:bg-blue-500/10 rounded-full blur-3xl transition-all`}></div>

      <h2 className={`text-slate-400 text-xs font-bold tracking-wider mb-4 flex items-center gap-2 relative z-10`}>
        <Target className="w-4 h-4 text-blue-400" /> ACTIVE TRADE
      </h2>

      {activeSignal && activeSignal.outcome === 'PENDING' && (activeSignal.symbol === selectedAsset.symbol || activeSignal.symbol.replace('/', '') === selectedAsset.symbol.replace('/', '')) && (
        <div className="space-y-4 relative z-10">
          <div className="flex justify-between items-end">
            <span className={`text-3xl font-black tracking-tight ${activeSignal.type === 'BUY' ? 'text-emerald-400' : activeSignal.type === 'SELL' ? 'text-rose-400' : 'text-yellow-400'}`}>
              {activeSignal.type}
            </span>
            <div className="flex flex-col items-end">
              <span className="text-slate-500 text-[10px] font-bold uppercase">Confidence</span>
              <span className="text-white font-mono text-lg font-bold">
                {isNaN(activeSignal.confidence) || !isFinite(activeSignal.confidence) ? 'N/A' : `${Math.round(activeSignal.confidence)}%`}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {activeSignal.confluenceFactors?.map((factor, i) => (
              <span key={i} className="flex items-center gap-1 text-[10px] bg-slate-800/80 px-2 py-1 rounded-md text-slate-300 border border-slate-700/50">
                {factor.includes('Trend') && <TrendingUp className="w-3 h-3 text-blue-400" />}
                {factor.includes('RSI') && <Activity className="w-3 h-3 text-purple-400" />}
                {factor.includes('Support') && <Layers className="w-3 h-3 text-emerald-400" />}
                {factor.includes('Volume') && <Zap className="w-3 h-3 text-yellow-400" />}
                {factor}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center bg-slate-950/50 rounded-lg p-3 border border-slate-800/50">
            <div>
              <span className="text-[10px] text-slate-500 block mb-0.5">Entry</span>
              <span className="text-xs font-mono text-slate-200">{activeSignal.entryPrice}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block mb-0.5">Stop</span>
              <span className="text-xs font-mono text-rose-400">{activeSignal.stopLoss}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block mb-0.5">Target</span>
              <span className="text-xs font-mono text-emerald-400">{activeSignal.takeProfit}</span>
            </div>
          </div>

          {/* Futures Info: Liquidation & Funding Rate */}
          {(activeSignal.meta?.liquidation_info || activeSignal.meta?.funding_rate) && (
            <div className="space-y-2 bg-slate-950/50 rounded-lg p-3 border border-slate-800/50">
              {/* Liquidation Info */}
              {activeSignal.meta?.liquidation_info && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Liquidation</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono text-slate-200">
                      ${activeSignal.meta.liquidation_info.liquidationPrice != null ? activeSignal.meta.liquidation_info.liquidationPrice.toLocaleString() : '-'}
                    </div>
                    <div className={`text-[9px] font-bold ${
                      activeSignal.meta.liquidation_info.riskLevel === 'SAFE' ? 'text-emerald-400' :
                      activeSignal.meta.liquidation_info.riskLevel === 'MODERATE' ? 'text-yellow-400' :
                      activeSignal.meta.liquidation_info.riskLevel === 'HIGH' ? 'text-orange-400' :
                      'text-rose-400'
                    }`}>
                      {activeSignal.meta.liquidation_info.riskLevel} ({activeSignal.meta.liquidation_info.safetyMargin.toFixed(1)}% margin)
                    </div>
                  </div>
                </div>
              )}

              {/* Leverage */}
              {activeSignal.meta?.recommended_leverage && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/50">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Leverage</span>
                  </div>
                  <div className="text-xs font-mono text-purple-400 font-bold">
                    {activeSignal.meta.recommended_leverage}x
                  </div>
                </div>
              )}

              {/* Funding Rate */}
              {activeSignal.meta?.funding_rate && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/50">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Funding Rate</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono text-slate-200">
                      {(activeSignal.meta.funding_rate.current * 100).toFixed(4)}%
                    </div>
                    <div className={`text-[9px] font-bold ${
                      activeSignal.meta.funding_rate.trend === 'BULLISH' ? 'text-emerald-400' :
                      activeSignal.meta.funding_rate.trend === 'BEARISH' ? 'text-rose-400' :
                      'text-slate-400'
                    }`}>
                      {activeSignal.meta.funding_rate.trend} ({activeSignal.meta.funding_rate.annual})
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Running PnL Display */}
          {currentPrice > 0 && (
            (() => {
                const entryPrice = activeSignal.entryPrice;
                const quantity = activeSignal.quantity || (activeSignal.execution?.margin ? activeSignal.execution.margin / entryPrice * (activeSignal.execution.leverage || 1) : 0);
                
                let pnl = 0;
                
                if (activeSignal.type === 'BUY') {
                    pnl = (currentPrice - entryPrice) * quantity;
                } else {
                    pnl = (entryPrice - currentPrice) * quantity;
                }

                return (
                    <div className={`flex justify-between items-center px-3 py-2 rounded-lg border ${pnl >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Running PnL</span>
                        <div className="text-right">
                            <div className={`text-sm font-mono font-black ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {activeSignal.execution?.unrealizedProfit !== undefined 
                                    ? (activeSignal.execution.unrealizedProfit >= 0 ? '+' : '') + `$${activeSignal.execution.unrealizedProfit.toFixed(2)}`
                                    : (pnl >= 0 ? '+' : '') + (quantity ? `$${pnl.toFixed(2)}` : (activeSignal.type === 'BUY' ? currentPrice - entryPrice : entryPrice - currentPrice).toFixed(2))}
                            </div>
                        </div>
                    </div>
                );
            })()
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            {binanceTradingService.isConfigured() ? (
              <button 
                onClick={async () => {
                    if (!activeSignal) return;
                    try {
                        let tradeSymbol = activeSignal.symbol.replace('/', '');
                        if (tradeSymbol.endsWith('USD') && !tradeSymbol.endsWith('USDT')) {
                            tradeSymbol += 'T';
                        }
                        
                        showNotification("⏳ Closing Position...", "info");

                        try {
                            await binanceTradingService.cancelAllOrders(tradeSymbol);
                        } catch (cancelError: any) {
                            console.warn('[Manual Close] Failed to cancel orders:', cancelError);
                        }
                        
                        let positionAmt = 0;
                        try {
                             const positions = await binanceTradingService.getPositions(tradeSymbol);
                             const pos = positions.find(p => p.symbol === tradeSymbol);
                             if (pos) {
                                 positionAmt = parseFloat(pos.positionAmt);
                             }
                        } catch (e: any) {
                            console.error("[Close] Failed to fetch position:", e);
                            showNotification("Error checking Binance position: " + (e.message || e), "error");
                            return;
                        }

                        if (positionAmt === 0) {
                            const confirmClear = window.confirm(
                                "⚠️ No open position found on Binance for this symbol.\n\nClick OK to clear this signal locally."
                            );
                            if (confirmClear) {
                                setActiveSignal(null);
                                storageService.clearActiveSignal(activeSignal.symbol);
                                showNotification("Local signal cleared.", "success");
                            }
                            return;
                        }

                        const absQty = Math.abs(positionAmt);
                        const closeSide = positionAmt > 0 ? 'SELL' : 'BUY';
                        
                        const roundedQty = await binanceTradingService.roundQuantity(tradeSymbol, absQty);
                        
                        await binanceTradingService.placeOrder({
                            symbol: tradeSymbol,
                            side: closeSide,
                            type: 'MARKET',
                            quantity: roundedQty,
                            reduceOnly: true
                        });
                        
                        showNotification("✅ Position Closed Successfully!", "success");
                        
                        const symbolToClear = activeSignal.symbol;
                        setActiveSignal(null);
                        storageService.saveActiveSignal(null, symbolToClear);
                        storageService.saveActiveSignalToSupabase(null, symbolToClear);
                        
                    } catch (e: any) {
                        showNotification("Close Error: " + e.message, "error");
                        console.error("Close Error", e);
                    }
                }}
                className="col-span-2 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-lg text-xs font-bold border border-slate-600 transition-all flex justify-center items-center gap-2"
              >
                <XCircle className="w-3.5 h-3.5" /> CLOSE POSITION (MARKET)
              </button>
            ) : (
              <>
                <button onClick={() => handleFeedback('WIN')} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 py-2.5 rounded-lg text-xs font-bold border border-emerald-500/20 transition-all flex justify-center items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5" /> WIN
                </button>
                <button onClick={() => handleFeedback('LOSS')} className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 py-2.5 rounded-lg text-xs font-bold border border-rose-500/20 transition-all flex justify-center items-center gap-2">
                  <XCircle className="w-3.5 h-3.5" /> LOSS
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
