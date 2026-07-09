/**
 * ScreenshotExporter.js
 * ---------------------------------------------------------------------------
 * High-quality screenshot and render export functionality.
 * Supports multiple resolutions (4K, 8K), formats (PNG, JPEG), and
 * transparent backgrounds.
 * ---------------------------------------------------------------------------
 */

import * as THREE from 'three';

export class ScreenshotExporter {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
  }

  /**
   * Captures high-resolution screenshot
   * @param {object} options - Export options
   * @returns {Promise<Blob>} Image blob
   */
  async capture(options = {}) {
    const {
      width = 3840,  // 4K by default
      height = 2160,
      format = 'png',
      quality = 0.95,
      transparent = false,
      filename = null,
      download = true,
    } = options;

    // Store original renderer state
    const originalSize = new THREE.Vector2();
    this.renderer.getSize(originalSize);
    const originalPixelRatio = this.renderer.getPixelRatio();
    const originalClearAlpha = this.renderer.getClearAlpha();
    const originalBackground = this.scene.background;

    try {
      // Configure renderer for high-quality capture
      this.renderer.setSize(width, height, false);
      this.renderer.setPixelRatio(1); // Use exact pixel dimensions

      if (transparent) {
        this.renderer.setClearAlpha(0);
        this.scene.background = null;
      }

      // Update camera aspect ratio
      const originalAspect = this.camera.aspect;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();

      // Render the scene
      this.renderer.render(this.scene, this.camera);

      // Capture canvas as blob
      const blob = await new Promise((resolve, reject) => {
        this.renderer.domElement.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error('Failed to capture canvas'));
          },
          format === 'png' ? 'image/png' : 'image/jpeg',
          quality
        );
      });

      // Download if requested
      if (download && blob) {
        this._downloadBlob(blob, filename || this._generateFilename(width, height, format));
      }

      // Restore original state
      this.renderer.setSize(originalSize.x, originalSize.y, false);
      this.renderer.setPixelRatio(originalPixelRatio);
      this.renderer.setClearAlpha(originalClearAlpha);
      this.scene.background = originalBackground;
      this.camera.aspect = originalAspect;
      this.camera.updateProjectionMatrix();

      // Trigger one more render to restore display
      this.renderer.render(this.scene, this.camera);

      return blob;
    } catch (error) {
      // Ensure we restore state even on error
      this.renderer.setSize(originalSize.x, originalSize.y, false);
      this.renderer.setPixelRatio(originalPixelRatio);
      this.renderer.setClearAlpha(originalClearAlpha);
      this.scene.background = originalBackground;
      this.camera.aspect = originalAspect;
      this.camera.updateProjectionMatrix();

      throw error;
    }
  }

  /**
   * Preset: 4K PNG with transparency
   */
  async capture4KPNG(transparent = false) {
    return this.capture({
      width: 3840,
      height: 2160,
      format: 'png',
      transparent,
    });
  }

  /**
   * Preset: 8K PNG (warning: very large file)
   */
  async capture8KPNG(transparent = false) {
    return this.capture({
      width: 7680,
      height: 4320,
      format: 'png',
      transparent,
    });
  }

  /**
   * Preset: 4K JPEG
   */
  async capture4KJPEG(quality = 0.95) {
    return this.capture({
      width: 3840,
      height: 2160,
      format: 'jpeg',
      quality,
    });
  }

  /**
   * Preset: HD for web use
   */
  async captureHD() {
    return this.capture({
      width: 1920,
      height: 1080,
      format: 'png',
      quality: 0.92,
    });
  }

  /**
   * Preset: Social media optimized (square)
   */
  async captureSocialSquare() {
    return this.capture({
      width: 1080,
      height: 1080,
      format: 'jpeg',
      quality: 0.90,
    });
  }

  /**
   * Captures the current view at current resolution
   */
  async captureCurrentView(format = 'png') {
    const size = new THREE.Vector2();
    this.renderer.getSize(size);

    return this.capture({
      width: size.x * this.renderer.getPixelRatio(),
      height: size.y * this.renderer.getPixelRatio(),
      format,
      download: true,
    });
  }

  /**
   * Creates a thumbnail (smaller, optimized for previews)
   */
  async captureThumbnail(maxSize = 400) {
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    const aspect = size.x / size.y;

    let width, height;
    if (aspect > 1) {
      width = maxSize;
      height = maxSize / aspect;
    } else {
      height = maxSize;
      width = maxSize * aspect;
    }

    return this.capture({
      width: Math.floor(width),
      height: Math.floor(height),
      format: 'jpeg',
      quality: 0.85,
      download: false,
    });
  }

  /**
   * Generates a data URL for embedding
   * @param {object} options - Same as capture()
   */
  async captureAsDataURL(options = {}) {
    const blob = await this.capture({ ...options, download: false });
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Private helper methods

  _generateFilename(width, height, format) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const resolution = width >= 7680 ? '8K' : width >= 3840 ? '4K' : width >= 1920 ? 'HD' : `${width}x${height}`;
    return `AmeriDoor_Render_${resolution}_${timestamp}.${format}`;
  }

  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
