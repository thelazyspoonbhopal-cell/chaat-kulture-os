import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { authRepo, type LoginResult } from '../../lib/dal/authRepo';
import { usersRepo } from '../../lib/dal/usersRepo';
import type { UserProfile } from '../../types';
import { authSecurity, type GeoLocationResult } from '../../lib/security/authSecurity';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import {
  Lock,
  Mail,
  KeyRound,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  Smartphone,
  Eye,
  EyeOff,
  Send,
  CheckCircle2,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { showToast, refreshData, login } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [showAccountsHelper, setShowAccountsHelper] = useState(false);

  // Geolocation state
  const [locationStatus, setLocationStatus] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('prompt');
  const [coords, setCoords] = useState<GeoLocationResult | null>(null);

  // Approval Modal State
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [approvalReason, setApprovalReason] = useState('');
  const [approvalSent, setApprovalSent] = useState(false);
  const [approvalRefId, setApprovalRefId] = useState('');

  // Device Info
  const deviceName = authSecurity.getDeviceName();

  // Try capturing location proactively
  const checkLocation = async () => {
    setLocationStatus('checking');
    try {
      const loc = await authSecurity.requestUserLocation();
      setCoords(loc);
      setLocationStatus('granted');
      setErrorMessage(null);
    } catch (err: any) {
      if (err.message === 'LOCATION_DENIED') {
        setLocationStatus('denied');
      } else {
        setLocationStatus('prompt');
      }
    }
  };

  useEffect(() => {
    checkLocation();
    usersRepo.getAll().then(list => {
      setAvailableUsers(list.filter(u => u.is_active));
    }).catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    let activeCoords = coords;

    // If location is not yet acquired, attempt to request it
    if (!activeCoords) {
      try {
        activeCoords = await authSecurity.requestUserLocation();
        setCoords(activeCoords);
        setLocationStatus('granted');
      } catch (err: any) {
        setLocationStatus('denied');
        // Do not abort login for terminal cashiers; authRepo will authenticate in Terminal Mode
      }
    }

    try {
      const res: LoginResult = await authRepo.login({
        email,
        password,
        location: activeCoords || undefined,
        locationDenied: !activeCoords || locationStatus === 'denied',
      });

      if (res.success) {
        if (login && res.user && res.session) {
          login(res.user, res.session);
        }
        showToast(`Welcome back, ${res.user?.full_name}! Active session started.`, 'success');
        await refreshData();
        onLoginSuccess();
      } else {
        setErrorMessage(res.error || 'Authentication failed');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred during login');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      showToast('Please enter your account email', 'warning');
      return;
    }

    try {
      const req = await authRepo.requestLoginApproval({
        email,
        reason: approvalReason || 'Location permission blocked on device',
      });
      setApprovalRefId(req.id);
      setApprovalSent(true);
      showToast('Approval request submitted to Super Admin', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to submit request', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Decorative Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 z-10">
        {/* Brand Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-600 text-white font-black text-2xl shadow-xl shadow-orange-950/60 mb-1 border border-orange-500/40">
            CK
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <span>CHAAT KULTURE OS</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-orange-950/80 text-orange-400 border border-orange-800 font-mono">
              v2.4
            </span>
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Multi-Location Food Operations & Financial Security
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-5">
          {/* Header Note */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-orange-400" />
              <span>Secure Terminal Login</span>
            </span>
            <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
              <Smartphone className="w-3 h-3" />
              {deviceName}
            </span>
          </div>

          {/* Location Verification Pill */}
          <div className="space-y-1.5">
            {locationStatus === 'granted' && coords ? (
              <div className="flex items-center gap-2 p-2.5 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-300">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="truncate">
                  <span className="font-bold">Location Verified:</span>{' '}
                  <span className="font-mono text-[11px] text-slate-300">{coords.address}</span>
                </div>
              </div>
            ) : locationStatus === 'denied' ? (
              <div className="p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl text-xs text-rose-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-rose-200">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Location Access Denied</span>
                </div>
                <p className="text-[11px] text-rose-300/90 leading-relaxed">
                  Security policy requires location access to verify counter operations. Please allow browser location access or request admin approval below.
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={checkLocation}
                    className="text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-200"
                  >
                    Retry Permission
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsApprovalModalOpen(true)}
                    className="text-[11px] text-amber-400 hover:text-amber-300 underline"
                  >
                    Request Admin Approval
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-orange-400 animate-pulse" />
                  <span>Location verification pending...</span>
                </div>
                <button
                  type="button"
                  onClick={checkLocation}
                  className="text-orange-400 font-bold hover:underline text-[11px]"
                >
                  Verify GPS
                </button>
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-950/60 border border-red-800/70 rounded-xl text-xs text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{errorMessage}</span>
                {errorMessage.includes('approval') && (
                  <button
                    type="button"
                    onClick={() => setIsApprovalModalOpen(true)}
                    className="block text-amber-400 font-bold hover:underline mt-1"
                  >
                    Click here to send an Approval Request to Super Admin →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Email Address or Registered Phone</span>
              </label>
              <input
                type="text"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. 9826000004 or staff@chaatkulture.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  <span>Password or 4-Digit POS PIN</span>
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password or 4-digit PIN"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-950/40 justify-center transition-all"
            >
              <Lock className="w-4 h-4 mr-2" />
              <span>{isSubmitting ? 'Verifying Credentials...' : 'Authenticate & Enter'}</span>
            </Button>

            {/* Quick-Select Staff Accounts Helper */}
            {availableUsers.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAccountsHelper(!showAccountsHelper)}
                  className="w-full text-center text-[11px] text-orange-400 hover:text-orange-300 font-semibold py-1.5 px-2 rounded-xl bg-orange-950/30 border border-orange-800/40 hover:bg-orange-950/50 transition-all flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                  <span>{showAccountsHelper ? 'Hide Registered Staff Accounts' : `Tap to Pick from Registered Accounts (${availableUsers.length})`}</span>
                </button>

                {showAccountsHelper && (
                  <div className="mt-2 p-2 bg-slate-950 border border-slate-800 rounded-2xl space-y-1.5 max-h-52 overflow-y-auto">
                    <p className="text-[10px] text-slate-400 px-1 font-semibold uppercase tracking-wider">
                      Tap any account to auto-fill login credentials:
                    </p>
                    {availableUsers.map(u => (
                      <div
                        key={u.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setEmail(u.email || u.phone);
                          if (u.plain_password) {
                            setPassword(u.plain_password);
                          } else if (u.pin_hash) {
                            setPassword(u.pin_hash);
                          }
                          setErrorMessage(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            setEmail(u.email || u.phone);
                            if (u.plain_password) setPassword(u.plain_password);
                          }
                        }}
                        className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-orange-500/50 cursor-pointer flex items-center justify-between text-xs transition-all"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-white truncate text-xs">{u.full_name}</p>
                          <p className="text-[11px] text-slate-400 font-mono truncate">{u.email || u.phone}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-mono font-bold bg-orange-950/80 text-orange-400 border border-orange-900/60">
                            {u.role.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </form>

          {/* Security Notice */}
          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500 space-y-1">
            <p className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Public signup disabled. User credentials issued by Super Admin.</span>
            </p>
            <p className="flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Single active session enforced. Logging in terminates prior sessions.</span>
            </p>
          </div>
        </div>
      </div>

      {/* REQUEST ADMIN APPROVAL MODAL */}
      {isApprovalModalOpen && (
        <Modal
          isOpen={isApprovalModalOpen}
          onClose={() => {
            setIsApprovalModalOpen(false);
            setApprovalSent(false);
          }}
          title="Request Super Admin Login Approval"
        >
          {approvalSent ? (
            <div className="space-y-4 text-center py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-white text-base">Approval Request Sent</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Your request has been delivered to the Super Admin with reference ID{' '}
                  <span className="font-mono text-orange-400 font-bold">#{approvalRefId}</span>. You can log in once
                  the admin approves your device or bypasses location.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => {
                  setIsApprovalModalOpen(false);
                  setApprovalSent(false);
                }}
              >
                Close Window
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSendApproval} className="space-y-4 text-xs">
              <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-amber-300">
                If location services are blocked on your device or you are logging in from an external counter terminal,
                the Super Admin can grant one-time or permanent approval.
              </div>

              <div className="space-y-1">
                <label className="font-bold text-white block">Your Account Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your.email@chaatkulture.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-white block">Reason for Request *</label>
                <textarea
                  required
                  rows={3}
                  value={approvalReason}
                  onChange={e => setApprovalReason(e.target.value)}
                  placeholder="e.g. Counter PC location blocked by browser policy; emergency counter login authorized by manager."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="text-[11px] text-slate-400 font-mono">
                Device Fingerprint: {authSecurity.getDeviceName()}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <Button type="button" variant="ghost" onClick={() => setIsApprovalModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  <Send className="w-3.5 h-3.5 mr-1" />
                  <span>Submit Request</span>
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
};
