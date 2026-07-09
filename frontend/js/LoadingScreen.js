/**
 * LoadingScreen.js
 * ---------------------------------------------------------------------------
 * Premium loading experience with progress tracking, asset names, and smooth
 * transitions. Replaces basic spinner with professional loading screen.
 * ---------------------------------------------------------------------------
 */

export class LoadingScreen {
  constructor() {
    this.container = null;
    this.progressBar = null;
    this.progressText = null;
    this.assetName = null;
    this.logo = null;
    this.isVisible = false;
    this.totalAssets = 0;
    this.loadedAssets = 0;

    this._createLoadingScreen();
  }

  /**
   * Shows the loading screen
   * @param {number} totalAssets - Total number of assets to load
   */
  show(totalAssets = 0) {
    this.totalAssets = totalAssets;
    this.loadedAssets = 0;
    this.isVisible = true;

    this.container.classList.add('is-visible');
    this.updateProgress(0, 'Initializing...');
  }

  /**
   * Hides the loading screen with fade transition
   */
  async hide() {
    return new Promise((resolve) => {
      this.container.classList.add('is-fading');

      setTimeout(() => {
        this.container.classList.remove('is-visible', 'is-fading');
        this.isVisible = false;
        resolve();
      }, 600);
    });
  }

  /**
   * Updates loading progress
   * @param {number} progress - Progress from 0 to 1
   * @param {string} message - Current loading message
   */
  updateProgress(progress, message = '') {
    const percentage = Math.round(progress * 100);

    // Update progress bar
    this.progressBar.style.transform = `scaleX(${progress})`;

    // Update percentage text
    this.progressText.textContent = `${percentage}%`;

    // Update asset name if provided
    if (message) {
      this.assetName.textContent = message;
    }
  }

  /**
   * Increments progress when an asset loads
   * @param {string} assetName - Name of the loaded asset
   */
  incrementProgress(assetName = '') {
    this.loadedAssets++;
    const progress = this.totalAssets > 0 ? this.loadedAssets / this.totalAssets : 0;
    this.updateProgress(progress, assetName);
  }

  /**
   * Sets a specific loading message
   * @param {string} message - Message to display
   */
  setMessage(message) {
    this.assetName.textContent = message;
  }

  /**
   * Creates the loading screen DOM structure
   */
  _createLoadingScreen() {
    this.container = document.createElement('div');
    this.container.className = 'loading-screen';

    this.container.innerHTML = `
      <div class="loading-screen__content">
        <div class="loading-screen__logo">
          <img src="assets/ameridoor-logo.png" alt="AmeriDoor" style="max-width: 200px; height: auto;" />
        </div>

        <div class="loading-screen__progress-container">
          <div class="loading-screen__progress-bar">
            <div class="loading-screen__progress-fill"></div>
          </div>
          <div class="loading-screen__progress-text">0%</div>
        </div>

        <div class="loading-screen__asset-name">Loading assets...</div>

        <div class="loading-screen__spinner">
          <div class="loading-screen__spinner-ring"></div>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);

    // Store references
    this.progressBar = this.container.querySelector('.loading-screen__progress-fill');
    this.progressText = this.container.querySelector('.loading-screen__progress-text');
    this.assetName = this.container.querySelector('.loading-screen__asset-name');
    this.logo = this.container.querySelector('.loading-screen__logo');
  }
}

// Add styles dynamically if not in CSS
export function injectLoadingStyles() {
  if (document.getElementById('loading-screen-styles')) return;

  const style = document.createElement('style');
  style.id = 'loading-screen-styles';
  style.textContent = `
    .loading-screen {
      position: fixed;
      inset: 0;
      background: linear-gradient(135deg, #F3F6F7 0%, #E2E9EB 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.4s ease;
    }

    .loading-screen.is-visible {
      opacity: 1;
      pointer-events: all;
    }

    .loading-screen.is-fading {
      opacity: 0;
    }

    .loading-screen__content {
      text-align: center;
      max-width: 400px;
      width: 90%;
    }

    .loading-screen__logo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 48px;
      animation: logo-fade-in 0.6s ease-out;
    }

    .loading-screen__logo-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 12px;
      background: var(--ink-900, #101A22);
      color: #fff;
      font-family: var(--font-display, 'Space Grotesk', system-ui, sans-serif);
      font-weight: 700;
      font-size: 24px;
      letter-spacing: 0.02em;
      box-shadow: 0 8px 32px rgba(16, 26, 34, 0.16);
    }

    .loading-screen__logo-text {
      font-family: var(--font-display, 'Space Grotesk', system-ui, sans-serif);
      font-weight: 700;
      font-size: 32px;
      color: var(--ink-900, #101A22);
      letter-spacing: -0.02em;
    }

    .loading-screen__progress-container {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
      animation: progress-fade-in 0.6s ease-out 0.2s both;
    }

    .loading-screen__progress-bar {
      flex: 1;
      height: 4px;
      background: rgba(16, 26, 34, 0.1);
      border-radius: 999px;
      overflow: hidden;
      position: relative;
    }

    .loading-screen__progress-fill {
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, var(--accent, #17798A), var(--accent-600, #125F6C));
      transform-origin: left;
      transform: scaleX(0);
      transition: transform 0.3s ease;
      box-shadow: 0 0 12px var(--accent, #17798A);
    }

    .loading-screen__progress-text {
      font-family: var(--font-mono, 'IBM Plex Mono', monospace);
      font-size: 14px;
      font-weight: 600;
      color: var(--ink-700, #26343E);
      min-width: 48px;
      text-align: right;
    }

    .loading-screen__asset-name {
      font-family: var(--font-mono, 'IBM Plex Mono', monospace);
      font-size: 12px;
      color: var(--ink-500, #5B6B76);
      height: 20px;
      margin-bottom: 32px;
      animation: asset-fade-in 0.6s ease-out 0.4s both;
    }

    .loading-screen__spinner {
      display: flex;
      justify-content: center;
      animation: spinner-fade-in 0.6s ease-out 0.6s both;
    }

    .loading-screen__spinner-ring {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 3px solid rgba(16, 26, 34, 0.1);
      border-top-color: var(--accent, #17798A);
      animation: spin 1s linear infinite;
    }

    @keyframes logo-fade-in {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes progress-fade-in {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes asset-fade-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes spinner-fade-in {
      from {
        opacity: 0;
        transform: scale(0.8);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .loading-screen,
      .loading-screen__logo,
      .loading-screen__progress-container,
      .loading-screen__asset-name,
      .loading-screen__spinner {
        animation: none !important;
      }
      .loading-screen__progress-fill {
        transition: none !important;
      }
    }
  `;

  document.head.appendChild(style);
}
