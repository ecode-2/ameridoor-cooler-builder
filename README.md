# ColdCore Walk-In Configurator

A production-ready template for a 3D walk-in cooler/freezer product
configurator: a Mimeeq/Harbor-Saunas-style split viewport (three.js on the
left, tabbed accordion options on the right), a modular assembly engine that
builds the unit from repeated wall/roof/floor panels, and a Flask backend
that owns pricing and quote intake.

## Project layout

```
coolerconfig/
├── frontend/
│   ├── index.html            # split-viewport layout + accordion tab markup
│   ├── css/styles.css        # design tokens + Mimeeq-style tab/price-bar styling
│   ├── js/
│   │   ├── config.js         # shared CONFIG state + client-side pricing constants
│   │   ├── scene.js          # renderer/camera/OrbitControls/studio lighting
│   │   ├── builder.js        # modular engine: builds walls/roof/floor, cuts door slots
│   │   ├── pricing.js        # client-side live price estimate + breakdown render
│   │   └── main.js           # DOM wiring: tabs -> CONFIG -> rebuild + price + quote POST
│   └── assets/models/        # drop production .glb modules here (see below)
└── backend/
    ├── app.py                # Flask app: static hosting + /api/price + /api/quote
    ├── pricing.py             # authoritative validation + pricing (source of truth)
    ├── requirements.txt
    └── quotes.log.jsonl       # created at runtime; one JSON line per quote
```

## Running it

```bash
cd backend
pip install -r requirements.txt
python app.py
```

Then open **http://localhost:5000** — Flask serves the frontend directly
during development. In production you would typically host the static
frontend behind a CDN and point it at a separately-deployed API, with only
`/api/*` routes hitting Flask; `app.py` is written so that split is trivial
(just remove the two static routes).

## How the modular 3D engine works

`builder.js` never loads one baked cooler model. Every rebuild:

1. Computes how many ~4ft panel segments fit each wall, based on the current
   width/depth.
2. Decides which segments are doors vs. plain panel (`computeDoorLayout`) —
   front-left/front-right entry doors claim the outer front-wall segments
   first, display doors fill remaining interior segments, and side entry
   doors claim the frontmost segment of their wall.
3. Instantiates a `BoxGeometry` per segment (or a small door sub-group with
   glass/frame/handle detail) and positions it.

Finish changes (Tab 4) **do not** trigger a rebuild — `applyFinish()` mutates
the shared `wall`/`roof` `MeshStandardMaterial` objects in place, so every
mesh referencing them updates instantly with zero geometry churn and zero
disruption to the current camera framing.

### Swapping in real Blender assets

`ASSET_PATHS` at the top of `builder.js` points at where production `.glb`
modules would live (`frontend/assets/models/*.glb`). `tryLoadModule()`
attempts to load them and silently falls back to the procedural geometry
above if a file isn't present yet — so you can hand this template to a
Blender artist and swap in real modules file-by-file with no JS changes
beyond the (documented, currently-a-no-op) mesh-replacement loop in
`upgradeToModularAssetsIfAvailable()`.

## Pricing contract

The frontend keeps a copy of the pricing rules purely so the price bar can
update on every keystroke without a network call. `backend/pricing.py` is
the only copy that is ever trusted: `POST /api/quote` re-validates the full
payload (dimension bounds, door-count-vs-wall-space feasibility, enum
values) independently before calculating a price, so a modified or buggy
client payload can never produce an incorrect quote.

### `POST /api/quote` request body

```json
{
  "appType": "cooler",
  "dimensions": { "depth": 12, "width": 10, "height": 8 },
  "displayDoors": 1,
  "entryDoors": ["front-left"],
  "finish": "stainless",
  "accessories": { "shelving": true, "ledLighting": true, "reinforcedFloor": false }
}
```

### Response

```json
{
  "quote_id": "A1B2C3D4E5",
  "status": "received",
  "config": { ... normalized config ... },
  "price": {
    "lines": [{ "label": "Base unit (cooler)", "amount": 4200 }, ...],
    "total": 14579.0
  }
}
```

Every accepted quote is appended as one JSON line to
`backend/quotes.log.jsonl` and passed to `_notify_sales()`, a documented
stub for wiring a real CRM/email integration.

## Next steps for a real deployment

- Replace `_notify_sales()` with a real email/CRM call.
- Swap `quotes.log.jsonl` for a database table once volume warrants it.
- Add a customer contact-info step to the UI and pass `customerName`/
  `customerEmail` through `buildQuotePayload()` in `main.js`.
- Commission real `.glb` panel/door modules from a Blender artist and drop
  them at the paths in `builder.js`'s `ASSET_PATHS`.
