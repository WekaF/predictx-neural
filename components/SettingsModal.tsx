import React, { useState, useEffect } from 'react';
import { X, Save, Globe, Zap, CheckCircle2, AlertTriangle, RefreshCcw, ShieldCheck, ArrowRightLeft, EyeOff, Info, Copy, Terminal, Brain, Database } from 'lucide-react';
import { storageService } from '../services/storageService';
import { testWebhook } from '../services/webhookService';
import { trainFromSavedHistory } from '../services/mlService';

interface SettingsModalProps {
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
    const [webhookUrl, setWebhookUrl] = useState('');
    const [webhookMethod, setWebhookMethod] = useState<'POST' | 'GET'>('POST');
    const [enabled, setEnabled] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'warning' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [usingProxy, setUsingProxy] = useState(false);
    const [isBlindMode, setIsBlindMode] = useState(false);
    const [testEventType, setTestEventType] = useState<'SIGNAL_ENTRY' | 'TAKE_PROFIT' | 'STOP_LOSS'>('SIGNAL_ENTRY');

    // AI Training State
    const [isTrainingHistory, setIsTrainingHistory] = useState(false);
    const [historyTrainingCount, setHistoryTrainingCount] = useState<number | null>(null);

    const DEFAULT_URL = 'https://weka.app.n8n.cloud/webhook/trading-webhook';

    // Detect n8n test URL
    const isN8nTestUrl = webhookUrl.includes('webhook-test');

    useEffect(() => {
        const settings = storageService.getSettings();
        setWebhookUrl(settings.webhookUrl);
        setWebhookMethod(settings.webhookMethod);
        setEnabled(settings.enableNotifications);
    }, []);

    const handleSave = () => {
        storageService.saveSettings({
            webhookUrl,
            webhookMethod,
            enableNotifications: enabled
        });
        onClose();
    };

    const handleUrlChange = (val: string) => {
        setWebhookUrl(val);
        if (val.length > 10 && !enabled) {
            setEnabled(true);
        }
    };

    const handleReset = () => {
        setWebhookUrl(DEFAULT_URL);
    };

    const handleTest = async () => {
        if (!webhookUrl) return;
        setIsTesting(true);
        setTestStatus('idle');
        setErrorMessage('');
        setUsingProxy(false);
        setIsBlindMode(false);

        const result = await testWebhook(webhookUrl, webhookMethod, testEventType);

        if (result.success) {
            if (result.warning) {
                setTestStatus('warning');
                setIsBlindMode(true);
                setErrorMessage(result.warning);
            } else {
                setTestStatus('success');
                if (result.usedProxy) setUsingProxy(true);
            }
        } else {
            setTestStatus('error');
            setErrorMessage(result.error || 'Unknown Error');
        }
        setIsTesting(false);
    };

    const handleHistoryTrain = async () => {
        setIsTrainingHistory(true);
        const count = await trainFromSavedHistory();
        setHistoryTrainingCount(count);
        setIsTrainingHistory(false);

        // Auto-clear message after 5 seconds
        setTimeout(() => setHistoryTrainingCount(null), 5000);
    };

    const copyToClipboard = (text: string) => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text);
            } else {
                // Fallback for non-secure contexts (if needed) or just alert
                alert("Copying to clipboard is restricted in this environment. Please copy the code manually.");
            }
        } catch (e) {
            console.error("Clipboard copy failed", e);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">

                {/* Help / Instructions Sidebar */}
                <div className="w-full md:w-1/3 bg-slate-950 p-6 border-r border-slate-800 hidden md:block overflow-y-auto">
                    <h4 className="text-emerald-400 font-bold mb-4 flex items-center gap-2">
                        <Zap className="w-4 h-4" /> Connectivity Help
                    </h4>
                    <div className="space-y-4 text-xs text-slate-400 leading-relaxed">
                        <div>
                            <strong className="text-white block mb-1">N8N "Failed to Fetch"?</strong>
                            <p>If using a <code>webhook-test</code> URL, you <strong>MUST</strong> click <em>"Listen for Test Event"</em> in n8n immediately before sending the test. These URLs expire quickly.</p>
                        </div>
                        <div>
                            <strong className="text-white block mb-1">What is Blind Mode?</strong>
                            <p>If direct access is blocked (CORS), we send data as <code>text/plain</code>. In n8n, you might need to parse this string manually if it doesn't auto-detect JSON.</p>
                        </div>
                        <div>
                            <strong className="text-white block mb-1">Production Tip</strong>
                            <p>For stable 24/7 automation, Activate your n8n workflow and use the <strong>Production URL</strong> (not the test URL).</p>
                        </div>
                    </div>
                </div>

                {/* Form Content */}
                <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-center p-4 border-b border-slate-800">
                        <h3 className="text-white font-bold flex items-center gap-2">
                            <Globe className="w-5 h-5 text-blue-400" /> Automation Configuration
                        </h3>
                        <button onClick={onClose} className="text-slate-400 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                        {/* AI Maintenance Section */}
                        <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-800">
                            <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                <Brain className="w-4 h-4 text-violet-400" /> AI Model Maintenance
                            </h4>
                            <div className="flex flex-col gap-3">
                                <p className="text-xs text-slate-400">
                                    Restore pattern memory from historical training data stored in Supabase.
                                    Use this if confidence drops or after clearing browser cache.
                                </p>
                                <button
                                    onClick={handleHistoryTrain}
                                    disabled={isTrainingHistory}
                                    className="flex items-center justify-center gap-2 px-4 py-3 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/50 rounded text-sm text-center text-violet-300 transition-all font-bold"
                                >
                                    {isTrainingHistory ? (
                                        <>
                                            <RefreshCcw className="w-4 h-4 animate-spin" /> Restoring Memory...
                                        </>
                                    ) : (
                                        <>
                                            <Database className="w-4 h-4" /> Restore from History
                                        </>
                                    )}
                                </button>
                                {historyTrainingCount !== null && (
                                    <div className="text-xs text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/20 flex items-center gap-2 animate-in fade-in">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Successfully restored {historyTrainingCount} historical patterns!
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-800">
                            <div className="flex items-center justify-between mb-4">
                                <label className="text-sm font-bold text-white">Enable Notifications</label>
                                <button
                                    onClick={() => setEnabled(!enabled)}
                                    className={`w-10 h-5 rounded-full transition-colors relative ${enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${enabled ? 'translate-x-5' : ''}`}></div>
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* URL Input */}
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Webhook URL</label>
                                        <button onClick={handleReset} className="text-[10px] text-blue-400 hover:underline flex items-center gap-1">
                                            <RefreshCcw className="w-3 h-3" /> Reset to n8n Default
                                        </button>
                                    </div>

                                    <div className="relative">
                                        <Globe className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                                        <input
                                            type="text"
                                            value={webhookUrl}
                                            onChange={(e) => handleUrlChange(e.target.value)}
                                            placeholder="https://your-n8n-instance.com/webhook/..."
                                            className={`w-full bg-slate-900 border rounded pl-9 pr-2 py-2 text-sm text-white focus:border-blue-500 outline-none ${isN8nTestUrl ? 'border-amber-500/50' : 'border-slate-700'}`}
                                        />
                                    </div>
                                    {isN8nTestUrl && (
                                        <div className="flex items-start gap-2 text-[10px] text-amber-400 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                                            <Info className="w-3 h-3 mt-0.5 shrink-0" />
                                            <span>
                                                <strong>Test Mode:</strong> Click <strong>"Listen"</strong> in n8n right before sending, or this will fail.
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Method Selector */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">HTTP Method</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setWebhookMethod('POST')}
                                            className={`py-2 rounded text-xs font-bold border transition-colors ${webhookMethod === 'POST' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-700 text-slate-500 hover:bg-slate-800'}`}
                                        >
                                            POST (JSON Body)
                                        </button>
                                        <button
                                            onClick={() => setWebhookMethod('GET')}
                                            className={`py-2 rounded text-xs font-bold border transition-colors ${webhookMethod === 'GET' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-700 text-slate-500 hover:bg-slate-800'}`}
                                        >
                                            GET (Query Params)
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-slate-700/50">
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Simulation Mode</label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <select
                                        value={testEventType}
                                        onChange={(e) => setTestEventType(e.target.value as any)}
                                        className="bg-slate-900 border border-slate-700 rounded px-2 py-2 text-xs text-white outline-none focus:border-blue-500"
                                    >
                                        <option value="SIGNAL_ENTRY">New Trade Signal</option>
                                        <option value="TAKE_PROFIT">Take Profit Hit</option>
                                        <option value="STOP_LOSS">Stop Loss Hit</option>
                                    </select>

                                    <button
                                        onClick={handleTest}
                                        disabled={isTesting || !webhookUrl}
                                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white border border-blue-500 transition-colors font-bold shadow-lg shadow-blue-900/20"
                                    >
                                        {isTesting ? 'Sending...' : 'Send Test Payload'}
                                    </button>
                                </div>

                                <div className="mt-3 min-h-[20px]">
                                    {testStatus === 'success' && (
                                        <div className="space-y-1">
                                            <span className="text-xs text-emerald-400 flex items-center gap-1 font-bold animate-in fade-in">
                                                <CheckCircle2 className="w-4 h-4" /> Payload Sent!
                                            </span>
                                            {usingProxy && (
                                                <span className="text-[10px] text-yellow-500 flex items-center gap-1 animate-in fade-in">
                                                    <ShieldCheck className="w-3 h-3" /> Used CORS Proxy fallback
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {testStatus === 'warning' && (
                                        <div className="space-y-2 animate-in fade-in">
                                            <div className="flex items-start gap-2 text-amber-400">
                                                <EyeOff className="w-4 h-4 mt-0.5 shrink-0" />
                                                <div>
                                                    <span className="text-xs font-bold block">Sent via Blind Mode</span>
                                                    <p className="text-[10px] text-slate-400 leading-tight">
                                                        {errorMessage}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* N8N FIX TIP */}
                                            <div className="bg-slate-950 p-3 rounded border border-slate-800 mt-2">
                                                <div className="flex items-center gap-2 mb-2 text-blue-400">
                                                    <Terminal className="w-3 h-3" />
                                                    <span className="text-[10px] font-bold uppercase">N8N Fix: Parse String Data</span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 mb-2">
                                                    Because CORS blocked JSON, n8n receives a string. Add a <strong>Code Node</strong> after your Webhook to fix it:
                                                </p>
                                                <div className="bg-black/50 p-2 rounded border border-slate-800 flex justify-between items-center group">
                                                    <code className="text-[10px] font-mono text-emerald-300 break-all">
                                                        return JSON.parse(items[0].json.body);
                                                    </code>
                                                    <button
                                                        onClick={() => copyToClipboard('return JSON.parse(items[0].json.body);')}
                                                        className="text-slate-500 hover:text-white"
                                                        title="Copy Code"
                                                    >
                                                        <Copy className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {testStatus === 'error' && (
                                        <div className="flex flex-col gap-1 animate-in fade-in">
                                            <span className="text-xs text-rose-400 flex items-center gap-1 font-bold">
                                                <AlertTriangle className="w-4 h-4" /> Failed: {errorMessage}
                                            </span>
                                            <span className="text-[10px] text-slate-500">
                                                {errorMessage.includes('Direct') ? 'Possible Issues: Ad-Blocker, Expired Test URL, or N8N offline.' : 'All connection attempts failed.'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-slate-800 bg-slate-900">
                        <button
                            onClick={handleSave}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                        >
                            <Save className="w-4 h-4" /> Save Configuration
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;