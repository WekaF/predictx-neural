import React from 'react';
import { PenTool, Activity, Shield, Wallet } from 'lucide-react';

interface HeaderControlsProps {
    autoMode: boolean;
    onToggleAuto: () => void;
    balance: number;
    riskPercent: number;
    setRiskPercent: (val: number) => void;
    onManualTrade: () => void;
}

export const HeaderControls: React.FC<HeaderControlsProps> = ({
    autoMode,
    onToggleAuto,
    balance,
    riskPercent,
    setRiskPercent,
    onManualTrade
}) => {
    return (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-slate-900/50 border border-slate-800 p-2 rounded-xl backdrop-blur-sm shadow-sm">
            
            {/* Auto-Trade Toggle */}
            <div className="flex items-center justify-between sm:justify-start px-3 py-1 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <div className="flex flex-col mr-3">
                    <span className="text-[10px] text-slate-400 font-bold tracking-wider">AUTO-TRADE</span>
                    <span className={`text-xs font-bold ${autoMode ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {autoMode ? 'ACTIVE' : 'PAUSED'}
                    </span>
                </div>
                <button 
                    onClick={onToggleAuto}
                    className={`w-10 h-5 rounded-full transition-all duration-300 relative focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-slate-900 ${autoMode ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-slate-700'}`}
                >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${autoMode ? 'translate-x-5' : ''}`}></div>
                </button>
            </div>

            <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>

            {/* Balance Display */}
            <div className="flex items-center gap-3 px-2 flex-1 sm:flex-none">
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                        <Wallet className="w-3 h-3" /> BALANCE
                    </span>
                    <span className="font-mono text-emerald-400 font-bold text-sm">
                        ${balance.toFixed(2)}
                    </span>
                </div>
            </div>

            <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>

            {/* Risk Control */}
            <div className="flex items-center gap-2 px-2 flex-1 sm:flex-none">
                 <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                        <Shield className="w-3 h-3" /> RISK %
                    </span>
                    <div className="flex items-center">
                        <input 
                            type="number" 
                            value={riskPercent} 
                            onChange={(e) => setRiskPercent(Number(e.target.value))}
                            className="w-10 bg-transparent text-white font-mono font-bold focus:outline-none border-b border-dotted border-slate-600 focus:border-blue-500 text-sm py-0" 
                        />
                        <span className="text-slate-500 text-xs ml-1">%</span>
                    </div>
                </div>
            </div>

            {/* Manual Trade Button */}
            <button 
                onClick={onManualTrade}
                className="ml-auto bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-2 rounded-lg border border-slate-700 transition-all active:scale-95 flex items-center justify-center gap-2 sm:gap-0 group"
                title="Manual Trade Entry"
            >
                <PenTool className="w-4 h-4 group-hover:text-blue-400 transition-colors" />
                <span className="sm:hidden text-xs font-bold">Manual Entry</span>
            </button>
        </div>
    );
};
