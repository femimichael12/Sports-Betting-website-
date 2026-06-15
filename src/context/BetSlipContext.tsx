/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useContext, useState, ReactNode } from 'react';
import { Match } from '../types';

interface BetSlipItem {
  match: Match;
  predictedOutcome: 'home_win' | 'away_win' | 'draw';
}

interface BetSlipContextType {
  slipItem: BetSlipItem | null;
  addToSlip: (match: Match, outcome: 'home_win' | 'away_win' | 'draw') => void;
  clearSlip: () => void;
  isSlipOpen: boolean;
  setSlipOpen: (open: boolean) => void;
}

const BetSlipContext = createContext<BetSlipContextType | undefined>(undefined);

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [slipItem, setSlipItem] = useState<BetSlipItem | null>(null);
  const [isSlipOpen, setSlipOpen] = useState(false);

  const addToSlip = (match: Match, outcome: 'home_win' | 'away_win' | 'draw') => {
    setSlipItem({ match, predictedOutcome: outcome });
    setSlipOpen(true);
  };

  const clearSlip = () => {
    setSlipItem(null);
    setSlipOpen(false);
  };

  return (
    <BetSlipContext.Provider value={{
      slipItem,
      addToSlip,
      clearSlip,
      isSlipOpen,
      setSlipOpen
    }}>
      {children}
    </BetSlipContext.Provider>
  );
}

export function useBetSlip() {
  const context = useContext(BetSlipContext);
  if (context === undefined) {
    throw new Error('useBetSlip must be used within a BetSlipProvider');
  }
  return context;
}
