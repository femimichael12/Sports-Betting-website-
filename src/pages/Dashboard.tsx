/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBetSlip } from '../context/BetSlipContext';
import { db, handleFirestoreError, OperationType, collection, onSnapshot, doc, setDoc, updateDoc, getDocs, query, where, serverTimestamp } from '../lib/firebase';
import { Match, Bet } from '../types';
import LiveScoreboard from '../components/LiveScoreboard';
import LiveOdds from '../components/LiveOdds';
import { 
  Trophy, 
  Percent, 
  Tv, 
  Gamepad2, 
  Play, 
  FastForward, 
  Search,
  DollarSign,
  Coins,
  TrendingUp,
  RotateCcw,
  CheckCircle,
  HelpCircle,
  Info,
  ChevronLeft,
  ChevronRight,
  Flame,
  BadgeAlert,
  Sliders,
  BarChart2,
  BellRing,
  Award,
  Zap,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Pre-packaged high-fidelity fixtures to seed when Firestore is empty
const INITIAL_FIXTURES: Omit<Match, 'createdAt'>[] = [
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

export default function Dashboard() {
  const { profile, adjustBalance } = useAuth();
  const { addToSlip, slipItem } = useBetSlip();
  
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Slider controls state for promotional carousel
  const [activePromoIndex, setActivePromoIndex] = useState(0);
  const [promoToast, setPromoToast] = useState<string | null>(null);
  const [isPromoLoading, setIsPromoLoading] = useState(false);

  // Simulator Panel states
  const [tickerLoading, setTickerLoading] = useState(false);
  const [showSimInfo, setShowSimInfo] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);

  // 1. Listen to Match fixtures in real-time
  useEffect(() => {
    setLoading(true);
    const matchesCollection = collection(db, 'matches');

    const unsubscribe = onSnapshot(matchesCollection, async (snapshot) => {
      const items: Match[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        items.push({
          id: doc.id,
          sport: d.sport,
          homeTeam: d.homeTeam,
          awayTeam: d.awayTeam,
          commencesAt: d.commencesAt,
          status: d.status,
          odds: d.odds,
          score: d.score,
          minute: d.minute,
          result: d.result,
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : new Date(doc.id ? Date.now() : Date.now()),
        });
      });

      // If database is completely unpopulated, seed the initial matches synchronously
      if (items.length === 0) {
        addLog("Database is empty. Initiating fixture seeds...");
        await seedInitialFixtures();
      } else {
        // Sort matches by commencing date upcoming first
        items.sort((a, b) => new Date(a.commencesAt).getTime() - new Date(b.commencesAt).getTime());
        setMatches(items);
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'matches');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Quick cycle slides
  useEffect(() => {
    const interval = setInterval(() => {
      setActivePromoIndex(prev => (prev + 1) % 3);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const addLog = (message: string) => {
    setLogs(prev => [message, ...prev.slice(0, 15)]);
  };

  // Seed fixtures helper
  const seedInitialFixtures = async () => {
    try {
      for (const fixture of INITIAL_FIXTURES) {
        const docRef = doc(db, 'matches', fixture.id);
        const data = {
          ...fixture,
          createdAt: serverTimestamp(),
        };
        await setDoc(docRef, data);
        addLog(`Seeded fixture: ${fixture.homeTeam} vs ${fixture.awayTeam}`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'matches');
    }
  };

  // Reset entire simulation matches back to default upcoming states
  const handleResetSimulation = async () => {
    setTickerLoading(true);
    addLog("Regenerating all sportsbook arenas...");
    try {
      for (const fixture of INITIAL_FIXTURES) {
        const docRef = doc(db, 'matches', fixture.id);
        await setDoc(docRef, {
          ...fixture,
          createdAt: serverTimestamp(),
        });
      }
      addLog("Arenas reloaded successfully.");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'matches');
    } finally {
      setTickerLoading(false);
    }
  };

  /**
   * ADVANCED SIMULATOR TICK ENGINE
   * Steps all upcoming matches to Live, live matches forward by +15 minutes, 
   * completes matches at 90m, outputs results, and payouts pending user wagers.
   */
  const handleAdvanceSimulationTime = async () => {
    if (matches.length === 0) return;
    try {
      setTickerLoading(true);
      addLog("Initializing stadium buzzer... advancing match clocks!");

      for (const match of matches) {
        const docRef = doc(db, 'matches', match.id);
        
        // Let's copy current parameters
        let nextStatus = match.status;
        let nextMinute = match.minute || 0;
        let nextScore = { ...match.score };
        let nextResult = match.result;

        if (match.status === 'upcoming') {
          // Kick off match
          nextStatus = 'live';
          nextMinute = 15;
          nextScore = { home: 0, away: 0 };
          nextResult = 'pending';
          
          await updateDoc(docRef, {
            status: nextStatus,
            minute: nextMinute,
            score: nextScore,
            result: nextResult
          });
          addLog(`★ KICKOFF LIVE: ${match.homeTeam} vs ${match.awayTeam}`);
          
        } else if (match.status === 'live') {
          nextMinute += 15;
          
          // Sport weights for goals/points
          const goalRollHome = Math.random();
          const goalRollAway = Math.random();
          let scoreTriggered = false;

          if (match.sport === 'football') {
            if (goalRollHome > 0.72) { nextScore.home += 1; scoreTriggered = true; }
            if (goalRollAway > 0.75) { nextScore.away += 1; scoreTriggered = true; }
          } else if (match.sport === 'basketball') {
            nextScore.home += Math.floor(18 + Math.random() * 12);
            nextScore.away += Math.floor(18 + Math.random() * 12);
            scoreTriggered = true;
          } else if (match.sport === 'esports') {
            if (goalRollHome > 0.5) { nextScore.home += 1; scoreTriggered = true; }
            else { nextScore.away += 1; scoreTriggered = true; }
          } else if (match.sport === 'tennis') {
            // Tennis round points
            if (goalRollHome > 0.48) { nextScore.home += 1; scoreTriggered = true; }
            else { nextScore.away += 1; scoreTriggered = true; }
          }

          if (nextMinute >= 90) {
            nextStatus = 'completed';
            nextMinute = 90;
            
            if (nextScore.home > nextScore.away) nextResult = 'home_win';
            else if (nextScore.away > nextScore.home) nextResult = 'away_win';
            else nextResult = 'draw';

            addLog(`✔ MATCH CONCLUDED: ${match.homeTeam} ${nextScore.home} - ${nextScore.away} ${match.awayTeam}. Result: ${nextResult}`);
            
            // PAYOUT ROUTINE
            await payoutWagersForMatch(match.id, nextResult, `${match.homeTeam} vs ${match.awayTeam}`);
          } else {
            if (scoreTriggered) {
              addLog(`⚽ Score Update @${nextMinute}': ${match.homeTeam} ${nextScore.home} - ${nextScore.away} ${match.awayTeam}`);
            } else {
              addLog(`⌛ Progress @${nextMinute}': ${match.homeTeam} vs ${match.awayTeam}`);
            }
          }

          await updateDoc(docRef, {
            status: nextStatus,
            minute: nextMinute,
            score: nextScore,
            result: nextResult
          });
        }
      }

    } catch (err) {
      console.error(err);
      addLog("System validation error. Please reset simulator nodes.");
    } finally {
      setTickerLoading(false);
    }
  };

  // Queries pending bets, assesses wins/losses, and applies credit payouts
  const payoutWagersForMatch = async (matchId: string, matchResult: 'home_win' | 'away_win' | 'draw', matchName: string) => {
    try {
      const betsRef = collection(db, 'bets');
      const q = query(betsRef, where('matchId', '==', matchId), where('status', '==', 'pending'));
      const snap = await getDocs(q);

      if (snap.empty) {
        addLog(`No pending bets found to settle for: ${matchName}`);
        return;
      }

      addLog(`Settle Ticket processing: Found ${snap.size} wagers for: ${matchName}`);

      for (const d of snap.docs) {
        const betData = d.data();
        const betId = d.id;
        const betDocRef = doc(db, 'bets', betId);
        
        const isWin = betData.predictedOutcome === matchResult;
        
        if (isWin) {
          addLog(`🎉 USER WON: ${betData.username} selected right option on "${matchName}"!`);
          
          // 1. Mark Bet as Won
          await updateDoc(betDocRef, {
            status: 'won',
            resolvedAt: serverTimestamp()
          });

          // 2. Issue balance adjust rewards
          const payoutVal = betData.potentialWin;
          const payoutDesc = `Wager Payout Reward: Predicted ${betData.predictedOutcome.toUpperCase()} on [${matchName}] @ Odds ${betData.odds}`;
          
          // Run the payout (only runs on behalf of the matched uid)
          if (profile && betData.userId === profile.userId) {
            await adjustBalance(payoutVal, 'bet_payout', payoutDesc);
            addLog(`💰 Credit payout transacted: +₦${payoutVal.toFixed(2)} to your balance ledger!`);
          } else {
            addLog(`⚠️ Settle note: Payout issued to ${betData.username}. Logged in ledger.`);
          }

        } else {
          addLog(`💔 USER LOST: Wager ticket ${betId.substring(4, 8)} on "${matchName}" was settled unsuccessful.`);
          // Mark Bet as Lost
          await updateDoc(betDocRef, {
            status: 'lost',
            resolvedAt: serverTimestamp()
          });
        }
      }

    } catch (err) {
      console.error("Payout trigger failure: ", err);
    }
  };

  // Functional promotion action buttons helpers
  const handleClaimPromoDeposit = async () => {
    if (!profile) return;
    try {
      setIsPromoLoading(true);
      setPromoToast(null);
      // Give simulated credit
      await adjustBalance(1000, 'deposit', 'Claimed FEMBET Promo: Instant credits ignition bonus');
      setPromoToast("🚀 Ledgers authorized! +₦1,000.00 credited immediately to your bankroll.");
      addLog("💰 Claimed FEMBET Promo: Welcome bonus portfolio injection authorized.");
      setTimeout(() => setPromoToast(null), 6000);
    } catch (err) {
      console.error(err);
      setPromoToast("⚠️ Ingestion rejected. Your status index might be saturated.");
    } finally {
      setIsPromoLoading(false);
    }
  };

  const handleQuickLoadCombo = () => {
    // Finds the G2 esports match or Carlos Alcaraz match and queues it to bet slip
    const esportMatch = matches.find(m => m.sport === 'esports');
    if (esportMatch) {
      addToSlip(esportMatch, 'home_win');
      setPromoToast("🎯 Loaded Esports block selection into active Bet Slip! Proceed below.");
      addLog("🎯 Parlay helper loaded choice: T1 esports vs G2 Gaming (Home Win requested).");
      setTimeout(() => setPromoToast(null), 4000);
    } else {
      setPromoToast("⚠️ Arena is currently cycling. Match index is locked.");
    }
  };

  // Quick Action for specific blockbuster Real Madrid prediction
  const handleQuickRealMadridwin = () => {
    const elClasico = matches.find(m => m.id === 'match_fb_el_clasico');
    if (elClasico) {
      addToSlip(elClasico, 'home_win');
      setPromoToast("🔥 Selected Real Madrid to Win inside the Blockbuster clash ledger.");
      addLog("🎯 Parlay option added: El Clásico - Real Madrid (Home Win)");
      setTimeout(() => setPromoToast(null), 4000);
    } else {
      setPromoToast("⚠️ Feature match unavailable. Restructuring archives...");
    }
  };

  // Sports arena tabs
  const sportsTabs = [
    { id: 'all', label: 'All Fields', emoji: '🏆' },
    { id: 'football', label: 'Football', emoji: '⚽' },
    { id: 'basketball', label: 'Basketball', emoji: '🏀' },
    { id: 'tennis', label: 'Tennis', emoji: '🎾' },
    { id: 'esports', label: 'Esports', emoji: '🎮' },
  ];

  // Popular Leagues array
  const popularLeagues = [
    { id: 'all', label: 'All Leagues', icon: '🏆' },
    { id: 'premier', label: '🇪🇺 El Clásico', sport: 'football', keyword: 'Madrid' },
    { id: 'nba', label: '🇺🇸 NBA Finals', sport: 'basketball', keyword: 'Lakers' },
    { id: 'worlds', label: '🌐 LoL Worlds', sport: 'esports', keyword: 'T1' },
    { id: 'grand', label: '🎾 Grand Slam Finals', sport: 'tennis', keyword: 'Alcaraz' }
  ];

  const handleLeagueSelect = (league: any) => {
    setSelectedLeague(league.id);
    if (league.id === 'all') {
      setSelectedSport('all');
      setSearchQuery('');
    } else {
      setSelectedSport(league.sport);
      setSearchQuery(league.keyword);
    }
  };

  // Filtering matches with tabs, league selection and search query
  const filteredMatches = matches.filter(match => {
    if (selectedSport !== 'all' && match.sport !== selectedSport) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTeams = `${match.homeTeam} vs ${match.awayTeam}`.toLowerCase();
      const matchSport = match.sport.toLowerCase();
      return matchTeams.includes(q) || matchSport.includes(q);
    }
    return true;
  });

  const liveMatches = matches.filter(m => m.status === 'live');
  const featuredMatch = matches.find(m => m.id === 'match_fb_el_clasico');

  // Curated trending bets with backing percentages
  const trendingBets = [
    {
      teamName: 'Real Madrid',
      rival: 'FC Barcelona',
      matchId: 'match_fb_el_clasico',
      sport: 'football',
      prediction: 'home_win' as const,
      backingRate: 72,
      displayOdds: 1.95,
      popularity: 'HOT'
    },
    {
      teamName: 'T1 esports',
      rival: 'G2 Gaming',
      matchId: 'match_es_worlds',
      sport: 'esports',
      prediction: 'home_win' as const,
      backingRate: 81,
      displayOdds: 1.45,
      popularity: 'VERY HIGH'
    },
    {
      teamName: 'Jannik Sinner',
      rival: 'Carlos Alcaraz',
      matchId: 'match_tn_nadal_djoko',
      sport: 'tennis',
      prediction: 'away_win' as const,
      backingRate: 64,
      displayOdds: 2.15,
      popularity: 'STABLE'
    }
  ];

  const getSportTagBackground = (sport: string) => {
    switch (sport) {
      case 'football': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'basketball': return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
      case 'tennis': return 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20';
      case 'esports': return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
      default: return 'bg-slate-800 text-slate-300';
    }
  };

  // Promo Slider definition
  const PROMO_SLIDES = [
    {
      type: "deposit",
      title: "FEMBET SIGN-UP WEALTH EXCLUSIVE",
      subtitle: "Bootstrap your simulated portfolio with supreme credit lines instantly on-chain.",
      accent: "from-[#F0B90B] to-[#FFE066]",
      tag: "100% MATCH PROMO",
      buttonText: "Claim ₦1,000.00 Credits",
      action: handleClaimPromoDeposit
    },
    {
      type: "boost",
      title: "BLOCKBUSTER SUPER CHAMPIONS BOOST",
      subtitle: "Back the El Clásico titans today. Odds on Real Madrid to Win escalated to 2.10.",
      accent: "from-emerald-500 to-teal-400",
      tag: "ODDS ESCALATOR",
      buttonText: "Back Real Madrid @ 1.95",
      action: handleQuickRealMadridwin
    },
    {
      type: "esports",
      title: "WORLD esports COMBO PACK INTEGRATION",
      subtitle: "Back T1 esports in League Worlds to unlock compound leverage bonuses on successful bets.",
      accent: "from-cyan-500 to-blue-500",
      tag: "COMBO BOOSTER",
      buttonText: "Add Esports Ticket",
      action: handleQuickLoadCombo
    }
  ];

  return (
    <div id="sports-lobby" className="grid grid-cols-1 lg:grid-cols-12 gap-8 font-sans">
      
      {/* Dynamic Floating Toast Message Indicator */}
      <AnimatePresence>
        {promoToast && (
          <motion.div
            initial={{ opacity: 0, y: -45, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
          >
            <div className="bg-geo-header border border-geo-brand text-[#EAECEF] px-4 py-3.5 rounded-sm shadow-2xl flex items-center space-x-3 text-xs tracking-wide">
              <Zap className="w-5 h-5 text-geo-brand shrink-0 animate-bounce" />
              <div className="flex-1 font-bold">{promoToast}</div>
              <button 
                onClick={() => setPromoToast(null)} 
                className="text-geo-text-muted hover:text-white font-mono font-black"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEFT COLUMN: Main Matches Feed & Filters (Grid size 8) */}
      <div className="lg:col-span-8 space-y-7">
        
        {/* PREMIUM PROMOTIONAL BANNERS CAROUSEL */}
        <div className="relative overflow-hidden border border-geo-border rounded-sm bg-geo-header shadow-lg h-60 sm:h-56">
          {/* Active Banner Slide Backdrop gradient */}
          <div className="absolute inset-0 bg-[#161a1f] opacity-95" />
          
          <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-geo-brand/10 to-transparent pointer-events-none" />
          
          <div className="absolute bottom-3 right-4 flex items-center space-x-1 z-10">
            {PROMO_SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setActivePromoIndex(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  activePromoIndex === i ? 'bg-geo-brand w-5' : 'bg-geo-text-muted/30'
                }`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activePromoIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-between"
            >
              <div>
                <span className={`inline-flex items-center space-x-1 text-[9px] px-2 py-0.5 rounded-sm font-mono font-black tracking-widest text-[#0B0E11] bg-gradient-to-r ${PROMO_SLIDES[activePromoIndex].accent} uppercase shadow-sm`}>
                  {PROMO_SLIDES[activePromoIndex].tag}
                </span>

                <h1 className="font-display font-black text-lg sm:text-xl md:text-2xl text-white tracking-tight leading-snug mt-3 select-none uppercase">
                  {PROMO_SLIDES[activePromoIndex].title}
                </h1>
                
                <p className="text-xs text-geo-text-muted max-w-xl mt-1.5 font-medium leading-relaxed select-none">
                  {PROMO_SLIDES[activePromoIndex].subtitle}
                </p>
              </div>

              <div className="flex items-center space-x-3.5 mt-4 z-10">
                <button
                  onClick={PROMO_SLIDES[activePromoIndex].action}
                  disabled={isPromoLoading}
                  className="px-5 py-2.5 bg-geo-brand hover:bg-[#E2AF0B] text-black font-display font-black text-[11px] uppercase tracking-wider rounded-sm transition-all focus:outline-none flex items-center space-x-1.5 select-none hover:shadow-lg hover:shadow-geo-brand/5 shadow-[0_3px_0_0_#9E7B06] active:translate-y-0.5 active:shadow-none shrink-0"
                >
                  <span>{PROMO_SLIDES[activePromoIndex].buttonText}</span>
                  <Zap className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
                <span className="text-[10px] text-geo-text-muted font-mono tracking-wide uppercase select-none hidden sm:inline">
                  • virtual assets • instantly settled
                </span>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Slide switchers */}
          <button 
            onClick={() => setActivePromoIndex(prev => (prev - 1 + 3) % 3)}
            className="absolute left-2.5 top-1/2 -to-translate-y-1/2 bg-geo-bg/40 hover:bg-geo-bg/85 border border-geo-border rounded-sm p-1.5 text-geo-text-muted hover:text-white transition-colors z-10"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <button 
            onClick={() => setActivePromoIndex(prev => (prev + 1) % 3)}
            className="absolute right-2.5 top-1/2 -to-translate-y-1/2 bg-geo-bg/40 hover:bg-geo-bg/85 border border-geo-border rounded-sm p-1.5 text-geo-text-muted hover:text-white transition-colors z-10"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>


        {/* POPULAR LEAGUE SELECTORS ROW */}
        <div className="space-y-2">
          <div className="flex items-center space-x-1.5">
            <Award className="w-4 h-4 text-geo-brand" />
            <h3 className="text-[10px] font-mono font-black uppercase tracking-widest text-[#EAECEF] select-none">
              High Tier Leagues & Tournaments
            </h3>
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {popularLeagues.map((league) => (
              <button
                key={league.id}
                onClick={() => handleLeagueSelect(league)}
                className={`px-4 py-2.5 rounded-sm text-xs font-bold uppercase tracking-wider cursor-pointer shrink-0 border transition-all ${
                  selectedLeague === league.id
                    ? 'bg-geo-card text-geo-brand border-geo-brand/40 shadow-sm'
                    : 'bg-geo-header text-geo-text-muted border-geo-border hover:border-geo-border-light hover:text-white'
                }`}
              >
                <span>{league.label}</span>
              </button>
            ))}
          </div>
        </div>


        {/* BLOCKBUSTER HERO FEATURED MATCH CARD */}
        {featuredMatch && (
          <div className="bg-gradient-to-b from-geo-header to-[#13161A] border-l-4 border-l-geo-brand border border-geo-border rounded-sm p-5 sm:p-6 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-44 h-44 bg-geo-brand/5 rounded-full blur-[60px] pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-geo-border border-dashed">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] bg-geo-brand/10 border border-geo-brand/20 text-geo-brand px-2 py-0.5 rounded-sm font-mono font-black tracking-widest uppercase">
                    BLOCKBUSTER FIXTURE
                  </span>
                  
                  {featuredMatch.status === 'live' && (
                    <span className="flex items-center text-[9px] font-bold text-red-500 bg-red-950/20 px-2 py-0.5 rounded-sm border border-red-900 border-dashed animate-pulse">
                      🔴 LIVE PLAY NOW
                    </span>
                  )}
                </div>
                <h3 className="font-display font-black text-sm tracking-tight text-white uppercase mt-1">
                  La Liga • El Clásico Super Derby
                </h3>
              </div>

              {/* Live Score/Commences status tag */}
              {featuredMatch.status === 'upcoming' ? (
                <div className="text-[11px] font-mono bg-geo-bg border border-geo-border px-3 py-1 text-geo-brand font-bold rounded-sm uppercase tracking-wide">
                  Starts: {new Date(featuredMatch.commencesAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              ) : (
                <div className="flex items-center space-x-2 bg-geo-bg border border-geo-border px-3.5 py-1.5 rounded-sm font-mono text-sm tracking-widest font-black text-geo-success shadow-inner">
                  <span>{featuredMatch.score.home}</span>
                  <span className="text-geo-text-muted font-normal">:</span>
                  <span>{featuredMatch.score.away}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mt-5">
              {/* Teams Display Row */}
              <div className="md:col-span-7 flex flex-col justify-center space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-display font-black text-base sm:text-lg text-white tracking-tight uppercase">
                    {featuredMatch.homeTeam}
                  </span>
                  <span className="text-xs text-geo-text-muted font-bold font-mono">HOME</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="font-display font-black text-base sm:text-lg text-[#F0B90B] tracking-tight uppercase">
                    {featuredMatch.awayTeam}
                  </span>
                  <span className="text-xs text-geo-text-muted font-bold font-mono">AWAY</span>
                </div>

                {/* Simulated Momentum Bar */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-[10px] font-mono text-geo-text-muted font-bold">
                    <span>MOMENTUM INDEX: 52% MADRID</span>
                    <span>48% BARCELONA</span>
                  </div>
                  <div className="h-1 bg-geo-border rounded-full overflow-hidden flex">
                    <div className="h-full bg-geo-brand w-[52%]" />
                    <div className="h-full bg-geo-success w-[48%]" />
                  </div>
                </div>
              </div>

              {/* Direct Odds Bet Sliders */}
              <div className="md:col-span-5 grid grid-cols-3 gap-2.5 self-center">
                <button
                  onClick={() => addToSlip(featuredMatch, 'home_win')}
                  disabled={featuredMatch.status === 'completed'}
                  className={`p-3 rounded-sm border flex flex-col items-center justify-center gap-1.5 transition-all text-center ${
                    slipItem?.match.id === featuredMatch.id && slipItem?.predictedOutcome === 'home_win'
                      ? 'bg-geo-brand border-geo-brand text-black font-extrabold'
                      : 'bg-geo-bg border-geo-border text-geo-text-muted hover:border-geo-brand hover:text-white font-bold'
                  }`}
                >
                  <span className="text-[10px] font-mono tracking-widest opacity-80 block font-bold">HOME</span>
                  <span className="text-sm font-mono font-black tracking-tight leading-none block">
                    {featuredMatch.odds.homeWin.toFixed(2)}
                  </span>
                </button>

                <button
                  onClick={() => addToSlip(featuredMatch, 'draw')}
                  disabled={featuredMatch.status === 'completed'}
                  className={`p-3 rounded-sm border flex flex-col items-center justify-center gap-1.5 transition-all text-center ${
                    slipItem?.match.id === featuredMatch.id && slipItem?.predictedOutcome === 'draw'
                      ? 'bg-geo-brand border-geo-brand text-black font-extrabold'
                      : 'bg-geo-bg border-geo-border text-geo-text-muted hover:border-geo-brand hover:text-white font-bold'
                  }`}
                >
                  <span className="text-[10px] font-mono tracking-widest opacity-80 block font-bold">DRAW</span>
                  <span className="text-sm font-mono font-black tracking-tight leading-none block">
                    {featuredMatch.odds.draw.toFixed(2)}
                  </span>
                </button>

                <button
                  onClick={() => addToSlip(featuredMatch, 'away_win')}
                  disabled={featuredMatch.status === 'completed'}
                  className={`p-3 rounded-sm border flex flex-col items-center justify-center gap-1.5 transition-all text-center ${
                    slipItem?.match.id === featuredMatch.id && slipItem?.predictedOutcome === 'away_win'
                      ? 'bg-geo-brand border-geo-brand text-black font-extrabold'
                      : 'bg-geo-bg border-geo-border text-geo-text-muted hover:border-geo-brand hover:text-white font-bold'
                  }`}
                >
                  <span className="text-[10px] font-mono tracking-widest opacity-80 block font-bold">AWAY</span>
                  <span className="text-sm font-mono font-black tracking-tight leading-none block">
                    {featuredMatch.odds.awayWin.toFixed(2)}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}


        {/* LIVE SCOREBOARD & STANDINGS (API-FOOTBALL SERVICE LAYER ACTIVE) */}
        <LiveScoreboard />

        {/* LIVE REAL MARKET ODDS (THE ODDS API SERVICE INTERACTION ACTIVE) */}
        <LiveOdds />


        {/* MAIN FIXTURES SPORTS LIST SECTION */}
        <div id="general-fixtures" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-geo-header p-3 border border-geo-border rounded-sm">
            {/* sports category selectors */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
              {sportsTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setSelectedSport(tab.id);
                    // Reset league highlighting unless matching sport
                    setSelectedLeague('all');
                  }}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wider cursor-pointer shrink-0 transition-all ${
                    selectedSport === tab.id
                      ? 'bg-geo-card text-geo-brand border border-geo-brand/20'
                      : 'text-geo-text-muted hover:text-geo-text-light hover:bg-geo-card'
                  }`}
                >
                  <span>{tab.emoji}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* search bar component */}
            <div className="relative max-w-sm w-full">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-geo-text-muted">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Arena Teams..."
                className="w-full bg-geo-bg border border-geo-border focus:border-geo-brand focus:outline-none rounded-sm py-1.5 pl-9 pr-4 text-[10px] font-bold text-geo-text-light tracking-wide uppercase"
              />
            </div>
          </div>

          {/* Fixtures list loader */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-geo-text-muted gap-2.5">
              <div className="w-8 h-8 border-2 border-geo-brand/20 border-t-geo-brand rounded-full animate-spin" />
              <span className="text-xs font-mono font-bold tracking-wider">Assessing match listings...</span>
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="bg-geo-card border border-geo-border rounded-sm py-16 text-center text-geo-text-muted max-w-sm mx-auto">
              <HelpCircle className="w-9 h-9 text-geo-border mx-auto mb-3" />
              <h4 className="font-display font-bold text-white text-sm uppercase tracking-wide">No Active Matches</h4>
              <p className="text-xs text-geo-text-muted mt-1 max-w-[280px] mx-auto leading-relaxed">
                We couldn't find any fixtures matching your terms. Select another category or reset matches above.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredMatches.map((match) => {
                const formattedTime = new Date(match.commencesAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-geo-card border border-geo-border rounded-sm p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 hover:border-geo-border-light transition-all shadow-sm"
                  >
                    {/* Left part: Sport label, Teams, match status score */}
                    <div className="space-y-1.5 flex-grow min-w-0 pr-4">
                      <div className="flex items-center space-x-2.5 text-[10px] font-mono uppercase">
                        <span className={`px-2 py-0.5 rounded-sm font-bold tracking-wider ${getSportTagBackground(match.sport)}`}>
                          {match.sport}
                        </span>
                        {match.status === 'live' ? (
                          <span className="flex items-center space-x-1 font-bold text-red-500 bg-red-950/20 border border-red-900/30 rounded-sm px-1.5">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse mr-1" />
                            LIVE • {match.minute}'
                          </span>
                        ) : match.status === 'completed' ? (
                          <span className="text-geo-text-muted bg-geo-bg border border-geo-border rounded-sm px-1.5 font-bold">
                            Concluded
                          </span>
                        ) : (
                          <span className="text-geo-brand bg-geo-brand/5 border border-geo-brand/15 rounded-sm px-1.5 font-bold flex items-center gap-1.5">
                            Upcoming @ {formattedTime}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-4 mt-2">
                        <div className="space-y-1 min-w-0 flex-grow">
                          <h4 className={`text-sm tracking-tight font-black truncate uppercase ${match.result === 'home_win' ? 'text-geo-success' : 'text-white'}`}>
                            {match.homeTeam}
                          </h4>
                          <h4 className={`text-sm tracking-tight font-black truncate uppercase ${match.result === 'away_win' ? 'text-geo-success' : 'text-white'}`}>
                            {match.awayTeam}
                          </h4>
                        </div>

                        {/* Score displaying if live or completed */}
                        {match.status !== 'upcoming' && (
                          <div className="bg-geo-bg border border-geo-border px-3.5 py-1.5 rounded-sm text-center font-mono font-black text-sm text-geo-text-light flex items-center justify-center space-x-1 select-none shadow">
                            <span className="tracking-tight text-geo-success">{match.score.home}</span>
                            <span className="text-geo-text-muted font-light">:</span>
                            <span className="tracking-tight text-geo-success">{match.score.away}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right segment: Bettor odds boxes */}
                    <div className="flex gap-2 shrink-0 md:max-w-xs w-full self-center">
                      
                      {/* Home Odds Choice block */}
                      <button
                        onClick={() => match.status !== 'completed' && addToSlip(match, 'home_win')}
                        disabled={match.status === 'completed'}
                        className={`flex-1 p-2.5 rounded-sm border flex flex-col items-center justify-center gap-1 select-none cursor-pointer group active:scale-95 transition-all text-center ${
                          slipItem?.match.id === match.id && slipItem?.predictedOutcome === 'home_win'
                            ? 'bg-geo-brand border-geo-brand text-black font-extrabold'
                            : match.status === 'completed'
                              ? 'bg-geo-bg/30 border-geo-border text-geo-text-muted/40 cursor-not-allowed'
                              : 'bg-geo-bg border border-geo-border text-geo-text-muted hover:border-geo-brand hover:text-white font-bold'
                        }`}
                      >
                        <span className="text-[9px] uppercase tracking-wider font-mono opacity-80 block font-bold leading-none">1</span>
                        <span className="text-xs font-mono font-black tracking-tight leading-none block">
                          {match.odds.homeWin.toFixed(2)}
                        </span>
                      </button>

                      {/* Draw Odds Choice block */}
                      <button
                        onClick={() => match.status !== 'completed' && addToSlip(match, 'draw')}
                        disabled={match.status === 'completed'}
                        className={`flex-1 p-2.5 rounded-sm border flex flex-col items-center justify-center gap-1 select-none cursor-pointer group active:scale-95 transition-all text-center ${
                          slipItem?.match.id === match.id && slipItem?.predictedOutcome === 'draw'
                            ? 'bg-geo-brand border-geo-brand text-black font-extrabold'
                            : match.status === 'completed'
                              ? 'bg-geo-bg/30 border-geo-border text-geo-text-muted/40 cursor-not-allowed'
                              : 'bg-geo-bg border border-geo-border text-geo-text-muted hover:border-geo-brand hover:text-white font-bold'
                        }`}
                      >
                        <span className="text-[9px] uppercase tracking-wider font-mono opacity-80 block font-bold leading-none">X</span>
                        <span className="text-xs font-mono font-black tracking-tight leading-none block">
                          {match.odds.draw.toFixed(2)}
                        </span>
                      </button>

                      {/* Away Odds Choice block */}
                      <button
                        onClick={() => match.status !== 'completed' && addToSlip(match, 'away_win')}
                        disabled={match.status === 'completed'}
                        className={`flex-1 p-2.5 rounded-sm border flex flex-col items-center justify-center gap-1 select-none cursor-pointer group active:scale-95 transition-all text-center ${
                          slipItem?.match.id === match.id && slipItem?.predictedOutcome === 'away_win'
                            ? 'bg-geo-brand border-geo-brand text-black font-extrabold'
                            : match.status === 'completed'
                              ? 'bg-geo-bg/30 border-geo-border text-geo-text-muted/40 cursor-not-allowed'
                              : 'bg-geo-bg border border-geo-border text-geo-text-muted hover:border-geo-brand hover:text-white font-bold'
                        }`}
                      >
                        <span className="text-[9px] uppercase tracking-wider font-mono opacity-80 block font-bold leading-none">2</span>
                        <span className="text-xs font-mono font-black tracking-tight leading-none block">
                          {match.odds.awayWin.toFixed(2)}
                        </span>
                      </button>

                    </div>

                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* RIGHT COLUMN: Sportsbook Simulation Admin Node Controls & Trending Bets (Grid size 4) */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Real-time Available Balance Ledger Card */}
        <div className="bg-gradient-to-r from-geo-header to-geo-card border border-geo-border p-5 rounded-sm shadow-md">
          <div className="flex items-center space-x-2">
            <Coins className="w-4 h-4 text-geo-brand" />
            <span className="text-[10px] text-geo-text-muted uppercase tracking-widest font-mono font-bold">
              Available Simulated Cash
            </span>
          </div>
          <div className="text-2xl font-mono font-black text-geo-success tracking-tight mt-1">
            ₦{profile?.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex gap-2 mt-3.5 pt-3.5 border-t border-geo-border border-dashed">
            <button 
              onClick={handleClaimPromoDeposit}
              className="flex-1 py-1.5 bg-geo-brand hover:bg-geo-brand/90 text-black text-[9px] uppercase font-bold tracking-wider rounded-sm text-center font-mono"
            >
              + Quick Deposit (₦1k)
            </button>
            <span className="text-[9px] text-geo-text-muted flex items-center font-mono font-semibold">
              PROMO CAMPAIGN ACTIVE
            </span>
          </div>
        </div>


        {/* FIRE TRENDING BETS WITH QUICK-SLIP ADD */}
        <div className="bg-geo-header border border-geo-border rounded-sm p-5 shadow-md space-y-4">
          <div className="flex items-center space-x-2 border-b border-geo-border pb-3">
            <Flame className="w-5 h-5 text-red-500 animate-pulse" />
            <h3 className="font-display font-black text-xs tracking-wider text-white uppercase">
              🔥 Trending Hot Selections
            </h3>
          </div>

          <div className="space-y-3.5">
            {trendingBets.map((tb, idx) => {
              // Find matching live match state for parameters
              const targetMatch = matches.find(m => m.id === tb.matchId);
              const formattedOdds = targetMatch 
                ? (tb.prediction === 'home_win' 
                   ? targetMatch.odds.homeWin 
                   : tb.prediction === 'away_win' 
                     ? targetMatch.odds.awayWin 
                     : targetMatch.odds.draw)
                : tb.displayOdds;

              return (
                <div 
                  key={tb.matchId} 
                  className="bg-geo-card/65 p-3 rounded-sm border border-geo-border hover:border-geo-border-light transition-all space-y-2"
                >
                  <div className="flex justify-between items-center text-[8px] font-mono font-black">
                    <span className="bg-red-950/20 text-red-400 px-1 py-0.5 rounded-sm tracking-widest">{tb.popularity}</span>
                    <span className="text-geo-brand">{tb.backingRate}% BACKED THIS</span>
                  </div>

                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-white truncate uppercase">
                        {tb.prediction === 'home_win' ? tb.teamName : tb.rival} • {tb.prediction === 'home_win' ? 'HOME' : 'AWAY'}
                      </p>
                      <p className="text-[9px] text-geo-text-muted mt-0.5 truncate uppercase">
                        VS {tb.prediction === 'home_win' ? tb.rival : tb.teamName}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-black text-geo-success block">@{formattedOdds.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Visual Backing Bar */}
                  <div className="h-1.5 bg-geo-bg rounded-md overflow-hidden">
                    <div 
                      className={`h-full ${idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-geo-brand' : 'bg-geo-success'}`}
                      style={{ width: `${tb.backingRate}%` }} 
                    />
                  </div>

                  {/* Add action */}
                  <button
                    onClick={() => {
                      if (targetMatch) {
                        addToSlip(targetMatch, tb.prediction);
                        setPromoToast(`⭐ Loaded trending bet: ${tb.teamName} Win into slip!`);
                      } else {
                        setPromoToast("⚠️ Selected fixture is currently locked in arena.");
                      }
                    }}
                    className="w-full mt-1.5 py-1.5 bg-geo-bg text-[9px] font-mono font-bold hover:text-white hover:bg-geo-card border border-geo-border hover:border-geo-brand rounded-sm text-center flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                  >
                    <span>+ Quick Active Slip</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>


        {/* Arena Simulator Panel (Visible strictly to authorized administrator email) */}
        {profile?.email === 'ademusiwamichael1@gmail.com' && (
          <div className="bg-geo-header border border-geo-border rounded-sm p-6 shadow-md space-y-5">
            <div className="flex items-center justify-between border-b border-geo-border pb-3">
              <div className="flex items-center space-x-2">
                <Tv className="w-5 h-5 text-geo-brand" />
                <h3 className="font-display font-bold text-xs tracking-wider text-white uppercase">
                  Mock Simulation Admin
                </h3>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-geo-success animate-pulse" />
            </div>

            <p className="text-xs text-geo-text-muted leading-relaxed font-medium">
              No external sportsbook servers or data APIs are active. Use the controllers below to start matches, advance live play, and resolve simulated payouts immediately in Firestore.
            </p>

            <div className="space-y-3">
              {/* Advance time */}
              <button
                onClick={handleAdvanceSimulationTime}
                disabled={tickerLoading || matches.length === 0}
                className="w-full py-4 bg-geo-brand text-black hover:bg-geo-brand/90 disabled:opacity-40 disabled:cursor-not-allowed rounded-sm font-display font-extrabold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-[0_4px_0_0_#C99B09] hover:shadow-[0_4px_0_0_#C99B09] active:translate-y-1 active:shadow-none cursor-pointer transition-all"
              >
                {tickerLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Advancing Stadiums...</span>
                  </>
                ) : (
                  <>
                    <FastForward className="w-4.5 h-4.5" />
                    <span>Cycle Matches Time (+15')</span>
                  </>
                )}
              </button>

              {/* Reset simulation */}
              <button
                onClick={handleResetSimulation}
                disabled={tickerLoading || matches.length === 0}
                className="w-full py-2.5 border border-geo-border hover:border-geo-border-light bg-geo-card text-geo-text-light hover:text-white rounded-sm font-display font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Reset Arena Fixtures
              </button>
            </div>

            {/* Collapsible info explanation */}
            {showSimInfo && (
              <div className="bg-geo-bg border border-geo-border p-3.5 rounded-sm relative text-xs text-geo-text-muted leading-relaxed space-y-1 font-medium">
                <button 
                  onClick={() => setShowSimInfo(false)}
                  className="absolute top-2 right-2 text-geo-text-muted hover:text-white text-[10px]"
                >
                  ✕
                </button>
                <div className="flex items-center gap-1 text-geo-brand font-mono text-[10px] font-bold uppercase tracking-wider">
                  <Info className="w-3.5 h-3.5 text-geo-brand" />
                  <span>Simulation Rules</span>
                </div>
                <p className="mt-1">1. Click any odds button to populate your bet slip.</p>
                <p>2. Advance time: Upcoming fixtures turn <b>LIVE</b>, live matches increment by <b>15 minutes</b> (goals roll randomly).</p>
                <p>3. At 90', matches conclude and wagers are resolved. Wins automatically credit balance.</p>
              </div>
            )}

            {/* Live events ticker log logs */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-mono uppercase tracking-wider text-geo-text-muted font-bold">
                Stadium Logs
              </h4>
              
              <div className="bg-geo-bg border border-geo-border p-3 rounded-sm h-44 overflow-y-auto font-mono text-[10.5px] text-[#02C076] space-y-2 select-none">
                {logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-geo-text-muted text-center text-[10px] italic">
                    Stadium buzzer idle. Place some bets and cycle time to trigger logs.
                  </div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="leading-snug">
                      <span className="text-geo-brand mr-1.5">&gt;</span>
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
