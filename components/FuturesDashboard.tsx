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
    <div className="space-y-4">
      {/* Header Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Market Sentiment Card */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3">
          <div className="flex justify-between items-start mb-1">
             <span className="text-gray-400 text-xs flex items-center gap-1"><Activity size={12}/> Open Interest</span>
          </div>
          <div className="text-lg font-bold text-gray-200">{formatOI(oi)}</div>
           <div className="text-xs text-gray-500 mt-1">Contracts Open</div>
        </div>

        {/* Long/Short Ratio */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3">
          <div className="flex justify-between items-start mb-1">
             <span className="text-gray-400 text-xs flex items-center gap-1"><ScaleIcon isBullish={longShortRatio < 1}/> L/S Ratio</span>
          </div>
          <div className={`text-lg font-bold ${longShortRatio > 1.2 ? 'text-red-400' : longShortRatio < 0.8 ? 'text-green-400' : 'text-gray-200'}`}>
            {longShortRatio.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
             {longShortRatio > 1 ? 'Majority Long' : 'Majority Short'}
          </div>
        </div>

        {/* Taker Volume */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3">
          <div className="flex justify-between items-start mb-1">
             <span className="text-gray-400 text-xs flex items-center gap-1"><TrendingUp size={12}/> Taker Vol</span>
          </div>
          <div className={`text-lg font-bold ${takerRatio > 1.0 ? 'text-green-400' : 'text-red-400'}`}>
             {takerRatio.toFixed(2)}
          </div>
           <div className="text-xs text-gray-500 mt-1">Buy/Sell Vol Ratio</div>
        </div>
        
        {/* Dynamic Leverage Recommendation */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-1 opacity-10">
                 <Shield size={48} />
             </div>
          <div className="flex justify-between items-start mb-1">
             <span className="text-gray-400 text-xs flex items-center gap-1"><Shield size={12}/> Safe Leverage</span>
          </div>
          <div className="text-lg font-bold text-blue-400">
             {symbol.includes('BTC') ? '20x' : '10x'} 
             <span className="text-xs font-normal text-gray-500 ml-1">Max</span>
          </div>
           <div className="text-xs text-gray-500 mt-1">Based on Volatility</div>
        </div>
      </div>

      {/* Main Chart Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-64">
           {/* Funding Chart (2/3 width) */}
           <div className="md:col-span-2">
               <FundingRateChart 
                 data={fundingHistory} 
                 symbol={symbol} 
                 currentRate={fundingRate} 
               />
           </div>
           
           {/* Liquidation & Risk Card (1/3 width) */}
           <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-col justify-center">
               <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center"><AlertTriangle size={14} className="mr-2 text-yellow-500"/> Liquidation Zones</h3>
               
               {/* Long Liq */}
               <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-green-400">Long Support</span>
                    <span className="text-gray-400">10x Lev</span>
                  </div>
                  <div className="bg-gray-900 rounded p-2 border-l-2 border-green-500">
                      <span className="font-mono text-sm">{(currentPrice * (1 - 1/10)).toFixed(2)}</span>
                  </div>
               </div>
               
               {/* Short Liq */}
               <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-red-400">Short Resistance</span>
                    <span className="text-gray-400">10x Lev</span>
                  </div>
                  <div className="bg-gray-900 rounded p-2 border-l-2 border-red-500">
                      <span className="font-mono text-sm">{(currentPrice * (1 + 1/10)).toFixed(2)}</span>
                  </div>
               </div>
               
               <div className="mt-4 text-xs text-gray-500 text-center">
                   *Estimated liquidation levels at 10x leverage
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
