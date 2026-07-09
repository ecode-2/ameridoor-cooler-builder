/**
 * pricing.js
 * ---------------------------------------------------------------------------
 * Computes the live estimate shown in the price bar and renders the
 * breakdown panel. See config.js for a note on why this logic is
 * intentionally duplicated (not shared as the source of truth) with
 * backend/pricing.py.
 * ---------------------------------------------------------------------------
 */
import { PRICING_RULES } from './config.js';
import { calculateRefrigerationRequirements } from './RefrigerationSystem.js';

/**
 * Calculates the number of 44.5-inch panels needed for a given dimension.
 * Rounds up to ensure full coverage.
 * @param {number} dimensionFt - The dimension in feet
 * @returns {number} Number of panels needed
 */
function calculatePanelCount(dimensionFt) {
  const panelWidthFt = PRICING_RULES.panelPricing.panelWidthFt;
  return Math.ceil(dimensionFt / panelWidthFt);
}

/**
 * Gets the appropriate panel price based on height.
 * Rounds height to nearest standard size (8, 10, or 12 ft).
 * @param {number} heightFt - The height in feet
 * @param {object} panelPrices - The panel pricing object (wallPanels or roofPanels)
 * @returns {number} Price per panel
 */
function getPanelPriceForHeight(heightFt, panelPrices) {
  if (heightFt <= 8) return panelPrices['8ft'];
  if (heightFt <= 10) return panelPrices['10ft'];
  return panelPrices['12ft'];
}

/**
 * Calculates total wall and roof panel costs based on 44.5-inch panel pricing.
 * @param {object} config - The configuration object
 * @returns {object} Object with wall and roof panel costs and counts
 */
function calculatePanelCosts(config) {
  const panelPricing = PRICING_RULES.panelPricing;
  const height = config.height;
  const panelWidthInches = panelPricing.panelWidthInches;

  // Convert dimensions to inches and calculate panels needed
  const widthInches = config.width * 12;
  const depthInches = config.depth * 12;

  // Back wall panels = width in inches / 44.5, rounded up
  const backWallPanels = Math.ceil(widthInches / panelWidthInches);

  // Side wall panels = depth in inches / 44.5, rounded up (for each side)
  const sideWallPanels = Math.ceil(depthInches / panelWidthInches);

  // Front wall panels = same as back wall
  let frontWallPanels = backWallPanels;

  // Subtract 1 panel for side entry doors
  const hasSideEntry = config.entryDoors.some(door => door.startsWith('side-'));
  if (hasSideEntry) {
    // Subtract 1 panel from front wall for door framing
    frontWallPanels = Math.max(0, frontWallPanels - 1);
  }

  // Total wall panels: front + back + both sides
  const totalWallPanels = frontWallPanels + backWallPanels + (sideWallPanels * 2);
  const wallPanelPrice = getPanelPriceForHeight(height, panelPricing.wallPanels);
  const wallPanelsCost = totalWallPanels * wallPanelPrice;

  // Roof panels: same as back wall (width dimension)
  const totalRoofPanels = backWallPanels;
  const roofPanelPrice = getPanelPriceForHeight(height, panelPricing.roofPanels);
  const roofPanelsCost = totalRoofPanels * roofPanelPrice;

  return {
    wallPanels: {
      count: totalWallPanels,
      priceEach: wallPanelPrice,
      total: wallPanelsCost
    },
    roofPanels: {
      count: totalRoofPanels,
      priceEach: roofPanelPrice,
      total: roofPanelsCost
    }
  };
}

/**
 * @param {object} config - the live CONFIG object (see config.js)
 * @returns {{ total: number, lines: Array<{label: string, amount: number}> }}
 */
export function calculatePrice(config) {
  const rules = PRICING_RULES;
  const lines = [];

  const base = rules.base[config.appType];
  lines.push({ label: `Base unit (${config.appType})`, amount: base });

  // Use panel-based pricing instead of per-square-foot
  const panelCosts = calculatePanelCosts(config);

  lines.push({
    label: `Wall panels (${panelCosts.wallPanels.count} panels × $${panelCosts.wallPanels.priceEach})`,
    amount: panelCosts.wallPanels.total
  });

  lines.push({
    label: `Roof panels (${panelCosts.roofPanels.count} panels × $${panelCosts.roofPanels.priceEach})`,
    amount: panelCosts.roofPanels.total
  });

  if (config.displayDoors > 0) {
    const displayCost = config.displayDoors * rules.displayDoorEach;
    lines.push({ label: `Glass display doors ×${config.displayDoors}`, amount: displayCost });
  }

  if (config.entryDoors.length > 0) {
    const entryCost = config.entryDoors.length * rules.entryDoorEach;
    lines.push({ label: `Entry doors ×${config.entryDoors.length}`, amount: entryCost });
  }

  const accessoryEntries = Object.entries(config.accessories).filter(([, enabled]) => enabled);
  for (const [key] of accessoryEntries) {
    const cost = rules.accessories[key];
    lines.push({ label: accessoryLabel(key), amount: cost });
  }

  // ---- Refrigeration Equipment Costs ------------------------------------
  // Calculate required equipment based on box volume and app type
  const refrigeration = calculateRefrigerationRequirements(config);
  if (refrigeration) {
    lines.push({
      label: `Condensing unit (${refrigeration.condenser.replace('.glb', '').replace('_', ' ')})`,
      amount: refrigeration.condenserPrice
    });
    lines.push({
      label: `Evaporator coil (${refrigeration.evaporator.replace('.glb', '').replace('_', ' ')})`,
      amount: refrigeration.evaporatorPrice
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const finishMultiplier = rules.finishMultiplier[config.finish] ?? 1;
  const total = subtotal * finishMultiplier;

  if (finishMultiplier !== 1) {
    lines.push({
      label: `${finishLabel(config.finish)} finish adjustment`,
      amount: subtotal * (finishMultiplier - 1),
    });
  }

  return { total: Math.round(total), lines };
}

function accessoryLabel(key) {
  const map = {
    shelving: 'Interior shelving units',
    ledLighting: 'LED lighting track',
    reinforcedFloor: 'Reinforced flooring',
  };
  return map[key] ?? key;
}

function finishLabel(key) {
  const map = { galvalume: 'Galvalume', stainless: 'Stainless steel', stucco: 'White stucco' };
  return map[key] ?? key;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/** Renders the price bar total + breakdown list into the DOM. */
export function renderPrice(config, els) {
  const { total, lines } = calculatePrice(config);

  els.priceValue.textContent = currencyFormatter.format(total);
  els.priceValue.classList.add('is-updating');
  clearTimeout(renderPrice._flashTimer);
  renderPrice._flashTimer = setTimeout(() => els.priceValue.classList.remove('is-updating'), 250);

  els.priceBreakdown.innerHTML = lines
    .map(
      (line) => `
      <div class="price-breakdown__row">
        <span>${line.label}</span>
        <span>${currencyFormatter.format(Math.round(line.amount))}</span>
      </div>`
    )
    .join('') +
    `<div class="price-breakdown__row price-breakdown__row--total">
       <span>Estimated total</span>
       <span>${currencyFormatter.format(total)}</span>
     </div>`;

  return total;
}
