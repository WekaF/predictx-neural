import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Info } from 'lucide-react';

interface FundingHistoryItem {
  time: number;
  rate: number;
}

interface FundingRateChartProps {
  data: number[]; // Array of funding rates
  symbol: string;
  currentRate: number;
  predictedRate?: number;
}

export const FundingRateChart: React.FC<FundingRateChartProps> = ({ 
  data, 
  symbol,
  currentRate
}) => {
  // Format data for Recharts
  // Assuming data is latest-first or we need to map it. 
  // If data is just numbers, we index them.
  const chartData = data.map((rate, index) => ({
    index: index,
    rate: rate * 100, // Convert to percentage
    time: `T-${data.length - index}` // Simple time label
  })).reverse(); // Oldest first for chart

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const rateVal = payload[0].value;
      const annualized = rateVal * 3 * 365;
      return (
        <div className="bg-gray-900 border border-gray-700 p-2 rounded shadow-lg text-xs">
          <p className="font-bold text-gray-300">Interval: {label}</p>
          <p className={`font-mono ${rateVal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            Rate: {rateVal.toFixed(4)}%
          </p>
          <p className="text-gray-500">APR: {annualized.toFixed(2)}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col justify-between">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-1">
            Funding Rate
            <div className="group relative">
               <Info size={10} className="text-slate-600 cursor-help" />
               <div className="hidden group-hover:block absolute z-50 bottom-full left-0 w-32 p-1.5 bg-slate-900 text-[10px] text-slate-300 rounded border border-slate-700 mb-1">
                 + Longs pay Shorts
                 <br/>- Shorts pay Longs
               </div>
             </div>
          </h3>
          <div className={`text-lg font-mono font-bold ${currentRate >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {(currentRate * 100).toFixed(4)}%
          </div>
        </div>
      </div>
      
      <div className="flex-1 min-h-[60px]">
        {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
                <ReferenceLine y={0} stroke="#334155" strokeDasharray="3 3" />
                <Tooltip 
                  content={<CustomTooltip />} 
                  cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                />
                <Bar dataKey="rate" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.rate >= 0 ? '#10B981' : '#EF4444'} 
                      opacity={0.8}
                    />
                  ))}
                </Bar>
            </BarChart>
            </ResponsiveContainer>
        ) : (
            <div className="flex items-center justify-center h-full text-[10px] text-slate-600 italic border border-slate-800/50 rounded border-dashed">
                No history
            </div>
        )}
      </div>
    </div>
  );
};
