# AmeriDoor Cooler Builder - Deployment Guide

This guide covers deploying the Cooler Builder and integrating it with your Shopify store.

## Quick Deployment (Recommended)

### Option 1: Deploy to Netlify + Railway

This is the fastest and easiest option.

#### Step 1: Deploy Frontend to Netlify

1. **Push to GitHub:**
   ```bash
   cd /Users/elijahcoffer/Downloads/files/coolerconfig
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/ecode-2/ameridoor-cooler-builder.git
   git push -u origin main
   ```

2. **Deploy to Netlify:**
   - Go to [netlify.com](https://netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub repo
   - Build settings:
     - Base directory: `frontend`
     - Build command: (leave empty)
     - Publish directory: `frontend`
   - Click "Deploy site"

3. **Configure Environment:**
   - After deployment, go to Site settings → Environment variables
   - Add your API URL (from Step 2 below)

#### Step 2: Deploy Backend to Railway

1. **Go to [railway.app](https://railway.app)**
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Configure:
   - Root directory: `backend`
   - Start command: `python app.py`
5. Add environment variables:
   ```
   SHOPIFY_DOMAIN=your-store.myshopify.com
   SHOPIFY_ADMIN_TOKEN=your_admin_token
   SHOPIFY_VARIANT_ID=your_variant_id
   IMGBB_API_KEY=your_imgbb_key (optional)
   ```
6. Copy the deployment URL

#### Step 3: Update Frontend API URL

Update your frontend to point to the Railway backend:

1. In your frontend code, create a config file:
   ```javascript
   // frontend/js/api-config.js
   export const API_URL = 'https://your-app.railway.app';
   ```

2. Update API calls in `main.js` to use this URL

---

## Option 2: All-in-One Platform (Vercel)

Deploy both frontend and backend together.

### Deploy to Vercel

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   cd /Users/elijahcoffer/Downloads/files/coolerconfig
   vercel
   ```

3. **Configure:**
   - Framework: Other
   - Root directory: ./
   - Build command: (leave empty)
   - Output directory: frontend

---

## Shopify Integration Methods

### Method 1: Embedded iframe (Easiest)

After deploying, embed in Shopify using an iframe:

1. **Create a new page in Shopify:**
   - Go to Shopify Admin → Online Store → Pages
   - Click "Add page"
   - Title: "Cooler Builder"

2. **Add iframe code:**
   ```html
   <div style="width: 100%; height: 100vh; min-height: 800px;">
     <iframe
       src="https://your-netlify-site.netlify.app"
       width="100%"
       height="100%"
       frameborder="0"
       allow="fullscreen"
       style="border: none;"
     ></iframe>
   </div>
   ```

3. **Create menu link:**
   - Go to Navigation → Main menu
   - Add link to your new page

### Method 2: Shopify Custom App

For deeper integration with Shopify products and checkout:

1. **Create Custom App:**
   - Shopify Admin → Settings → Apps and sales channel settings
   - Click "Develop apps"
   - Click "Create an app"
   - Name: "Cooler Builder"

2. **Configure API Access:**
   - API credentials → Configure Admin API scopes
   - Enable: `write_products`, `write_orders`, `write_draft_orders`
   - Install app and save credentials

3. **Update Backend:**
   - Add Shopify credentials to your backend environment variables
   - Your backend already has Shopify integration code

### Method 3: Product Page Integration

Embed directly on a product page:

1. **Edit your product template:**
   - Go to Online Store → Themes → Actions → Edit code
   - Find `product-template.liquid` or `main-product.liquid`

2. **Add the builder:**
   ```liquid
   {% if product.handle == 'custom-cooler' %}
     <div id="cooler-builder-container">
       <iframe
         src="https://your-netlify-site.netlify.app"
         width="100%"
         height="900px"
         frameborder="0"
         style="border: none; border-radius: 8px;"
       ></iframe>
     </div>
   {% endif %}
   ```

---

## Configuration Checklist

### Frontend Deployment
- [ ] Deploy to Netlify/Vercel
- [ ] Get deployment URL
- [ ] Test all features work
- [ ] Enable HTTPS (automatic)

### Backend Deployment
- [ ] Deploy to Railway/Heroku
- [ ] Set environment variables:
  - `SHOPIFY_DOMAIN`
  - `SHOPIFY_ADMIN_TOKEN`
  - `SHOPIFY_VARIANT_ID`
  - `IMGBB_API_KEY` (optional)
- [ ] Get deployment URL
- [ ] Test API endpoints

### Shopify Integration
- [ ] Create Shopify page or product
- [ ] Add iframe embed code
- [ ] Test checkout flow
- [ ] Test on mobile devices
- [ ] Add to navigation menu

---

## Environment Variables Reference

### Backend (Railway/Heroku)
```bash
SHOPIFY_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxx
SHOPIFY_VARIANT_ID=52487963902233
IMGBB_API_KEY=your_imgbb_key  # Optional for image uploads
PORT=5000  # Usually auto-set by platform
```

### Frontend (Netlify/Vercel)
```bash
API_URL=https://your-backend.railway.app
```

---

## Testing Your Deployment

1. **Test Welcome Screen:**
   - Visit your deployed URL
   - Verify all cooler options load
   - Click each option to test

2. **Test 3D Builder:**
   - Verify 3D model loads
   - Test all configuration options
   - Test camera controls (especially mobile)

3. **Test Checkout:**
   - Configure a cooler
   - Click "Checkout"
   - Verify redirect to Shopify
   - Complete test order

4. **Mobile Testing:**
   - Test on actual mobile devices
   - Verify welcome screen is responsive
   - Verify 3D view is zoomed out properly

---

## Troubleshooting

### CORS Errors
If you see CORS errors, add this to your backend `app.py`:
```python
from flask_cors import CORS
CORS(app, origins=['https://your-netlify-site.netlify.app'])
```

### iframe Not Showing
1. Check X-Frame-Options headers
2. Ensure both sites use HTTPS
3. Check browser console for errors

### 3D Model Not Loading
1. Check Three.js CDN is accessible
2. Verify asset paths are correct
3. Check browser console for errors

---

## Custom Domain (Optional)

### For Netlify
1. Go to Domain settings
2. Add custom domain (e.g., `builder.ameridoor.com`)
3. Configure DNS records as shown

### For Shopify Page
1. Use Shopify's native domain
2. Or create redirect from custom domain

---

## Security Best Practices

1. **Always use HTTPS** (automatic with Netlify/Railway)
2. **Protect API keys** - never commit to Git
3. **Use environment variables** for all secrets
4. **Enable CORS** only for your domains
5. **Validate all inputs** on backend
6. **Rate limit API** endpoints if needed

---

## Cost Estimates

### Free Tier (Suitable for Testing)
- **Netlify:** Free (100GB bandwidth/month)
- **Railway:** $5/month (after 500 hours free trial)
- **Total:** ~$5/month

### Production Tier
- **Netlify Pro:** $19/month (unlimited bandwidth)
- **Railway Pro:** $20/month (better performance)
- **Total:** ~$39/month

---

## Support & Maintenance

### Monitoring
- Set up uptime monitoring (UptimeRobot, Pingdom)
- Monitor error logs in Railway/Netlify dashboards
- Track Shopify order creation success rate

### Updates
- Frontend updates: Push to GitHub, auto-deploys
- Backend updates: Push to GitHub, auto-deploys
- Environment variables: Update in platform dashboard

---

## Next Steps

1. ✅ Deploy frontend to Netlify
2. ✅ Deploy backend to Railway
3. ✅ Configure environment variables
4. ✅ Test deployment thoroughly
5. ✅ Integrate with Shopify
6. ✅ Test checkout flow end-to-end
7. ✅ Launch to customers!

---

## Quick Deploy Commands

```bash
# Initialize git repo
git init
git add .
git commit -m "Initial deployment"

# Create GitHub repo and push
git remote add origin https://github.com/YOUR-USERNAME/cooler-builder.git
git push -u origin main

# Deploy with Vercel (alternative)
vercel --prod

# Or deploy with Netlify CLI
netlify deploy --prod
```

---

For questions or issues, refer to:
- Netlify Docs: https://docs.netlify.com
- Railway Docs: https://docs.railway.app
- Shopify App Docs: https://shopify.dev/docs/apps
