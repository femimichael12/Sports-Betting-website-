/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBetSlip } from '../context/BetSlipContext';
import { 
  X, 
  Coins, 
  ArrowRight, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType, doc, setDoc, serverTimestamp } from '../lib/firebase';
import { Bet } from '../types';

export default function BetSlip() {
  const { profile, adjustBalance } = useAuth();
  const { slipItems, clearSlip, isSlipOpen, setSlipOpen, removeFromSlip } = useBetSlip();
  
  // Stakes specific to each matchId
  const [stakes, setStakes] = useState<Record<string, string>>({});
  const [masterStake, setMasterStake] = useState<string>('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Synchronize stakes object when active selections change
  useEffect(() => {
    setStakes((prev) => {
      const updated = { ...prev };
      let changed = false;
      
      slipItems.forEach((item) => {
        if (updated[item.match.id] === undefined) {
          updated[item.match.id] = '50'; // Default stake for a new match selection
          changed = true;
        }
      });
      
      // Clean up stakes for matches removed from slip
      Object.keys(updated).forEach((key) => {
        if (!slipItems.some((item) => item.match.id === key)) {
          delete updated[key];
          changed = true;
        }
      });
      
      return changed ? updated : prev;
    });
  }, [slipItems]);

  // Reset success state when list count drops to zero
  useEffect(() => {
    if (slipItems.length === 0) {
      setSuccess(false);
      setErr(null);
    }
  }, [slipItems]);

  if (slipItems.length === 0) return null;

  const handleUpdateSingleStake = (matchId: string, value: string) => {
    setStakes((prev) => ({
      ...prev,
      [matchId]: value
    }));
  };

  const handleApplyMasterStake = (value: string) => {
    setMasterStake(value);
    setStakes((prev) => {
      const updated = { ...prev };
      slipItems.forEach((item) => {
        updated[item.match.id] = value;
      });
      return updated;
    });
  };

  // Financial sums
  const totalStakeSum = slipItems.reduce((sum, item) => {
    const s = Number(stakes[item.match.id]) || 0;
    return sum + s;
  }, 0);

  const totalPayoutSum = slipItems.reduce((sum, item) => {
    const s = Number(stakes[item.match.id]) || 0;
    const oddsValue = item.predictedOutcome === 'home_win' 
      ? item.match.odds.homeWin 
      : item.predictedOutcome === 'away_win' 
        ? item.match.odds.awayWin 
        : item.match.odds.draw;
    return sum + (s * oddsValue);
  }, 0);

  const getOutcomeLabel = (item: any) => {
    if (item.predictedOutcome === 'home_win') return `${item.match.homeTeam} to Win`;
    if (item.predictedOutcome === 'away_win') return `${item.match.awayTeam} to Win`;
    return 'Draw Outcome';
  };

  const hasSufficientBalance = profile ? profile.balance >= totalStakeSum : false;

  const handlePlaceWager = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setErr(null);

    if (totalStakeSum <= 0) {
      setErr("Total wager stake must be greater than zero.");
      return;
    }

    if (!hasSufficientBalance) {
      setErr(`Insufficient credits. You need ₦${(totalStakeSum - profile.balance).toFixed(2)} more to place these wagers.`);
      return;
    }

    // Validate individual picks stakes
    for (const item of slipItems) {
      const itemStake = Number(stakes[item.match.id]) || 0;
      if (itemStake <= 0) {
        setErr(`Please assign a stake greater than ₦0 for: ${item.match.homeTeam} vs ${item.match.awayTeam}`);
        return;
      }
      if (itemStake > 10000000) {
        setErr("Maximum wager on a single match is ₦10,000,000.");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const betReceipts: string[] = [];
      
      // 1. Write each individual Bet document inside Firestore db in parallel
      for (const item of slipItems) {
        const itemStake = Number(stakes[item.match.id]) || 0;
        const oddsValue = item.predictedOutcome === 'home_win' 
          ? item.match.odds.homeWin 
          : item.predictedOutcome === 'away_win' 
            ? item.match.odds.awayWin 
            : item.match.odds.draw;
        const potentialPayout = Number((itemStake * oddsValue).toFixed(2));
        
        const betId = `bet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const betRef = doc(db, 'bets', betId);
        
        const newWager: Bet = {
          id: betId,
          userId: profile.userId,
          username: profile.username,
          matchId: item.match.id,
          sport: item.match.sport,
          homeTeam: item.match.homeTeam,
          awayTeam: item.match.awayTeam,
          predictedOutcome: item.predictedOutcome,
          odds: oddsValue,
          amount: itemStake,
          potentialWin: potentialPayout,
          status: 'pending',
          createdAt: serverTimestamp()
        };

        try {
          await setDoc(betRef, newWager);
          betReceipts.push(`₦${itemStake.toFixed(0)} on [${getOutcomeLabel(item)}]`);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `bets/${betId}`);
        }
      }

      // 2. Adjust Balance and publish Ledger audit Transaction Log once for the combined amount (avoids race conflicts)
      const ledgerDescription = `Placed ${slipItems.length} parallel bets at once. Details: ${betReceipts.join('; ')}`;
      await adjustBalance(-totalStakeSum, 'bet_placed', ledgerDescription);

      setSuccess(true);
      setTimeout(() => {
        clearSlip();
        setSuccess(false);
      }, 4000);

    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "An unexpected error occurred placing your bet ticket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isSlipOpen && (
        <motion.div
          id="fembet-active-betslip-drawer"
          initial={{ opacity: 0, y: 100, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.95 }}
          className="fixed bottom-6 right-6 z-50 w-full max-w-sm bg-geo-header border border-geo-border rounded-sm shadow-2xl overflow-hidden font-sans flex flex-col max-h-[90vh] md:max-h-[6400px]"
        >
          {/* Header */}
          <div className="bg-geo-bg p-4 border-b border-geo-border flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-geo-success animate-pulse" />
              <h3 className="font-display font-bold text-xs tracking-widest text-[#EAECEF] uppercase">
                Active Bet Slip ({slipItems.length})
              </h3>
            </div>
            <button 
              onClick={clearSlip}
              className="p-1 rounded-sm text-geo-text-muted hover:text-white hover:bg-geo-card transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Success Dialog Overlay */}
          {success ? (
            <div className="p-6 text-center space-y-4 bg-geo-success/5 flex-1 flex flex-col justify-center items-center">
              <div className="w-12 h-12 bg-geo-success/20 rounded-full flex items-center justify-center mx-auto border border-geo-success/30">
                <CheckCircle className="w-6 h-6 text-geo-success" />
              </div>
              <div className="space-y-1">
                <h4 className="font-display font-extrabold text-white text-base">Wagers Accepted</h4>
                <p className="text-xs text-geo-text-muted mt-1 max-w-[280px] mx-auto">
                  {slipItems.length} tickets have been successfully recorded in the decentralized Ledger index.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={clearSlip}
                  className="px-4 py-1.5 rounded-sm bg-geo-brand text-black font-bold hover:bg-geo-brand/90 transition-colors text-xs uppercase cursor-pointer"
                >
                  Dismiss Slip
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handlePlaceWager} className="p-4 flex flex-col space-y-4 overflow-hidden max-h-[75vh]">
              
              {/* Scrollable list of individual selections */}
              <div className="overflow-y-auto max-h-[260px] space-y-2.5 pr-1.5 select-none scrollbar-thin scrollbar-thumb-geo-border">
                {slipItems.map((item) => {
                  const oddsValue = item.predictedOutcome === 'home_win' 
                    ? item.match.odds.homeWin 
                    : item.predictedOutcome === 'away_win' 
                      ? item.match.odds.awayWin 
                      : item.match.odds.draw;
                  const itemStake = Number(stakes[item.match.id]) || 0;
                  const itemPayout = itemStake * oddsValue;

                  return (
                    <div 
                      key={item.match.id} 
                      className="bg-geo-bg border border-geo-border rounded-sm p-3 relative space-y-2 group hover:border-geo-border-light transition-colors"
                    >
                      {/* Delete individual selection from slip */}
                      <button
                        type="button"
                        onClick={() => removeFromSlip(item.match.id)}
                        className="absolute top-2.5 right-2.5 text-geo-text-muted hover:text-red-400 p-0.5 rounded-sm transition-colors cursor-pointer"
                        title="Remove choice"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      {/* Info header badges */}
                      <div className="flex items-center space-x-2 text-[8px] font-mono uppercase text-geo-text-muted">
                        <span className="bg-geo-card text-geo-text-light px-1.5 py-0.5 rounded-xs font-black">{item.match.sport}</span>
                        <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5 text-geo-brand" /> {item.match.status === 'live' ? `Live · ${item.match.minute}'` : 'Upcoming'}</span>
                      </div>

                      {/* Header description */}
                      <h4 className="text-xs text-white font-bold pr-6 truncate">
                        {item.match.homeTeam} <span className="text-geo-text-muted font-normal text-[9px]">VS</span> {item.match.awayTeam}
                      </h4>

                      {/* Outcome details line */}
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-geo-border/40">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-geo-text-muted uppercase font-mono">My Pick</span>
                          <span className="font-bold text-geo-text-light">{getOutcomeLabel(item)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-geo-text-muted uppercase font-mono block">Odds</span>
                          <span className="font-mono font-black text-geo-success text-xs bg-geo-success/10 px-1.5 py-0.2 rounded-xs border border-geo-success/15 leading-relaxed">{oddsValue.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Stake entry box for this selection */}
                      <div className="flex items-center gap-3 pt-2 mt-1 border-t border-geo-border/20">
                        <div className="flex-1">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-geo-text-muted font-mono text-xs">₦</span>
                            <input
                              type="number"
                              value={stakes[item.match.id] || ''}
                              onChange={(e) => handleUpdateSingleStake(item.match.id, e.target.value)}
                              placeholder="0"
                              min="1"
                              step="any"
                              className="w-full bg-geo-header border border-geo-border focus:border-geo-brand focus:outline-none rounded-xs py-1.5 pl-6 pr-2 text-xs font-mono font-bold text-white transition-colors"
                              required
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[8px] text-geo-text-muted font-mono uppercase block">Return</span>
                          <span className="font-mono text-[11px] font-black text-geo-success">
                            ₦{itemPayout.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                          </span>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>

              {/* Master / Universal Stake entry block (displays on multiple bets) */}
              {slipItems.length > 1 && (
                <div className="bg-geo-bg border border-geo-brand/10 rounded-sm p-3 space-y-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-geo-text-light uppercase tracking-wide flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-geo-brand" />
                      Set All Stakes At Once
                    </span>
                    <button
                      type="button"
                      onClick={() => handleApplyMasterStake('100')}
                      className="text-[9px] font-mono bg-geo-card px-1.5 py-0.5 rounded-xs border border-geo-border hover:border-geo-border-light text-geo-text-light transition-colors cursor-pointer"
                    >
                      Set 100 on All
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-geo-text-muted font-mono text-xs">₦</span>
                    <input
                      type="number"
                      value={masterStake}
                      onChange={(e) => handleApplyMasterStake(e.target.value)}
                      placeholder="Enter amount to apply globally..."
                      className="w-full bg-geo-header border border-geo-border focus:border-geo-brand focus:outline-none rounded-xs py-2 pl-7 pr-3 text-xs font-mono font-bold text-geo-text-light transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Account summary & pricing calculation details */}
              <div className="bg-geo-bg rounded-sm p-3 border border-geo-border divide-y divide-geo-border space-y-2 text-xs shrink-0">
                <div className="pb-1.5 flex items-center justify-between text-geo-text-muted">
                  <span className="uppercase text-[9px] font-extrabold tracking-wider">Total Stakes sum ({slipItems.length})</span>
                  <span className="font-mono text-geo-text-light font-bold">₦{totalStakeSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                {profile && (
                  <div className="py-1.5 flex items-center justify-between text-geo-text-muted font-mono text-[10px]">
                    <span className="flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-geo-brand" /> Wallet Balance
                    </span>
                    <span className="text-[#EAECEF] font-bold">₦{profile.balance.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
                  </div>
                )}
                <div className="pt-1.5 flex items-center justify-between">
                  <span className="text-geo-text-light font-bold uppercase text-[9px] tracking-wider">Combined Returns</span>
                  <span className="font-mono font-black text-sm text-geo-success tracking-tight">
                    ₦{totalPayoutSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Error summary */}
              {err && (
                <div className="flex gap-2 p-3 rounded-sm bg-red-950/20 border border-red-900/30 text-xs text-red-400 shrink-0">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  <span>{err}</span>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSubmitting || totalStakeSum <= 0}
                className={`w-full py-3.5 rounded-sm font-display font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                  isSubmitting || totalStakeSum <= 0
                    ? 'bg-geo-card text-geo-text-muted cursor-not-allowed border border-geo-border'
                    : 'bg-geo-brand text-black shadow-[0_4px_0_0_#C99B09] hover:shadow-[0_4px_0_0_#C99B09] active:translate-y-1 active:shadow-none'
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Minting Bet Slips...</span>
                  </span>
                ) : (
                  <span>Place {slipItems.length} Bets Now</span>
                )}
              </button>
            </form>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
