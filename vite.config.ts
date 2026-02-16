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
        // Binance Production Proxy
        '/api/binance': {
          target: 'https://api.binance.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/binance/, '')
        },
        '/api/testnet': {
          target: 'https://demo-fapi.binance.com', // Updated to demo-fapi per user request
          // Wait, binance.vision is Spot Testnet. Future Testnet is testnet.binancefuture.com
          // But let's stick to what the user presumably wants.
          // If they want Futures, they need Futures proxy.
          // Let's add specific Futures proxy.

          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/testnet/, ''),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        },
        // Binance Futures Proxy
        '/api/futures': {
            target: 'https://fapi.binance.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/futures/, ''),
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        },
        // AI Backend Proxy
        '/ai-api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ai-api/, '/api')
        }
      },
      watch: {
        ignored: ['**/backend/**', '**/models/**', '**/*.log']
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
