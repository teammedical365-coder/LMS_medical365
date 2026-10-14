/**
 * Lab Management System (LMS) - Authoritative Clinical Result Classification Engine
 * 
 * ISO 15189 / CLSI EP28-A3c Compliant Reference Interval & Flag Evaluation
 * 
 * Features:
 * 1. Dual-mode reference range evaluation:
 *    - Structured numerical boundaries (lowNormal, highNormal, criticalLow, criticalHigh)
 *    - Normalized string parser for legacy/admin text ranges (e.g. "12.0 - 17.5", "< 200", ">= 40", "12 to 15")
 * 2. Strict clinical classification flags:
 *    - 'CRITICAL_LOW': Below life-threatening critical threshold
 *    - 'LOW': Below lower limit of reference interval
 *    - 'NORMAL': Within configured reference interval (inclusive of bounds)
 *    - 'HIGH': Above upper limit of reference interval
 *    - 'CRITICAL_HIGH': Above life-threatening critical threshold
 *    - 'ABNORMAL': Non-matching qualitative/categorical outcome
 *    - 'MISSING': Empty, null, or undefined input (never coerced to numeric 0)
 *    - 'UNCLASSIFIED': Ambiguous range or invalid input requiring manual review
 * 3. Zero-coercion preservation:
 *    - Genuine numeric 0 is evaluated accurately (e.g. Pus Cells 0 within 0-5 => NORMAL)
 *    - Blank / whitespace strings are flagged as MISSING, NEVER NORMAL or 0
 * 4. Custom Hospital Admin test agnostic:
 *    - Does not rely on hardcoded test-code switch statements
 *    - Reads directly from test parameter metadata and configured reference ranges
 */

export function isGenericReferenceRange(str) {
  if (!str || typeof str !== 'string') return true;
  const s = str.trim().toLowerCase();
  if (!s || s === '—' || s === '-' || s === 'null' || s === 'undefined') return true;
  return /^(normal(\s+reference)?(\s+range)?|standard(\s+clinical)?(\s+normal)?\s*(reference)?\s*(range|interval)?|standard\s+interval|standard)$/i.test(s);
}

/**
 * Parses a reference range string or structured object into standardized numeric bounds.
 * Handles formats:
 * - Hyphen / en-dash / em-dash ranges: "12.0 - 17.5", "135-145", "0.2 - 1.2 mg/dL"
 * - Word ranges: "12.0 to 17.5"
 * - One-sided thresholds: "< 200", "<= 200", "> 60", ">= 40", "<0.3"
 * - Qualitative expected values: "Negative", "Non-Reactive", "Nil", "Clear", "Pale Yellow"
 * - Structured objects: { lowNormal, highNormal, criticalLow, criticalHigh, textRange, referenceRanges }
 *
 * @param {Object|string} rangeInput - Reference range definition
 * @param {Object} [demographics={}] - Optional patient demographics { gender, ageDays }
 * @returns {Object} Normalized reference range metadata
 */
export function parseReferenceRange(rangeInput, demographics = {}) {
  const result = {
    lowNormal: null,
    highNormal: null,
    criticalLow: null,
    criticalHigh: null,
    isOneSided: false,
    operator: null, // '<', '<=', '>', '>='
    isInclusive: true,
    isQualitative: false,
    expectedValue: null,
    rawText: '',
    isParsed: false,
  };

  if (!rangeInput && rangeInput !== 0) {
    return result;
  }

  // Handle structured object
  if (typeof rangeInput === 'object') {
    // If it has referenceRanges array, select best matching demographic range
    if (Array.isArray(rangeInput.referenceRanges) && rangeInput.referenceRanges.length > 0) {
      const { gender, ageDays } = demographics;
      let matched = null;

      // 1. Try exact gender + age match
      if (gender || ageDays !== undefined) {
        matched = rangeInput.referenceRanges.find((r) => {
          const genderMatch = !gender || r.gender === 'BOTH' || String(r.gender).toUpperCase() === String(gender).toUpperCase();
          const ageMatch = ageDays === undefined || (
            (r.ageMinDays === undefined || ageDays >= r.ageMinDays) &&
            (r.ageMaxDays === undefined || ageDays <= r.ageMaxDays)
          );
          return genderMatch && ageMatch;
        });
      }

      // 2. Fallback to 'BOTH' gender
      if (!matched) {
        matched = rangeInput.referenceRanges.find((r) => r.gender === 'BOTH');
      }

      // 3. Fallback to first range
      if (!matched) {
        matched = rangeInput.referenceRanges[0];
      }

      if (matched) {
        if (matched.lowNormal !== null && matched.lowNormal !== undefined && matched.lowNormal !== '') {
          const val = Number(matched.lowNormal);
          if (!isNaN(val)) result.lowNormal = val;
        }
        if (matched.highNormal !== null && matched.highNormal !== undefined && matched.highNormal !== '') {
          const val = Number(matched.highNormal);
          if (!isNaN(val)) result.highNormal = val;
        }
        if (matched.criticalLow !== null && matched.criticalLow !== undefined && matched.criticalLow !== '') {
          const val = Number(matched.criticalLow);
          if (!isNaN(val)) result.criticalLow = val;
        }
        if (matched.criticalHigh !== null && matched.criticalHigh !== undefined && matched.criticalHigh !== '') {
          const val = Number(matched.criticalHigh);
          if (!isNaN(val)) result.criticalHigh = val;
        }
        if (matched.textRange && !isGenericReferenceRange(matched.textRange)) {
          result.rawText = String(matched.textRange).trim();
        }
      }
    }

    // Direct properties on object
    if (rangeInput.lowNormal !== undefined && rangeInput.lowNormal !== null && rangeInput.lowNormal !== '') {
      const val = Number(rangeInput.lowNormal);
      if (!isNaN(val)) result.lowNormal = val;
    }
    if (rangeInput.highNormal !== undefined && rangeInput.highNormal !== null && rangeInput.highNormal !== '') {
      const val = Number(rangeInput.highNormal);
      if (!isNaN(val)) result.highNormal = val;
    }
    if (rangeInput.criticalLow !== undefined && rangeInput.criticalLow !== null && rangeInput.criticalLow !== '') {
      const val = Number(rangeInput.criticalLow);
      if (!isNaN(val)) result.criticalLow = val;
    }
    if (rangeInput.criticalHigh !== undefined && rangeInput.criticalHigh !== null && rangeInput.criticalHigh !== '') {
      const val = Number(rangeInput.criticalHigh);
      if (!isNaN(val)) result.criticalHigh = val;
    }

    if (result.lowNormal !== null || result.highNormal !== null) {
      result.isParsed = true;
      let numericText = '';
      if (result.lowNormal !== null && result.highNormal !== null) {
        numericText = `${result.lowNormal} - ${result.highNormal}`;
      } else if (result.highNormal !== null) {
        numericText = `< ${result.highNormal}`;
      } else if (result.lowNormal !== null) {
        numericText = `> ${result.lowNormal}`;
      }

      if (!result.rawText || isGenericReferenceRange(result.rawText)) {
        result.rawText = numericText;
      }
      return result;
    }

    if (!result.rawText) {
      const candidate = rangeInput.referenceRange || rangeInput.textRange || rangeInput.notes || '';
      if (!isGenericReferenceRange(candidate)) {
        result.rawText = candidate;
      }
    }
  }

  // String parsing
  let str = typeof rangeInput === 'string'
    ? rangeInput.trim()
    : (result.rawText ? String(result.rawText).trim() : '');

  if (isGenericReferenceRange(str)) {
    str = '';
  }
  result.rawText = str;
  if (!str) return result;

  // Check known qualitative expected outcomes
  const QUALITATIVE_EXPECTED_PATTERNS = [
    'NEGATIVE',
    'NON-REACTIVE',
    'NON REACTIVE',
    'NOT DETECTED',
    'NIL',
    'CLEAR',
    'PALE YELLOW',
    'NORMAL',
    'ABSENT',
    'NO GROWTH'
  ];

  const upperStr = str.toUpperCase();
  for (const q of QUALITATIVE_EXPECTED_PATTERNS) {
    if (upperStr === q || upperStr.startsWith(`${q} `) || upperStr.startsWith(`${q},`)) {
      result.isQualitative = true;
      result.expectedValue = q;
      result.isParsed = true;
      return result;
    }
  }

  // Check one-sided less-than thresholds: e.g. "< 200", "<= 200", "<0.3", "< 5.7%"
  const lessThanMatch = str.match(/^(?:<|<=|≤)\s*([0-9]+(?:\.[0-9]+)?)/);
  if (lessThanMatch) {
    const val = parseFloat(lessThanMatch[1]);
    if (!isNaN(val)) {
      result.highNormal = val;
      result.isOneSided = true;
      result.operator = str.startsWith('<=') || str.startsWith('≤') ? '<=' : '<';
      result.isInclusive = result.operator === '<=';
      result.isParsed = true;
      return result;
    }
  }

  // Check one-sided greater-than thresholds: e.g. "> 60", ">= 40", ">50", "≥ 30"
  const greaterThanMatch = str.match(/^(?:>|>=|≥)\s*([0-9]+(?:\.[0-9]+)?)/);
  if (greaterThanMatch) {
    const val = parseFloat(greaterThanMatch[1]);
    if (!isNaN(val)) {
      result.lowNormal = val;
      result.isOneSided = true;
      result.operator = str.startsWith('>=') || str.startsWith('≥') ? '>=' : '>';
      result.isInclusive = result.operator === '>=';
      result.isParsed = true;
      return result;
    }
  }

  // Check two-sided numeric ranges: "12.0 - 17.5", "12.0-17.5", "12 to 15", "135 – 145", "0.2 - 1.2 mg/dL"
  const rangeMatch = str.match(/^([0-9]+(?:\.[0-9]+)?)\s*(?:-|–|—|to)\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    if (!isNaN(low) && !isNaN(high)) {
      result.lowNormal = low;
      result.highNormal = high;
      result.isInclusive = true;
      result.isParsed = true;
      return result;
    }
  }

  // Single number formatted range: e.g. "12.5"
  const singleNumMatch = str.match(/^([0-9]+(?:\.[0-9]+)?)$/);
  if (singleNumMatch) {
    const val = parseFloat(singleNumMatch[1]);
    if (!isNaN(val)) {
      result.lowNormal = val;
      result.highNormal = val;
      result.isInclusive = true;
      result.isParsed = true;
      return result;
    }
  }

  return result;
}

/**
 * Classifies an observed test/parameter result against its configured reference range.
 * 
 * Clinical Flag Output:
 * - 'CRITICAL_LOW': Result below critical low threshold
 * - 'LOW': Result below lower normal bound
 * - 'NORMAL': Result within normal biological reference interval
 * - 'HIGH': Result above upper normal bound
 * - 'CRITICAL_HIGH': Result above critical high threshold
 * - 'ABNORMAL': Qualitative result differs from configured normal expectation
 * - 'MISSING': Value is empty, null, or undefined
 * - 'UNCLASSIFIED': Input cannot be parsed or lacks reference criteria
 *
 * @param {*} value - The entered result value
 * @param {Object} [paramDef={}] - Parameter definition or test object with reference range metadata
 * @param {Object} [demographics={}] - Optional patient demographics { gender, ageDays }
 * @returns {Object} Comprehensive classification outcome
 */
export function classifyResult(value, paramDef = {}, demographics = {}) {
  const resultType = String(paramDef?.resultType || 'NUMERIC').toUpperCase();
  const unit = String(paramDef?.unit || '').trim();
  const parsedRange = parseReferenceRange(paramDef, demographics);
  const rawCandidate = parsedRange.rawText || paramDef?.referenceRange || paramDef?.textRange || '';
  const refDisplay = !isGenericReferenceRange(rawCandidate) ? rawCandidate : '—';

  // 1. Strict Blank / Missing Check
  // Zero (0, "0") is a VALID numeric result! Blank (" ", null, undefined) is MISSING.
  const isBlank = value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
  if (isBlank) {
    return {
      isAbnormal: false,
      isCritical: false,
      flag: 'MISSING',
      flagLabel: 'Missing',
      displayFlag: '—',
      status: 'missing',
      referenceRangeDisplay: refDisplay,
      unit,
      lowNormal: null,
      highNormal: null,
      criticalLow: null,
      criticalHigh: null,
      evaluatedValue: null,
      isMissing: true,
      message: 'Parameter result has not been entered',
    };
  }

  // Determine parameter nature (qualitative if explicitly defined or if reference range is qualitative text)
  const isQualitative = resultType === 'QUALITATIVE' || resultType === 'TEXT' || resultType === 'OPTIONS' || parsedRange.isQualitative;

  // 3. Evaluation for NUMERIC parameters
  if (!isQualitative) {
    const numVal = typeof value === 'number' ? value : Number(String(value).trim());
    if (isNaN(numVal)) {
      return {
        isAbnormal: false,
        isCritical: false,
        flag: 'UNCLASSIFIED',
        flagLabel: 'Invalid Number',
        displayFlag: 'INVALID',
        status: 'unclassified',
        referenceRangeDisplay: refDisplay,
        unit,
        lowNormal: parsedRange.lowNormal,
        highNormal: parsedRange.highNormal,
        criticalLow: parsedRange.criticalLow,
        criticalHigh: parsedRange.criticalHigh,
        evaluatedValue: value,
        isMissing: false,
        message: `Value '${value}' is not a valid number`,
      };
    }

    // Check Critical Thresholds First
    if (parsedRange.criticalLow !== null && numVal < parsedRange.criticalLow) {
      return {
        isAbnormal: true,
        isCritical: true,
        flag: 'CRITICAL_LOW',
        flagLabel: 'Critical Low',
        displayFlag: 'CRIT LOW',
        status: 'critical',
        referenceRangeDisplay: refDisplay,
        unit,
        lowNormal: parsedRange.lowNormal,
        highNormal: parsedRange.highNormal,
        criticalLow: parsedRange.criticalLow,
        criticalHigh: parsedRange.criticalHigh,
        evaluatedValue: numVal,
        isMissing: false,
        message: `Result ${numVal} is below critical low threshold (${parsedRange.criticalLow})`,
      };
    }

    if (parsedRange.criticalHigh !== null && numVal > parsedRange.criticalHigh) {
      return {
        isAbnormal: true,
        isCritical: true,
        flag: 'CRITICAL_HIGH',
        flagLabel: 'Critical High',
        displayFlag: 'CRIT HIGH',
        status: 'critical',
        referenceRangeDisplay: refDisplay,
        unit,
        lowNormal: parsedRange.lowNormal,
        highNormal: parsedRange.highNormal,
        criticalLow: parsedRange.criticalLow,
        criticalHigh: parsedRange.criticalHigh,
        evaluatedValue: numVal,
        isMissing: false,
        message: `Result ${numVal} is above critical high threshold (${parsedRange.criticalHigh})`,
      };
    }

    // Evaluate One-Sided Bounds
    if (parsedRange.isOneSided) {
      if (parsedRange.operator === '<') {
        const isHigh = numVal >= parsedRange.highNormal;
        return {
          isAbnormal: isHigh,
          isCritical: false,
          flag: isHigh ? 'HIGH' : 'NORMAL',
          flagLabel: isHigh ? 'High' : 'Normal',
          displayFlag: isHigh ? 'HIGH' : 'NORMAL',
          status: isHigh ? 'abnormal' : 'normal',
          referenceRangeDisplay: refDisplay,
          unit,
          lowNormal: null,
          highNormal: parsedRange.highNormal,
          criticalLow: null,
          criticalHigh: null,
          evaluatedValue: numVal,
          isMissing: false,
          message: null,
        };
      }
      if (parsedRange.operator === '<=') {
        const isHigh = numVal > parsedRange.highNormal;
        return {
          isAbnormal: isHigh,
          isCritical: false,
          flag: isHigh ? 'HIGH' : 'NORMAL',
          flagLabel: isHigh ? 'High' : 'Normal',
          displayFlag: isHigh ? 'HIGH' : 'NORMAL',
          status: isHigh ? 'abnormal' : 'normal',
          referenceRangeDisplay: refDisplay,
          unit,
          lowNormal: null,
          highNormal: parsedRange.highNormal,
          criticalLow: null,
          criticalHigh: null,
          evaluatedValue: numVal,
          isMissing: false,
          message: null,
        };
      }
      if (parsedRange.operator === '>') {
        const isLow = numVal <= parsedRange.lowNormal;
        return {
          isAbnormal: isLow,
          isCritical: false,
          flag: isLow ? 'LOW' : 'NORMAL',
          flagLabel: isLow ? 'Low' : 'Normal',
          displayFlag: isLow ? 'LOW' : 'NORMAL',
          status: isLow ? 'abnormal' : 'normal',
          referenceRangeDisplay: refDisplay,
          unit,
          lowNormal: parsedRange.lowNormal,
          highNormal: null,
          criticalLow: null,
          criticalHigh: null,
          evaluatedValue: numVal,
          isMissing: false,
          message: null,
        };
      }
      if (parsedRange.operator === '>=') {
        const isLow = numVal < parsedRange.lowNormal;
        return {
          isAbnormal: isLow,
          isCritical: false,
          flag: isLow ? 'LOW' : 'NORMAL',
          flagLabel: isLow ? 'Low' : 'Normal',
          displayFlag: isLow ? 'LOW' : 'NORMAL',
          status: isLow ? 'abnormal' : 'normal',
          referenceRangeDisplay: refDisplay,
          unit,
          lowNormal: parsedRange.lowNormal,
          highNormal: null,
          criticalLow: null,
          criticalHigh: null,
          evaluatedValue: numVal,
          isMissing: false,
          message: null,
        };
      }
    }

    // Evaluate Standard Two-Sided Normal Bounds
    const hasLow = parsedRange.lowNormal !== null;
    const hasHigh = parsedRange.highNormal !== null;

    if (hasLow && hasHigh) {
      if (numVal < parsedRange.lowNormal) {
        return {
          isAbnormal: true,
          isCritical: false,
          flag: 'LOW',
          flagLabel: 'Low',
          displayFlag: 'LOW',
          status: 'abnormal',
          referenceRangeDisplay: refDisplay,
          unit,
          lowNormal: parsedRange.lowNormal,
          highNormal: parsedRange.highNormal,
          criticalLow: parsedRange.criticalLow,
          criticalHigh: parsedRange.criticalHigh,
          evaluatedValue: numVal,
          isMissing: false,
          message: `Result ${numVal} is below lower reference limit (${parsedRange.lowNormal})`,
        };
      }
      if (numVal > parsedRange.highNormal) {
        return {
          isAbnormal: true,
          isCritical: false,
          flag: 'HIGH',
          flagLabel: 'High',
          displayFlag: 'HIGH',
          status: 'abnormal',
          referenceRangeDisplay: refDisplay,
          unit,
          lowNormal: parsedRange.lowNormal,
          highNormal: parsedRange.highNormal,
          criticalLow: parsedRange.criticalLow,
          criticalHigh: parsedRange.criticalHigh,
          evaluatedValue: numVal,
          isMissing: false,
          message: `Result ${numVal} is above upper reference limit (${parsedRange.highNormal})`,
        };
      }
      return {
        isAbnormal: false,
        isCritical: false,
        flag: 'NORMAL',
        flagLabel: 'Normal',
        displayFlag: 'NORMAL',
        status: 'normal',
        referenceRangeDisplay: refDisplay,
        unit,
        lowNormal: parsedRange.lowNormal,
        highNormal: parsedRange.highNormal,
        criticalLow: parsedRange.criticalLow,
        criticalHigh: parsedRange.criticalHigh,
        evaluatedValue: numVal,
        isMissing: false,
        message: null,
      };
    }

    if (hasLow && !hasHigh) {
      const isLow = numVal < parsedRange.lowNormal;
      return {
        isAbnormal: isLow,
        isCritical: false,
        flag: isLow ? 'LOW' : 'NORMAL',
        flagLabel: isLow ? 'Low' : 'Normal',
        displayFlag: isLow ? 'LOW' : 'NORMAL',
        status: isLow ? 'abnormal' : 'normal',
        referenceRangeDisplay: refDisplay,
        unit,
        lowNormal: parsedRange.lowNormal,
        highNormal: null,
        criticalLow: null,
        criticalHigh: null,
        evaluatedValue: numVal,
        isMissing: false,
        message: isLow ? `Result ${numVal} is below configured minimum (${parsedRange.lowNormal})` : null,
      };
    }

    if (!hasLow && hasHigh) {
      const isHigh = numVal > parsedRange.highNormal;
      return {
        isAbnormal: isHigh,
        isCritical: false,
        flag: isHigh ? 'HIGH' : 'NORMAL',
        flagLabel: isHigh ? 'High' : 'Normal',
        displayFlag: isHigh ? 'HIGH' : 'NORMAL',
        status: isHigh ? 'abnormal' : 'normal',
        referenceRangeDisplay: refDisplay,
        unit,
        lowNormal: null,
        highNormal: parsedRange.highNormal,
        criticalLow: null,
        criticalHigh: null,
        evaluatedValue: numVal,
        isMissing: false,
        message: isHigh ? `Result ${numVal} is above configured maximum (${parsedRange.highNormal})` : null,
      };
    }

    // No valid numeric range could be extracted
    return {
      isAbnormal: false,
      isCritical: false,
      flag: 'UNCLASSIFIED',
      flagLabel: 'Review Required',
      displayFlag: 'REVIEW',
      status: 'unclassified',
      referenceRangeDisplay: refDisplay,
      unit,
      lowNormal: null,
      highNormal: null,
      criticalLow: null,
      criticalHigh: null,
      evaluatedValue: numVal,
      isMissing: false,
      message: 'No quantitative reference bounds configured for parameter',
    };
  }

  // 4. Evaluation for QUALITATIVE / TEXT / OPTIONS parameters
  const strVal = String(value).trim();
  const valUpper = strVal.toUpperCase();

  // If a qualitative expectation was parsed
  if (parsedRange.isQualitative && parsedRange.expectedValue) {
    const cleanVal = valUpper.replace(/[\s\-_]+/g, '');
    const cleanExpected = String(parsedRange.expectedValue).replace(/[\s\-_]+/g, '');
    const isMatch = valUpper === parsedRange.expectedValue || cleanVal === cleanExpected;
    return {
      isAbnormal: !isMatch,
      isCritical: false,
      flag: isMatch ? 'NORMAL' : 'ABNORMAL',
      flagLabel: isMatch ? 'Normal' : 'Abnormal',
      displayFlag: isMatch ? 'NORMAL' : 'ABNORMAL',
      status: isMatch ? 'normal' : 'abnormal',
      referenceRangeDisplay: refDisplay,
      unit,
      lowNormal: null,
      highNormal: null,
      criticalLow: null,
      criticalHigh: null,
      evaluatedValue: strVal,
      isMissing: false,
      message: isMatch ? null : `Observed '${strVal}' differs from expected '${parsedRange.expectedValue}'`,
    };
  }

  // If options are configured with an expected first option or explicit normalRange
  const expectedText = (paramDef?.referenceRange || paramDef?.textRange || '').trim();
  if (expectedText && expectedText.toLowerCase() !== 'standard' && expectedText.toLowerCase() !== 'normal') {
    const isMatch = valUpper === expectedText.toUpperCase();
    return {
      isAbnormal: !isMatch,
      isCritical: false,
      flag: isMatch ? 'NORMAL' : 'ABNORMAL',
      flagLabel: isMatch ? 'Normal' : 'Abnormal',
      displayFlag: isMatch ? 'NORMAL' : 'ABNORMAL',
      status: isMatch ? 'normal' : 'abnormal',
      referenceRangeDisplay: expectedText,
      unit,
      lowNormal: null,
      highNormal: null,
      criticalLow: null,
      criticalHigh: null,
      evaluatedValue: strVal,
      isMissing: false,
      message: isMatch ? null : `Observed outcome '${strVal}' does not match expected '${expectedText}'`,
    };
  }

  // Generic text with no specific normal expectation cannot be automatically marked Normal
  return {
    isAbnormal: false,
    isCritical: false,
    flag: 'UNCLASSIFIED',
    flagLabel: 'Recorded',
    displayFlag: 'RECORDED',
    status: 'unclassified',
    referenceRangeDisplay: refDisplay,
    unit,
    lowNormal: null,
    highNormal: null,
    criticalLow: null,
    criticalHigh: null,
    evaluatedValue: strVal,
    isMissing: false,
    message: 'Qualitative finding recorded without automated normal criteria',
  };
}

export default {
  parseReferenceRange,
  classifyResult,
};
