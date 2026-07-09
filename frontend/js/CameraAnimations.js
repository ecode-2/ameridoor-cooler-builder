/**
 * CameraAnimations.js
 * ---------------------------------------------------------------------------
 * Handles smooth, cinematic camera transitions instead of instant jumps.
 * Uses easing functions for professional motion design.
 * ---------------------------------------------------------------------------
 */

import * as THREE from 'three';

export class CameraAnimations {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.isAnimating = false;
    this.animationFrameId = null;
  }

  /**
   * Animates camera to a target position and look-at point
   * @param {THREE.Vector3} targetPosition - Where to move the camera
   * @param {THREE.Vector3} targetLookAt - Where the camera should look
   * @param {number} duration - Animation duration in milliseconds
   * @param {Function} easingFunc - Easing function (default: easeInOutCubic)
   * @returns {Promise} Resolves when animation completes
   */
  animateTo(targetPosition, targetLookAt, duration = 1000, easingFunc = this.easeInOutCubic) {
    // Cancel any ongoing animation
    if (this.isAnimating) {
      this.stop();
    }

    return new Promise((resolve) => {
      const startPosition = this.camera.position.clone();
      const startTarget = this.controls.target.clone();
      const startTime = performance.now();

      this.isAnimating = true;

      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easingFunc(progress);

        // Interpolate position
        this.camera.position.lerpVectors(startPosition, targetPosition, eased);

        // Interpolate look-at target
        this.controls.target.lerpVectors(startTarget, targetLookAt, eased);

        this.controls.update();

        if (progress < 1) {
          this.animationFrameId = requestAnimationFrame(animate);
        } else {
          this.isAnimating = false;
          this.animationFrameId = null;
          resolve();
        }
      };

      this.animationFrameId = requestAnimationFrame(animate);
    });
  }

  /**
   * Preset: Animate to front view (display doors)
   */
  async animateToFront(width, depth, height) {
    const center = new THREE.Vector3(width / 2, height / 2.2, depth / 2);
    const radius = Math.max(width, depth, height) * 1.6 + 8;
    const targetPos = new THREE.Vector3(center.x, center.y, center.z - radius);

    await this.animateTo(targetPos, center, 800);
  }

  /**
   * Preset: Animate to top view (roof/overhead)
   */
  async animateToTop(width, depth, height) {
    const center = new THREE.Vector3(width / 2, height / 2.2, depth / 2);
    const radius = Math.max(width, depth, height) * 1.6 + 8;
    const targetPos = new THREE.Vector3(center.x, center.y + radius, center.z + 0.001);

    await this.animateTo(targetPos, center, 800);
  }

  /**
   * Preset: Animate to side view (entry doors)
   * @param {string} side - 'left' or 'right' to specify which side to view
   */
  async animateToSide(width, depth, height, side = 'right') {
    const center = new THREE.Vector3(width / 2, height / 2.2, depth / 2);
    const radius = Math.max(width, depth, height) * 1.6 + 8;

    // Right side: camera on positive X (looking at right wall from outside)
    // Left side: camera on negative X (looking at left wall from outside)
    const targetPos = side === 'left'
      ? new THREE.Vector3(center.x - radius, center.y, center.z)
      : new THREE.Vector3(center.x + radius, center.y, center.z);

    await this.animateTo(targetPos, center, 800);
  }

  /**
   * Preset: Animate to orbit view (3/4 perspective)
   */
  async animateToOrbit(width, depth, height) {
    const center = new THREE.Vector3(width / 2, height / 2.2, depth / 2);

    // Use larger multiplier on mobile for better zoomed-out view
    const isMobile = window.innerWidth <= 760;
    const multiplier = isMobile ? 1.5 : 1.15;
    const offset = isMobile ? 10 : 6;
    const radius = Math.max(width, depth, height) * multiplier + offset;

    const direction = new THREE.Vector3(1, 0.75, -1.1).normalize();
    const targetPos = center.clone().add(direction.multiplyScalar(radius));

    await this.animateTo(targetPos, center, 1000);
  }

  /**
   * Preset: Fly inside to show interior (for accessories)
   */
  async animateToInterior(width, depth, height) {
    const interiorPos = new THREE.Vector3(width * 0.5, height * 0.6, depth * 0.4);
    const lookAt = new THREE.Vector3(width * 0.7, height * 0.4, depth * 0.6);

    await this.animateTo(interiorPos, lookAt, 1200, this.easeInOutQuad);
  }

  /**
   * Preset: Focus on specific feature
   * @param {THREE.Vector3} featurePosition - Position of the feature to focus on
   * @param {number} distance - How far from the feature
   */
  async animateToFeature(featurePosition, distance = 5) {
    const offset = new THREE.Vector3(distance * 0.7, distance * 0.5, distance * 0.7);
    const targetPos = featurePosition.clone().add(offset);

    await this.animateTo(targetPos, featurePosition, 600, this.easeOutCubic);
  }

  /**
   * Smooth zoom animation
   * @param {number} targetZoom - Target zoom level
   * @param {number} duration - Duration in milliseconds
   */
  async animateZoom(targetZoom, duration = 400) {
    return new Promise((resolve) => {
      const startZoom = this.camera.zoom;
      const startTime = performance.now();

      this.isAnimating = true;

      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = this.easeInOutCubic(progress);

        this.camera.zoom = THREE.MathUtils.lerp(startZoom, targetZoom, eased);
        this.camera.updateProjectionMatrix();

        if (progress < 1) {
          this.animationFrameId = requestAnimationFrame(animate);
        } else {
          this.isAnimating = false;
          this.animationFrameId = null;
          resolve();
        }
      };

      this.animationFrameId = requestAnimationFrame(animate);
    });
  }

  /**
   * Stops any ongoing animation
   */
  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isAnimating = false;
  }

  // Easing functions for smooth motion

  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  easeInOutBack(t) {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  }

  easeOutElastic(t) {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }
}
