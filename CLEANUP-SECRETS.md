# Quick Guide: Remove Secrets from Git

## ⚠️ IMPORTANT: Do This BEFORE Pushing to GitHub

## Step 1: Check If You've Already Pushed

```bash
cd /Users/elijahcoffer/Downloads/files/coolerconfig

```

**If you see your GitHub repository URL**, you've already pushed. **Skip to Step 3.**

**If you see nothing or no remote**, you haven't pushed yet. **Continue to Step 2.**

## Step 2: Clean Start (If NOT Pushed Yet) ✅ EASIEST

```bash
cd /Users/elijahcoffer/Downloads/files/coolerconfig

# Remove git history
rm -rf .git

# Start fresh
git init
git add .
git commit -m "Initial commit - AmeriDoor Cooler Builder"
git branch -M main
git remote add origin https://github.com/ecode-2/ameridoor-cooler-builder.git

# Push to GitHub
git push -u origin main
```

## Step 3: If You Already Pushed (Cleanup Required) ⚠️

### Option A: Delete & Recreate Repository (Simplest)

1. **Go to GitHub:** https://github.com/ecode-2/ameridoor-cooler-builder
2. **Click Settings** (bottom of right sidebar)
3. **Scroll to bottom** → Click "Delete this repository"
4. **Confirm deletion**
5. **Create new repository** with same name
6. **Follow Step 2 above** to push clean code

### Option B: Clean Git History (Advanced)

```bash
cd /Users/elijahcoffer/Downloads/files/coolerconfig

# Remove all history
git checkout --orphan latest_branch
git add -A
git commit -m "Initial commit - cleaned secrets"
git branch -D main
git branch -m main
git push -f origin main
```

## Step 4: Setup Environment Variables

### For Local Development

```bash
cd /Users/elijahcoffer/Downloads/files/coolerconfig/backend

# Create .env file from example
cp .env.example .env

# Edit with your real secrets
nano .env
```

**Add your actual credentials:**
```bash
SHOPIFY_DOMAIN=c0090c-6f.myshopify.com
SHOPIFY_ADMIN_TOKEN=shpat_your_actual_token_here
SHOPIFY_VARIANT_ID=52487963902233
IMGBB_API_KEY=your_imgbb_key_here
```

### For Production (Netlify/Railway)

**Railway (Backend):**
1. Go to your Railway project
2. Click "Variables" tab
3. Add each variable:
   - `SHOPIFY_DOMAIN` = `c0090c-6f.myshopify.com`
   - `SHOPIFY_ADMIN_TOKEN` = `shpat_...`
   - `SHOPIFY_VARIANT_ID` = `52487963902233`
   - `IMGBB_API_KEY` = `...`

**Netlify (Frontend):**
1. Go to Site settings → Environment variables
2. Add `API_URL` = your Railway backend URL

## Step 5: Verify Secrets Are Gone

```bash
# Check current files
grep -r "shpat_" /Users/elijahcoffer/Downloads/files/coolerconfig
grep -r "c0090c-6f" /Users/elijahcoffer/Downloads/files/coolerconfig

# Should return nothing or only .env.example
```

## Step 6: Test Locally

```bash
# Start backend
cd /Users/elijahcoffer/Downloads/files/coolerconfig/backend
source ../.venv/bin/activate
python app.py

# Should see:
# * Running on http://0.0.0.0:5000

# Open frontend
open /Users/elijahcoffer/Downloads/files/coolerconfig/frontend/index.html
```

## ✅ Checklist

- [ ] Git history cleaned (or repository recreated)
- [ ] `.env` file created (not committed)
- [ ] `.gitignore` includes `.env`
- [ ] No hardcoded secrets in code
- [ ] Tested locally with environment variables
- [ ] Ready to push to GitHub safely

## 🚨 If Secrets Were Exposed

**ROTATE IMMEDIATELY:**

1. **Shopify Token:**
   - Go to Shopify Admin → Settings → Apps
   - Delete and recreate your custom app
   - Get new access token
   - Update `.env` file

2. **ImgBB Key:**
   - Go to ImgBB settings
   - Regenerate API key
   - Update `.env` file

## Quick Commands Reference

```bash
# Check what's in git
git status
git log --oneline

# Remove last commit (if not pushed)
git reset --soft HEAD~1

# Check for secrets
grep -r "shpat_\|token\|key" .

# Test backend
cd backend && python app.py

# Push to GitHub
git push origin main
```

## Need Help?

1. Check [SECURITY.md](SECURITY.md) for detailed instructions
2. Check [DEPLOYMENT.md](DEPLOYMENT.md) for deployment steps
3. Ensure `.env` file exists and has correct values

## Files You Should Have

```
coolerconfig/
├── .gitignore           ✅ Ignores .env
├── backend/
│   ├── .env.example     ✅ Template (no secrets)
│   ├── .env             ✅ Your secrets (NOT in git)
│   └── app.py           ✅ Uses os.environ
├── frontend/
└── DEPLOYMENT.md        ✅ Deployment guide
```

## Final Check Before Push

```bash
# 1. Verify no secrets in code
git diff | grep -i "shpat_\|token.*=.*[\'\"]"

# 2. Should return nothing

# 3. Safe to push!
git push origin main
```
