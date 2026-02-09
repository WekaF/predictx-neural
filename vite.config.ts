import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'https://api1.binance.com', // Using api1 as fallback for main domain blocks
          changeOrigin: true
          // rewrite removed: we want to pass /api to the target
        }
      }
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        // Fix for recharts issue with react-is
        'react-is': path.resolve(__dirname, 'node_modules/react-is') 
      }
    },
    optimizeDeps: {
      include: ['react-is'] 
    }
  };
});
