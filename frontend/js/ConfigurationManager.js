/**
 * ConfigurationManager.js
 * ---------------------------------------------------------------------------
 * Manages save/load/share functionality for cooler configurations.
 * Handles serialization, localStorage persistence, server sync, and
 * shareable link generation.
 * ---------------------------------------------------------------------------
 */

import { CONFIG } from './config.js';

export class ConfigurationManager {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.storageKey = 'ameridoor.saved_configs';
    this.currentConfigKey = 'ameridoor.current_config';
  }

  /**
   * Serializes the current configuration including camera state
   * @returns {object} Complete configuration snapshot
   */
  serializeConfiguration() {
    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      projectName: CONFIG.projectName || `Configuration ${new Date().toLocaleDateString()}`,

      // Core configuration
      appType: CONFIG.appType,
      dimensions: {
        depth: CONFIG.depth,
        width: CONFIG.width,
        height: CONFIG.height,
      },
      displayDoors: CONFIG.displayDoors,
      entryDoors: [...CONFIG.entryDoors],
      finish: CONFIG.finish,
      accessories: { ...CONFIG.accessories },

      // Camera state for exact view restoration
      camera: {
        position: this.camera.position.toArray(),
        target: this.controls.target.toArray(),
        zoom: this.camera.zoom,
      },
    };
  }

  /**
   * Restores a saved configuration
   * @param {object} config - Serialized configuration
   * @param {Function} refreshCallback - Callback to refresh the UI and 3D scene
   */
  restoreConfiguration(config, refreshCallback) {
    if (!config || config.version !== '1.0.0') {
      throw new Error('Invalid or incompatible configuration format');
    }

    // Restore core settings
    CONFIG.appType = config.appType || 'cooler';
    CONFIG.depth = config.dimensions.depth;
    CONFIG.width = config.dimensions.width;
    CONFIG.height = config.dimensions.height;
    CONFIG.displayDoors = config.displayDoors;
    CONFIG.entryDoors = config.entryDoors || [];
    CONFIG.finish = config.finish || 'galvalume';
    CONFIG.accessories = { ...config.accessories };
    CONFIG.projectName = config.projectName;

    // Restore camera state
    if (config.camera) {
      this.camera.position.fromArray(config.camera.position);
      this.controls.target.fromArray(config.camera.target);
      if (config.camera.zoom) this.camera.zoom = config.camera.zoom;
      this.camera.updateProjectionMatrix();
      this.controls.update();
    }

    // Trigger UI and scene refresh
    if (refreshCallback) refreshCallback();
  }

  /**
   * Saves configuration to localStorage
   * @param {string} name - Optional project name
   * @returns {string} Saved configuration ID
   */
  saveToLocalStorage(name = null) {
    const config = this.serializeConfiguration();
    if (name) config.projectName = name;

    const id = this._generateId();
    config.id = id;

    const saved = this._getSavedConfigurations();
    saved[id] = config;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(saved));
      localStorage.setItem(this.currentConfigKey, JSON.stringify(config));
      return id;
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
      throw new Error('Storage quota exceeded or localStorage unavailable');
    }
  }

  /**
   * Loads configuration from localStorage by ID
   * @param {string} id - Configuration ID
   * @param {Function} refreshCallback - Callback to refresh UI
   */
  loadFromLocalStorage(id, refreshCallback) {
    const saved = this._getSavedConfigurations();
    const config = saved[id];

    if (!config) {
      throw new Error(`Configuration ${id} not found`);
    }

    this.restoreConfiguration(config, refreshCallback);
    return config;
  }

  /**
   * Gets all saved configurations
   * @returns {Array} Array of saved configurations
   */
  getAllSavedConfigurations() {
    const saved = this._getSavedConfigurations();
    return Object.values(saved).sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );
  }

  /**
   * Deletes a saved configuration
   * @param {string} id - Configuration ID
   */
  deleteConfiguration(id) {
    const saved = this._getSavedConfigurations();
    delete saved[id];
    localStorage.setItem(this.storageKey, JSON.stringify(saved));
  }

  /**
   * Duplicates a saved configuration
   * @param {string} id - Configuration ID to duplicate
   * @returns {string} New configuration ID
   */
  duplicateConfiguration(id) {
    const saved = this._getSavedConfigurations();
    const original = saved[id];

    if (!original) {
      throw new Error(`Configuration ${id} not found`);
    }

    const duplicate = JSON.parse(JSON.stringify(original));
    duplicate.id = this._generateId();
    duplicate.projectName = `${original.projectName} (Copy)`;
    duplicate.timestamp = new Date().toISOString();

    saved[duplicate.id] = duplicate;
    localStorage.setItem(this.storageKey, JSON.stringify(saved));

    return duplicate.id;
  }

  /**
   * Saves configuration to server and gets shareable link
   * @returns {Promise<object>} Object with share URL and ID
   */
  async saveToServer() {
    const config = this.serializeConfiguration();

    try {
      const response = await fetch('/api/configurations/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to save configuration');
      }

      const data = await response.json();
      return {
        id: data.id,
        url: `${window.location.origin}/?config=${data.id}`,
        shortUrl: data.shortUrl || null,
      };
    } catch (err) {
      console.error('Server save failed:', err);
      throw err;
    }
  }

  /**
   * Loads configuration from server by ID
   * @param {string} id - Configuration ID from URL
   * @param {Function} refreshCallback - Callback to refresh UI
   */
  async loadFromServer(id, refreshCallback) {
    try {
      const response = await fetch(`/api/configurations/${id}`);

      if (!response.ok) {
        throw new Error('Configuration not found');
      }

      const config = await response.json();
      this.restoreConfiguration(config, refreshCallback);
      return config;
    } catch (err) {
      console.error('Server load failed:', err);
      throw err;
    }
  }

  /**
   * Exports configuration as JSON file
   * @param {string} filename - Optional filename
   */
  exportAsJSON(filename = null) {
    const config = this.serializeConfiguration();
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `${config.projectName.replace(/\s+/g, '_')}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Imports configuration from JSON file
   * @param {File} file - JSON file
   * @param {Function} refreshCallback - Callback to refresh UI
   */
  async importFromJSON(file, refreshCallback) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const config = JSON.parse(e.target.result);
          this.restoreConfiguration(config, refreshCallback);
          resolve(config);
        } catch (err) {
          reject(new Error('Invalid JSON file'));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  // Private helper methods

  _getSavedConfigurations() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : {};
    } catch (err) {
      console.warn('Failed to read saved configurations:', err);
      return {};
    }
  }

  _generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
