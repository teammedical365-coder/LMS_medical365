/**
 * LMS Automated Regression Test Suite
 * Pathologist Rejection -> Recollection -> Retesting -> Verification Queue Workflow
 */

import tenantClinicalService from '../src/services/tenantClinical.service.js';
import tenantUserService from '../src/services/tenantUser.service.js';
import tenantConnectionService from '../src/services/tenantConnection.service.js';

tenantUserService.assertTenantReady = async () => true;
tenantConnectionService.allowTestMemoryMode = true;

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assert(condition, message, details = '') {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✓ ${message}`);
  } else {
    failedChecks++;
    console.error(`  ✗ FAIL: ${message}${details ? ' - ' + details : ''}`);
  }
}

async function runRegressionSuite() {
  console.log('========================================================================');
  console.log('STARTING REGRESSION TEST: Pathologist Rejection -> Recollection Workflow');
  console.log('========================================================================\n');

  const testTenant = `ten_reg_${Date.now()}`;

  // Initialize tenant in-memory maps
  tenantClinicalService.memoryPatients.set(testTenant, new Map());
  tenantClinicalService.memoryOrders.set(testTenant, new Map());
  tenantClinicalService.memorySamples.set(testTenant, new Map());
  tenantClinicalService.memoryReports.set(testTenant, new Map());
  tenantClinicalService.memoryRecollections.set(testTenant, new Map());

  // -------------------------------------------------------------------------
  // SETUP: Initial patient, order, sample, and report
  // -------------------------------------------------------------------------
  console.log('--- [SETUP] Creating Base Test Requisition & Initial Report ---');

  const patientId = `pat_${Date.now()}`;
  const orderId = `ord_${Date.now()}`;
  const sampleId = `smp_${Date.now()}`;
  const reportId = `rep_${Date.now()}`;
  const itemId = `it_${Date.now()}`;

  const mockPatient = {
    patientId,
    tenantId: testTenant,
    mrn: 'MRN-REG-001',
    fullName: 'Rajesh Sharma',
    gender: 'male',
    dob: new Date('1985-05-15'),
    phone: '+919876543210',
    createdAt: new Date(),
    toSafeJSON() { return { ...this }; }
  };
  tenantClinicalService.memoryPatients.get(testTenant).set(patientId, mockPatient);

  const mockSample = {
    sampleId,
    tenantId: testTenant,
    orderId,
    patientId,
    patientName: 'Rajesh Sharma',
    patientMrn: 'MRN-REG-001',
    barcode: 'JPL-200-01',
    type: 'Whole Blood EDTA',
    collectionStatus: 'collected',
    processingStatus: 'in_analysis',
    itemIds: [itemId],
    testCode: 'CBC',
    testName: 'Complete Blood Count',
    container: 'Lavender Top (EDTA)',
    collectedAt: new Date(),
    receivedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    toSafeJSON() { return { ...this }; }
  };
  tenantClinicalService.memorySamples.get(testTenant).set(sampleId, mockSample);

  const mockOrder = {
    orderId,
    tenantId: testTenant,
    orderNumber: 'ORD-REG-1001',
    patientId,
    patientName: 'Rajesh Sharma',
    patientMrn: 'MRN-REG-001',
    orderStatus: 'in_analysis',
    paymentStatus: 'paid',
    items: [
      {
        itemId,
        testCode: 'CBC',
        testName: 'Complete Blood Count',
        sampleId,
        status: 'in_analysis',
        parameterResults: [
          { parameterName: 'Hemoglobin', value: 14.2, unit: 'g/dL', flag: 'NORMAL' },
          { parameterName: 'WBC', value: 7500, unit: '/uL', flag: 'NORMAL' }
        ]
      }
    ],
    sampleIds: [sampleId],
    createdAt: new Date(),
    updatedAt: new Date(),
    toSafeJSON() { return { ...this }; }
  };
  tenantClinicalService.memoryOrders.get(testTenant).set(orderId, mockOrder);

  const mockReport = {
    reportId,
    tenantId: testTenant,
    reportNumber: 'REP-REG-1001',
    orderId,
    orderNumber: 'ORD-REG-1001',
    patientId,
    patientName: 'Rajesh Sharma',
    patientMrn: 'MRN-REG-001',
    status: 'pending_review',
    findings: 'Parameters correlate with reference intervals.',
    items: [
      {
        itemId,
        testCode: 'CBC',
        testName: 'Complete Blood Count',
        parameterResults: [
          { parameterName: 'Hemoglobin', value: 14.2, unit: 'g/dL', flag: 'NORMAL' },
          { parameterName: 'WBC', value: 7500, unit: '/uL', flag: 'NORMAL' }
        ]
      }
    ],
    rejectionReason: null,
    rejectionHistory: [],
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(Date.now() - 3600000),
    toSafeJSON() { return { ...this }; }
  };
  tenantClinicalService.memoryReports.get(testTenant).set(reportId, mockReport);

  assert(mockReport.status === 'pending_review', 'Report created in pending_review status');

  // -------------------------------------------------------------------------
  // SCENARIO 1: Pathologist rejects report with specimen recollection required
  // -------------------------------------------------------------------------
  console.log('\n--- [SCENARIO 1] Pathologist Rejects Report (Recollection Required) ---');

  const rejectRes = await tenantClinicalService.rejectReport(testTenant, reportId, {
    reason: 'Severe hemolysis in serum; repeat draw required',
    rejectionType: 'recollection',
    requiresRecollection: true,
    rejectedBy: 'Dr. Pathologist',
  });

  assert(rejectRes.status === 'rejected', 'Report status transitioned to "rejected"');
  assert(rejectRes.rejectionReason === 'Severe hemolysis in serum; repeat draw required', 'Active rejectionReason recorded on report');
  assert(Array.isArray(rejectRes.rejectionHistory) && rejectRes.rejectionHistory.length === 1, 'Rejection history has 1 audit record');
  assert(rejectRes.rejectionHistory[0].rejectionType === 'recollection', 'Rejection history recorded type "recollection"');
  assert(rejectRes.rejectionHistory[0].rejectedBy === 'Dr. Pathologist', 'Rejection history recorded author "Dr. Pathologist"');

  const smpAfterReject = await tenantClinicalService.getSampleById(testTenant, sampleId);
  assert(smpAfterReject.collectionStatus === 'rejected', 'Specimen collectionStatus transitioned to "rejected"');
  assert(smpAfterReject.processingStatus === 'recollection_requested', 'Specimen processingStatus transitioned to "recollection_requested"');
  assert((smpAfterReject.rejectionRemarks || smpAfterReject.rejectionReason || '').includes('Severe hemolysis'), 'Specimen rejectionRemarks/reason updated');

  const ordAfterReject = await tenantClinicalService.getOrderById(testTenant, orderId);
  assert(ordAfterReject.orderStatus === 'in_progress', 'Order status rolled back to "in_progress" for recollection');
  assert(ordAfterReject.items[0].status === 'ordered', 'Order item status reset to "ordered" for recollection');

  const recollectionTasks = await tenantClinicalService.listRecollectionTasks(testTenant, { status: 'pending' });
  assert(recollectionTasks.length === 1, 'Pending RecollectionTask generated and visible in queue');
  const task1 = recollectionTasks[0];
  assert(task1.sampleBarcode === 'JPL-200-01', 'RecollectionTask references original specimen barcode');
  assert(task1.reason === 'Severe hemolysis in serum; repeat draw required', 'RecollectionTask retains clinical rejection reason');
  assert(task1.patientName === 'Rajesh Sharma', 'RecollectionTask retains patient demographics');

  // -------------------------------------------------------------------------
  // SCENARIO 2: Verification and Release Protections on Rejected Report
  // -------------------------------------------------------------------------
  console.log('\n--- [SCENARIO 2] Protected State Validations on Rejected Report ---');

  let releaseBlocked = false;
  try {
    await tenantClinicalService.releaseReport(testTenant, reportId);
  } catch (err) {
    if (err.code === 'INVALID_STATE_TRANSITION' || err.code === 'REPORT_NOT_APPROVED' || err.statusCode === 400) {
      releaseBlocked = true;
    }
  }
  assert(releaseBlocked, 'Rejected report CANNOT be accidentally released (blocked with INVALID_STATE_TRANSITION)');

  let approveBlocked = false;
  try {
    await tenantClinicalService.approveReport(testTenant, reportId, { findings: 'Trying to approve without resubmission' });
  } catch (err) {
    if (err.code === 'INVALID_STATE_TRANSITION' || err.statusCode === 400) {
      approveBlocked = true;
    }
  }
  assert(approveBlocked, 'Rejected report CANNOT be approved directly without resubmission');

  // -------------------------------------------------------------------------
  // SCENARIO 3: Phlebotomist resolves recollection task & replacement sample
  // -------------------------------------------------------------------------
  console.log('\n--- [SCENARIO 3] Phlebotomist Resolves Recollection Task ---');

  const resolveRes = await tenantClinicalService.resolveRecollectionTask(testTenant, task1.taskId, {
    phlebotomistNotes: 'Redrawn from right antecubital fossa by phlebotomist',
  });

  assert(resolveRes.task.status === 'resolved', 'Recollection task transitioned to "resolved"');
  assert(resolveRes.replacementBarcode === 'JPL-200-01-R1', 'Replacement tube assigned incremented barcode "JPL-200-01-R1"');

  const pendingTasksAfterResolve = await tenantClinicalService.listRecollectionTasks(testTenant, { status: 'pending' });
  assert(pendingTasksAfterResolve.length === 0, 'Resolved task cleared from active pending recollection queue');

  const replacementSample = await tenantClinicalService.getSampleById(testTenant, resolveRes.replacementBarcode);
  assert(replacementSample !== null, 'Replacement sample lookup succeeded');
  assert(replacementSample.collectionStatus === 'collected', 'Replacement sample created in "collected" status');
  assert(Array.isArray(replacementSample.itemIds) && replacementSample.itemIds.includes(itemId), 'Replacement sample inherited test itemIds from original');

  const ordAfterRecollect = await tenantClinicalService.getOrderById(testTenant, orderId);
  assert(ordAfterRecollect.sampleIds.includes(replacementSample.sampleId), 'Order sampleIds updated to include replacement sample');

  // -------------------------------------------------------------------------
  // SCENARIO 4: Technician Retesting & Resubmission to Verification Queue
  // -------------------------------------------------------------------------
  console.log('\n--- [SCENARIO 4] Technician Retesting & Resubmission ---');

  // Technician receives replacement sample at lab triage
  await tenantClinicalService.updateSampleStatus(testTenant, replacementSample.sampleId, {
    collectionStatus: 'received',
    notes: 'Received at Central Chemistry Bench',
  });

  const smpReceived = await tenantClinicalService.getSampleById(testTenant, replacementSample.sampleId);
  assert(smpReceived.collectionStatus === 'received', 'Replacement specimen received at bench');

  // Technician records fresh valid results
  const recordRes = await tenantClinicalService.recordResults(testTenant, replacementSample.sampleId, {
    results: [
      {
        itemId,
        parameterResults: [
          { parameterName: 'Hemoglobin', value: 13.9, unit: 'g/dL', flag: 'NORMAL' },
          { parameterName: 'WBC', value: 7200, unit: '/uL', flag: 'NORMAL' }
        ]
      }
    ],
    technicianName: 'Lab Tech Priya',
  });

  assert(recordRes.sample?.processingStatus === 'results_entered' || recordRes.sample?.processingStatus === 'completed', 'Specimen processingStatus transitioned to "results_entered"');

  const reportResubmitted = await tenantClinicalService.getReportById(testTenant, reportId);
  assert(reportResubmitted.status === 'pending_review', 'Report status resubmitted to "pending_review" for Pathologist Verification');
  assert(reportResubmitted.rejectionReason === null, 'Active rejectionReason cleared on fresh resubmission');
  assert(reportResubmitted.rejectionHistory.length === 1, 'Previous rejection history preserved intact in audit trail');

  // Verification queue listing check
  const verificationQueue = await tenantClinicalService.listReports(testTenant, { status: 'pending_review' });
  const foundInQueue = verificationQueue.find((r) => r.reportId === reportId);
  assert(foundInQueue !== undefined, 'Resubmitted report appears in Pathologist Verification Queue (pending_review)');

  // -------------------------------------------------------------------------
  // SCENARIO 5: Multiple Consecutive Recollections (-R1 -> -R2)
  // -------------------------------------------------------------------------
  console.log('\n--- [SCENARIO 5] Consecutive Rejection Testing (-R1 -> -R2) ---');

  // Pathologist rejects the redraw sample again (e.g. clotted tube)
  const reject2Res = await tenantClinicalService.rejectReport(testTenant, reportId, {
    reason: 'Sample clotted during transit; second recollection required',
    rejectionType: 'recollection',
    requiresRecollection: true,
    rejectedBy: 'Dr. Pathologist',
  });

  assert(reject2Res.status === 'rejected', 'Second rejection sets status to "rejected"');
  assert(reject2Res.rejectionHistory.length === 2, 'Rejection history tracks both rejection occurrences');

  const pendingTasks2 = await tenantClinicalService.listRecollectionTasks(testTenant, { status: 'pending' });
  assert(pendingTasks2.length === 1, 'New recollection task created for second redraw');
  assert(pendingTasks2[0].sampleBarcode === 'JPL-200-01-R1', 'Task references -R1 barcode');

  const resolve2Res = await tenantClinicalService.resolveRecollectionTask(testTenant, pendingTasks2[0].taskId, {
    phlebotomistNotes: 'Second redraw performed under direct supervision',
  });

  assert(resolve2Res.replacementBarcode === 'JPL-200-01-R2', 'Consecutive replacement tube intelligently named "-R2"');

  // Technician enters valid results on R2
  const r2Sample = await tenantClinicalService.getSampleById(testTenant, resolve2Res.replacementBarcode);
  await tenantClinicalService.updateSampleStatus(testTenant, r2Sample.sampleId, { collectionStatus: 'received' });
  await tenantClinicalService.recordResults(testTenant, r2Sample.sampleId, {
    results: [
      {
        itemId,
        parameterResults: [
          { parameterName: 'Hemoglobin', value: 14.0, unit: 'g/dL', flag: 'NORMAL' },
          { parameterName: 'WBC', value: 7100, unit: '/uL', flag: 'NORMAL' }
        ]
      }
    ],
    technicianName: 'Lab Tech Priya',
  });

  const repAfterR2 = await tenantClinicalService.getReportById(testTenant, reportId);
  assert(repAfterR2.status === 'pending_review', 'Report back in pending_review after R2 test entry');
  assert(repAfterR2.rejectionHistory.length === 2, 'Complete audit log of both rejections maintained');

  // -------------------------------------------------------------------------
  // SCENARIO 6: Pathologist Approval, Release, and Lock Protections
  // -------------------------------------------------------------------------
  console.log('\n--- [SCENARIO 6] Pathologist Approval, Release, & Integrity Protections ---');

  const approveRes = await tenantClinicalService.approveReport(testTenant, reportId, {
    findings: 'Redrawn specimen yields valid normal hematology indices.',
    verificationNotes: 'Correlated and approved under quality protocol.',
    verifiedBy: 'Dr. Pathologist',
  });

  assert(approveRes.status === 'approved', 'Report successfully verified & signed by Pathologist ("approved")');
  assert(approveRes.verifiedBy === 'Dr. Pathologist', 'VerifiedBy recorded on approved report');

  // Cannot reject an approved report
  let rejectApprovedBlocked = false;
  try {
    await tenantClinicalService.rejectReport(testTenant, reportId, { reason: 'Late rejection attempt' });
  } catch (err) {
    if (err.code === 'REPORT_ALREADY_APPROVED' || err.statusCode === 400) {
      rejectApprovedBlocked = true;
    }
  }
  assert(rejectApprovedBlocked, 'Approved report CANNOT be rejected (REPORT_ALREADY_APPROVED)');

  // Release the report
  const releaseRes = await tenantClinicalService.releaseReport(testTenant, reportId, {
    releasedBy: 'Dr. Pathologist',
  });
  assert(releaseRes.status === 'released', 'Report transitioned to "released" for patient portal');

  // Cannot modify or re-approve released report
  let reapproveBlocked = false;
  try {
    await tenantClinicalService.approveReport(testTenant, reportId, { findings: 'Tamper' });
  } catch (err) {
    if (err.code === 'ALREADY_RELEASED' || err.code === 'REPORT_ALREADY_RELEASED' || err.statusCode === 400) {
      reapproveBlocked = true;
    }
  }
  assert(reapproveBlocked, 'Released report cannot be modified or re-approved');

  let rejectReleasedBlocked = false;
  try {
    await tenantClinicalService.rejectReport(testTenant, reportId, { reason: 'Cannot reject released' });
  } catch (err) {
    if (err.code === 'REPORT_ALREADY_RELEASED' || err.statusCode === 400) {
      rejectReleasedBlocked = true;
    }
  }
  assert(rejectReleasedBlocked, 'Released report cannot be rejected');

  // -------------------------------------------------------------------------
  // SCENARIO 7: Technician Bench Revision (rejectionType: 'correction', no redraw)
  // -------------------------------------------------------------------------
  console.log('\n--- [SCENARIO 7] Technician Bench Revision (Without Specimen Recollection) ---');

  const report2Id = `rep_bench_${Date.now()}`;
  const order2Id = `ord_bench_${Date.now()}`;
  const sample2Id = `smp_bench_${Date.now()}`;

  const mockReport2 = {
    reportId: report2Id,
    tenantId: testTenant,
    reportNumber: 'REP-BENCH-2002',
    orderId: order2Id,
    orderNumber: 'ORD-BENCH-2002',
    patientId,
    patientName: 'Rajesh Sharma',
    patientMrn: 'MRN-REG-001',
    status: 'pending_review',
    findings: 'Initial findings',
    items: [
      {
        itemId: 'it_b1',
        testCode: 'GLU',
        testName: 'Glucose Fasting',
        parameterResults: [{ parameterName: 'Glucose', value: 310, unit: 'mg/dL', flag: 'HIGH' }]
      }
    ],
    rejectionReason: null,
    rejectionHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    toSafeJSON() { return { ...this }; }
  };
  tenantClinicalService.memoryReports.get(testTenant).set(report2Id, mockReport2);

  const mockSample2 = {
    sampleId: sample2Id,
    tenantId: testTenant,
    orderId: order2Id,
    barcode: 'JPL-201-01',
    collectionStatus: 'received',
    processingStatus: 'completed',
    itemIds: ['it_b1'],
    testCode: 'GLU',
    createdAt: new Date(),
    updatedAt: new Date(),
    toSafeJSON() { return { ...this }; }
  };
  tenantClinicalService.memorySamples.get(testTenant).set(sample2Id, mockSample2);

  // Reject for technician bench correction (no redraw)
  const benchRejectRes = await tenantClinicalService.rejectReport(testTenant, report2Id, {
    reason: 'Please re-run assay with 1:2 dilution to confirm glucose linearity.',
    rejectionType: 'correction',
    requiresRecollection: false,
    rejectedBy: 'Dr. Pathologist',
  });

  assert(benchRejectRes.status === 'rejected', 'Bench revision sets report status to "rejected"');
  assert(benchRejectRes.rejectionHistory[0].rejectionType === 'correction', 'Audit trail notes "correction" type');

  // Verify NO RecollectionTask was created for bench revision
  const recollectionTasksForBench = await tenantClinicalService.listRecollectionTasks(testTenant, { status: 'pending' });
  const benchTaskFound = recollectionTasksForBench.find((t) => t.orderId === order2Id);
  assert(!benchTaskFound, 'NO RecollectionTask created for technician bench revision');

  // Specimen remains valid for bench rerun
  const sample2AfterReject = await tenantClinicalService.getSampleById(testTenant, sample2Id);
  assert(sample2AfterReject.collectionStatus !== 'rejected', 'Specimen collectionStatus NOT marked rejected (preserved for rerun)');

  // Technician revises report results
  const updateRepRes = await tenantClinicalService.updateReport(testTenant, report2Id, {
    findings: 'Assay repeated at 1:2 dilution. Verified glucose linearity confirmed at 295 mg/dL.',
    items: [
      {
        itemId: 'it_b1',
        testCode: 'GLU',
        testName: 'Glucose Fasting',
        parameterResults: [{ parameterName: 'Glucose', value: 295, unit: 'mg/dL', flag: 'HIGH' }]
      }
    ],
    technicianName: 'Bench Tech Mohan',
  });

  assert(updateRepRes.status === 'pending_review', 'Report automatically returned to "pending_review" for Pathologist review');
  assert(updateRepRes.rejectionReason === null, 'Active rejectionReason cleared after revision');
  assert(updateRepRes.rejectionHistory.length === 1, 'Rejection history preserved');

  // -------------------------------------------------------------------------
  // SCENARIO 8: Queue Sorting & Non-Rejected Isolation
  // -------------------------------------------------------------------------
  console.log('\n--- [SCENARIO 8] Queue Sorting & Isolation ---');

  const reportsList = await tenantClinicalService.listReports(testTenant);
  assert(reportsList.length >= 2, 'Reports list returned all tenant reports');
  assert(reportsList[0].reportId === report2Id, 'Recently resubmitted report sorted to top of queue (updatedAt: -1)');

  const resolvedTasks = await tenantClinicalService.listRecollectionTasks(testTenant, { status: 'resolved' });
  assert(resolvedTasks.length === 2, 'Resolved recollection tasks history accurately tracked');

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`REGRESSION SUITE COMPLETED: ${passedChecks}/${totalChecks} CHECKS PASSED`);
  if (failedChecks === 0) {
    console.log('STATUS: ALL ASSERTIONS PASSED (100%)');
  } else {
    console.error(`STATUS: ${failedChecks} ASSERTIONS FAILED`);
  }
  console.log('========================================================================\n');

  if (failedChecks > 0) {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error('Fatal regression suite error:', err);
  process.exit(1);
});
