/**
 * PriceAnimations.js
 * ---------------------------------------------------------------------------
 * Animated price transitions with color feedback.
 * Makes price changes feel premium and provides visual feedback on
 * increases (green) vs decreases (red).
 * ---------------------------------------------------------------------------
 */

export class PriceAnimations {
  constructor(priceElement) {
    this.priceElement = priceElement;
    this.currentPrice = 0;
    this.animationFrameId = null;
  }

  /**
   * Animates price from current value to new value
   * @param {number} newPrice - Target price
   * @param {number} duration - Animation duration in milliseconds
   */
  animateTo(newPrice, duration = 600) {
    // Cancel any ongoing animation
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const startPrice = this.currentPrice;
    const difference = newPrice - startPrice;
    const startTime = performance.now();

    // Determine color based on price change
    const isIncrease = difference > 0;
    const isDecrease = difference < 0;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Use easeOutCubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentValue = startPrice + difference * eased;

      // Update display
      this.currentPrice = currentValue;
      this.priceElement.textContent = this.formatPrice(currentValue);

      // Flash color on change
      if (progress < 0.3) {
        // Flash phase
        if (isIncrease) {
          this.priceElement.style.color = '#2D7A4D'; // Green
        } else if (isDecrease) {
          this.priceElement.style.color = '#B4521C'; // Warn/red
        }
      } else if (progress < 0.6) {
        // Fade back phase
        const fadeProgress = (progress - 0.3) / 0.3;
        if (isIncrease) {
          this.priceElement.style.color = this._interpolateColor('#2D7A4D', 'var(--ink-900)', fadeProgress);
        } else if (isDecrease) {
          this.priceElement.style.color = this._interpolateColor('#B4521C', 'var(--ink-900)', fadeProgress);
        }
      } else {
        // Reset to default
        this.priceElement.style.color = '';
      }

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        this.animationFrameId = null;
        this.currentPrice = newPrice;
        this.priceElement.textContent = this.formatPrice(newPrice);
        this.priceElement.style.color = '';
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * Sets price instantly without animation (for initial load)
   */
  setInstant(price) {
    this.currentPrice = price;
    this.priceElement.textContent = this.formatPrice(price);
    this.priceElement.style.color = '';
  }

  /**
   * Formats price as USD currency
   */
  formatPrice(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(Math.round(value));
  }

  /**
   * Interpolates between two colors
   */
  _interpolateColor(color1, color2, progress) {
    // Simple implementation - for production, use a proper color library
    // This handles basic hex colors
    if (color2.startsWith('var(')) {
      // Can't interpolate CSS variables easily, just return final color
      return progress > 0.5 ? color2 : color1;
    }

    const hex1 = color1.replace('#', '');
    const hex2 = color2.replace('#', '');

    const r1 = parseInt(hex1.substr(0, 2), 16);
    const g1 = parseInt(hex1.substr(2, 2), 16);
    const b1 = parseInt(hex1.substr(4, 2), 16);

    const r2 = parseInt(hex2.substr(0, 2), 16);
    const g2 = parseInt(hex2.substr(2, 2), 16);
    const b2 = parseInt(hex2.substr(4, 2), 16);

    const r = Math.round(r1 + (r2 - r1) * progress);
    const g = Math.round(g1 + (g2 - g1) * progress);
    const b = Math.round(b1 + (b2 - b1) * progress);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Adds a pulse effect to draw attention
   */
  pulse() {
    this.priceElement.style.animation = 'none';
    // Force reflow
    void this.priceElement.offsetWidth;
    this.priceElement.style.animation = 'price-pulse 0.4s ease-out';

    setTimeout(() => {
      this.priceElement.style.animation = '';
    }, 400);
  }
}
