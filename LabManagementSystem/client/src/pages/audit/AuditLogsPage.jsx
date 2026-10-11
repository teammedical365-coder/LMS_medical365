/**
 * Lab Management System (LMS) - Audit Log Viewer (Phase 9 Dashboards & Analytics)
 * 
 * Provides a tenant-isolated, role-guarded audit trail for laboratory operations,
 * report release lifecycle, staff actions, and compliance events.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  ShieldCheck,
  Filter,
  RefreshCw,
  Eye,
  AlertCircle,
  Loader2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Info,
  Clock,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import clinicalService from '../../services/clinicalService';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

export function AuditLogsPage() {
  const { user, tenant } = useAuth();
  const tenantId = tenant?.tenantId || user?.tenantId;

  // Data state
  const [logs, setLogs] = useState([]);
  const [actionsList, setActionsList] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Filter state
  const [selectedAction, setSelectedAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);

  // Fetch distinct action types for filter dropdown
  useEffect(() => {
    if (!tenantId) return;
    let isMounted = true;
    clinicalService
      .getAuditActions(tenantId)
      .then((res) => {
        if (isMounted && res.success && Array.isArray(res.data)) {
          setActionsList(res.data);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch audit actions list', err?.message);
      });
    return () => {
      isMounted = false;
    };
  }, [tenantId]);

  // Fetch paginated audit logs
  const fetchAuditLogs = useCallback(
    async (targetPage = page) => {
      if (!tenantId) return;
      try {
        setIsLoading(true);
        setError(null);

        const params = {
          page: targetPage,
          limit,
        };
        if (selectedAction) params.action = selectedAction;
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;

        const res = await clinicalService.getAuditLogs(tenantId, params);
        if (res.success && res.data) {
          setLogs(res.data.items || []);
          setTotalCount(res.data.total || 0);
          setTotalPages(res.data.totalPages || 1);
          setPage(res.data.page || targetPage);
        } else {
          setLogs([]);
          setTotalCount(0);
          setTotalPages(1);
        }
      } catch (err) {
        setError(
          err.response?.data?.message ||
            err.message ||
            'Failed to load laboratory audit logs'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [tenantId, page, limit, selectedAction, startDate, endDate]
  );

  useEffect(() => {
    fetchAuditLogs(page);
  }, [fetchAuditLogs, page]);

  // Handle filter submit
  const handleApplyFilter = (e) => {
    e.preventDefault();
    setPage(1);
    fetchAuditLogs(1);
  };

  const handleResetFilter = () => {
    setSelectedAction('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  // Helper for action badges
  const renderActionBadge = (action) => {
    if (!action) return <Badge variant="slate">UNKNOWN</Badge>;
    const act = action.toUpperCase();
    if (act.includes('RELEASE')) return <Badge variant="success">{action}</Badge>;
    if (act.includes('APPROVE') || act.includes('VERIFY')) return <Badge variant="teal">{action}</Badge>;
    if (act.includes('REJECT') || act.includes('FAIL') || act.includes('ERROR')) return <Badge variant="danger">{action}</Badge>;
    if (act.includes('DOWNLOAD')) return <Badge variant="purple">{action}</Badge>;
    if (act.includes('CREATE') || act.includes('REGISTER')) return <Badge variant="blue">{action}</Badge>;
    if (act.includes('PAYMENT') || act.includes('BILLING')) return <Badge variant="warning">{action}</Badge>;
    return <Badge variant="slate">{action}</Badge>;
  };

  // Helper for outcome badges
  const renderOutcomeBadge = (outcome) => {
    const norm = (outcome || '').toLowerCase();
    switch (norm) {
      case 'success':
        return <Badge variant="success">Success</Badge>;
      case 'failed':
      case 'error':
        return <Badge variant="danger">Failed</Badge>;
      case 'rejected':
        return <Badge variant="warning">Rejected</Badge>;
      case 'info':
      default:
        return <Badge variant="slate">{outcome || 'Info'}</Badge>;
    }
  };

  return (
    <div className="audit-logs-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <PageHeader
        title="Audit Logs & Compliance Trail"
        description="Immutable record of laboratory operations, report lifecycle events, and compliance actions."
        actions={
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fetchAuditLogs(page)}
            disabled={isLoading}
            title="Refresh audit records"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        }
      />

      <StatusBanner
        type="info"
        badgeText="HIPAA / ISO 15189"
        message="Strict tenant boundary enforced. Sensitive credentials, verification tokens, and clinical findings are redacted from audit responses."
      />

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <form
          onSubmit={handleApplyFilter}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            alignItems: 'flex-end',
          }}
        >
          {/* Action Filter */}
          <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
            <label
              htmlFor="filter-action"
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--slate-600)',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.025em',
              }}
            >
              Action Type
            </label>
            <select
              id="filter-action"
              className="form-control"
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              style={{ fontSize: '0.875rem' }}
            >
              <option value="">All Recorded Actions</option>
              {actionsList.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div style={{ flex: '1 1 150px', minWidth: '150px' }}>
            <label
              htmlFor="filter-start-date"
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--slate-600)',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.025em',
              }}
            >
              From Date
            </label>
            <input
              type="date"
              id="filter-start-date"
              className="form-control"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ fontSize: '0.875rem' }}
            />
          </div>

          {/* End Date */}
          <div style={{ flex: '1 1 150px', minWidth: '150px' }}>
            <label
              htmlFor="filter-end-date"
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--slate-600)',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.025em',
              }}
            >
              To Date
            </label>
            <input
              type="date"
              id="filter-end-date"
              className="form-control"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ fontSize: '0.875rem' }}
            />
          </div>

          {/* Filter Actions */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={isLoading}>
              <Filter size={14} />
              <span>Apply Filters</span>
            </button>
            {(selectedAction || startDate || endDate) && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleResetFilter}
                disabled={isLoading}
              >
                Reset
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Main Audit Records Table Card */}
      <div className="card">
        <div
          className="card-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--slate-200)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={18} style={{ color: 'var(--primary-blue)' }} />
            <span style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: '0.9375rem' }}>
              Recorded Events
            </span>
            <span
              style={{
                background: 'var(--slate-100)',
                color: 'var(--slate-600)',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '12px',
              }}
            >
              {totalCount} total
            </span>
          </div>

          {/* Limit selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem' }}>
            <span style={{ color: 'var(--slate-500)' }}>Per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="form-control"
              style={{ width: '70px', padding: '2px 8px', fontSize: '0.8125rem', height: '28px' }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--slate-500)' }}>
            <Loader2
              size={32}
              className="animate-spin"
              style={{ margin: '0 auto 0.75rem', color: 'var(--primary-blue)' }}
            />
            <p style={{ fontWeight: 500 }}>Retrieving audit trail records...</p>
          </div>
        ) : error ? (
          /* Error State */
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <AlertCircle size={36} style={{ margin: '0 auto 0.5rem', color: 'var(--danger-red, #dc2626)' }} />
            <p style={{ fontWeight: 600, color: 'var(--slate-800)' }}>Failed to load audit logs</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)', marginTop: '4px' }}>{error}</p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => fetchAuditLogs(page)}
              style={{ marginTop: '1rem' }}
            >
              Retry Request
            </button>
          </div>
        ) : logs.length === 0 ? (
          /* Empty State */
          <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--slate-500)' }}>
            <History size={38} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
            <p style={{ fontWeight: 600, color: 'var(--slate-700)', fontSize: '0.9375rem' }}>
              No audit logs recorded
            </p>
            <p style={{ fontSize: '0.8125rem', marginTop: '4px' }}>
              {selectedAction || startDate || endDate
                ? 'No events match the specified filters. Try adjusting your search criteria.'
                : 'As clinical actions and report operations occur in this laboratory, events will be logged here.'}
            </p>
          </div>
        ) : (
          /* Table View */
          <div className="table-container">
            <table className="lms-table">
              <thead>
                <tr>
                  <th style={{ width: '170px' }}>Timestamp</th>
                  <th style={{ width: '220px' }}>User / Actor</th>
                  <th style={{ width: '180px' }}>Action</th>
                  <th>Resource / Ref</th>
                  <th style={{ width: '110px' }}>Outcome</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((item) => {
                  const dateStr = item.timestamp
                    ? new Date(item.timestamp).toLocaleString(undefined, {
                        month: 'short',
                        day: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : '—';

                  const actorEmail = item.actor?.email || null;
                  const actorType = item.actor?.type || 'SYSTEM';

                  return (
                    <tr key={item.eventId || `${item.timestamp}-${item.action}`}>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--slate-600)', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={13} style={{ color: 'var(--slate-400)' }} />
                          <span>{dateStr}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <User size={13} style={{ color: 'var(--slate-400)', flexShrink: 0 }} />
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <div
                              style={{
                                fontWeight: 500,
                                fontSize: '0.8125rem',
                                color: 'var(--slate-800)',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                              }}
                              title={actorEmail || actorType}
                            >
                              {actorEmail || actorType}
                            </div>
                            {actorEmail && (
                              <div style={{ fontSize: '0.6875rem', color: 'var(--slate-400)' }}>
                                {actorType}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{renderActionBadge(item.action)}</td>
                      <td>
                        {item.resource ? (
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              color: 'var(--primary-blue)',
                              background: '#eff6ff',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            {item.resource}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--slate-400)', fontSize: '0.8125rem' }}>—</span>
                        )}
                      </td>
                      <td>{renderOutcomeBadge(item.outcome)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => setSelectedLog(item)}
                          title="View sanitized audit record details"
                          style={{ padding: '4px', borderRadius: '4px', color: 'var(--slate-600)' }}
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-side Pagination Footer */}
        {!isLoading && !error && totalCount > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.875rem 1.25rem',
              borderTop: '1px solid var(--slate-200)',
              fontSize: '0.8125rem',
              color: 'var(--slate-600)',
            }}
          >
            <div>
              Showing{' '}
              <strong>{(page - 1) * limit + 1}</strong> to{' '}
              <strong>{Math.min(page * limit, totalCount)}</strong> of{' '}
              <strong>{totalCount}</strong> entries
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{ padding: '4px 8px' }}
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>

              <span style={{ padding: '0 8px', fontWeight: 500 }}>
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{ padding: '4px 8px' }}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Audit Log Details Modal */}
      {selectedLog && (
        <Modal
          isOpen={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title="Audit Log Event Details"
          maxWidth="640px"
          footer={
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedLog(null)}
            >
              Close
            </button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            {/* Header info */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.75rem',
                background: 'var(--slate-50)',
                padding: '0.875rem',
                borderRadius: 'var(--radius-md, 6px)',
                border: '1px solid var(--slate-200)',
              }}
            >
              <div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                  Event ID
                </div>
                <div style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--slate-800)', marginTop: '2px' }}>
                  {selectedLog.eventId || 'N/A'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                  Timestamp
                </div>
                <div style={{ color: 'var(--slate-800)', marginTop: '2px' }}>
                  {selectedLog.timestamp ? new Date(selectedLog.timestamp).toISOString() : 'N/A'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                  Action
                </div>
                <div style={{ marginTop: '2px' }}>{renderActionBadge(selectedLog.action)}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                  Outcome
                </div>
                <div style={{ marginTop: '2px' }}>{renderOutcomeBadge(selectedLog.outcome)}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                  Actor
                </div>
                <div style={{ color: 'var(--slate-800)', marginTop: '2px' }}>
                  {selectedLog.actor?.email || selectedLog.actor?.type || 'SYSTEM'}
                  {selectedLog.actor?.id && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', display: 'block', fontFamily: 'monospace' }}>
                      ID: {selectedLog.actor.id}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                  Resource
                </div>
                <div style={{ color: 'var(--slate-800)', marginTop: '2px' }}>
                  {selectedLog.resource || '—'}
                </div>
              </div>
            </div>

            {/* Network Client Context */}
            {(selectedLog.ipAddress || selectedLog.userAgent) && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--slate-600)' }}>
                <span style={{ fontWeight: 600, color: 'var(--slate-700)' }}>Origin Client: </span>
                <span>{selectedLog.ipAddress || 'Internal'}</span>
                {selectedLog.userAgent && (
                  <span
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      color: 'var(--slate-400)',
                      marginTop: '2px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={selectedLog.userAgent}
                  >
                    {selectedLog.userAgent}
                  </span>
                )}
              </div>
            )}

            {/* Sanitized Event Metadata */}
            <div>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--slate-600)',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                }}
              >
                Sanitized Metadata
              </div>
              <pre
                style={{
                  background: '#0f172a',
                  color: '#e2e8f0',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  overflowX: 'auto',
                  maxHeight: '220px',
                  fontFamily: 'monospace',
                }}
              >
                {JSON.stringify(selectedLog.metadata || {}, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default AuditLogsPage;
