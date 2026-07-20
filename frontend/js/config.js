/**
 * config.js
 * ---------------------------------------------------------------------------
 * The single in-memory representation of "what the customer has configured".
 * Every UI control mutates this object; the 3D builder and the pricing
 * engine both read from it. Keeping one shared, serializable object means
 * the exact same structure we render in three.js is what we POST to the
 * Flask backend for the authoritative price + quote.
 * ---------------------------------------------------------------------------
 */

// Scene scale: 1 three.js unit === 1 real-world foot. Keeping this 1:1
// mapping means every dimension typed into the UI can be used directly
// as a geometry argument with no unit conversion bugs.
export const UNITS_PER_FOOT = 1;

// Nominal width, in feet, of a single wall/roof panel segment. Walk-in
// panels are commonly manufactured in 4" step widths up to 4' for framing
// consistency -- we use this to decide how many repeated segments make up
// a wall of a given length, which is what lets the "modular engine"
// scale/repeat panels instead of stretching one giant plane.
export const PANEL_SEGMENT_FT = 4;

export const PANEL_THICKNESS_FT = 4 / 12; // 4" foam panel wall, in feet

// Modeling bounds - set very high to allow virtually limitless configurations.
// The backend re-validates these independently -- never trust the client.
export const LIMITS = {
  depth: [8, 200],
  width: [6, 200],
  height: [8, 20],
  displayDoors: [0, 500], // Effectively limitless - capped by actual wall width
};

/**
 * The live configuration state. This mirrors exactly what gets serialized
 * and sent to POST /api/quote.
 */
export const CONFIG = {
  appType: 'cooler',        // 'cooler' | 'freezer'
  depth: 12,                 // ft, front-to-back
  width: 10,                 // ft, left-to-right
  height: 8,                 // ft
  displayDoors: 0,            // count of front glass display doors
  entryDoors: ['side-right'], // array of 'front-left'|'front-right'|'side-left'|'side-right'
  finish: 'galvalume',        // 'galvalume' | 'stainless' | 'stucco'
  accessories: {
    ledLighting: true,
    reinforcedFloor: false,
  },
};

/**
 * PRICING_RULES
 * ---------------------------------------------------------------------------
 * This mirrors backend/pricing.py exactly on purpose. The frontend copy
 * exists purely so the price bar can update instantly (no network round
 * trip on every slider tick) -- but it is NEVER treated as the final price.
 * The Flask backend recalculates from scratch on quote submission and that
 * number is the one that is quoted to the customer.
 * ---------------------------------------------------------------------------
 */
export const PRICING_RULES = {
  perSquareFoot: {
    cooler: 38,
    freezer: 54,
  },
  perFootOfHeightAbove8: 260, // additional cost per foot of height above the 8ft baseline
  displayDoorEach: 1439,
  entryDoorEach: 1329,
  finishMultiplier: {
    galvalume: 1.0,
    stainless: 1.22,
    stucco: 1.08,
  },
  accessories: {
    ledLighting: 340,
    reinforcedFloor: 960,
  },
  // Refrigeration equipment pricing (calculated dynamically based on volume)
  // These are reference prices; actual pricing is computed by RefrigerationSystem.js
  refrigeration: {
    condensers: {
      '2_ton': 3895,
      '3_ton': 4495,
      '4_ton': 4895,
      '5_ton': 5109,
    },
    evaporators: {
      '2_fan': 2260,
      '3_fan': 2600,
      '4_fan': 3195,
      '5_fan': 3495,
    }
  },
  // Wall and roof panel pricing based on 44.5 inch (3.708 ft) panels
  // Panels are priced per height
  panelPricing: {
    panelWidthInches: 44.5,
    panelWidthFt: 44.5 / 12, // 3.708 ft
    wallPanels: {
      '8ft': 245,   // 44.5 x 8 = $245
      '10ft': 295,  // 44.5 x 10 = $295
      '12ft': 335,  // 44.5 x 12 = $335
    },
    // Roof panels use the same pricing as wall panels of matching height
    roofPanels: {
      '8ft': 245,
      '10ft': 295,
      '12ft': 335,
    }
  }
};
