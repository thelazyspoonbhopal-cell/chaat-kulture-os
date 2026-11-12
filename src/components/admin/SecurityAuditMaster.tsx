import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../lib/db';
import { authRepo } from '../../lib/dal/authRepo';
import type { LoginAuditLog, LoginApprovalRequest, UserSession } from '../../types';
import {
  ShieldAlert,
  MapPin,
  Smartphone,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  AlertTriangle,
  Lock,
  User,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export const SecurityAuditMaster: React.FC = () => {
  const { currentRole, showToast, currentUser } = useApp();

  const [activeTab, setActiveTab] = useState<'audit_logs' | 'approvals' | 'sessions'>('audit_logs');
  const [logs, setLogs] = useState<LoginAuditLog[]>([]);
  const [approvals, setApprovals] = useState<LoginApprovalRequest[]>([]);
  const [activeSessions, setActiveSessions] = useState<UserSession[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allLogs, allReqs, sessions] = await Promise.all([
        authRepo.getAuditLogs(100),
        db.login_approval_requests.orderBy('created_at').reverse().toArray(),
        db.user_sessions.where('is_active').equals(1).reverse().toArray(),
      ]);

      setLogs(allLogs);
      setApprovals(allReqs);
      setActiveSessions(sessions);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Poll every 8 seconds for new login events / approvals
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (req: LoginApprovalRequest) => {
    try {
      await authRepo.reviewApprovalRequest(req.id, 'approved', currentUser?.full_name || 'Super Admin');
      showToast(`Approved login request for ${req.email}`, 'success');
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to approve request', 'error');
    }
  };

  const handleReject = async (req: LoginApprovalRequest) => {
    try {
      await authRepo.reviewApprovalRequest(req.id, 'rejected', currentUser?.full_name || 'Super Admin');
      showToast(`Rejected login request for ${req.email}`, 'info');
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to reject request', 'error');
    }
  };

  const handleTerminateSession = async (session: UserSession) => {
    try {
      await db.user_sessions.update(session.id, {
        is_active: false,
        revoked_at: new Date().toISOString(),
        revocation_reason: 'admin_revoked',
      });
      await authRepo.logAudit({
        user_id: session.user_id,
        email: session.user_email,
        full_name: session.user_name,
        role: session.role,
        status: 'CONCURRENT_SESSION_TERMINATED',
        device_id: session.device_id,
        device_name: session.device_name,
        user_agent: navigator.userAgent,
        notes: `Session remotely terminated by Super Admin (${currentUser?.full_name})`,
      });
      showToast(`Remotely terminated active session for ${session.user_name}`, 'warning');
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to terminate session', 'error');
    }
  };

  const filteredLogs = logs.filter(l => {
    const matchesSearch =
      l.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.full_name && l.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.device_name && l.device_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.location_address && l.location_address.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = filterStatus === 'all' || l.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const pendingApprovalsCount = approvals.filter(a => a.status === 'pending').length;

  const getStatusBadge = (status: LoginAuditLog['status']) => {
    switch (status) {
      case 'SUCCESS':
        return <Badge variant="success">✅ Login Success</Badge>;
      case 'FAILED_CREDENTIALS':
        return <Badge variant="danger">❌ Wrong Password</Badge>;
      case 'BLOCKED_LOCATION_DENIED':
        return <Badge variant="warning">🚫 Location Denied</Badge>;
      case 'CONCURRENT_SESSION_TERMINATED':
        return <Badge variant="purple">📱 Concurrent Session Revoked</Badge>;
      case 'PENDING_APPROVAL':
        return <Badge variant="warning">⏳ Pending Admin Approval</Badge>;
      case 'APPROVED_BY_ADMIN':
        return <Badge variant="success">🛡️ Approved by Admin</Badge>;
      case 'REJECTED_BY_ADMIN':
        return <Badge variant="danger">⛔ Rejected by Admin</Badge>;
      case 'LOGOUT':
        return <Badge variant="default">🚪 Logged Out</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 md:p-5 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-600/20 text-orange-400 flex items-center justify-center font-bold">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">Security & Access Audit Trail</h2>
            {pendingApprovalsCount > 0 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
                {pendingApprovalsCount} Approval Request{pendingApprovalsCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Immutable audit logs capturing user login attempts, exact GPS coordinates, hardware devices, single-device session enforcement, and admin approvals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="text-xs text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold w-fit">
        <button
          onClick={() => setActiveTab('audit_logs')}
          className={`px-4 py-1.5 rounded-lg transition-all ${
            activeTab === 'audit_logs' ? 'bg-orange-600 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          Access & Login Logs ({logs.length})
        </button>
        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
            activeTab === 'approvals' ? 'bg-orange-600 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>Login Approval Requests</span>
          {pendingApprovalsCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 font-bold text-[10px] flex items-center justify-center">
              {pendingApprovalsCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-1.5 rounded-lg transition-all ${
            activeTab === 'sessions' ? 'bg-orange-600 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          Active Sessions ({activeSessions.length})
        </button>
      </div>

      {/* TAB 1: AUDIT LOGS */}
      {activeTab === 'audit_logs' && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search logs by email, staff name, device, or location..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
            >
              <option value="all">All Events</option>
              <option value="SUCCESS">Login Success</option>
              <option value="FAILED_CREDENTIALS">Failed Passwords</option>
              <option value="BLOCKED_LOCATION_DENIED">Location Denied</option>
              <option value="CONCURRENT_SESSION_TERMINATED">Concurrent Sessions Overridden</option>
              <option value="PENDING_APPROVAL">Pending Approvals</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">User / Email</th>
                    <th className="py-3 px-4">Result / Status</th>
                    <th className="py-3 px-4">GPS Location & Address</th>
                    <th className="py-3 px-4">Device & Hardware</th>
                    <th className="py-3 px-4">Audit Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredLogs.map(log => {
                    const mapUrl =
                      log.latitude && log.longitude
                        ? `https://maps.google.com/?q=${log.latitude},${log.longitude}`
                        : null;

                    return (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{log.full_name || 'Anonymous User'}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{log.email}</div>
                          {log.role && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded font-mono">
                              {log.role}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">{getStatusBadge(log.status)}</td>
                        <td className="py-3 px-4">
                          {log.latitude && log.longitude ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1 font-mono text-[11px] text-emerald-400">
                                <MapPin className="w-3 h-3 shrink-0" />
                                <span>{log.latitude.toFixed(4)}°, {log.longitude.toFixed(4)}°</span>
                                {mapUrl && (
                                  <a
                                    href={mapUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-slate-400 hover:text-orange-400 ml-1"
                                    title="Open coordinates in Google Maps"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 block max-w-xs truncate">
                                {log.location_address || 'GPS Coordinates Recorded'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">No GPS (Blocked / Denied)</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-200 flex items-center gap-1">
                            <Smartphone className="w-3 h-3 text-slate-400" />
                            <span>{log.device_name}</span>
                          </div>
                          <span className="font-mono text-[10px] text-slate-500">ID: {log.device_id}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px] max-w-xs">
                          {log.notes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PENDING APPROVALS */}
      {activeTab === 'approvals' && (
        <div className="space-y-3">
          {approvals.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
              No login approval requests found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {approvals.map(req => {
                const isPending = req.status === 'pending';

                return (
                  <div
                    key={req.id}
                    className={`bg-slate-900 border p-4 rounded-2xl space-y-3 ${
                      isPending ? 'border-amber-500/50 shadow-lg shadow-amber-950/20' : 'border-slate-800 opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-white text-sm">{req.full_name}</div>
                        <div className="text-xs text-orange-400 font-mono">{req.email}</div>
                        <span className="text-[10px] text-slate-500 uppercase font-mono">{req.role}</span>
                      </div>
                      <Badge variant={isPending ? 'warning' : req.status === 'approved' ? 'success' : 'danger'}>
                        {req.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl space-y-1 text-xs">
                      <span className="text-slate-400 font-semibold block text-[11px]">Staff Request Reason:</span>
                      <p className="text-slate-200 italic">{req.reason}</p>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center justify-between font-mono">
                      <span>Device: {req.device_name}</span>
                      <span>{new Date(req.created_at).toLocaleString()}</span>
                    </div>

                    {isPending && (
                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReject(req)}
                          className="text-rose-400 hover:bg-rose-950/30"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          <span>Reject Access</span>
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleApprove(req)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          <span>Approve Login</span>
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ACTIVE SESSIONS */}
      {activeTab === 'sessions' && (
        <div className="space-y-3">
          <div className="p-3 bg-blue-950/40 border border-blue-800/60 rounded-xl text-xs text-blue-300 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              <strong>Single-Device Enforcement:</strong> Chaat Kulture OS allows only 1 active session per user. If a
              staff member logs in on another device, their previous session is immediately terminated.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeSessions.map(sess => (
              <div
                key={sess.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-white text-xs">
                      <User className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-xs">{sess.user_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{sess.user_email}</div>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold px-2 py-0.5 bg-emerald-950/60 rounded-md border border-emerald-800/60">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Online</span>
                  </span>
                </div>

                <div className="text-[11px] text-slate-300 space-y-1 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Device:</span>
                    <span className="font-semibold text-white">{sess.device_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Login GPS:</span>
                    <span className="font-mono text-emerald-400">{sess.location_address || 'Coordinates Recorded'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Logged In:</span>
                    <span className="font-mono text-slate-400">{new Date(sess.login_at).toLocaleTimeString()}</span>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTerminateSession(sess)}
                    className="text-rose-400 hover:bg-rose-950/40 text-xs"
                    title="Force terminate this active session"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    <span>Force Terminate Session</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
