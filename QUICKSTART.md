# 🚀 Quick Start - Deploy PredictX dalam 5 Menit

Panduan super cepat untuk deploy aplikasi PredictX ke Vercel.

## ✅ Prerequisites Checklist

- [ ] Akun GitHub (buat di [github.com](https://github.com))
- [ ] Akun Vercel (buat di [vercel.com](https://vercel.com/signup))
- [ ] Git sudah terinstall ✓ (sudah di-init)

---

## 📤 Step 1: Push ke GitHub (2 menit)

### Option A: Via GitHub CLI (Recommended)

```bash
# Install GitHub CLI jika belum (Mac)
brew install gh

# Login
gh auth login

# Create repo & push
gh repo create predictx --public --source=. --remote=origin --push
```

### Option B: Via GitHub Website

1. **Buka:** https://github.com/new
2. **Repository name:** `predictx`
3. **Visibility:** Public atau Private (terserah)
4. **Jangan** centang "Initialize with README" (sudah ada)
5. **Klik:** "Create repository"

6. **Push code:**
```bash
git remote add origin https://github.com/YOUR_USERNAME/predictx.git
git branch -M main
git push -u origin main
```

✅ **Done!** Code Anda sekarang di GitHub.

---

## 🚀 Step 2: Deploy ke Vercel (3 menit)

### 1. Import Project

1. **Login:** https://vercel.com
2. **Klik:** "Add New Project"
3. **Import Git Repository:**
   - Pilih GitHub
   - Authorize Vercel (jika diminta)
   - Pilih repository `predictx`
   - Klik "Import"

### 2. Configure Project

Vercel akan auto-detect settings:
- ✅ Framework: **Vite** 
- ✅ Build Command: `npm run build`
- ✅ Output Directory: `dist`
- ✅ Install Command: `npm install`

**Jangan ubah apa-apa**, sudah perfect!

### 3. Add Environment Variables

**PENTING!** Klik "Environment Variables" dan tambahkan:

| Name | Value | Where to get |
|------|-------|--------------|
| `GEMINI_API_KEY` | `AIza...` | Copy dari `.env.local` |
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Copy dari `.env.local` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Copy dari `.env.local` |

> 💡 **Tip:** Buka `.env.local` di editor, copy-paste value-nya

### 4. Deploy!

1. **Klik:** "Deploy"
2. **Tunggu:** ~2 menit (lihat progress bar)
3. **🎉 Success!** Aplikasi live di: `https://predictx-xxx.vercel.app`

**Klik URL** untuk buka aplikasi Anda!

---

## 🔄 Step 3: Setup Auto-Deploy (Optional tapi Recommended)

Agar setiap `git push` otomatis deploy.

### Get Vercel Info

**Via Vercel Dashboard:**
1. Klik project `predictx`
2. **Settings** → **General** → scroll bawah
3. Copy:
   - **Project ID:** `prj_xxxxx`
   - **Team ID:** `team_xxxxx` (atau User ID)

4. **Settings** → **Tokens** → **Create Token**
   - Name: `GitHub Actions`
   - Scope: `Full Account`
   - **Copy token** (hanya muncul sekali!)

### Add GitHub Secrets

1. **GitHub repo** → **Settings** → **Secrets and variables** → **Actions**
2. **Klik:** "New repository secret"
3. **Tambahkan 3 secrets:**

| Secret Name | Value |
|-------------|-------|
| `VERCEL_TOKEN` | Token yang baru dibuat |
| `VERCEL_ORG_ID` | Team ID dari Vercel |
| `VERCEL_PROJECT_ID` | Project ID dari Vercel |

4. **Tambahkan environment variables** (sama seperti di Vercel):

| Secret Name | Value |
|-------------|-------|
| `GEMINI_API_KEY` | Your Gemini API key |
| `VITE_SUPABASE_URL` | Your Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |

### Test Auto-Deploy

```bash
# Make a small change
echo "# Auto-deploy test" >> README.md

# Commit & push
git add .
git commit -m "Test auto-deploy"
git push

# Check GitHub Actions tab - should see workflow running!
```

✅ **Done!** Sekarang setiap `git push` akan auto-deploy!

---

## 🎯 Daily Workflow (Super Simple!)

```bash
# 1. Edit code
# ... make your changes ...

# 2. Commit
git add .
git commit -m "Add new feature"

# 3. Push - AUTO DEPLOY! 🚀
git push
```

**That's it!** Vercel akan otomatis:
- ✅ Build aplikasi
- ✅ Deploy ke production
- ✅ Email notifikasi

**Timeline:** 2-3 menit dari push sampai live!

---

## 🆘 Troubleshooting

### Build Failed

**Check:**
```bash
# Test build locally
npm run build

# Jika error, fix dulu sebelum push
```

### Environment Variables Tidak Load

1. Vercel Dashboard → Settings → Environment Variables
2. **Pastikan** ada prefix `VITE_` untuk browser variables
3. **Redeploy:** Deployments → Latest → ⋯ → Redeploy

### Forgot Vercel URL?

```bash
# Via CLI
vercel ls

# Atau check di Vercel Dashboard
```

---

## 📚 Next Steps

- [ ] **Custom Domain:** Settings → Domains → Add `yourdomain.com`
- [ ] **Analytics:** Enable di Vercel Dashboard untuk traffic stats
- [ ] **Monitoring:** Setup error tracking (Sentry, LogRocket, etc.)

---

## 🔗 Useful Links

- **Vercel Dashboard:** https://vercel.com/dashboard
- **GitHub Repo:** https://github.com/YOUR_USERNAME/predictx
- **Full Guide:** [DEPLOYMENT.md](DEPLOYMENT.md)

---

## ✨ Summary

**You now have:**
- ✅ Code di GitHub
- ✅ Live app di Vercel
- ✅ Auto-deploy on push (optional)
- ✅ Free hosting + SSL + CDN

**Update workflow:**
```bash
git add . && git commit -m "update" && git push
```

**Selamat! 🎉** Aplikasi Anda sudah production-ready!
