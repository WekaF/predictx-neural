import axios from 'axios';

const API_URL = '/ai-api';

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
            // Optimization: Only send last 60 candles (LSTM seq_length) + buffer
            const payloadCandles = candles.slice(-100); 
            
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
