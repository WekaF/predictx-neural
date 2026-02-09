
import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Activity, Clock, CheckCircle, XCircle } from 'lucide-react';

interface TrainingSession {
    id: string;
    created_at: string;
    symbol: string;
    epochs: number;
    final_loss: number | null;
    status: 'SUCCESS' | 'FAILED' | 'RUNNING';
    duration_seconds: number;
}

export const TrainingHistory: React.FC = () => {
    const [history, setHistory] = useState<TrainingSession[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = async () => {
        setLoading(true);
        if (!supabase) return;

        const { data, error } = await supabase
            .from('training_sessions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error("Error fetching training history:", error);
        } else {
            setHistory(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchHistory();
        
        // Realtime subscription
        if (!supabase) return;
        
        const channel = supabase
            .channel('training_sessions_changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'training_sessions' }, (payload) => {
                setHistory(prev => [payload.new as TrainingSession, ...prev]);
            })
            .subscribe();

        return () => {
             supabase.removeChannel(channel);
        };
    }, []);

    return (
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 backdrop-blur-md">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-purple-400" />
                    Cloud Training Logs
                </h3>
                <button onClick={fetchHistory} className="text-xs text-slate-400 hover:text-white">
                    Refresh
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-700/50">
                        <tr>
                            <th className="px-4 py-3 rounded-l-lg">Time</th>
                            <th className="px-4 py-3">Symbol</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Epochs</th>
                            <th className="px-4 py-3">Loss</th>
                            <th className="px-4 py-3 rounded-r-lg">Duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && history.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-4">Loading logs...</td></tr>
                        ) : history.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-4 text-slate-500">No training history found</td></tr>
                        ) : (
                            history.map((session) => (
                                <tr key={session.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                    <td className="px-4 py-3">
                                        {new Date(session.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-white">{session.symbol}</td>
                                    <td className="px-4 py-3">
                                        {session.status === 'SUCCESS' ? (
                                            <span className="flex items-center gap-1 text-green-400">
                                                <CheckCircle className="w-3 h-3" /> Success
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-red-400">
                                                <XCircle className="w-3 h-3" /> Failed
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">{session.epochs}</td>
                                    <td className="px-4 py-3 font-mono text-blue-300">
                                        {session.final_loss?.toFixed(6) ?? '-'}
                                    </td>
                                    <td className="px-4 py-3 flex items-center gap-1 text-slate-400">
                                        <Clock className="w-3 h-3" />
                                        {session.duration_seconds?.toFixed(1)}s
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
