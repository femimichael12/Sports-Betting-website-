/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Trophy, 
  User, 
  Menu, 
  X, 
  Coins, 
  LogOut, 
  History, 
  ChevronDown,
  Gamepad2,
  Wallet,
  ShieldAlert,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Header() {
  const { user, profile, logout, isDemo } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const baseNavItems = [
    { name: 'Lobby', path: '/', icon: Trophy },
    { name: 'Sports Book', path: '/sports', icon: Gamepad2 },
    { name: 'My Wallet', path: '/wallet', icon: Wallet },
    { name: 'My Wagers', path: '/wagers', icon: History },
    { name: 'Account', path: '/profile', icon: User },
  ];

  const hasAdminAccess = profile?.email === 'ademusiwamichael1@gmail.com';

  const navItems = hasAdminAccess 
    ? [...baseNavItems, { name: 'Admin', path: '/admin', icon: ShieldAlert }]
    : baseNavItems;

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav id="app-header" className="sticky top-0 z-40 bg-geo-header border-b border-geo-border shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo Brand */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-8 h-8 bg-geo-brand rounded-sm flex items-center justify-center text-black font-extrabold shadow shadow-geo-brand/10 group-hover:scale-105 transition-transform duration-300">
                <Trophy className="w-4.5 h-4.5 text-black stroke-[2.5]" />
              </div>
              <div className="flex flex-col">
                <span className="font-display font-black tracking-tight text-geo-text-light leading-none text-base sm:text-lg">
                  FEM<span className="text-geo-brand">BET</span>
                </span>
                <span className="text-[9px] font-mono tracking-widest text-[#848E9C] uppercase font-bold mt-0.5">
                  Sports Terminal
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-sm text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                    active 
                      ? 'bg-geo-card text-geo-brand border-b-2 border-geo-brand' 
                      : 'text-geo-text-muted hover:text-geo-text-light hover:bg-geo-card'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-geo-brand' : 'text-geo-text-muted'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* User Coordinates Banner */}
          <div className="hidden md:flex items-center space-x-4">
            {profile && (
              <>
                {isDemo && (
                  <span className="font-mono text-[9px] px-2 py-1 bg-[#C99B09]/15 text-[#C99B09] rounded-sm border border-[#C99B09]/30 uppercase font-extrabold tracking-wider animate-pulse select-none shrink-0 flex items-center gap-1">
                    <span>SANDBOX ACTIVE</span>
                    <span>⚡</span>
                  </span>
                )}

                {/* Live Balance Card */}
                <Link 
                  to="/wallet" 
                  className="bg-geo-card px-3.5 py-1.5 rounded-sm border border-geo-border flex items-center gap-2.5 transition-colors hover:border-geo-border-light group"
                >
                  <Coins className="w-4 h-4 text-geo-brand group-hover:rotate-12 transition-transform duration-300" />
                  <span className="text-[10px] text-geo-text-muted uppercase font-mono font-bold tracking-wider">Balance:</span>
                  <span className="text-sm font-mono font-extrabold text-geo-success col-naira">
                    ₦{profile.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </Link>

                {/* Tactical Theme Toggle */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="w-9 h-9 flex items-center justify-center rounded-sm bg-geo-card border border-geo-border hover:border-geo-border-light text-geo-text-muted hover:text-geo-text-light transition-colors relative cursor-pointer"
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  aria-label="Toggle theme mode"
                >
                  {theme === 'dark' ? (
                    <Sun className="w-4 h-4 text-geo-brand transition-transform hover:scale-110" />
                  ) : (
                    <Moon className="w-4 h-4 text-[#D946EF] transition-transform hover:scale-110" />
                  )}
                </button>

                {/* Profile Controls Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center space-x-2.5 px-1 py-1 rounded-sm hover:bg-geo-card transition-colors text-geo-text-light hover:text-white"
                  >
                    <div className="w-9 h-9 rounded-full bg-geo-border border border-geo-border-light flex items-center justify-center font-display text-xs font-bold text-geo-brand uppercase tracking-wider">
                      {profile.username.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-geo-text-light max-w-[100px] truncate">{profile.username}</span>
                    <ChevronDown className={`w-4 h-4 text-geo-text-muted transition-transform duration-200 ${userDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {userDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setUserDropdownOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 mt-2 w-56 rounded-sm bg-geo-header border border-geo-border shadow-xl py-1.5 z-20 text-geo-text-light font-sans"
                        >
                          <div className="px-4 py-2 border-b border-geo-border">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] text-geo-text-muted uppercase tracking-wider font-mono font-bold">Bettor Account</p>
                              {isDemo ? (
                                <span className="font-mono text-[7px] px-1 bg-[#C99B09]/15 text-[#C99B09] rounded-sm border border-[#C99B09]/30 uppercase font-extrabold">Sandbox</span>
                              ) : user?.isAnonymous ? (
                                <span className="font-mono text-[7px] px-1 bg-geo-bg text-geo-text-muted rounded-sm border border-geo-border uppercase font-bold">Guest</span>
                              ) : user?.emailVerified ? (
                                <span className="font-mono text-[7px] px-1 bg-geo-success/10 text-geo-success rounded-sm border border-geo-success/20 uppercase font-bold">Verified</span>
                              ) : (
                                <span className="font-mono text-[7px] px-1 bg-red-950/20 text-red-500 rounded-sm border border-red-900/30 uppercase font-bold">Unverified</span>
                              )}
                            </div>
                            <p className="text-sm font-bold truncate text-geo-text-light mt-0.5">{profile.username}</p>
                            <p className="text-xs truncate text-geo-text-muted mt-0.5">{profile.email}</p>
                          </div>
                          
                          <Link
                            to="/profile"
                            onClick={() => setUserDropdownOpen(false)}
                            className="flex items-center space-x-2 px-4 py-2.5 hover:bg-geo-card text-xs font-bold uppercase tracking-wider text-geo-text-light hover:text-white transition-colors"
                          >
                            <User className="w-4 h-4 text-geo-text-muted" />
                            <span>My Account</span>
                          </Link>

                          <Link
                            to="/wallet"
                            onClick={() => setUserDropdownOpen(false)}
                            className="flex items-center space-x-2 px-4 py-2.5 hover:bg-geo-card text-xs font-bold uppercase tracking-wider text-geo-text-light hover:text-white transition-colors"
                          >
                            <Wallet className="w-4 h-4 text-geo-text-muted" />
                            <span>My Wallet / Ledger</span>
                          </Link>

                          <Link
                            to="/wagers"
                            onClick={() => setUserDropdownOpen(false)}
                            className="flex items-center space-x-2 px-4 py-2.5 hover:bg-geo-card text-xs font-bold uppercase tracking-wider text-geo-text-light hover:text-white transition-colors"
                          >
                            <History className="w-4 h-4 text-geo-text-muted" />
                            <span>My Bet History</span>
                          </Link>

                          <div className="border-t border-geo-border my-1"></div>

                          <button
                            onClick={() => {
                              setUserDropdownOpen(false);
                              logout();
                            }}
                            className="flex items-center space-x-2 w-full text-left px-4 py-2.5 hover:bg-red-950/20 text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300 transition-colors"
                          >
                            <LogOut className="w-4 h-4 text-red-400" />
                            <span>Sign Out Terminal</span>
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>

          {/* Mobile hamburger menu */}
          <div className="flex items-center md:hidden space-x-2">
            {profile && (
              <div className="flex items-center px-2.5 py-1 bg-geo-card border border-geo-border rounded-sm font-mono text-xs font-bold text-geo-success">
                ₦{profile.balance.toFixed(0)}
              </div>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-sm text-geo-text-muted hover:text-geo-text-light hover:bg-geo-card focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Menu Panel */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-geo-border bg-geo-header"
          >
            <div className="px-4 pt-2 pb-4 space-y-2">
              {profile && (
                <div className="px-4 py-2.5 rounded-sm bg-geo-card border border-geo-border flex justify-between items-center mb-2 animate-fade-in">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-geo-text-muted">Account Username</p>
                    <p className="font-bold text-sm text-geo-text-light">{profile.username}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-geo-text-muted">Free Balance</p>
                    <p className="font-mono font-extrabold text-geo-success text-sm">₦{profile.balance.toFixed(2)}</p>
                  </div>
                </div>
              )}

              {/* Mobile Visual Theme Switcher row */}
              <div className="flex items-center justify-between px-4 py-3 rounded-sm bg-geo-card border border-geo-border mb-3 select-none">
                <span className="text-xs font-bold uppercase tracking-wider text-geo-text-muted">Visual Theme</span>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="px-3 py-1 bg-geo-header border border-geo-border rounded-sm flex items-center gap-1.5 text-[10px] font-mono font-black uppercase tracking-wider text-geo-text-light cursor-pointer active:scale-95 transition-all"
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-geo-brand" />
                      <span>Dark Mode</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-[#D946EF]" />
                      <span>Light Mode</span>
                    </>
                  )}
                </button>
              </div>

              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-4 py-2.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors ${
                      active
                        ? 'bg-geo-card text-geo-brand border-b border-geo-brand'
                        : 'text-geo-text-muted hover:text-geo-text-light hover:bg-geo-card'
                    }`}
                  >
                    <Icon className="w-5 h-5 text-current" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}

              {profile && (
                <>
                  <div className="border-t border-geo-border my-2"></div>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center space-x-3 px-4 py-2.5 rounded-sm text-xs font-bold uppercase tracking-wider text-red-500 hover:bg-red-950/20 transition-colors"
                  >
                    <LogOut className="w-5 h-5 text-current" />
                    <span>Sign Out Terminal</span>
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
