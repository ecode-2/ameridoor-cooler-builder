# Shopify iframe Integration Fix

## Problem
The Cooler Builder works on Netlify directly but not when embedded in Shopify iframe due to:
1. API calls using relative URLs (won't work across domains)
2. CORS (Cross-Origin Resource Sharing) not configured
3. Backend URL not set in frontend

## Solution: 3-Step Fix

### Step 1: Update Backend CORS (Railway)

Your backend needs to allow requests from your Netlify and Shopify domains.

1. **Go to Railway dashboard**
2. **Click on your backend service**
3. **Go to Variables tab**
4. **Add these environment variables:**

```
CORS_ORIGINS=https://ameridoorcoolerbuilder.netlify.app,https://your-store.myshopify.com
```

### Step 2: Update Backend Code for CORS

The backend already has CORS enabled, but we need to make it more specific:

**File: `backend/app.py`** (around line 45)

**Current:**
```python
CORS(app)  # allow the frontend to be served from a different origin/port during development
```

**Change to:**
```python
# CORS configuration for production
allowed_origins = os.environ.get('CORS_ORIGINS', '*').split(',')
CORS(app, origins=allowed_origins, supports_credentials=True)
```

###Step 3: Set API URL in Frontend

You have two options:

#### Option A: Hardcode Railway URL (Quick Fix)

**File: `frontend/js/api-config.js`** (line 24)

```javascript
// REPLACE THIS URL with your actual Railway backend URL
return 'https://YOUR-BACKEND.railway.app';
```

**Find your Railway URL:**
1. Go to Railway dashboard
2. Click your backend service
3. Copy the URL from "Deployments" section
4. Should look like: `https://ameridoor-backend-production.up.railway.app`

#### Option B: Use Environment Variable (Better)

**In Netlify:**
1. Go to Site settings → Environment variables
2. Add new variable:
   - **Key:** `API_URL`
   - **Value:** `https://your-backend.railway.app`
3. Redeploy site

**Then update `frontend/index.html`** (add before closing `</head>`):

```html
<script>
  window.ENV = {
    API_URL: 'API_URL_PLACEHOLDER'
  };
</script>
```

**And create `netlify.toml` build command:**
```toml
[build]
  publish = "frontend"
  command = "sed -i 's|API_URL_PLACEHOLDER|'\"$API_URL\"'|g' frontend/index.html"
```

## Quick Fix Commands

### 1. Update api-config.js with your Railway URL:

```bash
cd /Users/elijahcoffer/Downloads/files/coolerconfig/frontend/js

# Replace YOUR_RAILWAY_URL with actual URL
sed -i '' "s|https://your-backend.railway.app|https://YOUR_RAILWAY_URL|g" api-config.js

# Example:
# sed -i '' "s|https://your-backend.railway.app|https://ameridoor-backend.up.railway.app|g" api-config.js
```

### 2. Update backend CORS:

```bash
cd /Users/elijahcoffer/Downloads/files/coolerconfig

# Add after line 45 in backend/app.py
```

### 3. Commit and deploy:

```bash
git add .
git commit -m "Fix: Add CORS and API URL configuration for Shopify integration"
git push origin main
```

## Test the Fix

### 1. Test Direct Access:
Visit: `https://ameridoorcoolerbuilder.netlify.app`
- Should work ✅

### 2. Test in Shopify iframe:
- Create a test page in Shopify
- Add iframe code (see below)
- Should work ✅

### 3. Test API Connection:
Open browser console (F12) and run:
```javascript
fetch('https://YOUR-BACKEND.railway.app/api/health')
  .then(r => r.json())
  .then(console.log)
```

Should show: `{status: "ok", service: "coldcore-configurator-api"}`

## Shopify iframe Code

**Option 1: Full Page iframe**
```html
<div class="cooler-builder-container">
  <iframe
    src="https://ameridoorcoolerbuilder.netlify.app"
    width="100%"
    height="900px"
    frameborder="0"
    style="border: none; display: block;"
    allow="clipboard-write"
    loading="lazy"
  ></iframe>
</div>

<style>
  .cooler-builder-container {
    width: 100%;
    min-height: 900px;
    margin: 0;
    padding: 0;
  }

  @media (max-width: 768px) {
    .cooler-builder-container iframe {
      height: 100vh;
      min-height: 600px;
    }
  }
</style>
```

**Option 2: Responsive Container**
```html
<div class="cooler-builder-wrapper">
  <div class="cooler-builder-aspect-ratio">
    <iframe
      src="https://ameridoorcoolerbuilder.netlify.app"
      frameborder="0"
      allow="clipboard-write"
      allowfullscreen
    ></iframe>
  </div>
</div>

<style>
  .cooler-builder-wrapper {
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
  }

  .cooler-builder-aspect-ratio {
    position: relative;
    width: 100%;
    padding-bottom: 75%; /* 4:3 aspect ratio */
    background: #f3f6f7;
    border-radius: 8px;
    overflow: hidden;
  }

  .cooler-builder-aspect-ratio iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
  }

  @media (max-width: 768px) {
    .cooler-builder-aspect-ratio {
      padding-bottom: 100%; /* Square on mobile */
    }
  }
</style>
```

## Troubleshooting

### Issue: "refused to connect"
**Solution:** Update api-config.js with correct Railway URL

### Issue: CORS error in console
**Solution:** Add CORS_ORIGINS environment variable in Railway

### Issue: iframe shows but 3D doesn't load
**Solution:** Check browser console for Three.js errors, ensure HTTPS

### Issue: Checkout button doesn't work
**Solution:** Ensure Shopify credentials are set in Railway environment variables

## Environment Variables Checklist

### Railway (Backend)
- [ ] `SHOPIFY_DOMAIN`
- [ ] `SHOPIFY_ADMIN_TOKEN`
- [ ] `SHOPIFY_VARIANT_ID`
- [ ] `CORS_ORIGINS` (new!)
- [ ] `IMGBB_API_KEY` (optional)

### Netlify (Frontend)
- [ ] `API_URL` (optional, for Option B)

## Verify Everything Works

1. ✅ Netlify site loads directly
2. ✅ Backend API responds to health check
3. ✅ No CORS errors in browser console
4. ✅ Can configure cooler in Shopify iframe
5. ✅ Checkout redirects to Shopify successfully
6. ✅ Mobile view works correctly

## Quick Deployment Script

```bash
#!/bin/bash
# Save this as deploy-fix.sh

# Get your Railway URL
read -p "Enter your Railway backend URL (e.g., https://xxx.railway.app): " RAILWAY_URL

# Update api-config.js
cd /Users/elijahcoffer/Downloads/files/coolerconfig/frontend/js
sed -i '' "s|https://your-backend.railway.app|$RAILWAY_URL|g" api-config.js

echo "✅ Updated API URL to: $RAILWAY_URL"

# Commit and push
cd /Users/elijahcoffer/Downloads/files/coolerconfig
git add .
git commit -m "Fix: Configure API URL for production"
git push origin main

echo "✅ Pushed to GitHub - Netlify will auto-deploy"
echo ""
echo "Next steps:"
echo "1. Add CORS_ORIGINS to Railway environment variables"
echo "2. Test at: https://ameridoorcoolerbuilder.netlify.app"
echo "3. Embed in Shopify page"
```

Make executable:
```bash
chmod +x deploy-fix.sh
./deploy-fix.sh
```
