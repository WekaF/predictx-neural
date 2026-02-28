import React from 'react';
import { PenTool, Activity, Shield, Wallet, Zap, Bot, Database } from 'lucide-react';

interface HeaderControlsProps {
    autoMode: boolean;
    tradingMode: 'paper' | 'live';
    onToggleAuto: () => void;
    balance: number;
    marginPercent: number;
    setMarginPercent: (val: number) => void;
    isAsyncAnalyzing?: boolean;
    isSimpleBotActive: boolean;
    onToggleSimpleBot: () => void;
    useTestnet: boolean;
    onToggleTestnet: () => void;
}

const Toggle: React.FC<{
    label: string;
    active: boolean;
    onToggle: () => void;
    activeColor: string;
    icon: React.ReactNode;
}> = ({ label, active, onToggle, activeColor, icon }) => (
    <button
        onClick={onToggle}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all active:scale-95 ${
            active
                ? `${activeColor} shadow-sm`
                : 'bg-slate-800/60 border-slate-700 text-slate-500 hover:bg-slate-800 hover:text-slate-400'
        }`}
    >
        {icon}
        <span className="hidden xl:inline">{label}</span>
        <div className={`w-2 h-2 rounded-full ${active ? 'bg-current animate-pulse' : 'bg-slate-600'}`} />
    </button>
);

export const HeaderControls: React.FC<HeaderControlsProps> = React.memo(({
    autoMode,
    tradingMode,
    onToggleAuto,
    balance,
    marginPercent,
    setMarginPercent,
    onAnalyze,
    isAsyncAnalyzing = false,
    isSimpleBotActive,
    onToggleSimpleBot,
    useTestnet,
    onToggleTestnet
}) => {
    return (
        <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Analyze Button */}
            <button 
                onClick={onAnalyze}
                disabled={isAsyncAnalyzing}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all active:scale-95 whitespace-nowrap ${
                    isAsyncAnalyzing
                        ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-wait'
                        : 'bg-blue-600/10 border-blue-500/30 text-blue-400 hover:bg-blue-600/20 hover:border-blue-500/50'
                }`}
            >
                {isAsyncAnalyzing ? (
                    <div className="w-3.5 h-3.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                ) : (
                    <Activity className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">{isAsyncAnalyzing ? 'Scanning...' : 'Analyze'}</span>
            </button>

            {/* Divider */}
            <div className="h-6 w-px bg-slate-700/50 hidden sm:block" />

            {/* Toggle Buttons */}
            <Toggle
                label="Auto"
                active={autoMode}
                onToggle={onToggleAuto}
                activeColor="bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                icon={<Zap className="w-3.5 h-3.5" />}
            />
            <Toggle
                label="Bot"
                active={isSimpleBotActive}
                onToggle={onToggleSimpleBot}
                activeColor="bg-purple-500/10 border-purple-500/40 text-purple-400"
                icon={<Bot className="w-3.5 h-3.5" />}
            />
            <Toggle
                label="Testnet"
                active={useTestnet}
                onToggle={onToggleTestnet}
                activeColor="bg-amber-500/10 border-amber-500/40 text-amber-400"
                icon={<Database className="w-3.5 h-3.5" />}
            />

            {/* Divider */}
            <div className="h-6 w-px bg-slate-700/50 hidden sm:block" />

            {/* Balance */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/40 rounded-lg border border-slate-700/50">
                <div className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                    tradingMode === 'live' 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-amber-500 text-black'
                }`}>
                    {tradingMode === 'live' ? 'LIVE' : 'TEST'}
                </div>
                <Wallet className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-mono text-emerald-400 font-bold text-xs">
                    {balance.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[10px] text-slate-500 font-bold">USDT</span>
            </div>

            {/* Margin % */}
            <div className="hidden md:flex items-center gap-1 px-2 py-1 bg-slate-800/40 rounded-lg border border-slate-700/50" title="Margin Allocation % from Wallet">
                <Shield className="w-3.5 h-3.5 text-slate-500" />
                <input 
                    type="number" 
                    value={marginPercent} 
                    onChange={(e) => setMarginPercent(Number(e.target.value))}
                    className="w-8 bg-transparent text-white font-mono font-bold focus:outline-none text-xs text-center" 
                    min={0.1}
                    max={100}
                    step={0.5}
                />
                <span className="text-[10px] text-slate-500 font-bold">%</span>
            </div>
        </div>
    );
});
