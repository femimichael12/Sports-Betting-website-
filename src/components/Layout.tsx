/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';
import BetSlip from './BetSlip';
import ScoreTicker from './ScoreTicker';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div id="app-layout" className="min-h-screen bg-geo-bg flex flex-col font-sans text-geo-text-light">
      {/* Real-time score ticker */}
      <ScoreTicker />

      {/* Sticky responsive header */}
      <Header />

      {/* Main full-width terminal viewport */}
      <main className="flex-grow flex flex-col max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 mb-8">
        {children}
      </main>

      {/* Persistent Floating Bet Slip drawer */}
      <BetSlip />

      {/* Responsible gaming footer */}
      <Footer />
    </div>
  );
}
