import React, { useState, useEffect } from 'react';
import { X, ArrowUpCircle, ArrowDownCircle, Target, Shield, Clock, DollarSign, Activity } from 'lucide-react';

interface ManualTradeModalProps {
  currentPrice: number;
  onClose: () => void;
  onSubmit: (
      type: 'BUY' | 'SELL', 
      entry: number, 
      sl: number, 
      tp: number,
      orderType: 'MARKET' | 'LIMIT' | 'STOP',
      amount: number,
      stopPrice: number
  ) => void;
}

const ManualTradeModal: React.FC<ManualTradeModalProps> = ({ currentPrice, onClose, onSubmit }) => {
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'STOP'>('MARKET');
  
  const [entry, setEntry] = useState(currentPrice);
  const [stopPrice, setStopPrice] = useState(currentPrice); // For Stop Limit
  const [amount, setAmount] = useState(100); // Default 100 USDT
  
  const [sl, setSl] = useState(0);
  const [tp, setTp] = useState(0);

  // Set default intelligent SL/TP based on type when it changes
  useEffect(() => {
    const basePrice = orderType === 'MARKET' ? currentPrice : entry;
    
    if (type === 'BUY') {
        setSl(Number((basePrice * 0.99).toFixed(2))); // 1% SL
        setTp(Number((basePrice * 1.02).toFixed(2))); // 2% TP
    } else {
        setSl(Number((basePrice * 1.01).toFixed(2)));
        setTp(Number((basePrice * 0.98).toFixed(2)));
    }
    
    // Auto-update entry for Market
    if (orderType === 'MARKET') {
        setEntry(currentPrice);
    }
  }, [type, currentPrice, orderType, entry]); // Added entry to dependencies for basePrice calculation

  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  const rr = risk > 0 ? (reward / risk).toFixed(2) : '0.00';

  const handleSubmit = () => {
    onSubmit(type, entry, sl, tp, orderType, amount, stopPrice);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
        
        <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-800/50">
            <h3 className="font-bold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-400" /> Manual Trade
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
            </button>
        </div>

        <div className="p-6 space-y-5">
            {/* Type Selection */}
            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={() => setType('BUY')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all border ${type === 'BUY' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-600'}`}
                >
                    <ArrowUpCircle className="w-4 h-4" /> LONG
                </button>
                <button 
                    onClick={() => setType('SELL')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all border ${type === 'SELL' ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-600'}`}
                >
                    <ArrowDownCircle className="w-4 h-4" /> SHORT
                </button>
            </div>

            {/* Order Type Selector */}
            <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
                {(['MARKET', 'LIMIT', 'STOP'] as const).map(ot => (
                    <button
                        key={ot}
                        onClick={() => setOrderType(ot)}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-colors ${orderType === ot ? 'bg-slate-800 text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        {ot === 'STOP' ? 'STOP LIMIT' : ot}
                    </button>
                ))}
            </div>

            {/* Inputs */}
            <div className="space-y-3">
                {/* Amount Input */}
                <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" /> Amount (USDT)
                    </label>
                    <input 
                        type="number" 
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono focus:border-blue-500 outline-none"
                    />
                </div>

                {/* Stop Price (Only for STOP) */}
                {orderType === 'STOP' && (
                    <div>
                        <label className="text-[10px] uppercase font-bold text-amber-500 mb-1 flex items-center gap-1">
                            <Activity className="w-3 h-3" /> Stop Trigger Price
                        </label>
                        <input 
                            type="number" 
                            value={stopPrice}
                            onChange={(e) => setStopPrice(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-amber-400 font-mono focus:border-amber-500 outline-none"
                        />
                    </div>
                )}

                {/* Entry Price (Disabled for MARKET) */}
                <div className={orderType === 'MARKET' ? 'opacity-50 pointer-events-none' : ''}>
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">
                        {orderType === 'MARKET' ? 'Market Price' : 'Limit Price'}
                    </label>
                    <input 
                        type="number" 
                        value={entry}
                        onChange={(e) => setEntry(Number(e.target.value))}
                        disabled={orderType === 'MARKET'}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono focus:border-blue-500 outline-none disabled:text-slate-500"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] uppercase font-bold text-rose-400 mb-1 block">Stop Loss</label>
                        <input 
                            type="number" 
                            value={sl}
                            onChange={(e) => setSl(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-rose-400 font-mono focus:border-rose-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-bold text-emerald-400 mb-1 block">Take Profit</label>
                        <input 
                            type="number" 
                            value={tp}
                            onChange={(e) => setTp(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-emerald-400 font-mono focus:border-emerald-500 outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between text-xs bg-slate-800/50 p-3 rounded-lg">
                <span className="text-slate-400">Projected R:R Ratio</span>
                <span className={`font-bold font-mono ${Number(rr) >= 2 ? 'text-emerald-400' : 'text-yellow-400'}`}>1 : {rr}</span>
            </div>

            <button 
                onClick={handleSubmit}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]"
            >
                {orderType === 'MARKET' ? 'EXECUTE MARKET ORDER' : `PLACE ${orderType} ORDER`}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ManualTradeModal;