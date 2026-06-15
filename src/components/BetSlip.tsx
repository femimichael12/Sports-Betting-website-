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
  Flame,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType, doc, setDoc, serverTimestamp } from '../lib/firebase';
import { Bet } from '../types';

export default function BetSlip() {
  const { profile, adjustBalance } = useAuth();
  const { slipItem, clearSlip, isSlipOpen, setSlipOpen } = useBetSlip();
  const [stake, setStake] = useState<string>('50');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reset success state when selection changes
  useEffect(() => {
    setSuccess(false);
    setErr(null);
  }, [slipItem]);

  if (!slipItem) return null;

  const { match, predictedOutcome } = slipItem;

  // Retrieve matching odds value
  const oddsValue = predictedOutcome === 'home_win' 
    ? match.odds.homeWin 
    : predictedOutcome === 'away_win' 
      ? match.odds.awayWin 
      : match.odds.draw;

  const getOutcomeLabel = () => {
    if (predictedOutcome === 'home_win') return `${match.homeTeam} to Win`;
    if (predictedOutcome === 'away_win') return `${match.awayTeam} to Win`;
    return 'Draw Outcome';
  };

  const numericStake = Number(stake) || 0;
  const potentialPayout = Number((numericStake * oddsValue).toFixed(2));
  const hasSufficientBalance = profile ? profile.balance >= numericStake : false;

  const handlePlaceWager = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setErr(null);

    // Strict validation constraints
    if (numericStake <= 0) {
      setErr("Wager stake must be greater than zero.");
      return;
    }
    if (numericStake > 100000000) {
      setErr("Maximum wager on simulated matches is ₦100,000,000.");
      return;
    }
    if (!hasSufficientBalance) {
      setErr(`Insufficient credits. You need ₦${(numericStake - profile.balance).toFixed(2)} more.`);
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. Create unique Bet document record
      const betId = `bet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const betRef = doc(db, 'bets', betId);
      
      const newWager: Bet = {
        id: betId,
        userId: profile.userId,
        username: profile.username,
        matchId: match.id,
        sport: match.sport,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        predictedOutcome,
        odds: oddsValue,
        amount: numericStake,
        potentialWin: potentialPayout,
        status: 'pending',
        createdAt: serverTimestamp()
      };

      // Set the Wager in db
      try {
        await setDoc(betRef, newWager);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `bets/${betId}`);
      }

      // 2. Adjust Balance and publish Ledger audit Transaction Log
      const wagerDescription = `Stake of ₦${numericStake.toFixed(2)} on [${getOutcomeLabel()}] @ Odds ${oddsValue.toFixed(2)}`;
      await adjustBalance(-numericStake, 'bet_placed', wagerDescription);

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
          initial={{ opacity: 0, y: 100, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.95 }}
          className="fixed bottom-6 right-6 z-50 w-full max-w-sm bg-geo-header border border-geo-border rounded-sm shadow-2xl overflow-hidden font-sans"
        >
          {/* Header */}
          <div className="bg-geo-bg p-4 border-b border-geo-border flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-geo-success animate-pulse" />
              <h3 className="font-display font-bold text-xs tracking-widest text-[#EAECEF] uppercase">
                Active Bet Slip
              </h3>
            </div>
            <button 
              onClick={clearSlip}
              className="p-1 rounded-sm text-geo-text-muted hover:text-white hover:bg-geo-card transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Success Dialog Overlay */}
          {success ? (
            <div className="p-6 text-center space-y-4 bg-geo-success/5">
              <div className="w-12 h-12 bg-geo-success/20 rounded-full flex items-center justify-center mx-auto border border-geo-success/30">
                <CheckCircle className="w-6 h-6 text-geo-success" />
              </div>
              <div>
                <h4 className="font-display font-extrabold text-white text-base">Wager Accepted</h4>
                <p className="text-xs text-geo-text-muted mt-1 max-w-[220px] mx-auto">
                  Ticket has been successfully minted in Firestore Ledger index nodes.
                </p>
              </div>
              <div className="text-[10px] font-mono text-geo-brand bg-geo-brand/10 rounded-sm p-2 max-w-xs mx-auto border border-geo-brand/15">
                Outcome: {getOutcomeLabel()} @ {oddsValue.toFixed(2)}
              </div>
              <div className="pt-2">
                <button
                  onClick={clearSlip}
                  className="px-4 py-1.5 rounded-sm bg-geo-brand text-black font-bold hover:bg-geo-brand/90 transition-colors text-xs uppercase"
                >
                  Dismiss Slip
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handlePlaceWager} className="p-4 space-y-4">
              
              {/* Fixture Info card */}
              <div className="bg-geo-bg border border-geo-border rounded-sm p-3 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase text-geo-text-muted tracking-wider">
                  <span className="bg-geo-card text-geo-text-light px-1.5 py-0.5 rounded-sm font-semibold">{match.sport}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-geo-brand" /> {match.status === 'live' ? `Live · ${match.minute}'` : 'Upcoming'}</span>
                </div>
                
                <h4 className="text-xs text-white font-bold truncate mt-1">
                  {match.homeTeam} <span className="text-geo-text-muted font-normal text-[10px]">VS</span> {match.awayTeam}
                </h4>

                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-geo-border">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-geo-text-muted uppercase font-mono font-bold">My Selection</span>
                    <span className="text-xs font-bold text-geo-text-light leading-relaxed mt-0.5">{getOutcomeLabel()}</span>
                  </div>
                  <div className="bg-geo-success/15 border border-geo-success/20 rounded-sm px-2.5 py-1 text-center select-none">
                    <span className="text-[10px] text-geo-success font-mono font-bold block">ODDS</span>
                    <span className="text-sm font-mono font-extrabold text-geo-success">{oddsValue.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Stake input container */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-geo-text-muted">
                  <span className="uppercase tracking-wider">Stake Amount</span>
                  {profile && (
                    <span className="flex items-center gap-1 font-mono">
                      <Coins className="w-3.5 h-3.5 text-geo-brand" />
                      Credits: <b className="text-geo-text-light font-extrabold">₦{profile.balance.toFixed(0)}</b>
                    </span>
                  )}
                </div>
                
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-geo-text-muted font-mono text-sm leading-none">₦</span>
                  <input
                    type="number"
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    placeholder="0.00"
                    min="1"
                    step="any"
                    className="w-full bg-geo-bg border border-geo-border focus:border-geo-brand focus:outline-none rounded-sm py-3 pl-8 pr-16 text-sm font-mono font-bold text-[#EAECEF] transition-all"
                    required
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <button
                      type="button"
                      onClick={() => setStake('1000')}
                      className="text-[9px] font-mono uppercase font-bold px-1.5 py-1 rounded-sm bg-geo-card border border-geo-border text-geo-text-light hover:text-white hover:border-geo-border-light transition-colors cursor-pointer"
                    >
                      ₦1k
                    </button>
                    <button
                      type="button"
                      onClick={() => profile && setStake(Math.floor(profile.balance).toString())}
                      className="text-[9px] font-mono uppercase font-bold px-1.5 py-1 rounded-sm bg-geo-card border border-geo-border text-geo-brand hover:text-geo-brand/80 hover:border-geo-brand/40 transition-colors cursor-pointer"
                    >
                      MAX
                    </button>
                  </div>
                </div>
              </div>

              {/* Financial calculations */}
              <div className="bg-geo-bg rounded-sm p-3 border border-geo-border divide-y divide-geo-border text-xs">
                <div className="pb-2 flex items-center justify-between text-geo-text-muted">
                  <span>Wager Stake</span>
                  <span className="font-mono text-geo-text-light font-bold">₦{numericStake.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-geo-text-light font-bold">Potential Returns</span>
                  <span className="font-mono font-black text-sm text-geo-success tracking-tight">
                    ₦{potentialPayout.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Error messages if any */}
              {err && (
                <div className="flex gap-2 p-3 rounded-sm bg-red-950/20 border border-red-900/30 text-xs text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  <span>{err}</span>
                </div>
              )}

              {/* Action Button: yellow high-fidelity 3D Press styling */}
              <button
                type="submit"
                disabled={isSubmitting || numericStake <= 0}
                className={`w-full py-3.5 rounded-sm font-display font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                  isSubmitting || numericStake <= 0
                    ? 'bg-geo-card text-geo-text-muted cursor-not-allowed border border-geo-border'
                    : 'bg-geo-brand text-black shadow-[0_4px_0_0_#C99B09] hover:shadow-[0_4px_0_0_#C99B09] active:translate-y-1 active:shadow-none'
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Transmitting Slip...</span>
                  </span>
                ) : (
                  <span>Place Bet Now</span>
                )}
              </button>
            </form>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
