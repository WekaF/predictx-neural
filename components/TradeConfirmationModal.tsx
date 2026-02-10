import React from 'react';
import { TradeSignal } from '../types';
import { AlertTriangle, CheckCircle, XCircle, ArrowRight } from 'lucide-react';

interface TradeConfirmationModalProps {
  signal: TradeSignal;
  onConfirm: () => void;
  onReject: () => void;
  riskAmount: number;
}

const TradeConfirmationModal: React.FC<TradeConfirmationModalProps> = ({ signal, onConfirm, onReject, riskAmount }) => {
  const potentialProfit = (signal.riskRewardRatio || 2) * riskAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className={`p-6 border-b border-slate-800 ${signal.type === 'BUY' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className={`w-6 h-6 ${signal.type === 'BUY' ? 'text-emerald-500' : 'text-rose-500'}`} />
            <h2 className="text-xl font-bold text-white uppercase">Confirm {signal.type} Order</h2>
          </div>
          <p className="text-slate-400 text-sm">
            AI has detected a high-probability setup. Please review parameters before execution.
          </p>
        </div>

        {/* Trade Details */}
        <div className="p-6 space-y-4">
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Asset</span>
            <span className="font-bold text-white">{signal.symbol}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 bg-slate-950 p-4 rounded-lg border border-slate-800">
            <div className="text-center">
                <span className="text-[10px] text-slate-500 uppercase block mb-1">Entry</span>
                <span className="text-white font-mono font-bold">{signal.entryPrice}</span>
            </div>
            <div className="text-center border-l border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block mb-1">Stop Loss</span>
                <span className="text-rose-400 font-mono font-bold">{signal.stopLoss}</span>
            </div>
            <div className="text-center border-l border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block mb-1">Take Profit</span>
                <span className="text-emerald-400 font-mono font-bold">{signal.takeProfit}</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
            <div className="flex flex-col">
                <span className="text-xs text-slate-500">Risking</span>
                <span className="text-rose-400 font-bold">-${riskAmount.toFixed(2)}</span>
            </div>
            <ArrowRight className="text-slate-600 w-4 h-4" />
            <div className="flex flex-col items-end">
                <span className="text-xs text-slate-500">Targeting</span>
                <span className="text-emerald-400 font-bold">+${potentialProfit.toFixed(2)}</span>
            </div>
          </div>

          <div className="text-xs text-slate-500 italic text-center">
            "{signal.reasoning}"
          </div>

          {/* Tier 7: Execution Plan Display */}
          {signal.execution && (
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 bg-amber-500 rounded-full"></div>
                <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider">Tier 7 Execution Plan</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50">
                  <span className="text-[10px] text-slate-500 uppercase block mb-1">Leverage</span>
                  <span className="text-amber-400 font-bold">{signal.execution.leverage}x</span>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50">
                  <span className="text-[10px] text-slate-500 uppercase block mb-1">Margin (IDR)</span>
                  <span className="text-white font-bold">Rp {signal.execution.margin_idr.toLocaleString()}</span>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50 col-span-2">
                  <span className="text-[10px] text-slate-500 uppercase block mb-1">Total Size (IDR)</span>
                  <span className="text-blue-400 font-bold">Rp {signal.execution.size_idr.toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-3 text-[10px] text-slate-500 flex justify-between px-1">
                <span>TP: {signal.execution.tp}</span>
                <span>SL: {signal.execution.sl}</span>
              </div>
            </div>
          )}

        </div>

        {/* Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex gap-3">
            <button 
                onClick={onReject}
                className="flex-1 py-3 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors font-bold flex items-center justify-center gap-2"
            >
                <XCircle className="w-5 h-5" /> Reject
            </button>
            <button 
                onClick={onConfirm}
                className={`flex-1 py-3 rounded-lg font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] active:scale-[0.98] ${signal.type === 'BUY' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'}`}
            >
                <CheckCircle className="w-5 h-5" /> Execute Trade
            </button>
        </div>
      </div>
    </div>
  );
};

export default TradeConfirmationModal;