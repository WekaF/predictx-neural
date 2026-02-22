import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, AlertCircle, Loader, X, Clock } from 'lucide-react';

interface ModelStatus {
  trained: boolean;
  path: string;
}

interface TrainingJob {
  job_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  logs: string[];
  error?: string;
  model: string;
}

const TrainingDashboard: React.FC = () => {
  const [modelStatus, setModelStatus] = useState<{
    lstm?: ModelStatus;
    cnn?: ModelStatus;
    rl?: ModelStatus;
  }>({});
  
  const [activeJobs, setActiveJobs] = useState<{ [key: string]: TrainingJob }>({});
  const [loading, setLoading] = useState(false);
  const [autoTraining, setAutoTraining] = useState(false);
  const [nextRun, setNextRun] = useState<string | null>(null);

  const API_BASE = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/api`;

  // Fetch model status on mount
  // Fetch model status and active jobs on mount
  useEffect(() => {
    fetchModelStatus();
    fetchScheduleStatus();
    fetchActiveJobs();
  }, []);

  // Poll active jobs
  useEffect(() => {
    const jobIds = Object.keys(activeJobs);
    if (jobIds.length === 0) return;

    const interval = setInterval(() => {
      jobIds.forEach(jobId => {
        if (activeJobs[jobId].status === 'running' || activeJobs[jobId].status === 'pending') {
          fetchJobStatus(jobId);
        }
      });
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [activeJobs]);

  const fetchModelStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/training/models`);
      const data = await res.json();
      setModelStatus(data);
    } catch (error) {
      console.error('Failed to fetch model status:', error);
    }
  };

  const fetchActiveJobs = async () => {
    try {
      const res = await fetch(`${API_BASE}/training/jobs`);
      const data = await res.json();
      // Only set if we actually have jobs to avoid wiping state if error
      if (data && typeof data === 'object') {
          setActiveJobs(data);
      }
    } catch (error) {
      console.error('Failed to fetch active jobs:', error);
    }
  };

  const fetchScheduleStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/training/schedule/status`);
      const data = await res.json();
      // Use job_scheduled to determine if auto-training is active, not just if scheduler is running
      setAutoTraining(data.job_scheduled);
      if (data.next_run) {
        setNextRun(new Date(data.next_run).toLocaleString());
      } else {
        setNextRun(null);
      }
    } catch (error) {
      console.error('Failed to fetch schedule status:', error);
    }
  };

  const toggleAutoTraining = async () => {
    try {
      if (autoTraining) {
        await fetch(`${API_BASE}/training/schedule/stop`, { method: 'POST' });
        setAutoTraining(false);
        setNextRun(null);
      } else {
        const res = await fetch(`${API_BASE}/training/schedule?interval_hours=24`, { method: 'POST' });
        await fetchScheduleStatus();
      }
    } catch (error) {
      console.error('Failed to toggle auto training:', error);
    }
  };

  const fetchJobStatus = async (jobId: string) => {
    try {
      const res = await fetch(`${API_BASE}/training/status/${jobId}`);
      const data = await res.json();
      
      setActiveJobs(prev => ({
        ...prev,
        [jobId]: data
      }));

      // Refresh model status when job completes
      if (data.status === 'completed') {
        fetchModelStatus();
      }
    } catch (error) {
      console.error('Failed to fetch job status:', error);
    }
  };

  const startTraining = async (modelType: 'lstm' | 'cnn' | 'rl') => {
    setLoading(true);
    try {
      const endpoints = {
        lstm: '/training/lstm',
        cnn: '/training/cnn',
        rl: '/training/rl'
      };

      const res = await fetch(`${API_BASE}${endpoints[modelType]}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTC-USD',
          epochs: modelType === 'lstm' ? 50 : undefined,
          interval: '1h'
        })
      });

      const data = await res.json();
      
      // Add to active jobs
      setActiveJobs(prev => ({
        ...prev,
        [data.job_id]: {
          job_id: data.job_id,
          status: 'pending',
          progress: 0,
          logs: [],
          model: modelType.toUpperCase()
        }
      }));

    } catch (error) {
      console.error('Failed to start training:', error);
      alert('Failed to start training. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const ModelCard = ({ 
    title, 
    modelKey, 
    description, 
    estimatedTime 
  }: { 
    title: string; 
    modelKey: 'lstm' | 'cnn' | 'rl'; 
    description: string;
    estimatedTime: string;
  }) => {
    const isTrained = modelStatus[modelKey]?.trained;
    const activeJob = (Object.values(activeJobs) as TrainingJob[]).find(job => job.model === modelKey.toUpperCase());

    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              {title}
              {isTrained && <CheckCircle className="w-5 h-5 text-green-500" />}
              {!isTrained && <AlertCircle className="w-5 h-5 text-yellow-500" />}
            </h3>
            <p className="text-sm text-gray-400 mt-1">{description}</p>
            <p className="text-xs text-gray-500 mt-1">Est. time: {estimatedTime}</p>
          </div>
          
          {!activeJob && (
            <button
              onClick={() => startTraining(modelKey)}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="w-4 h-4" />
              Train
            </button>
          )}
        </div>

        {/* Training Progress */}
        {activeJob && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">
                {activeJob.status === 'running' && <Loader className="inline w-4 h-4 animate-spin mr-2" />}
                {activeJob.status === 'completed' && <CheckCircle className="inline w-4 h-4 text-green-500 mr-2" />}
                {activeJob.status === 'failed' && <X className="inline w-4 h-4 text-red-500 mr-2" />}
                {activeJob.status.charAt(0).toUpperCase() + activeJob.status.slice(1)}
              </span>
              <span className="text-gray-400">{Math.round(activeJob.progress)}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  activeJob.status === 'completed' ? 'bg-green-500' :
                  activeJob.status === 'failed' ? 'bg-red-500' :
                  'bg-blue-500'
                }`}
                style={{ width: `${activeJob.progress}%` }}
              />
            </div>

            {/* Logs */}
            {activeJob.logs.length > 0 && (
              <div className="bg-gray-900 rounded p-3 max-h-32 overflow-y-auto">
                {activeJob.logs.slice(-5).map((log, idx) => (
                  <div key={idx} className="text-xs text-gray-300 font-mono">
                    {log}
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {activeJob.error && (
              <div className="bg-red-900/20 border border-red-500 rounded p-3 text-sm text-red-400">
                {activeJob.error}
              </div>
            )}
          </div>
        )}

        {/* Status Badge */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Status:</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              isTrained ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'
            }`}>
              {isTrained ? 'Trained' : 'Not Trained'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">AI Training Dashboard</h1>
          <p className="text-gray-400">Train and manage your Trinity AI models</p>
        </div>
        
        {/* Auto Training Toggle */}
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex items-center gap-4 shadow-lg">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-blue-400 font-semibold">
              <Clock className="w-5 h-5" />
              <span>Auto Training (24h)</span>
            </div>
            <span className="text-xs text-gray-500 mt-1">
              {nextRun ? `Next run: ${nextRun}` : 'Schedule inactive'}
            </span>
          </div>
          
          <button
            onClick={toggleAutoTraining}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
              autoTraining ? 'bg-blue-600' : 'bg-gray-600'
            }`}
          >
            <span className="sr-only">Enable Auto Training</span>
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                autoTraining ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ModelCard
          title="LSTM (Tier 5)"
          modelKey="lstm"
          description="Trend prediction using time series analysis"
          estimatedTime="3-5 minutes"
        />
        
        <ModelCard
          title="CNN (Tier 7)"
          modelKey="cnn"
          description="Pattern recognition from candlestick charts"
          estimatedTime="10-15 minutes"
        />
        
        <ModelCard
          title="RL Agent (Tier 6)"
          modelKey="rl"
          description="Strategic decision making with PPO"
          estimatedTime="15-20 minutes"
        />
      </div>

      {/* Info Box */}
      <div className="mt-8 bg-blue-900/20 border border-blue-500 rounded-lg p-4">
        <h3 className="text-blue-400 font-semibold mb-2">ℹ️ Training Tips</h3>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• Train models in order: LSTM → CNN → RL for best results</li>
          <li>• Training runs in the background - you can continue using the app</li>
          <li>• Make sure you have a stable internet connection for data fetching</li>
          <li>• RL Agent requires LSTM to be trained first</li>
        </ul>
      </div>
    </div>
  );
};

export default TrainingDashboard;
