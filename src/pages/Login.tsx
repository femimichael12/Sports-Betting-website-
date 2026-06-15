/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { 
  Trophy, 
  Sparkles, 
  Gamepad2, 
  Flame, 
  Tv, 
  Zap, 
  ArrowRight,
  ShieldCheck,
  User,
  Loader2,
  Mail,
  Lock,
  KeyRound,
  ArrowLeft,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

export default function Login() {
  const { 
    user, 
    profile, 
    loginWithGoogle, 
    loginAnonymously,
    registerWithEmail,
    loginWithEmail,
    sendPasswordReset,
    loginAsDemo
  } = useAuth();

  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot_password'>('login');
  
  const [usernameInput, setUsernameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  
  const [isAnonymouseLoading, setIsAnonymouseLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  
  const [authError, setAuthError] = useState<string | null>(null);
  const [resetEmailSuccess, setResetEmailSuccess] = useState<string | null>(null);

  // If already logged in, route immediately to lobby
  if (user && profile) {
    return <Navigate to="/" replace />;
  }

  const handleDemoLogin = async () => {
    try {
      setAuthError(null);
      await loginAsDemo(usernameInput.trim() || undefined);
    } catch (e: any) {
      setAuthError(e?.message || "Demo mode activation failed.");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setAuthError(null);
      setResetEmailSuccess(null);
      setIsGoogleLoading(true);
      await loginWithGoogle();
    } catch (e: any) {
      setAuthError(e?.message || "Google authentication failed.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGuestLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) {
      setAuthError("Please specify a guest screen name.");
      return;
    }
    try {
      setAuthError(null);
      setResetEmailSuccess(null);
      setIsAnonymouseLoading(true);
      await loginAnonymously(usernameInput);
    } catch (e: any) {
      setAuthError(e?.message || "Guest authentication failed.");
    } finally {
      setIsAnonymouseLoading(false);
    }
  };

  const handleEmailPasswordLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput) {
      setAuthError("Please fill in both your email and password.");
      return;
    }
    try {
      setAuthError(null);
      setResetEmailSuccess(null);
      setIsEmailLoading(true);
      await loginWithEmail(emailInput.trim(), passwordInput);
    } catch (e: any) {
      setAuthError(e?.message || "Login failed. Please confirm your credentials are correct.");
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleEmailPasswordRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim() || !emailInput.trim() || !passwordInput) {
      setAuthError("Please complete all fields to sign up.");
      return;
    }
    if (usernameInput.trim().length < 3) {
      setAuthError("Bettor screen name must be at least 3 characters.");
      return;
    }
    if (passwordInput.length < 6) {
      setAuthError("Authentication credentials must be at least 6 characters.");
      return;
    }
    try {
      setAuthError(null);
      setResetEmailSuccess(null);
      setIsEmailLoading(true);
      await registerWithEmail(emailInput.trim(), passwordInput, usernameInput.trim());
    } catch (e: any) {
      setAuthError(e?.message || "Sign up failed. This email might already be registered in our ledger index.");
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handlePasswordResetRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) {
      setAuthError("Please enter your email to get reset instructions.");
      return;
    }
    try {
      setAuthError(null);
      setResetEmailSuccess(null);
      setIsEmailLoading(true);
      await sendPasswordReset(emailInput.trim());
      setResetEmailSuccess("A secure password reset link has been dispatched to your email address index. Please check your inbox / spam folders.");
    } catch (e: any) {
      setAuthError(e?.message || "Failed to dispatch password reset. Please double check the email address.");
    } finally {
      setIsEmailLoading(false);
    }
  };

  const switchTo = (mode: 'login' | 'register' | 'forgot_password') => {
    setAuthMode(mode);
    setAuthError(null);
    setResetEmailSuccess(null);
  };

  return (
    <div id="login-container" className="min-h-screen bg-geo-bg text-[#EAECEF] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans">
      
      {/* Background design elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-geo-brand/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-geo-success/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Card frame: sharp rounded-sm corners */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 rounded-sm border border-geo-border bg-geo-header shadow-2xl overflow-hidden z-10 relative">
        
        {/* Left Column: Branding, Promo, features */}
        <div className="md:col-span-7 bg-geo-card p-8 sm:p-12 flex flex-col justify-between border-r border-geo-border relative">
          
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-geo-brand rounded-sm flex items-center justify-center text-black font-black shadow shadow-geo-brand/10">
              <Trophy className="w-4.5 h-4.5 text-black stroke-[2.5]" />
            </div>
            <span className="font-display font-black tracking-tight text-[#EAECEF] text-base select-none leading-none">
              FEM<span className="text-geo-brand">BET</span>
            </span>
          </div>

          <div className="my-10 sm:my-14 space-y-4">
            <div className="inline-flex items-center space-x-1.5 bg-geo-brand/10 border border-geo-brand/15 rounded-sm px-3 py-1 font-mono text-[10px] text-geo-brand font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simulated Credits Engine</span>
            </div>
            
            <h1 className="font-display font-black text-3xl sm:text-4xl text-white tracking-tight leading-[1.12] uppercase">
              The premium risk-free <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-geo-brand to-[#F0D56B]">sports sportsbook</span>
            </h1>
            
            <p className="text-xs sm:text-sm text-geo-text-muted max-w-md font-medium leading-relaxed">
              Place wagers on major sports including Premier League soccer, NBA matches, and top tier Esports tournaments. Explore live coefficients, track active ledger audits, and play absolutely risk-free.
            </p>
          </div>

          {/* Bullet badges */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-geo-border text-geo-text-muted">
            <div className="flex items-center space-x-2">
              <Zap className="w-4.5 h-4.5 text-geo-brand shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-white">100% Free Credits</span>
            </div>
            <div className="flex items-center space-x-2">
              <Gamepad2 className="w-4.5 h-4.5 text-geo-brand shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-white">Live Match Feeds</span>
            </div>
            <div className="flex items-center space-x-2">
              <Tv className="w-4.5 h-4.5 text-geo-brand shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-white">Real Odds Updates</span>
            </div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4.5 h-4.5 text-geo-brand shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-white">Secure Ledger Audit</span>
            </div>
          </div>

        </div>

        {/* Right Column: Authentication Terminal */}
        <div className="md:col-span-5 p-8 sm:p-12 flex flex-col justify-center bg-geo-header">
          
          {authMode === 'login' && (
            <div className="space-y-5">
              <div className="mb-6">
                <h2 className="font-display font-black text-xs uppercase tracking-wider text-[#EAECEF]">
                  SIGN IN TERMINAL
                </h2>
                <p className="text-xs text-geo-text-muted mt-1 font-medium">
                  Enter your sportsbook account ledger keys or{' '}
                  <button
                    type="button"
                    onClick={handleDemoLogin}
                    className="text-geo-brand hover:underline font-bold cursor-pointer text-[11px]"
                  >
                    Bypass to Local Sandbox ⚡
                  </button>
                </p>
              </div>

              <form onSubmit={handleEmailPasswordLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-geo-text-muted font-bold block">
                    Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-geo-text-muted">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="wagerer@example.com"
                      required
                      className="w-full bg-geo-bg border border-geo-border focus:border-geo-brand rounded-sm py-3 pl-10 pr-4 text-xs font-bold focus:outline-none text-geo-text-light transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-geo-text-muted font-bold">
                      Password Key
                    </label>
                    <button
                      type="button"
                      onClick={() => switchTo('forgot_password')}
                      className="text-[10px] font-mono uppercase tracking-wider text-geo-brand hover:underline font-bold"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-geo-text-muted">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-geo-bg border border-geo-border focus:border-geo-brand rounded-sm py-3 pl-10 pr-4 text-xs font-bold focus:outline-none text-geo-text-light transition-colors"
                    />
                  </div>
                </div>

                {authError && (
                  <div className="space-y-2.5">
                    <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-sm text-xs text-red-400 flex items-start gap-2.5 font-mono">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                      <span>{authError}</span>
                    </div>
                    {authError.includes('not be enabled') || authError.includes('not enabled') || authError.includes('Authentication') || authError.includes('configuration-not-found') ? (
                      <button
                        type="button"
                        onClick={handleDemoLogin}
                        className="w-full py-2.5 bg-[#C99B09]/15 border border-[#C99B09]/30 text-geo-brand hover:bg-[#C99B09]/25 rounded-sm font-display font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Run in Offline Sandbox Mode</span>
                      </button>
                    ) : null}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isEmailLoading || isGoogleLoading || isAnonymouseLoading}
                  className="w-full py-3.5 bg-geo-brand hover:bg-geo-brand/90 text-black rounded-sm font-display font-extrabold text-xs uppercase tracking-wider transition-all shadow-[0_4px_0_0_#C99B09] active:translate-y-1 active:shadow-none flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isEmailLoading ? (
                    <Loader2 className="w-4.5 h-4.5 animate-spin text-black" />
                  ) : (
                    <>
                      <span>Access Portfolio</span>
                      <ArrowRight className="w-4.5 h-4.5 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </form>

              <div className="text-center">
                <span className="text-xs text-geo-text-muted font-semibold">
                  New Bettor?{' '}
                  <button
                    onClick={() => switchTo('register')}
                    className="text-geo-brand hover:underline font-bold uppercase tracking-wider text-[11px]"
                  >
                    Register Account
                  </button>
                </span>
              </div>
            </div>
          )}

          {authMode === 'register' && (
            <div className="space-y-5">
              <div className="mb-6">
                <h2 className="font-display font-black text-xs uppercase tracking-wider text-[#EAECEF]">
                  REGISTER TERMINAL
                </h2>
                <p className="text-xs text-geo-text-muted mt-1 font-medium">
                  Establish credentials in sportsbook ledger index.
                </p>
              </div>

              <form onSubmit={handleEmailPasswordRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-geo-text-muted font-bold block">
                    Username Accent
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-geo-text-muted">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="e.g. SharpBettor"
                      required
                      minLength={3}
                      maxLength={32}
                      className="w-full bg-geo-bg border border-geo-border focus:border-geo-brand rounded-sm py-3 pl-10 pr-4 text-xs font-bold focus:outline-none text-geo-text-light transition-colors uppercase tracking-wider"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-geo-text-muted font-bold block">
                    Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-geo-text-muted">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="example@wager.com"
                      required
                      className="w-full bg-geo-bg border border-geo-border focus:border-geo-brand rounded-sm py-3 pl-10 pr-4 text-xs font-bold focus:outline-none text-geo-text-light transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-geo-text-muted font-bold block">
                    Secure Code Access
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-geo-text-muted">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                      minLength={6}
                      className="w-full bg-geo-bg border border-geo-border focus:border-geo-brand rounded-sm py-3 pl-10 pr-4 text-xs font-bold focus:outline-none text-geo-text-light transition-colors"
                    />
                  </div>
                </div>

                {authError && (
                  <div className="space-y-2.5">
                    <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-sm text-xs text-red-400 flex items-start gap-2.5 font-mono">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                      <span>{authError}</span>
                    </div>
                    {authError.includes('not be enabled') || authError.includes('not enabled') || authError.includes('Authentication') || authError.includes('configuration-not-found') ? (
                      <button
                        type="button"
                        onClick={handleDemoLogin}
                        className="w-full py-2.5 bg-[#C99B09]/15 border border-[#C99B09]/30 text-geo-brand hover:bg-[#C99B09]/25 rounded-sm font-display font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Run in Offline Sandbox Mode</span>
                      </button>
                    ) : null}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isEmailLoading || isGoogleLoading || isAnonymouseLoading}
                  className="w-full py-3.5 bg-geo-brand hover:bg-geo-brand/90 text-black rounded-sm font-display font-extrabold text-xs uppercase tracking-wider transition-all shadow-[0_4px_0_0_#C99B09] active:translate-y-1 active:shadow-none flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isEmailLoading ? (
                    <Loader2 className="w-4.5 h-4.5 animate-spin text-black" />
                  ) : (
                    <>
                      <span>Open Micro-Ledger</span>
                      <ArrowRight className="w-4.5 h-4.5 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </form>

              <div className="text-center">
                <span className="text-xs text-geo-text-muted font-semibold">
                  Existing Bettor?{' '}
                  <button
                    onClick={() => switchTo('login')}
                    className="text-geo-brand hover:underline font-bold uppercase tracking-wider text-[11px]"
                  >
                    Log In Instead
                  </button>
                </span>
              </div>
            </div>
          )}

          {authMode === 'forgot_password' && (
            <div className="space-y-5">
              <div className="mb-6">
                <button
                  onClick={() => switchTo('login')}
                  className="inline-flex items-center space-x-1 text-xs text-geo-brand hover:underline font-mono uppercase tracking-wider font-bold mb-4"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Exit Mode</span>
                </button>
                <h2 className="font-display font-black text-xs uppercase tracking-wider text-[#EAECEF]">
                  REFUND / PASSWORD RESET
                </h2>
                <p className="text-xs text-geo-text-muted mt-1 font-medium">
                  Dispatch email verification password token link.
                </p>
              </div>

              <form onSubmit={handlePasswordResetRequest} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-geo-text-muted font-bold block">
                    Registered Email
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-geo-text-muted">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="your-email@wager.com"
                      required
                      className="w-full bg-geo-bg border border-geo-border focus:border-geo-brand rounded-sm py-3 pl-10 pr-4 text-xs font-bold focus:outline-none text-geo-text-light transition-colors"
                    />
                  </div>
                </div>

                {authError && (
                  <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-sm text-xs text-red-400 flex items-start gap-2.5 font-mono">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                    <span>{authError}</span>
                  </div>
                )}

                {resetEmailSuccess && (
                  <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-sm text-xs text-geo-success flex items-start gap-2.5 font-mono">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-geo-success" />
                    <span>{resetEmailSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isEmailLoading || isGoogleLoading || isAnonymouseLoading}
                  className="w-full py-3.5 bg-geo-brand hover:bg-geo-brand/90 text-black rounded-sm font-display font-extrabold text-xs uppercase tracking-wider transition-all shadow-[0_4px_0_0_#C99B09] active:translate-y-1 active:shadow-none flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isEmailLoading ? (
                    <Loader2 className="w-4.5 h-4.5 animate-spin text-black" />
                  ) : (
                    <span>Request Reset Token</span>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Socials / Guests options (only shown during standard login or register screen to avoid cluttering reset screen) */}
          {authMode !== 'forgot_password' && (
            <div className="space-y-5 mt-6 pt-5 border-t border-geo-border">
              
              {/* Google Access Button */}
              <button
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading || isAnonymouseLoading || isEmailLoading}
                className="w-full bg-geo-card border border-geo-border rounded-sm py-3 px-4 text-xs font-bold text-geo-text-light flex items-center justify-center space-x-3 transition-all hover:text-white cursor-pointer disabled:opacity-55"
              >
                {isGoogleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-geo-text-muted" />
                ) : (
                  <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                <span>Continue with Google</span>
              </button>

              {/* Separator */}
              <div className="flex items-center justify-between text-geo-text-muted text-[9px] font-mono select-none">
                <span className="w-full h-[1px] bg-geo-border" />
                <span className="px-2 uppercase font-bold tracking-widest whitespace-nowrap">OR USE ANONYMOUS PASS</span>
                <span className="w-full h-[1px] bg-geo-border" />
              </div>

              {/* Mini Guest form */}
              <form onSubmit={handleGuestLogin} className="space-y-3">
                <div className="relative font-sans">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-geo-text-muted">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="Guest Screen Name"
                    maxLength={20}
                    disabled={isGoogleLoading || isAnonymouseLoading || isEmailLoading}
                    className="w-full bg-geo-bg border border-geo-border focus:border-geo-brand rounded-sm py-2.5 pl-9 pr-4 text-xs font-bold focus:outline-none text-geo-text-light uppercase tracking-wide transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isGoogleLoading || isAnonymouseLoading || isEmailLoading || !usernameInput.trim()}
                  className="w-full py-2.5 bg-geo-bg hover:bg-geo-card text-geo-text-light border border-geo-border rounded-sm font-display font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-40"
                >
                  {isAnonymouseLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-geo-text-muted" />
                  ) : (
                    <>
                      <span>Enter as Instant Guest</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Privacy statement footnote */}
          <p className="text-[9px] text-geo-text-muted font-mono tracking-wide leading-relaxed mt-8 text-center select-none">
            BY ENROLLING YOU COMMENSE SECURITY COMPLIANCE WITH SIMULATED CREDITS DISCLOSURE.
          </p>

        </div>

      </div>

    </div>
  );
}
