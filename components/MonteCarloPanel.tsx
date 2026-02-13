import React, { useState, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { 
  Calculator, RefreshCcw, TrendingDown, TrendingUp, AlertTriangle, 
  Target, Activity, Layers 
} from 'lucide-react';
import { EnhancedExecutedTrade } from '../types/enhanced';
import { monteCarloService, MonteCarloStats } from '../services/monteCarloService';

interface Props {
  trades: EnhancedExecutedTrade[];
  currentBalance: number;
}

export const MonteCarloPanel: React.FC<Props> = ({ trades, currentBalance }) => {
  const [iterations, setIterations] = useState<number>(1000);
  const [selectedAsset, setSelectedAsset] = useState<string>('ALL');
  const [isSimulating, setIsSimulating] = useState(false);
  const [results, setResults] = useState<MonteCarloStats | null>(null);

  // Filter trades based on selection
  const filteredTrades = useMemo(() => {
    if (selectedAsset === 'ALL') return trades;
    return trades.filter(t => t.symbol === selectedAsset);
  }, [trades, selectedAsset]);

  // Get unique assets
  const assets = useMemo(() => {
    return Array.from(new Set(trades.map(t => t.symbol)));
  }, [trades]);

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    
    // Use setTimeout to allow UI to render loading state before heavy calc
    setTimeout(() => {
      try {
        const simResults = monteCarloService.runSimulation(
          filteredTrades, 
          currentBalance, 
          iterations
        );
        setResults(simResults);
      } catch (e) {
        console.error("Simulation failed", e);
      } finally {
        setIsSimulating(false);
      }
    }, 100);
  };

  // Safe color based on drawdown
  const getDrawdownColor = (dd: number) => {
    if (dd < -30) return 'text-red-500';
    if (dd < -15) return 'text-amber-500';
    return 'text-green-500';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header & Configuration */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0a0a0f] p-6 rounded-xl border border-white/5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calculator className="w-6 h-6 text-purple-400" />
            Monte Carlo Simulation
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Stress-test your strategy by simulating {iterations.toLocaleString()} random future scenarios.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
           {/* Asset Selector */}
           <div className="flex flex-col">
            <label className="text-xs text-gray-500 font-bold uppercase mb-1">Asset</label>
            <select 
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            >
              <option value="ALL">All Assets</option>
              {assets.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Iterations Selector */}
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 font-bold uppercase mb-1">Simulations</label>
            <select 
              value={iterations}
              onChange={(e) => setIterations(Number(e.target.value))}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            >
              <option value={1000}>1,000</option>
              <option value={5000}>5,000</option>
              <option value={10000}>10,000</option>
              <option value={50000}>50,000</option>
            </select>
          </div>

          <button
            onClick={handleRunSimulation}
            disabled={isSimulating || filteredTrades.length < 10}
            className={`mt-5 px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${
              isSimulating 
                ? 'bg-purple-900/50 text-purple-300 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20'
            }`}
          >
            {isSimulating ? (
              <RefreshCcw className="w-4 h-4 animate-spin" />
            ) : (
              <Activity className="w-4 h-4" />
            )}
            Run Simulation
          </button>
        </div>
      </div>

      {filteredTrades.length < 10 && !results && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <p className="text-amber-200 text-sm">
            Insufficient data. At least 10 trades are required to run a meaningful Monte Carlo simulation.
          </p>
        </div>
      )}

      {results && (
        <>
          {/* Comparison Cards (Original vs Worst Case) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Drawdown */}
            <div className="bg-[#0a0a0f] p-6 rounded-xl border border-white/5 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <TrendingDown className="w-16 h-16 text-white" />
               </div>
               <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-4">Max Drawdown Risk</h3>
               
               <div className="flex items-center justify-between mb-2">
                 <span className="text-sm text-gray-500">Original</span>
                 <span className={`font-mono font-bold ${getDrawdownColor(results.original.maxDrawdown)}`}>
                   {results.original.maxDrawdown.toFixed(2)}%
                 </span>
               </div>
               
               <div className="flex items-center gap-2 my-2">
                 <div className="h-px bg-white/10 flex-1"></div>
                 <span className="text-xs text-gray-600">vs Worst Case</span>
                 <div className="h-px bg-white/10 flex-1"></div>
               </div>

               <div className="flex items-center justify-between">
                 <span className="text-sm text-gray-300">Simulation (95%)</span>
                 <span className={`font-mono font-bold text-xl ${getDrawdownColor(results.worstCase.maxDrawdown)}`}>
                   {results.worstCase.maxDrawdown.toFixed(2)}%
                 </span>
               </div>
               
               <div className="mt-4 text-xs text-gray-500 bg-red-500/10 p-2 rounded text-center">
                 Risk is <span className="font-bold text-red-400">{(results.worstCase.maxDrawdown - results.original.maxDrawdown).toFixed(2)}% deeper</span> than history.
               </div>
            </div>

            {/* Losing Streak */}
            <div className="bg-[#0a0a0f] p-6 rounded-xl border border-white/5 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Layers className="w-16 h-16 text-white" />
               </div>
               <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-4">Max Losing Streak</h3>
               
               <div className="flex items-center justify-between mb-2">
                 <span className="text-sm text-gray-500">Original</span>
                 <span className="font-mono font-bold text-white">
                   {results.original.maxLosingStreak} trades
                 </span>
               </div>
               
               <div className="flex items-center gap-2 my-2">
                 <div className="h-px bg-white/10 flex-1"></div>
                 <span className="text-xs text-gray-600">vs Worst Case</span>
                 <div className="h-px bg-white/10 flex-1"></div>
               </div>

               <div className="flex items-center justify-between">
                 <span className="text-sm text-gray-300">Simulation</span>
                 <span className="font-mono font-bold text-xl text-amber-400">
                   {results.worstCase.maxLosingStreak} trades
                 </span>
               </div>

               <div className="mt-4 text-xs text-gray-500 bg-amber-500/10 p-2 rounded text-center">
                 Prepare for <span className="font-bold text-amber-400">{results.worstCase.maxLosingStreak} losses</span> in a row.
               </div>
            </div>

            {/* Final Balance */}
            <div className="bg-[#0a0a0f] p-6 rounded-xl border border-white/5 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Target className="w-16 h-16 text-white" />
               </div>
               <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-4">Expected Outcome</h3>
               
               <div className="flex items-center justify-between mb-2">
                 <span className="text-sm text-gray-500">Worst Case</span>
                 <span className="font-mono text-sm text-red-400">
                   ${results.worstCase.finalBalance.toFixed(2)}
                 </span>
               </div>

               <div className="flex items-center justify-between mb-2">
                 <span className="text-sm text-gray-500">Best Case</span>
                 <span className="font-mono text-sm text-green-400">
                   ${results.bestCase.finalBalance.toFixed(2)}
                 </span>
               </div>
               
               <div className="mt-2 pt-2 border-t border-white/10">
                 <div className="flex items-center justify-between">
                   <span className="text-sm text-white font-bold">Median (Typical)</span>
                   <span className="font-mono font-bold text-xl text-blue-400">
                     ${results.medianCase.finalBalance.toFixed(2)}
                   </span>
                 </div>
               </div>
            </div>
          </div>

          {/* Visualization Chart */}
          <div className="bg-[#0a0a0f] p-6 rounded-xl border border-white/5">
            <h3 className="text-lg font-bold text-white mb-6">Possible Equity Paths ({iterations} Runs)</h3>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis dataKey="tradeNum" type="number" stroke="#ffffff20" fontSize={10} domain={['dataMin', 'dataMax']} allowDataOverflow={true} />
                  <YAxis stroke="#ffffff20" fontSize={10} domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0a0a0f', borderColor: '#ffffff10' }}
                    labelStyle={{ color: '#888' }}
                  />
                  
                  {/* Cloud of random simulations (faint) */}
                  {results.simulations.slice(0, 50).map((sim, i) => (
                    sim.equityCurve.length > 0 && (
                      <Line 
                        key={i}
                        data={sim.equityCurve}
                        dataKey="equity"
                        type="monotone"
                        stroke="#8b5cf6"
                        strokeWidth={1}
                        strokeOpacity={0.1}
                        dot={false}
                        isAnimationActive={false}
                      />
                    )
                  ))}

                  {/* Worst Case (Red) */}
                  <Line 
                    data={results.worstCase.equityCurve}
                    dataKey="equity"
                    type="monotone"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    name="Worst Case"
                  />

                  {/* Best Case (Green) */}
                  <Line 
                    data={results.bestCase.equityCurve}
                    dataKey="equity"
                    type="monotone"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    name="Best Case"
                  />

                  {/* Original (White) */}
                  <Line 
                    data={results.original.equityCurve}
                    dataKey="equity"
                    type="monotone"
                    stroke="#ffffff"
                    strokeWidth={3}
                    dot={false}
                    name="Original Path"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4 text-xs text-gray-400">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white rounded-full"></div> Original Path</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"></div> Worst Case Scenario</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full"></div> Best Case Scenario</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-purple-500/30 rounded-full"></div> Possible Variations</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
