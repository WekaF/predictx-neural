# 🚀 Panduan Deployment PredictX

Panduan lengkap untuk deploy aplikasi PredictX ke Vercel dengan CI/CD otomatis menggunakan GitHub Actions.

## 📋 Prerequisites

- [x] Akun GitHub (gratis)
- [x] Akun Vercel (gratis) - [Sign up di sini](https://vercel.com/signup)
- [x] Git terinstall di komputer

## 🎯 Quick Start (5 Menit Setup)

### 1. Setup GitHub Repository

```bash
# Pastikan sudah di folder project
cd /Users/weka/Learning/predictx

# Add semua files (Git sudah di-init)
git add .

# Commit pertama
git commit -m "Initial commit - PredictX app"

# Create repository di GitHub (via web atau CLI)
# Kemudian push:
git remote add origin https://github.com/USERNAME/predictx.git
git branch -M main
git push -u origin main
```

### 2. Deploy ke Vercel (Via Dashboard)

1. **Login ke Vercel**: https://vercel.com
2. **Import Project**: 
   - Klik "Add New Project"
   - Pilih repository GitHub Anda (predictx)
   - Klik "Import"

3. **Configure Project**:
   - Framework Preset: **Vite** (auto-detected)
   - Build Command: `npm run build` (auto-filled)
   - Output Directory: `dist` (auto-filled)
   
4. **Add Environment Variables** (PENTING!):
   ```
   GEMINI_API_KEY = your_gemini_api_key
   VITE_SUPABASE_URL = your_supabase_url
   VITE_SUPABASE_ANON_KEY = your_supabase_anon_key
   ```
   
   > 💡 Copy dari file `.env.local` Anda

5. **Deploy**: Klik "Deploy" dan tunggu ~2 menit

6. **Done!** 🎉 Aplikasi Anda live di: `https://predictx-xxx.vercel.app`

---

## 🔄 Setup CI/CD (Auto-Deploy)

Setelah deploy pertama, setup CI/CD agar setiap push otomatis deploy:

### 1. Get Vercel Tokens

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project (di folder project)
vercel link

# Get project info
vercel project ls
```

Atau via Vercel Dashboard:
- **Vercel Token**: Settings → Tokens → Create Token
- **Org ID & Project ID**: Settings → General (scroll bawah)

### 2. Add GitHub Secrets

Di GitHub repository Anda:
1. Go to: **Settings** → **Secrets and variables** → **Actions**
2. Klik **New repository secret**
3. Tambahkan secrets berikut:

| Secret Name | Value | Cara Dapat |
|-------------|-------|------------|
| `VERCEL_TOKEN` | `xxx...` | Vercel → Settings → Tokens |
| `VERCEL_ORG_ID` | `team_xxx` | Vercel → Settings → General |
| `VERCEL_PROJECT_ID` | `prj_xxx` | Vercel → Settings → General |
| `GEMINI_API_KEY` | `AIza...` | Google AI Studio |
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase Dashboard |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Supabase Dashboard |

### 3. Test Auto-Deploy

```bash
# Make a small change
echo "# Test" >> README.md

# Commit & push
git add .
git commit -m "Test auto-deploy"
git push

# GitHub Actions akan otomatis:
# ✓ Build project
# ✓ Run tests (jika ada)
# ✓ Deploy ke Vercel
# ✓ Notify jika ada error
```

Check progress di: **GitHub → Actions tab**

---

## 🔧 Workflow Update Sehari-hari

Setelah setup selesai, update aplikasi jadi super mudah:

```bash
# 1. Edit code sesuka hati
# 2. Commit changes
git add .
git commit -m "Add new feature X"

# 3. Push - DONE! Auto-deploy 🚀
git push
```

**Vercel otomatis akan:**
- ✅ Detect perubahan
- ✅ Build aplikasi
- ✅ Deploy ke production
- ✅ Email notifikasi (sukses/gagal)

**Timeline:**
- Push → 10 detik: Build mulai
- 1-2 menit: Build selesai
- 2-3 menit: Live di production!

---

## 🌿 Branch Strategy (Recommended)

Untuk development yang lebih aman:

```bash
# Create feature branch
git checkout -b feature/new-ai-model

# Work on feature...
git add .
git commit -m "Implement new AI model"

# Push feature branch
git push origin feature/new-ai-model

# Create Pull Request di GitHub
# Vercel akan create PREVIEW deployment!
# URL: https://predictx-git-feature-xxx.vercel.app

# Setelah review OK, merge ke main
# Auto-deploy ke production!
```

**Benefits:**
- 🔍 Preview setiap perubahan sebelum production
- 🛡️ Production tetap stabil
- 👥 Team bisa review changes

---

## 🔐 Environment Variables Management

### Update Environment Variables

**Via Vercel Dashboard:**
1. Vercel → Project → Settings → Environment Variables
2. Edit/Add variable
3. Klik "Save"
4. **Redeploy** (Settings → Deployments → Latest → ⋯ → Redeploy)

**Via CLI:**
```bash
vercel env add GEMINI_API_KEY production
# Paste value when prompted

# Redeploy
vercel --prod
```

### Local Development

File `.env.local` untuk local development:
```env
GEMINI_API_KEY=your_key_here
VITE_SUPABASE_URL=your_url_here
VITE_SUPABASE_ANON_KEY=your_key_here
```

> ⚠️ **JANGAN commit file ini!** Sudah ada di `.gitignore`

---

## 🐛 Troubleshooting

### Build Failed

**Check logs:**
```bash
# Via CLI
vercel logs

# Atau di Vercel Dashboard → Deployments → Failed → View Logs
```

**Common issues:**
1. **Missing env vars**: Add di Vercel dashboard
2. **Build error**: Test locally `npm run build`
3. **Dependency issue**: Clear cache & redeploy

### Environment Variables Tidak Load

```bash
# Pastikan prefix VITE_ untuk Vite variables
VITE_SUPABASE_URL=xxx  # ✅ Correct
SUPABASE_URL=xxx       # ❌ Won't work in browser

# Redeploy setelah update env vars
```

### Deploy Lambat

```bash
# Check build time
vercel inspect <deployment-url>

# Optimize:
# - Add .vercelignore untuk exclude files
# - Use npm ci instead of npm install (sudah di workflow)
```

---

## 🔄 Rollback ke Versi Sebelumnya

**Via Dashboard:**
1. Vercel → Deployments
2. Pilih deployment yang stabil
3. Klik ⋯ → "Promote to Production"

**Via CLI:**
```bash
# List deployments
vercel ls

# Rollback to specific deployment
vercel promote <deployment-url>
```

---

## 📊 Monitoring

### Check Deployment Status

```bash
# Via CLI
vercel ls

# Check specific deployment
vercel inspect <url>
```

### Analytics (Vercel Dashboard)

- **Traffic**: Real-time visitors
- **Performance**: Core Web Vitals
- **Errors**: Runtime errors tracking

---

## 🎨 Custom Domain (Optional)

1. **Vercel Dashboard** → Settings → Domains
2. Add domain: `predictx.com`
3. Update DNS records (Vercel akan kasih instruksi)
4. Wait 24-48 jam untuk DNS propagation
5. **Done!** Auto-SSL included 🔒

---

## 📚 Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

---

## 🆘 Need Help?

**Quick Commands:**
```bash
# Check deployment status
vercel ls

# View logs
vercel logs

# Redeploy
vercel --prod

# Help
vercel --help
```

**Support:**
- Vercel Discord: https://vercel.com/discord
- GitHub Issues: Create issue di repository Anda
