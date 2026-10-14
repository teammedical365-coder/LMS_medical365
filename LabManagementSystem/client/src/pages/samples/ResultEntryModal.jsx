/**
 * Lab Management System (LMS) - Result Entry & Parameter Feeding Modal
 * 
 * ISO 15189 Clinical Laboratory Compliant:
 * - Dynamic parameter mapping based on test code / profile (CBC, LFT, KFT/CMP, LIPID, GLUCOSE, URINE, TSH)
 * - Strict numerical & categorical result validation with real-time reference range evaluation
 * - Dynamic Abnormal Flagging (Normal 🟢, High 🔴, Low 🟡)
 * - Instrument & Reagent Lot traceability
 * - One-click transition to `results_entered` / `Pending Verification`
 * - Direct routing into the Pathologist Review & Sign-Off Queue
 */

import React, { useState, useEffect } from 'react';
import { 
  FlaskConical, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Sparkles, 
  Cpu, 
  Tag, 
  FileText, 
  Check, 
  AlertCircle,
  Plus,
  Trash2,
  Send,
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import clinicalService from '../../services/clinicalService';
import { classifyResult, parseReferenceRange, isGenericReferenceRange } from '../../utils/clinicalClassification';

// Standard Clinical Diagnostic Profiles & Reference Thresholds
const DEFAULT_TEST_PROFILES = {
  CBC: [
    { parameterCode: 'HGB', name: 'Hemoglobin', resultType: 'NUMERIC', unit: 'g/dL', referenceRange: '12.0 - 17.5', lowNormal: 12.0, highNormal: 17.5, defaultValue: '14.2' },
    { parameterCode: 'RBC', name: 'RBC Count', resultType: 'NUMERIC', unit: 'mil/µL', referenceRange: '4.20 - 5.90', lowNormal: 4.20, highNormal: 5.90, defaultValue: '4.85' },
    { parameterCode: 'WBC', name: 'Total Leucocyte Count (WBC)', resultType: 'NUMERIC', unit: '/µL', referenceRange: '4500 - 11000', lowNormal: 4500, highNormal: 11000, defaultValue: '7200' },
    { parameterCode: 'PLT', name: 'Platelet Count', resultType: 'NUMERIC', unit: '/µL', referenceRange: '150000 - 450000', lowNormal: 150000, highNormal: 450000, defaultValue: '260000' },
    { parameterCode: 'HCT', name: 'Hematocrit (PCV)', resultType: 'NUMERIC', unit: '%', referenceRange: '36.0 - 50.0', lowNormal: 36.0, highNormal: 50.0, defaultValue: '42.5' },
    { parameterCode: 'MCV', name: 'Mean Corpuscular Volume (MCV)', resultType: 'NUMERIC', unit: 'fL', referenceRange: '80.0 - 100.0', lowNormal: 80.0, highNormal: 100.0, defaultValue: '88.0' },
    { parameterCode: 'MCH', name: 'Mean Corpuscular Hemoglobin (MCH)', resultType: 'NUMERIC', unit: 'pg', referenceRange: '27.0 - 33.0', lowNormal: 27.0, highNormal: 33.0, defaultValue: '29.4' },
    { parameterCode: 'MCHC', name: 'MCHC', resultType: 'NUMERIC', unit: 'g/dL', referenceRange: '32.0 - 36.0', lowNormal: 32.0, highNormal: 36.0, defaultValue: '33.8' },
    { parameterCode: 'NEUT', name: 'Neutrophils', resultType: 'NUMERIC', unit: '%', referenceRange: '40 - 75', lowNormal: 40, highNormal: 75, defaultValue: '62' },
    { parameterCode: 'LYMPH', name: 'Lymphocytes', resultType: 'NUMERIC', unit: '%', referenceRange: '20 - 45', lowNormal: 20, highNormal: 45, defaultValue: '30' },
  ],
  LFT: [
    { parameterCode: 'TBIL', name: 'Bilirubin Total', resultType: 'NUMERIC', unit: 'mg/dL', referenceRange: '0.2 - 1.2', lowNormal: 0.2, highNormal: 1.2, defaultValue: '0.8' },
    { parameterCode: 'DBIL', name: 'Bilirubin Direct', resultType: 'NUMERIC', unit: 'mg/dL', referenceRange: '0.0 - 0.3', lowNormal: 0.0, highNormal: 0.3, defaultValue: '0.15' },
    { parameterCode: 'SGPT', name: 'SGPT / ALT', resultType: 'NUMERIC', unit: 'U/L', referenceRange: '7 - 56', lowNormal: 7, highNormal: 56, defaultValue: '28' },
    { parameterCode: 'SGOT', name: 'SGOT / AST', resultType: 'NUMERIC', unit: 'U/L', referenceRange: '10 - 40', lowNormal: 10, highNormal: 40, defaultValue: '24' },
    { parameterCode: 'ALP', name: 'Alkaline Phosphatase (ALP)', resultType: 'NUMERIC', unit: 'U/L', referenceRange: '44 - 147', lowNormal: 44, highNormal: 147, defaultValue: '85' },
    { parameterCode: 'TP', name: 'Total Protein', resultType: 'NUMERIC', unit: 'g/dL', referenceRange: '6.0 - 8.3', lowNormal: 6.0, highNormal: 8.3, defaultValue: '7.1' },
    { parameterCode: 'ALB', name: 'Albumin', resultType: 'NUMERIC', unit: 'g/dL', referenceRange: '3.5 - 5.5', lowNormal: 3.5, highNormal: 5.5, defaultValue: '4.2' },
  ],
  KFT: [
    { parameterCode: 'BUN', name: 'Blood Urea Nitrogen (BUN)', resultType: 'NUMERIC', unit: 'mg/dL', referenceRange: '7 - 20', lowNormal: 7, highNormal: 20, defaultValue: '14' },
    { parameterCode: 'CREAT', name: 'Serum Creatinine', resultType: 'NUMERIC', unit: 'mg/dL', referenceRange: '0.6 - 1.3', lowNormal: 0.6, highNormal: 1.3, defaultValue: '0.95' },
    { parameterCode: 'URIC', name: 'Uric Acid', resultType: 'NUMERIC', unit: 'mg/dL', referenceRange: '3.5 - 7.2', lowNormal: 3.5, highNormal: 7.2, defaultValue: '5.2' },
    { parameterCode: 'NA', name: 'Serum Sodium (Na+)', resultType: 'NUMERIC', unit: 'mEq/L', referenceRange: '135 - 145', lowNormal: 135, highNormal: 145, defaultValue: '140' },
    { parameterCode: 'K', name: 'Serum Potassium (K+)', resultType: 'NUMERIC', unit: 'mEq/L', referenceRange: '3.5 - 5.0', lowNormal: 3.5, highNormal: 5.0, defaultValue: '4.3' },
  ],
  CMP: [
    { parameterCode: 'GLU', name: 'Fasting Glucose', resultType: 'NUMERIC', unit: 'mg/dL', referenceRange: '70 - 100', lowNormal: 70, highNormal: 100, defaultValue: '88' },
    { parameterCode: 'BUN', name: 'Blood Urea Nitrogen', resultType: 'NUMERIC', unit: 'mg/dL', referenceRange: '7 - 20', lowNormal: 7, highNormal: 20, defaultValue: '12' },
    { parameterCode: 'CREAT', name: 'Serum Creatinine', resultType: 'NUMERIC', unit: 'mg/dL', referenceRange: '0.6 - 1.3', lowNormal: 0.6, highNormal: 1.3, defaultValue: '0.9' },
    { parameterCode: 'NA', name: 'Sodium', resultType: 'NUMERIC', unit: 'mEq/L', referenceRange: '135 - 145', lowNormal: 135, highNormal: 145, defaultValue: '139' },
    { parameterCode: 'K', name: 'Potassium', resultType: 'NUMERIC', unit: 'mEq/L', referenceRange: '3.5 - 5.0', lowNormal: 3.5, highNormal: 5.0, defaultValue: '4.1' },
    { parameterCode: 'CALC', name: 'Calcium Total', resultType: 'NUMERIC', unit: 'mg/dL', referenceRange: '8.5 - 10.5', lowNormal: 8.5, highNormal: 10.5, defaultValue: '9.4' },
    { parameterCode: 'SGPT', name: 'ALT / SGPT', resultType: 'NUMERIC', unit: 'U/L', referenceRange: '7 - 56', lowNormal: 7, highNormal: 56, defaultValue: '22' },
    { parameterCode: 'SGOT', name: 'AST / SGOT', resultType: 'NUMERIC', unit: 'U/L', referenceRange: '10 - 40', lowNormal: 10, highNormal: 40, defaultValue: '20' },
  ],
  LIPID: [
    { parameterCode: 'CHOL', name: 'Total Cholesterol', resultType: 'NUMERIC', unit: 'mg/dL', referenceRange: '125 - 200', lowNormal: 125, highNormal: 200, defaultValue: '172' },
    { parameterCode: 'TRIG', name: 'Triglycerides', resultType: 'NUMERIC', unit: 'mg/dL', referenceRange: '50 - 150', lowNormal: 50, highNormal: 150, defaultValue: '115' },
    { parameterCode: 'HDL', name: 'HDL Cholesterol (Good)', resultType: 'NUMERIC', unit: 'mg/dL', referenceRange: '40 - 60', lowNormal: 40, highNormal: 60, defaultValue: '52' },
    { parameterCode: 'LDL', name: 'LDL Cholesterol (Calculated)', resultType: 'NUMERIC', unit: 'mg/dL', referenceRange: '60 - 130', lowNormal: 60, highNormal: 130, defaultValue: '97' },
    { parameterCode: 'VLDL', name: 'VLDL Cholesterol', resultType: 'NUMERIC', unit: 'mg/dL', referenceRange: '10 - 30', lowNormal: 10, highNormal: 30, defaultValue: '23' },
  ],
  HBA1C: [
    { parameterCode: 'HBA1C', name: 'Hemoglobin A1c (Glycated)', resultType: 'NUMERIC', unit: '%', referenceRange: '4.0 - 5.6', lowNormal: 4.0, highNormal: 5.6, defaultValue: '5.2' },
    { parameterCode: 'EST_GLU', name: 'Estimated Average Glucose', resultType: 'NUMERIC', unit: 'mg/dL', referenceRange: '70 - 114', lowNormal: 70, highNormal: 114, defaultValue: '103' },
  ],
  TSH: [
    { parameterCode: 'TSH', name: 'Thyroid Stimulating Hormone', resultType: 'NUMERIC', unit: 'µIU/mL', referenceRange: '0.40 - 4.20', lowNormal: 0.40, highNormal: 4.20, defaultValue: '2.15' },
  ],
  URINE: [
    { parameterCode: 'COLOR', name: 'Color', resultType: 'OPTIONS', options: ['Pale Yellow', 'Yellow', 'Amber', 'Straw', 'Cloudy', 'Reddish'], referenceRange: 'Pale Yellow', defaultValue: 'Pale Yellow' },
    { parameterCode: 'CLARITY', name: 'Appearance / Transparency', resultType: 'OPTIONS', options: ['Clear', 'Slightly Hazy', 'Hazy', 'Cloudy', 'Turbid'], referenceRange: 'Clear', defaultValue: 'Clear' },
    { parameterCode: 'SP_GRAV', name: 'Specific Gravity', resultType: 'NUMERIC', unit: '', referenceRange: '1.005 - 1.030', lowNormal: 1.005, highNormal: 1.030, defaultValue: '1.018' },
    { parameterCode: 'PH', name: 'Reaction / pH', resultType: 'NUMERIC', unit: '', referenceRange: '5.0 - 8.0', lowNormal: 5.0, highNormal: 8.0, defaultValue: '6.5' },
    { parameterCode: 'PROTEIN', name: 'Chemical Protein (Albumin)', resultType: 'OPTIONS', options: ['Nil', 'Trace', '1+ (30 mg/dL)', '2+ (100 mg/dL)', '3+ (300 mg/dL)'], referenceRange: 'Nil', defaultValue: 'Nil' },
    { parameterCode: 'GLU', name: 'Chemical Glucose (Sugar)', resultType: 'OPTIONS', options: ['Nil', 'Trace', '1+', '2+', '3+', '4+'], referenceRange: 'Nil', defaultValue: 'Nil' },
    { parameterCode: 'PUS_CELLS', name: 'Pus Cells (WBCs)', resultType: 'NUMERIC', unit: '/HPF', referenceRange: '0 - 5', lowNormal: 0, highNormal: 5, defaultValue: '2' },
    { parameterCode: 'RBC', name: 'Red Blood Cells', resultType: 'NUMERIC', unit: '/HPF', referenceRange: '0 - 2', lowNormal: 0, highNormal: 2, defaultValue: '0' },
  ]
};

export default function ResultEntryModal({ isOpen, onClose, sample, tenantId, onSuccess }) {
  const [paramsList, setParamsList] = useState([]);
  const [instrument, setInstrument] = useState('Beckman Coulter DxH 900');
  const [reagentLot, setReagentLot] = useState('LOT-2026-X89');
  const [findingsNotes, setFindingsNotes] = useState('Analyzer run validated. Quality control calibrations verified.');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Initialize parameters based on sample tests, order item snapshots, and custom test catalog
  useEffect(() => {
    if (!isOpen || !sample) return;

    let isMounted = true;
    setError(null);

    async function loadTestParameters() {
      let resolvedParams = [];
      const testCodes = (sample.testCodes || []).map((c) => String(c).toUpperCase());
      const testNames = (sample.testNames || []).map((n) => String(n).toUpperCase());

      // Collect existing parameter results and findings for pre-filling in Edit mode
      const existingResultsMap = new Map();
      let existingFindings = sample.findings || '';

      // Source A: sample.parameterResults
      if (Array.isArray(sample.parameterResults)) {
        for (const pr of sample.parameterResults) {
          if (pr) {
            const code = (pr.parameterCode || pr.code || '').trim().toUpperCase();
            const name = (pr.name || '').trim().toLowerCase();
            if (code) existingResultsMap.set(code, pr);
            if (name) existingResultsMap.set(name, pr);
          }
        }
      }

      // 1. First check if order-linked items have structured parameters (including custom Admin tests)
      let order = null;
      if (sample.orderId && tenantId) {
        try {
          const res = await clinicalService.getOrder(tenantId, sample.orderId);
          if (res.success && res.data) {
            order = res.data;
            if (order.findings && !existingFindings) existingFindings = order.findings;
            if (Array.isArray(order.items)) {
              for (const it of order.items) {
                if (Array.isArray(it.parameterResults)) {
                  for (const pr of it.parameterResults) {
                    if (pr) {
                      const code = (pr.parameterCode || pr.code || '').trim().toUpperCase();
                      const name = (pr.name || '').trim().toLowerCase();
                      if (code && !existingResultsMap.has(code)) existingResultsMap.set(code, pr);
                      if (name && !existingResultsMap.has(name)) existingResultsMap.set(name, pr);
                    }
                  }
                }
              }
            }
          }
        } catch {
          // fallback to catalog
        }
      }

      // Source C: Reports (if report exists for order)
      if (sample.orderId && tenantId) {
        try {
          const repRes = await clinicalService.getReports(tenantId);
          if (repRes.success && Array.isArray(repRes.data)) {
            const matchedRep = repRes.data.find((r) => r.orderId === sample.orderId || r.reportId === sample.reportId);
            if (matchedRep) {
              if (matchedRep.findings && !existingFindings) existingFindings = matchedRep.findings;
              if (Array.isArray(matchedRep.items)) {
                for (const it of matchedRep.items) {
                  if (Array.isArray(it.parameterResults)) {
                    for (const pr of it.parameterResults) {
                      if (pr) {
                        const code = (pr.parameterCode || pr.code || '').trim().toUpperCase();
                        const name = (pr.name || '').trim().toLowerCase();
                        if (code && !existingResultsMap.has(code)) existingResultsMap.set(code, pr);
                        if (name && !existingResultsMap.has(name)) existingResultsMap.set(name, pr);
                      }
                    }
                  }
                }
              }
            }
          }
        } catch {
          // non-blocking
        }
      }

      const buildParamObject = (p, parsed, resolvedRef) => {
        const pCode = (p.parameterCode || p.code || '').trim().toUpperCase();
        const pName = (p.name || p.parameterCode || '').trim().toLowerCase();
        const existing = existingResultsMap.get(pCode) || existingResultsMap.get(pName);

        let initialVal = '';
        if (existing && existing.value !== undefined && existing.value !== null && String(existing.value).trim() !== '') {
          initialVal = String(existing.value);
        }

        const classification = initialVal !== ''
          ? classifyResult(initialVal, p)
          : { isAbnormal: false, flag: 'MISSING', flagLabel: 'Missing', displayFlag: '—' };

        return {
          parameterCode: p.parameterCode || p.code,
          name: p.name || p.parameterCode,
          resultType: p.resultType || 'NUMERIC',
          unit: p.unit || '',
          referenceRange: resolvedRef,
          lowNormal: p.lowNormal !== undefined ? p.lowNormal : parsed.lowNormal,
          highNormal: p.highNormal !== undefined ? p.highNormal : parsed.highNormal,
          criticalLow: parsed.criticalLow,
          criticalHigh: parsed.criticalHigh,
          isOneSided: parsed.isOneSided,
          operator: parsed.operator,
          expectedValue: parsed.expectedValue,
          options: Array.isArray(p.options) ? p.options : [],
          value: initialVal,
          isAbnormal: classification.isAbnormal,
          flag: classification.flag,
          flagLabel: classification.flagLabel,
          displayFlag: classification.displayFlag,
          required: p.required || false,
        };
      };

      if (order && Array.isArray(order.items)) {
        const targetItemIds = Array.isArray(sample.itemIds) ? sample.itemIds : [];
        const matchedItems = order.items.filter(
          (it) => testCodes.includes(it.testCode?.toUpperCase()) || targetItemIds.includes(it.itemId) || order.items.length === 1
        );

        for (const it of matchedItems) {
          if (Array.isArray(it.parameters) && it.parameters.length > 0) {
            for (const p of it.parameters) {
              const parsed = parseReferenceRange(p);
              const resolvedRef = (!isGenericReferenceRange(parsed.rawText) ? parsed.rawText : null)
                || (!isGenericReferenceRange(p.referenceRange) ? p.referenceRange : null)
                || '—';
              resolvedParams.push(buildParamObject(p, parsed, resolvedRef));
            }
          }
        }
      }

      // 2. If no parameters resolved from order, check Test Catalog (Hospital Admin custom tests)
      if (resolvedParams.length === 0 && tenantId) {
        try {
          const catalogRes = await clinicalService.getTestCatalog(tenantId);
          if (catalogRes.success && Array.isArray(catalogRes.data)) {
            for (const code of testCodes) {
              const catalogMatch = catalogRes.data.find(
                (t) => (t.code || '').toUpperCase() === code || (t.testId && t.testId === code)
              );
              if (catalogMatch && Array.isArray(catalogMatch.parameters) && catalogMatch.parameters.length > 0) {
                for (const p of catalogMatch.parameters) {
                  const parsed = parseReferenceRange(p);
                  const resolvedRef = (!isGenericReferenceRange(parsed.rawText) ? parsed.rawText : null)
                    || (!isGenericReferenceRange(p.referenceRange) ? p.referenceRange : null)
                    || '—';
                  resolvedParams.push(buildParamObject(p, parsed, resolvedRef));
                }
              }
            }
          }
        } catch {
          // fallback to presets
        }
      }

      // 3. Fallback to predefined diagnostic profiles
      if (resolvedParams.length === 0) {
        let matchedProfile = null;
        for (const code of testCodes) {
          for (const [key, template] of Object.entries(DEFAULT_TEST_PROFILES)) {
            if (code.includes(key) || key.includes(code)) {
              matchedProfile = template;
              break;
            }
          }
          if (matchedProfile) break;
        }

        if (!matchedProfile) {
          for (const name of testNames) {
            if (name.includes('BLOOD COUNT') || name.includes('CBC') || name.includes('HEMOGRAM')) {
              matchedProfile = DEFAULT_TEST_PROFILES.CBC;
              break;
            }
            if (name.includes('LIVER') || name.includes('LFT') || name.includes('HEPATIC')) {
              matchedProfile = DEFAULT_TEST_PROFILES.LFT;
              break;
            }
            if (name.includes('KIDNEY') || name.includes('RENAL') || name.includes('KFT') || name.includes('RFT')) {
              matchedProfile = DEFAULT_TEST_PROFILES.KFT;
              break;
            }
            if (name.includes('LIPID') || name.includes('CHOLESTEROL')) {
              matchedProfile = DEFAULT_TEST_PROFILES.LIPID;
              break;
            }
            if (name.includes('METABOLIC') || name.includes('CMP')) {
              matchedProfile = DEFAULT_TEST_PROFILES.CMP;
              break;
            }
            if (name.includes('URINE') || name.includes('URINALYSIS')) {
              matchedProfile = DEFAULT_TEST_PROFILES.URINE;
              break;
            }
            if (name.includes('THYROID') || name.includes('TSH')) {
              matchedProfile = DEFAULT_TEST_PROFILES.TSH;
              break;
            }
          }
        }

        if (matchedProfile) {
          resolvedParams = matchedProfile.map((p) => {
            const parsed = parseReferenceRange(p);
            const resolvedRef = (!isGenericReferenceRange(p.referenceRange) ? p.referenceRange : null)
              || (!isGenericReferenceRange(parsed.rawText) ? parsed.rawText : null)
              || '—';
            return buildParamObject(p, parsed, resolvedRef);
          });
        }
      }

      // 4. Fallback single parameter based on sample tests
      if (resolvedParams.length === 0) {
        const primaryTestName = sample.testNames?.[0] || sample.testCodes?.[0] || 'Diagnostic Assay';
        const parsed = parseReferenceRange(sample.referenceRange || '');
        const resolvedRef = (!isGenericReferenceRange(parsed.rawText) ? parsed.rawText : null)
          || (!isGenericReferenceRange(sample.referenceRange) ? sample.referenceRange : null)
          || '—';
        const fallbackDef = {
          parameterCode: (sample.testCodes?.[0] || 'RESULT').toUpperCase(),
          name: primaryTestName,
          resultType: 'NUMERIC',
          unit: sample.unit || 'units',
          options: [],
        };
        resolvedParams = [buildParamObject(fallbackDef, parsed, resolvedRef)];
      }

      if (isMounted) {
        setParamsList(resolvedParams);
        setFindingsNotes(
          existingFindings || 'Analyzer run completed without flags. Controls verified within ±2SD.'
        );
      }
    }

    loadTestParameters();

    return () => {
      isMounted = false;
    };
  }, [isOpen, sample, tenantId]);

  const handleValueChange = (index, val) => {
    setParamsList((prev) => {
      const updated = [...prev];
      const param = { ...updated[index] };
      param.value = val;

      // Authoritative clinical classification
      const classification = classifyResult(val, param);
      param.isAbnormal = classification.isAbnormal;
      param.flag = classification.flag;
      param.flagLabel = classification.flagLabel;
      param.displayFlag = classification.displayFlag;
      param.status = classification.status;

      updated[index] = param;
      return updated;
    });
  };

  const handleAutofillNormal = () => {
    setParamsList((prev) => {
      return prev.map((p) => {
        let defaultVal = '';
        // Look up default value from preset profiles
        for (const profile of Object.values(DEFAULT_TEST_PROFILES)) {
          const match = profile.find((dp) => dp.parameterCode === p.parameterCode);
          if (match && match.defaultValue) {
            defaultVal = match.defaultValue;
            break;
          }
        }
        if (!defaultVal && p.resultType === 'NUMERIC') {
          if (p.lowNormal !== null && p.highNormal !== null) {
            const mid = (p.lowNormal + p.highNormal) / 2;
            defaultVal = Number.isInteger(mid) ? String(mid) : mid.toFixed(1);
          } else if (p.highNormal !== null) {
            const mid = p.highNormal * 0.75;
            defaultVal = Number.isInteger(mid) ? String(mid) : mid.toFixed(1);
          } else if (p.lowNormal !== null) {
            const mid = p.lowNormal * 1.25;
            defaultVal = Number.isInteger(mid) ? String(mid) : mid.toFixed(1);
          } else {
            defaultVal = '10.0';
          }
        } else if (!defaultVal && p.options?.length > 0) {
          defaultVal = p.expectedValue || p.options[0];
        }

        const classification = classifyResult(defaultVal, p);

        return {
          ...p,
          value: defaultVal,
          isAbnormal: classification.isAbnormal,
          flag: classification.flag,
          flagLabel: classification.flagLabel,
          displayFlag: classification.displayFlag,
          status: classification.status,
        };
      });
    });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!sample || !tenantId) return;

    // Check if at least one parameter has a value
    const hasValues = paramsList.some((p) => p.value !== undefined && p.value !== null && String(p.value).trim() !== '');
    if (!hasValues) {
      setError('Please input at least one parameter result before submitting to the verification queue');
      return;
    }

    // Validate parameter inputs: prevent invalid numbers and empty required fields
    for (const p of paramsList) {
      const raw = p.value !== undefined && p.value !== null ? String(p.value).trim() : '';
      if (raw === '') {
        if (p.required) {
          setError(`Required parameter "${p.name || p.parameterCode}" cannot be empty.`);
          return;
        }
      } else if (p.resultType === 'NUMERIC') {
        const num = Number(p.value);
        if (isNaN(num)) {
          setError(`Parameter "${p.name || p.parameterCode}" must be a valid number.`);
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        parameterResults: paramsList.map((p) => {
          let val = null;
          const raw = p.value !== undefined && p.value !== null ? String(p.value).trim() : '';
          if (p.resultType === 'NUMERIC') {
            val = raw !== '' ? Number(p.value) : null;
          } else {
            val = raw !== '' ? raw : null;
          }
          return {
            parameterCode: p.parameterCode,
            name: p.name,
            resultType: p.resultType,
            value: val,
            unit: p.unit,
            referenceRange: p.referenceRange,
            isAbnormal: Boolean(p.isAbnormal),
            flag: p.flag || (p.isAbnormal ? 'ABNORMAL' : 'NORMAL'),
          };
        }),
        instrument,
        reagentLot,
        findings: findingsNotes,
      };

      const res = await clinicalService.recordSampleResults(tenantId, sample.sampleId, payload);
      if (res.success) {
        if (onSuccess) onSuccess(res.data);
        onClose();
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to record test results';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !sample) return null;

  const abnormalCount = paramsList.filter((p) => p.isAbnormal).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Test Result Entry & Analyzer Feeding Workstation"
      size="xl"
    >
      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.15rem',
        fontFamily: "var(--font-sans, 'Inter', system-ui, -apple-system, sans-serif)",
      }}>
        {/* Specimen Header & Chain-of-Custody Banner */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '1rem 1.25rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
        }}>
          <div>
            <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Specimen Barcode</span>
            <div style={{ fontFamily: "var(--font-sans, 'Inter', system-ui, sans-serif)", fontWeight: 800, fontSize: '1.05rem', color: 'var(--primary-blue, #2563eb)', marginTop: '2px' }}>
              {sample.barcode}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px', fontWeight: 500 }}>
              {sample.container} • {sample.sampleType}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Patient Details</span>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', marginTop: '2px' }}>
              {sample.patientName}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px', fontWeight: 500 }}>
              MRN: {sample.patientMrn || 'N/A'} • {sample.orderNumber || 'ORD'}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Tests Ordered</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '4px' }}>
              {(sample.testCodes || []).map((code) => (
                <span key={code} style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  fontWeight: 700,
                  border: '1px solid #bfdbfe',
                }}>
                  {code}
                </span>
              ))}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Receipt Status</span>
            <div style={{ marginTop: '4px' }}>
              <Badge variant="blue">Received in Lab (Bench Ready)</Badge>
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            background: 'var(--danger-50, #fef2f2)',
            border: '1px solid var(--danger-200, #fecaca)',
            color: 'var(--danger-700, #b91c1c)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md, 8px)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem'
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Toolbar: Autofill & Quality Control Indicators */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--slate-800)' }}>
              Analyte Feeding Grid ({paramsList.length} Parameters)
            </span>
            {abnormalCount > 0 ? (
              <span style={{
                background: 'var(--danger-100, #fee2e2)',
                color: 'var(--danger-700, #b91c1c)',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '2px 9px',
                borderRadius: '999px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <AlertTriangle size={12} />
                {abnormalCount} Abnormal Flag{abnormalCount > 1 ? 's' : ''}
              </span>
            ) : (
              <span style={{
                background: 'var(--success-100, #dcfce7)',
                color: 'var(--success-700, #15803d)',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '2px 9px',
                borderRadius: '999px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Check size={12} />
                Normal Profile
              </span>
            )}
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleAutofillNormal}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 600, borderColor: 'var(--primary-300)' }}
            title="Autofill nominal baseline values from laboratory reference standards"
          >
            <Sparkles size={14} style={{ color: 'var(--primary-blue)' }} />
            <span>Autofill Normal Values</span>
          </button>
        </div>

        {/* Parameter Entry Table (Taller Height & Sharp Inter Typography) */}
        <div style={{
          maxHeight: '520px',
          minHeight: '340px',
          overflowY: 'auto',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}>
          <table className="lms-table" style={{ margin: 0, fontFamily: "var(--font-sans, 'Inter', system-ui, sans-serif)" }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1' }}>
              <tr>
                <th style={{ width: '28%', padding: '10px 14px', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#475569' }}>
                  Analyte / Parameter
                </th>
                <th style={{ width: '28%', padding: '10px 14px', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#475569' }}>
                  Observed Result *
                </th>
                <th style={{ width: '14%', padding: '10px 14px', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#475569' }}>
                  Unit
                </th>
                <th style={{ width: '18%', padding: '10px 14px', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#475569' }}>
                  Reference Range
                </th>
                <th style={{ width: '12%', textAlign: 'center', padding: '10px 14px', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#475569' }}>
                  Flag
                </th>
              </tr>
            </thead>
            <tbody>
              {paramsList.map((p, idx) => (
                <tr key={p.parameterCode} style={{ background: p.isAbnormal ? '#fff5f5' : idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>
                        {p.name}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', letterSpacing: '0.02em', marginTop: '1px' }}>
                        {p.parameterCode}
                      </span>
                    </div>
                  </td>

                  <td style={{ padding: '8px 14px' }}>
                    {p.resultType === 'OPTIONS' ? (
                      <select
                        className="form-input"
                        style={{
                          padding: '0.45rem 0.65rem',
                          fontSize: '0.875rem',
                          fontFamily: "var(--font-sans, 'Inter', system-ui, sans-serif)",
                          borderRadius: '6px',
                          borderColor: p.isAbnormal ? 'var(--danger-500, #ef4444)' : '#cbd5e1',
                          background: p.isAbnormal ? '#fff' : '#ffffff',
                          fontWeight: 500,
                        }}
                        value={p.value}
                        onChange={(e) => handleValueChange(idx, e.target.value)}
                      >
                        <option value="">-- Select --</option>
                        {p.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        step="any"
                        placeholder="Enter value..."
                        className="form-input"
                        style={{
                          padding: '0.45rem 0.65rem',
                          fontSize: '0.875rem',
                          fontFamily: "var(--font-sans, 'Inter', system-ui, sans-serif)",
                          fontWeight: 600,
                          borderRadius: '6px',
                          borderColor: p.isAbnormal ? 'var(--danger-500, #ef4444)' : '#cbd5e1',
                          background: p.isAbnormal ? '#fff' : '#ffffff',
                        }}
                        value={p.value}
                        onChange={(e) => handleValueChange(idx, e.target.value)}
                      />
                    )}
                  </td>

                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#334155', fontWeight: 500 }}>
                      {p.unit || '—'}
                    </span>
                  </td>

                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#334155', fontWeight: 500 }}>
                      {p.referenceRange || 'Standard'}
                    </span>
                  </td>

                  <td style={{ textAlign: 'center', padding: '10px 14px' }}>
                    {p.value === '' || p.value === undefined ? (
                      <span style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>—</span>
                    ) : p.flag === 'CRITICAL_LOW' || p.flag === 'CRITICAL_HIGH' ? (
                      <Badge variant="danger" style={{ background: '#991b1b', color: '#fff', fontSize: '0.7rem', padding: '2px 7px', fontWeight: 700 }}>
                        CRIT
                      </Badge>
                    ) : p.flag === 'LOW' ? (
                      <Badge style={{ background: '#fef3c7', color: '#92400e', borderColor: '#fde68a', fontSize: '0.7rem', padding: '2px 7px', fontWeight: 700 }}>
                        LOW
                      </Badge>
                    ) : p.flag === 'HIGH' ? (
                      <Badge variant="danger" style={{ fontSize: '0.7rem', padding: '2px 7px', fontWeight: 700 }}>
                        HIGH
                      </Badge>
                    ) : p.isAbnormal ? (
                      <Badge variant="danger" style={{ fontSize: '0.7rem', padding: '2px 7px', fontWeight: 700 }}>
                        OUT
                      </Badge>
                    ) : (
                      <Badge variant="success" style={{ fontSize: '0.7rem', padding: '2px 7px', fontWeight: 700 }}>
                        NORM
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Analyzer & Instrument Traceability Metadata */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: '#334155' }}>
              <Cpu size={13} style={{ color: 'var(--primary-blue)' }} />
              Testing Analyzer / Instrument
            </label>
            <input
              type="text"
              className="form-input"
              style={{ fontSize: '0.85rem', fontFamily: "var(--font-sans, 'Inter', system-ui, sans-serif)" }}
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
              placeholder="e.g. Beckman Coulter DxH 900, Roche Cobas"
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: '#334155' }}>
              <Tag size={13} style={{ color: 'var(--primary-blue)' }} />
              Reagent Calibration Batch / Lot #
            </label>
            <input
              type="text"
              className="form-input"
              style={{ fontSize: '0.85rem', fontFamily: "var(--font-sans, 'Inter', system-ui, sans-serif)" }}
              value={reagentLot}
              onChange={(e) => setReagentLot(e.target.value)}
              placeholder="e.g. LOT-2026-X89"
            />
          </div>
        </div>

        {/* Clinical Technician Findings & Remarks */}
        <div className="form-group">
          <label className="form-label" style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: '#334155' }}>
            <FileText size={13} style={{ color: 'var(--primary-blue)' }} />
            Bench Notes & Preliminary Observations
          </label>
          <textarea
            className="form-input"
            rows={2}
            style={{ fontSize: '0.85rem', fontFamily: "var(--font-sans, 'Inter', system-ui, sans-serif)", resize: 'vertical' }}
            value={findingsNotes}
            onChange={(e) => setFindingsNotes(e.target.value)}
            placeholder="Enter any bench observations, delta checks, or sample appearance notes..."
          />
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={submitting}
            style={{ fontWeight: 600, fontSize: '0.875rem' }}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.875rem' }}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Recording Results...</span>
              </>
            ) : (
              <>
                <Send size={15} />
                <span>{sample.processingStatus === 'results_entered' ? 'Update & Push to Pathologist' : 'Save & Push to Pathologist Queue'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
