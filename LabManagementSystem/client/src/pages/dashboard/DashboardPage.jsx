/**
 * Lab Management System (LMS) - Laboratory Operations Dashboard
 * 
 * Scoped strictly to the authenticated tenant and dynamically tailored
 * to the staff user's active role:
 * - Lab Administrator (Comprehensive clinical, staff & financial overview)
 * - Receptionist (Patient intake, order creation, specimen status)
 * - Accountant (Invoicing, payments, accounts receivable)
 * - Lab Technician (Specimen queue, analyzer runs, test catalog)
 * - Consultant Pathologist / Approver (Report review queue, verification)
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  ClipboardList,
  FlaskConical,
  TestTube2,
  FileCheck2,
  FileText,
  CreditCard,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Microscope,
  ShieldCheck,
  Building2,
  Sparkles,
  Calendar,
  Timer,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import Badge from '../../components/common/Badge';
import StatusBanner from '../../components/common/StatusBanner';
import Modal from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import api from '../../services/api';

export function DashboardPage() {
  const { user, isSuperAdmin } = useAuth();
  const { tenant, branding } = useTenant();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const tenantId = user?.tenantId || tenant?.tenantId;
  const userRole = (user?.role || 'lab_admin').toLowerCase();
  const roleDef = user?.roleDefinition || null;
  const rolePermissions = user?.permissions || roleDef?.permissions || [];
  const isLabAdmin =
    userRole === 'lab_admin' ||
    userRole === 'lab_director' ||
    rolePermissions.includes('*') ||
    isSuperAdmin;

  // Dynamic permission checker helper
  const hasPermission = (required) => {
    if (isLabAdmin) return true;
    if (rolePermissions.includes('*')) return true;
    if (Array.isArray(required)) {
      return required.some((perm) => rolePermissions.includes(perm));
    }
    return rolePermissions.includes(required);
  };

  useEffect(() => {
    let isMounted = true;

    async function fetchDashboard() {
      if (!tenantId || isSuperAdmin) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await api.get(`/tenants/${tenantId}/dashboard-summary`, {
          params: { timezone: clientTimezone },
        });
        if (isMounted && res.data?.success) {
          setDashboardData(res.data.data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.message || 'Failed to retrieve live dashboard summary');
        }
        console.warn('Dashboard summary live fetch fallback:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchDashboard();
    return () => { isMounted = false; };
  }, [tenantId, isSuperAdmin]);

  const metrics = dashboardData?.metrics || {
    todayOrders: 0,
    pendingOrders: 0,
    samplesCollected: 0,
    reportsReleased: 0,
    totalPatients: 0,
    totalOrders: 0,
    pendingCollectionSamples: 0,
    inAnalysisSamples: 0,
    pendingReviewReports: 0,
    releasedReports: 0,
    totalRevenue: 0,
    totalOutstanding: 0,
  };

  const todaySummary = dashboardData?.todaySummary || {
    todayOrders: metrics.todayOrders ?? 0,
    pendingOrders: metrics.pendingOrders ?? 0,
    samplesCollected: metrics.samplesCollected ?? 0,
    reportsReleased: metrics.reportsReleased ?? 0,
    averageTatMinutes: metrics.averageTatMinutes ?? null,
    formattedTat: metrics.formattedTat || 'N/A',
    tatReportCount: metrics.tatReportCount ?? 0,
    date: new Date().toLocaleDateString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  const recentOrders = dashboardData?.recentOrders || [];

  // Determine role-tailored view title, description & badge
  const getRoleHeaderInfo = () => {
    const roleDisplayName = roleDef?.name || (user?.role ? user.role.replace(/_/g, ' ') : 'Laboratory Operations');
    const roleDescription = roleDef?.description || (
      isLabAdmin
        ? 'Real-time multi-department operational overview, specimen throughput, and clinical metrics.'
        : `Role-scoped clinical and operational workspace for ${roleDisplayName}.`
    );
    const labName = branding?.displayName || tenant?.name || 'Laboratory';

    return {
      title: `${labName} • ${roleDisplayName}`,
      description: roleDescription,
      badge: roleDisplayName,
    };
  };

  const headerInfo = getRoleHeaderInfo();

  // Role-specific Metric Cards dynamically tailored to granted permissions
  const renderRoleCards = () => {
    const cards = [];

    // Staff metric (if role has users:view)
    if (hasPermission('users:view')) {
      cards.push(
        <StatCard
          key="staff"
          title="Total Staff"
          value={metrics.totalStaff ?? dashboardData?.staff?.length ?? 0}
          subtitle="Registered team members"
          icon={Users}
          colorScheme="blue"
        />
      );
    }

    // Patient metric (if role has patients:view)
    if (hasPermission('patients:view')) {
      cards.push(
        <StatCard
          key="patients"
          title="Total Registered Patients"
          value={metrics.totalPatients}
          subtitle="Accessioned directory profiles"
          icon={Users}
          colorScheme="cyan"
        />
      );
    }

    // Lab Orders metrics (if role has orders:view)
    if (hasPermission('orders:view')) {
      cards.push(
        <StatCard
          key="orders"
          title="Total Lab Orders"
          value={metrics.totalOrders}
          subtitle="Requisitions logged"
          icon={ClipboardList}
          colorScheme="purple"
        />
      );
      cards.push(
        <StatCard
          key="today-pending-orders"
          title="Pending Orders"
          value={todaySummary.pendingOrders ?? metrics.pendingOrders ?? 0}
          subtitle="Awaiting sample or processing"
          icon={Clock}
          colorScheme="amber"
        />
      );
    }

    // Specimen / Sample metrics (if role has samples:view, samples:collect, or samples:process)
    if (hasPermission(['samples:view', 'samples:collect', 'samples:process'])) {
      cards.push(
        <StatCard
          key="pending-samples"
          title="Samples Awaiting Draw"
          value={metrics.pendingCollectionSamples}
          subtitle="Pending phlebotomy intake"
          icon={FlaskConical}
          colorScheme="amber"
        />
      );
      cards.push(
        <StatCard
          key="analysis-samples"
          title="In Analyzer Analysis"
          value={metrics.inAnalysisSamples}
          subtitle="Active instrument runs"
          icon={TestTube2}
          colorScheme="purple"
        />
      );
    }

    // Reports / Review metrics (if role has reports:view, reports:create, reports:verify, or reports:release)
    if (hasPermission(['reports:view', 'reports:create', 'reports:verify', 'reports:release'])) {
      cards.push(
        <StatCard
          key="pending-reports"
          title="Pending Sign-off"
          value={metrics.pendingReviewReports}
          subtitle="Pathologist review queue"
          icon={FileText}
          colorScheme="red"
        />
      );
      cards.push(
        <StatCard
          key="released-reports"
          title="Released Reports"
          value={metrics.releasedReports}
          subtitle="Signed diagnostic findings"
          icon={FileCheck2}
          colorScheme="green"
        />
      );
    }

    // Billing / Financial metrics (if role has billing:view)
    if (hasPermission('billing:view')) {
      cards.push(
        <StatCard
          key="revenue"
          title="Settled Revenue"
          value={`$${metrics.totalRevenue.toLocaleString()}`}
          subtitle="Recorded receipts"
          icon={CreditCard}
          colorScheme="teal"
        />
      );
      cards.push(
        <StatCard
          key="outstanding"
          title="Outstanding Balance"
          value={`$${metrics.totalOutstanding.toLocaleString()}`}
          subtitle="Accounts receivable"
          icon={AlertTriangle}
          colorScheme="slate"
        />
      );
    }

    // If no clinical metrics cards match this custom role, show clean workstation banner
    if (cards.length === 0) {
      return (
        <div
          style={{
            gridColumn: '1 / -1',
            background: 'white',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'var(--primary-50)',
              color: 'var(--primary-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={26} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--slate-900)', margin: '0 0 4px 0' }}>
              Laboratory Workstation • {headerInfo.badge}
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--slate-600)', margin: 0 }}>
              Your workspace is active. Use the sidebar navigation to access your authorized laboratory functions ({roleDef?.navigationItems?.join(', ') || 'dashboard'}).
            </p>
          </div>
        </div>
      );
    }

    return cards;
  };

  const workflowSteps = [
    { name: '1. Order Entry', count: `${metrics.totalOrders} Orders`, status: 'completed' },
    { name: '2. Phlebotomy', count: `${metrics.pendingCollectionSamples} Pending`, status: 'current' },
    { name: '3. Analysis', count: `${metrics.inAnalysisSamples} In Progress`, status: 'current' },
    { name: '4. Pathologist Review', count: `${metrics.pendingReviewReports} Queue`, status: 'pending' },
    { name: '5. Diagnostic Release', count: `${metrics.releasedReports} Released`, status: 'completed' },
  ];

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'stat': return <Badge variant="danger">STAT</Badge>;
      case 'urgent': return <Badge variant="warning">Urgent</Badge>;
      default: return <Badge variant="slate">Routine</Badge>;
    }
  };

  const getStaffRoleBadge = (role = '') => {
    const r = String(role).toLowerCase();
    switch (r) {
      case 'lab_admin':
        return <Badge variant="purple">Lab Administrator</Badge>;
      case 'pathologist':
      case 'report_reviewer':
        return <Badge variant="blue">Pathologist</Badge>;
      case 'lab_technician':
        return <Badge variant="cyan">Lab Technician</Badge>;
      case 'receptionist':
        return <Badge variant="teal">Receptionist</Badge>;
      case 'phlebotomist':
        return <Badge variant="warning">Phlebotomist</Badge>;
      case 'billing_clerk':
      case 'accountant':
        return <Badge variant="info">Billing Clerk</Badge>;
      default:
        return <Badge variant="slate">{role.replace(/_/g, ' ')}</Badge>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'in_analysis': return <Badge variant="purple">In Analysis</Badge>;
      case 'awaiting_verification': return <Badge variant="warning">Verification Req.</Badge>;
      case 'released': return <Badge variant="success">Released</Badge>;
      case 'samples_pending': return <Badge variant="cyan">Sample Pending</Badge>;
      case 'registered': return <Badge variant="blue">Registered</Badge>;
      default: return <Badge variant="slate">{status || 'Active'}</Badge>;
    }
  };

  return (
    <>
      <PageHeader
        title={headerInfo.title}
        description={headerInfo.description}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {hasPermission(['patients:create', 'orders:create']) && (
              <Link
                to="/patients?register=true"
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Users size={14} />
                <span>New Patient Intake & Order</span>
              </Link>
            )}
            {hasPermission(['samples:collect', 'samples:process']) && (
              <Link
                to="/samples"
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <FlaskConical size={14} />
                <span>Specimens</span>
              </Link>
            )}
            {hasPermission(['reports:create', 'reports:verify']) && (
              <Link
                to="/reports"
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <FileText size={14} />
                <span>Diagnostic Reports</span>
              </Link>
            )}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                background: 'var(--mint-bg)',
                color: 'var(--mint-text)',
                border: '1px solid var(--mint-200)',
              }}
            >
              <ShieldCheck size={14} />
              <span>{headerInfo.badge}</span>
            </span>
          </div>
        }
      />

      {/* Tenant Context Notice */}
      <StatusBanner
        type="info"
        badgeText={`Tenant: ${tenant?.code || 'ACTIVE'}`}
        message={`Operations scoped strictly to ${branding?.displayName || tenant?.name || 'this laboratory'}. Super Admin and cross-tenant clinical interference is blocked at the database tier.`}
      />

      {/* Error banner if live fetch failed */}
      {error && (
        <div style={{ marginBottom: '1rem' }}>
          <StatusBanner type="warning" badgeText="Notice" message={error} />
        </div>
      )}

      {/* Today's Lab Orders Summary Section */}
      {hasPermission(['orders:view', 'samples:view', 'reports:view']) && (
        <section style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} style={{ color: 'var(--primary-blue)' }} />
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--slate-800)', margin: 0 }}>
              Today's Lab Orders Summary
            </h2>
          </div>
          {todaySummary?.date && (
            <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontFamily: 'monospace' }}>
              Calendar Day: {todaySummary.date} {todaySummary.timeZone ? `(${todaySummary.timeZone})` : ''}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '1.25rem' }}>
          <StatCard
            title="Today's Total Orders"
            value={loading ? '...' : (todaySummary.todayOrders ?? 0)}
            subtitle="Requisitions logged today"
            icon={ClipboardList}
            colorScheme="blue"
          />
          <StatCard
            title="Pending Orders"
            value={loading ? '...' : (todaySummary.pendingOrders ?? 0)}
            subtitle="Ordered / in progress today"
            icon={Clock}
            colorScheme="amber"
          />
          <StatCard
            title="Samples Collected"
            value={loading ? '...' : (todaySummary.samplesCollected ?? 0)}
            subtitle="Specimens drawn today"
            icon={FlaskConical}
            colorScheme="teal"
          />
          <StatCard
            title="Reports Released"
            value={loading ? '...' : (todaySummary.reportsReleased ?? 0)}
            subtitle="Diagnostic releases today"
            icon={CheckCircle2}
            colorScheme="green"
          />
          <StatCard
            title="Average Report TAT Today"
            value={loading ? '...' : (todaySummary.formattedTat || 'N/A')}
            subtitle={
              todaySummary.tatReportCount > 0
                ? `Across ${todaySummary.tatReportCount} released report${todaySummary.tatReportCount === 1 ? '' : 's'}`
                : 'No released reports with valid timestamps'
            }
            icon={Timer}
            colorScheme="purple"
          />
        </div>
      </section>
      )}

      {/* Role-Specific Metrics Grid */}
      <section>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '1.25rem' }}>
          {renderRoleCards()}
        </div>
      </section>

      {/* Laboratory Workflow Pipeline Summary */}
      {hasPermission(['samples:view', 'samples:process', 'orders:view', 'reports:view']) && (
        <section className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Microscope size={18} style={{ color: 'var(--primary-600)' }} />
              <h2 className="card-title">Laboratory Specimen Pipeline</h2>
            </div>
            <span className="badge badge-teal">Live Tenant Pipeline</span>
          </div>

          <div className="workflow-pipeline">
            {workflowSteps.map((step) => (
              <div
                key={step.name}
                className={`workflow-step ${step.status === 'completed' ? 'completed' : ''} ${step.status === 'current' ? 'current' : ''}`}
              >
                <div className="workflow-icon-bubble">
                  {step.status === 'completed' ? (
                    <CheckCircle2 size={20} />
                  ) : step.status === 'current' ? (
                    <FlaskConical size={20} />
                  ) : (
                    <Clock size={20} />
                  )}
                </div>
                <span className="workflow-step-name">{step.name}</span>
                <span className="workflow-step-count">{step.count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Activity Table */}
      {hasPermission('orders:view') && (
        <section className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ClipboardList size={18} style={{ color: 'var(--primary-600)' }} />
              <h2 className="card-title">Recent Laboratory Activity</h2>
            </div>
            <span className="badge badge-blue">
              {recentOrders.length} {recentOrders.length === 1 ? 'Record' : 'Records'}
            </span>
          </div>

          <div className="table-container">
            <table className="lms-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Patient / MRN</th>
                  <th>Diagnostic Tests</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--slate-500)' }}>
                      No recent orders in this laboratory yet. Use the sidebar to create new requisitions.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((order) => (
                    <tr key={order.orderId || order.orderNumber}>
                      <td>
                        <strong style={{ color: 'var(--primary-700)', fontFamily: 'monospace' }}>
                          {order.orderNumber}
                        </strong>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{order.patientName}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{order.patientMrn}</span>
                        </div>
                      </td>
                      <td style={{ maxWidth: '240px' }}>
                        {order.tests?.map((t) => t.name || t.testCode).join(', ') || 'Diagnostic Panel'}
                      </td>
                      <td>{getPriorityBadge(order.priority)}</td>
                      <td>{getStatusBadge(order.status)}</td>
                      <td>
                        <span className={`badge ${order.paymentStatus === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                          {order.paymentStatus || 'unpaid'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="btn btn-secondary btn-sm"
                          title="Inspect order details"
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Laboratory Staff & Team Members Section */}
      {hasPermission('users:view') && (
        <section className="card" style={{ marginTop: '1.25rem' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} style={{ color: 'var(--primary-blue, #2563eb)' }} />
              <h2 className="card-title">
                Laboratory Staff & Team Directory ({dashboardData?.staff?.length || 0})
              </h2>
            </div>
            <Link to="/users" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span>Manage Staff & Roles</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="table-container">
            <table className="lms-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Email</th>
                  <th>Assigned Role</th>
                  <th>Department / Phone</th>
                  <th>Status</th>
                  <th>Joined Date</th>
                </tr>
              </thead>
              <tbody>
                {!dashboardData?.staff || dashboardData.staff.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--slate-500)' }}>
                      No staff members registered for this laboratory yet. Use "Manage Staff & Roles" to add new team members.
                    </td>
                  </tr>
                ) : (
                  dashboardData.staff.map((member) => (
                    <tr key={member.userId || member.email}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--primary-subtle, #eff6ff)',
                              color: 'var(--primary-blue, #2563eb)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 600,
                              fontSize: '0.85rem',
                            }}
                          >
                            {(member.fullName || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main, #1e293b)', fontSize: '0.9rem' }}>
                              {member.fullName}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontFamily: 'monospace' }}>
                              {member.userId || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-main, #334155)' }}>
                          {member.email}
                        </span>
                      </td>
                      <td>
                        {getStaffRoleBadge(member.role)}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted, #64748b)' }}>
                          {member.department ? <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{member.department}</span> : null}
                          {member.department && member.phone ? ' • ' : ''}
                          {member.phone || (!member.department ? '—' : '')}
                        </div>
                      </td>
                      <td>
                        <Badge variant={member.isActive !== false ? 'success' : 'slate'}>
                          {member.isActive !== false ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', whiteSpace: 'nowrap' }}>
                        {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Order Details Modal */}
      <Modal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `Order Details: ${selectedOrder.orderNumber}` : ''}
        footer={
          <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>
            Close
          </button>
        }
      >
        {selectedOrder && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Patient Name</p>
                <p style={{ fontWeight: 600 }}>{selectedOrder.patientName}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Medical Record #</p>
                <p style={{ fontWeight: 600 }}>{selectedOrder.patientMrn}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Ordering Physician</p>
                <p>{selectedOrder.physicianName || 'Attending Physician'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Order Priority</p>
                <div>{getPriorityBadge(selectedOrder.priority)}</div>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Status</p>
                <div>{getStatusBadge(selectedOrder.status)}</div>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Payment Status</p>
                <p style={{ textTransform: 'uppercase', fontWeight: 600 }}>{selectedOrder.paymentStatus || 'unpaid'}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default DashboardPage;
