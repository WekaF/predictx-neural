import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GrowthData } from '../services/analyticsService';

interface GrowthChartProps {
  data: GrowthData[];
}

export const GrowthChart: React.FC<GrowthChartProps> = ({ data }) => {
  if (data.length === 0) return <div>No data available</div>;

  // Calculate percentage growth for the last data point
  const startBalance = data[0].balance;
  const currentBalance = data[data.length - 1].balance;
  const growth = ((currentBalance - startBalance) / startBalance) * 100;

  return (
    <div className="w-full h-[300px]">
      <div className="flex justify-between items-center mb-2 px-2">
        <h3 className="text-gray-400 text-sm">Growth since inception</h3>
        <span className={`text-xl font-bold ${growth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {growth >= 0 ? '+' : ''}{growth.toFixed(2)}%
        </span>
      </div>
      
      <ResponsiveContainer width="100%" height="90%">
        <AreaChart
          data={data}
          margin={{
            top: 10,
            right: 0,
            left: 0,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis 
            dataKey="time" 
            tick={{ fill: '#64748b', fontSize: 10 }} 
            tickFormatter={(val) => {
                const date = new Date(val);
                return `${date.getMonth()+1}/${date.getDate()}`;
            }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            tick={{ fill: '#64748b', fontSize: 10 }} 
            axisLine={false}
            tickLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
            itemStyle={{ fontSize: 12 }}
            labelStyle={{ color: '#94a3b8', fontSize: 10, marginBottom: 4 }}
          />
          <Area 
            type="monotone" 
            dataKey="balance" 
            stroke="#3b82f6" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorBalance)" 
            name="Balance"
          />
          <Area 
            type="monotone" 
            dataKey="equity" 
            stroke="#10b981" 
            strokeWidth={1}
            strokeDasharray="4 4"
            fillOpacity={1} 
            fill="url(#colorEquity)" 
            name="Equity"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
