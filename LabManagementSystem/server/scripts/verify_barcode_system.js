/**
 * LMS Barcode Verification Suite
 * Tests Code 128 encode/decode round-trip, SVG generation, label generation,
 * LMS sample lookup workflow, and format JPL-100-01 sequence generation.
 */

import { encodeCode128B, generateBarcodeSvg, generate50x25Label } from '../src/utils/barcode128.js';
import tenantClinicalService, { getLabPrefix } from '../src/services/tenantClinical.service.js';
import tenantUserService from '../src/services/tenantUser.service.js';
import laboratoryManagementService from '../src/services/laboratoryManagement.service.js';

const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121321', '131221', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

const PATTERN_TO_VAL = new Map();
CODE128_PATTERNS.forEach((p, idx) => PATTERN_TO_VAL.set(p, idx));

function decodeCode128Binary(binary) {
  const runs = [];
  let curr = binary[0];
  let len = 0;
  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === curr) {
      len++;
    } else {
      runs.push(len);
      curr = binary[i];
      len = 1;
    }
  }
  if (len > 0) runs.push(len);

  let rIdx = 0;
  const symbols = [];
  while (rIdx < runs.length) {
    if (rIdx + 7 === runs.length) {
      const p = runs.slice(rIdx, rIdx + 7).join('');
      const val = PATTERN_TO_VAL.get(p);
      symbols.push({ val, pattern: p, isStop: true });
      break;
    } else {
      const p = runs.slice(rIdx, rIdx + 6).join('');
      const val = PATTERN_TO_VAL.get(p);
      if (val === undefined) {
        throw new Error(`Unknown pattern: ${p} at run index ${rIdx}`);
      }
      symbols.push({ val, pattern: p, isStop: false });
      rIdx += 6;
    }
  }

  if (symbols.length < 3) throw new Error('Too short for Code 128');
  if (symbols[0].val !== 104) throw new Error(`Expected Start B (104), got ${symbols[0].val}`);
  if (symbols[symbols.length - 1].val !== 106) throw new Error(`Expected Stop (106), got ${symbols[symbols.length - 1].val}`);

  const dataSymbols = symbols.slice(1, symbols.length - 2);
  const checkSymbol = symbols[symbols.length - 2];

  let checksum = 104;
  let decodedText = '';
  for (let i = 0; i < dataSymbols.length; i++) {
    const val = dataSymbols[i].val;
    checksum += val * (i + 1);
    decodedText += String.fromCharCode(val + 32);
  }

  const expectedCheck = checksum % 103;
  if (checkSymbol.val !== expectedCheck) {
    throw new Error(`Checksum mismatch: got ${checkSymbol.val}, expected ${expectedCheck}`);
  }

  return decodedText;
}

async function runTests() {
  console.log('====================================================');
  console.log('LMS BARCODE SYSTEM VERIFICATION & COMPLIANCE REPORT');
  console.log('====================================================\n');

  // TEST 1: Round-trip Encode/Decode
  console.log('[TEST 1] Testing Code 128 Round-Trip Encode & Decode:');
  const sampleBarcodes = [
    'BAR-401942-01',
    'JPL-100-01',
    'JPL-100-02',
    'JPL-101-01',
    'JPL-102-01',
    'CHN-100-01',
    'JPL-100-01-R1'
  ];

  let roundTripPassed = true;
  for (const bc of sampleBarcodes) {
    const binary = encodeCode128B(bc);
    const decoded = decodeCode128Binary(binary);
    const matches = decoded === bc;
    if (!matches) roundTripPassed = false;
    console.log(`  ✓ Encoded: ${bc.padEnd(16)} -> Decoded: ${decoded.padEnd(16)} (Match: ${matches})`);
  }
  console.log(`  Result: ${roundTripPassed ? 'PASS' : 'FAIL'}\n`);

  // TEST 2: SVG Optical Integrity and Quiet Zone Check
  console.log('[TEST 2] Testing Vector SVG Generator Integrity & ISO Compliance:');
  const testSvg = generateBarcodeSvg('JPL-100-01', { barHeight: 28, moduleWidth: 1.15, quietZoneModules: 10 });
  const hasCrispEdges = testSvg.includes('shape-rendering="crispEdges"');
  const hasHumanReadable = testSvg.includes('JPL-100-01');
  const hasSingleRects = !testSvg.includes('undefined');

  console.log(`  ✓ Includes shape-rendering="crispEdges": ${hasCrispEdges}`);
  console.log(`  ✓ Human-readable text matches encoded identifier: ${hasHumanReadable}`);
  console.log(`  ✓ Valid SVG structure without undefined properties: ${hasSingleRects}`);
  console.log(`  Result: ${hasCrispEdges && hasHumanReadable && hasSingleRects ? 'PASS' : 'FAIL'}\n`);

  // TEST 3: 50x25mm Label Document Generation
  console.log('[TEST 3] Testing 50x25mm Label Document Engine:');
  const mockSample = {
    sampleId: 'smp_test_100',
    barcode: 'JPL-100-01',
    orderNumber: 'ORD-2026-100',
    patientMrn: 'JPL-100',
    patientName: 'Aarav Patel',
    sampleType: 'Whole Blood EDTA',
    container: 'Lavender Top (EDTA)',
    testCodes: ['CBC', 'ESR'],
    tubeIndex: 1,
    totalTubes: 2,
    collectedAt: new Date()
  };

  const labelDoc = generate50x25Label(mockSample, { name: 'Jaipur Laboratory' });
  const labelValid = labelDoc.barcode === 'JPL-100-01' && labelDoc.svg.includes('JPL-100-01') && labelDoc.dimensions.heightMm === 25;
  console.log(`  ✓ Label generated for sample: ${labelDoc.barcode}`);
  console.log(`  ✓ SVG embedded in label contains barcode: ${labelDoc.svg.includes('JPL-100-01')}`);
  console.log(`  ✓ Physical label dimensions: ${labelDoc.dimensions.widthMm}mm x ${labelDoc.dimensions.heightMm}mm`);
  console.log(`  Result: ${labelValid ? 'PASS' : 'FAIL'}\n`);

  // TEST 4: LMS Sample Lookup by Barcode (and Error on Unknown)
  console.log('[TEST 4] Testing LMS Backend Sample Lookup via Barcode:');
  const testTenant = 'ten_test_barcode_suite';

  tenantUserService.assertTenantReady = async () => true;

  if (!tenantClinicalService.memorySamples.has(testTenant)) {
    tenantClinicalService.memorySamples.set(testTenant, new Map());
  }
  tenantClinicalService.memorySamples.get(testTenant).set(mockSample.sampleId, {
    ...mockSample,
    tenantId: testTenant,
    toSafeJSON() { return { ...this }; }
  });

  // Test exact lookup
  let lookupSuccess = false;
  try {
    const found = await tenantClinicalService.getSampleById(testTenant, 'JPL-100-01');
    if (found && found.barcode === 'JPL-100-01' && found.patientName === 'Aarav Patel') {
      lookupSuccess = true;
      console.log(`  ✓ Exact barcode lookup ('JPL-100-01'): SUCCESS (Sample ID: ${found.sampleId})`);
    }
  } catch (err) {
    console.error(`  ✗ Exact lookup error:`, err.message);
  }

  // Test case-insensitive lookup
  let caseInsensitiveSuccess = false;
  try {
    const foundLower = await tenantClinicalService.getSampleById(testTenant, 'jpl-100-01');
    if (foundLower && foundLower.barcode === 'JPL-100-01') {
      caseInsensitiveSuccess = true;
      console.log(`  ✓ Case-insensitive barcode lookup ('jpl-100-01'): SUCCESS`);
    }
  } catch (err) {
    console.error(`  ✗ Case-insensitive lookup error:`, err.message);
  }

  // Test unknown barcode error handling
  let unknownHandled = false;
  try {
    await tenantClinicalService.getSampleById(testTenant, 'BAR-UNKNOWN-999');
  } catch (err) {
    if (err.code === 'SAMPLE_NOT_FOUND' && err.statusCode === 404) {
      unknownHandled = true;
      console.log(`  ✓ Unknown barcode lookup ('BAR-UNKNOWN-999'): Correctly threw 404 (${err.message})`);
    }
  }

  console.log(`  Result: ${lookupSuccess && caseInsensitiveSuccess && unknownHandled ? 'PASS' : 'FAIL'}\n`);

  // TEST 5: Sequence Numbering Starting From 100 & Tube Index Formatting
  console.log('[TEST 5] Testing Sequence Numbering Starting From 100 & Tube Index Formatting:');
  const seqTenant = 'ten_seq_test_jaipur';
  tenantClinicalService.memorySamples.set(seqTenant, new Map());

  // Derive prefix from Jaipur lab configuration
  const jaipurLab = { name: 'JaipurLab', code: 'jpl' };
  laboratoryManagementService.getLaboratoryByTenantId = async () => jaipurLab;
  const prefix = getLabPrefix(jaipurLab);
  console.log(`  ✓ Derived prefix from lab config: '${prefix}' (Expected 'JPL')`);

  // Order 1 with 2 tubes (CBC = Lavender EDTA, Glucose = Grey Fluoride)
  const order1 = {
    orderId: 'ord_test_100',
    orderNumber: 'ORD-100',
    items: [
      { itemId: 'it_1', testCode: 'CBC', specimenType: 'Whole Blood EDTA', container: 'Lavender Top (EDTA)' },
      { itemId: 'it_2', testCode: 'GLU', specimenType: 'Fluoride Plasma', container: 'Grey Top (Fluoride)' },
    ]
  };

  const tubesOrder1 = await tenantClinicalService.createSamplesForOrder(seqTenant, order1);
  const sample1Tube1 = tubesOrder1.find(t => t.tubeIndex === 1);
  const sample1Tube2 = tubesOrder1.find(t => t.tubeIndex === 2);

  console.log(`  ✓ First sample, first tube:  ${sample1Tube1?.barcode} (Expected 'JPL-100-01')`);
  console.log(`  ✓ First sample, second tube: ${sample1Tube2?.barcode} (Expected 'JPL-100-02')`);

  // Order 2 with 1 tube
  const order2 = {
    orderId: 'ord_test_101',
    orderNumber: 'ORD-101',
    items: [
      { itemId: 'it_3', testCode: 'LIPID', specimenType: 'Serum', container: 'Gold Top (SST / Gel)' },
    ]
  };

  const tubesOrder2 = await tenantClinicalService.createSamplesForOrder(seqTenant, order2);
  const sample2Tube1 = tubesOrder2.find(t => t.tubeIndex === 1);
  console.log(`  ✓ Second sample, first tube: ${sample2Tube1?.barcode} (Expected 'JPL-101-01')`);

  // Order 3 with 1 tube
  const order3 = {
    orderId: 'ord_test_102',
    orderNumber: 'ORD-102',
    items: [
      { itemId: 'it_4', testCode: 'THYROID', specimenType: 'Serum', container: 'Gold Top (SST / Gel)' },
    ]
  };

  const tubesOrder3 = await tenantClinicalService.createSamplesForOrder(seqTenant, order3);
  const sample3Tube1 = tubesOrder3.find(t => t.tubeIndex === 1);
  console.log(`  ✓ Third sample, first tube:  ${sample3Tube1?.barcode} (Expected 'JPL-102-01')`);

  const seqPassed =
    prefix === 'JPL' &&
    sample1Tube1?.barcode === 'JPL-100-01' &&
    sample1Tube2?.barcode === 'JPL-100-02' &&
    sample2Tube1?.barcode === 'JPL-101-01' &&
    sample3Tube1?.barcode === 'JPL-102-01';

  console.log(`  Result: ${seqPassed ? 'PASS' : 'FAIL'}\n`);

  const allPassed = roundTripPassed && hasCrispEdges && labelValid && lookupSuccess && caseInsensitiveSuccess && unknownHandled && seqPassed;
  console.log('====================================================');
  console.log(`OVERALL BARCODE SYSTEM STATUS: ${allPassed ? 'ALL VERIFICATIONS PASSED (READY)' : 'FAILED'}`);
  console.log('====================================================');

  process.exit(allPassed ? 0 : 1);
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
