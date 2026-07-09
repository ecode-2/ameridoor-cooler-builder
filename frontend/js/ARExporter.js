/**
 * ARExporter.js
 * ---------------------------------------------------------------------------
 * Exports 3D models for AR viewing on iOS (USDZ) and Android (GLB).
 * Automatically detects platform and provides appropriate experience.
 * ---------------------------------------------------------------------------
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

export class ARExporter {
  constructor(scene) {
    this.scene = scene;
    this.gltfExporter = new GLTFExporter();
  }

  /**
   * Detects user's platform
   * @returns {string} 'ios', 'android', or 'desktop'
   */
  detectPlatform() {
    const ua = navigator.userAgent.toLowerCase();

    if (/iphone|ipad|ipod/.test(ua)) {
      return 'ios';
    } else if (/android/.test(ua)) {
      return 'android';
    } else {
      return 'desktop';
    }
  }

  /**
   * Main AR entry point - handles all platforms automatically
   * @param {THREE.Object3D} object - The 3D object to export for AR
   * @param {object} options - Export options
   */
  async launchAR(object, options = {}) {
    const platform = this.detectPlatform();

    switch (platform) {
      case 'ios':
        return this.launchIOSAR(object, options);
      case 'android':
        return this.launchAndroidAR(object, options);
      case 'desktop':
        return this.showQRCode(object, options);
      default:
        throw new Error('Unsupported platform');
    }
  }

  /**
   * Launches AR Quick Look on iOS
   */
  async launchIOSAR(object, options = {}) {
    const { filename = 'cooler.usdz' } = options;

    try {
      // For iOS, we need to generate USDZ
      // Since Three.js doesn't have a built-in USDZ exporter, we'll:
      // 1. Export as GLB first
      // 2. Convert server-side to USDZ (or use a service)
      // 3. Trigger Quick Look

      const glbBlob = await this.exportAsGLB(object);

      // Send to server for USDZ conversion
      const usdzBlob = await this._convertToUSDZ(glbBlob);

      // Create a temporary anchor to trigger Quick Look
      const url = URL.createObjectURL(usdzBlob);
      const a = document.createElement('a');
      a.rel = 'ar';
      a.href = url;
      a.download = filename;

      // iOS Quick Look attributes
      a.setAttribute('rel', 'ar');

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Clean up after a delay
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      return { success: true, platform: 'ios' };
    } catch (error) {
      console.error('iOS AR launch failed:', error);
      throw error;
    }
  }

  /**
   * Launches Scene Viewer on Android
   */
  async launchAndroidAR(object, options = {}) {
    const { filename = 'cooler.glb' } = options;

    try {
      // Export as GLB
      const blob = await this.exportAsGLB(object);

      // Upload to server to get a public URL (required for Scene Viewer)
      const url = await this._uploadForAR(blob, filename);

      // Launch Scene Viewer with intent URL
      const intentUrl = `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(url)}&mode=ar_preferred#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=https://developers.google.com/ar;end;`;

      window.location.href = intentUrl;

      return { success: true, platform: 'android' };
    } catch (error) {
      console.error('Android AR launch failed:', error);
      throw error;
    }
  }

  /**
   * Shows QR code for desktop users to scan with mobile device
   */
  async showQRCode(object, options = {}) {
    const { filename = 'cooler.glb' } = options;

    try {
      // Export and upload model
      const blob = await this.exportAsGLB(object);
      const url = await this._uploadForAR(blob, filename);

      // Generate QR code pointing to AR viewer
      // Create a viewer URL that detects platform
      const viewerUrl = `${window.location.origin}/ar-viewer?model=${encodeURIComponent(url)}`;
      const qrCodeUrl = await this._generateQRCode(viewerUrl);

      // Show QR code modal
      this._showQRModal(qrCodeUrl, viewerUrl);

      return { success: true, platform: 'desktop', qrCodeUrl };
    } catch (error) {
      console.error('QR code generation failed:', error);
      throw error;
    }
  }

  /**
   * Exports object as GLB blob
   */
  async exportAsGLB(object) {
    return new Promise((resolve, reject) => {
      this.gltfExporter.parse(
        object,
        (result) => {
          const blob = new Blob([result], { type: 'model/gltf-binary' });
          resolve(blob);
        },
        (error) => {
          reject(error);
        },
        { binary: true }
      );
    });
  }

  /**
   * Downloads GLB file for manual use
   */
  async downloadGLB(object, filename = 'cooler.glb') {
    const blob = await this.exportAsGLB(object);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Private helper methods

  async _convertToUSDZ(glbBlob) {
    // Send GLB to server for USDZ conversion
    const formData = new FormData();
    formData.append('model', glbBlob, 'model.glb');

    const response = await fetch('/api/ar/convert-usdz', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('USDZ conversion failed');
    }

    return response.blob();
  }

  async _uploadForAR(blob, filename) {
    // Upload model to server and get public URL
    const formData = new FormData();
    formData.append('model', blob, filename);

    const response = await fetch('/api/ar/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Model upload failed');
    }

    const data = await response.json();
    return data.url;
  }

  async _generateQRCode(url) {
    // Generate QR code via server or API
    const response = await fetch('/api/ar/qr-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error('QR code generation failed');
    }

    const data = await response.json();
    return data.qrCodeUrl;
  }

  _showQRModal(qrCodeUrl, viewerUrl) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'ar-qr-modal';
    overlay.innerHTML = `
      <div class="ar-qr-modal__content">
        <button class="ar-qr-modal__close">&times;</button>
        <h2>View in AR</h2>
        <p>Scan this QR code with your mobile device to view in augmented reality</p>
        <img src="${qrCodeUrl}" alt="AR QR Code" class="ar-qr-modal__qr" />
        <p class="ar-qr-modal__url">${viewerUrl}</p>
        <div class="ar-qr-modal__instructions">
          <div class="ar-qr-modal__instruction">
            <strong>iOS:</strong> Opens in AR Quick Look
          </div>
          <div class="ar-qr-modal__instruction">
            <strong>Android:</strong> Opens in Scene Viewer
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Close handlers
    const close = () => {
      overlay.remove();
    };

    overlay.querySelector('.ar-qr-modal__close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    // ESC key to close
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }
}
