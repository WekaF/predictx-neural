# Production Deployment Guide

## Problem: CORS in Production

Binance Futures API **does not support CORS** for authenticated requests from browsers. This means:
- ✅ **Development (localhost)**: Works fine using local backend proxy
- ❌ **Production (Vercel/Netlify)**: Direct API calls will fail with CORS errors

## Solutions

### Option 1: Deploy Backend Proxy (Recommended for Live Trading)

Deploy the Python backend (`backend/main.py`) to a serverless platform:

#### A. Deploy to Railway.app (Free Tier Available)

1. **Create Railway Account**: https://railway.app
2. **New Project** → **Deploy from GitHub**
3. **Select Repository**: `predictx`
4. **Root Directory**: Set to `backend`
5. **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. **Environment Variables**:
   ```
   VITE_BINANCE_API_KEY=your_production_key
   VITE_BINANCE_SECRET_KEY=your_production_secret
   VITE_BINANCE_API_KEY_TESTNET=your_testnet_key
   VITE_BINANCE_API_SECRET_TESTNET=your_testnet_secret
   ```
7. **Get Deployment URL**: e.g., `https://predictx-backend.up.railway.app`

#### B. Update Frontend to Use Deployed Backend

In `services/binanceTradingService.ts`, update `getApiBase()`:

```typescript
function getApiBase(): string {
    const isProduction = import.meta.env.PROD;
    
    if (isProduction) {
        // Use deployed backend proxy
        return 'https://your-backend.up.railway.app/api/proxy';
    }
    
    // Development: Use local backend
    return '/ai-api/proxy';
}
```

#### C. Alternative: Render.com

1. **Create Render Account**: https://render.com
2. **New Web Service** → **Connect GitHub**
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. **Environment**: Python 3.11+
6. **Add Environment Variables** (same as above)

### Option 2: Use Paper Trading Mode (Quick Fix)

If you don't need live trading in production:

1. **Force Paper Trading** in production builds
2. **Edit** `App.tsx`:

```typescript
useEffect(() => {
  const isProduction = import.meta.env.PROD;
  if (isProduction) {
    setTradingMode('paper');
    localStorage.setItem('neurotrade_trading_mode', 'paper');
  }
}, []);
```

3. **Paper Trading** doesn't require Binance API, so no CORS issues

### Option 3: Serverless Backend on Vercel

Deploy backend as Vercel Serverless Functions:

1. **Create** `api/proxy.py` in root:
```python
from backend.main import app

# Vercel serverless handler
def handler(request, context):
    return app(request, context)
```

2. **Update** `vercel.json`:
```json
{
  "rewrites": [
    { "source": "/api/proxy/(.*)", "destination": "/api/proxy" }
  ]
}
```

3. **Install Python runtime** in Vercel project settings

## Recommended Approach

For **production live trading**:
1. Deploy backend to Railway (easiest, free tier)
2. Update `BACKEND_URL` environment variable in Vercel
3. Test with testnet first

For **demo/portfolio project**:
- Use Paper Trading mode (no backend needed)
- Add disclaimer: "Live trading requires backend deployment"

## Testing

After deployment:
1. Open browser console (F12)
2. Look for `[Binance Trading]` logs
3. Should see: `📡 Production: Using Backend Proxy at https://...`
4. Test with small testnet trade first

## Troubleshooting

**Error: "All connection attempts failed"**
- ✅ Check backend is deployed and running
- ✅ Verify environment variables are set
- ✅ Check CORS settings in backend allow your frontend domain
- ✅ Try Paper Trading mode as fallback

**Error: "Endpoint not found (served HTML)"**
- ❌ Backend not deployed or URL incorrect
- ✅ Update `getApiBase()` with correct backend URL
