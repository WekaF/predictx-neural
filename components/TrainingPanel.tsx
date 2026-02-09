import React, { useState, useEffect } from 'react';
import { BrainCircuit, Play, Loader2, CheckCircle2, AlertCircle, Terminal, BarChart2, Zap } from 'lucide-react';
import { aiBackendService, TrainingResponse } from '../services/apiService';

export const TrainingPanel: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [symbol, setSymbol] = useState('BTC-USD');
    const [epochs, setEpochs] = useState(1); // Default to 1 for faster feedback
    const [result, setResult] = useState<TrainingResponse | null>(null);

    const handleTrain = async () => {
        setIsLoading(true);
        setResult(null);
        try {
            const response = await aiBackendService.trainModel(symbol, epochs);
            setResult(response);
        } catch (e) {
            setResult({
                status: 'error',
                message: 'Backend Offline',
                final_loss: 0,
                epochs: 0
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col min-h-[220px]">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                        <BrainCircuit className="w-4 h-4 text-indigo-400" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-200">AI Model Training</h3>
                </div>
                {result?.status === 'success' && (
                     <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Loss: {result.final_loss.toFixed(5)}
                    </span>
                )}
            </div>

            <div className="space-y-3 flex-1 flex flex-col justify-center">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] text-slate-500 uppercase font-bold mb-1.5 block">Target Asset</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={symbol}
                                onChange={(e) => setSymbol(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700/50 rounded-lg pl-3 pr-8 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono"
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
                                className="w-full bg-slate-950 border border-slate-700/50 rounded-lg pl-3 pr-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono"
                                min={1}
                                max={50}
                            />
                            <div className="absolute right-2 top-2">
                                <Zap className="w-3.5 h-3.5 text-amber-500/50" />
                            </div>
                        </div>
                    </div>
                </div>

                {result && result.status === 'error' && (
                    <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                        <span className="text-[10px] text-rose-300 font-medium">{result.message}</span>
                    </div>
                )}

                <button
                    onClick={handleTrain}
                    disabled={isLoading}
                    className={`
                        w-full mt-2 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all group overflow-hidden relative
                        ${isLoading 
                            ? 'bg-slate-800 text-slate-400 cursor-wait' 
                            : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-900/20'
                        }
                    `}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span className="text-xs font-bold">Training Network...</span>
                        </>
                    ) : (
                        <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span className="text-xs font-bold">Start Training Loop</span>
                        </>
                    )}
                </button>
            </div>
            
            <div className="mt-3 pt-3 border-t border-slate-800/50 flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                    <Terminal className="w-3 h-3" />
                    <span>v1.0.2 Stable</span>
                </div>
                {result?.status === 'success' && (
                     <div className="flex items-center gap-1 text-[10px] text-emerald-500/70">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Ready</span>
                     </div>
                )}
            </div>
        </div>
    );
};
