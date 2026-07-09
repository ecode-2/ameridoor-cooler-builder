/**
 * EnvironmentSwitcher.js
 *
 * Premium Feature: Dynamic environment switching for store visualization
 * Allows users to preview the walk-in cooler in different contexts
 *
 * Features:
 * - Multiple environment presets (warehouse, restaurant, store, etc.)
 * - HDRI backgrounds
 * - Environmental objects (shelves, products, flooring)
 * - Lighting adjustments per environment
 * - Smooth transitions between environments
 */

import * as THREE from 'three';

export class EnvironmentSwitcher {
  constructor(scene, renderer, camera) {
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;

    // Current environment
    this.currentEnvironment = null;

    // Environment configurations
    this.environments = {
      none: {
        name: 'None',
        description: 'Neutral background',
        background: new THREE.Color(0x1a1a1a),
        floor: null,
        objects: []
      },
      warehouse: {
        name: 'Warehouse',
        description: 'Industrial warehouse setting',
        background: new THREE.Color(0x2a2a2a),
        floor: {
          color: 0x3a3a3a,
          metalness: 0.1,
          roughness: 0.8
        },
        lighting: {
          ambient: 0.4,
          directional: 0.6
        },
        objects: ['pallets', 'shelving']
      },
      restaurant: {
        name: 'Restaurant Kitchen',
        description: 'Commercial kitchen environment',
        background: new THREE.Color(0xf5f5f5),
        floor: {
          color: 0xcccccc,
          metalness: 0.0,
          roughness: 0.6
        },
        lighting: {
          ambient: 0.6,
          directional: 0.8
        },
        objects: ['tiles', 'equipment']
      },
      grocery: {
        name: 'Grocery Store',
        description: 'Retail grocery environment',
        background: new THREE.Color(0xffffff),
        floor: {
          color: 0xe8e8e8,
          metalness: 0.2,
          roughness: 0.4
        },
        lighting: {
          ambient: 0.7,
          directional: 0.9
        },
        objects: ['shelves', 'products']
      },
      convenience: {
        name: 'Convenience Store',
        description: 'Small retail setting',
        background: new THREE.Color(0xf8f8f8),
        floor: {
          color: 0xd0d0d0,
          metalness: 0.1,
          roughness: 0.5
        },
        lighting: {
          ambient: 0.65,
          directional: 0.85
        },
        objects: ['shelves', 'displays']
      },
      outdoor: {
        name: 'Outdoor/Loading',
        description: 'Outdoor loading dock',
        background: new THREE.Color(0x87ceeb),
        floor: {
          color: 0x404040,
          metalness: 0.0,
          roughness: 0.9
        },
        lighting: {
          ambient: 0.5,
          directional: 1.0
        },
        objects: ['concrete', 'loading']
      }
    };

    // Scene objects
    this.environmentObjects = [];
    this.floorMesh = null;
    this.lights = {
      ambient: null,
      directional: null
    };

    this.setupLighting();
  }

  /**
   * Setup basic lighting
   */
  setupLighting() {
    // Ambient light
    this.lights.ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(this.lights.ambient);

    // Directional light (sun/key light)
    this.lights.directional = new THREE.DirectionalLight(0xffffff, 0.8);
    this.lights.directional.position.set(10, 20, 10);
    this.lights.directional.castShadow = true;

    // Shadow settings
    this.lights.directional.shadow.mapSize.width = 2048;
    this.lights.directional.shadow.mapSize.height = 2048;
    this.lights.directional.shadow.camera.near = 0.5;
    this.lights.directional.shadow.camera.far = 100;
    this.lights.directional.shadow.camera.left = -30;
    this.lights.directional.shadow.camera.right = 30;
    this.lights.directional.shadow.camera.top = 30;
    this.lights.directional.shadow.camera.bottom = -30;

    this.scene.add(this.lights.directional);
  }

  /**
   * Switch to a different environment
   */
  async switchEnvironment(environmentName) {
    const config = this.environments[environmentName];

    if (!config) {
      console.warn(`Environment "${environmentName}" not found`);
      return;
    }

    // Clear current environment
    this.clearEnvironment();

    // Set background
    this.scene.background = config.background;

    // Create floor
    if (config.floor) {
      this.createFloor(config.floor);
    }

    // Adjust lighting
    if (config.lighting) {
      this.adjustLighting(config.lighting);
    }

    // Add environment objects
    if (config.objects && config.objects.length > 0) {
      await this.addEnvironmentObjects(config.objects, environmentName);
    }

    this.currentEnvironment = environmentName;

    // Emit event
    window.dispatchEvent(new CustomEvent('environmentChanged', {
      detail: { environment: environmentName, config }
    }));

    return config;
  }

  /**
   * Clear current environment
   */
  clearEnvironment() {
    // Remove floor
    if (this.floorMesh) {
      this.scene.remove(this.floorMesh);
      this.floorMesh.geometry.dispose();
      this.floorMesh.material.dispose();
      this.floorMesh = null;
    }

    // Remove environment objects
    this.environmentObjects.forEach(obj => {
      this.scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    this.environmentObjects = [];
  }

  /**
   * Create floor mesh
   */
  createFloor(floorConfig) {
    const size = 100; // Large floor
    const geometry = new THREE.PlaneGeometry(size, size);
    const material = new THREE.MeshStandardMaterial({
      color: floorConfig.color,
      metalness: floorConfig.metalness,
      roughness: floorConfig.roughness,
      side: THREE.DoubleSide
    });

    this.floorMesh = new THREE.Mesh(geometry, material);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.position.y = 0;
    this.floorMesh.receiveShadow = true;

    this.scene.add(this.floorMesh);
  }

  /**
   * Adjust lighting for environment
   */
  adjustLighting(lightingConfig) {
    if (this.lights.ambient) {
      this.lights.ambient.intensity = lightingConfig.ambient;
    }

    if (this.lights.directional) {
      this.lights.directional.intensity = lightingConfig.directional;
    }
  }

  /**
   * Add environment-specific objects
   */
  async addEnvironmentObjects(objectTypes, environmentName) {
    for (const type of objectTypes) {
      const objects = this.createEnvironmentObject(type, environmentName);
      if (objects) {
        if (Array.isArray(objects)) {
          objects.forEach(obj => {
            this.scene.add(obj);
            this.environmentObjects.push(obj);
          });
        } else {
          this.scene.add(objects);
          this.environmentObjects.push(objects);
        }
      }
    }
  }

  /**
   * Create specific environment objects
   */
  createEnvironmentObject(type, environment) {
    switch (type) {
      case 'pallets':
        return this.createPallets();
      case 'shelving':
        return this.createShelving();
      case 'tiles':
        return this.createTilePattern();
      case 'shelves':
        return this.createRetailShelves();
      case 'products':
        return this.createProducts();
      case 'displays':
        return this.createDisplays();
      case 'concrete':
        return this.createConcreteFloor();
      default:
        return null;
    }
  }

  /**
   * Create warehouse pallets
   */
  createPallets() {
    const pallets = [];
    const palletGeometry = new THREE.BoxGeometry(4, 0.5, 3);
    const palletMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b7355,
      roughness: 0.8,
      metalness: 0.0
    });

    const positions = [
      { x: -15, z: -10 },
      { x: -15, z: 10 },
      { x: 15, z: -10 },
      { x: 15, z: 10 }
    ];

    positions.forEach(pos => {
      const pallet = new THREE.Mesh(palletGeometry, palletMaterial);
      pallet.position.set(pos.x, 0.25, pos.z);
      pallet.castShadow = true;
      pallet.receiveShadow = true;
      pallets.push(pallet);
    });

    return pallets;
  }

  /**
   * Create warehouse shelving
   */
  createShelving() {
    const shelves = [];
    const shelfMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      metalness: 0.7,
      roughness: 0.3
    });

    const positions = [
      { x: -20, z: 0 },
      { x: 20, z: 0 }
    ];

    positions.forEach(pos => {
      // Vertical posts
      const postGeometry = new THREE.BoxGeometry(0.3, 8, 0.3);
      for (let i = 0; i < 2; i++) {
        const post = new THREE.Mesh(postGeometry, shelfMaterial);
        post.position.set(pos.x, 4, pos.z + (i * 6 - 3));
        post.castShadow = true;
        shelves.push(post);
      }

      // Horizontal shelves
      const shelfGeometry = new THREE.BoxGeometry(0.5, 0.1, 6);
      for (let i = 0; i < 4; i++) {
        const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
        shelf.position.set(pos.x, i * 2 + 1, pos.z);
        shelf.castShadow = true;
        shelf.receiveShadow = true;
        shelves.push(shelf);
      }
    });

    return shelves;
  }

  /**
   * Create tile pattern for restaurant
   */
  createTilePattern() {
    // Update floor material to look like tiles
    if (this.floorMesh) {
      const tileSize = 2;
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      // Draw tile pattern
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 2;

      for (let x = 0; x < 512; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
      }

      for (let y = 0; y < 512; y += 64) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(10, 10);

      this.floorMesh.material.map = texture;
      this.floorMesh.material.needsUpdate = true;
    }

    return null;
  }

  /**
   * Create retail shelves
   */
  createRetailShelves() {
    const shelves = [];
    const shelfMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.2,
      roughness: 0.6
    });

    // Create aisle shelves
    const positions = [
      { x: -12, z: 0, rotation: 0 },
      { x: 12, z: 0, rotation: 0 }
    ];

    positions.forEach(pos => {
      const group = new THREE.Group();

      // Back panel
      const backGeometry = new THREE.BoxGeometry(0.2, 6, 10);
      const back = new THREE.Mesh(backGeometry, shelfMaterial);
      back.position.y = 3;
      group.add(back);

      // Shelves
      const shelfGeometry = new THREE.BoxGeometry(1, 0.1, 10);
      for (let i = 0; i < 5; i++) {
        const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
        shelf.position.set(0.5, i * 1.2 + 0.5, 0);
        group.add(shelf);
      }

      group.position.set(pos.x, 0, pos.z);
      group.rotation.y = pos.rotation;
      group.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      shelves.push(group);
    });

    return shelves;
  }

  /**
   * Create product boxes on shelves
   */
  createProducts() {
    const products = [];
    const productMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6b6b,
      roughness: 0.7
    });

    const productGeometry = new THREE.BoxGeometry(0.5, 0.8, 0.4);

    // Place products on imaginary shelves
    for (let x = -10; x <= 10; x += 3) {
      for (let y = 1; y <= 5; y += 1.2) {
        const product = new THREE.Mesh(productGeometry, productMaterial.clone());
        product.material.color.setHSL(Math.random(), 0.7, 0.6);
        product.position.set(x, y, -8);
        product.castShadow = true;
        products.push(product);
      }
    }

    return products;
  }

  /**
   * Create display cases
   */
  createDisplays() {
    const displays = [];
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.0,
      roughness: 0.1,
      transmission: 0.9,
      transparent: true,
      opacity: 0.3
    });

    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.8,
      roughness: 0.2
    });

    // Create simple display case
    const caseGroup = new THREE.Group();

    // Glass panels
    const glassGeometry = new THREE.BoxGeometry(3, 4, 0.1);
    const glass = new THREE.Mesh(glassGeometry, glassMaterial);
    glass.position.set(0, 2, 0);
    caseGroup.add(glass);

    // Frame
    const frameGeometry = new THREE.BoxGeometry(3.2, 4.2, 0.2);
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.position.set(0, 2, -0.05);
    caseGroup.add(frame);

    caseGroup.position.set(-8, 0, -12);
    displays.push(caseGroup);

    return displays;
  }

  /**
   * Create concrete floor texture
   */
  createConcreteFloor() {
    if (this.floorMesh) {
      const concreteColor = new THREE.Color(0x808080);
      this.floorMesh.material.color = concreteColor;
      this.floorMesh.material.roughness = 0.9;
      this.floorMesh.material.needsUpdate = true;
    }
    return null;
  }

  /**
   * Get available environments
   */
  getEnvironments() {
    return Object.entries(this.environments).map(([key, config]) => ({
      id: key,
      name: config.name,
      description: config.description
    }));
  }

  /**
   * Get current environment
   */
  getCurrentEnvironment() {
    return this.currentEnvironment;
  }

  /**
   * Cleanup
   */
  dispose() {
    this.clearEnvironment();

    if (this.lights.ambient) {
      this.scene.remove(this.lights.ambient);
    }

    if (this.lights.directional) {
      this.scene.remove(this.lights.directional);
    }
  }
}
