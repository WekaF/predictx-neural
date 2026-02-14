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
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 w-full h-full">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
           <h3 className="text-sm font-semibold text-gray-200">Funding Rate History</h3>
           <div className="group relative">
             <Info size={14} className="text-gray-500 cursor-help" />
             <div className="hidden group-hover:block absolute z-50 bottom-full left-1/2 -translate-x-1/2 w-48 p-2 bg-gray-900 text-xs text-gray-300 rounded border border-gray-700 mb-2">
               Positive = Longs pay Shorts. Negative = Shorts pay Longs.
             </div>
           </div>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-500 block">Current</span>
          <span className={`text-sm font-mono font-bold ${currentRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {(currentRate * 100).toFixed(4)}%
          </span>
        </div>
      </div>
      
      <div className="h-40 w-full">
        {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
                <ReferenceLine y={0} stroke="#4B5563" strokeDasharray="3 3" />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                <Bar dataKey="rate">
                {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.rate >= 0 ? '#10B981' : '#EF4444'} />
                ))}
                </Bar>
            </BarChart>
            </ResponsiveContainer>
        ) : (
            <div className="flex items-center justify-center h-full text-xs text-gray-500">
                No funding history available
            </div>
        )}
      </div>
    </div>
  );
};
