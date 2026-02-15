import React, { useEffect, useState } from 'react';
import { Gauge, TrendingUp, TrendingDown, DollarSign, Activity, Percent, Shield, AlertTriangle } from 'lucide-react';
import { FundingRateChart } from './FundingRateChart';
import { futuresRiskManager } from '../services/futuresRiskManager';
import { liquidationCalculator } from '../services/liquidationCalculator';

interface FuturesDashboardProps {
  symbol: string;
  fundingData?: any; // Result from pending backend call
  marketSentiment?: any; // Result from pending backend call (OI/LongShort)
  currentPrice: number;
}

export const FuturesDashboard: React.FC<FuturesDashboardProps> = ({
  symbol,
  fundingData,
  marketSentiment,
  currentPrice
}) => {
  const [mmr, setMmr] = useState<number>(0.005);
  const [maxLeverage, setMaxLeverage] = useState<number>(125);
  
  useEffect(() => {
     // Detect MMR
     if (symbol.includes('BTC') || symbol.includes('ETH')) {
         setMmr(0.004);
         setMaxLeverage(125);
     } else {
         setMmr(0.005);
         setMaxLeverage(50);
     }
  }, [symbol]);

  // Extract Data
  const fundingRate = fundingData?.current || 0;
  const fundingHistory = fundingData?.history || [];
  const oi = marketSentiment?.open_interest?.open_interest || 0;
  const longShortRatio = marketSentiment?.long_short_ratio?.ratio || 1.0;
  const takerRatio = marketSentiment?.taker_ratio?.ratio || 1.0;
  
  // Format OI
  const formatOI = (val: number) => {
      if (val >= 1000000) return `${(val / 1000000).toFixed(2)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(2)}K`;
      return val.toFixed(0);
  };

  return (
    <div className="space-y-3">
      {/* Header Stat row - Compact */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Market Sentiment Card */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 hover:bg-slate-800/80 transition-colors">
          <div className="flex justify-between items-center mb-1">
             <span className="text-slate-500 text-[10px] font-bold uppercase flex items-center gap-1"><Activity size={10}/> Open Interest</span>
          </div>
          <div className="text-sm font-mono font-bold text-slate-200">{formatOI(oi)}</div>
        </div>

        {/* Long/Short Ratio */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 hover:bg-slate-800/80 transition-colors">
          <div className="flex justify-between items-center mb-1">
             <span className="text-slate-500 text-[10px] font-bold uppercase flex items-center gap-1"><ScaleIcon isBullish={longShortRatio < 1}/> L/S Ratio</span>
          </div>
          <div className={`text-sm font-mono font-bold ${longShortRatio > 1.2 ? 'text-rose-400' : longShortRatio < 0.8 ? 'text-emerald-400' : 'text-slate-200'}`}>
            {longShortRatio.toFixed(2)}
          </div>
        </div>

        {/* Taker Volume */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 hover:bg-slate-800/80 transition-colors">
          <div className="flex justify-between items-center mb-1">
             <span className="text-slate-500 text-[10px] font-bold uppercase flex items-center gap-1"><TrendingUp size={10}/> Taker Vol</span>
          </div>
          <div className={`text-sm font-mono font-bold ${takerRatio > 1.0 ? 'text-emerald-400' : 'text-rose-400'}`}>
             {takerRatio.toFixed(2)}
          </div>
        </div>
        
        {/* Dynamic Leverage Recommendation */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 relative overflow-hidden group hover:bg-slate-800/80 transition-colors">
          <div className="absolute -right-2 -top-2 p-1 opacity-5 group-hover:opacity-10 transition-opacity">
               <Shield size={32} />
          </div>
          <div className="flex justify-between items-center mb-1">
             <span className="text-slate-500 text-[10px] font-bold uppercase flex items-center gap-1"><Shield size={10}/> Safe Lev</span>
          </div>
          <div className="text-sm font-mono font-bold text-blue-400">
             {symbol.includes('BTC') ? '20x' : '10x'} 
             <span className="text-[9px] font-normal text-slate-600 ml-1">MAX</span>
          </div>
        </div>
      </div>

      {/* Main Chart Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
           {/* Funding Chart (2/3 width) */}
           <div className="md:col-span-2 bg-slate-900/30 border border-slate-800 rounded-lg p-2 min-h-[150px]">
               <FundingRateChart 
                 data={fundingHistory} 
                 symbol={symbol} 
                 currentRate={fundingRate} 
               />
           </div>
           
           {/* Liquidation & Risk Card (1/3 width) */}
           <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-3 flex flex-col justify-center gap-2">
               <h3 className="text-[10px] font-bold text-slate-500 uppercase flex items-center mb-1"><AlertTriangle size={10} className="mr-1.5 text-amber-500"/> Liquidation Zones</h3>
               
               {/* Long Liq */}
               <div className="bg-slate-950/50 rounded-md p-2 border-l-2 border-emerald-500/50">
                  <div className="flex justify-between text-[9px] mb-0.5">
                    <span className="text-slate-500 uppercase">Long Sup</span>
                    <span className="text-slate-600">10x</span>
                  </div>
                  <div className="font-mono text-xs font-bold text-emerald-400">
                    {(currentPrice * (1 - 1/10)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
               </div>
               
               {/* Short Liq */}
               <div className="bg-slate-950/50 rounded-md p-2 border-l-2 border-rose-500/50">
                  <div className="flex justify-between text-[9px] mb-0.5">
                    <span className="text-slate-500 uppercase">Short Res</span>
                    <span className="text-slate-600">10x</span>
                  </div>
                  <div className="font-mono text-xs font-bold text-rose-400">
                    {(currentPrice * (1 + 1/10)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
               </div>
           </div>
      </div>
    </div>
  );
};

const ScaleIcon = ({ isBullish }: { isBullish: boolean }) => (
  isBullish 
    ? <TrendingUp size={12} className="text-green-500"/> 
    : <TrendingDown size={12} className="text-red-500"/>
);
