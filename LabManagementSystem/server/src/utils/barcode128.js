/**
 * Lab Management System (LMS) - Code 128 Barcode & 50x25mm Label Engine
 * 
 * Standards-compliant Code 128 (Subset B) barcode generation and 50x25mm label rendering.
 * Zero external dependencies. Vector SVG output for pixel-perfect thermal barcode printing.
 */

const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121321', '131221', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // 100-106 (104=StartB, 106=Stop)
];

const START_B = 104;
const STOP = 106;

/**
 * Generate Code 128 subset B binary string (1s for black bars, 0s for white spaces)
 */
export function encodeCode128B(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Barcode text must be a non-empty string');
  }

  const values = [];
  let checksum = START_B;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 32 || code > 126) {
      throw new Error(`Character '${text[i]}' (ASCII ${code}) is not supported in Code 128 Subset B`);
    }
    const val = code - 32;
    values.push(val);
    checksum += val * (i + 1);
  }

  const checkDigit = checksum % 103;
  const patternIndices = [START_B, ...values, checkDigit, STOP];

  let binary = '';
  for (const idx of patternIndices) {
    const pattern = CODE128_PATTERNS[idx];
    for (let p = 0; p < pattern.length; p++) {
      const width = parseInt(pattern[p], 10);
      const isBar = p % 2 === 0;
      binary += (isBar ? '1' : '0').repeat(width);
    }
  }

  return binary;
}

/**
 * Generate clean vector SVG for a Code 128 barcode
 * Uses run-length consolidation and crispEdges for flawless optical scanner readability.
 */
export function generateBarcodeSvg(text, options = {}) {
  const cleanText = String(text || '').trim().toUpperCase();
  if (!cleanText) {
    throw new Error('Barcode text cannot be empty');
  }

  const {
    barHeight = 40,
    moduleWidth = 1.2,
    quietZoneModules = 10,
    showText = true,
  } = options;

  const binary = encodeCode128B(cleanText);
  const totalModules = binary.length + quietZoneModules * 2;
  const svgWidth = totalModules * moduleWidth;
  const textHeight = showText ? 14 : 0;
  const svgHeight = barHeight + textHeight;

  let rects = '';
  let currentX = quietZoneModules * moduleWidth;
  let barRun = 0;

  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === '1') {
      barRun++;
    } else {
      if (barRun > 0) {
        const barWidth = barRun * moduleWidth;
        const barX = currentX - barWidth;
        rects += `<rect x="${barX.toFixed(2)}" y="0" width="${barWidth.toFixed(2)}" height="${barHeight}" fill="#000000" />`;
        barRun = 0;
      }
    }
    currentX += moduleWidth;
  }
  if (barRun > 0) {
    const barWidth = barRun * moduleWidth;
    const barX = currentX - barWidth;
    rects += `<rect x="${barX.toFixed(2)}" y="0" width="${barWidth.toFixed(2)}" height="${barHeight}" fill="#000000" />`;
  }

  let textElement = '';
  if (showText) {
    textElement = `<text x="${(svgWidth / 2).toFixed(2)}" y="${(barHeight + 11).toFixed(2)}" text-anchor="middle" font-family="monospace" font-size="9" font-weight="700" fill="#000000" letter-spacing="0.5">${cleanText}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth.toFixed(2)} ${svgHeight.toFixed(2)}" width="100%" height="${svgHeight.toFixed(2)}" preserveAspectRatio="none" shape-rendering="crispEdges" style="background:#ffffff;display:block;width:100%;height:100%;">${rects}${textElement}</svg>`;
}

/**
 * Standard Clinical Specimen Container Derivation
 * Resolves standard clinical tube/container from specimenType when not explicitly set
 */
export function resolveSpecimenContainer(specimenType, explicitContainer) {
  if (explicitContainer && typeof explicitContainer === 'string' && explicitContainer.trim() && explicitContainer.trim() !== 'Standard Tube') {
    return explicitContainer.trim();
  }
  const spec = (specimenType || '').toLowerCase();
  if (spec.includes('edta') || spec.includes('lavender') || spec.includes('whole blood') || spec.includes('hematology')) {
    return 'Lavender Top (EDTA)';
  }
  if (spec.includes('citrate') || spec.includes('blue') || spec.includes('coagulation') || spec.includes('plasma (sodium citrate)')) {
    return 'Light Blue Top (Citrate)';
  }
  if (spec.includes('serum') || spec.includes('sst') || spec.includes('gold') || spec.includes('gel')) {
    return 'Gold Top (SST / Gel)';
  }
  if (spec.includes('clot') || spec.includes('red')) {
    return 'Red Top (Serum Clot)';
  }
  if (spec.includes('heparin') || spec.includes('green')) {
    return 'Green Top (Heparin)';
  }
  if (spec.includes('fluoride') || spec.includes('grey') || spec.includes('glucose')) {
    return 'Grey Top (Fluoride)';
  }
  if (spec.includes('urine')) {
    return 'Sterile Urine Cup';
  }
  if (spec.includes('stool')) {
    return 'Sterile Stool Container';
  }
  if (spec.includes('swab') || spec.includes('viral') || spec.includes('culture')) {
    return 'Sterile Transport Swab';
  }
  return 'Standard Tube';
}

/**
 * Generate full 50x25mm Label Document (HTML / SVG)
 */
export function generate50x25Label(sample, tenantBranding = {}) {
  const canonicalBarcode = String(sample.barcode || sample.sampleId || '').trim().toUpperCase();
  const barcodeSvg = generateBarcodeSvg(canonicalBarcode, {
    barHeight: 28,
    moduleWidth: 1.15,
    quietZoneModules: 0, // Zero margin so barcode bars start where patient name starts on left and end where MRN ends on right
    showText: true,
  });

  const labName = tenantBranding.name || 'LAB MANAGEMENT SYSTEM';
  const patientMrn = sample.patientMrn || 'MRN-PENDING';
  const patientInitialsOrName = sample.patientName ? sample.patientName.slice(0, 22) : 'Patient';
  const tubeTag = sample.totalTubes > 1 ? `Tube ${sample.tubeIndex}/${sample.totalTubes}` : 'Tube 1/1';
  const testsSummary = (sample.testNames && sample.testNames.length > 0)
    ? sample.testNames.join(', ')
    : (sample.testCodes && sample.testCodes.length > 0)
      ? sample.testCodes.join(', ')
      : (sample.sampleType || 'Specimen');
  const collectionDate = sample.collectedAt
    ? new Date(sample.collectedAt).toISOString().slice(0, 16).replace('T', ' ')
    : 'Pending Collection';

  return {
    dimensions: {
      widthMm: 60,
      heightMm: 25,
      standard: 'Code 128 (Subset B)',
    },
    barcode: sample.barcode,
    orderNumber: sample.orderNumber,
    patientMrn,
    patientName: patientInitialsOrName,
    tubeTag,
    testsSummary,
    container: sample.container || 'Standard Tube',
    sampleType: sample.sampleType || 'Specimen',
    collectionDate,
    labName,
    svg: barcodeSvg,
  };
}

export default {
  encodeCode128B,
  generateBarcodeSvg,
  resolveSpecimenContainer,
  generate50x25Label,
};
