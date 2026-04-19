const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export const getPrintBaseStyles = (extraStyles = '') => `
  body {
    font-family: Arial, sans-serif;
    padding: 28px;
    color: #111827;
    background: #ffffff;
  }

  h1, h2, h3, p {
    margin: 0;
  }

  .print-page {
    max-width: 980px;
    margin: 0 auto;
  }

  .print-header {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
    margin-bottom: 28px;
    padding-bottom: 22px;
    border-bottom: 1px solid #e5e7eb;
  }

  .print-brand {
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
  }

  .print-brand-copy {
    min-width: 0;
  }

  .print-logo {
    width: 72px;
    height: 72px;
    object-fit: contain;
    border-radius: 18px;
    border: 1px solid #dbe4f0;
    background: #ffffff;
    box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
    padding: 8px;
  }

  .print-logo-fallback {
    width: 72px;
    height: 72px;
    border-radius: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #312e81, #4f46e5);
    color: #ffffff;
    font-size: 28px;
    font-weight: 700;
    box-shadow: 0 14px 28px rgba(79, 70, 229, 0.22);
  }

  .print-kicker {
    display: block;
    margin-bottom: 6px;
    color: #4f46e5;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .print-title {
    font-size: 28px;
    line-height: 1.1;
    color: #111827;
  }

  .print-subtitle {
    margin-top: 8px;
    max-width: 620px;
    color: #4b5563;
    line-height: 1.55;
  }

  .print-meta {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 14px;
    line-height: 1.65;
    color: #374151;
    text-align: right;
  }

  .print-meta strong {
    color: #111827;
  }

  .print-footer {
    margin-top: 24px;
    color: #6b7280;
    font-size: 12px;
    text-align: center;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th {
    text-align: left;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #6b7280;
  }

  @media print {
    body {
      padding: 20px;
    }

    .print-page {
      max-width: none;
    }
  }

  ${extraStyles}
`;

export const getPrintBrandMarkup = ({
  businessName = 'Business',
  businessLogoUrl = '',
  documentTitle = '',
  subtitle = '',
  metaRows = []
}) => {
  const safeBusinessName = escapeHtml(businessName);
  const safeDocumentTitle = escapeHtml(documentTitle);
  const safeSubtitle = escapeHtml(subtitle);
  const initial = escapeHtml((businessName || 'B').trim().charAt(0).toUpperCase() || 'B');
  const logoMarkup = businessLogoUrl
    ? `<img class="print-logo" src="${businessLogoUrl}" alt="${safeBusinessName}" />`
    : `<div class="print-logo-fallback">${initial}</div>`;

  const metaMarkup = metaRows.length
    ? `<div class="print-meta">${metaRows.map((row) => `<div>${row}</div>`).join('')}</div>`
    : '';

  return `
    <div class="print-header">
      <div class="print-brand">
        ${logoMarkup}
        <div class="print-brand-copy">
          <span class="print-kicker">${safeBusinessName}</span>
          <h1 class="print-title">${safeDocumentTitle}</h1>
          ${subtitle ? `<p class="print-subtitle">${safeSubtitle}</p>` : ''}
        </div>
      </div>
      ${metaMarkup}
    </div>
  `;
};
