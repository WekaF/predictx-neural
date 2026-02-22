import axios from 'axios';

// In development, use /ai-api which Vite proxies to localhost:8000/api
// In production, use VITE_AI_BACKEND_URL (e.g. https://...railway.app/api)
const API_URL = import.meta.env.DEV ? '/ai-api' : (import.meta.env.VITE_AI_BACKEND_URL || '/ai-api');

export interface TrainingResponse {
    status: 'success' | 'error';
    message: string;
    final_loss: number;
    epochs: number;
}

export const aiBackendService = {
    /**
     * Trigger LSTM Model Training
     */
    async trainModel(symbol: string = 'BTC-USD', epochs: number = 10): Promise<TrainingResponse> {
        try {
            const response = await axios.post(`${API_URL}/train`, null, {
                params: { symbol, epochs }
            });
            return response.data;
        } catch (error: any) {
            console.error('[AI Backend] Training Error:', error);
            return {
                status: 'error',
                message: error.response?.data?.detail || error.message || 'Unknown error',
                final_loss: 0,
                epochs: 0
            };
        }
    },

    /**
     * Get AI Prediction (Trend + Action)
     */
    async predictTrend(symbol: string, candles: any[]): Promise<any> {
        try {
            // Optimization: Send last 250 candles to fulfill ai_engine requirements (EMA200 + Seq60)
            const payloadCandles = candles.slice(-250); 
            
            const response = await axios.post(`${API_URL}/predict`, {
                symbol,
                candles: payloadCandles
            });
            return response.data;
        } catch (error: any) {
            console.warn('[AI Backend] Prediction failed, falling back to local model:', error.message);
            return null;
        }
    },

    /**
     * Check Backend Health
     */
    async checkHealth(): Promise<boolean> {
        try {
            await axios.get(`${API_URL.replace('/api', '')}/health`);
            return true;
        } catch (e) {
            return false;
        }
    }
};
