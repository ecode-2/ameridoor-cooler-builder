/**
 * PDFQuoteGenerator.js
 *
 * Premium Feature: Professional PDF quote generation
 * Creates branded, printable quotes with configuration details and pricing
 *
 * Features:
 * - Professional PDF layout
 * - Company branding
 * - Configuration summary
 * - Itemized pricing breakdown
 * - 3D render preview image
 * - Terms and conditions
 * - Quote ID and timestamp
 *
 * Note: Uses jsPDF library (include in HTML: <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>)
 */

export class PDFQuoteGenerator {
  constructor(screenshotExporter = null) {
    this.screenshotExporter = screenshotExporter;

    // Company branding
    this.branding = {
      companyName: 'AmeriDoor',
      address: '123 Industrial Parkway',
      city: 'Your City, ST 12345',
      phone: '(555) 123-4567',
      email: 'sales@ameridoor.com',
      website: 'www.ameridoor.com',
      logoUrl: './assets/ameridoor-logo.png'
    };

    // PDF settings
    this.settings = {
      format: 'letter',
      orientation: 'portrait',
      unit: 'in',
      margins: 0.5
    };
  }

  /**
   * Generate PDF quote
   */
  async generateQuote(config, pricing, options = {}) {
    const {
      quoteId = this.generateQuoteId(),
      customerName = '',
      customerEmail = '',
      includeImage = true,
      includeTerms = true
    } = options;

    // Check if jsPDF is available
    if (typeof window.jspdf === 'undefined') {
      console.error('jsPDF library not loaded');
      throw new Error('jsPDF library required. Include: https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: this.settings.orientation,
      unit: this.settings.unit,
      format: this.settings.format
    });

    let yPos = this.settings.margins;

    // Header
    yPos = this.addHeader(doc, yPos);

    // Quote info
    yPos = this.addQuoteInfo(doc, yPos, quoteId, customerName, customerEmail);

    // Configuration summary
    yPos = this.addConfigurationSummary(doc, yPos, config);

    // Pricing breakdown
    yPos = this.addPricingBreakdown(doc, yPos, pricing);

    // Add render image if requested
    if (includeImage && this.screenshotExporter) {
      try {
        const imageData = await this.screenshotExporter.captureForPDF();
        yPos = this.addRenderImage(doc, yPos, imageData);
      } catch (err) {
        console.warn('Failed to add render image to PDF:', err);
      }
    }

    // Add new page for terms if needed
    if (includeTerms) {
      doc.addPage();
      this.addTermsAndConditions(doc, this.settings.margins);
    }

    // Footer on all pages
    this.addFooter(doc);

    // Download
    const filename = `AmeriDoor_Quote_${quoteId}_${Date.now()}.pdf`;
    doc.save(filename);

    return { filename, quoteId };
  }

  /**
   * Add header with branding
   */
  addHeader(doc, yPos) {
    const pageWidth = doc.internal.pageSize.getWidth();

    // Company name
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 83, 156); // AmeriDoor blue
    doc.text(this.branding.companyName, this.settings.margins, yPos + 0.3);

    // Tagline
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    doc.text('Walk-In Cooler & Freezer Solutions', this.settings.margins, yPos + 0.6);

    // Contact info (right aligned)
    doc.setFontSize(9);
    const contactLines = [
      this.branding.address,
      this.branding.city,
      this.branding.phone,
      this.branding.email,
      this.branding.website
    ];

    let contactY = yPos + 0.3;
    contactLines.forEach(line => {
      const textWidth = doc.getTextWidth(line);
      doc.text(line, pageWidth - this.settings.margins - textWidth, contactY);
      contactY += 0.15;
    });

    // Divider line
    doc.setDrawColor(0, 83, 156);
    doc.setLineWidth(0.02);
    doc.line(this.settings.margins, yPos + 1.2, pageWidth - this.settings.margins, yPos + 1.2);

    return yPos + 1.4;
  }

  /**
   * Add quote information
   */
  addQuoteInfo(doc, yPos, quoteId, customerName, customerEmail) {
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0);
    doc.text('QUOTE', this.settings.margins, yPos);

    yPos += 0.4;

    // Quote details
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');

    const details = [
      ['Quote ID:', quoteId],
      ['Date:', new Date().toLocaleDateString()],
      ['Valid Until:', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()],
    ];

    if (customerName) {
      details.push(['Customer:', customerName]);
    }

    if (customerEmail) {
      details.push(['Email:', customerEmail]);
    }

    details.forEach(([label, value]) => {
      doc.setFont(undefined, 'bold');
      doc.text(label, this.settings.margins, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(value, this.settings.margins + 1.2, yPos);
      yPos += 0.2;
    });

    return yPos + 0.3;
  }

  /**
   * Add configuration summary
   */
  addConfigurationSummary(doc, yPos, config) {
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 83, 156);
    doc.text('Configuration Summary', this.settings.margins, yPos);

    yPos += 0.3;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0);

    const specifications = [
      ['Dimensions:', `${config.width}' W × ${config.depth}' D × ${config.height}' H`],
      ['Temperature Type:', config.tempType === 'cooler' ? 'Cooler (35-38°F)' : 'Freezer (-10-0°F)'],
      ['Panel Finish:', this.formatPanelFinish(config.panelFinish)],
      ['Floor Type:', this.formatFloorType(config.floorType)],
      ['Door Configuration:', `${config.doorCount} Door(s), ${config.doorHanding} Handing`],
      ['Door Style:', this.formatDoorStyle(config.doorStyle)],
    ];

    // Optional features
    if (config.ramp) {
      specifications.push(['Ramp:', 'Included']);
    }

    if (config.lighting) {
      specifications.push(['LED Lighting:', 'Included']);
    }

    specifications.forEach(([label, value]) => {
      doc.setFont(undefined, 'bold');
      doc.text(label, this.settings.margins + 0.2, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(value, this.settings.margins + 2, yPos);
      yPos += 0.2;
    });

    return yPos + 0.3;
  }

  /**
   * Add pricing breakdown
   */
  addPricingBreakdown(doc, yPos, pricing) {
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 83, 156);
    doc.text('Pricing Breakdown', this.settings.margins, yPos);

    yPos += 0.3;

    // Table header background
    doc.setFillColor(240, 240, 240);
    doc.rect(this.settings.margins, yPos - 0.15, pageWidth - 2 * this.settings.margins, 0.25, 'F');

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0);
    doc.text('Item', this.settings.margins + 0.1, yPos);
    doc.text('Price', pageWidth - this.settings.margins - 1, yPos);

    yPos += 0.35;

    // Line items
    doc.setFont(undefined, 'normal');

    const lineItems = [
      ['Base Unit', `$${pricing.basePrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
      ['Doors', `$${pricing.doorPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
      ['Floor', `$${pricing.floorPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
    ];

    if (pricing.rampPrice > 0) {
      lineItems.push(['Ramp', `$${pricing.rampPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`]);
    }

    if (pricing.lightingPrice > 0) {
      lineItems.push(['LED Lighting', `$${pricing.lightingPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`]);
    }

    lineItems.forEach(([item, price]) => {
      doc.text(item, this.settings.margins + 0.1, yPos);
      const priceWidth = doc.getTextWidth(price);
      doc.text(price, pageWidth - this.settings.margins - priceWidth - 0.1, yPos);
      yPos += 0.2;
    });

    // Subtotal
    yPos += 0.1;
    doc.setFont(undefined, 'bold');
    doc.text('Subtotal:', this.settings.margins + 0.1, yPos);
    const subtotal = `$${pricing.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const subtotalWidth = doc.getTextWidth(subtotal);
    doc.text(subtotal, pageWidth - this.settings.margins - subtotalWidth - 0.1, yPos);

    // Total line
    yPos += 0.15;
    doc.setDrawColor(0, 83, 156);
    doc.setLineWidth(0.02);
    doc.line(this.settings.margins, yPos, pageWidth - this.settings.margins, yPos);

    yPos += 0.25;

    // Total
    doc.setFontSize(14);
    doc.setTextColor(0, 83, 156);
    doc.text('TOTAL:', this.settings.margins + 0.1, yPos);
    const total = `$${pricing.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const totalWidth = doc.getTextWidth(total);
    doc.text(total, pageWidth - this.settings.margins - totalWidth - 0.1, yPos);

    // Note
    yPos += 0.4;
    doc.setFontSize(9);
    doc.setFont(undefined, 'italic');
    doc.setTextColor(100);
    doc.text('* Price does not include installation, shipping, or applicable taxes.', this.settings.margins, yPos);
    doc.text('  Contact our sales team for a complete installed quote.', this.settings.margins, yPos + 0.15);

    return yPos + 0.5;
  }

  /**
   * Add render image
   */
  addRenderImage(doc, yPos, imageData) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const imgWidth = pageWidth - 2 * this.settings.margins;
    const imgHeight = imgWidth * 0.6; // 16:10 aspect ratio

    // Check if we need a new page
    if (yPos + imgHeight > doc.internal.pageSize.getHeight() - this.settings.margins) {
      doc.addPage();
      yPos = this.settings.margins;
    }

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 83, 156);
    doc.text('3D Preview', this.settings.margins, yPos);

    yPos += 0.3;

    doc.addImage(imageData, 'PNG', this.settings.margins, yPos, imgWidth, imgHeight);

    return yPos + imgHeight + 0.3;
  }

  /**
   * Add terms and conditions
   */
  addTermsAndConditions(doc, yPos) {
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 83, 156);
    doc.text('Terms and Conditions', this.settings.margins, yPos);

    yPos += 0.4;

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0);

    const terms = [
      '1. QUOTE VALIDITY: This quote is valid for 30 days from the date of issue.',
      '2. PRICING: Prices are subject to change based on material costs and availability.',
      '3. PAYMENT TERMS: 50% deposit required upon order, balance due before shipment.',
      '4. LEAD TIME: Standard lead time is 4-6 weeks from order confirmation.',
      '5. SHIPPING: FOB factory. Freight costs are additional and will be quoted separately.',
      '6. INSTALLATION: Professional installation is recommended and can be quoted separately.',
      '7. WARRANTY: Standard 1-year manufacturer warranty on all components.',
      '8. RETURNS: Custom-built units are non-returnable. Damaged items must be reported within 48 hours.',
      '9. SPECIFICATIONS: Final specifications may vary slightly from those shown in this quote.',
      '10. ACCEPTANCE: By accepting this quote, customer agrees to all terms and conditions.',
    ];

    terms.forEach(term => {
      const lines = doc.splitTextToSize(term, doc.internal.pageSize.getWidth() - 2 * this.settings.margins);
      lines.forEach(line => {
        doc.text(line, this.settings.margins, yPos);
        yPos += 0.15;
      });
      yPos += 0.1;
    });

    return yPos;
  }

  /**
   * Add footer to all pages
   */
  addFooter(doc) {
    const pageCount = doc.internal.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(150);

      const footerText = `${this.branding.companyName} | ${this.branding.phone} | ${this.branding.email}`;
      const textWidth = doc.getTextWidth(footerText);
      doc.text(footerText, (pageWidth - textWidth) / 2, pageHeight - 0.3);

      const pageText = `Page ${i} of ${pageCount}`;
      const pageWidth2 = doc.getTextWidth(pageText);
      doc.text(pageText, pageWidth - this.settings.margins - pageWidth2, pageHeight - 0.3);
    }
  }

  /**
   * Generate quote ID
   */
  generateQuoteId() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `CC${year}${month}-${random}`;
  }

  /**
   * Format helpers
   */
  formatPanelFinish(finish) {
    const formats = {
      'stainless-steel': 'Stainless Steel',
      'painted-white': 'Painted White',
      'galvanized': 'Galvanized'
    };
    return formats[finish] || finish;
  }

  formatFloorType(type) {
    const formats = {
      'none': 'No Floor',
      'standard': 'Standard Insulated Floor',
      'heavy-duty': 'Heavy-Duty Insulated Floor'
    };
    return formats[type] || type;
  }

  formatDoorStyle(style) {
    const formats = {
      'standard': 'Standard Swing Door',
      'glass': 'Glass Swing Door',
      'sliding': 'Sliding Door'
    };
    return formats[style] || style;
  }

  /**
   * Update branding
   */
  setBranding(branding) {
    Object.assign(this.branding, branding);
  }
}
