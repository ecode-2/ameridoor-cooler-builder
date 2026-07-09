/**
 * PartHighlighter.js
 *
 * Premium Feature: Interactive part highlighting with OutlinePass effect
 * Provides visual feedback when hovering over configurator parts
 *
 * Features:
 * - Smooth outline glow effect
 * - Configurable colors and thickness
 * - Raycasting-based hover detection
 * - Part name tooltips
 * - Click-to-select functionality
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export class PartHighlighter {
  constructor(renderer, scene, camera, domElement) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;

    // Raycaster for mouse detection
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Highlighted objects
    this.hoveredObject = null;
    this.selectedObjects = [];

    // Post-processing setup
    this.setupPostProcessing();

    // Tooltip element
    this.createTooltip();

    // Event listeners
    this.bindEvents();

    // Configuration
    this.config = {
      hoverColor: new THREE.Color(0x00d4ff),
      selectColor: new THREE.Color(0xffa500),
      outlineThickness: 3,
      pulseSpeed: 2,
      enabled: true
    };

    // Animation
    this.pulseTime = 0;
  }

  setupPostProcessing() {
    const size = new THREE.Vector2();
    this.renderer.getSize(size);

    // Create composer
    this.composer = new EffectComposer(this.renderer);

    // Add render pass
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Add outline pass for hover effect
    this.outlinePassHover = new OutlinePass(
      size,
      this.scene,
      this.camera
    );
    this.outlinePassHover.edgeStrength = 3.0;
    this.outlinePassHover.edgeGlow = 0.5;
    this.outlinePassHover.edgeThickness = 1.0;
    this.outlinePassHover.pulsePeriod = 2;
    this.outlinePassHover.visibleEdgeColor.set('#00d4ff');
    this.outlinePassHover.hiddenEdgeColor.set('#0088aa');
    this.composer.addPass(this.outlinePassHover);

    // Add outline pass for selected objects
    this.outlinePassSelect = new OutlinePass(
      size,
      this.scene,
      this.camera
    );
    this.outlinePassSelect.edgeStrength = 5.0;
    this.outlinePassSelect.edgeGlow = 1.0;
    this.outlinePassSelect.edgeThickness = 2.0;
    this.outlinePassSelect.pulsePeriod = 0;
    this.outlinePassSelect.visibleEdgeColor.set('#ffa500');
    this.outlinePassSelect.hiddenEdgeColor.set('#cc8400');
    this.composer.addPass(this.outlinePassSelect);

    // Output pass
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'part-tooltip';
    this.tooltip.style.cssText = `
      position: fixed;
      background: rgba(16, 26, 34, 0.95);
      color: #fff;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      pointer-events: none;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.2s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
    `;
    document.body.appendChild(this.tooltip);
  }

  bindEvents() {
    this.onMouseMove = this.handleMouseMove.bind(this);
    this.onClick = this.handleClick.bind(this);
    this.onResize = this.handleResize.bind(this);

    this.domElement.addEventListener('mousemove', this.onMouseMove);
    this.domElement.addEventListener('click', this.onClick);
    window.addEventListener('resize', this.onResize);
  }

  handleMouseMove(event) {
    if (!this.config.enabled) return;

    // Calculate mouse position in normalized device coordinates
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check for intersections
    const intersects = this.raycaster.intersectObjects(
      this.scene.children,
      true
    );

    // Filter out helper objects and get first mesh
    const validIntersect = intersects.find(
      i => i.object.isMesh && i.object.userData.partName
    );

    if (validIntersect) {
      const object = validIntersect.object;

      // Update hover state
      if (this.hoveredObject !== object) {
        this.hoveredObject = object;
        this.outlinePassHover.selectedObjects = [object];

        // Show tooltip
        this.showTooltip(
          object.userData.partName || 'Part',
          event.clientX,
          event.clientY
        );
      } else {
        // Update tooltip position
        this.updateTooltipPosition(event.clientX, event.clientY);
      }

      // Change cursor
      this.domElement.style.cursor = 'pointer';
    } else {
      // Clear hover state
      if (this.hoveredObject) {
        this.hoveredObject = null;
        this.outlinePassHover.selectedObjects = [];
        this.hideTooltip();
        this.domElement.style.cursor = 'default';
      }
    }
  }

  handleClick(event) {
    if (!this.config.enabled || !this.hoveredObject) return;

    // Toggle selection
    const index = this.selectedObjects.indexOf(this.hoveredObject);
    if (index > -1) {
      this.selectedObjects.splice(index, 1);
    } else {
      this.selectedObjects.push(this.hoveredObject);
    }

    // Update outline pass
    this.outlinePassSelect.selectedObjects = [...this.selectedObjects];

    // Emit event
    this.dispatchEvent('partSelected', {
      object: this.hoveredObject,
      selected: index === -1,
      selectedObjects: [...this.selectedObjects]
    });
  }

  handleResize() {
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    this.composer.setSize(size.x, size.y);
  }

  showTooltip(text, x, y) {
    this.tooltip.textContent = text;
    this.updateTooltipPosition(x, y);
    this.tooltip.style.opacity = '1';
  }

  updateTooltipPosition(x, y) {
    this.tooltip.style.left = `${x + 15}px`;
    this.tooltip.style.top = `${y + 15}px`;
  }

  hideTooltip() {
    this.tooltip.style.opacity = '0';
  }

  clearSelection() {
    this.selectedObjects = [];
    this.outlinePassSelect.selectedObjects = [];
  }

  setHoverColor(color) {
    this.config.hoverColor.set(color);
    this.outlinePassHover.visibleEdgeColor.set(color);
  }

  setSelectColor(color) {
    this.config.selectColor.set(color);
    this.outlinePassSelect.visibleEdgeColor.set(color);
  }

  enable() {
    this.config.enabled = true;
  }

  disable() {
    this.config.enabled = false;
    this.hoveredObject = null;
    this.outlinePassHover.selectedObjects = [];
    this.hideTooltip();
  }

  /**
   * Render with post-processing effects
   * Call this instead of renderer.render()
   */
  render() {
    if (this.config.enabled) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Update animation (call in animation loop)
   */
  update(deltaTime) {
    if (!this.config.enabled) return;

    this.pulseTime += deltaTime * this.config.pulseSpeed;

    // Subtle pulse effect for selected objects
    if (this.selectedObjects.length > 0) {
      const pulse = Math.sin(this.pulseTime) * 0.5 + 0.5;
      this.outlinePassSelect.edgeStrength = 4.0 + pulse;
    }
  }

  /**
   * Simple event dispatcher
   */
  dispatchEvent(eventName, data) {
    const event = new CustomEvent(`parthighlighter:${eventName}`, {
      detail: data
    });
    window.dispatchEvent(event);
  }

  /**
   * Cleanup
   */
  dispose() {
    this.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.domElement.removeEventListener('click', this.onClick);
    window.removeEventListener('resize', this.onResize);

    if (this.tooltip && this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip);
    }

    this.composer.dispose();
  }
}
