/**
 * Lab Management System (LMS) - Platform Super Admin Laboratories Directory
 * Medical365 Aesthetic: White rounded cards, light borders, crisp typography, and filterable tables
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  PlusCircle,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Server,
  Layers,
  Copy,
  Sparkles,
  Globe,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Badge from '../../components/common/Badge';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import AdminSecurityBoundary from '../../components/common/AdminSecurityBoundary';
import superAdminService from '../../services/superAdminService';

export function LaboratoriesPage() {
  const [laboratories, setLaboratories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [provFilter, setProvFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const copyPortalUrl = (url, labId) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    setCopiedId(labId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchLabs = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await superAdminService.listLaboratories({
        page: currentPage,
        limit: 10,
        q: searchQuery,
        status: statusFilter,
        provisioningStatus: provFilter,
      });
      setLaboratories(result.laboratories || []);
      setPagination(result.pagination || { page: currentPage, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to retrieve laboratories';
      const status = err.response?.status;
      setError({ message: msg, status });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLabs();
  }, [currentPage, statusFilter, provFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchLabs();
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Active</Badge>;
      case 'PENDING':
        return <Badge variant="amber">Pending</Badge>;
      case 'SUSPENDED':
        return <Badge variant="purple">Suspended</Badge>;
      case 'INACTIVE':
        return <Badge variant="slate">Inactive</Badge>;
      default:
        return <Badge variant="slate">{status}</Badge>;
    }
  };

  const getProvisioningBadge = (status) => {
    switch (status) {
      case 'READY':
        return <Badge variant="teal">Ready</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="blue">Provisioning</Badge>;
      case 'FAILED':
        return <Badge variant="danger">Failed</Badge>;
      case 'NOT_STARTED':
      default:
        return <Badge variant="slate">Not Started</Badge>;
    }
  };

  return (
    <>
      <PageHeader
        title="Laboratory Registry & Tenant Provisioning"
        description="Master catalog of healthcare diagnostic facilities, tenant lifecycle states, and dedicated database provisioning."
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={fetchLabs} title="Refresh directory">
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
            <Link to="/super-admin/laboratories/new" className="btn btn-primary">
              <PlusCircle size={16} />
              <span>Register New Laboratory</span>
            </Link>
          </div>
        }
      />

      {/* Multi-Tenant Whitelabel Portal Architecture Banner */}
      <div
        style={{
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: 'var(--radius-md)',
          padding: '0.875rem 1.25rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <Sparkles size={20} style={{ color: '#0284c7', flexShrink: 0 }} />
        <div style={{ fontSize: '0.8125rem', color: '#0369a1', lineHeight: 1.45 }}>
          <strong>Multi-Tenant Whitelabel Architecture:</strong> Root login (<code>/login</code>) is exclusively for Platform Super Admins. Each laboratory below has a dedicated, generated whitelabel URL. Share that URL with the Lab Administrator and staff for direct, isolated sign-in.
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div style={{ flex: '1 1 280px', position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search by laboratory name, code, email, or tenant ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.25rem' }}
            />
            <Search
              size={16}
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: 'auto', minWidth: '150px' }}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PENDING">PENDING</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>

            <select
              className="form-select"
              value={provFilter}
              onChange={(e) => {
                setProvFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: 'auto', minWidth: '170px' }}
            >
              <option value="">All Database States</option>
              <option value="READY">READY</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="FAILED">FAILED</option>
              <option value="NOT_STARTED">NOT_STARTED</option>
            </select>

            <button type="submit" className="btn btn-primary">
              <Filter size={14} />
              <span>Filter</span>
            </button>
          </div>
        </form>
      </div>

      {/* Main Content State */}
      {loading ? (
        <LoadingState message="Querying master multi-tenant registry..." />
      ) : error && (error.status === 401 || error.status === 403) ? (
        <AdminSecurityBoundary errorDetails={error.message} />
      ) : error ? (
        <ErrorState title="Registry Query Failed" message={error.message} onRetry={fetchLabs} />
      ) : laboratories.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No Laboratories Found"
            message={
              searchQuery || statusFilter || provFilter
                ? 'No registered laboratories matched your filter criteria. Try adjusting your query parameters.'
                : 'No diagnostic laboratories have been onboarded to this multi-tenant platform yet.'
            }
            action={
              <Link to="/super-admin/laboratories/new" className="btn btn-primary">
                <PlusCircle size={15} />
                <span>Onboard First Laboratory</span>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="lms-table">
              <thead>
                <tr>
                  <th>Laboratory & Code</th>
                  <th>Lab Administrator</th>
                  <th>Staff Team</th>
                  <th>Tenant Identifier</th>
                  <th>Portal Login URL</th>
                  <th>Contact Info</th>
                  <th>Status</th>
                  <th>Database State</th>
                  <th>Registered</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {laboratories.map((lab) => {
                  const provStatus = lab.database?.provisioningStatus || lab.provisioningStatus || 'NOT_STARTED';
                  const primaryDomain = lab.domainMappings?.find((d) => d.isPrimary)?.domain || lab.domainMappings?.[0]?.domain;
                  const labSlug = (lab.code || lab.tenantId || '').toLowerCase();
                  const portalUrl = `${window.location.origin}/lab/${lab.code.toLowerCase()}`;

                  return (
                    <tr key={lab.tenantId || lab._id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{lab.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--primary-700)', background: 'var(--primary-50)', padding: '1px 6px', borderRadius: '4px' }}>
                              {lab.code}
                            </span>
                            {primaryDomain && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>
                                ({primaryDomain})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        {lab.adminUser ? (
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--slate-900)', fontSize: '0.8125rem' }}>
                              {lab.adminUser.fullName}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>
                              {lab.adminUser.email}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>—</span>
                        )}
                      </td>

                      <td>
                        <Badge variant="blue">
                          {(lab.staffCount ?? lab.staff?.length ?? 0)} Staff
                        </Badge>
                      </td>

                      <td>
                        <code style={{ fontSize: '0.75rem', color: 'var(--slate-600)', background: 'var(--slate-100)', padding: '2px 6px', borderRadius: '4px' }}>
                          {lab.tenantId}
                        </code>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <a
                            href={`/lab/${lab.code.toLowerCase()}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                              color: 'var(--primary-700)',
                              background: 'var(--primary-50)',
                              border: '1px solid var(--primary-200)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 600,
                            }}
                            title="Open Laboratory Login Portal in new tab"
                          >
                            <span>/lab/{lab.code.toLowerCase()}</span>
                            <ExternalLink size={11} />
                          </a>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 8px', fontSize: '0.72rem', height: '24px' }}
                            onClick={() => copyPortalUrl(portalUrl, lab.tenantId || lab._id)}
                            title="Copy Login Portal URL"
                          >
                            {copiedId === (lab.tenantId || lab._id) ? (
                              <span style={{ color: '#059669', fontWeight: 600 }}>Copied!</span>
                            ) : (
                              <>
                                <Copy size={11} />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8125rem' }}>
                          <span style={{ color: 'var(--slate-700)' }}>{lab.contactEmail || lab.email}</span>
                          {(lab.contactPhone || lab.phone) && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>{lab.contactPhone || lab.phone}</span>
                          )}
                        </div>
                      </td>

                      <td>{getStatusBadge(lab.status)}</td>

                      <td>{getProvisioningBadge(provStatus)}</td>

                      <td style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                        {new Date(lab.createdAt).toLocaleDateString()}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <Link
                          to={`/super-admin/laboratories/${lab.tenantId || lab._id}`}
                          className="btn btn-secondary btn-sm"
                          style={{ gap: '4px' }}
                        >
                          <span>Manage</span>
                          <ExternalLink size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.875rem 1.25rem',
                borderTop: '1px solid var(--border-subtle)',
                background: '#f8fafc',
                fontSize: '0.8125rem',
              }}
            >
              <span style={{ color: 'var(--slate-600)' }}>
                Showing page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} laboratories)
              </span>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default LaboratoriesPage;
