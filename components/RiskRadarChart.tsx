import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { RiskMetrics } from '../services/analyticsService';

interface RiskRadarChartProps {
  metrics: RiskMetrics;
}

export const RiskRadarChart: React.FC<RiskRadarChartProps> = ({ metrics }) => {
  const data = [
    { subject: 'Algo Trading', A: metrics.algoTrading, fullMark: 100 },
    { subject: 'Profit Trades', A: metrics.profitTrades, fullMark: 100 },
    { subject: 'Loss Trades', A: metrics.lossTrades, fullMark: 100 },
    { subject: 'Activity', A: metrics.tradingActivity, fullMark: 100 },
    { subject: 'Drawdown', A: metrics.maxDrawdown * 10, fullMark: 100 }, // Scale up for visibility
    { subject: 'Deposit Load', A: metrics.maxDepositLoad * 10, fullMark: 100 },
  ];

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#374151" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="Performance"
            dataKey="A"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="#3b82f6"
            fillOpacity={0.3}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
            itemStyle={{ color: '#60a5fa' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
