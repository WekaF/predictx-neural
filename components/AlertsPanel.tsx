import React, { useState } from 'react';
import { Bell, Plus, Trash2, AlertCircle } from 'lucide-react';
import { Alert } from '../types';

interface AlertsPanelProps {
  alerts: Alert[];
  onAdd: (alert: Omit<Alert, 'id' | 'active'>) => void;
  onRemove: (id: string) => void;
}

const AlertsPanel: React.FC<AlertsPanelProps> = ({ alerts, onAdd, onRemove }) => {
  const [type, setType] = useState<'PRICE' | 'RSI'>('PRICE');
  const [condition, setCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;
    
    onAdd({
        type,
        condition,
        value: Number(value),
        message: `${type} ${condition} ${value}`
    });
    setValue('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4 text-slate-400 text-xs font-bold tracking-wider">
        <Bell className="w-4 h-4" /> CUSTOM ALERTS
      </div>

      <form onSubmit={handleSubmit} className="bg-slate-950 p-3 rounded-lg border border-slate-800 mb-4 space-y-3">
        <div className="flex gap-2">
            <select 
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 outline-none"
            >
                <option value="PRICE">Price</option>
                <option value="RSI">RSI</option>
            </select>
            <select 
                value={condition}
                onChange={(e) => setCondition(e.target.value as any)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 outline-none"
            >
                <option value="ABOVE">Above {'>'}</option>
                <option value="BELOW">Below {'<'}</option>
            </select>
        </div>
        <div className="flex gap-2">
            <input 
                type="number"
                placeholder="Value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none"
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-3 rounded flex items-center justify-center">
                <Plus className="w-4 h-4" />
            </button>
        </div>
      </form>

      <div className="flex-1 overflow-y-auto space-y-2">
        {alerts.length === 0 && <p className="text-center text-xs text-slate-600 py-4">No active alerts.</p>}
        {alerts.map(alert => (
            <div key={alert.id} className="flex justify-between items-center p-2 bg-slate-800/50 rounded border border-slate-700/50">
                <div className="flex items-center gap-2">
                    <AlertCircle className={`w-3 h-3 ${alert.type === 'PRICE' ? 'text-emerald-400' : 'text-purple-400'}`} />
                    <span className="text-xs text-slate-300 font-mono">
                        {alert.type} {alert.condition === 'ABOVE' ? '>' : '<'} {alert.value}
                    </span>
                </div>
                <button onClick={() => onRemove(alert.id)} className="text-slate-500 hover:text-rose-400">
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>
        ))}
      </div>
    </div>
  );
};

export default AlertsPanel;