# 🚀 Railway Deployment Guide - Step by Step

## Prerequisites
- GitHub account
- Railway account (sign up at https://railway.app with GitHub)
- Your Binance API keys ready

## Step 1: Prepare Repository

### 1.1 Commit Backend Changes
```bash
cd /Users/weka/Learning/predictx
git add backend/
git commit -m "Add Railway deployment config"
git push origin main
```

## Step 2: Deploy to Railway

### 2.1 Create New Project
1. Go to https://railway.app/dashboard
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose repository: `predictx`
5. Click **"Deploy Now"**

### 2.2 Configure Root Directory
Railway will auto-detect the backend, but to be sure:
1. Click on your service
2. Go to **Settings** tab
3. Under **"Build"** section:
   - Root Directory: `backend`
   - Build Command: (leave empty, auto-detected)
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### 2.3 Add Environment Variables
1. Go to **Variables** tab
2. Click **"+ New Variable"**
3. Add the following (one by one):

**IMPORTANT: Do NOT use quotes around the values in Railway!**

```
VITE_BINANCE_API_KEY=EiSshYqMAqS095otRLQN76S5cKSoBcn25Ebb21ITCVxk3quckwxQJLdddqxEExBS
VITE_BINANCE_SECRET_KEY=dpNDgnE3ZfscTMKpBuru9vguzmsNY8xw8J1NGLD8VLS78WQyEKRdrNS6C7irwIJ3
VITE_BINANCE_API_KEY_TESTNET=WaBJscL1raLkhUB2KcyyiTxNguObcqeWYELLeTxkXvVZbJpygUxYQuvgbl9HQEjK
VITE_BINANCE_API_SECRET_TESTNET=E0FGnI6a4NV5e16w5vrYgmrn2I2Asw57qS9lHLFZ1B9JgVvEEKMJ91rfCvIDYqeJ
```

**Example:**
- ❌ Wrong: `VITE_BINANCE_API_KEY="your_key_here"` (has quotes)
- ✅ Correct: `VITE_BINANCE_API_KEY=your_key_here` (no quotes)

**Note:** Replace the values above with your actual API keys from Binance.

### 2.4 Get Deployment URL
1. After deployment completes (2-3 minutes)
2. Go to **Settings** tab
3. Under **"Domains"** section, you'll see:
   - Default: `predictx-backend-production.up.railway.app`
4. **Copy this URL** - you'll need it for Step 3

**Test the backend:**
Open browser: `https://your-backend-url.up.railway.app/health`
Should return: `{"status": "healthy"}`

## Step 3: Update Frontend to Use Railway Backend

### 3.1 Add Environment Variable to Vercel
1. Go to Vercel Dashboard
2. Select your `predictx` project
3. Go to **Settings** → **Environment Variables**
4. Add new variable:
   - Name: `VITE_BACKEND_URL`
   - Value: `https://your-backend-url.up.railway.app`
   - Environment: **Production**
5. Click **Save**

### 3.2 Update Frontend Code
Edit `services/binanceTradingService.ts`:

```typescript
function getApiBase(): string {
    const isDev = import.meta.env.DEV;
    const isProduction = import.meta.env.PROD;
    
    try {
        const settings = localStorage.getItem('neurotrade_settings');
        const useTestnet = settings ? JSON.parse(settings).useTestnet : true;
        
        if (useTestnet) {
            console.log('[Binance Trading] 🧪 Using TESTNET mode');
            
            // In production, use Railway backend proxy
            if (isProduction) {
                const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://your-backend-url.up.railway.app';
                console.log('[Binance Trading] 📡 Production: Using Railway Backend');
                return `${backendUrl}/ai-api/proxy`;
            }
            
            // In development, use local backend proxy
            return '/ai-api/proxy';
        }
    } catch (e) {
        console.warn('[Binance Trading] Failed to read testnet setting, using production');
    }
    
    // Production mode: Use Railway backend for production API too
    if (isProduction) {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://your-backend-url.up.railway.app';
        console.log('[Binance Trading] 📡 Production: Using Railway Backend');
        return `${backendUrl}/ai-api/proxy`;
    }
    
    // Development: Use local Vite proxy
    return '/ai-api/proxy';
}
```

### 3.3 Deploy Frontend
```bash
git add services/binanceTradingService.ts
git commit -m "Connect frontend to Railway backend"
git push origin main
```

Vercel will auto-deploy (or trigger manual deploy).

## Step 4: Test Production

1. **Open Production App**: `https://predictx-neural.vercel.app`
2. **Open Browser Console** (F12)
3. **Look for logs**:
   - Should see: `[Binance Trading] 📡 Production: Using Railway Backend`
   - Should NOT see: "All connection attempts failed"
4. **Try placing a testnet trade**
5. **Check active trade persists after refresh**

## Troubleshooting

### Error: "502 Bad Gateway"
- Backend is down or starting up
- Wait 30 seconds and refresh
- Check Railway logs: Dashboard → Service → Deployments → Logs

### Error: "CORS policy"
- Check `main.py` has your Vercel domain in `origins` list
- Should include: `"https://predictx-neural.vercel.app"`

### Error: "Unauthorized" or "Invalid API key"
- Check environment variables in Railway
- Make sure keys are correct (no extra spaces)
- Restart Railway service: Settings → Restart

### Backend won't start
- Check Railway logs for Python errors
- Common issue: Missing dependencies in `requirements.txt`
- Check Python version: Should be 3.11

## Cost

**Railway Free Tier:**
- $5 free credit per month
- Enough for ~500 hours of runtime
- Perfect for personal projects

**If you exceed free tier:**
- Upgrade to Hobby plan: $5/month
- Or use Render.com free tier (alternative)

## Success Checklist

- ✅ Backend deployed to Railway
- ✅ Backend URL accessible (test `/health` endpoint)
- ✅ Environment variables set in Railway
- ✅ Frontend updated with `VITE_BACKEND_URL`
- ✅ Frontend deployed to Vercel
- ✅ Production app works without CORS errors
- ✅ Active trades persist after refresh

## Next Steps

After successful deployment:
1. Test with small testnet trades first
2. Monitor Railway logs for any errors
3. Set up alerts in Railway (optional)
4. Consider upgrading to paid plan if needed

## Support

If you encounter issues:
1. Check Railway logs first
2. Check browser console for frontend errors
3. Verify all environment variables are set correctly
4. Test backend directly: `https://your-backend-url/health`
