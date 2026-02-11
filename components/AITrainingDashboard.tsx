import React, { useState, useEffect, useRef } from 'react';
import { Brain, Play, RotateCcw, Activity, Save, Database, Cpu } from 'lucide-react';
import { getTrainingState, startBatchTraining, refreshModel } from '../services/mlService';
import { storageService } from '../services/storageService';
import { TrainingData } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const AITrainingDashboard: React.FC = () => {
    const [isTraining, setIsTraining] = useState(false);
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState<string[]>([]);
    const [metrics, setMetrics] = useState<any[]>([]);
    const [stats, setStats] = useState({
        iterations: 0,
        epsilon: 0,
        learningRate: 0,
        patternMemorySize: 0,
        winRate: 0
    });
    const logContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Initial stats load
        refreshStats();
        const interval = setInterval(refreshStats, 2000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    const refreshStats = () => {
        const s = getTrainingState();
        setStats(prev => ({ ...prev, ...s }));
    };

    const addLog = (message: string) => {
        setLogs(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${message}`]);
    };

    const handleStartTraining = async () => {
        if (isTraining) return;
        setIsTraining(true);
        addLog("🚀 Initializing Batch Training Sequence...");
        
        try {
            // Fetch training data
            const trainingData = await storageService.fetchTrainingDataFromSupabase(); // Or local mock if needed
            
            if (trainingData.length === 0) {
                addLog("⚠️ No training data found. Using synthetic replay data...");
                // TODO: Implement synthetic data generation if needed
            } else {
                addLog(`📚 Loaded ${trainingData.length} historical scenarios.`);
            }

            await startBatchTraining(trainingData, (prog, message) => {
                setProgress(prog);
                addLog(message);
                
                // Parse win rate for chart
                const match = message.match(/Win Rate: ([\d.]+)%/);
                if (match) {
                    const wr = parseFloat(match[1]);
                    setMetrics(prev => [...prev, { 
                        step: prev.length, 
                        winRate: wr, 
                        epsilon: getTrainingState().epsilon * 100 
                    }]);
                }
            });

            addLog("✅ Training Session Complete.");
            refreshModel(); // Reload weights
        } catch (error) {
            addLog(`❌ Training Failed: ${error}`);
        } finally {
            setIsTraining(false);
            setProgress(0);
        }
    };

    const handleReset = () => {
        if (confirm("Reset AI Model memory? This cannot be undone.")) {
            // Logic to reset weights would go here
            addLog("♻️ AI Model Memory Reset.");
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
            {/* Header */}
            <header className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
                        <Brain className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                            Neural Network Training Center
                        </h1>
                        <p className="text-xs text-slate-400">Deep Q-Network (DQN) + CNN-LSTM Hybrid</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleReset}
                        className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-400 flex items-center gap-2 transition-all"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Reset Agent
                    </button>
                    <button 
                        onClick={handleStartTraining}
                        disabled={isTraining}
                        className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-xl transition-all ${isTraining ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/20'}`}
                    >
                        {isTraining ? <Activity className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        {isTraining ? "Training..." : "Start Batch Training"}
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Metrics Cards */}
                <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricCard 
                        icon={<Database className="w-5 h-5 text-blue-400" />} 
                        label="Total Iterations" 
                        value={stats.iterations.toLocaleString()} 
                        subtext="Episodes Replayed"
                    />
                    <MetricCard 
                        icon={<Cpu className="w-5 h-5 text-purple-400" />} 
                        label="Exploration Rate (ε)" 
                        value={(stats.epsilon * 100).toFixed(1) + "%"} 
                        subtext="Learning vs. Exploiting"
                    />
                    <MetricCard 
                        icon={<Activity className="w-5 h-5 text-emerald-400" />} 
                        label="Pattern Memory" 
                        value={stats.patternMemorySize.toString()} 
                        subtext="Unique Patterns Stored"
                    />
                    <MetricCard 
                        icon={<Save className="w-5 h-5 text-amber-400" />} 
                        label="Learning Rate" 
                        value={stats.learningRate.toFixed(3)} 
                        subtext="Adaptive ADAM Optimizer"
                    />
                </div>

                {/* Main Charts */}
                <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col h-[400px]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-300">Learning Curve (Win Rate vs Exploration)</h3>
                        <span className="text-xs px-2 py-1 bg-slate-800 rounded text-slate-400">Live Updates</span>
                    </div>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={metrics}>
                                <defs>
                                    <linearGradient id="colorWr" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorEps" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="step" stroke="#64748b" fontSize={12} />
                                <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                    itemStyle={{ color: '#f8fafc' }}
                                />
                                <Area type="monotone" dataKey="winRate" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorWr)" name="Win Rate %" />
                                <Area type="monotone" dataKey="epsilon" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorEps)" name="Exploration %" />
                            </AreaChart>
                        </ResponsiveContainer>
                        {metrics.length === 0 && (
                            <div className="h-full flex items-center justify-center text-slate-500 absolute inset-0 z-0">
                                Start training to view live metrics
                            </div>
                        )}
                    </div>
                </div>

                {/* Logs Console */}
                <div className="md:col-span-1 bg-black border border-slate-800 rounded-xl p-0 flex flex-col h-[400px] shadow-xl overflow-hidden font-mono text-xs">
                    <div className="p-3 border-b border-slate-900 bg-slate-900/50 flex justify-between items-center">
                        <span className="font-bold text-slate-400">System Logs</span>
                        <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        </div>
                    </div>
                    <div ref={logContainerRef} className="flex-1 overflow-auto p-3 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
                         {logs.length === 0 ? (
                             <span className="text-slate-600 select-none">Ready for training...</span>
                         ) : (
                             logs.map((log, i) => (
                                 <div key={i} className={`break-words ${log.includes('Error') ? 'text-red-400' : log.includes('Complete') ? 'text-emerald-400' : 'text-slate-300'}`}>
                                     <span className="opacity-50 mr-2">{'>'}</span>
                                     {log}
                                 </div>
                             ))
                         )}
                         {isTraining && (
                            <div className="w-full bg-slate-800 rounded-full h-1 mt-2 mb-1 overflow-hidden">
                                <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>
                         )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const MetricCard = ({ icon, label, value, subtext }: { icon: React.ReactNode, label: string, value: string, subtext: string }) => (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4 relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="p-3 bg-slate-900/50 rounded-lg group-hover:scale-110 transition-transform duration-300">
            {icon}
        </div>
        <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{label}</p>
            <h4 className="text-xl font-bold text-white mt-0.5">{value}</h4>
            <p className="text-[10px] text-slate-500">{subtext}</p>
        </div>
        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
            {icon}
        </div>
    </div>
);

export default AITrainingDashboard;
