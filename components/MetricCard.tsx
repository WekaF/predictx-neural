import React from 'react';
import { HelpCircle } from 'lucide-react';

interface MetricCardProps {
  icon: string;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'green' | 'red' | 'blue' | 'purple' | 'yellow' | 'indigo';
  tooltip?: string;
  progress?: number; // 0 to 100
}

export const MetricCard: React.FC<MetricCardProps> = ({ 
  icon, 
  title, 
  value, 
  subtitle, 
  trend,
  trendValue,
  color = 'blue',
  tooltip,
  progress
}) => {
  const colorClasses = {
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    red: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
  };

  const trendIcons = {
    up: '↗',
    down: '↘',
    neutral: '→'
  };

  const trendColors = {
      up: 'text-emerald-400',
      down: 'text-rose-400',
      neutral: 'text-gray-400'
  };

  return (
    <div className={`relative overflow-hidden ${colorClasses[color]} border rounded-xl p-5 backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:shadow-lg`}>
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 bg-white/5 rounded-lg text-2xl">
            {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-black/20 ${trendColors[trend]}`}>
            <span>{trend === 'up' ? '+' : ''}{trendValue || ''}</span>
            <span>{trendIcons[trend]}</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-medium text-gray-400">{title}</h3>
          {tooltip && (
              <div className="group relative cursor-help">
                  <HelpCircle className="w-3 h-3 text-gray-600 hover:text-gray-400" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-xs text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 border border-gray-700">
                      {tooltip}
                  </div>
              </div>
          )}
      </div>
      
      <p className="text-3xl font-bold tracking-tight text-white mb-2">{value}</p>
      
      {subtitle && <p className="text-xs text-gray-500 line-clamp-1">{subtitle}</p>}

      {/* Progress Bar (Optional) */}
      {progress !== undefined && (
          <div className="mt-3 w-full bg-gray-700/50 rounded-full h-1.5">
              <div 
                  className={`h-1.5 rounded-full ${colorClasses[color].replace('bg-', 'bg-').replace('/10', '')}`} 
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%`, opacity: 0.8 }}
              />
          </div>
      )}
    </div>
  );
};
