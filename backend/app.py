"""
app.py
-------------------------------------------------------------------------
Flask backend for the ColdCore walk-in configurator.

Responsibilities:
  1. Serve the static frontend (index.html, css, js) during local dev.
  2. Accept a finished configuration from the browser, re-validate it
     independently of whatever the client rendered, calculate the
     authoritative price, and log it as a quote.
  3. Return the verified price breakdown (and a lightweight "sent to sales"
     confirmation) back to the browser.

Run with:
    pip install -r requirements.txt
    python app.py
Then open http://localhost:5000
-------------------------------------------------------------------------
"""

import json
import logging
import uuid
import io
import base64
import os
import requests
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from pricing import ConfigurationError, calculate_price, validate_config

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
QUOTES_LOG_PATH = Path(__file__).resolve().parent / "quotes.log.jsonl"
AR_MODELS_DIR = Path(__file__).resolve().parent / "static" / "ar"
CONFIGURATIONS_DB = {}  # In-memory storage for demo (use database in production)

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")

# CORS configuration for production - allow requests from Netlify and Shopify
allowed_origins = os.environ.get('CORS_ORIGINS', '*').split(',')
CORS(app, origins=allowed_origins, supports_credentials=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("coldcore")

# Ensure AR models directory exists
AR_MODELS_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Static frontend routes (dev convenience -- in production the frontend is
# typically hosted separately behind a CDN, with only /api/* hitting Flask)
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:path>")
def static_proxy(path):
    return send_from_directory(FRONTEND_DIR, path)


# ---------------------------------------------------------------------------
# API: health check
# ---------------------------------------------------------------------------
@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "service": "coldcore-configurator-api"})


# ---------------------------------------------------------------------------
# API: price validation only (no logging/quote creation) -- useful for a
# "confirm price before checkout" step, or for automated testing.
# ---------------------------------------------------------------------------
@app.route("/api/price", methods=["POST"])
def price():
    payload = request.get_json(silent=True)
    try:
        config = validate_config(payload or {})
    except ConfigurationError as exc:
        return jsonify({"error": str(exc)}), 400

    breakdown = calculate_price(config)
    return jsonify({"config": config, "price": breakdown.as_dict()})


# ---------------------------------------------------------------------------
# API: submit a finished configuration as a quote request
# ---------------------------------------------------------------------------
@app.route("/api/quote", methods=["POST"])
def create_quote():
    payload = request.get_json(silent=True)

    try:
        config = validate_config(payload or {})
    except ConfigurationError as exc:
        logger.warning("Rejected quote payload: %s", exc)
        return jsonify({"error": str(exc)}), 400

    breakdown = calculate_price(config)

    quote_id = uuid.uuid4().hex[:10].upper()
    quote_record = {
        "quote_id": quote_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "config": config,
        "price": breakdown.as_dict(),
        "customer": {
            # In production this would come from an authenticated session or
            # a contact-info step in the UI. Left as an explicit placeholder
            # object (not faked data) so the contract is clear for whoever
            # wires up the contact-capture form.
            "email": payload.get("customerEmail"),
            "name": payload.get("customerName"),
        },
    }

    _log_quote(quote_record)
    _notify_sales(quote_record)  # stubbed integration point, see function docstring

    return jsonify(
        {
            "quote_id": quote_id,
            "status": "received",
            "config": config,
            "price": breakdown.as_dict(),
        }
    )


# ---------------------------------------------------------------------------
# API: create Shopify draft order and redirect to checkout
# ---------------------------------------------------------------------------
@app.route("/api/create-order", methods=["POST"])
def create_shopify_order():
    """
    Creates a Shopify draft order with the configured cooler specifications.
    Returns the invoice URL for checkout.
    """
    payload = request.get_json(silent=True)

    # Shopify credentials - MUST be set via environment variables
    SHOPIFY_DOMAIN = os.environ.get("SHOPIFY_DOMAIN")
    SHOPIFY_ADMIN_TOKEN = os.environ.get("SHOPIFY_ADMIN_TOKEN")
    VARIANT_ID = os.environ.get("SHOPIFY_VARIANT_ID")

    if not SHOPIFY_ADMIN_TOKEN:
        logger.error("SHOPIFY_ADMIN_TOKEN not configured")
        return jsonify({"success": False, "error": "Shopify integration not configured"}), 500

    try:
        # Check if price is provided directly (for compatibility with example builder)
        # Otherwise validate and calculate from config
        if "price" in payload:
            total_price = float(payload["price"])
            # Use payload fields directly for description
            depth = payload.get("depth", 0)
            width = payload.get("width", 0)
            height = payload.get("height", 0)
            display_doors = payload.get("doors", 0)
            entry_doors = []
            if payload.get("entry"):
                entry_pos = payload.get("pos", "")
                if entry_pos:
                    entry_doors = [entry_pos.lower().replace("_", "-")]
            freezer = payload.get("freezer", False)
            app_type = "freezer" if freezer else "cooler"
            config = payload  # Store original for notes
        else:
            # Validate and calculate price from full config
            config = validate_config(payload or {})
            breakdown = calculate_price(config)
            total_price = breakdown.as_dict()["total"]

            # Build configuration description
            app_type = config.get("appType", "cooler")
            dimensions = config.get("dimensions", {})
            depth = dimensions.get("depth", 0)
            width = dimensions.get("width", 0)
            height = dimensions.get("height", 0)
            display_doors = config.get("displayDoors", 0)
            entry_doors = config.get("entryDoors", [])
            freezer = app_type == "freezer"

        logger.info(f"Calculated price: ${total_price} for config: {config}")

        dtype = "Freezer" if freezer or app_type == "freezer" else "Cooler"
        entry_text = f" + {len(entry_doors)} Entry Door(s)" if entry_doors else ""

        title = f"Custom Walk-In {dtype} - {display_doors} Doors, {depth}ft × {width}ft × {height}ft"
        description = (
            f"{display_doors}-door walk-in {dtype.lower()}{entry_text}\n"
            f"Dimensions: {depth}ft deep × {width}ft wide × {height}ft tall\n"
            f"Entry doors: {', '.join(entry_doors) if entry_doors else 'None'}\n"
            f"Finish: {config.get('finish', 'galvalume')}\n"
            f"Accessories: {', '.join(k for k, v in config.get('accessories', {}).items() if v) or 'None'}"
        )

        # Upload image to ImgBB and update Shopify product image
        image_url = None
        image_data_url = payload.get("imageDataUrl")
        if image_data_url:
            try:
                logger.info("Uploading product image to ImgBB...")

                # Extract base64 data from data URL
                if "base64," in image_data_url:
                    base64_data = image_data_url.split("base64,")[1]
                else:
                    base64_data = image_data_url

                IMGBB_API_KEY = os.environ.get("IMGBB_API_KEY", "")

                if IMGBB_API_KEY:
                    imgbb_response = requests.post(
                        "https://api.imgbb.com/1/upload",
                        data={
                            "key": IMGBB_API_KEY,
                            "image": base64_data,
                            "name": f"cooler_{uuid.uuid4().hex[:8]}"
                        },
                        timeout=10
                    )

                    if imgbb_response.status_code == 200:
                        imgbb_data = imgbb_response.json()
                        if imgbb_data.get("success"):
                            image_url = imgbb_data["data"]["url"]
                            logger.info(f"Image uploaded successfully: {image_url}")

                            # Update the product variant image in Shopify
                            try:
                                # Get the product ID from the variant
                                variant_url = f"https://{SHOPIFY_DOMAIN}/admin/api/2024-01/variants/{VARIANT_ID}.json"
                                variant_response = requests.get(variant_url, headers={
                                    "X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN
                                })

                                if variant_response.status_code == 200:
                                    variant_data = variant_response.json()
                                    product_id = variant_data.get("variant", {}).get("product_id")

                                    if product_id:
                                        # Update product with new image
                                        image_update_url = f"https://{SHOPIFY_DOMAIN}/admin/api/2024-01/products/{product_id}/images.json"
                                        image_create_response = requests.post(
                                            image_update_url,
                                            headers={
                                                "X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN,
                                                "Content-Type": "application/json"
                                            },
                                            json={
                                                "image": {
                                                    "src": image_url,
                                                    "variant_ids": [int(VARIANT_ID)]
                                                }
                                            }
                                        )
                                        if image_create_response.status_code in [200, 201]:
                                            logger.info("Product image updated in Shopify")
                                        else:
                                            logger.warning(f"Failed to update product image: {image_create_response.status_code}")
                            except Exception as e:
                                logger.warning(f"Failed to update Shopify product image: {e}")
                        else:
                            logger.warning("ImgBB upload failed: %s", imgbb_data)
                    else:
                        logger.warning(f"ImgBB API error: {imgbb_response.status_code}")
                else:
                    logger.info("IMGBB_API_KEY not set, skipping image upload")

            except Exception as e:
                logger.warning(f"Failed to upload image: {e}")

        # Create draft order with variant (for image) and use applied_discount to set the final price
        # The variant should be priced at $500,000 in Shopify, then we discount down to the actual price

        line_item_with_variant = {
            "variant_id": int(VARIANT_ID),
            "quantity": 1,
            "taxable": True,
            "requires_shipping": False,
            "properties": [
                {"name": "Configuration", "value": description}
            ]
        }

        if image_url:
            line_item_with_variant["properties"].append({
                "name": "3D Preview",
                "value": image_url
            })

        # Calculate the discount amount needed
        # Assuming the Shopify variant is priced at $500,000
        base_price = 500000.0
        discount_amount = base_price - total_price

        draft_order_data = {
            "draft_order": {
                "line_items": [line_item_with_variant],
                "applied_discount": {
                    "description": "Configuration Pricing",  # Professional description
                    "value_type": "fixed_amount",
                    "value": str(discount_amount),
                    "amount": str(discount_amount)
                },
                "note": f"Auto-generated from cooler configurator\n\nConfiguration:\n{json.dumps(config, indent=2)}\n\n3D Preview: {image_url if image_url else 'Not available'}",
                "use_customer_default_address": True,
                "email": "",
                "note_attributes": [
                    {"name": "Product Image", "value": image_url if image_url else ""},
                    {"name": "Actual Price", "value": str(total_price)}
                ] if image_url else [
                    {"name": "Actual Price", "value": str(total_price)}
                ]
            }
        }

        logger.info(f"Creating draft order with variant and discount: Base=${base_price}, Discount=${discount_amount}, Final=${total_price}")
        logger.info(f"Draft order data: {json.dumps(draft_order_data, indent=2)}")

        url = f"https://{SHOPIFY_DOMAIN}/admin/api/2024-01/draft_orders.json"
        headers = {
            "X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN,
            "Content-Type": "application/json"
        }

        response = requests.post(url, json=draft_order_data, headers=headers)
        logger.info(f"Shopify response: {response.status_code} - {response.text}")

        if response.status_code not in [200, 201]:
            logger.error(f"Shopify API error: {response.status_code} - {response.text}")
            return jsonify({
                "success": False,
                "error": f"Failed to create draft order: {response.status_code}"
            }), 500

        result = response.json()
        draft_order = result.get("draft_order", {})

        invoice_url = draft_order.get("invoice_url")

        if not invoice_url:
            logger.error("No invoice URL in Shopify response")
            return jsonify({"success": False, "error": "No checkout URL returned"}), 500

        # Log the order creation
        logger.info(f"Created Shopify draft order #{draft_order.get('id')} for ${total_price}")

        return jsonify({
            "success": True,
            "invoiceUrl": invoice_url,
            "draftOrderId": draft_order.get("id")
        })

    except ConfigurationError as exc:
        logger.warning("Invalid configuration for checkout: %s", exc)
        return jsonify({"success": False, "error": str(exc)}), 400
    except requests.RequestException as exc:
        logger.error(f"Shopify API request failed: {exc}")
        return jsonify({"success": False, "error": "Failed to connect to Shopify"}), 500
    except Exception as exc:
        logger.error(f"Unexpected error creating order: {exc}")
        return jsonify({"success": False, "error": "An unexpected error occurred"}), 500


# ---------------------------------------------------------------------------
# Persistence / notification helpers
# ---------------------------------------------------------------------------
def _log_quote(record: dict) -> None:
    """
    Appends the quote as one JSON line to a local log file. This keeps the
    template dependency-free (no database required to try it out) while
    still being a durable, append-only audit trail. Swap this out for a
    real database insert (Postgres, etc.) in production.
    """
    with QUOTES_LOG_PATH.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record) + "\n")
    logger.info("Logged quote %s — total $%.2f", record["quote_id"], record["price"]["total"])


def _notify_sales(record: dict) -> None:
    """
    Integration point for actually emailing/Slacking the sales team.
    Left as a structured log line rather than a faked email send, since
    wiring a real SMTP/CRM integration requires credentials this template
    doesn't have. Replace the body of this function with, e.g.:

        smtp_client.send(
            to="sales@example.com",
            subject=f"New quote request {record['quote_id']}",
            body=json.dumps(record, indent=2),
        )
    """
    logger.info("[sales-notify] New quote ready for follow-up: %s", record["quote_id"])


# ---------------------------------------------------------------------------
# Premium Features API: Configuration Storage
# ---------------------------------------------------------------------------
@app.route("/api/configurations/save", methods=["POST"])
def save_configuration():
    """Save a configuration and return a shareable ID"""
    payload = request.get_json(silent=True)

    if not payload:
        return jsonify({"error": "No configuration data provided"}), 400

    # Generate unique ID
    config_id = uuid.uuid4().hex[:12]
    CONFIGURATIONS_DB[config_id] = {
        "config": payload,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    base_url = request.host_url.rstrip('/')
    share_url = f"{base_url}?config={config_id}"

    logger.info(f"Saved configuration {config_id}")

    return jsonify({
        "id": config_id,
        "url": share_url
    })


@app.route("/api/configurations/<config_id>", methods=["GET"])
def get_configuration(config_id):
    """Retrieve a saved configuration"""
    config_data = CONFIGURATIONS_DB.get(config_id)

    if not config_data:
        return jsonify({"error": "Configuration not found"}), 404

    return jsonify(config_data["config"])


# ---------------------------------------------------------------------------
# Premium Features API: AR Model Upload
# ---------------------------------------------------------------------------
@app.route("/api/ar/upload", methods=["POST"])
def upload_ar_model():
    """Upload GLB model for AR viewing"""
    if 'model' not in request.files:
        return jsonify({"error": "No model file provided"}), 400

    file = request.files['model']

    if file.filename == '':
        return jsonify({"error": "Empty filename"}), 400

    # Generate unique filename
    filename = f"ar_{uuid.uuid4().hex[:8]}.glb"
    filepath = AR_MODELS_DIR / filename

    try:
        file.save(str(filepath))
        logger.info(f"Saved AR model: {filename}")

        base_url = request.host_url.rstrip('/')
        model_url = f"{base_url}/static/ar/{filename}"

        return jsonify({"url": model_url})
    except Exception as e:
        logger.error(f"Failed to save AR model: {e}")
        return jsonify({"error": "Failed to save model"}), 500


@app.route("/api/ar/qr-code", methods=["POST"])
def generate_qr_code():
    """Generate QR code for AR viewing"""
    payload = request.get_json(silent=True)

    if not payload or 'url' not in payload:
        return jsonify({"error": "URL required"}), 400

    url = payload['url']

    try:
        # Try to import qrcode
        import qrcode

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(url)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")

        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)

        qr_data = base64.b64encode(buffer.getvalue()).decode()
        qr_url = f"data:image/png;base64,{qr_data}"

        return jsonify({"qrCodeUrl": qr_url})
    except ImportError:
        # Fallback if qrcode library not installed
        logger.warning("qrcode library not installed, returning URL only")
        return jsonify({
            "qrCodeUrl": None,
            "url": url,
            "message": "QR code generation requires 'qrcode' library. Install with: pip install qrcode[pil]"
        })
    except Exception as e:
        logger.error(f"Failed to generate QR code: {e}")
        return jsonify({"error": "Failed to generate QR code"}), 500


@app.route("/api/ar/convert-usdz", methods=["POST"])
def convert_to_usdz():
    """Convert GLB to USDZ for iOS AR Quick Look"""
    # This requires USD tools from Pixar or a conversion service
    # Placeholder implementation
    logger.warning("USDZ conversion not implemented")
    return jsonify({
        "error": "USDZ conversion not implemented",
        "message": "This feature requires USD tools or a conversion service. Consider using online converters or implementing with usd-core library."
    }), 501


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    QUOTES_LOG_PATH.touch(exist_ok=True)
    app.run(debug=True, host="0.0.0.0", port=5000)
