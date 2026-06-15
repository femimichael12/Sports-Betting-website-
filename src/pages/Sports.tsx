/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBetSlip } from '../context/BetSlipContext';
import { useSportsData } from '../hooks/useSportsData';
import { db, handleFirestoreError, OperationType, collection, onSnapshot, doc, setDoc, serverTimestamp, query, where, getDocs } from '../lib/firebase';
import { Match, Bet } from '../types';
import { 
  Trophy, 
  Flame, 
  Search, 
  Activity, 
  Gamepad2, 
  LineChart, 
  CheckCircle, 
  HelpCircle, 
  Tv, 
  Zap, 
  Info, 
  Compass, 
  Filter, 
  Calendar, 
  Award,
  ChevronRight,
  Calculator,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Seed list in case no matches exist in db (safety fallback)
const DEMO_FIXTURES: Omit<Match, 'createdAt'>[] = [
  {
    id: 'match_fb_el_clasico',
    sport: 'football',
    homeTeam: 'Real Madrid',
    awayTeam: 'FC Barcelona',
    commencesAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    status: 'upcoming',
    odds: { homeWin: 1.95, awayWin: 2.35, draw: 3.40 },
    score: { home: 0, away: 0 },
    minute: 0,
    result: 'pending',
  },
  {
    id: 'match_bb_nba_finals',
    sport: 'basketball',
    homeTeam: 'LA Lakers',
    awayTeam: 'Boston Celtics',
    commencesAt: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
    status: 'upcoming',
    odds: { homeWin: 1.80, awayWin: 2.10, draw: 12.00 },
    score: { home: 0, away: 0 },
    minute: 0,
    result: 'pending',
  },
  {
    id: 'match_es_worlds',
    sport: 'esports',
    homeTeam: 'T1 esports',
    awayTeam: 'G2 Gaming',
    commencesAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    status: 'upcoming',
    odds: { homeWin: 1.45, awayWin: 2.75, draw: 6.50 },
    score: { home: 0, away: 0 },
    minute: 0,
    result: 'pending',
  },
  {
    id: 'match_tn_nadal_djoko',
    sport: 'tennis',
    homeTeam: 'Carlos Alcaraz',
    awayTeam: 'Jannik Sinner',
    commencesAt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
    status: 'upcoming',
    odds: { homeWin: 1.68, awayWin: 2.15, draw: 22.00 },
    score: { home: 0, away: 0 },
    minute: 0,
    result: 'pending',
  }
];

const StatComparisonBar = ({ label, home, away, isPerc = false }: { label: string; home: number; away: number; isPerc?: boolean }) => {
  const total = (home + away) || 1;
  const hPerc = isPerc ? home : (home / total) * 100;
  const aPerc = isPerc ? away : (away / total) * 100;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-mono font-bold text-geo-text-light uppercase tracking-wider">
        <span className="text-geo-success font-black">{home}{isPerc ? '%' : ''}</span>
        <span className="text-geo-text-muted text-[9px] tracking-widest">{label}</span>
        <span className="text-geo-brand font-black">{away}{isPerc ? '%' : ''}</span>
      </div>
      <div className="h-1.5 bg-geo-bg rounded-sm overflow-hidden flex border border-geo-border">
        <div className="h-full bg-geo-success transition-all duration-500" style={{ width: `${hPerc}%` }} />
        <div className="h-full bg-geo-brand transition-all duration-500" style={{ width: `${aPerc}%` }} />
      </div>
    </div>
  );
};

const renderOddsBadge = (type: 'up' | 'down' | null, oddsValue: number) => {
  if (type === 'up') {
    return (
      <span className="inline-flex items-center space-x-1 text-emerald-400 font-mono font-black animate-pulse">
        <span>{oddsValue.toFixed(2)}</span>
        <span className="text-[10px] text-emerald-400 font-bold">▲</span>
      </span>
    );
  }
  if (type === 'down') {
    return (
      <span className="inline-flex items-center space-x-1 text-rose-400 font-mono font-black animate-pulse">
        <span>{oddsValue.toFixed(2)}</span>
        <span className="text-[10px] text-rose-400 font-bold">▼</span>
      </span>
    );
  }
  return <span className="text-white font-black text-xs font-mono">{oddsValue.toFixed(2)}</span>;
};

export default function Sports() {
  const { profile, adjustBalance } = useAuth();
  const { addToSlip, slipItem } = useBetSlip();

  const {
    matches,
    loading,
    error,
    lobbyView,
    setLobbyView,
    activeAnalysisMatch,
    setActiveAnalysisMatch,
    matchStats,
    statsLoading,
    standings,
    standingsLoading,
    teamStats,
    teamStatsLoading,
    // Live Sports Center outputs
    oddsChanges,
    timelineEvents,
    notifications,
    dismissNotification,
    optimisticTriggerEvent,
  } = useSportsData(12000); // Auto-polls live matches and odds updates every 12 seconds with graceful error boundaries

  // Filtering & Sorting State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'time' | 'oddsHome' | 'oddsAway'>('time');

  // Interactive Live Center Multi-Tab View Classification
  const [analysisTab, setAnalysisTab] = useState<'simulation' | 'stats' | 'timeline'>('simulation');

  // Sports Odds Quick Simulator Calculator State
  const [calcStake, setCalcStake] = useState('100');
  const [calcOdds, setCalcOdds] = useState('2.00');
  const [calcReturn, setCalcReturn] = useState(200);

  // Synchronize matches with Firestore to support user betting logic seamlessly
  useEffect(() => {
    if (matches.length === 0) return;
    const syncToFirestore = async () => {
      try {
        for (const m of matches) {
          const mRef = doc(db, 'matches', m.id);
          await setDoc(mRef, {
            sport: m.sport,
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            commencesAt: m.commencesAt,
            status: m.status,
            odds: m.odds,
            score: m.score,
            minute: m.minute ?? 0,
            result: m.result,
            createdAt: serverTimestamp()
          }, { merge: true });
        }
      } catch (err) {
        console.warn('[SPORTS SYNCER] Silent background sync exception:', err);
      }
    };
    syncToFirestore();
  }, [matches]);

  // Client-side Bet Settlement Reactor
  useEffect(() => {
    if (!profile || matches.length === 0) return;

    const resolvePendingBets = async () => {
      try {
        const betsColl = collection(db, 'bets');
        const qPending = query(
          betsColl,
          where('userId', '==', profile.userId),
          where('status', '==', 'pending')
        );

        const querySnapshot = await getDocs(qPending);
        if (querySnapshot.empty) return;

        for (const betDoc of querySnapshot.docs) {
          const betData = betDoc.data() as Bet;
          const correspondingMatch = matches.find(m => m.id === betData.matchId);
          
          if (correspondingMatch && correspondingMatch.status === 'completed') {
            const actualResult = correspondingMatch.result;
            const isWon = betData.predictedOutcome === actualResult;

            const finalStatus = isWon ? 'won' : 'lost';
            const payout = isWon ? betData.potentialWin : 0;

            console.log(`[SETTLEMENT SYSTEM] Resolving Ticket ${betData.id}: Final state: ${finalStatus}`);

            // Update bet document in firestore
            await setDoc(doc(db, 'bets', betData.id), {
              status: finalStatus,
              resolvedAt: serverTimestamp()
            }, { merge: true });

            // If user won, add winnings back into user wallet ledger
            if (payout > 0) {
              const paymentDescription = `Wager ticket payout [${correspondingMatch.homeTeam} vs ${correspondingMatch.awayTeam}] id #${betData.id.substring(4, 9).toUpperCase()}`;
              await adjustBalance(payout, 'bet_payout', paymentDescription);
            }
          }
        }
      } catch (err) {
        console.error("Bet Settlement Reactor Error:", err);
      }
    };

    resolvePendingBets();
  }, [matches, profile, adjustBalance]);

  // Quick live odds converter for calculator
  useEffect(() => {
    const stakeNum = parseFloat(calcStake) || 0;
    const oddsNum = parseFloat(calcOdds) || 1;
    setCalcReturn(stakeNum * oddsNum);
  }, [calcStake, calcOdds]);

  // Set calculator odds from selected match or prediction option
  const loadOddsToCalculator = (odds: number) => {
    setCalcOdds(odds.toFixed(2));
  };

  // Helper selectors
  const getSportEmoji = (sport: string) => {
    switch (sport) {
      case 'football': return '⚽';
      case 'basketball': return '🏀';
      case 'tennis': return '🎾';
      case 'esports': return '🎮';
      default: return '🏆';
    }
  };

  const getSportColor = (sport: string) => {
    switch (sport) {
      case 'football': return 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5';
      case 'basketball': return 'border-orange-500/30 text-orange-400 bg-orange-500/5';
      case 'tennis': return 'border-yellow-500/30 text-yellow-400 bg-yellow-500/5';
      case 'esports': return 'border-cyan-500/30 text-cyan-400 bg-cyan-500/5';
      default: return 'border-geo-border text-geo-text-light bg-geo-card';
    }
  };

  // Run filters
  const filteredMatches = matches.filter(match => {
    // Sport tab
    if (selectedSport !== 'all' && match.sport !== selectedSport) return false;

    // Status filter
    if (statusFilter !== 'all' && match.status !== statusFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = `${match.homeTeam} vs ${match.awayTeam} ${match.sport}`.toLowerCase();
      return matchText.includes(q);
    }

    return true;
  });

  // Apply sorting
  const sortedAndFilteredMatches = [...filteredMatches].sort((a, b) => {
    if (sortBy === 'time') {
      return new Date(a.commencesAt).getTime() - new Date(b.commencesAt).getTime();
    }
    if (sortBy === 'oddsHome') {
      return b.odds.homeWin - a.odds.homeWin;
    }
    if (sortBy === 'oddsAway') {
      return b.odds.awayWin - a.odds.awayWin;
    }
    return 0;
  });

  // Match statistics generator for Drawer/Details
  const getH2HStats = (match: Match) => {
    // Semi-stochastic details
    const charCodeSum = match.homeTeam.charCodeAt(0) + match.awayTeam.charCodeAt(0);
    const winRateHome = Math.floor(45 + (charCodeSum % 20));
    const winRateAway = 100 - winRateHome - 15; // 15% draw
    const lastFiveHome = ['W', 'D', 'W', 'L', 'W'];
    const lastFiveAway = ['D', 'W', 'L', 'W', 'D'];

    return {
      winRateHome,
      winRateAway,
      winRateDraw: 15,
      lastFiveHome,
      lastFiveAway,
      simulatedPopularity: 82 + (charCodeSum % 18)
    };
  };

  return (
    <div id="sports-hub-page" className="space-y-6 relative">

      {/* Real-time Toast Alerts Banner */}
      <div className="fixed top-4 right-4 z-50 space-y-2.5 w-80 pointer-events-none">
        <AnimatePresence>
          {notifications.map((note) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              className={`pointer-events-auto p-3.5 rounded-sm border shadow-2xl flex items-start gap-3 bg-[#0d1017] ${
                note.type === 'goal'
                  ? 'border-emerald-500/80 shadow-emerald-950/20'
                  : note.type === 'red_card'
                    ? 'border-rose-500/80 shadow-rose-950/20'
                    : 'border-geo-brand/80 shadow-yellow-950/20'
              }`}
            >
              <div className="space-y-1.5 flex-1 overflow-hidden">
                <div className="flex items-center gap-1.5 justify-between">
                  <span className={`text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded-sm border ${
                    note.type === 'goal'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : note.type === 'red_card'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-geo-brand/10 text-geo-brand border-geo-brand/35'
                  }`}>
                    {note.type === 'goal' ? '⚽ Goal Active' : note.type === 'red_card' ? '🔴 Dismissed' : '📢 Event'}
                  </span>
                  <span className="text-[8px] text-geo-text-muted font-mono truncate max-w-[120px]">{note.matchTitle}</span>
                </div>
                <p className="text-[11px] text-white font-extrabold leading-snug">
                  {note.message}
                </p>
              </div>
              <button
                onClick={() => dismissNotification(note.id)}
                className="text-geo-text-muted hover:text-white text-[11px] font-mono cursor-pointer transition-colors"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {/* 1. Header Hero Panel */}
      <div className="bg-geo-header border border-geo-border p-6 rounded-sm relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-geo-brand/5 to-transparent pointer-events-none" />
        
        <div className="space-y-1.5 z-10">
          <div className="inline-flex items-center space-x-1.5 bg-geo-brand/10 border border-geo-brand/20 text-geo-brand px-2.5 py-0.5 rounded-sm font-mono text-[9px] font-bold tracking-widest uppercase">
            <Compass className="w-3.5 h-3.5" />
            <span>GLOBAL WAGER CO-COEFFICIENTS</span>
          </div>
          <h1 className="font-display font-black text-xl sm:text-2xl text-white uppercase tracking-tight leading-none mt-1">
            SPORTSBOOKS LOBBY
          </h1>
          <p className="text-xs text-geo-text-muted max-w-xl font-medium leading-relaxed">
            Real odds mappings across Football, Basketball, Tennis, and Esports. Compare live status indicators, calculate mock payout returns, and build your simulated slips instantly.
          </p>
        </div>

        {/* Quick balance display */}
        <div className="flex items-center space-x-4 shrink-0 bg-geo-card border border-geo-border p-3 rounded-sm z-10 w-full md:w-auto">
          <div className="w-10 h-10 rounded-sm bg-geo-brand/10 border border-geo-brand/20 flex items-center justify-center text-geo-brand">
            <Trophy className="w-5 h-5 text-geo-brand" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-geo-text-muted uppercase tracking-wider font-bold">
              PORTFOLIO LEDGER
            </div>
            <div className="text-base font-mono font-black text-geo-success leading-none">
              ₦{profile?.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main content structure */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Filter bar & Match cards (grid span 8) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* LOBBY VIEW TAB SELECTORS */}
          <div className="flex bg-geo-header border border-geo-border p-1 rounded-sm gap-1">
            <button
              onClick={() => setLobbyView('fixtures')}
              className={`flex-1 py-2 text-center text-xs font-mono font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer ${
                lobbyView === 'fixtures'
                  ? 'bg-geo-brand text-black font-extrabold shadow-sm'
                  : 'text-geo-text-muted hover:text-white hover:bg-geo-card/40'
              }`}
            >
              ⚽ Live Fixtures Lobby
            </button>
            <button
              onClick={() => setLobbyView('standings')}
              className={`flex-1 py-2 text-center text-xs font-mono font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer ${
                lobbyView === 'standings'
                  ? 'bg-geo-brand text-black font-extrabold shadow-sm'
                  : 'text-geo-text-muted hover:text-white hover:bg-geo-card/40'
              }`}
            >
              📊 League Standings Table
            </button>
          </div>

          {lobbyView === 'fixtures' ? (
            <>
              {/* SEARCH & FILTERS CONTROLS BLOCK */}
              <div className="bg-geo-header border border-geo-border rounded-sm p-4 space-y-4">
            
            {/* Search Input and status tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              
              <div className="sm:col-span-6 relative">
                <span className="absolute left-3 top-1/2 -to-translate-y-1/2 text-geo-text-muted">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter key teams e.g. Madrid, Lakers..."
                  className="w-full bg-geo-bg border border-geo-border focus:border-geo-brand focus:outline-none rounded-sm py-2 px-9 text-xs font-bold text-geo-text-light uppercase tracking-wider placeholder-geo-text-muted/50"
                />
              </div>

              {/* Status selectors */}
              <div className="sm:col-span-6 flex gap-1.5 bg-geo-bg p-1 border border-geo-border rounded-sm overflow-x-auto scrollbar-none">
                {(['all', 'live', 'upcoming', 'completed'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`flex-1 py-1.5 px-2.5 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0 ${
                      statusFilter === status
                        ? 'bg-geo-card text-geo-brand border border-geo-brand/20 font-black'
                        : 'text-geo-text-muted hover:text-geo-text-light'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

            </div>

            {/* Sports tab row + Sorting drop dropdown */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-geo-border/55 border-dashed">
              
              {/* Category selector */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                {[
                  { id: 'all', label: 'All Arenas', emoji: '🏆' },
                  { id: 'football', label: 'Football', emoji: '⚽' },
                  { id: 'basketball', label: 'Basketball', emoji: '🏀' },
                  { id: 'tennis', label: 'Tennis', emoji: '🎾' },
                  { id: 'esports', label: 'Esports', emoji: '🎮' }
                ].map((sport) => (
                  <button
                    key={sport.id}
                    onClick={() => setSelectedSport(sport.id)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wider cursor-pointer border shrink-0 transition-all ${
                      selectedSport === sport.id
                        ? 'bg-geo-card text-geo-brand border-geo-brand/35 shadow-sm'
                        : 'bg-geo-bg text-geo-text-muted border-geo-border hover:border-geo-border-light hover:text-white'
                    }`}
                  >
                    <span>{sport.emoji}</span>
                    <span>{sport.label}</span>
                  </button>
                ))}
              </div>

              {/* Sorting options */}
              <div className="flex items-center space-x-2 shrink-0 bg-geo-bg border border-geo-border px-2.5 py-1 rounded-sm">
                <Filter className="w-3.5 h-3.5 text-geo-text-muted" />
                <span className="text-[9px] font-mono font-bold text-geo-text-muted uppercase">SORT BY:</span>
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="bg-transparent text-[10px] font-mono font-bold text-white focus:outline-none uppercase border-none cursor-pointer"
                >
                  <option value="time" className="bg-[#161a1f] text-white">Fixture Schedule</option>
                  <option value="oddsHome" className="bg-[#161a1f] text-white">Highest Home Odds</option>
                  <option value="oddsAway" className="bg-[#161a1f] text-white">Highest Away Odds</option>
                </select>
              </div>

            </div>

          </div>

          {/* REAL MATCH CARDS STREAM */}
          {loading ? (
            <div className="bg-geo-header border border-geo-border rounded-sm py-20 flex flex-col items-center justify-center gap-3 text-geo-text-muted">
              <div className="w-8 h-8 border-2 border-geo-brand/10 border-t-geo-brand rounded-full animate-spin" />
              <span className="text-xs font-mono font-bold tracking-widest uppercase">CONNECTING ARENA BUZZER...</span>
            </div>
          ) : sortedAndFilteredMatches.length === 0 ? (
            <div className="bg-geo-header border border-geo-border rounded-sm py-16 px-6 text-center max-w-md mx-auto relative overflow-hidden">
              <HelpCircle className="w-10 h-10 text-geo-text-muted/50 mx-auto mb-3" />
              <h4 className="font-display font-black text-sm text-white uppercase tracking-wider">
                NO CORRESPONDING FILEXTURES LINKED
              </h4>
              <p className="text-xs text-geo-text-muted mt-1.5 leading-relaxed font-semibold">
                No active events correspond with your filtering metrics. Reset search queries or try a different sports category block.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedSport('all');
                  setStatusFilter('all');
                }}
                className="mt-4 px-4 py-2 bg-geo-bg border border-geo-border text-[10px] font-mono tracking-wider text-geo-brand hover:bg-geo-card rounded-sm font-bold uppercase"
              >
                Reset Match Queries
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {sortedAndFilteredMatches.map((match) => {
                const isSelectedForAnalysis = activeAnalysisMatch?.id === match.id;
                const formattedTime = new Date(match.commencesAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const formattedDate = new Date(match.commencesAt).toLocaleDateString([], { month: 'short', day: 'numeric' });

                return (
                  <motion.div
                    key={match.id}
                    layoutId={`match-card-${match.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-geo-header border rounded-sm p-4 transition-all relative overflow-hidden ${
                      isSelectedForAnalysis ? 'border-geo-brand' : 'border-geo-border hover:border-geo-border-light'
                    }`}
                  >
                    {/* Tiny upper tag row */}
                    <div className="flex items-center justify-between text-[9px] font-mono font-bold uppercase relative z-10">
                      <div className="flex items-center space-x-2.5">
                        <span className={`px-2 py-0.5 rounded-sm border ${getSportColor(match.sport)}`}>
                          {getSportEmoji(match.sport)} {match.sport}
                        </span>
                        
                        {match.status === 'live' ? (
                          <span className="flex items-center space-x-1.5 text-red-500 bg-red-950/20 border border-red-900/30 rounded-sm px-2 animate-pulse">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                            LIVE • {match.minute}'
                          </span>
                        ) : match.status === 'completed' ? (
                          <span className="text-geo-text-muted bg-[#21262d] border border-geo-border px-1.5 rounded-sm font-bold">
                            Completed
                          </span>
                        ) : (
                          <span className="text-geo-brand bg-geo-brand/5 border border-geo-brand/20 px-1.5 rounded-sm font-bold flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-geo-brand inline" />
                            {formattedDate} @ {formattedTime}
                          </span>
                        )}
                      </div>

                      {/* Details analysis button indicator */}
                      <button
                        onClick={() => setActiveAnalysisMatch(match)}
                        className={`text-[9px] font-mono font-bold uppercase transition-colors px-2 py-1 rounded-sm border ${
                          isSelectedForAnalysis 
                            ? 'bg-geo-brand text-black border-geo-brand' 
                            : 'bg-geo-bg hover:bg-geo-card border-geo-border text-geo-text-muted hover:text-white'
                        }`}
                      >
                        H2H Stats <ChevronRight className="w-3 h-3 inline ml-0.5" />
                      </button>
                    </div>

                    {/* Central Area: Team Mappings & Live Score */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 my-4 relative z-10">
                      
                      <div className="md:col-span-7 flex flex-col justify-center space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm sm:text-base tracking-tight font-black uppercase ${match.result === 'home_win' ? 'text-geo-success' : 'text-white'}`}>
                            {match.homeTeam}
                          </span>
                          <span className="text-[10px] text-geo-text-muted font-mono font-bold">HOME</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className={`text-sm sm:text-base tracking-tight font-black uppercase ${match.result === 'away_win' ? 'text-geo-success' : 'text-white'}`}>
                            {match.awayTeam}
                          </span>
                          <span className="text-[10px] text-geo-text-muted font-mono font-bold">AWAY</span>
                        </div>
                      </div>

                      {/* Live Score/Pending marker */}
                      <div className="md:col-span-5 flex items-center justify-end">
                        {match.status !== 'upcoming' ? (
                          <div className="bg-geo-bg border border-geo-border px-4 py-2.5 rounded-sm font-mono text-base font-black text-center flex items-center justify-center space-x-1.5 min-w-[90px] shadow-inner">
                            <span className="text-geo-success">{match.score.home}</span>
                            <span className="text-geo-text-muted font-light">:</span>
                            <span className="text-geo-success">{match.score.away}</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-geo-text-muted text-right font-mono font-bold uppercase border border-geo-border px-3 py-2 bg-geo-bg rounded-sm min-w-[90px]">
                            Pending <br/>Kickoff
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Bottom segment: Interactive Odds Button Terminal */}
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-geo-border border-dashed relative z-10">
                      
                      {/* Home Choice block */}
                      <button
                        onClick={() => match.status !== 'completed' && addToSlip(match, 'home_win')}
                        disabled={match.status === 'completed'}
                        className={`py-2 px-3 rounded-sm border flex flex-col sm:flex-row items-center justify-between gap-1 transition-all select-none cursor-pointer ${
                          slipItem?.match.id === match.id && slipItem?.predictedOutcome === 'home_win'
                            ? 'bg-geo-brand border-geo-brand text-black font-extrabold'
                            : match.status === 'completed'
                              ? 'bg-geo-bg/30 border-geo-border text-geo-text-muted/40 cursor-not-allowed'
                              : 'bg-geo-bg border border-geo-border text-geo-text-muted hover:border-geo-brand hover:text-white font-bold'
                        }`}
                      >
                        <div className="flex items-center space-x-1">
                          <span className="text-[9px] font-mono uppercase tracking-widest font-black opacity-85">1 • Home</span>
                        </div>
                        <span className="text-xs font-mono font-black" onClick={(e) => { e.stopPropagation(); loadOddsToCalculator(match.odds.homeWin); }}>
                          {renderOddsBadge(oddsChanges[match.id]?.homeWin, match.odds.homeWin)}
                        </span>
                      </button>

                      {/* Draw Choice block */}
                      <button
                        onClick={() => match.status !== 'completed' && addToSlip(match, 'draw')}
                        disabled={match.status === 'completed'}
                        className={`py-2 px-3 rounded-sm border flex flex-col sm:flex-row items-center justify-between gap-1 transition-all select-none cursor-pointer ${
                          slipItem?.match.id === match.id && slipItem?.predictedOutcome === 'draw'
                            ? 'bg-geo-brand border-geo-brand text-black font-extrabold'
                            : match.status === 'completed'
                              ? 'bg-geo-bg/30 border-geo-border text-geo-text-muted/40 cursor-not-allowed'
                              : 'bg-geo-bg border border-geo-border text-geo-text-muted hover:border-geo-brand hover:text-white font-bold'
                        }`}
                      >
                        <div className="flex items-center space-x-1">
                          <span className="text-[9px] font-mono uppercase tracking-widest font-black opacity-85">X • Draw</span>
                        </div>
                        <span className="text-xs font-mono font-black" onClick={(e) => { e.stopPropagation(); loadOddsToCalculator(match.odds.draw); }}>
                          {renderOddsBadge(oddsChanges[match.id]?.draw, match.odds.draw)}
                        </span>
                      </button>

                      {/* Away Choice block */}
                      <button
                        onClick={() => match.status !== 'completed' && addToSlip(match, 'away_win')}
                        disabled={match.status === 'completed'}
                        className={`py-2 px-3 rounded-sm border flex flex-col sm:flex-row items-center justify-between gap-1 transition-all select-none cursor-pointer ${
                          slipItem?.match.id === match.id && slipItem?.predictedOutcome === 'away_win'
                            ? 'bg-geo-brand border-geo-brand text-black font-extrabold'
                            : match.status === 'completed'
                              ? 'bg-[#1e2329]/30 border-geo-border text-[#5d6570] cursor-not-allowed'
                              : 'bg-geo-bg border border-geo-border text-geo-text-muted hover:border-geo-brand hover:text-white font-bold'
                        }`}
                      >
                        <div className="flex items-center space-x-1">
                          <span className="text-[9px] font-mono uppercase tracking-widest font-black opacity-85">2 • Away</span>
                        </div>
                        <span className="text-xs font-mono font-black" onClick={(e) => { e.stopPropagation(); loadOddsToCalculator(match.odds.awayWin); }}>
                          {renderOddsBadge(oddsChanges[match.id]?.awayWin, match.odds.awayWin)}
                        </span>
                      </button>

                    </div>

                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Standings View representation */
        <div className="bg-geo-header border border-geo-border rounded-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-geo-border pb-3">
            <div className="flex items-center space-x-2">
              <Trophy className="w-4 h-4 text-geo-brand" />
              <h3 className="font-display font-black text-xs uppercase tracking-wider text-white">
                Official League Standings
              </h3>
            </div>
            <span className="text-[9px] font-mono text-geo-brand bg-geo-brand/10 border border-geo-brand/20 px-1.5 py-0.5 rounded-sm uppercase tracking-widest font-black">
              Premier League Table
            </span>
          </div>

          {standingsLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-geo-text-muted">
              <div className="w-5 h-5 border-2 border-geo-brand/10 border-t-geo-brand rounded-full animate-spin" />
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase">Fetching Standings...</span>
            </div>
          ) : standings.length === 0 ? (
            <div className="py-12 text-center text-xs text-geo-text-muted font-bold font-mono">
              League Standings Feed Offline
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-none">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-geo-border font-mono text-[9px] text-geo-text-muted uppercase tracking-wider">
                    <th className="py-2.5 px-2 text-center w-10 font-bold">Rank</th>
                    <th className="py-2.5 px-2 font-bold">Club</th>
                    <th className="py-2.5 px-2 text-center font-bold">MP</th>
                    <th className="py-2.5 px-2 text-center font-bold hidden sm:table-cell">W</th>
                    <th className="py-2.5 px-2 text-center font-bold hidden sm:table-cell">D</th>
                    <th className="py-2.5 px-2 text-center font-bold hidden sm:table-cell">L</th>
                    <th className="py-2.5 px-2 text-center font-bold">GD</th>
                    <th className="py-2.5 px-2 text-center text-geo-brand font-black">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-geo-border/50">
                  {standings.map((team: any, i: number) => (
                    <tr 
                      key={team.teamId || i} 
                      className="hover:bg-geo-card/45 transition-colors font-medium border-b border-geo-border/30"
                    >
                      <td className="py-2.5 px-2 text-center font-mono text-geo-text-muted font-bold">
                        {team.rank}
                      </td>
                      <td className="py-2.5 px-2 text-white font-black uppercase tracking-tight">
                        <div className="flex items-center gap-2">
                          {team.logo && <img src={team.logo} alt="" className="w-4 h-4 object-contain" referrerPolicy="no-referrer" />}
                          <span>{team.teamName}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-semibold">
                        {team.played}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-geo-text-muted hidden sm:table-cell">
                        {team.win}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-geo-text-muted hidden sm:table-cell">
                        {team.draw}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-geo-text-muted hidden sm:table-cell">
                        {team.lose}
                      </td>
                      <td className={`py-2.5 px-2 text-center font-mono font-bold ${team.goalsDiff > 0 ? 'text-geo-success' : team.goalsDiff < 0 ? 'text-red-400' : 'text-geo-text-muted'}`}>
                        {team.goalsDiff > 0 ? `+${team.goalsDiff}` : team.goalsDiff}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-black text-geo-brand bg-geo-brand/5">
                        {team.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

        </div>

        {/* Right Side: Active Head-2-Head Match Analytics Panel & Odds Calculator (grid size 4) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* A. REAL-TIME SPORTS CENTER & H2H STADIUM TERMINAL */}
          {activeAnalysisMatch ? (() => {
            const stats = getH2HStats(activeAnalysisMatch);
            return (
              <div className="bg-geo-header border border-geo-border rounded-sm p-5 shadow-md space-y-5">
                
                {/* Sports Center Header */}
                <div className="flex items-center justify-between border-b border-geo-border pb-3">
                  <div className="flex items-center space-x-2">
                    <Tv className="w-4.5 h-4.5 text-geo-brand animate-pulse" />
                    <h3 className="font-display font-black text-xs uppercase tracking-wider text-white">
                      Live Sports Center
                    </h3>
                  </div>
                  {activeAnalysisMatch.status === 'live' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[9px] font-mono font-extrabold bg-red-950/40 text-red-400 border border-red-500/30 uppercase tracking-widest animate-pulse">
                      ● LIVE {activeAnalysisMatch.minute}'
                    </span>
                  ) : activeAnalysisMatch.status === 'completed' ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[9px] font-mono font-bold bg-[#1c2128] text-geo-text-muted border border-geo-border uppercase tracking-widest">
                      Finished
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[9px] font-mono font-bold bg-yellow-950/20 text-geo-brand border border-geo-brand/20 uppercase tracking-widest">
                      Upcoming
                    </span>
                  )}
                </div>

                {/* Match Title Summary */}
                <div className="space-y-1 bg-[#10141b] p-3 rounded-sm border border-geo-border/60">
                  <h4 className="text-[8px] text-geo-text-muted font-mono uppercase tracking-widest font-extrabold">
                    SELECTED SPORTS ARENA
                  </h4>
                  <div className="flex justify-between items-center text-xs font-black text-white uppercase tracking-tight">
                    <span>{activeAnalysisMatch.homeTeam}</span>
                    <span className="text-geo-brand font-mono px-2 py-0.5 bg-geo-bg rounded-sm border border-geo-border font-bold">
                      {activeAnalysisMatch.score.home} - {activeAnalysisMatch.score.away}
                    </span>
                    <span>{activeAnalysisMatch.awayTeam}</span>
                  </div>
                </div>

                {/* Sports Center Navigation Tabs */}
                <div className="grid grid-cols-3 gap-1 bg-geo-bg p-1 border border-geo-border rounded-sm">
                  <button
                    onClick={() => setAnalysisTab('simulation')}
                    className={`py-1.5 text-center text-[10px] font-mono font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer select-none ${
                      analysisTab === 'simulation'
                        ? 'bg-geo-brand text-black font-extrabold shadow-sm'
                        : 'text-geo-text-muted hover:text-white'
                    }`}
                  >
                    🎮 Controller
                  </button>
                  <button
                    onClick={() => setAnalysisTab('stats')}
                    className={`py-1.5 text-center text-[10px] font-mono font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer select-none ${
                      analysisTab === 'stats'
                        ? 'bg-geo-brand text-black font-extrabold shadow-sm'
                        : 'text-geo-text-muted hover:text-white'
                    }`}
                  >
                    📊 Telemetry
                  </button>
                  <button
                    onClick={() => setAnalysisTab('timeline')}
                    className={`py-1.5 text-center text-[10px] font-mono font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer select-none ${
                      analysisTab === 'timeline'
                        ? 'bg-geo-brand text-black font-extrabold shadow-sm'
                        : 'text-geo-text-muted hover:text-white animate-pulse'
                    }`}
                  >
                    ⏱️ Timeline
                  </button>
                </div>

                {/* Tab content 1: Simulation Controller Panel */}
                {analysisTab === 'simulation' && (
                  <div className="space-y-3.5 pt-0.5">
                    <div className="flex justify-between items-center text-[10px] font-mono font-bold text-geo-text-muted border-b border-geo-border/40 pb-1.5">
                      <span>OPTIMISTIC EVENTS PANEL</span>
                      <span className="text-geo-brand text-[8px] uppercase tracking-widest bg-geo-brand/10 border border-geo-brand/20 px-1.5 py-0.5 rounded-sm animate-pulse">Live Injector</span>
                    </div>

                    <p className="text-[11px] text-geo-text-light font-medium leading-relaxed leading-normal">
                      Optimistically simulate live actions. Triggers instantly bypass timers, skew live betting odds coefficients (showing change arrows), log new event timelines, and update scoreboard states across all clients!
                    </p>

                    <div className="grid grid-cols-2 gap-3 pb-1">
                      {/* Home team triggers */}
                      <div className="space-y-2">
                        <div className="text-[10px] font-extrabold text-geo-success font-mono uppercase truncate text-center border-b border-geo-border/30 pb-1">
                          {activeAnalysisMatch.homeTeam}
                        </div>
                        <button
                          onClick={() => optimisticTriggerEvent(activeAnalysisMatch.id, 'goal', 'home')}
                          className="w-full py-1.5 px-2 bg-emerald-950/25 hover:bg-emerald-950/45 border border-emerald-500/30 hover:border-emerald-500 text-emerald-400 font-mono text-[9px] font-black uppercase rounded-sm flex items-center justify-center gap-1 active:scale-[0.98] transition-all select-none cursor-pointer"
                        >
                          ⚽ Inject Goal
                        </button>
                        <button
                          onClick={() => optimisticTriggerEvent(activeAnalysisMatch.id, 'red_card', 'home')}
                          className="w-full py-1.5 px-2 bg-red-950/20 hover:bg-red-950/45 border border-red-500/30 hover:border-red-500 text-red-400 font-mono text-[9px] font-black uppercase rounded-sm flex items-center justify-center gap-1 active:scale-[0.98] transition-all select-none cursor-pointer"
                        >
                          🔴 Red Card
                        </button>
                        <button
                          onClick={() => optimisticTriggerEvent(activeAnalysisMatch.id, 'corner', 'home')}
                          className="w-full py-1.5 px-2 bg-geo-bg hover:bg-geo-card border border-geo-border hover:border-geo-brand text-geo-text-light font-mono text-[9px] font-bold uppercase rounded-sm flex items-center justify-center gap-1 active:scale-[0.98] transition-all select-none cursor-pointer"
                        >
                          ⛳ Corner Kick
                        </button>
                        <button
                          onClick={() => optimisticTriggerEvent(activeAnalysisMatch.id, 'shot_on_target', 'home')}
                          className="w-full py-1.5 px-2 bg-geo-bg hover:bg-geo-card border border-geo-border hover:border-geo-brand text-geo-text-light font-mono text-[9px] font-bold uppercase rounded-sm flex items-center justify-center gap-1 active:scale-[0.98] transition-all select-none cursor-pointer"
                        >
                          🎯 Shot on Goal
                        </button>
                      </div>

                      {/* Away team triggers */}
                      <div className="space-y-2">
                        <div className="text-[10px] font-extrabold text-[#7cabf5] font-mono uppercase truncate text-center border-b border-geo-border/30 pb-1">
                          {activeAnalysisMatch.awayTeam}
                        </div>
                        <button
                          onClick={() => optimisticTriggerEvent(activeAnalysisMatch.id, 'goal', 'away')}
                          className="w-full py-1.5 px-2 bg-emerald-950/25 hover:bg-emerald-950/45 border border-emerald-500/30 hover:border-emerald-500 text-emerald-400 font-mono text-[9px] font-black uppercase rounded-sm flex items-center justify-center gap-1 active:scale-[0.98] transition-all select-none cursor-pointer"
                        >
                          ⚽ Inject Goal
                        </button>
                        <button
                          onClick={() => optimisticTriggerEvent(activeAnalysisMatch.id, 'red_card', 'away')}
                          className="w-full py-1.5 px-2 bg-red-950/20 hover:bg-red-950/45 border border-red-500/30 hover:border-red-500 text-red-400 font-mono text-[9px] font-black uppercase rounded-sm flex items-center justify-center gap-1 active:scale-[0.98] transition-all select-none cursor-pointer"
                        >
                          🔴 Red Card
                        </button>
                        <button
                          onClick={() => optimisticTriggerEvent(activeAnalysisMatch.id, 'corner', 'away')}
                          className="w-full py-1.5 px-2 bg-geo-bg hover:bg-geo-card border border-geo-border hover:border-geo-brand text-geo-text-light font-mono text-[9px] font-bold uppercase rounded-sm flex items-center justify-center gap-1 active:scale-[0.98] transition-all select-none cursor-pointer"
                        >
                          ⛳ Corner Kick
                        </button>
                        <button
                          onClick={() => optimisticTriggerEvent(activeAnalysisMatch.id, 'shot_on_target', 'away')}
                          className="w-full py-1.5 px-2 bg-geo-bg hover:bg-geo-card border border-geo-border hover:border-geo-brand text-geo-text-light font-mono text-[9px] font-bold uppercase rounded-sm flex items-center justify-center gap-1 active:scale-[0.98] transition-all select-none cursor-pointer"
                        >
                          🎯 Shot on Goal
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab content 2: Match Statistics Telemetry & Streak */}
                {analysisTab === 'stats' && (
                  <div className="space-y-4 pt-0.5">
                    <div className="flex justify-between items-center text-[10px] font-mono font-bold text-geo-text-muted border-b border-geo-border/50 pb-1.5">
                      <span>LIVE GAMEPLAY TELEMETRY</span>
                      <span className="text-geo-brand">🔥 {stats.simulatedPopularity}% Interest</span>
                    </div>

                    {statsLoading ? (
                      <div className="py-8 flex flex-col items-center justify-center gap-1.5 text-geo-text-muted">
                        <div className="w-4 h-4 border border-geo-brand/10 border-t-geo-brand rounded-full animate-spin" />
                        <span className="text-[9px] font-mono uppercase tracking-wider">Syncing stream...</span>
                      </div>
                    ) : matchStats ? (
                      <div className="space-y-3 bg-geo-bg/40 p-2.5 rounded-sm border border-geo-border/55">
                        <StatComparisonBar 
                          label="Ball Possession" 
                          home={matchStats.possession?.home ?? 50} 
                          away={matchStats.possession?.away ?? 50} 
                          isPerc={true} 
                        />
                        <StatComparisonBar 
                          label="Shots On Goal" 
                          home={matchStats.shotsOnGoal?.home ?? 4} 
                          away={matchStats.shotsOnGoal?.away ?? 3} 
                        />
                        <StatComparisonBar 
                          label="Shots Off Goal" 
                          home={matchStats.shotsOffGoal?.home ?? 5} 
                          away={matchStats.shotsOffGoal?.away ?? 4} 
                        />
                        <StatComparisonBar 
                          label="Fouls Density" 
                          home={matchStats.fouls?.home ?? 11} 
                          away={matchStats.fouls?.away ?? 12} 
                        />
                        <StatComparisonBar 
                          label="Corner Kicks" 
                          home={matchStats.corners?.home ?? 5} 
                          away={matchStats.corners?.away ?? 6} 
                        />
                        <StatComparisonBar 
                          label="Yellow Cards" 
                          home={matchStats.yellowCards?.home ?? 2} 
                          away={matchStats.yellowCards?.away ?? 1} 
                        />
                        {((matchStats.redCards?.home ?? 0) > 0 || (matchStats.redCards?.away ?? 0) > 0) && (
                          <StatComparisonBar 
                            label="Red Cards" 
                            home={matchStats.redCards?.home ?? 0} 
                            away={matchStats.redCards?.away ?? 0} 
                          />
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-xs font-bold text-geo-text-light mb-1">
                            <span>{activeAnalysisMatch.homeTeam} Home Win</span>
                            <span className="text-geo-success font-mono">{stats.winRateHome}%</span>
                          </div>
                          <div className="h-1.5 bg-geo-bg rounded-sm overflow-hidden border border-geo-border">
                            <div className="h-full bg-geo-success rounded-sm transition-all" style={{ width: `${stats.winRateHome}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs font-bold text-geo-text-light mb-1">
                            <span>Draw Factor</span>
                            <span className="text-geo-brand font-mono">{stats.winRateDraw}%</span>
                          </div>
                          <div className="h-1.5 bg-geo-bg rounded-sm overflow-hidden border border-geo-border">
                            <div className="h-full bg-geo-brand rounded-sm transition-all" style={{ width: `${stats.winRateDraw}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs font-bold text-geo-text-light mb-1">
                            <span>{activeAnalysisMatch.awayTeam} Away Win</span>
                            <span className="text-geo-success font-mono">{stats.winRateAway}%</span>
                          </div>
                          <div className="h-1.5 bg-[#0e1115] rounded-sm overflow-hidden border border-geo-border">
                            <div className="h-full bg-geo-success rounded-sm transition-all" style={{ width: `${stats.winRateAway}%` }} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Simualted Recent Five Game Streaks */}
                    <div className="grid grid-cols-2 gap-4 pt-3.5 border-t border-geo-border border-dashed text-xs">
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-mono uppercase text-geo-text-muted font-bold block">HOME FIVE STREAK</span>
                        <div className="flex gap-1">
                          {stats.lastFiveHome.map((outcome, idx) => (
                            <span 
                              key={idx} 
                              className={`w-5 h-5 rounded-sm flex items-center justify-center font-mono font-bold text-[10px] border ${
                                outcome === 'W' 
                                  ? 'bg-geo-success/15 border-geo-success/30 text-geo-success' 
                                  : outcome === 'L' 
                                    ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                                    : 'bg-slate-800 border-geo-border text-slate-300'
                              }`}
                            >
                              {outcome}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[9px] font-mono uppercase text-geo-text-muted font-bold block">AWAY FIVE STREAK</span>
                        <div className="flex gap-1">
                          {stats.lastFiveAway.map((outcome, idx) => (
                            <span 
                              key={idx} 
                              className={`w-5 h-5 rounded-sm flex items-center justify-center font-mono font-bold text-[10px] border ${
                                outcome === 'W' 
                                  ? 'bg-geo-success/15 border-geo-success/30 text-geo-success' 
                                  : outcome === 'L' 
                                    ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                                    : 'bg-slate-800 border-geo-border text-slate-300'
                              }`}
                            >
                              {outcome}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab content 3: Live Match Timeline events */}
                {analysisTab === 'timeline' && (
                  <div className="space-y-3.5 pt-0.5">
                    <div className="flex justify-between items-center text-[10px] font-mono font-bold text-geo-text-muted border-b border-geo-border/40 pb-1.5">
                      <span>LIVE EVENT LOGS TIMELINE</span>
                      <span className="text-geo-success text-[8px] uppercase tracking-widest font-black bg-emerald-950/20 px-1.5 py-0.5 rounded-sm border border-emerald-500/20 animate-pulse">Running Logs</span>
                    </div>

                    {timelineEvents.length === 0 ? (
                      <div className="py-12 text-center text-xs text-geo-text-muted font-mono bg-geo-bg/30 rounded-sm border border-geo-border/50 border-dashed">
                        Waiting for active kickoff events string...
                      </div>
                    ) : (
                      <div className="relative border-l border-geo-border ml-2.5 pl-4.5 space-y-3.5 pt-1.5 max-h-[300px] overflow-y-auto scrollbar-thin pr-1 pb-1">
                        {timelineEvents.map((event, idx) => {
                          let icon = '📢';
                          let color = 'text-slate-400 border-slate-700 bg-geo-bg';

                          if (event.type === 'goal') {
                            icon = '⚽';
                            color = 'text-emerald-400 border-emerald-500/40 bg-emerald-950/25';
                          } else if (event.type === 'red_card') {
                            icon = '🔴';
                            color = 'text-red-400 border-red-500/40 bg-red-950/25';
                          } else if (event.type === 'yellow_card') {
                            icon = '🟨';
                            color = 'text-yellow-400 border-yellow-500/35 bg-yellow-950/20';
                          } else if (event.type === 'corner') {
                            icon = '⛳';
                            color = 'text-sky-400 border-sky-500/30 bg-sky-950/20';
                          } else if (event.type === 'shot_on_target') {
                            icon = '🎯';
                            color = 'text-violet-400 border-violet-500/25 bg-violet-950/20';
                          } else if (event.type === 'kickoff') {
                            icon = '📍';
                            color = 'text-geo-brand border-geo-brand bg-yellow-950/10';
                          } else if (event.type === 'full_time') {
                            icon = '🏁';
                            color = 'text-white border-white bg-slate-800';
                          }

                          return (
                            <div key={event.id || idx} className="relative group">
                              <span className={`absolute -left-[28px] top-0 w-5 h-5 rounded-full border flex items-center justify-center text-[9px] shadow-sm z-10 font-bold ${color}`}>
                                {event.minute}'
                              </span>
                              
                              <div className="bg-geo-bg/30 border border-geo-border p-2 rounded-sm hover:border-geo-border-light transition-all">
                                <div className="text-[11px] font-medium leading-relaxed text-white">
                                  <span className="mr-1">{icon}</span>
                                  {event.detail}
                                </div>
                                {event.team && (
                                  <span className="inline-block mt-1 text-[8px] font-mono leading-none border border-geo-border px-1 py-0.5 rounded-sm uppercase text-geo-text-muted">
                                    {event.team === 'home' ? 'Home' : 'Away'} Force
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Seasonal Standings Diagnostic */}
                {teamStatsLoading ? (
                  <div className="py-4 flex flex-col items-center justify-center gap-1.5 text-geo-text-muted border-t border-geo-border border-dashed pt-4">
                    <div className="w-4 h-4 border-2 border-geo-brand/20 border-t-geo-brand rounded-full animate-spin" />
                    <span className="text-[10px] font-mono uppercase tracking-wider">Syncing Seasonal Statistics...</span>
                  </div>
                ) : (teamStats.home || teamStats.away) ? (
                  <div className="space-y-2.5 pt-3.5 border-t border-geo-border border-dashed">
                    <div className="flex justify-between items-center text-[10px] font-mono font-bold text-geo-text-muted">
                      <span>SEASONAL STANDINGS DIAGNOSTICS</span>
                      <span className="text-geo-brand text-[9px] uppercase tracking-widest bg-geo-brand/10 border border-geo-brand/20 px-1.5 py-0.5 rounded-sm">Sync Active</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                      {/* Home Team Seasonal Stats Card */}
                      {teamStats.home && (
                        <div className="bg-geo-bg/45 border border-geo-border/60 rounded-sm p-3.5 space-y-2">
                          <div className="text-[11px] text-white font-extrabold truncate border-b border-geo-border/40 pb-1.5 flex justify-between items-center">
                            <span>{teamStats.home.team}</span>
                            <span className="text-geo-success font-mono font-bold tracking-tight">{teamStats.home.form || 'N/A'}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-y-1.5 gap-x-1 text-[10px] text-geo-text-light">
                            <div>Played: <span className="font-bold text-white">{teamStats.home.fixtures.played}</span></div>
                            <div>Wins: <span className="font-bold text-geo-success">{teamStats.home.fixtures.wins}</span></div>
                            <div>Draws: <span className="font-bold text-slate-300">{teamStats.home.fixtures.draws}</span></div>
                            <div>Losses: <span className="font-bold text-red-400">{teamStats.home.fixtures.losses}</span></div>
                            <div className="col-span-2 border-t border-geo-border/30 pt-1.5 mt-0.5 text-[9px] flex gap-1.5 justify-between">
                              <span>Goals Scored/Conceded:</span>
                              <span className="text-white font-bold">{teamStats.home.goals.for} / {teamStats.home.goals.against}</span>
                            </div>
                            <div className="col-span-2 text-[9px] flex gap-1.5 justify-between">
                              <span>Clean Sheets:</span>
                              <span className="text-geo-success font-bold">{teamStats.home.cleanSheets}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Away Team Seasonal Stats Card */}
                      {teamStats.away && (
                        <div className="bg-geo-bg/45 border border-geo-border/60 rounded-sm p-3.5 space-y-2">
                          <div className="text-[11px] text-white font-extrabold truncate border-b border-geo-border/40 pb-1.5 flex justify-between items-center">
                            <span>{teamStats.away.team}</span>
                            <span className="text-geo-success font-mono font-bold tracking-tight">{teamStats.away.form || 'N/A'}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-y-1.5 gap-x-1 text-[10px] text-geo-text-light">
                            <div>Played: <span className="font-bold text-white">{teamStats.away.fixtures.played}</span></div>
                            <div>Wins: <span className="font-bold text-geo-success">{teamStats.away.fixtures.wins}</span></div>
                            <div>Draws: <span className="font-bold text-slate-300">{teamStats.away.fixtures.draws}</span></div>
                            <div>Losses: <span className="font-bold text-red-400">{teamStats.away.fixtures.losses}</span></div>
                            <div className="col-span-2 border-t border-geo-border/30 pt-1.5 mt-0.5 text-[9px] flex gap-1.5 justify-between">
                              <span>Goals Scored/Conceded:</span>
                              <span className="text-white font-bold">{teamStats.away.goals.for} / {teamStats.away.goals.against}</span>
                            </div>
                            <div className="col-span-2 text-[9px] flex gap-1.5 justify-between">
                              <span>Clean Sheets:</span>
                              <span className="text-geo-success font-bold">{teamStats.away.cleanSheets}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="bg-[#1c2128] border border-geo-border rounded-sm p-3 flex gap-2 text-[11px] text-geo-text-muted font-medium items-start leading-relaxed shadow-inner">
                  <Info className="w-4 h-4 text-geo-brand shrink-0 mt-0.5" />
                  <div>
                    Clicking on the odds value buttons inside any match listing will feed that specific yield coefficient directly into the calculator below.
                  </div>
                </div>

              </div>
            );
          })() : (
            <div className="bg-geo-header border border-geo-border rounded-sm p-5 text-center text-geo-text-muted text-xs font-mono">
              Select any game fixture above to loaded extensive stadium stats summaries.
            </div>
          )}

          {/* B. DETAILED FEMBET WAGER ADVANCED CALCULATOR */}
          <div className="bg-geo-header border border-geo-border rounded-sm p-5 shadow-md space-y-4">
            
            <div className="flex items-center space-x-2 border-b border-geo-border pb-3">
              <Calculator className="w-4.5 h-4.5 text-geo-brand" />
              <h3 className="font-display font-black text-xs uppercase tracking-wider text-white">
                FEMBET Yield Calculator
              </h3>
            </div>

            <div className="space-y-3.5">
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-geo-text-muted block">
                  Simulated Stake Amount (₦)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-geo-text-muted font-mono font-black text-xs">
                    ₦
                  </span>
                  <input
                    type="number"
                    value={calcStake}
                    onChange={(e) => setCalcStake(e.target.value)}
                    placeholder="Stake e.g. 100"
                    className="w-full bg-geo-bg border border-geo-border focus:border-geo-brand rounded-sm py-2 pl-7 pr-3 text-xs font-mono font-bold text-geo-success focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-geo-text-muted block">
                  Wager Odds Scalar
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-geo-text-muted font-mono font-black text-xs">
                    x
                  </span>
                  <input
                    type="number"
                    step="0.05"
                    value={calcOdds}
                    onChange={(e) => setCalcOdds(e.target.value)}
                    placeholder="Odds e.g. 2.15"
                    className="w-full bg-geo-bg border border-geo-border focus:border-geo-brand rounded-sm py-2 pl-7 pr-3 text-xs font-mono font-bold text-[#F0B90B] focus:outline-none"
                  />
                </div>
              </div>

              {/* Calculator Output summary */}
              <div className="bg-[#1c2128] border border-geo-border p-3.5 rounded-sm rounded-t-none border-t-2 border-t-geo-brand space-y-2 font-mono">
                
                <div className="flex justify-between items-center text-xs">
                  <span className="text-geo-text-muted uppercase font-bold">Projected Odds Scalar:</span>
                  <span className="text-[#F0B90B] font-black">{parseFloat(calcOdds).toFixed(2)}x</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-geo-text-muted uppercase font-bold">Imputed Est Profit:</span>
                  <span className="text-geo-success font-black">
                    +₦{Math.max(0, calcReturn - (parseFloat(calcStake) || 0)).toFixed(2)}
                  </span>
                </div>

                <div className="border-t border-geo-border/80 my-2 pt-2 flex justify-between items-center">
                  <span className="text-[11px] font-mono uppercase text-white font-black">Total Expected Return:</span>
                  <span className="text-lg text-geo-success font-extrabold">
                    ₦{calcReturn.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

              </div>

              <div className="text-[9px] text-geo-text-muted font-mono leading-relaxed text-center italic">
                Values are indicative predictions. Place wagers using authentic ledger bet slip options below.
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
