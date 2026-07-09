# Shopify Checkout Integration Setup

This guide explains how to configure the Shopify checkout integration for the AmeriDoor Cooler Builder.

## Overview

The cooler configurator now integrates directly with Shopify. When users click the "Checkout" button, the system:
1. Validates the configuration and calculates the price
2. Creates a Shopify draft order via the Admin API
3. Redirects the customer to a Shopify checkout page where they can complete their purchase

## Required Shopify Setup

### 1. Create a Custom App in Shopify

1. Go to your Shopify Admin: `https://YOUR-STORE.myshopify.com/admin`
2. Navigate to **Settings** → **Apps and sales channels** → **Develop apps**
3. Click **Create an app**
4. Name it "Cooler Configurator" (or similar)
5. Click **Configure Admin API scopes**
6. Select the following scopes:
   - `write_draft_orders` (required to create draft orders)
   - `read_draft_orders` (optional, for verification)
7. Click **Save**
8. Click **Install app**
9. Copy the **Admin API access token** (you'll only see this once!)

### 2. Create a Product for Custom Coolers

1. In Shopify Admin, go to **Products** → **Add product**
2. Create a product with these details:
   - **Title**: "Custom Walk-In Cooler" (or your preferred name)
   - **Price**: Set to $0.01 (this will be overridden by the configurator)
   - **Description**: Add a description explaining this is a custom configuration
   - **Inventory**: Uncheck "Track quantity" (since each order is custom)
3. Save the product
4. Click on the product variant (usually says "Default Title")
5. Look at the URL - it will contain the variant ID: `/variants/XXXXX`
6. Copy this variant ID number

### 3. Get ImgBB API Key (Optional - for product images)

To show product images in Shopify checkout:

1. Go to https://api.imgbb.com/
2. Sign up for a free account
3. Get your API key from the dashboard
4. This allows unlimited image uploads

### 4. Configure Environment Variables

Set the following environment variables on your server:

```bash
export SHOPIFY_DOMAIN="your-store.myshopify.com"
export SHOPIFY_ADMIN_TOKEN="shpat_xxxxxxxxxxxxx"  # From step 1
export SHOPIFY_VARIANT_ID="52487963902233"        # From step 2 (optional, not currently used)
export IMGBB_API_KEY="your_imgbb_api_key"         # From step 3 (optional, for images)
```

**For local development**, you can create a `.env` file in the `backend` directory:

```
SHOPIFY_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxx
SHOPIFY_VARIANT_ID=52487963902233
```

Then load them in your terminal:
```bash
cd backend
export $(cat .env | xargs)
python app.py
```

**For production (Railway, Heroku, etc.)**, add these as environment variables in your deployment platform.

## Installation

### Backend Dependencies

Install the required Python packages:

```bash
cd backend
pip install -r requirements.txt
```

This will install:
- Flask (web framework)
- Flask-Cors (CORS support)
- requests (for Shopify API calls)

### Testing Locally

1. Set up environment variables (see step 3 above)
2. Start the Flask backend:
   ```bash
   cd backend
   python app.py
   ```
3. Open your browser to `http://localhost:5000`
4. Configure a cooler
5. Click "Checkout"
6. You should be redirected to a Shopify checkout page

## API Endpoint

The checkout functionality uses this endpoint:

**POST** `/api/create-order`

**Request Body:**
```json
{
  "appType": "cooler",
  "dimensions": {
    "depth": 12,
    "width": 10,
    "height": 8
  },
  "displayDoors": 5,
  "entryDoors": ["side-right"],
  "finish": "galvalume",
  "accessories": {
    "ledLighting": true,
    "reinforcedFloor": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "invoiceUrl": "https://your-store.myshopify.com/...",
  "draftOrderId": 123456
}
```

## Troubleshooting

### "Shopify integration not configured" Error
- Ensure `SHOPIFY_ADMIN_TOKEN` environment variable is set
- Check that the token starts with `shpat_`

### "Failed to create draft order: 401" Error
- Your Admin API access token is invalid or expired
- Verify the token in Shopify Admin → Apps → Your custom app

### "Failed to create draft order: 403" Error
- Your app doesn't have the required API scopes
- Add `write_draft_orders` scope in the app configuration

### "No checkout URL returned" Error
- The draft order was created but didn't return an invoice URL
- Check the Shopify API version (should be 2024-01 or later)
- Verify the draft order was created in Shopify Admin → Orders → Drafts

### Customer sees wrong price
- The price is calculated server-side using the backend pricing logic
- Check `backend/pricing.py` to ensure pricing rules match your expectations
- Verify the configuration payload is being sent correctly

## Security Notes

- **Never commit** your `SHOPIFY_ADMIN_TOKEN` to version control
- Add `.env` to your `.gitignore` file
- Use environment variables for all sensitive credentials
- The Admin API token has powerful permissions - keep it secure

## Production Checklist

- [ ] Environment variables configured on production server
- [ ] `.env` file added to `.gitignore`
- [ ] Custom Shopify app created with correct scopes
- [ ] Product and variant created in Shopify
- [ ] Test checkout flow works end-to-end
- [ ] Verify prices match between configurator and Shopify
- [ ] Test with different configurations
- [ ] Monitor Shopify Admin for draft orders

## References

- [Shopify Admin API Documentation](https://shopify.dev/docs/api/admin-rest)
- [Draft Orders API](https://shopify.dev/docs/api/admin-rest/2024-01/resources/draftorder)
