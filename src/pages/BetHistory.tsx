/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType, collection, query, where, onSnapshot } from '../lib/firebase';
import { Bet } from '../types';
import { 
  History, 
  Clock, 
  CheckCircle, 
  XSquare, 
  HelpCircle, 
  Coins, 
  ArrowUpRight,
  TrendingUp,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';

export default function BetHistory() {
  const { user } = useAuth();
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab ] = useState<'active' | 'settled'>('active');
  const [sportFilter, setSportFilter] = useState<string>('all');

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    // Query bets belonging strictly to current authenticated user
    const betsCollection = collection(db, 'bets');
    const q = query(betsCollection, where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Bet[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        items.push({
          id: doc.id,
          userId: d.userId,
          username: d.username,
          matchId: d.matchId,
          sport: d.sport,
          homeTeam: d.homeTeam,
          awayTeam: d.awayTeam,
          predictedOutcome: d.predictedOutcome,
          odds: d.odds,
          amount: d.amount,
          potentialWin: d.potentialWin,
          status: d.status,
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt || Date.now()),
          resolvedAt: d.resolvedAt?.toDate ? d.resolvedAt.toDate() : d.resolvedAt ? new Date(d.resolvedAt) : undefined,
        });
      });

      // Sort locally in memory by createdAt descending (Bulletproof from missing index errors)
      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setBets(items);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bets');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Filters bets by status (active vs settled) and sports type
  const sortedAndFilteredBets = bets.filter(bet => {
    const matchesTab = activeTab === 'active' 
      ? bet.status === 'pending' 
      : bet.status !== 'pending';
    
    if (!matchesTab) return false;
    if (sportFilter !== 'all' && bet.sport !== sportFilter) return false;
    return true;
  });

  const activeBetsCount = bets.filter(b => b.status === 'pending').length;
  const totalCareerReturns = bets
    .filter(b => b.status === 'won')
    .reduce((sum, b) => sum + b.potentialWin, 0);

  const formatOutcome = (outcome: string, home: string, away: string) => {
    if (outcome === 'home_win') return `${home} to Win`;
    if (outcome === 'away_win') return `${away} to Win`;
    return 'Draw Outcome';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center space-x-1.5 bg-[#C99B09]/15 border border-[#C99B09]/30 text-geo-brand px-3 py-1 rounded-sm text-xs font-bold leading-none uppercase tracking-wide">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            <span>Active</span>
          </span>
        );
      case 'won':
        return (
          <span className="inline-flex items-center space-x-1.5 bg-geo-success/15 border border-geo-success/30 text-geo-success px-3 py-1 rounded-sm text-xs font-bold leading-none uppercase tracking-wide">
            <CheckCircle className="w-3.5 h-3.5 text-geo-success" />
            <span>Won Slip</span>
          </span>
        );
      case 'lost':
        return (
          <span className="inline-flex items-center space-x-1.5 bg-red-950/20 border border-red-900/30 text-red-400 px-3 py-1 rounded-sm text-xs font-bold leading-none uppercase tracking-wide">
            <XSquare className="w-3.5 h-3.5 text-red-500" />
            <span>Settled Lost</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1.5 bg-geo-bg border border-geo-border text-geo-text-muted px-3 py-1 rounded-sm text-xs font-bold leading-none">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Cancelled</span>
          </span>
        );
    }
  };

  return (
    <div id="bet-history-view" className="space-y-6 max-w-5xl mx-auto">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-geo-border pb-5">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 bg-geo-card border border-geo-border rounded-sm flex items-center justify-center shadow-md">
            <History className="w-5.5 h-5.5 text-geo-brand" />
          </div>
          <div>
            <h1 className="font-display font-black text-2xl text-white tracking-tight uppercase">My Betting History</h1>
            <p className="text-xs text-geo-text-muted font-medium mt-0.5">Real-time ledger matching your placed wager slips.</p>
          </div>
        </div>

        {/* Basic summary metrics on settled career stakes */}
        <div className="flex items-center space-x-4 bg-geo-header border border-geo-border p-3 rounded-sm">
          <div className="px-4 border-r border-geo-border">
            <span className="text-[10px] text-geo-text-muted uppercase tracking-widest font-mono font-bold block">Total Returns</span>
            <span className="text-lg font-mono font-black text-geo-success mt-0.5 block flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-geo-success" />
              ₦{totalCareerReturns.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="px-3">
            <span className="text-[10px] text-geo-text-muted uppercase tracking-widest font-mono font-bold block">Active slips</span>
            <span className="text-lg font-mono font-black text-geo-text-light mt-0.5 block">{activeBetsCount} Tickets</span>
          </div>
        </div>
      </div>

      {/* Tabs and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-geo-header p-2 border border-geo-border rounded-sm">
        <div className="flex space-x-1 bg-geo-bg p-1 rounded-sm">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'active'
                ? 'bg-geo-brand text-black font-extrabold'
                : 'text-geo-text-muted hover:text-white'
            }`}
          >
            Active Tickets ({activeBetsCount})
          </button>
          <button
            onClick={() => setActiveTab('settled')}
            className={`px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'settled'
                ? 'bg-geo-brand text-black font-extrabold'
                : 'text-geo-text-muted hover:text-white'
            }`}
          >
            Settled Slips
          </button>
        </div>

        {/* Filter dropdown */}
        <div className="flex items-center space-x-2.5 w-full sm:w-auto">
          <SlidersHorizontal className="w-4 h-4 text-geo-text-muted" />
          <select
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value)}
            className="bg-geo-bg border border-geo-border text-geo-text-light text-xs rounded-sm px-3 py-2.5 focus:outline-none focus:border-geo-brand font-bold uppercase tracking-wide cursor-pointer"
          >
            <option value="all">All Arenas</option>
            <option value="football">Football ⚽</option>
            <option value="basketball">Basketball 🏀</option>
            <option value="tennis">Tennis 🎾</option>
            <option value="esports">Esports 🎮</option>
          </select>
        </div>
      </div>

      {/* Bets render area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-geo-text-muted space-y-2">
          <div className="w-8 h-8 border-2 border-geo-brand/20 border-t-geo-brand rounded-full animate-spin" />
          <span className="text-xs font-mono font-bold tracking-wider">Syncing wagers ledger...</span>
        </div>
      ) : sortedAndFilteredBets.length === 0 ? (
        <div className="bg-geo-card border border-geo-border rounded-sm p-12 text-center text-geo-text-muted max-w-lg mx-auto">
          <div className="w-12 h-12 bg-geo-bg rounded-sm flex items-center justify-center mx-auto mb-4 text-geo-text-muted border border-geo-border">
            <History className="w-5 h-5 text-geo-brand" />
          </div>
          <h3 className="font-display font-bold text-white text-base uppercase tracking-wider">No Tickets Found</h3>
          <p className="text-xs text-geo-text-muted mt-1 max-w-sm mx-auto font-medium leading-relaxed">
            You don't have any wagers matching this category. Visit the sports lobby to examine active odds and lock-in wagers.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedAndFilteredBets.map((bet) => (
            <motion.div
              key={bet.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-geo-card border border-geo-border rounded-sm p-4.5 hover:border-geo-border-light transition-all flex flex-col justify-between shadow-sm relative overflow-hidden"
            >
              {/* Card visual stripe matching outcome status */}
              <div className={`absolute top-0 left-0 right-0 h-[3px] ${
                bet.status === 'pending' ? 'bg-[#C99B09]/40' : bet.status === 'won' ? 'bg-geo-success' : 'bg-red-500/65'
              }`} />

              <div className="space-y-4">
                {/* Header info */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono uppercase bg-geo-bg text-geo-text-muted px-2 py-0.5 rounded-sm font-bold tracking-wider">
                      {bet.sport}
                    </span>
                    <h3 className="text-sm font-black text-white truncate max-w-[200px] mt-1">
                      {bet.homeTeam} <span className="text-geo-text-muted font-light text-xs">vs</span> {bet.awayTeam}
                    </h3>
                  </div>
                  {getStatusBadge(bet.status)}
                </div>

                {/* Bet Details */}
                <div className="grid grid-cols-3 gap-2 bg-geo-bg border border-geo-border p-3 rounded-sm text-center">
                  <div className="text-left">
                    <span className="text-[9px] text-geo-text-muted uppercase tracking-wider font-mono font-bold block">Prediction</span>
                    <span className="text-xs font-black text-geo-text-light mt-0.5 block truncate max-w-[120px]">
                      {formatOutcome(bet.predictedOutcome, bet.homeTeam, bet.awayTeam)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] text-geo-text-muted uppercase tracking-wider font-mono font-bold block">Wager Stake</span>
                    <span className="text-xs font-mono font-black text-geo-text-light mt-0.5 block">
                      ₦{bet.amount.toFixed(2)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[9px] text-geo-text-muted uppercase tracking-wider font-mono font-bold block">Odds</span>
                    <span className="text-xs font-mono font-black text-geo-brand mt-0.5 block">
                      {bet.odds.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer detail */}
              <div className="border-t border-geo-border mt-4 pt-3 flex items-center justify-between text-[11px] font-mono text-geo-text-muted">
                <div className="flex items-center space-x-1">
                  <span>ID:</span>
                  <span className="text-geo-text-light font-black">{bet.id.substring(4, 9).toUpperCase()}</span>
                </div>
                
                <div className="text-geo-text-muted font-bold flex items-center gap-1.5 leading-none">
                  {bet.status === 'won' ? (
                    <span className="text-geo-success font-black flex items-center gap-1">
                      Payout: +₦{bet.potentialWin.toFixed(2)}
                      <ArrowUpRight className="w-3 h-3 text-geo-success inline" />
                    </span>
                  ) : bet.status === 'lost' ? (
                    <span className="text-geo-text-muted font-medium line-through">
                      Potential: ₦{bet.potentialWin.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-geo-brand font-black flex items-center gap-1">
                      Est Payout: ₦{bet.potentialWin.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

            </motion.div>
          ))}
        </div>
      )}

    </div>
  );
}
