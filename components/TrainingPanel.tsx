import React, { useState, useEffect } from 'react';
import { BrainCircuit, Play, Loader2, CheckCircle2, AlertCircle, Terminal, BarChart2, Zap, Settings2, RefreshCcw, Database } from 'lucide-react';
import { aiBackendService, TrainingResponse } from '../services/apiService';
import { updateLearningRate, updateEpsilon, resetModel, trainFromSavedHistory, getModelStats } from '../services/mlService';

interface TrainingPanelProps {
    className?: string;
    selectedSymbol?: string;
}

export const TrainingPanel: React.FC<TrainingPanelProps> = ({ selectedSymbol = 'BTC-USD' }) => {
    // Mode State
    const [mode, setMode] = useState<'LOCAL' | 'CLOUD'>('LOCAL');

    // Cloud Training State
    const [isLoadingCloud, setIsLoadingCloud] = useState(false);
    const [symbol, setSymbol] = useState(selectedSymbol);
    const [epochs, setEpochs] = useState(5);
    const [cloudResult, setCloudResult] = useState<TrainingResponse | null>(null);

    // Local Training State
    const [isLoadingLocal, setIsLoadingLocal] = useState(false);
    const [localResult, setLocalResult] = useState<string | null>(null);
    const [learningRate, setLearningRate] = useState(0.01);
    const [epsilon, setEpsilon] = useState(0.1);
    const [stats, setStats] = useState<any>(null);

    // Sync with global selection
    useEffect(() => {
        if (selectedSymbol) setSymbol(selectedSymbol);
        loadLocalStats();
    }, [selectedSymbol]);

    const loadLocalStats = () => {
        const currentStats = getModelStats();
        setStats(currentStats);
        setLearningRate(currentStats.learningRate);
        setEpsilon(currentStats.epsilon);
    };

    // --- LOCAL ACTIONS ---
    const handleLocalTrain = async () => {
        setIsLoadingLocal(true);
        setLocalResult(null);
        try {
            const count = await trainFromSavedHistory();
            setLocalResult(`Trained on ${count} historical patterns.`);
            loadLocalStats();
        } catch (e) {
            setLocalResult("Error during local training");
        } finally {
            setIsLoadingLocal(false);
            setTimeout(() => setLocalResult(null), 3000);
        }
    };

    const handleUpdateParams = () => {
        updateLearningRate(learningRate);
        updateEpsilon(epsilon);
        loadLocalStats();
        setLocalResult("Hyperparameters updated!");
        setTimeout(() => setLocalResult(null), 2000);
    };

    const handleReset = () => {
        if (confirm("Reset AI Brain? This cannot be undone.")) {
            resetModel();
            loadLocalStats();
            setLocalResult("Brain reset to initial state.");
            setTimeout(() => setLocalResult(null), 2000);
        }
    };

    // --- CLOUD ACTIONS ---
    const handleCloudTrain = async () => {
        setIsLoadingCloud(true);
        setCloudResult(null);
        try {
            const response = await aiBackendService.trainModel(symbol, epochs);
            setCloudResult(response);
        } catch (e) {
            setCloudResult({
                status: 'error',
                message: 'Backend Offline (Run Python Server)',
                final_loss: 0,
                epochs: 0
            });
        } finally {
            setIsLoadingCloud(false);
        }
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col min-h-[300px]">
            {/* Header / Tabs */}
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                        <BrainCircuit className="w-4 h-4 text-indigo-400" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-200">Active Training Control</h3>
                </div>
                <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-800">
                    <button
                        onClick={() => setMode('LOCAL')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${mode === 'LOCAL' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Browser AI
                    </button>
                    <button
                        onClick={() => setMode('CLOUD')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${mode === 'CLOUD' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Python AI
                    </button>
                </div>
            </div>

            {/* ERROR MESSAGE FOR CLOUD */}
            {mode === 'CLOUD' && cloudResult?.status === 'error' && (
                <div className="mb-4 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 animate-in fade-in">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span className="text-[10px] text-rose-300 font-medium">{cloudResult.message}</span>
                </div>
            )}

            {/* LOCAL MODE UI */}
            {mode === 'LOCAL' && (
                <div className="flex-1 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    {/* Tuning Sliders */}
                    <div className="space-y-3">
                        <div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                                <span>Learning Rate (Alpha)</span>
                                <span className="text-indigo-400">{learningRate.toFixed(3)}</span>
                            </div>
                            <input
                                type="range" min="0.001" max="0.1" step="0.001"
                                value={learningRate}
                                onChange={(e) => setLearningRate(parseFloat(e.target.value))}
                                onMouseUp={handleUpdateParams}
                                onTouchEnd={handleUpdateParams}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                                <span>Exploration (Epsilon)</span>
                                <span className="text-purple-400">{(epsilon * 100).toFixed(0)}%</span>
                            </div>
                            <input
                                type="range" min="0" max="1" step="0.05"
                                value={epsilon}
                                onChange={(e) => setEpsilon(parseFloat(e.target.value))}
                                onMouseUp={handleUpdateParams}
                                onTouchEnd={handleUpdateParams}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                            />
                        </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-950 p-2 rounded border border-slate-800">
                        <div className="text-slate-500">Total Patterns: <span className="text-white font-mono">{stats?.totalPatterns || 0}</span></div>
                        <div className="text-slate-500">Memory Usage: <span className="text-emerald-400 font-mono">{(stats?.totalPatterns || 0) * 0.2}KB</span></div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        <button
                            onClick={handleLocalTrain}
                            disabled={isLoadingLocal}
                            className="py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        >
                            {isLoadingLocal ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                            Train History
                        </button>
                        <button
                            onClick={handleReset}
                            className="py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        >
                            <RefreshCcw className="w-3.5 h-3.5" />
                            Reset Brain
                        </button>
                    </div>

                    {localResult && (
                        <div className="text-[10px] text-center text-emerald-400 animate-in fade-in">
                            {localResult}
                        </div>
                    )}
                </div>
            )}

            {/* CLOUD MODE UI */}
            {mode === 'CLOUD' && (
                <div className="space-y-3 flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-left-4 duration-300">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase font-bold mb-1.5 block">Target Asset</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={symbol}
                                    onChange={(e) => setSymbol(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700/50 rounded-lg pl-3 pr-8 py-2 text-xs text-slate-200 focus:outline-none font-mono"
                                    placeholder="BTC-USD"
                                />
                                <div className="absolute right-2 top-2">
                                    <BarChart2 className="w-3.5 h-3.5 text-slate-600" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] text-slate-500 uppercase font-bold mb-1.5 block">Epochs</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={epochs}
                                    onChange={(e) => setEpochs(parseInt(e.target.value))}
                                    className="w-full bg-slate-950 border border-slate-700/50 rounded-lg pl-3 pr-2 py-2 text-xs text-slate-200 focus:outline-none font-mono"
                                    min={1} max={50}
                                />
                                <div className="absolute right-2 top-2">
                                    <Zap className="w-3.5 h-3.5 text-amber-500/50" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleCloudTrain}
                        disabled={isLoadingCloud}
                        className={`w-full mt-2 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all ${isLoadingCloud ? 'bg-slate-800 text-slate-400' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg'}`}
                    >
                        {isLoadingCloud ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span className="text-xs font-bold">Training Network...</span>
                            </>
                        ) : (
                            <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span className="text-xs font-bold">Start Cloud Training</span>
                            </>
                        )}
                    </button>

                    {cloudResult?.status === 'success' && (
                        <div className="mt-2 text-center text-[10px] text-emerald-400">
                            Success! Final Loss: {cloudResult.final_loss.toFixed(5)}
                        </div>
                    )}
                </div>
            )}

            <div className="mt-3 pt-3 border-t border-slate-800/50 flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                    <Terminal className="w-3 h-3" />
                    <span>{mode === 'LOCAL' ? 'v2.1.0 Browser Engine' : 'v1.0.2 Python Engine'}</span>
                </div>
            </div>
        </div>
    );
};
