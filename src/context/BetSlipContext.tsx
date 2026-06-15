/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Match } from '../types';

export interface BetSlipItem {
  match: Match;
  predictedOutcome: 'home_win' | 'away_win' | 'draw';
}

interface BetSlipContextType {
  slipItems: BetSlipItem[];
  slipItem: BetSlipItem | null; // For backward compatibility
  isSelectionActive: (matchId: string, outcome: 'home_win' | 'away_win' | 'draw') => boolean;
  addToSlip: (match: Match, outcome: 'home_win' | 'away_win' | 'draw') => void;
  removeFromSlip: (matchId: string) => void;
  clearSlip: () => void;
  isSlipOpen: boolean;
  setSlipOpen: (open: boolean) => void;
}

const BetSlipContext = createContext<BetSlipContextType | undefined>(undefined);

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [slipItems, setSlipItems] = useState<BetSlipItem[]>([]);
  const [isSlipOpen, setSlipOpen] = useState(false);

  const isSelectionActive = (matchId: string, outcome: 'home_win' | 'away_win' | 'draw'): boolean => {
    return slipItems.some(
      (item) => item.match.id === matchId && item.predictedOutcome === outcome
    );
  };

  const addToSlip = (match: Match, outcome: 'home_win' | 'away_win' | 'draw') => {
    setSlipItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.match.id === match.id);
      
      if (existingIndex > -1) {
        const existingItem = prev[existingIndex];
        // If same match and outcome, remove from slip (toggle)
        if (existingItem.predictedOutcome === outcome) {
          return prev.filter((item) => item.match.id !== match.id);
        }
        // If different outcome for same match, replace it
        const updated = [...prev];
        updated[existingIndex] = { match, predictedOutcome: outcome };
        return updated;
      }
      
      // Append new selection
      return [...prev, { match, predictedOutcome: outcome }];
    });
    setSlipOpen(true);
  };

  const removeFromSlip = (matchId: string) => {
    setSlipItems((prev) => prev.filter((item) => item.match.id !== matchId));
  };

  const clearSlip = () => {
    setSlipItems([]);
    setSlipOpen(false);
  };

  // Deprecated single selection property for full backward compatibility
  const slipItem = slipItems.length > 0 ? slipItems[0] : null;

  return (
    <BetSlipContext.Provider value={{
      slipItems,
      slipItem,
      isSelectionActive,
      addToSlip,
      removeFromSlip,
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
