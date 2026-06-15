/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Loader2, 
  Mail, 
  ShieldAlert, 
  CheckCircle2, 
  LogOut, 
  RefreshCw, 
  Radio 
} from 'lucide-react';

export default function ProtectedRoute() {
  const { user, profile, loading, sendVerificationEmail, refreshUser, logout } = useAuth();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-geo-bg flex flex-col items-center justify-center text-slate-100">
        <div className="relative flex flex-col items-center">
          <Loader2 className="w-10 h-10 animate-spin text-geo-brand mb-4" />
          <p className="text-sm font-mono tracking-widest text-geo-brand/80 uppercase">
            Securing Connection...
          </p>
          <p className="text-xs text-geo-text-muted mt-1 font-sans font-medium">
            Loading your credentials & sportsbook terminal
          </p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  // Verification is required only for traditional email/password bettor profiles (non-anonymous, non-verified accounts)
  const isEmailUnverified = !user.isAnonymous && !user.emailVerified;

  if (isEmailUnverified) {
    const handleResend = async () => {
      try {
        setErrorMsg(null);
        setSuccessMsg(null);
        setResending(true);
        await sendVerificationEmail();
        setSuccessMsg("Verification token broadcast successfully to your ledger index. Check your inbox.");
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to dispatch verification email. Please try again.");
      } finally {
        setResending(false);
      }
    };

    const handleCheckVerification = async () => {
      try {
        setErrorMsg(null);
        setSuccessMsg(null);
        setChecking(true);
        await refreshUser();
        // Firebase user state updates on reload
      } catch (err: any) {
        setErrorMsg("Verify reload handshake failed. Please click verify link first.");
      } finally {
        setChecking(false);
      }
    };

    return (
      <div className="min-h-screen bg-geo-bg text-[#EAECEF] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans">
        
        {/* Ambient glow backgrounds */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-geo-brand/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md bg-geo-card border border-geo-border rounded-sm shadow-2xl overflow-hidden z-10 p-6 sm:p-8 space-y-6 relative">
          
          {/* Decorative geometric rail tag */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-500 via-geo-brand to-red-500" />
          
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-br from-red-500/10 to-geo-brand/10 border border-geo-brand/20 rounded-sm flex items-center justify-center text-geo-brand relative mt-2">
              <Mail className="w-8 h-8 text-geo-brand stroke-[1.5]" />
              <Radio className="w-4 h-4 text-red-500 absolute -top-1 -right-1 animate-ping" />
            </div>

            <div className="space-y-1.5">
              <h1 className="font-display font-black text-lg text-white uppercase tracking-wider">
                VERIFICATION OUTSTANDING
              </h1>
              <p className="text-xs text-geo-text-muted font-medium max-w-xs mx-auto leading-relaxed">
                A security mandate has broadcast a credential assertion link to <b className="text-[#EAECEF] font-mono break-all">{user.email}</b>.
              </p>
            </div>
          </div>

          <div className="p-3.5 bg-geo-bg border border-geo-border rounded-sm text-xs text-geo-text-muted leading-relaxed font-semibold">
            Please inspect your inbox and any secondary folders (such as spam or updates). Follow the enclosed verification token link to unlock access.
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-sm text-xs text-red-400 flex items-start gap-2.5 font-mono">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-sm text-xs text-geo-success flex items-start gap-2.5 font-mono">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-geo-success" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="space-y-3.5">
            {/* Confirm button */}
            <button
              onClick={handleCheckVerification}
              disabled={checking || resending}
              className="w-full py-3 bg-geo-brand hover:bg-geo-brand/90 text-black font-display font-black text-xs uppercase tracking-wider rounded-sm transition-all focus:outline-none flex items-center justify-center space-x-2"
            >
              {checking ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Assert Connection State</span>
                </>
              )}
            </button>

            <div className="grid grid-cols-2 gap-3">
              {/* Resend button */}
              <button
                onClick={handleResend}
                disabled={checking || resending}
                className="py-2.5 bg-geo-bg hover:bg-geo-card text-geo-text-light border border-geo-border rounded-sm font-display font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-40"
              >
                {resending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-geo-text-muted" />
                ) : (
                  <span>Broadcast Link</span>
                )}
              </button>

              {/* Log out button */}
              <button
                onClick={logout}
                className="py-2.5 bg-geo-bg hover:bg-geo-card text-red-400 border border-geo-border hover:border-red-900/55 rounded-sm font-display font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-geo-border text-center">
            <span className="text-[9px] text-geo-text-muted font-mono tracking-wide">
              TERMINAL SECURED INDEX STATUS: INCOMPLETE
            </span>
          </div>

        </div>

      </div>
    );
  }

  return <Outlet />;
}
