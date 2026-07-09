/**
 * AccessibilityManager.js
 *
 * Premium Feature: Comprehensive accessibility support
 * Ensures WCAG 2.1 AA compliance and inclusive user experience
 *
 * Features:
 * - Keyboard navigation
 * - Screen reader support (ARIA labels)
 * - Focus management
 * - High contrast mode
 * - Reduced motion support
 * - Keyboard shortcuts
 * - Focus indicators
 */

export class AccessibilityManager {
  constructor(scene, camera, controls) {
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;

    // State
    this.focusableElements = [];
    this.currentFocusIndex = -1;
    this.announcer = null;

    // Settings
    this.settings = {
      keyboardNavigationEnabled: true,
      highContrastMode: false,
      reducedMotion: false,
      screenReaderMode: false
    };

    // Keyboard shortcuts
    this.shortcuts = new Map();

    this.init();
  }

  /**
   * Initialize accessibility features
   */
  init() {
    this.createScreenReaderAnnouncer();
    this.setupKeyboardNavigation();
    this.detectUserPreferences();
    this.registerDefaultShortcuts();
    this.injectStyles();
  }

  /**
   * Create live region for screen reader announcements
   */
  createScreenReaderAnnouncer() {
    this.announcer = document.createElement('div');
    this.announcer.setAttribute('role', 'status');
    this.announcer.setAttribute('aria-live', 'polite');
    this.announcer.setAttribute('aria-atomic', 'true');
    this.announcer.className = 'sr-only';
    document.body.appendChild(this.announcer);
  }

  /**
   * Announce message to screen readers
   */
  announce(message, priority = 'polite') {
    if (!this.announcer) return;

    this.announcer.setAttribute('aria-live', priority);
    this.announcer.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      this.announcer.textContent = '';
    }, 1000);
  }

  /**
   * Setup keyboard navigation
   */
  setupKeyboardNavigation() {
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));

    // Track focusable elements
    this.updateFocusableElements();

    // Re-scan when DOM changes
    const observer = new MutationObserver(() => {
      this.updateFocusableElements();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Update list of focusable elements
   */
  updateFocusableElements() {
    const selector = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    this.focusableElements = Array.from(document.querySelectorAll(selector));

    // Add ARIA labels where missing
    this.focusableElements.forEach((el) => {
      if (!el.getAttribute('aria-label') && !el.textContent.trim()) {
        const role = el.getAttribute('role') || el.tagName.toLowerCase();
        el.setAttribute('aria-label', `${role} control`);
      }
    });
  }

  /**
   * Handle keyboard events
   */
  handleKeyDown(event) {
    if (!this.settings.keyboardNavigationEnabled) return;

    // Check for registered shortcuts
    const key = this.getKeyCombo(event);
    if (this.shortcuts.has(key)) {
      event.preventDefault();
      const handler = this.shortcuts.get(key);
      handler(event);
      return;
    }

    // Built-in navigation
    switch (event.key) {
      case 'Tab':
        this.handleTabNavigation(event);
        break;
      case 'Escape':
        this.handleEscape(event);
        break;
      case '?':
        if (event.shiftKey) {
          this.showKeyboardShortcuts();
        }
        break;
    }
  }

  handleKeyUp(event) {
    // Handle key releases if needed
  }

  /**
   * Handle Tab navigation
   */
  handleTabNavigation(event) {
    if (event.shiftKey) {
      // Reverse tab
      this.currentFocusIndex--;
      if (this.currentFocusIndex < 0) {
        this.currentFocusIndex = this.focusableElements.length - 1;
      }
    } else {
      // Forward tab
      this.currentFocusIndex++;
      if (this.currentFocusIndex >= this.focusableElements.length) {
        this.currentFocusIndex = 0;
      }
    }

    // Focus element if available
    if (this.focusableElements[this.currentFocusIndex]) {
      event.preventDefault();
      this.focusableElements[this.currentFocusIndex].focus();
    }
  }

  /**
   * Handle Escape key
   */
  handleEscape(event) {
    // Close any open modals
    const modals = document.querySelectorAll('.modal.is-visible, .projects-modal.is-visible');
    modals.forEach(modal => modal.classList.remove('is-visible'));

    if (modals.length > 0) {
      this.announce('Modal closed');
    }
  }

  /**
   * Get keyboard shortcut combo
   */
  getKeyCombo(event) {
    const parts = [];
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Meta');
    parts.push(event.key);
    return parts.join('+');
  }

  /**
   * Register keyboard shortcut
   */
  registerShortcut(keyCombo, handler, description = '') {
    this.shortcuts.set(keyCombo, handler);

    // Store description for help menu
    if (!this.shortcutDescriptions) {
      this.shortcutDescriptions = new Map();
    }
    this.shortcutDescriptions.set(keyCombo, description);
  }

  /**
   * Register default shortcuts
   */
  registerDefaultShortcuts() {
    this.registerShortcut('s', () => {
      document.getElementById('saveBtn')?.click();
    }, 'Save configuration');

    this.registerShortcut('p', () => {
      document.getElementById('myProjectsBtn')?.click();
    }, 'Open projects');

    this.registerShortcut('r', () => {
      document.getElementById('screenshotBtn')?.click();
    }, 'Export render');

    this.registerShortcut('1', () => {
      document.querySelector('[data-view="front"]')?.click();
    }, 'Front view');

    this.registerShortcut('2', () => {
      document.querySelector('[data-view="side"]')?.click();
    }, 'Side view');

    this.registerShortcut('3', () => {
      document.querySelector('[data-view="top"]')?.click();
    }, 'Top view');

    this.registerShortcut('4', () => {
      document.querySelector('[data-view="orbit"]')?.click();
    }, 'Orbit view');
  }

  /**
   * Show keyboard shortcuts help
   */
  showKeyboardShortcuts() {
    const modal = document.createElement('div');
    modal.className = 'modal is-visible';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Keyboard shortcuts');

    let shortcutsHTML = '<h3>Keyboard Shortcuts</h3><div class="shortcuts-list">';

    this.shortcutDescriptions.forEach((description, combo) => {
      shortcutsHTML += `
        <div class="shortcut-row">
          <kbd>${combo}</kbd>
          <span>${description}</span>
        </div>
      `;
    });

    shortcutsHTML += `
      <div class="shortcut-row">
        <kbd>Tab</kbd>
        <span>Navigate between controls</span>
      </div>
      <div class="shortcut-row">
        <kbd>Esc</kbd>
        <span>Close modal</span>
      </div>
      <div class="shortcut-row">
        <kbd>Shift+?</kbd>
        <span>Show this help</span>
      </div>
    `;

    shortcutsHTML += '</div>';

    modal.innerHTML = `
      <div class="modal__overlay"></div>
      <div class="modal__content">
        ${shortcutsHTML}
        <button class="btn btn-primary" onclick="this.closest('.modal').remove()">Close</button>
      </div>
    `;

    document.body.appendChild(modal);
    this.announce('Keyboard shortcuts dialog opened');
  }

  /**
   * Detect user preferences from OS/browser
   */
  detectUserPreferences() {
    // Reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.settings.reducedMotion = prefersReducedMotion.matches;

    prefersReducedMotion.addEventListener('change', (e) => {
      this.settings.reducedMotion = e.matches;
      this.applyReducedMotion(e.matches);
    });

    // High contrast
    const prefersContrast = window.matchMedia('(prefers-contrast: high)');
    this.settings.highContrastMode = prefersContrast.matches;

    prefersContrast.addEventListener('change', (e) => {
      this.settings.highContrastMode = e.matches;
      this.applyHighContrast(e.matches);
    });

    // Apply initial preferences
    if (this.settings.reducedMotion) {
      this.applyReducedMotion(true);
    }

    if (this.settings.highContrastMode) {
      this.applyHighContrast(true);
    }
  }

  /**
   * Apply reduced motion
   */
  applyReducedMotion(enabled) {
    if (enabled) {
      document.body.classList.add('reduce-motion');
      // Disable camera animations
      if (this.controls) {
        this.controls.enableDamping = false;
      }
    } else {
      document.body.classList.remove('reduce-motion');
      if (this.controls) {
        this.controls.enableDamping = true;
      }
    }
  }

  /**
   * Apply high contrast mode
   */
  applyHighContrast(enabled) {
    if (enabled) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
  }

  /**
   * Add ARIA labels to 3D objects
   */
  labelObject(object, label, description = '') {
    object.userData.ariaLabel = label;
    object.userData.ariaDescription = description;
  }

  /**
   * Focus on 3D object (for screen readers)
   */
  focusObject(object) {
    if (object.userData.ariaLabel) {
      this.announce(object.userData.ariaLabel);

      if (object.userData.ariaDescription) {
        setTimeout(() => {
          this.announce(object.userData.ariaDescription);
        }, 500);
      }
    }
  }

  /**
   * Inject accessibility styles
   */
  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Screen reader only */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
      }

      /* Focus indicators */
      *:focus-visible {
        outline: 3px solid var(--accent, #3b82f6);
        outline-offset: 2px;
      }

      button:focus-visible,
      .btn:focus-visible {
        outline: 3px solid var(--accent, #3b82f6);
        outline-offset: 2px;
      }

      /* High contrast mode */
      .high-contrast {
        --ink-900: #000;
        --ink-100: #fff;
        --accent: #0066ff;
        --line: #000;
      }

      .high-contrast button,
      .high-contrast .btn {
        border: 2px solid currentColor;
      }

      /* Reduced motion */
      .reduce-motion *,
      .reduce-motion *::before,
      .reduce-motion *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }

      /* Keyboard shortcuts modal */
      .shortcuts-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin: 20px 0;
      }

      .shortcut-row {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      kbd {
        background: var(--bg, #f0f0f0);
        border: 1px solid var(--line, #ccc);
        border-radius: 4px;
        padding: 4px 8px;
        font-family: var(--font-mono, monospace);
        font-size: 12px;
        min-width: 60px;
        text-align: center;
      }

      /* Skip link */
      .skip-link {
        position: absolute;
        top: -40px;
        left: 0;
        background: var(--accent, #3b82f6);
        color: white;
        padding: 8px 16px;
        text-decoration: none;
        z-index: 10000;
      }

      .skip-link:focus {
        top: 0;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Add skip link for keyboard navigation
   */
  addSkipLink(targetId) {
    const skipLink = document.createElement('a');
    skipLink.href = `#${targetId}`;
    skipLink.className = 'skip-link';
    skipLink.textContent = 'Skip to main content';
    document.body.insertBefore(skipLink, document.body.firstChild);
  }

  /**
   * Get accessibility report
   */
  getReport() {
    const issues = [];

    // Check for missing alt text
    document.querySelectorAll('img:not([alt])').forEach(img => {
      issues.push({ type: 'missing-alt', element: img });
    });

    // Check for missing labels
    document.querySelectorAll('button:not([aria-label])').forEach(btn => {
      if (!btn.textContent.trim()) {
        issues.push({ type: 'missing-label', element: btn });
      }
    });

    return {
      settings: this.settings,
      shortcutCount: this.shortcuts.size,
      focusableElements: this.focusableElements.length,
      issues
    };
  }

  /**
   * Cleanup
   */
  dispose() {
    if (this.announcer && this.announcer.parentNode) {
      this.announcer.parentNode.removeChild(this.announcer);
    }
  }
}
