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
            setLocalResult(`Trained on ${count} patterns`);
            loadLocalStats();
        } catch (e) {
            setLocalResult("Error training");
        } finally {
            setIsLoadingLocal(false);
            setTimeout(() => setLocalResult(null), 3000);
        }
    };

    const handleUpdateParams = () => {
        updateLearningRate(learningRate);
        updateEpsilon(epsilon);
        loadLocalStats();
        setLocalResult("Params updated");
        setTimeout(() => setLocalResult(null), 2000);
    };

    const handleReset = () => {
        if (confirm("Reset AI Brain? This cannot be undone.")) {
            resetModel();
            loadLocalStats();
            setLocalResult("Brain reset");
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
                message: 'Backend Offline',
                final_loss: 0,
                epochs: 0
            });
        } finally {
            setIsLoadingCloud(false);
        }
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col min-h-[300px]">
            {/* Header */}
            <h3 className="text-xs font-bold text-slate-400 mb-4 flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-slate-400" />
                NEURAL TRAINING
            </h3>

            {/* Mode Toggle */}
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 mb-4">
                <button
                    onClick={() => setMode('LOCAL')}
                    className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 ${mode === 'LOCAL'
                        ? 'bg-slate-800 text-indigo-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-300'
                        }`}
                >
                    BROWSER AI
                </button>
                <button
                    onClick={() => setMode('CLOUD')}
                    className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 ${mode === 'CLOUD'
                        ? 'bg-slate-800 text-blue-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-300'
                        }`}
                >
                    PYTHON AI
                </button>
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
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                <span>Learning Rate</span>
                                <span className="text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{learningRate.toFixed(3)}</span>
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
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                <span>Exploration</span>
                                <span className="text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">{(epsilon * 100).toFixed(0)}%</span>
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
                    <div className="flex items-center justify-between text-[10px] px-2 py-2 bg-slate-950/50 rounded-lg border border-slate-800/50">
                        <span className="text-slate-500">Patterns: <span className="text-slate-300 font-bold">{stats?.totalPatterns || 0}</span></span>
                        <span className="text-slate-700">|</span>
                        <span className="text-slate-500">Mem: <span className="text-emerald-500/80 font-mono">{(stats?.totalPatterns || 0) * 0.2}KB</span></span>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        <button
                            onClick={handleLocalTrain}
                            disabled={isLoadingLocal}
                            className="py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        >
                            {isLoadingLocal ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                            TRAIN
                        </button>
                        <button
                            onClick={handleReset}
                            className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        >
                            <RefreshCcw className="w-3.5 h-3.5" />
                            RESET
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
                <div className="space-y-4 flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-left-4 duration-300">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase font-bold mb-1.5 block">Asset</label>
                            <input
                                type="text"
                                value={symbol}
                                onChange={(e) => setSymbol(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 font-mono"
                                placeholder="BTC-USD"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] text-slate-500 uppercase font-bold mb-1.5 block">Epochs</label>
                            <input
                                type="number"
                                value={epochs}
                                onChange={(e) => setEpochs(parseInt(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 font-mono"
                                min={1} max={50}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleCloudTrain}
                        disabled={isLoadingCloud}
                        className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all border ${isLoadingCloud 
                            ? 'bg-slate-800 border-slate-700 text-slate-500' 
                            : 'bg-blue-600 border-blue-500 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'}`}
                    >
                        {isLoadingCloud ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span className="text-xs font-bold">Training...</span>
                            </>
                        ) : (
                            <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span className="text-xs font-bold">START TRAINING</span>
                            </>
                        )}
                    </button>

                    {cloudResult?.status === 'success' && (
                        <div className="text-center text-[10px] text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                            Loss Reached: {cloudResult.final_loss.toFixed(5)}
                        </div>
                    )}
                </div>
            )}
            
            <div className="mt-auto pt-3 border-t border-slate-800/50 flex justify-between items-center text-[9px] text-slate-600">
               <span>Using {mode === 'LOCAL' ? 'TensorFlow.js' : 'PyTorch'}</span>
               <span className="font-mono">v2.1</span>
            </div>
        </div>
    );
};
