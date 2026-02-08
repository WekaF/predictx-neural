import React, { useState } from 'react';
import { X, BookOpen, TrendingUp, Layers, Zap, ArrowRight, CheckCircle2 } from 'lucide-react';

interface StrategyGuideModalProps {
  onClose: () => void;
}

const StrategyGuideModal: React.FC<StrategyGuideModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'trend' | 'support' | 'pattern' | 'execution'>('trend');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col md:flex-row h-[80vh] md:h-[600px]">
        
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-slate-950 border-b md:border-b-0 md:border-r border-slate-800 p-4 flex flex-col gap-2 shrink-0">
            <div className="flex items-center gap-2 mb-6 text-blue-400 font-bold px-2">
                <BookOpen className="w-5 h-5" />
                <span>The Big Three</span>
            </div>
            
            <button 
                onClick={() => setActiveTab('trend')}
                className={`p-3 rounded-lg text-left text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'trend' ? 'bg-blue-600/20 text-blue-400 border border-blue-600/50' : 'text-slate-400 hover:bg-slate-900'}`}
            >
                <TrendingUp className="w-4 h-4" /> 1. Market Trend
            </button>
            <button 
                onClick={() => setActiveTab('support')}
                className={`p-3 rounded-lg text-left text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'support' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/50' : 'text-slate-400 hover:bg-slate-900'}`}
            >
                <Layers className="w-4 h-4" /> 2. Key Levels
            </button>
            <button 
                onClick={() => setActiveTab('pattern')}
                className={`p-3 rounded-lg text-left text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'pattern' ? 'bg-purple-600/20 text-purple-400 border border-purple-600/50' : 'text-slate-400 hover:bg-slate-900'}`}
            >
                <Zap className="w-4 h-4" /> 3. Entry Trigger
            </button>
             <button 
                onClick={() => setActiveTab('execution')}
                className={`p-3 rounded-lg text-left text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'execution' ? 'bg-amber-600/20 text-amber-400 border border-amber-600/50' : 'text-slate-400 hover:bg-slate-900'}`}
            >
                <CheckCircle2 className="w-4 h-4" /> Execution Checklist
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col bg-slate-900 relative">
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white z-10">
                <X className="w-6 h-6" />
            </button>

            <div className="p-8 overflow-y-auto flex-1">
                {activeTab === 'trend' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <TrendingUp className="text-blue-500" /> Defining the Trend
                        </h2>
                        <p className="text-slate-400 leading-relaxed">
                            The first rule of "The Big Three" is <strong>Trade with the Trend</strong>. We use the 200-period Simple Moving Average (SMA) as our primary filter.
                        </p>

                        <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h3 className="text-emerald-400 font-bold mb-2">Uptrend Scenario</h3>
                                <div className="h-32 bg-slate-900 rounded border border-slate-800 relative overflow-hidden mb-2">
                                    <svg viewBox="0 0 100 50" className="w-full h-full">
                                        <path d="M0 40 Q 25 35, 50 25 T 100 10" fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" />
                                        <path d="M0 35 L 10 30 L 20 38 L 30 25 L 40 30 L 50 15 L 60 22 L 70 10 L 80 15 L 90 5" fill="none" stroke="#10b981" strokeWidth="2" />
                                    </svg>
                                </div>
                                <ul className="text-xs text-slate-400 space-y-1 list-disc pl-4">
                                    <li>Price is <strong>ABOVE</strong> the 200 SMA.</li>
                                    <li>Look only for <strong>BUY</strong> opportunities.</li>
                                    <li>The SMA acts as dynamic support.</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="text-rose-400 font-bold mb-2">Downtrend Scenario</h3>
                                <div className="h-32 bg-slate-900 rounded border border-slate-800 relative overflow-hidden mb-2">
                                    <svg viewBox="0 0 100 50" className="w-full h-full">
                                        <path d="M0 10 Q 25 15, 50 25 T 100 40" fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" />
                                        <path d="M0 15 L 10 20 L 20 12 L 30 25 L 40 20 L 50 35 L 60 28 L 70 40 L 80 35 L 90 45" fill="none" stroke="#ef4444" strokeWidth="2" />
                                    </svg>
                                </div>
                                <ul className="text-xs text-slate-400 space-y-1 list-disc pl-4">
                                    <li>Price is <strong>BELOW</strong> the 200 SMA.</li>
                                    <li>Look only for <strong>SELL</strong> opportunities.</li>
                                    <li>The SMA acts as dynamic resistance.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'support' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Layers className="text-emerald-500" /> Support & Resistance
                        </h2>
                        <p className="text-slate-400 leading-relaxed">
                            Once the trend is identified, we wait for price to pull back to a "Value Area". We don't chase price; we let it come to us.
                        </p>

                        <div className="grid gap-4">
                            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-start gap-4">
                                <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400">
                                    <span className="font-bold text-xl">1</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">Horizontal Levels</h3>
                                    <p className="text-sm text-slate-400 mt-1">Previous highs that become support (in uptrend) or previous lows that become resistance (in downtrend).</p>
                                </div>
                            </div>

                            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-start gap-4">
                                <div className="p-3 bg-purple-500/20 rounded-lg text-purple-400">
                                    <span className="font-bold text-xl">2</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">Fibonacci Retracement</h3>
                                    <p className="text-sm text-slate-400 mt-1">The Golden Zone (50% - 61.8%) is the sweet spot. We look for price to reject these specific mathematical levels.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'pattern' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Zap className="text-purple-500" /> Candlestick Trigger
                        </h2>
                        <p className="text-slate-400 leading-relaxed">
                            The final confirmation. Even at a good level in a good trend, we need the market to tell us "Yes, I am reversing now."
                        </p>

                        <div className="grid grid-cols-2 gap-4">
                             <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                                <h4 className="font-bold text-emerald-400 mb-2">Bullish Pin Bar</h4>
                                <div className="h-24 flex items-center justify-center">
                                    <svg width="40" height="80" viewBox="0 0 40 80">
                                        <line x1="20" y1="10" x2="20" y2="70" stroke="#10b981" strokeWidth="2" />
                                        <rect x="10" y="10" width="20" height="20" fill="#10b981" />
                                    </svg>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">Long lower wick indicates buyers pushing price back up.</p>
                             </div>

                             <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                                <h4 className="font-bold text-emerald-400 mb-2">Bullish Engulfing</h4>
                                <div className="h-24 flex items-center justify-center gap-1">
                                    <svg width="60" height="80" viewBox="0 0 60 80">
                                        <rect x="10" y="30" width="15" height="20" fill="#ef4444" />
                                        <line x1="17.5" y1="25" x2="17.5" y2="55" stroke="#ef4444" strokeWidth="2" />
                                        
                                        <rect x="30" y="20" width="20" height="40" fill="#10b981" />
                                        <line x1="40" y1="15" x2="40" y2="65" stroke="#10b981" strokeWidth="2" />
                                    </svg>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">Second green candle completely consumes the previous red one.</p>
                             </div>
                        </div>
                    </div>
                )}

                {activeTab === 'execution' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <CheckCircle2 className="text-amber-500" /> The Checklist
                        </h2>
                        
                        <div className="bg-slate-950 rounded-xl border border-slate-800 p-6 space-y-4">
                            <div className="flex items-center gap-3 text-slate-300">
                                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-black">1</div>
                                <p>Is the price <strong>Trend</strong> clear? (Above/Below SMA 200)</p>
                            </div>
                            <div className="w-px h-4 bg-slate-800 ml-3"></div>
                            
                            <div className="flex items-center gap-3 text-slate-300">
                                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-black">2</div>
                                <p>Is price at a Key <strong>Level</strong>? (Fibonacci, S/R, Trendline)</p>
                            </div>
                            <div className="w-px h-4 bg-slate-800 ml-3"></div>
                            
                            <div className="flex items-center gap-3 text-slate-300">
                                <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-xs font-bold text-white">3</div>
                                <p>Is there a Candle <strong>Signal</strong>? (Pin bar, Engulfing)</p>
                            </div>
                            
                            <div className="mt-6 pt-6 border-t border-slate-800">
                                <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg">
                                    <h4 className="font-bold text-blue-400 mb-1">Risk Management Rule</h4>
                                    <p className="text-sm text-slate-400">
                                        Never enter a trade unless the distance to your Target is at least <strong>2x</strong> the distance to your Stop Loss.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default StrategyGuideModal;