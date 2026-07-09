/**
 * Microinteractions.js
 *
 * Premium Feature: Polished UI microinteractions and animations
 * Provides delightful feedback for user interactions
 *
 * Features:
 * - Button press animations
 * - Toast notifications
 * - Ripple effects
 * - Shake animations for errors
 * - Confetti for sharing/completion
 * - Loading spinners
 * - Progress indicators
 */

export class Microinteractions {
  constructor() {
    this.toastContainer = null;
    this.createToastContainer();
    this.injectStyles();
  }

  /**
   * Create toast notification container
   */
  createToastContainer() {
    this.toastContainer = document.createElement('div');
    this.toastContainer.className = 'toast-container';
    document.body.appendChild(this.toastContainer);
  }

  /**
   * Inject CSS styles for microinteractions
   */
  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Toast Container */
      .toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: none;
      }

      /* Toast */
      .toast {
        background: var(--panel, #fff);
        border: 1px solid var(--line, #e0e0e0);
        border-radius: 8px;
        padding: 16px 20px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 300px;
        max-width: 400px;
        pointer-events: auto;
        animation: toast-slide-in 0.3s ease-out;
        transition: transform 0.2s ease, opacity 0.2s ease;
      }

      .toast.toast--removing {
        animation: toast-slide-out 0.3s ease-out forwards;
      }

      @keyframes toast-slide-in {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes toast-slide-out {
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }

      .toast__icon {
        width: 24px;
        height: 24px;
        flex-shrink: 0;
      }

      .toast__content {
        flex: 1;
      }

      .toast__title {
        font-weight: 600;
        font-size: 14px;
        margin: 0 0 4px;
      }

      .toast__message {
        font-size: 13px;
        color: var(--ink-500, #666);
        margin: 0;
      }

      .toast__close {
        background: none;
        border: none;
        font-size: 20px;
        color: var(--ink-300, #999);
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.15s ease;
      }

      .toast__close:hover {
        color: var(--ink-700, #333);
      }

      .toast--success {
        border-left: 4px solid #10b981;
      }

      .toast--error {
        border-left: 4px solid #ef4444;
      }

      .toast--warning {
        border-left: 4px solid #f59e0b;
      }

      .toast--info {
        border-left: 4px solid #3b82f6;
      }

      /* Ripple Effect */
      .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.6);
        transform: scale(0);
        animation: ripple-animation 0.6s ease-out;
        pointer-events: none;
      }

      @keyframes ripple-animation {
        to {
          transform: scale(4);
          opacity: 0;
        }
      }

      /* Button Press */
      .btn-pressed {
        animation: btn-press 0.15s ease-out;
      }

      @keyframes btn-press {
        0% {
          transform: scale(1);
        }
        50% {
          transform: scale(0.95);
        }
        100% {
          transform: scale(1);
        }
      }

      /* Shake Animation */
      .shake {
        animation: shake 0.4s ease-in-out;
      }

      @keyframes shake {
        0%, 100% {
          transform: translateX(0);
        }
        25% {
          transform: translateX(-10px);
        }
        75% {
          transform: translateX(10px);
        }
      }

      /* Pulse */
      .pulse {
        animation: pulse 0.6s ease-out;
      }

      @keyframes pulse {
        0% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(1.1);
          opacity: 0.8;
        }
        100% {
          transform: scale(1);
          opacity: 1;
        }
      }

      /* Bounce */
      .bounce {
        animation: bounce 0.5s ease-out;
      }

      @keyframes bounce {
        0%, 100% {
          transform: translateY(0);
        }
        25% {
          transform: translateY(-10px);
        }
        50% {
          transform: translateY(0);
        }
        75% {
          transform: translateY(-5px);
        }
      }

      /* Loading Spinner */
      .loading-spinner {
        border: 3px solid rgba(0, 0, 0, 0.1);
        border-top-color: var(--accent, #3b82f6);
        border-radius: 50%;
        width: 24px;
        height: 24px;
        animation: spinner 0.8s linear infinite;
      }

      @keyframes spinner {
        to {
          transform: rotate(360deg);
        }
      }

      /* Confetti */
      .confetti {
        position: fixed;
        width: 10px;
        height: 10px;
        pointer-events: none;
        z-index: 9999;
      }

      @keyframes confetti-fall {
        to {
          transform: translateY(100vh) rotate(360deg);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Show toast notification
   */
  showToast(message, options = {}) {
    const {
      type = 'info', // success, error, warning, info
      duration = 4000,
      title = null
    } = options;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;

    // Icon
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    const iconEl = document.createElement('div');
    iconEl.className = 'toast__icon';
    iconEl.textContent = icons[type];

    // Content
    const contentEl = document.createElement('div');
    contentEl.className = 'toast__content';

    if (title) {
      const titleEl = document.createElement('div');
      titleEl.className = 'toast__title';
      titleEl.textContent = title;
      contentEl.appendChild(titleEl);
    }

    const messageEl = document.createElement('div');
    messageEl.className = 'toast__message';
    messageEl.textContent = message;
    contentEl.appendChild(messageEl);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast__close';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = () => this.removeToast(toast);

    toast.appendChild(iconEl);
    toast.appendChild(contentEl);
    toast.appendChild(closeBtn);

    this.toastContainer.appendChild(toast);

    // Auto remove
    if (duration > 0) {
      setTimeout(() => this.removeToast(toast), duration);
    }

    return toast;
  }

  /**
   * Remove toast
   */
  removeToast(toast) {
    toast.classList.add('toast--removing');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  /**
   * Add ripple effect to element
   */
  addRipple(element, event) {
    const ripple = document.createElement('span');
    ripple.className = 'ripple';

    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);
  }

  /**
   * Button press animation
   */
  pressButton(element) {
    element.classList.add('btn-pressed');
    setTimeout(() => element.classList.remove('btn-pressed'), 150);
  }

  /**
   * Shake element (for errors)
   */
  shake(element) {
    element.classList.add('shake');
    setTimeout(() => element.classList.remove('shake'), 400);
  }

  /**
   * Pulse element
   */
  pulse(element) {
    element.classList.add('pulse');
    setTimeout(() => element.classList.remove('pulse'), 600);
  }

  /**
   * Bounce element
   */
  bounce(element) {
    element.classList.add('bounce');
    setTimeout(() => element.classList.remove('bounce'), 500);
  }

  /**
   * Create loading spinner
   */
  createSpinner() {
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    return spinner;
  }

  /**
   * Confetti celebration
   */
  celebrate(options = {}) {
    const {
      count = 50,
      colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
    } = options;

    for (let i = 0; i < count; i++) {
      this.createConfetti(colors);
    }
  }

  createConfetti(colors) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';

    const color = colors[Math.floor(Math.random() * colors.length)];
    const left = Math.random() * 100;
    const animationDuration = 2 + Math.random() * 2;
    const delay = Math.random() * 0.5;

    confetti.style.background = color;
    confetti.style.left = `${left}%`;
    confetti.style.top = '-10px';
    confetti.style.animation = `confetti-fall ${animationDuration}s linear ${delay}s forwards`;

    document.body.appendChild(confetti);

    setTimeout(() => confetti.remove(), (animationDuration + delay) * 1000);
  }

  /**
   * Setup button interactions
   */
  enhanceButton(button) {
    button.addEventListener('click', (e) => {
      this.pressButton(button);
      this.addRipple(button, e);
    });
  }

  /**
   * Setup all buttons in container
   */
  enhanceAllButtons(container = document) {
    const buttons = container.querySelectorAll('button, .btn');
    buttons.forEach(btn => this.enhanceButton(btn));
  }

  /**
   * Create progress bar
   */
  createProgressBar(options = {}) {
    const {
      container = document.body,
      height = 4,
      color = '#3b82f6'
    } = options;

    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 0%;
      height: ${height}px;
      background: ${color};
      transition: width 0.3s ease;
      z-index: 10001;
    `;

    container.appendChild(progressBar);

    return {
      element: progressBar,
      setProgress(percent) {
        progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
      },
      complete() {
        progressBar.style.width = '100%';
        setTimeout(() => progressBar.remove(), 300);
      },
      remove() {
        progressBar.remove();
      }
    };
  }

  /**
   * Cleanup
   */
  dispose() {
    if (this.toastContainer && this.toastContainer.parentNode) {
      this.toastContainer.parentNode.removeChild(this.toastContainer);
    }
  }
}

// Create global instance for easy access
export const microinteractions = new Microinteractions();

// Convenience function
export function showToast(message, type = 'info') {
  microinteractions.showToast(message, { type });
}
