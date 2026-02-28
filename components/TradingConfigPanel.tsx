import React from 'react';
import { Settings, BookOpen, Zap } from 'lucide-react';
import { storageService } from '../services/storageService';

interface TradingConfigPanelProps {
  tradingMode: 'paper' | 'live';
  setTradingMode: (mode: 'paper' | 'live') => void;
  leverage: number;
  setLeverage: (val: number) => void;
  balance: number;
  marginPercent: number;
  handleManualSync: () => void;
  showNotification: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const TradingConfigPanel: React.FC<TradingConfigPanelProps> = React.memo(({
  tradingMode,
  setTradingMode,
  leverage,
  setLeverage,
  balance,
  marginPercent,
  handleManualSync,
  showNotification
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col shrink-0">
      <h3 className="text-xs font-bold text-slate-400 mb-4 flex items-center gap-2">
        <Settings className="w-4 h-4 text-slate-400" />
        TRADING CONFIG
      </h3>

      <div className="space-y-5">
        {/* Trading Mode Toggle */}
        <div className="space-y-2">
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => {
                setTradingMode('paper');
                storageService.saveTradingMode('paper');
                const settings = storageService.getSettings();
                storageService.saveSettings({ ...settings, useTestnet: true });
              }}
              className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 ${tradingMode === 'paper'
                ? 'bg-slate-800 text-blue-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
                }`}
            >
              <BookOpen className="w-3 h-3" /> PAPER
            </button>
            <button
              onClick={() => {
                if (balance < 1) {
                  showNotification('⚠️ Insufficient balance.', 'warning');
                  return;
                }
                if (window.confirm('Enable LIVE TRADING mode? Real funds will be used.')) {
                  setTradingMode('live');
                  storageService.saveTradingMode('live');
                  const settings = storageService.getSettings();
                  storageService.saveSettings({ ...settings, useTestnet: false });
                }
              }}
              className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 ${tradingMode === 'live'
                ? 'bg-rose-900/30 text-rose-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
                }`}
            >
              <Zap className="w-3 h-3" /> LIVE
            </button>
          </div>
          {tradingMode === 'live' && (
            <div className="text-[10px] text-center text-rose-400 bg-rose-500/5 py-1 rounded border border-rose-500/10">
               Real funds active
            </div>
          )}
        </div>

        {/* Leverage Configuration */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Leverage</label>
            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{leverage}x</span>
          </div>
          
          <div className="relative h-6 flex items-center">
            <div className="absolute w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
               <div className="h-full bg-amber-500/50" style={{ width: `${(leverage / 150) * 100}%` }}></div>
            </div>
            <input
              type="range" min="1" max="150" value={leverage}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setLeverage(val);
                storageService.saveLeverage(val);
              }}
              className="w-full h-6 opacity-0 cursor-pointer absolute z-10"
            />
            <div className="w-3 h-3 bg-amber-500 rounded-full shadow-lg absolute pointer-events-none transition-all" 
                 style={{ left: `calc(${((leverage - 1) / 149) * 100}% - 6px)` }}></div>
          </div>

          <div className="flex justify-between gap-1">
            {[10, 50, 100, 150].map(preset => (
              <button
                key={preset}
                onClick={() => {
                  setLeverage(preset);
                  storageService.saveLeverage(preset);
                }}
                className={`flex-1 py-1 rounded text-[9px] font-bold transition-all border ${leverage === preset
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700'
                  }`}
              >
                {preset}x
              </button>
            ))}
          </div>
        </div>

        {/* Info Display */}
        <div className="pt-3 border-t border-slate-800">
          <div className="grid grid-cols-2 gap-y-2 gap-x-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500">Balance</span>
              <span className="text-xs font-mono font-medium text-emerald-400">USDT {balance.toLocaleString('id-ID', { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500">Margin (Collateral)</span>
              <span className="text-xs font-mono font-medium text-emerald-400">USDT {(balance * (marginPercent / 100)).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500">Position Size</span>
              <div className="text-right">
                 <div className={`text-xs font-mono font-medium ${(balance * leverage * (marginPercent / 100)) < 100 ? 'text-amber-400' : 'text-slate-300'}`}>
                    USDT {(balance * leverage * (marginPercent / 100)).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                 </div>
                 {(balance * leverage * (marginPercent / 100)) < 100 && (
                    <div className="text-[8px] text-amber-500 font-bold uppercase tracking-tighter">Below Min (100)</div>
                 )}
              </div>
            </div>
            
            {/* Auto SL/TP Toggle */}
            <div className="flex justify-between items-center mt-1">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Auto SL & TP</span>
                <span className="text-[8px] text-slate-600">RR 1:3 (0.5% : 1.5%)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const currentSettings = storageService.getSettings();
                  const newValue = !(currentSettings.autoSLTP ?? true);
                  storageService.saveSettings({ ...currentSettings, autoSLTP: newValue });
                  // Force a re-render by updating some parent state if needed, or rely on the component using this config
                  showNotification(`Auto SL/TP ${newValue ? 'Enabled' : 'Disabled'}`, 'info');
                }}
                className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none ${
                    (storageService.getSettings().autoSLTP ?? true) ? 'bg-emerald-500/80' : 'bg-slate-700'
                }`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    (storageService.getSettings().autoSLTP ?? true) ? 'translate-x-4' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* MANUAL SYNC BUTTON */}
            <button 
                onClick={handleManualSync}
                className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"
                title="Force Sync with Binance"
            >
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
