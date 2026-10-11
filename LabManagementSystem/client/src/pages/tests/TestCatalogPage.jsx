/**
 * Lab Management System (LMS) - Test Catalog Page (Phase 1 UI Shell)
 */

import React, { useState } from 'react';
import { TestTube2, PlusCircle, Search, Eye, BookOpen } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

export function TestCatalogPage() {
  const [selectedTest, setSelectedTest] = useState(null);
  const [selectedDept, setSelectedDept] = useState('All');

  const mockTests = [
    {
      code: 'CBC-01',
      name: 'Complete Blood Count with Differential',
      department: 'Hematology',
      specimen: 'Whole Blood (EDTA)',
      tat: '2 Hours',
      fee: '$28.00',
      status: 'active',
      methodology: 'Automated Cell Counter / Flow Cytometry',
      referenceRange: 'WBC: 4.5-11.0 x10^9/L, RBC: 4.2-5.9 x10^12/L, Hgb: 13.5-17.5 g/dL',
    },
    {
      code: 'CMP-02',
      name: 'Comprehensive Metabolic Panel (14 Tests)',
      department: 'Clinical Chemistry',
      specimen: 'Serum (SST)',
      tat: '3 Hours',
      fee: '$45.00',
      status: 'active',
      methodology: 'Spectrophotometry & Ion-Selective Electrodes',
      referenceRange: 'Glucose: 70-99 mg/dL, BUN: 7-20 mg/dL, Creatinine: 0.6-1.3 mg/dL',
    },
    {
      code: 'TSH-03',
      name: 'Thyroid Stimulating Hormone (3rd Gen)',
      department: 'Endocrinology',
      specimen: 'Serum',
      tat: '4 Hours',
      fee: '$35.00',
      status: 'active',
      methodology: 'Chemiluminescent Microparticle Immunoassay (CMIA)',
      referenceRange: '0.45 - 4.50 uIU/mL',
    },
    {
      code: 'LIP-04',
      name: 'Lipid Panel (Cholesterol, HDL, LDL, Trig)',
      department: 'Clinical Chemistry',
      specimen: 'Fasting Serum',
      tat: '3 Hours',
      fee: '$38.00',
      status: 'active',
      methodology: 'Enzymatic Colorimetric',
      referenceRange: 'Total Chol: <200 mg/dL, HDL: >40 mg/dL, LDL: <100 mg/dL',
    },
    {
      code: 'A1C-05',
      name: 'Hemoglobin A1c (Glycated Hb)',
      department: 'Clinical Chemistry',
      specimen: 'Whole Blood (EDTA)',
      tat: '4 Hours',
      fee: '$32.00',
      status: 'active',
      methodology: 'HPLC (High-Performance Liquid Chromatography)',
      referenceRange: '< 5.7% (Normal), 5.7 - 6.4% (Prediabetes)',
    },
    {
      code: 'URN-06',
      name: 'Complete Urinalysis with Microscopic',
      department: 'Urinalysis',
      specimen: 'Clean Catch Urine',
      tat: '1 Hour',
      fee: '$22.00',
      status: 'active',
      methodology: 'Automated Test Strip Reader & Flow Imaging',
      referenceRange: 'Color: Pale Yellow, pH: 5.0-8.0, Protein: Negative',
    },
  ];

  const departments = ['All', 'Hematology', 'Clinical Chemistry', 'Endocrinology', 'Urinalysis'];

  const filteredTests = selectedDept === 'All'
    ? mockTests
    : mockTests.filter((t) => t.department === selectedDept);

  return (
    <>
      <PageHeader
        title="Diagnostic Test Catalog"
        description="Master compendium of laboratory diagnostic test definitions, analytical methods, reference intervals, and billing schedules."
        actions={
          <button
            className="btn btn-primary"
            onClick={() => alert('UI Demo Notice: Adding custom test definitions will be configured in Phase 2.')}
          >
            <PlusCircle size={16} />
            <span>Add Test Definition (UI Demo)</span>
          </button>
        }
      />

      <StatusBanner
        type="info"
        badgeText="UI Shell Demonstration"
        message="Test catalog items below represent standard clinical laboratory menu definitions. Laboratory custom test panels and loinc mappings will be managed in Phase 2."
      />

      {/* Department Filter Tabs */}
      <div className="card" style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`btn btn-sm ${selectedDept === dept ? 'btn-primary' : 'btn-secondary'}`}
              >
                {dept}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
            {filteredTests.length} tests listed
          </span>
        </div>
      </div>

      {/* Tests Table */}
      <div className="card">
        <div className="table-container">
          <table className="lms-table">
            <thead>
              <tr>
                <th>Test Code</th>
                <th>Test Name / Description</th>
                <th>Department</th>
                <th>Required Specimen</th>
                <th>Standard TAT</th>
                <th>Fee</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Methodology</th>
              </tr>
            </thead>
            <tbody>
              {filteredTests.map((t) => (
                <tr key={t.code}>
                  <td>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--primary-700)' }}>{t.code}</strong>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{t.name}</span>
                  </td>
                  <td>
                    <Badge variant="slate">{t.department}</Badge>
                  </td>
                  <td>{t.specimen}</td>
                  <td>{t.tat}</td>
                  <td style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{t.fee}</td>
                  <td>
                    <Badge variant="success">Active</Badge>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedTest(t)}
                    >
                      <BookOpen size={13} />
                      <span>Details</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Test Details Modal */}
      <Modal
        isOpen={!!selectedTest}
        onClose={() => setSelectedTest(null)}
        title={selectedTest ? `${selectedTest.code} - ${selectedTest.name}` : ''}
        footer={
          <button className="btn btn-secondary" onClick={() => setSelectedTest(null)}>
            Close
          </button>
        }
      >
        {selectedTest && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div className="grid-2">
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Department</p>
                <p style={{ fontWeight: 600 }}>{selectedTest.department}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Specimen Requirement</p>
                <p style={{ fontWeight: 600 }}>{selectedTest.specimen}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Target TAT</p>
                <p>{selectedTest.tat}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Default Price</p>
                <p style={{ fontWeight: 600, color: 'var(--primary-700)' }}>{selectedTest.fee}</p>
              </div>
            </div>

            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '4px' }}>Analytical Methodology</p>
              <div style={{ background: 'var(--slate-50)', padding: '0.625rem', borderRadius: 'var(--radius-md)' }}>
                {selectedTest.methodology}
              </div>
            </div>

            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '4px' }}>Biological Reference Interval</p>
              <div style={{ background: 'var(--slate-50)', padding: '0.625rem', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                {selectedTest.referenceRange}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default TestCatalogPage;
