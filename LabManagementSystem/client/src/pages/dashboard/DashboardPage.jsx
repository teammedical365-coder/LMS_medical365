/**
 * Lab Management System (LMS) - Laboratory Operations & Workstation Overview
 * 
 * Clean Overview Dashboard:
 * 1. Welcome / Time-based greeting banner with tenant branding and role info.
 * 2. Role-scoped live metric stat cards.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  ClipboardList,
  Clock,
  IndianRupee,
  CreditCard,
  FlaskConical,
  TestTube2,
  FileText,
  FileCheck2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Calendar,
  X,
  CheckCircle2,
} from 'lucide-react';
import StatCard from '../../components/common/StatCard';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import api from '../../services/api';

export function DashboardPage() {
  const { user, isSuperAdmin } = useAuth();
  const { tenant, branding } = useTenant();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

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

  const isReceptionist =
    userRole === 'receptionist' ||
    userRole === 'front_desk' ||
    userRole === 'clerk' ||
    userRole === 'reception';

  const fetchDashboard = useCallback(async () => {
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
      if (res.data?.success) {
        setDashboardData(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retrieve live dashboard summary');
      console.warn('Dashboard summary live fetch fallback:', err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId, isSuperAdmin]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

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
  };

  // Dynamic Time-Based Greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const userName = user?.fullName || user?.name || user?.username || 'Team';
  const roleDisplayName = roleDef?.name || (user?.role ? user.role.replace(/_/g, ' ') : 'Staff');
  const labName = branding?.displayName || tenant?.name || 'JaipurLab';
  const labCode = tenant?.code || user?.tenantCode || null;

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Role-specific Metric Cards dynamically tailored to granted permissions
  const renderRoleCards = () => {
    const cards = [];

    // Dedicated Receptionist & Front Desk Stat Cards
    if (isReceptionist) {
      cards.push(
        <StatCard
          key="patients"
          title="Registered Patients"
          value={metrics.totalPatients}
          subtitle="Total directory profiles"
          icon={Users}
          colorScheme="cyan"
        />
      );
      cards.push(
        <StatCard
          key="today-orders"
          title="Today's Bookings"
          value={todaySummary.todayOrders ?? metrics.todayOrders ?? 0}
          subtitle="Requisitions logged today"
          icon={ClipboardList}
          colorScheme="blue"
        />
      );
      cards.push(
        <StatCard
          key="pending-orders"
          title="Pending Processing"
          value={todaySummary.pendingOrders ?? metrics.pendingOrders ?? 0}
          subtitle="In pipeline or phlebotomy"
          icon={Clock}
          colorScheme="amber"
        />
      );
      cards.push(
        <StatCard
          key="revenue"
          title="Settled Collections"
          value={`₹${(metrics.totalRevenue || 0).toLocaleString()}`}
          subtitle="Recorded receipts"
          icon={IndianRupee}
          colorScheme="teal"
        />
      );
      cards.push(
        <StatCard
          key="outstanding"
          title="Outstanding Ledger"
          value={`₹${(metrics.totalOutstanding || 0).toLocaleString()}`}
          subtitle="Pending patient balance"
          icon={CreditCard}
          colorScheme="orange"
        />
      );
      return cards;
    }

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

    if (!isReceptionist && hasPermission(['samples:view', 'samples:collect', 'samples:process'])) {
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

    if (!isReceptionist && hasPermission(['reports:view', 'reports:create', 'reports:verify', 'reports:release'])) {
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

    if (hasPermission('billing:view')) {
      cards.push(
        <StatCard
          key="revenue"
          title="Settled Revenue"
          value={`₹${(metrics.totalRevenue || 0).toLocaleString()}`}
          subtitle="Recorded receipts"
          icon={CreditCard}
          colorScheme="teal"
        />
      );
      cards.push(
        <StatCard
          key="outstanding"
          title="Outstanding Balance"
          value={`₹${(metrics.totalOutstanding || 0).toLocaleString()}`}
          subtitle="Accounts receivable"
          icon={AlertTriangle}
          colorScheme="slate"
        />
      );
    }

    return cards;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Welcome / Time-based Pastel Medical Hero Banner */}
      <div
        className="overview-hero-banner overview-hero-banner-flush"
        style={{
          background: 'linear-gradient(135deg, #e0f2fe 0%, #ecfdf5 45%, #f0fdf4 100%)',
          borderRadius: '0 0 16px 16px',
          padding: '1.5rem 1.75rem',
          color: '#0f172a',
          boxShadow: '0 4px 20px -2px rgba(2, 132, 199, 0.08), 0 2px 6px rgba(16, 185, 129, 0.05)',
          position: 'relative',
          overflow: 'hidden',
          borderBottom: '1.5px solid #bae6fd',
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none',
        }}
      >
        {/* Soft pastel ambient lighting orbs */}
        <div
          style={{
            position: 'absolute',
            top: '-50%',
            right: '-10%',
            width: '380px',
            height: '380px',
            background: 'radial-gradient(circle, rgba(167, 243, 208, 0.45) 0%, rgba(224, 242, 254, 0) 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-50%',
            left: '20%',
            width: '320px',
            height: '320px',
            background: 'radial-gradient(circle, rgba(186, 230, 253, 0.4) 0%, rgba(240, 253, 244, 0) 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.45rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)',
                  border: '1px solid #bfdbfe',
                  borderRadius: '20px',
                  padding: '3px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#1d4ed8',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.08)',
                }}
              >
                <Sparkles size={12} color="#2563eb" />
                <span>{labName}</span>
                {labCode && <span style={{ opacity: 0.7 }}>• {labCode}</span>}
              </span>

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: 'white',
                  border: '1px solid #cbd5e1',
                  borderRadius: '20px',
                  padding: '3px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#059669',
                }}
              >
                <ShieldCheck size={12} color="#059669" />
                <span style={{ textTransform: 'capitalize' }}>{roleDisplayName}</span>
              </span>

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: 'white',
                  border: '1px solid #cbd5e1',
                  borderRadius: '20px',
                  padding: '3px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: '#64748b',
                }}
              >
                <Calendar size={12} color="#64748b" />
                <span>{formattedDate}</span>
              </span>
            </div>

            <h1
              style={{
                fontSize: 'clamp(1.4rem, 2.5vw, 1.85rem)',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 50%, #0d9488 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1.25,
                margin: '0 0 0.35rem 0',
                letterSpacing: '-0.02em',
              }}
            >
              {getGreeting()}, {userName}! 👋
            </h1>

            <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569', lineHeight: 1.45, maxWidth: '640px' }}>
              Welcome back to {labName}. Here is your live laboratory overview and operational summary today.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <button
              onClick={fetchDashboard}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#334155',
                fontWeight: 600,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                boxShadow: '0 2px 5px rgba(15, 23, 42, 0.05)',
                transition: 'all 0.15s ease',
              }}
              title="Refresh dashboard metrics"
            >
              <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Feedback Banner */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} />
            <span style={{ fontSize: '0.875rem' }}>{error}</span>
          </div>
          <button onClick={() => setError(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#991b1b' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Success Feedback Banner */}
      {successBanner && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} />
            <span style={{ fontSize: '0.875rem' }}>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#166534' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* 2. Live Operational Metric Cards Grid */}
      <section>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '1.25rem' }}>
          {renderRoleCards()}
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;
