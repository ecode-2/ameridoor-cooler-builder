/**
 * builder.js
 * ---------------------------------------------------------------------------
 * The "modular engine". Instead of loading one baked cooler model, this
 * assembles the box from repeated wall/roof/floor panel segments sized off
 * the current CONFIG, and swaps in door meshes at the segments a door was
 * placed at. This is the piece that makes "type 16ft depth, see it grow in
 * real time" work.
 *
 * Asset strategy:
 *   Each panel/door is built procedurally with BoxGeometry by default so the
 *   configurator is fully functional with zero external files. If real
 *   Blender-authored .glb modules exist at ASSET_PATHS, tryLoadModule() will
 *   load and use those instead -- swap in production art by just dropping
 *   files at those paths, no code changes required.
 * ---------------------------------------------------------------------------
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PANEL_SEGMENT_FT, PANEL_THICKNESS_FT } from './config.js';
import { buildRefrigerationSystem } from './RefrigerationSystem.js';

const loader = new GLTFLoader();

// Where production Blender exports would live. Missing files fail silently
// and fall back to procedural geometry -- see tryLoadModule().
// Version parameter added to force browser cache refresh when models are updated
const ASSET_VERSION = '20260726-0100'; // Update this when GLB files change
const ASSET_PATHS = {
  wallPanel: `assets/models/wall_panel.glb?v=${ASSET_VERSION}`,
  roofPanel: `assets/models/roof_panel.glb?v=${ASSET_VERSION}`,
  displayDoor: `assets/models/display_door.glb?v=${ASSET_VERSION}`,
  entryDoor: `assets/models/entry_door.glb?v=${ASSET_VERSION}`,
  header8: `assets/models/8ft_header.glb?v=${ASSET_VERSION}`,
  header10: `assets/models/10ft_header.glb?v=${ASSET_VERSION}`,
  header12: `assets/models/12ft_header.glb?v=${ASSET_VERSION}`,
};

// The wall is split into a fixed-height lower course plus a header course.
// Doors always occupy the lower course so changing 8/10/12 ft height raises
// the header/roof instead of stretching the door assets.
const NOMINAL_DOOR_HEIGHT_FT = 7;
const HEADER_ASSET_KEY_BY_HEIGHT = { 8: 'header8', 10: 'header10', 12: 'header12' };

/**
 * Loads every modular GLB asset in parallel, once, at startup. Each entry
 * resolves to the loaded Object3D, or null if that file isn't present yet
 * (missing assets fall back to procedural geometry -- see builder functions
 * below). A console message is logged either way so a bad path/filename is
 * obvious in devtools instead of silently doing nothing.
 */
export async function preloadAssetLibrary() {
  const entries = await Promise.all(
    Object.entries(ASSET_PATHS).map(async ([key, path]) => {
      const object = await new Promise((resolve) => {
        loader.load(
          path,
          (gltf) => resolve(gltf.scene),
          undefined,
          (err) => {
            console.warn(
              `[builder] Could not load "${path}" for "${key}" — using procedural geometry instead.`,
              err
            );
            resolve(null);
          }
        );
      });
      if (object) console.info(`[builder] Loaded modular asset "${key}" from ${path}`);
      return [key, object];
    })
  );
  return Object.fromEntries(entries);
}

/**
 * Clones a loaded GLB scene and fits it to an exact target width/height/
 * depth (feet), recentering it on its own bounding-box center first so the
 * result behaves like the procedural BoxGeometry it's replacing: centered
 * at local origin, ready to be positioned the same way.
 *
 * Scaling is non-uniform (independent X/Y/Z factors) so an artist-authored
 * module always fills the panel slot exactly -- author modules close to a
 * 1:1:1-ish box if you want to avoid visible stretching.
 */
const loggedAssets = new WeakSet();

/**
 * @param {THREE.Object3D} sourceObject - loaded GLB scene to clone/fit
 * @param {number} targetWidth
 * @param {number|null} targetHeight - pass null to preserve the source's
 *   own authored height unscaled.
 * @param {number} targetDepth
 * @param {THREE.Material|null} overrideMaterial
 * @param {boolean} flushFront - if true, anchors the object's exterior
 *   (min-Z) face at the same plane a standard PANEL_THICKNESS_FT-deep wall
 *   panel would sit at, instead of centering the (possibly much deeper)
 *   object on that plane. Without this, any module fit with a targetDepth
 *   greater than PANEL_THICKNESS_FT -- e.g. a door with real frame depth --
 *   ends up sticking out past the exterior wall face by half the
 *   difference, which is exactly the "door proud of the wall" symptom.
 */
function fitAssetToBox(
  sourceObject,
  targetWidth,
  targetHeight,
  targetDepth,
  overrideMaterial = null,
  flushFront = false
) {
  const clone = sourceObject.clone(true);

  // Filter out unwanted meshes (like floating shelves in entry_door.glb)
  const meshesToRemove = [];

  clone.traverse((child) => {
    if (child.isMesh) {
      const name = (child.name || 'unnamed').toLowerCase();

      // Remove meshes with "shelf" or "shelve" in their name (case-insensitive)
      // This filters out floating shelves that may be included in entry_door.glb
      if (name.includes('shelf') || name.includes('shelve')) {
        console.log(`[builder] ⚠️  Removing shelf mesh: "${child.name || 'unnamed'}"`);
        meshesToRemove.push(child);
        return;
      }

      child.castShadow = true;
      child.receiveShadow = true;
      if (overrideMaterial) child.material = overrideMaterial;
    }
  });

  // Remove unwanted meshes from the scene
  meshesToRemove.forEach((mesh) => {
    if (mesh.parent) {
      mesh.parent.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    }
  });

  if (meshesToRemove.length > 0) {
    console.log(`[builder] Removed ${meshesToRemove.length} unwanted mesh(es)`);
  }

  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const preserveHeight = targetHeight === null;
  const effectiveTargetHeight = preserveHeight ? size.y : targetHeight;

  const scale = {
    x: size.x > 1e-6 ? targetWidth / size.x : 1,
    y: preserveHeight ? 1 : size.y > 1e-6 ? effectiveTargetHeight / size.y : 1,
    z: size.z > 1e-6 ? targetDepth / size.z : 1,
  };

  if (!loggedAssets.has(sourceObject)) {
    loggedAssets.add(sourceObject);
    const maxFactor = Math.max(scale.x, scale.y, scale.z);
    const minFactor = Math.min(scale.x, scale.y, scale.z);
    console.info(
      `[builder] Fitting asset: source size ${size.x.toFixed(3)} x ${size.y.toFixed(3)} x ${size.z.toFixed(3)}` +
        ` -> target ${targetWidth.toFixed(2)} x ${effectiveTargetHeight.toFixed(2)} x ${targetDepth.toFixed(2)}` +
        ` (scale factors x${scale.x.toFixed(2)}, y${scale.y.toFixed(2)}, z${scale.z.toFixed(2)})`
    );
    if (maxFactor / Math.max(minFactor, 1e-6) > 20 || maxFactor > 50 || maxFactor < 0.02) {
      console.warn(
        '[builder] That scale factor looks extreme -- the source .glb is likely authored at the ' +
          'wrong real-world scale (common cause: an un-applied Object scale in Blender). ' +
          'Select the object in Blender, run Object > Apply > All Transforms, confirm its ' +
          'dimensions in the N-panel look like a real door (~1m x 2m), and re-export.'
      );
    }
  }

  // Recenter at scale 1 first (translation is unaffected by an object's own
  // scale in three.js's T*R*S composition, so centering has to happen on an
  // inner group *before* the outer group is scaled).
  const centeringGroup = new THREE.Group();
  centeringGroup.position.copy(center).negate();
  centeringGroup.add(clone);

  const wrapper = new THREE.Group();
  wrapper.scale.set(scale.x, scale.y, scale.z);
  wrapper.add(centeringGroup);

  if (flushFront) {
    // After the steps above, wrapper spans z = [-targetDepth/2, +targetDepth/2]
    // centered on the wall's centerline. Shift it so its exterior (-Z) face
    // sits exactly where a standard-thickness panel's exterior face would,
    // letting any extra depth extend inward only.
    wrapper.position.z = (targetDepth - PANEL_THICKNESS_FT) / 2;
  }

  wrapper.userData.fittedHeight = effectiveTargetHeight;
  return wrapper;
}

/**
 * Builds the shared material palette. These material *objects* are held
 * onto and mutated in place (see applyFinish) so that changing a finish
 * updates every mesh referencing them instantly, with no rebuild and no
 * disruption to the current camera framing.
 */
export function createMaterials() {
  return {
    wall: new THREE.MeshStandardMaterial({ color: 0xd7dee2, metalness: 0.65, roughness: 0.35 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x8b96a0, metalness: 0.8, roughness: 0.3 }),
    roof: new THREE.MeshStandardMaterial({ color: 0xc7d0d4, metalness: 0.6, roughness: 0.4 }),
    floor: new THREE.MeshStandardMaterial({ color: 0x9aa4aa, metalness: 0.2, roughness: 0.85 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xcfe9ec,
      metalness: 0,
      roughness: 0.05,
      transmission: 0.9,
      transparent: true,
      opacity: 0.55,
      ior: 1.4,
    }),
    entryDoor: new THREE.MeshStandardMaterial({ color: 0xeef1f2, metalness: 0.5, roughness: 0.4 }),
    handle: new THREE.MeshStandardMaterial({ color: 0x2b333a, metalness: 0.9, roughness: 0.25 }),
    ledStrip: new THREE.MeshBasicMaterial({ color: 0xdff7ff }),
    shelfMetal: new THREE.MeshStandardMaterial({ color: 0xb7c0c6, metalness: 0.75, roughness: 0.3 }),
  };
}

const FINISH_PRESETS = {
  galvalume: { color: 0xd7dee2, metalness: 0.65, roughness: 0.35 },
  stainless: { color: 0xe7ebec, metalness: 0.95, roughness: 0.15 },
  stucco: { color: 0xf3f0e6, metalness: 0.05, roughness: 0.85 },
};

/** Mutates the shared wall/roof materials in place -- no geometry rebuild. */
export function applyFinish(materials, finishKey) {
  const preset = FINISH_PRESETS[finishKey] ?? FINISH_PRESETS.galvalume;
  materials.wall.color.setHex(preset.color);
  materials.wall.metalness = preset.metalness;
  materials.wall.roughness = preset.roughness;
  materials.roof.color.setHex(preset.color);
  materials.roof.metalness = preset.metalness;
  materials.roof.roughness = Math.min(preset.roughness + 0.05, 1);
}

/** Recursively free GPU geometry for everything under a group, then empty it. */
function clearGroup(group) {
  for (let i = group.children.length - 1; i >= 0; i--) {
    const child = group.children[i];
    if (child.geometry) child.geometry.dispose();
    group.remove(child);
  }
}

/**
 * Works out which positions on each wall have doors.
 * Returns actual door positions and types for proper placement.
 */
function computeDoorLayout(config, width, depth) {
  const DISPLAY_DOOR_WIDTH = 2.5;  // 30" = 2.5ft
  const ENTRY_DOOR_WIDTH = 3.0;    // 36" = 3ft

  const layout = {
    frontDoors: [],  // Array of {type: 'display'|'entry', position: x}
    leftDoors: [],
    rightDoors: [],
  };

  const hasFrontLeft = config.entryDoors.includes('front-left');
  const hasFrontRight = config.entryDoors.includes('front-right');
  const hasSideLeft = config.entryDoors.includes('side-left');
  const hasSideRight = config.entryDoors.includes('side-right');

  // Calculate available space on front wall
  const EDGE_SPACING = 0.5; // Small spacing from wall edge for entry doors
  let availableWidth = width;
  let leftOffset = 0;

  // Front-left entry door
  if (hasFrontLeft) {
    layout.frontDoors.push({ type: 'entry', position: EDGE_SPACING + ENTRY_DOOR_WIDTH / 2 });
    leftOffset = EDGE_SPACING + ENTRY_DOOR_WIDTH + EDGE_SPACING;
    availableWidth -= (EDGE_SPACING + ENTRY_DOOR_WIDTH + EDGE_SPACING);
  }

  // Front-right entry door
  if (hasFrontRight) {
    layout.frontDoors.push({ type: 'entry', position: width - EDGE_SPACING - ENTRY_DOOR_WIDTH / 2 });
    availableWidth -= (EDGE_SPACING + ENTRY_DOOR_WIDTH + EDGE_SPACING);
  }

  // Display doors - fit as many as requested, touching each other
  const displayDoorsToPlace = Math.min(config.displayDoors, Math.floor(availableWidth / DISPLAY_DOOR_WIDTH));

  if (displayDoorsToPlace > 0) {
    // Calculate total width of all display doors
    const totalDisplayWidth = displayDoorsToPlace * DISPLAY_DOOR_WIDTH;
    // Center the group of doors in the available space
    const groupStartX = leftOffset + (availableWidth - totalDisplayWidth) / 2;

    for (let i = 0; i < displayDoorsToPlace; i++) {
      const position = groupStartX + (i * DISPLAY_DOOR_WIDTH) + (DISPLAY_DOOR_WIDTH / 2);
      layout.frontDoors.push({ type: 'display', position });
    }
  }

  // Side doors - centered
  if (hasSideLeft) {
    layout.leftDoors.push({ type: 'entry', position: depth / 2 });
  }
  if (hasSideRight) {
    layout.rightDoors.push({ type: 'entry', position: depth / 2 });
  }

  return layout;
}

/** Builds a single flat wall panel segment mesh (flush-anchored by default; a no-op offset since its depth already equals PANEL_THICKNESS_FT). */
function buildPanelSegment(segWidth, height, material, assetObject = null) {
  if (assetObject) {
    return fitAssetToBox(assetObject, segWidth, height, PANEL_THICKNESS_FT, material, true);
  }
  const geo = new THREE.BoxGeometry(segWidth, height, PANEL_THICKNESS_FT);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds a header module -- a plain infill panel that sits directly above
 * a door, closing the gap up to the full wall height. Picks the header
 * asset that matches the selected overall unit height (8/10/12ft) since
 * that's how the supplied modules are named; falls back to a procedural
 * panel in the wall finish if that header isn't on disk.
 */
function buildHeaderSegment(segWidth, gapHeight, wallHeightFt, materials, assets) {
  const headerKey = HEADER_ASSET_KEY_BY_HEIGHT[wallHeightFt];
  const headerAsset = headerKey ? assets[headerKey] : null;
  if (headerAsset) {
    return fitAssetToBox(headerAsset, segWidth, gapHeight, PANEL_THICKNESS_FT, materials.wall, true);
  }
  return buildPanelSegment(segWidth, gapHeight, materials.wall);
}

/**
 * Assembles one wall slot using the same base+header stack for every segment.
 * Door slots put a fixed-height door in the base course; plain slots use a
 * wall panel in that same base course. The header course then wraps the full
 * building, which keeps the roof uniformly lifted at 8/10/12 ft heights.
 *
 * @param {null|'display'|'entry'} kind
 */
function buildWallSlot(kind, segWidth, wallHeight, materials, assets, config) {
  const slot = new THREE.Group();
  const baseHeight = Math.min(NOMINAL_DOOR_HEIGHT_FT, wallHeight);

  // Real door dimensions (in feet)
  const DISPLAY_DOOR_WIDTH = 2.5;  // 30" = 2.5ft
  const ENTRY_DOOR_WIDTH = 3.0;    // 36" = 3ft
  const DISPLAY_DOOR_HEIGHT = 79 / 12; // 79" = ~6.58ft
  const ENTRY_DOOR_HEIGHT = 80 / 12;   // 80" = ~6.67ft

  let basePiece;

  if (kind === 'display' || kind === 'entry') {
    const doorAsset = kind === 'display' ? assets.displayDoor : assets.entryDoor;
    const doorWidth = kind === 'display' ? DISPLAY_DOOR_WIDTH : ENTRY_DOOR_WIDTH;
    const doorHeight = kind === 'display' ? DISPLAY_DOOR_HEIGHT : ENTRY_DOOR_HEIGHT;

    if (doorAsset) {
      // Use actual door dimensions, not segment width
      basePiece = fitAssetToBox(doorAsset, doorWidth, doorHeight, PANEL_THICKNESS_FT * 3, null, true);
    } else {
      basePiece =
        kind === 'display'
          ? buildProceduralDisplayDoor(doorWidth, doorHeight, materials)
          : buildProceduralEntryDoor(doorWidth, doorHeight, materials);
    }

    // Center the door in the segment if it's smaller than the segment width
    // (no horizontal offset needed - door stays centered at x=0 in the slot group)

  } else {
    basePiece = buildPanelSegment(segWidth, baseHeight, materials.wall, assets.wallPanel);
  }

  basePiece.position.y = -wallHeight / 2 + baseHeight / 2;
  slot.add(basePiece);

  const gapHeight = wallHeight - baseHeight;
  if (gapHeight > 0.05) {
    const header = buildHeaderSegment(segWidth, gapHeight, config.height, materials, assets);
    header.position.y = wallHeight / 2 - gapHeight / 2;
    slot.add(header);
  }

  return slot;
}

/**
 * Builds a complete wall with doors at specified positions and fills gaps with panels
 */
function buildWallWithDoors(root, wallLength, wallHeight, doors, materials, assets, config, wallPosition, rotationY, wallName) {
  const DISPLAY_DOOR_WIDTH = 2.5;  // 30" = 2.5ft
  const ENTRY_DOOR_WIDTH = 3.0;    // 36" = 3ft
  const DISPLAY_DOOR_HEIGHT = 79 / 12;
  const ENTRY_DOOR_HEIGHT = 80 / 12;

  const wallGroup = new THREE.Group();

  // Sort doors by position for easier gap filling
  const sortedDoors = [...doors].sort((a, b) => a.position - b.position);

  // Build full-height wall panels in the gaps between doors
  let lastEnd = 0;

  sortedDoors.forEach(door => {
    const doorWidth = door.type === 'display' ? DISPLAY_DOOR_WIDTH : ENTRY_DOOR_WIDTH;
    const doorHeight = door.type === 'display' ? DISPLAY_DOOR_HEIGHT : ENTRY_DOOR_HEIGHT;
    const doorStart = door.position - doorWidth / 2;
    const doorEnd = door.position + doorWidth / 2;

    // Fill gap before this door
    if (doorStart > lastEnd) {
      const gapWidth = doorStart - lastEnd;
      const panel = buildPanelSegment(gapWidth, wallHeight, materials.wall, assets.wallPanel);
      panel.position.x = lastEnd + gapWidth / 2 - wallLength / 2;
      wallGroup.add(panel);
    }

    // Add the door (with header above if needed)
    const doorAsset = door.type === 'display' ? assets.displayDoor : assets.entryDoor;
    let doorMesh;

    if (doorAsset) {
      doorMesh = fitAssetToBox(doorAsset, doorWidth, doorHeight, PANEL_THICKNESS_FT * 3, null, true);
    } else {
      doorMesh = door.type === 'display'
        ? buildProceduralDisplayDoor(doorWidth, doorHeight, materials)
        : buildProceduralEntryDoor(doorWidth, doorHeight, materials);
    }

    // Position door at bottom of wall
    doorMesh.position.x = door.position - wallLength / 2;
    doorMesh.position.y = -wallHeight / 2 + doorHeight / 2;
    wallGroup.add(doorMesh);

    // Add header panel above door if there's a gap
    const headerHeight = wallHeight - doorHeight;
    if (headerHeight > 0.1) {
      const header = buildPanelSegment(doorWidth, headerHeight, materials.wall, assets.wallPanel);
      header.position.x = door.position - wallLength / 2;
      header.position.y = wallHeight / 2 - headerHeight / 2;
      wallGroup.add(header);
    }

    lastEnd = doorEnd;
  });

  // Fill final gap after last door
  if (lastEnd < wallLength) {
    const gapWidth = wallLength - lastEnd;
    const panel = buildPanelSegment(gapWidth, wallHeight, materials.wall, assets.wallPanel);
    panel.position.x = lastEnd + gapWidth / 2 - wallLength / 2;
    wallGroup.add(panel);
  }

  // If no doors, just add a full wall panel
  if (sortedDoors.length === 0) {
    const panel = buildPanelSegment(wallLength, wallHeight, materials.wall, assets.wallPanel);
    wallGroup.add(panel);
  }

  // Position and rotate the wall group
  wallGroup.position.set(wallPosition.x, wallPosition.y, wallPosition.z);
  wallGroup.rotation.y = rotationY;
  root.add(wallGroup);
}

/** Procedural fallback: glass frame + inset transparent pane, used only when no display_door.glb is loaded. */
function buildProceduralDisplayDoor(segWidth, doorHeight, materials) {
  const group = new THREE.Group();

  const frame = buildPanelSegment(segWidth, doorHeight, materials.trim);
  frame.scale.set(1, 1, 0.7);
  group.add(frame);

  const paneGeo = new THREE.BoxGeometry(segWidth * 0.82, doorHeight * 0.82, PANEL_THICKNESS_FT * 0.5);
  const pane = new THREE.Mesh(paneGeo, materials.glass);
  pane.position.z = PANEL_THICKNESS_FT * 0.1;
  group.add(pane);

  return group;
}

/** Procedural fallback: solid door + small window + handle, used only when no entry_door.glb is loaded. */
function buildProceduralEntryDoor(segWidth, doorHeight, materials) {
  const group = new THREE.Group();

  const door = buildPanelSegment(segWidth, doorHeight, materials.entryDoor);
  group.add(door);

  const windowGeo = new THREE.BoxGeometry(segWidth * 0.35, doorHeight * 0.22, PANEL_THICKNESS_FT * 0.6);
  const window_ = new THREE.Mesh(windowGeo, materials.glass);
  window_.position.set(0, doorHeight * 0.2, PANEL_THICKNESS_FT * 0.1);
  group.add(window_);

  const handleGeo = new THREE.BoxGeometry(0.06, 0.6, 0.06);
  const handle = new THREE.Mesh(handleGeo, materials.handle);
  handle.position.set(segWidth * 0.32, -doorHeight * 0.05, PANEL_THICKNESS_FT * 0.55);
  group.add(handle);

  return group;
}

/**
 * Rebuilds the entire cooler structure into `root` from the current config.
 * Geometry-heavy but cheap relative to a page reload -- called whenever a
 * dimension, door, or door-placement control changes. Camera/controls are
 * never touched here; only main.js decides when to reframe the view.
 *
 * @param {object} assets - result of preloadAssetLibrary(), e.g.
 *   { wallPanel, roofPanel, displayDoor, entryDoor }. Any entry can be
 *   null/undefined/omitted, in which case that piece falls back to
 *   procedural geometry automatically.
 */
export function buildCooler(root, config, materials, assets = {}) {
  clearGroup(root);

  const { width, depth, height } = config;

  const layout = computeDoorLayout(config, width, depth);

  // ---- Floor -------------------------------------------------------
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(width, PANEL_THICKNESS_FT, depth),
    materials.floor
  );
  floor.position.set(width / 2, -PANEL_THICKNESS_FT / 2, depth / 2);
  floor.receiveShadow = true;
  root.add(floor);

  // ---- Roof ----------------------------------------------------------
  // Flush with walls, no overhang
  const roofThickness = PANEL_THICKNESS_FT * 1.3;
  const roof = assets.roofPanel
    ? fitAssetToBox(assets.roofPanel, width, roofThickness, depth, materials.roof)
    : new THREE.Mesh(new THREE.BoxGeometry(width, roofThickness, depth), materials.roof);
  roof.position.set(width / 2, height + roofThickness / 2, depth / 2);
  if (roof.isMesh) roof.castShadow = true;
  root.add(roof);

  // ---- Front wall with doors --------------------------------
  buildWallWithDoors(root, width, height, layout.frontDoors, materials, assets, config,
    { x: width / 2, y: height / 2, z: PANEL_THICKNESS_FT / 2 }, 0, 'front');

  // ---- Back wall (plain) ----------
  const backWall = buildPanelSegment(width, height, materials.wall, assets.wallPanel);
  backWall.position.set(width / 2, height / 2, depth - PANEL_THICKNESS_FT / 2);
  backWall.name = 'back-wall'; // Name for transparency control in interior view
  root.add(backWall);

  // ---- Left wall with doors ----------------------------------
  buildWallWithDoors(root, depth, height, layout.leftDoors, materials, assets, config,
    { x: PANEL_THICKNESS_FT / 2, y: height / 2, z: depth / 2 }, Math.PI / 2, 'left');

  // ---- Right wall with doors -----------------------------
  buildWallWithDoors(root, depth, height, layout.rightDoors, materials, assets, config,
    { x: width - PANEL_THICKNESS_FT / 2, y: height / 2, z: depth / 2 }, -Math.PI / 2, 'right');

  // ---- Interior accessories -------------------------------------------
  // Lighting note: three.js is a real-time renderer, not a path-tracer that
  // reads emissive/light textures baked into a .glb. A model "exported with
  // light shining behind it" would just look like a lit render *image* --
  // it wouldn't actually illuminate anything in this scene. What actually
  // lights the interior (so it isn't pitch black behind the glass display
  // doors) is a real THREE.PointLight placed inside the box, added here.
  if (config.accessories.ledLighting) {
    const stripGeo = new THREE.BoxGeometry(width * 0.9, 0.05, 0.08);
    const strip = new THREE.Mesh(stripGeo, materials.ledStrip);
    strip.position.set(width / 2, height - 0.15, depth * 0.5);
    root.add(strip);

    const ledLight = new THREE.PointLight(0xdff7ff, 1.6, Math.max(width, depth) * 1.8, 2);
    ledLight.position.set(width / 2, height - 0.4, depth / 2);
    ledLight.castShadow = false; // interior fill only -- not worth the extra shadow map
    root.add(ledLight);
  }

  // Faint interior fill regardless of the LED toggle, standing in for
  // ambient light leaking in around doors/seals -- keeps the interior from
  // reading as a pure black void when viewed through a display door.
  const interiorFill = new THREE.PointLight(0x9fb0b5, 0.35, Math.max(width, depth, height) * 2.2, 2);
  interiorFill.position.set(width / 2, height / 2, depth / 2);
  interiorFill.castShadow = false;
  root.add(interiorFill);

  if (config.accessories.shelving) {
    const shelfCount = Math.max(1, Math.floor(depth / 4));
    for (let i = 0; i < shelfCount; i++) {
      const shelfGeo = new THREE.BoxGeometry(width * 0.28, 0.06, 1.2);
      const shelf = new THREE.Mesh(shelfGeo, materials.shelfMetal);
      shelf.position.set(width - width * 0.16, 1.6 + i * 1.5, 2 + i * 3.2);
      if (shelf.position.z < depth - 0.8) root.add(shelf);
    }
  }

  if (config.accessories.reinforcedFloor) {
    const plateGeo = new THREE.BoxGeometry(width * 0.96, 0.03, depth * 0.96);
    const plate = new THREE.Mesh(plateGeo, materials.trim);
    plate.position.set(width / 2, 0.02, depth / 2);
    root.add(plate);
  }

  // ---- Refrigeration Equipment -----------------------------------------
  // Dynamically calculate and render evaporator (interior, ceiling-mounted)
  // and condensing unit (exterior, behind cooler) based on box volume and
  // application type. This runs asynchronously but we don't await it here
  // to avoid blocking the rest of the build -- the equipment will appear
  // as soon as assets load.
  buildRefrigerationSystem(root, config).catch((err) => {
    console.error('[builder] Failed to build refrigeration system:', err);
  });
}
