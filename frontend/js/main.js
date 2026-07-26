/**
 * main.js
 * ---------------------------------------------------------------------------
 * Boots the viewport, wires every configurator control to CONFIG, and keeps
 * the 3D model + price bar in sync with user input. This is the only file
 * that talks to the DOM directly -- scene.js/builder.js/pricing.js stay
 * UI-agnostic so they could be reused behind a different front end.
 * ---------------------------------------------------------------------------
 */
import * as THREE from 'three';
import { CONFIG, LIMITS } from './config.js';
import { createViewport, frameCameraToBounds, setPresetView } from './scene.js';
import { createMaterials, applyFinish, buildCooler, preloadAssetLibrary } from './builder.js';
import { renderPrice } from './pricing.js';
import { calculateRefrigerationRequirements } from './RefrigerationSystem.js';
import { apiCall, API_BASE_URL } from './api-config.js';

// Premium Features - Foundational
import { ConfigurationManager } from './ConfigurationManager.js';
import { CameraAnimations } from './CameraAnimations.js';
import { ScreenshotExporter } from './ScreenshotExporter.js';
import { PriceAnimations } from './PriceAnimations.js';
import { ARExporter } from './ARExporter.js';
import { LoadingScreen, injectLoadingStyles } from './LoadingScreen.js';
import { ProjectsDashboard } from './ProjectsDashboard.js';

// Premium Features - Advanced
import { PartHighlighter } from './PartHighlighter.js';
import { RealisticMaterials } from './RealisticMaterials.js';
import { Microinteractions, showToast as showPremiumToast } from './Microinteractions.js';
import { PerformanceOptimizer } from './PerformanceOptimizer.js';
import { AccessibilityManager } from './AccessibilityManager.js';
import { EnvironmentSwitcher } from './EnvironmentSwitcher.js';
import { PDFQuoteGenerator } from './PDFQuoteGenerator.js';

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const canvas = document.getElementById('scene-canvas');
const els = {
  priceValue: document.getElementById('priceValue'),
  priceBreakdown: document.getElementById('priceBreakdown'),
  breakdownToggle: document.getElementById('breakdownToggle'),
  viewportLoading: document.getElementById('viewportLoading'),
  specLength: document.getElementById('specLength'),
  specWidth: document.getElementById('specWidth'),
  specHeight: document.getElementById('specHeight'),
  specFootprint: document.getElementById('specFootprint'),
  toast: document.getElementById('toast'),
  warningBanner: document.getElementById('warningBanner'),
  welcomeScreen: document.getElementById('welcomeScreen'),
};

// ---------------------------------------------------------------------------
// Welcome Screen - Preconfigured Cooler Options
// ---------------------------------------------------------------------------
const preconfiguredCoolers = {
  '8-door': {
    appType: 'cooler',
    depth: 8,
    width: 24,
    height: 8,
    displayDoors: 8,
    entryDoors: ['side-right'],
    finish: 'galvalume',
    accessories: {
      ledLighting: true,
      reinforcedFloor: false
    }
  },
  '10-door': {
    appType: 'cooler',
    depth: 8,
    width: 29,
    height: 8,
    displayDoors: 10,
    entryDoors: ['side-right'],
    finish: 'galvalume',
    accessories: {
      ledLighting: true,
      reinforcedFloor: false
    }
  },
  '12-door': {
    appType: 'cooler',
    depth: 8,
    width: 35,
    height: 8,
    displayDoors: 12,
    entryDoors: ['side-right'],
    finish: 'galvalume',
    accessories: {
      ledLighting: true,
      reinforcedFloor: false
    }
  },
  '20-door': {
    appType: 'cooler',
    depth: 8,
    width: 55,
    height: 8,
    displayDoors: 20,
    entryDoors: ['side-right'],
    finish: 'galvalume',
    accessories: {
      ledLighting: true,
      reinforcedFloor: true
    }
  },
  'custom': {
    appType: 'cooler',
    depth: 12,
    width: 10,
    height: 8,
    displayDoors: 0,
    entryDoors: ['side-right'],
    finish: 'galvalume',
    accessories: {
      ledLighting: true,
      reinforcedFloor: false
    }
  }
};

function loadPreconfiguredCooler(configName) {
  const config = preconfiguredCoolers[configName];
  if (!config) return;

  // Apply configuration to CONFIG object
  CONFIG.appType = config.appType;
  CONFIG.depth = config.depth;
  CONFIG.width = config.width;
  CONFIG.height = config.height;
  CONFIG.displayDoors = config.displayDoors;
  CONFIG.entryDoors = [...config.entryDoors];
  CONFIG.finish = config.finish;
  CONFIG.accessories = { ...config.accessories };

  // Update UI to reflect the loaded configuration
  updateUIFromConfig();

  // Hide welcome screen
  els.welcomeScreen.classList.add('is-hidden');

  // Refresh the 3D model and price
  refreshAll({ reframe: true });
}

function updateUIFromConfig() {
  // Application Type
  document.querySelector(`input[name="appType"][value="${CONFIG.appType}"]`).checked = true;

  // Depth chips
  document.querySelectorAll('#depthChips .chip').forEach(chip => {
    chip.classList.toggle('is-selected', Number(chip.dataset.value) === CONFIG.depth);
  });

  // Width
  document.getElementById('widthInput').value = CONFIG.width;

  // Height
  document.getElementById('heightSelect').value = CONFIG.height;

  // Display doors
  syncDisplayDoorsUI();

  // Entry doors
  document.querySelectorAll('input[name="entryDoor"]').forEach(checkbox => {
    checkbox.checked = CONFIG.entryDoors.includes(checkbox.value);
  });

  // Finish
  document.querySelector(`input[name="finish"][value="${CONFIG.finish}"]`).checked = true;

  // Accessories
  document.getElementById('toggleLED').checked = CONFIG.accessories.ledLighting;
  document.getElementById('toggleFloor').checked = CONFIG.accessories.reinforcedFloor;
}

// Welcome screen button handlers
document.querySelectorAll('.cooler-option').forEach(button => {
  button.addEventListener('click', () => {
    const configName = button.dataset.config;
    loadPreconfiguredCooler(configName);
  });
});

// ---------------------------------------------------------------------------
// Three.js bootstrap
// ---------------------------------------------------------------------------
const { scene, camera, renderer, controls, resize } = createViewport(canvas);
const materials = createMaterials();
applyFinish(materials, CONFIG.finish);

// ---------------------------------------------------------------------------
// Initialize Premium Features - Loading Screen
// ---------------------------------------------------------------------------
injectLoadingStyles();
const loadingScreen = new LoadingScreen();
loadingScreen.show(5); // Expecting 5 assets to load

// Loaded once at startup; entries are null for any module that isn't on
// disk yet, in which case buildCooler() falls back to procedural geometry
// for that piece automatically. Check the browser console for load
// warnings if a module you expect to see isn't showing up.
loadingScreen.incrementProgress('Loading asset library...');
const loadedAssets = await preloadAssetLibrary();

const coolerRoot = new THREE.Group();
scene.add(coolerRoot);

// ---------------------------------------------------------------------------
// Initialize Premium Features
// ---------------------------------------------------------------------------
loadingScreen.incrementProgress('Initializing premium features...');

// Foundational
const configManager = new ConfigurationManager(camera, controls);
const cameraAnimator = new CameraAnimations(camera, controls);
const screenshotExporter = new ScreenshotExporter(renderer, scene, camera);
const priceAnimator = new PriceAnimations(els.priceValue);
const arExporter = new ARExporter(scene);
const projectsDashboard = new ProjectsDashboard(configManager, () => {
  refreshAll({ reframe: false });
});

// Advanced
// Temporarily disabled to prevent interference with existing functionality
// const microinteractions = new Microinteractions();
const performanceOptimizer = new PerformanceOptimizer(renderer, scene, camera);
// const accessibilityManager = new AccessibilityManager(scene, camera, controls);
const environmentSwitcher = new EnvironmentSwitcher(scene, renderer, camera);
const pdfGenerator = new PDFQuoteGenerator(screenshotExporter);

// Note: These features require post-processing, which we'll integrate later
// const partHighlighter = new PartHighlighter(renderer, scene, camera, canvas);
// const realisticMaterials = new RealisticMaterials(renderer, scene);

// Enhance all buttons with microinteractions
// microinteractions.enhanceAllButtons();

// Set default environment (optional)
// environmentSwitcher.switchEnvironment('warehouse');

loadingScreen.incrementProgress('Building initial model...');

function rebuildModel({ reframe = false } = {}) {
  buildCooler(coolerRoot, CONFIG, materials, loadedAssets);
  if (reframe) frameCameraToBounds(camera, controls, CONFIG.width, CONFIG.depth, CONFIG.height);
  updateSpecReadout();
}

function updateSpecReadout() {
  els.specLength.textContent = `${CONFIG.depth}'`;
  els.specWidth.textContent = `${CONFIG.width}'`;
  els.specHeight.textContent = `${CONFIG.height}'`;
  els.specFootprint.textContent = `${CONFIG.width * CONFIG.depth} sq ft`;
}

function refreshPrice() {
  renderPrice(CONFIG, els);
  // Animate price changes
  const priceText = els.priceValue.textContent.replace(/[^0-9.]/g, '');
  const priceValue = parseFloat(priceText) || 0;
  if (priceValue > 0) {
    priceAnimator.animateTo(priceValue);
  }
  // Update 3-phase warning visibility
  updateWarningBanner();
}

function updateWarningBanner() {
  const refrigeration = calculateRefrigerationRequirements(CONFIG);
  if (refrigeration && refrigeration.requires3Phase) {
    els.warningBanner.style.display = 'flex';
  } else {
    els.warningBanner.style.display = 'none';
  }
}

function refreshAll({ reframe = false } = {}) {
  rebuildModel({ reframe });
  refreshPrice();
}

// initial build
loadingScreen.incrementProgress('Rendering scene...');
refreshAll({ reframe: true });
loadingScreen.hide();
hideLoadingOverlay();

function hideLoadingOverlay() {
  requestAnimationFrame(() => els.viewportLoading.classList.add('is-hidden'));
}

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();

  // Update systems
  performanceOptimizer.update();
  controls.update();

  // Render
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------------------
// TAB 1: Structure & Dimensions
// ---------------------------------------------------------------------------
document.querySelectorAll('input[name="appType"]').forEach((radio) => {
  radio.addEventListener('change', (e) => {
    CONFIG.appType = e.target.value;
    refreshPrice();
  });
});

const depthChips = document.querySelectorAll('#depthChips .chip');
depthChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    depthChips.forEach((c) => c.classList.remove('is-selected'));
    chip.classList.add('is-selected');
    CONFIG.depth = clamp(Number(chip.dataset.value), LIMITS.depth[0], LIMITS.depth[1]);
    refreshAll({ reframe: true });
  });
});

const widthInput = document.getElementById('widthInput');
widthInput.addEventListener('input', () => {
  const value = clamp(Number(widthInput.value) || LIMITS.width[0], LIMITS.width[0], LIMITS.width[1]);
  CONFIG.width = value;
  // Re-clamp display doors if width changed - can't have more doors than segments
  const maxAllowed = maxDisplayDoorsForWidth();
  if (CONFIG.displayDoors > maxAllowed) {
    CONFIG.displayDoors = maxAllowed;
    syncDisplayDoorsUI();
  }
  refreshAll({ reframe: true });
});

const heightSelect = document.getElementById('heightSelect');
heightSelect.addEventListener('change', () => {
  CONFIG.height = clamp(Number(heightSelect.value), LIMITS.height[0], LIMITS.height[1]);
  refreshAll({ reframe: true });
});

// ---------------------------------------------------------------------------
// TAB 2: Front Display Doors
// ---------------------------------------------------------------------------
const displayDoorsValue = document.getElementById('displayDoorsValue');
document.getElementById('displayDoorsPlus').addEventListener('click', () => {
  const maxAllowed = maxDisplayDoorsForWidth();
  const newDoorCount = CONFIG.displayDoors + 1;

  // If we exceed max allowed, automatically increase width
  if (newDoorCount > maxAllowed) {
    const DISPLAY_DOOR_WIDTH = 2.5;  // 30" = 2.5ft per display door
    const ENTRY_DOOR_WIDTH = 3.0;    // 36" = 3ft per entry door
    const SPACING_BUFFER = 3.0;      // Extra spacing on sides for better appearance

    // Calculate required width for the new door count
    let requiredWidth = newDoorCount * DISPLAY_DOOR_WIDTH;

    // Add space for front entry doors
    const hasFrontLeft = CONFIG.entryDoors.includes('front-left');
    const hasFrontRight = CONFIG.entryDoors.includes('front-right');
    if (hasFrontLeft) requiredWidth += ENTRY_DOOR_WIDTH;
    if (hasFrontRight) requiredWidth += ENTRY_DOOR_WIDTH;

    // Add spacing buffer for aesthetics
    requiredWidth += SPACING_BUFFER;

    // Round up to nearest foot and ensure within limits
    requiredWidth = Math.ceil(requiredWidth);
    CONFIG.width = clamp(requiredWidth, LIMITS.width[0], LIMITS.width[1]);

    // Update width input field
    widthInput.value = CONFIG.width;
  }

  CONFIG.displayDoors = clamp(newDoorCount, 0, LIMITS.displayDoors[1]);
  syncDisplayDoorsUI();
  refreshAll({ reframe: true });

  // Animate to front view to show the doors
  cameraAnimator.animateToFront(CONFIG.width, CONFIG.depth, CONFIG.height);
});
document.getElementById('displayDoorsMinus').addEventListener('click', () => {
  const newDoorCount = Math.max(0, CONFIG.displayDoors - 1);

  // Automatically decrease width based on door count
  const DISPLAY_DOOR_WIDTH = 2.5;  // 30" = 2.5ft per display door
  const ENTRY_DOOR_WIDTH = 3.0;    // 36" = 3ft per entry door
  const SPACING_BUFFER = 3.0;      // Extra spacing on sides for better appearance

  // Calculate optimal width for the new door count
  let optimalWidth = newDoorCount * DISPLAY_DOOR_WIDTH;

  // Add space for front entry doors
  const hasFrontLeft = CONFIG.entryDoors.includes('front-left');
  const hasFrontRight = CONFIG.entryDoors.includes('front-right');
  if (hasFrontLeft) optimalWidth += ENTRY_DOOR_WIDTH;
  if (hasFrontRight) optimalWidth += ENTRY_DOOR_WIDTH;

  // Add spacing buffer for aesthetics
  optimalWidth += SPACING_BUFFER;

  // Round up to nearest foot and ensure within limits
  optimalWidth = Math.ceil(optimalWidth);

  // Only decrease width if the new optimal width is smaller than current
  if (optimalWidth < CONFIG.width) {
    CONFIG.width = clamp(optimalWidth, LIMITS.width[0], LIMITS.width[1]);
    // Update width input field
    widthInput.value = CONFIG.width;
  }

  CONFIG.displayDoors = newDoorCount;
  syncDisplayDoorsUI();
  refreshAll({ reframe: true });

  // Animate to front view to show the doors
  cameraAnimator.animateToFront(CONFIG.width, CONFIG.depth, CONFIG.height);
});
function maxDisplayDoorsForWidth() {
  // Calculate based on actual door widths
  const DISPLAY_DOOR_WIDTH = 2.5;  // 30" = 2.5ft per display door
  const ENTRY_DOOR_WIDTH = 3.0;    // 36" = 3ft per entry door

  let availableWidth = CONFIG.width;

  // Subtract space for front entry doors
  const hasFrontLeft = CONFIG.entryDoors.includes('front-left');
  const hasFrontRight = CONFIG.entryDoors.includes('front-right');

  if (hasFrontLeft) availableWidth -= ENTRY_DOOR_WIDTH;
  if (hasFrontRight) availableWidth -= ENTRY_DOOR_WIDTH;

  // Calculate max display doors
  let maxFit = Math.floor(availableWidth / DISPLAY_DOOR_WIDTH);

  // Prefer odd number of doors for better centering (unless it fits exactly)
  const remainder = availableWidth % DISPLAY_DOOR_WIDTH;
  if (maxFit > 0 && maxFit % 2 === 0 && remainder < 0.1) {
    // Doors fit exactly and it's even - use one less for centering
    maxFit -= 1;
  }

  return Math.min(LIMITS.displayDoors[1], Math.max(0, maxFit));
}
function syncDisplayDoorsUI() {
  displayDoorsValue.textContent = String(CONFIG.displayDoors);
}

// ---------------------------------------------------------------------------
// TAB 3: Entry Doors
// ---------------------------------------------------------------------------
document.querySelectorAll('input[name="entryDoor"]').forEach((checkbox) => {
  checkbox.addEventListener('change', (e) => {
    const checked = Array.from(document.querySelectorAll('input[name="entryDoor"]:checked')).map(
      (c) => c.value
    );
    CONFIG.entryDoors = checked;
    // Front entry doors compete with display doors for wall space --
    // re-clamp so the model never tries to over-allocate the front wall.
    const maxAllowed = maxDisplayDoorsForWidth();
    if (CONFIG.displayDoors > maxAllowed) {
      CONFIG.displayDoors = maxAllowed;
      syncDisplayDoorsUI();
    }
    refreshAll();

    // Animate camera to show the selected door location
    if (e.target.checked) {
      const doorLocation = e.target.value;
      if (doorLocation === 'front-left' || doorLocation === 'front-right') {
        cameraAnimator.animateToFront(CONFIG.width, CONFIG.depth, CONFIG.height);
        document.querySelectorAll('.tool-btn[data-view]').forEach((b) => b.classList.remove('is-active'));
        const activeBtn = document.querySelector('.tool-btn[data-view="front"]');
        if (activeBtn) activeBtn.classList.add('is-active');
      } else if (doorLocation === 'side-left') {
        // Animate to left side view
        cameraAnimator.animateToSide(CONFIG.width, CONFIG.depth, CONFIG.height, 'left');
        document.querySelectorAll('.tool-btn[data-view]').forEach((b) => b.classList.remove('is-active'));
        const activeBtn = document.querySelector('.tool-btn[data-view="side"]');
        if (activeBtn) activeBtn.classList.add('is-active');
      } else if (doorLocation === 'side-right') {
        // Animate to right side view (opposite of left)
        cameraAnimator.animateToSide(CONFIG.width, CONFIG.depth, CONFIG.height, 'right');
        document.querySelectorAll('.tool-btn[data-view]').forEach((b) => b.classList.remove('is-active'));
        const activeBtn = document.querySelector('.tool-btn[data-view="side"]');
        if (activeBtn) activeBtn.classList.add('is-active');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// TAB 4: Panels & Finishes
// ---------------------------------------------------------------------------
document.querySelectorAll('input[name="finish"]').forEach((radio) => {
  radio.addEventListener('change', (e) => {
    CONFIG.finish = e.target.value;
    // In-place material mutation: instant visual update, no rebuild,
    // camera framing is completely undisturbed.
    applyFinish(materials, CONFIG.finish);
    refreshPrice();
  });
});

// ---------------------------------------------------------------------------
// TAB 5: Interior Accessories
// ---------------------------------------------------------------------------
document.getElementById('toggleLED').addEventListener('change', (e) => {
  CONFIG.accessories.ledLighting = e.target.checked;
  refreshAll();
});
document.getElementById('toggleFloor').addEventListener('change', (e) => {
  CONFIG.accessories.reinforcedFloor = e.target.checked;
  refreshAll();
});

// ---------------------------------------------------------------------------
// Accordion behavior + step-track sync (Mimeeq-style: one panel open at a
// time, header doubles as a progress indicator)
// ---------------------------------------------------------------------------
const accordionItems = document.querySelectorAll('.accordion-item');
accordionItems.forEach((item) => {
  const header = item.querySelector('.accordion-header');
  if (header) {
    header.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');
      accordionItems.forEach((i) => i.classList.remove('is-open'));
      if (!isOpen) {
        item.classList.add('is-open');

        // Automatically change camera angle based on tab with animation
        const tabName = item.dataset.tab;
        const cameraPresetMap = {
          'dimensions': 'orbit',
          'displayDoors': 'front',
          'entryDoors': 'orbit',
          'finishes': 'orbit',
          'accessories': 'interior'
        };
        const preset = cameraPresetMap[tabName];
        if (preset) {
          // Use animated camera transitions
          switch (preset) {
            case 'front':
              cameraAnimator.animateToFront(CONFIG.width, CONFIG.depth, CONFIG.height);
              break;
            case 'top':
              cameraAnimator.animateToTop(CONFIG.width, CONFIG.depth, CONFIG.height);
              break;
            case 'side':
              cameraAnimator.animateToSide(CONFIG.width, CONFIG.depth, CONFIG.height);
              break;
            case 'interior':
              cameraAnimator.animateToInterior(CONFIG.width, CONFIG.depth, CONFIG.height);
              break;
            case 'orbit':
              cameraAnimator.animateToOrbit(CONFIG.width, CONFIG.depth, CONFIG.height);
              break;
          }
          // Update toolbar button active state
          document.querySelectorAll('.tool-btn[data-view]').forEach((b) => b.classList.remove('is-active'));
          const activeBtn = document.querySelector(`.tool-btn[data-view="${preset}"]`);
          if (activeBtn) activeBtn.classList.add('is-active');
        }
      }
      syncStepTrack();
    });
  }
});
function syncStepTrack() {
  const openTab = document.querySelector('.accordion-item.is-open')?.dataset.tab;
  document.querySelectorAll('.step').forEach((step) => {
    step.classList.toggle('is-active', step.dataset.step === openTab);
  });
}

// ---------------------------------------------------------------------------
// Viewport toolbar: camera presets with smooth animations
// ---------------------------------------------------------------------------

/**
 * Hide/show back wall for interior view
 */
function setBackWallVisibility(visible) {
  coolerRoot.traverse((child) => {
    if (child.name && child.name.includes('back')) {
      child.visible = visible;
    }
  });
}

document.querySelectorAll('.tool-btn[data-view]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.tool-btn[data-view]').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');

    const view = btn.dataset.view;

    // Show/hide back wall based on view
    if (view === 'interior') {
      setBackWallVisibility(false); // Hide back wall for interior view
    } else {
      setBackWallVisibility(true);  // Show back wall for all other views
    }

    switch (view) {
      case 'front':
        await cameraAnimator.animateToFront(CONFIG.width, CONFIG.depth, CONFIG.height);
        break;
      case 'top':
        await cameraAnimator.animateToTop(CONFIG.width, CONFIG.depth, CONFIG.height);
        break;
      case 'side':
        await cameraAnimator.animateToSide(CONFIG.width, CONFIG.depth, CONFIG.height);
        break;
      case 'interior':
        await cameraAnimator.animateToInterior(CONFIG.width, CONFIG.depth, CONFIG.height);
        break;
      case 'orbit':
        await cameraAnimator.animateToOrbit(CONFIG.width, CONFIG.depth, CONFIG.height);
        break;
    }
  });
});
document.getElementById('resetViewBtn').addEventListener('click', () => {
  frameCameraToBounds(camera, controls, CONFIG.width, CONFIG.depth, CONFIG.height);
});

// ---------------------------------------------------------------------------
// Price breakdown toggle
// ---------------------------------------------------------------------------
els.breakdownToggle.addEventListener('click', () => {
  els.priceBreakdown.classList.toggle('is-open');
  els.breakdownToggle.textContent = els.priceBreakdown.classList.contains('is-open')
    ? 'Hide breakdown ▴'
    : 'View breakdown ▾';
});

// ---------------------------------------------------------------------------
// Save / Quote actions -> POST to Flask backend
// ---------------------------------------------------------------------------
document.getElementById('saveConfigBtn').addEventListener('click', () => {
  localStorageSafeSave(CONFIG);
  showToast('Configuration saved to this browser.');
});

document.getElementById('requestQuoteBtn').addEventListener('click', async () => {
  const button = document.getElementById('requestQuoteBtn');
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = 'Creating Checkout…';

  try {
    const payload = buildQuotePayload();

    // Capture a screenshot of the 3D model to include with the order
    let imageDataUrl = null;
    try {
      button.textContent = 'Capturing preview…';
      // Capture a smaller image for Shopify (800x600 is good for thumbnails)
      imageDataUrl = await screenshotExporter.captureAsDataURL({
        width: 800,
        height: 600,
        format: 'jpeg',
        quality: 0.85,
        download: false
      });
    } catch (err) {
      console.warn('Failed to capture screenshot, continuing without image:', err);
    }

    // Add the image to the payload if captured successfully
    if (imageDataUrl) {
      payload.imageDataUrl = imageDataUrl;
    }

    button.textContent = 'Creating Checkout…';
    console.log('Sending checkout request with payload:', payload);

    const response = await apiCall('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    console.log('Checkout response status:', response.status);

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.error('Checkout failed with error:', errBody);
      throw new Error(errBody.error || `Server responded ${response.status}`);
    }

    const data = await response.json();
    console.log('Checkout response data:', data);

    if (!data.success) {
      throw new Error(data.error || 'Failed to create checkout');
    }

    // Open Shopify checkout in new tab (required when embedded in iframe)
    console.log('Opening checkout in new tab:', data.invoiceUrl);
    const checkoutWindow = window.open(data.invoiceUrl, '_blank');

    // Check if popup was blocked
    if (!checkoutWindow || checkoutWindow.closed || typeof checkoutWindow.closed == 'undefined') {
      // Popup blocked - show manual link
      showToast('Please allow popups, then click here to checkout');

      // Create a temporary button to manually open checkout
      const manualLink = document.createElement('a');
      manualLink.href = data.invoiceUrl;
      manualLink.target = '_blank';
      manualLink.textContent = 'Open Checkout';
      manualLink.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#00a885;color:white;padding:20px 40px;border-radius:8px;text-decoration:none;font-size:18px;z-index:10000;box-shadow:0 4px 12px rgba(0,0,0,0.3)';
      document.body.appendChild(manualLink);

      setTimeout(() => manualLink.remove(), 10000);
    } else {
      showToast('Opening checkout in new tab...');
    }

    button.disabled = false;
    button.textContent = originalLabel;
  } catch (err) {
    console.error('Checkout creation failed:', err);
    showToast(`Could not create checkout: ${err.message}`);
    button.disabled = false;
    button.textContent = originalLabel;
  }
});

/** Builds the exact JSON payload contract expected by POST /api/quote. */
function buildQuotePayload() {
  return {
    appType: CONFIG.appType,
    dimensions: {
      depth: CONFIG.depth,
      width: CONFIG.width,
      height: CONFIG.height,
    },
    displayDoors: CONFIG.displayDoors,
    entryDoors: CONFIG.entryDoors,
    finish: CONFIG.finish,
    accessories: { ...CONFIG.accessories },
  };
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatUsd(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

let toastTimer;
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('is-visible'), 3200);
}

function localStorageSafeSave(config) {
  try {
    window.localStorage.setItem('ameridoor.config', JSON.stringify(config));
  } catch (err) {
    console.warn('localStorage unavailable, configuration not persisted locally:', err);
  }
}

// ---------------------------------------------------------------------------
// Premium Features: Button Handlers
// ---------------------------------------------------------------------------

// Save configuration
document.getElementById('saveBtn')?.addEventListener('click', () => {
  const name = prompt('Enter a name for this configuration:');
  if (name) {
    configManager.saveToLocalStorage(name, buildQuotePayload());
    showPremiumToast('Configuration saved successfully!', { type: 'success' });
  }
});

// Share configuration
document.getElementById('shareBtn')?.addEventListener('click', async () => {
  try {
    const payload = buildQuotePayload();

    // Encode configuration as base64 URL parameter
    const configString = JSON.stringify(payload);
    const base64Config = btoa(configString);

    // Create shareable URL with config parameter
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('config', base64Config);
    const shareUrl = currentUrl.toString();

    // Copy to clipboard
    await navigator.clipboard.writeText(shareUrl);
    showPremiumToast('Share link copied to clipboard!', {
      type: 'success',
      title: 'Share Link Ready'
    });
  } catch (err) {
    console.error('Share failed:', err);
    showPremiumToast('Failed to generate share link', { type: 'error' });
  }
});

// Screenshot export
document.getElementById('screenshotBtn')?.addEventListener('click', async () => {
  try {
    showPremiumToast('Generating high-resolution render...', { type: 'info', duration: 0 });
    await screenshotExporter.capture4KPNG(false);
    showPremiumToast('Screenshot exported successfully!', { type: 'success' });
  } catch (err) {
    console.error('Screenshot failed:', err);
    showPremiumToast('Failed to export screenshot', { type: 'error' });
  }
});

// AR viewer - use Google Model Viewer for cross-platform AR
document.getElementById('arBtn')?.addEventListener('click', async () => {
  try {
    const button = document.getElementById('arBtn');
    const originalContent = button.innerHTML;
    button.disabled = true;
    button.textContent = 'Generating AR model...';

    showToast('Preparing AR view...');

    // Export GLB from Three.js scene
    const blob = await arExporter.exportAsGLB(coolerRoot);

    // Upload GLB to server
    const formData = new FormData();
    formData.append('model', blob, `cooler-${CONFIG.width}x${CONFIG.depth}x${CONFIG.height}.glb`);

    const response = await fetch(`${API_BASE_URL}/api/ar/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to upload AR model');
    }

    const data = await response.json();
    const modelUrl = data.url;

    console.log('AR model uploaded:', modelUrl);

    // Create Model Viewer dynamically
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;';

    const modelViewer = document.createElement('model-viewer');
    modelViewer.setAttribute('src', modelUrl);
    modelViewer.setAttribute('ar', '');
    modelViewer.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
    modelViewer.setAttribute('camera-controls', '');
    modelViewer.setAttribute('shadow-intensity', '1');
    modelViewer.setAttribute('auto-rotate', '');
    modelViewer.style.cssText = 'width:90%;max-width:600px;height:70%;background-color:transparent;';

    // AR button for model-viewer
    const arButton = document.createElement('button');
    arButton.slot = 'ar-button';
    arButton.style.cssText = 'background:#00a885;color:white;border:none;padding:16px 40px;border-radius:8px;font-size:18px;font-weight:bold;margin-top:20px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    arButton.textContent = 'View in Your Space';
    modelViewer.appendChild(arButton);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'background:transparent;color:white;border:2px solid white;padding:12px 30px;border-radius:8px;font-size:16px;margin-top:20px;cursor:pointer;';
    closeBtn.onclick = () => {
      document.body.removeChild(overlay);
      button.disabled = false;
      button.innerHTML = originalContent;
    };

    overlay.appendChild(modelViewer);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);

    showToast('Tap "View in Your Space" to launch AR');
  } catch (err) {
    console.error('AR export failed:', err);
    showToast(`Failed to create AR view: ${err.message}`);
    const button = document.getElementById('arBtn');
    button.disabled = false;
  }
});

// My Projects
document.getElementById('myProjectsBtn')?.addEventListener('click', () => {
  projectsDashboard.show();
});

// Export PDF Quote
document.getElementById('exportPDFBtn')?.addEventListener('click', async () => {
  try {
    // Build pricing data
    const pricing = {
      basePrice: 5000,
      doorPrice: CONFIG.displayDoors * 800 + CONFIG.entryDoors.length * 600,
      floorPrice: CONFIG.accessories.reinforcedFloor ? 1200 : 0,
      rampPrice: 0,
      lightingPrice: CONFIG.accessories.ledLighting ? 300 : 0,
      subtotal: 0,
      total: 0
    };
    pricing.subtotal = pricing.basePrice + pricing.doorPrice + pricing.floorPrice + pricing.rampPrice + pricing.lightingPrice;
    pricing.total = pricing.subtotal;

    showPremiumToast('Generating PDF quote...', { type: 'info', duration: 0 });

    await pdfGenerator.generateQuote(buildQuotePayload(), pricing, {
      quoteId: pdfGenerator.generateQuoteId(),
      includeImage: true,
      includeTerms: true
    });

    showPremiumToast('PDF quote generated successfully!', {
      type: 'success',
      title: 'Download Complete'
    });
  } catch (err) {
    console.error('PDF generation failed:', err);
    showPremiumToast('Failed to generate PDF: ' + err.message, { type: 'error' });
  }
});

// Load shared configuration from URL
const urlParams = new URLSearchParams(window.location.search);
const configParam = urlParams.get('config');
if (configParam) {
  (async () => {
    try {
      // Decode base64 configuration
      const configString = atob(configParam);
      const sharedConfig = JSON.parse(configString);

      // Apply loaded configuration
      Object.assign(CONFIG, sharedConfig);

      // Update UI to match loaded config
      if (sharedConfig.dimensions) {
        CONFIG.width = sharedConfig.dimensions.width;
        CONFIG.depth = sharedConfig.dimensions.depth;
        CONFIG.height = sharedConfig.dimensions.height;
      }

      refreshAll({ reframe: true });
      showPremiumToast('Shared configuration loaded successfully!', { type: 'success' });
    } catch (err) {
      console.error('Failed to load shared configuration:', err);
      showPremiumToast('Failed to load shared configuration', { type: 'error' });
    }
  })();
}
