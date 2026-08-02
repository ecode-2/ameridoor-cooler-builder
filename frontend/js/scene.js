/**
 * scene.js
 * ---------------------------------------------------------------------------
 * Owns the three.js primitives: renderer, camera, controls, lights and the
 * "studio" environment map used for soft product-shot reflections. Nothing
 * in here knows about walk-in coolers specifically -- it's pure viewport
 * plumbing that builder.js and main.js build on top of.
 * ---------------------------------------------------------------------------
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function createViewport(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9eef0);

  // ---- Camera -------------------------------------------------------
  // Use wider field of view on mobile to show more of the scene
  const isMobile = window.innerWidth <= 760;
  const fov = isMobile ? 50 : 38;

  const camera = new THREE.PerspectiveCamera(
    fov,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    500
  );

  // Set camera further back on mobile for better initial view
  // Adjusted for 180° model rotation: flipped X and Z signs
  if (isMobile) {
    camera.position.set(-24, 16, 28);
  } else {
    camera.position.set(-18, 14, 22);
  }

  // ---- Renderer -------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  // ---- Studio-style environment lighting -------------------------------
  // RoomEnvironment + PMREMGenerator gives soft, neutral, product-shot-style
  // reflections on metal panels without needing to ship a real HDRI file.
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

  // ---- Key / fill / rim lights on top of the environment ---------------
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd8dee0, 0.55);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
  keyLight.position.set(-14, 20, 12);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -25;
  keyLight.shadow.camera.right = 25;
  keyLight.shadow.camera.top = 25;
  keyLight.shadow.camera.bottom = -25;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xcfe7ea, 0.5);
  fillLight.position.set(16, 8, -10);
  scene.add(fillLight);

  // ---- Ground floor (white to blend with background) -------------------------------------------
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.0
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- Controls ---------------------------------------------------------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8;
  controls.maxDistance = 55;
  // Never let the user flip fully upside-down or dive under the floor.
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.target.set(0, 3, 0);
  controls.update();

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  return { scene, camera, renderer, controls, resize };
}

/**
 * Frame the camera/orbit target on the current cooler bounding box so that
 * changing dimensions re-centers the view without a jarring snap, and the
 * "Reset View" button always returns to a sensible framing.
 */
export function frameCameraToBounds(camera, controls, width, depth, height) {
  const center = new THREE.Vector3(width / 2, height / 2.2, depth / 2);

  // Use larger multiplier on mobile for better zoomed-out view
  const isMobile = window.innerWidth <= 760;
  const multiplier = isMobile ? 1.5 : 1.15;
  const offset = isMobile ? 10 : 6;
  const radius = Math.max(width, depth, height) * multiplier + offset;

  controls.target.copy(center);

  // Direction adjusted for 180° model rotation: flipped X and Z
  const direction = new THREE.Vector3(-1, 0.75, 1.1).normalize();
  camera.position.copy(center.clone().add(direction.multiplyScalar(radius)));
  controls.update();
}

/** Preset camera angles used by the toolbar (front / top / side buttons). */
export function setPresetView(camera, controls, preset, width, depth, height) {
  const center = new THREE.Vector3(width / 2, height / 2.2, depth / 2);
  const radius = Math.max(width, depth, height) * 1.6 + 8;
  controls.target.copy(center);

  const positions = {
    front: new THREE.Vector3(center.x, center.y, center.z + radius), // Adjusted for 180° model rotation
    top: new THREE.Vector3(center.x, center.y + radius, center.z + 0.001),
    side: new THREE.Vector3(center.x - radius, center.y, center.z), // Adjusted for 180° model rotation
    orbit: null,
  };

  const pos = positions[preset];
  if (pos) camera.position.copy(pos);
  controls.update();
}
