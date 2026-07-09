/**
 * RealisticMaterials.js
 *
 * Premium Feature: Realistic PBR materials with HDRI environment lighting
 * Provides photorealistic rendering with proper color management
 *
 * Features:
 * - HDRI environment maps
 * - PBR material system
 * - ACES tone mapping
 * - Real-time reflections
 * - Adjustable lighting intensity
 */

import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

export class RealisticMaterials {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;

    // Enable physically correct lighting
    this.renderer.physicallyCorrectLights = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Enable shadows with high quality
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Environment state
    this.currentEnvironment = null;
    this.environments = {};

    // Material library
    this.materials = {
      stainlessSteel: null,
      aluminum: null,
      paintedMetal: null,
      plastic: null,
      glass: null
    };

    // Configuration
    this.config = {
      envIntensity: 1.0,
      exposure: 1.0,
      useEnvMap: true
    };

    this.initializeMaterials();
  }

  /**
   * Load HDRI environment map
   */
  async loadEnvironment(name, url) {
    return new Promise((resolve, reject) => {
      const loader = new RGBELoader();
      loader.load(
        url,
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;

          this.environments[name] = texture;

          // Set as current if first one loaded
          if (!this.currentEnvironment) {
            this.setEnvironment(name);
          }

          resolve(texture);
        },
        undefined,
        (error) => {
          console.error(`Failed to load HDRI: ${url}`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Set active environment
   */
  setEnvironment(name) {
    const envMap = this.environments[name];
    if (!envMap) {
      console.warn(`Environment "${name}" not found`);
      return;
    }

    this.currentEnvironment = name;

    if (this.config.useEnvMap) {
      this.scene.environment = envMap;
      this.scene.background = envMap;
    }

    // Update all materials
    this.updateAllMaterials();
  }

  /**
   * Load default HDRI environments
   * Note: In production, host these on your CDN
   */
  async loadDefaultEnvironments() {
    const environments = [
      {
        name: 'studio',
        url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r148/examples/textures/equirectangular/royal_esplanade_1k.hdr'
      },
      {
        name: 'warehouse',
        url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r148/examples/textures/equirectangular/venice_sunset_1k.hdr'
      }
    ];

    const promises = environments.map(env =>
      this.loadEnvironment(env.name, env.url).catch(err => {
        console.warn(`Skipping environment ${env.name}:`, err);
      })
    );

    await Promise.allSettled(promises);

    // Fallback to basic lighting if HDRI fails
    if (Object.keys(this.environments).length === 0) {
      this.setupBasicLighting();
    }
  }

  /**
   * Fallback basic lighting
   */
  setupBasicLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    // Key light
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(5, 10, 7.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 50;
    this.scene.add(keyLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 5, -5);
    this.scene.add(fillLight);
  }

  /**
   * Initialize PBR material presets
   */
  initializeMaterials() {
    // Stainless Steel
    this.materials.stainlessSteel = new THREE.MeshStandardMaterial({
      color: 0xc0c0c0,
      metalness: 1.0,
      roughness: 0.2,
      envMapIntensity: 1.5
    });

    // Brushed Aluminum
    this.materials.aluminum = new THREE.MeshStandardMaterial({
      color: 0xd4d4d4,
      metalness: 1.0,
      roughness: 0.4,
      envMapIntensity: 1.2
    });

    // Painted Metal (White)
    this.materials.paintedMetal = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.3,
      roughness: 0.5,
      envMapIntensity: 0.8
    });

    // Plastic/Polymer
    this.materials.plastic = new THREE.MeshStandardMaterial({
      color: 0xf0f0f0,
      metalness: 0.0,
      roughness: 0.6,
      envMapIntensity: 0.5
    });

    // Glass
    this.materials.glass = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.0,
      roughness: 0.1,
      transmission: 0.9,
      thickness: 0.5,
      envMapIntensity: 1.0,
      transparent: true,
      opacity: 0.3
    });
  }

  /**
   * Create custom PBR material
   */
  createMaterial(options = {}) {
    const defaults = {
      color: 0xffffff,
      metalness: 0.5,
      roughness: 0.5,
      envMapIntensity: 1.0,
      normalScale: new THREE.Vector2(1, 1)
    };

    const params = { ...defaults, ...options };

    return new THREE.MeshStandardMaterial(params);
  }

  /**
   * Apply material to object
   */
  applyMaterial(object, materialName, options = {}) {
    let material = this.materials[materialName];

    if (!material) {
      console.warn(`Material "${materialName}" not found, creating default`);
      material = this.createMaterial(options);
    } else {
      // Clone material and apply custom options
      material = material.clone();
      Object.assign(material, options);
    }

    // Apply to mesh
    if (object.isMesh) {
      object.material = material;
    } else {
      object.traverse((child) => {
        if (child.isMesh) {
          child.material = material;
        }
      });
    }

    return material;
  }

  /**
   * Update environment intensity
   */
  setEnvironmentIntensity(intensity) {
    this.config.envIntensity = intensity;
    this.updateAllMaterials();
  }

  /**
   * Update exposure
   */
  setExposure(exposure) {
    this.config.exposure = exposure;
    this.renderer.toneMappingExposure = exposure;
  }

  /**
   * Toggle environment map
   */
  setUseEnvironmentMap(use) {
    this.config.useEnvMap = use;

    if (use && this.currentEnvironment) {
      const envMap = this.environments[this.currentEnvironment];
      this.scene.environment = envMap;
      this.scene.background = envMap;
    } else {
      this.scene.environment = null;
      this.scene.background = new THREE.Color(0x1a1a1a);
    }
  }

  /**
   * Update all materials in scene
   */
  updateAllMaterials() {
    this.scene.traverse((object) => {
      if (object.isMesh && object.material) {
        if (object.material.envMapIntensity !== undefined) {
          object.material.envMapIntensity = this.config.envIntensity;
        }
        object.material.needsUpdate = true;
      }
    });
  }

  /**
   * Apply realistic material to cooler parts
   */
  applyCoolerMaterials(coolerRoot) {
    coolerRoot.traverse((child) => {
      if (!child.isMesh) return;

      const partName = child.userData.partName || child.name.toLowerCase();

      if (partName.includes('panel') || partName.includes('wall')) {
        this.applyMaterial(child, 'stainlessSteel');
      } else if (partName.includes('door') || partName.includes('frame')) {
        this.applyMaterial(child, 'aluminum');
      } else if (partName.includes('floor') || partName.includes('ceiling')) {
        this.applyMaterial(child, 'paintedMetal', { color: 0xe0e0e0 });
      } else if (partName.includes('handle') || partName.includes('hinge')) {
        this.applyMaterial(child, 'stainlessSteel', { roughness: 0.3 });
      } else {
        // Default material
        this.applyMaterial(child, 'aluminum');
      }

      // Enable shadows
      child.castShadow = true;
      child.receiveShadow = true;
    });
  }

  /**
   * Export current settings
   */
  exportSettings() {
    return {
      environment: this.currentEnvironment,
      envIntensity: this.config.envIntensity,
      exposure: this.config.exposure,
      useEnvMap: this.config.useEnvMap,
      toneMapping: this.renderer.toneMapping,
      toneMappingExposure: this.renderer.toneMappingExposure
    };
  }

  /**
   * Import settings
   */
  importSettings(settings) {
    if (settings.environment) {
      this.setEnvironment(settings.environment);
    }
    if (settings.envIntensity !== undefined) {
      this.setEnvironmentIntensity(settings.envIntensity);
    }
    if (settings.exposure !== undefined) {
      this.setExposure(settings.exposure);
    }
    if (settings.useEnvMap !== undefined) {
      this.setUseEnvironmentMap(settings.useEnvMap);
    }
  }

  /**
   * Cleanup
   */
  dispose() {
    Object.values(this.environments).forEach(texture => {
      texture.dispose();
    });

    Object.values(this.materials).forEach(material => {
      if (material) material.dispose();
    });
  }
}
