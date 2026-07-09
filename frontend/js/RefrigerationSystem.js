/**
 * RefrigerationSystem.js
 * ---------------------------------------------------------------------------
 * Calculates refrigeration equipment requirements based on box volume and
 * application type, and renders the appropriate 3D assets (evaporators and
 * condensing units) into the scene with precise positioning.
 *
 * This module is isolated from structural building logic to ensure we never
 * break existing wall/door/panel placement.
 * ---------------------------------------------------------------------------
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PANEL_THICKNESS_FT } from './config.js';

const loader = new GLTFLoader();

/**
 * Refrigeration equipment sizing matrix based on cubic volume and application type.
 * Prices are fixed per the specification.
 */
const REFRIGERATION_MATRIX = {
  cooler: [
    { maxVolume: 640, condenser: '2_ton_unit.glb', evaporator: '2_fan_evaporator.glb', condenserPrice: 3895, evaporatorPrice: 2260 },
    { maxVolume: 1120, condenser: '3_ton_unit.glb', evaporator: '3_fan_evaporator.glb', condenserPrice: 4495, evaporatorPrice: 2600 },
    { maxVolume: 1920, condenser: '4_ton_unit.glb', evaporator: '4_fan_evaporator.glb', condenserPrice: 4895, evaporatorPrice: 3195 },
    { maxVolume: Infinity, condenser: '5_ton_unit.glb', evaporator: '5_fan_evaporator.glb', condenserPrice: 5109, evaporatorPrice: 3495 }
  ],
  freezer: [
    { maxVolume: 400, condenser: '2_ton_unit.glb', evaporator: '2_fan_evaporator.glb', condenserPrice: 3895, evaporatorPrice: 2260 },
    { maxVolume: 800, condenser: '3_ton_unit.glb', evaporator: '3_fan_evaporator.glb', condenserPrice: 4495, evaporatorPrice: 2600 },
    { maxVolume: 1300, condenser: '4_ton_unit.glb', evaporator: '4_fan_evaporator.glb', condenserPrice: 4895, evaporatorPrice: 3195 },
    { maxVolume: Infinity, condenser: '5_ton_unit.glb', evaporator: '5_fan_evaporator.glb', condenserPrice: 5109, evaporatorPrice: 3495 }
  ]
};

/**
 * Determines the required refrigeration equipment based on configuration.
 * @param {object} config - CONFIG object with appType, width, depth, height
 * @returns {object} Equipment specification with asset names and prices
 */
export function calculateRefrigerationRequirements(config) {
  const volume = config.width * config.depth * config.height;
  const appType = config.appType; // 'cooler' or 'freezer'

  const matrix = REFRIGERATION_MATRIX[appType];
  const equipment = matrix.find(tier => volume <= tier.maxVolume);

  if (!equipment) {
    console.warn(`[RefrigerationSystem] No equipment found for ${appType} volume ${volume.toFixed(0)} cu ft`);
    return null;
  }

  console.info(
    `[RefrigerationSystem] ${appType} ${volume.toFixed(0)} cu ft requires: ` +
    `${equipment.condenser} ($${equipment.condenserPrice}) + ${equipment.evaporator} ($${equipment.evaporatorPrice})`
  );

  return {
    volume,
    condenser: equipment.condenser,
    evaporator: equipment.evaporator,
    condenserPrice: equipment.condenserPrice,
    evaporatorPrice: equipment.evaporatorPrice,
    requires3Phase: equipment.condenser === '5_ton_unit.glb'
  };
}

/**
 * Loads a refrigeration GLB asset and returns the scene object.
 * @param {string} filename - e.g., '2_fan_evaporator.glb'
 * @returns {Promise<THREE.Object3D|null>}
 */
async function loadRefrigerationAsset(filename) {
  const path = `assets/models/${filename}`;

  return new Promise((resolve) => {
    loader.load(
      path,
      (gltf) => {
        console.info(`[RefrigerationSystem] Loaded ${filename}`);
        resolve(gltf.scene);
      },
      undefined,
      (err) => {
        console.warn(`[RefrigerationSystem] Could not load ${filename}:`, err);
        resolve(null);
      }
    );
  });
}

/**
 * Scales and positions an asset to fit specific target dimensions while
 * preserving aspect ratio and centering it properly.
 * @param {THREE.Object3D} object - loaded GLB scene
 * @param {number} targetWidth - desired width in feet (or null to preserve)
 * @param {number} targetHeight - desired height in feet (or null to preserve)
 * @param {number} targetDepth - desired depth in feet (or null to preserve)
 * @returns {THREE.Group} - positioned and scaled wrapper
 */
function fitEquipmentAsset(object, targetWidth = null, targetHeight = null, targetDepth = null) {
  const clone = object.clone(true);

  // Enable shadows
  clone.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  // Calculate scale factors (preserve dimensions if target is null)
  const scale = {
    x: targetWidth !== null && size.x > 1e-6 ? targetWidth / size.x : 1,
    y: targetHeight !== null && size.y > 1e-6 ? targetHeight / size.y : 1,
    z: targetDepth !== null && size.z > 1e-6 ? targetDepth / size.z : 1
  };

  // Center the object first
  const centeringGroup = new THREE.Group();
  centeringGroup.position.copy(center).negate();
  centeringGroup.add(clone);

  const wrapper = new THREE.Group();
  wrapper.scale.set(scale.x, scale.y, scale.z);
  wrapper.add(centeringGroup);

  return wrapper;
}

/**
 * Renders the evaporator unit inside the cooler.
 * Positioned: ceiling-mounted, centered on back wall, facing forward.
 * @param {THREE.Group} root - scene root to add to
 * @param {object} config - CONFIG with dimensions
 * @param {string} evaporatorFilename - e.g., '2_fan_evaporator.glb'
 */
export async function renderEvaporator(root, config, evaporatorFilename) {
  const asset = await loadRefrigerationAsset(evaporatorFilename);
  if (!asset) {
    console.warn(`[RefrigerationSystem] Evaporator asset ${evaporatorFilename} not available, skipping render`);
    return;
  }

  const evaporator = fitEquipmentAsset(asset);

  // Get the bounding box of the fitted evaporator to know its actual dimensions
  const evapBox = new THREE.Box3().setFromObject(evaporator);
  const evapSize = new THREE.Vector3();
  evapBox.getSize(evapSize);

  // Check if evaporator width exceeds box width (validation warning)
  if (evapSize.x > config.width) {
    console.warn(
      `[RefrigerationSystem] Evaporator width ${evapSize.x.toFixed(2)}ft exceeds box width ${config.width}ft`
    );
  }

  // Position at ceiling, centered on back wall
  evaporator.position.set(
    config.width / 2,                    // Centered horizontally
    config.height - evapSize.y / 2,      // Flush against ceiling (hanging down)
    config.depth - config.depth * 0.25   // 75% toward the back wall
  );

  // Rotate to face forward (fans toward front doors)
  evaporator.rotation.y = Math.PI; // 180 degrees to face forward

  evaporator.userData.refrigerationComponent = 'evaporator';
  root.add(evaporator);

  console.info(
    `[RefrigerationSystem] Evaporator positioned at x=${evaporator.position.x.toFixed(2)}, ` +
    `y=${evaporator.position.y.toFixed(2)}, z=${evaporator.position.z.toFixed(2)}`
  );
}

/**
 * Renders the condensing unit(s) outside the cooler.
 * Positioned: behind the cooler, on ground level, adjacent to back wall.
 * @param {THREE.Group} root - scene root to add to
 * @param {object} config - CONFIG with dimensions
 * @param {string} condenserFilename - e.g., '2_ton_unit.glb'
 */
export async function renderCondenser(root, config, condenserFilename) {
  const asset = await loadRefrigerationAsset(condenserFilename);
  if (!asset) {
    console.warn(`[RefrigerationSystem] Condenser asset ${condenserFilename} not available, skipping render`);
    return;
  }

  // Realistic condensing unit dimensions based on tonnage
  // Industry-standard sizes for commercial condensing units (approximate)
  const condenserSizes = {
    '2_ton_unit.glb': { width: 3.0, height: 2.5, depth: 2.5 },  // 2 ton: ~36"W × 30"H × 30"D
    '3_ton_unit.glb': { width: 3.5, height: 3.0, depth: 3.0 },  // 3 ton: ~42"W × 36"H × 36"D
    '4_ton_unit.glb': { width: 4.0, height: 3.5, depth: 3.5 },  // 4 ton: ~48"W × 42"H × 42"D
    '5_ton_unit.glb': { width: 4.5, height: 4.0, depth: 4.0 }   // 5 ton: ~54"W × 48"H × 48"D
  };

  const targetSize = condenserSizes[condenserFilename] || { width: 3.0, height: 2.5, depth: 2.5 };
  const condenser = fitEquipmentAsset(asset, targetSize.width, targetSize.height, targetSize.depth);

  // Position: behind cooler (beyond back wall), on ground, centered horizontally
  condenser.position.set(
    config.width / 2,                           // Centered horizontally
    targetSize.height / 2,                      // Sitting on ground (Y=0 floor)
    config.depth + PANEL_THICKNESS_FT + targetSize.depth / 2 + 0.5  // Behind back wall with clearance
  );

  condenser.userData.refrigerationComponent = 'condenser';
  root.add(condenser);

  console.info(
    `[RefrigerationSystem] Condenser positioned at x=${condenser.position.x.toFixed(2)}, ` +
    `y=${condenser.position.y.toFixed(2)}, z=${condenser.position.z.toFixed(2)}`
  );
}

/**
 * Main entry point: calculates requirements and renders both evaporator and condenser.
 * @param {THREE.Group} root - scene root
 * @param {object} config - CONFIG object
 * @returns {Promise<object>} Equipment specification with prices
 */
export async function buildRefrigerationSystem(root, config) {
  const requirements = calculateRefrigerationRequirements(config);

  if (!requirements) {
    console.warn('[RefrigerationSystem] Could not determine refrigeration requirements');
    return null;
  }

  // Render both components
  await Promise.all([
    renderEvaporator(root, config, requirements.evaporator),
    renderCondenser(root, config, requirements.condenser)
  ]);

  return requirements;
}
