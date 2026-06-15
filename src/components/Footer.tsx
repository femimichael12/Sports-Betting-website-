/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ShieldCheck, HelpCircle } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer id="app-footer" className="bg-geo-header border-t border-geo-border py-8 text-geo-text-muted font-sans mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* Brand and Description */}
          <div className="space-y-3">
            <span className="font-display font-black tracking-tight text-white text-base">
              FEM<span className="text-geo-brand">BET</span>
            </span>
            <p className="text-xs text-geo-text-muted leading-relaxed font-light">
              Your next-generation simulated sports bookmaker. Place risk-free bets on live soccer, basketball, tennis, and esports tournaments with free simulated credits.
            </p>
          </div>

          {/* Secure & Compliant */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono tracking-widest text-[#EAECEF] font-bold uppercase">Terminal Security</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center space-x-2 text-geo-text-muted">
                <ShieldCheck className="w-4 h-4 text-geo-success shrink-0" />
                <span>Zero-Trust Auth & DB Rules</span>
              </div>
              <div className="flex items-center space-x-2 text-geo-text-muted">
                <div className="w-1.5 h-1.5 rounded-full bg-geo-brand animate-pulse"></div>
                <span>Sync Node Secured (Cloud Run)</span>
              </div>
            </div>
          </div>

          {/* Responsible Gaming */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-mono tracking-widest text-[#EAECEF] font-bold uppercase">Simulation Disclaimer & Licensing</h4>
            <p className="text-xs text-geo-text-muted leading-relaxed font-light">
              FEMBET is an educational, fully simulated entertainment platform. Wagers are placed using imaginary credit balances with no actual financial value. This app does not run real-money sports gambling or support payment operations.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-1.5 bg-geo-card border border-geo-border rounded-sm p-2.5 max-w-md">
              <span className="text-[10px] font-mono uppercase bg-geo-success/10 text-geo-success px-1.5 py-0.5 rounded-sm font-semibold shrink-0">Responsible Play</span>
              <span className="text-[10px] text-geo-text-light font-medium">
                Have sports betting questions? National Council helpline: <a href="tel:18005224700" className="text-geo-brand underline hover:text-geo-brand/80">1-800-GAMBLER</a>.
              </span>
            </div>
          </div>
          
        </div>

        <div className="border-t border-geo-border mt-8 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-mono">
          <p>© {currentYear} FEMBET SPORTSBOOK. ALL SIMULATED CREDITS COMPLY UNCONDITIONALLY.</p>
          <div className="flex space-x-4">
            <span className="text-geo-success">SECURE TERMINAL ACTIVE</span>
            <span className="text-geo-border-light">|</span>
            <span className="text-geo-text-muted">UTC: 2026-06-01</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
