import JsBarcode from 'jsbarcode';

/**
 * Utility function to render a Code128 barcode directly into an SVG string.
 */
export const renderBarcodeSvgString = (text: string, height: number = 60): string => {
  try {
    const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svgNode, text, {
      format: 'CODE128',
      width: 2,
      height,
      displayValue: false,
      margin: 2,
      background: '#FFFFFF',
      lineColor: '#000000'
    });
    return svgNode.outerHTML;
  } catch (err) {
    console.error('Failed to render barcode SVG string:', err);
    return `<div style="border: 1px dashed red; padding: 4px;">Barkod Çizilemedi (${text})</div>`;
  }
};

export interface PrintLabelData {
  labelType: 'PALLET' | 'BOX';
  barcodeString: string;
  barcodeSvgHtml: string;
  productName: string;
  productSku: string;
  lotNumber: string;
  quantityText: string;
  productionDate: string;
  expiryDate: string;
  customerName: string;
  orderNumber: string;
  isPartial?: boolean;
  isReprint?: boolean;
}

export interface PrintOptions {
  companyName?: string;
  copies?: number;
}

/**
 * Renders and prints standard 100x150 mm thermal labels via browser print window.
 */
export const printLabels = async (
  labels: PrintLabelData[],
  options: PrintOptions = {}
): Promise<boolean> => {
  const company = options.companyName || 'GÜNAY KİMYA SANAYİ VE TİCARET A.Ş.';

  // Build printable HTML document with @page size 100mm 150mm
  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) {
    alert('Yazdırma penceresi açılamadı. Lütfen tarayıcıda açılır pencerelere (pop-up) izin veriniz.');
    return false;
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Etiket Yazdır - ${labels.length} Adet (100x150mm)</title>
  <style>
    @page {
      size: 100mm 150mm;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #FFFFFF;
      color: #000000;
    }
    .label-page {
      width: 100mm;
      height: 150mm;
      padding: 6mm 6mm 6mm 6mm;
      page-break-after: always;
      display: flex;
      flex-col;
      flex-direction: column;
      justify-content: space-between;
      border: 1px dashed #CCC;
      position: relative;
      overflow: hidden;
    }
    @media print {
      .label-page {
        border: none;
      }
    }
    .header-bar {
      border-bottom: 2px solid #000;
      padding-bottom: 3mm;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .company-title {
      font-size: 11pt;
      font-weight: 900;
      letter-spacing: -0.5px;
      line-height: 1.1;
      text-transform: uppercase;
    }
    .company-sub {
      font-size: 7pt;
      color: #333;
      margin-top: 1mm;
      font-weight: 600;
    }
    .type-badge {
      display: inline-block;
      padding: 1.5mm 3.5mm;
      font-size: 9pt;
      font-weight: 900;
      background: #000;
      color: #FFF;
      border-radius: 2mm;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .reprint-badge {
      display: inline-block;
      padding: 1mm 2mm;
      font-size: 7pt;
      font-weight: 800;
      border: 1px solid #000;
      border-radius: 1mm;
      margin-top: 1mm;
    }
    .product-section {
      margin: 3mm 0;
      padding: 3mm;
      border: 1.5px solid #000;
      border-radius: 2mm;
      background: #FAFAFA;
    }
    .product-name {
      font-size: 13pt;
      font-weight: 900;
      line-height: 1.2;
      color: #000;
    }
    .product-sku {
      font-family: monospace;
      font-size: 10pt;
      font-weight: 800;
      color: #222;
      margin-top: 1mm;
    }
    .grid-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2mm;
      margin: 2mm 0;
    }
    .info-box {
      border: 1px solid #000;
      padding: 2mm;
      border-radius: 1.5mm;
    }
    .info-label {
      font-size: 6.5pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #444;
    }
    .info-val {
      font-size: 10pt;
      font-weight: 800;
      font-family: monospace;
      margin-top: 0.5mm;
    }
    .customer-box {
      border: 1px solid #000;
      padding: 2mm 3mm;
      border-radius: 1.5mm;
      margin: 2mm 0;
    }
    .barcode-section {
      text-align: center;
      padding-top: 2mm;
      border-top: 2px solid #000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .barcode-svg-container svg {
      max-width: 88mm;
      height: 28mm !important;
      display: block;
      margin: 0 auto;
    }
    .human-readable {
      font-family: monospace;
      font-size: 10pt;
      font-weight: 900;
      letter-spacing: 1.5px;
      margin-top: 1.5mm;
    }
    .footer-note {
      font-size: 6.5pt;
      color: #555;
      text-align: center;
      margin-top: 1mm;
    }
  </style>
</head>
<body>
  ${labels
    .map(
      (l) => `
    <div class="label-page">
      <div>
        <div class="header-bar">
          <div>
            <div class="company-title">${company}</div>
            <div class="company-sub">Endüstriyel Kimya & Hijyen Ürünleri • İSO 9001 / GMP</div>
          </div>
          <div style="text-align: right;">
            <div class="type-badge">${l.labelType === 'PALLET' ? 'PALET ETİKETİ' : 'KOLİ ETİKETİ'}</div>
            ${l.isReprint ? '<div class="reprint-badge">YENİDEN BASKI</div>' : ''}
            ${l.isPartial ? '<div class="reprint-badge" style="background:#FFF; color:#000;">KISMİ BİRİM</div>' : ''}
          </div>
        </div>

        <div class="product-section">
          <div class="product-name">${l.productName}</div>
          <div class="product-sku">SKU: ${l.productSku}</div>
        </div>

        <div class="grid-info">
          <div class="info-box">
            <div class="info-label">Parti / Lot Numarası</div>
            <div class="info-val">${l.lotNumber}</div>
          </div>
          <div class="info-box">
            <div class="info-label">Paket Miktarı</div>
            <div class="info-val">${l.quantityText}</div>
          </div>
        </div>

        <div class="grid-info">
          <div class="info-box">
            <div class="info-label">Üretim Tarihi</div>
            <div class="info-val">${l.productionDate}</div>
          </div>
          <div class="info-box">
            <div class="info-label">Son Kullanma (SKT)</div>
            <div class="info-val">${l.expiryDate}</div>
          </div>
        </div>

        <div class="customer-box">
          <div class="info-label">Sevkiyat / Alıcı Cari:</div>
          <div style="font-size: 9pt; font-weight: 800; color: #000; margin-top: 0.5mm; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
            ${l.customerName}
          </div>
          <div style="font-size: 7pt; color: #555; font-family: monospace; margin-top: 0.5mm;">
            Emir No: ${l.orderNumber}
          </div>
        </div>
      </div>

      <div class="barcode-section">
        <div class="barcode-svg-container">
          ${l.barcodeSvgHtml}
        </div>
        <div class="human-readable">${l.barcodeString}</div>
        <div class="footer-note">GS1-128 / SSCC Standardı • Doğrulama ve Sevkiyat için Barkodu Okutunuz</div>
      </div>
    </div>
  `
    )
    .join('')}

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 350);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  return true;
};
