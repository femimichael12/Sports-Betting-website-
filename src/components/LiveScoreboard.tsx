/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useBetSlip } from '../context/BetSlipContext';
import { sportsApiService, StandingTeam, MatchStatistics, TeamStatistics } from '../services/sportsApi';
import { Match } from '../types';
import { 
  Trophy, 
  Activity, 
  BarChart3, 
  Search, 
  RefreshCw, 
  Tv, 
  ShieldAlert, 
  ChevronDown, 
  ChevronUp, 
  TrendingUp, 
  Target, 
  Info,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function LiveScoreboard() {
  const { addToSlip, slipItem } = useBetSlip();

  // Navigation tab within scoreboard widget
  const [activeTab, setActiveTab] = useState<'matches' | 'standings' | 'profiler'>('matches');

  // Core API-Football loaded states
  const [fixtures, setFixtures] = useState<Match[]>([]);
  const [standings, setStandings] = useState<StandingTeam[]>( []);
  const [apiStatus, setApiStatus] = useState<{ apiFootball: boolean; theOddsApi: boolean } | null>(null);

  // Loading & error trackers
  const [loadingFixtures, setLoadingFixtures] = useState(true);
  const [loadingStandings, setLoadingStandings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Telemetry Match Center expansion states
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [matchStats, setMatchStats] = useState<Record<string, MatchStatistics>>({});
  const [loadingStats, setLoadingStats] = useState<Record<string, boolean>>({});

  // Team Diagnostic Profiler states
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [profiledTeam, setProfiledTeam] = useState<TeamStatistics | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // 1. Check API health & configuration status
  const checkApiHealth = async () => {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        const data = await response.json();
        setApiStatus(data.apiKeysAvailable);
      }
    } catch (err) {
      console.warn('Failed retrieving API gateway health metrics:', err);
    }
  };

  // 2. Fetch fixtures from API-Football proxy
  const loadFixtures = async (forceRefresh = false) => {
    if (!forceRefresh) setLoadingFixtures(true);
    else setRefreshing(true);
    setErrorMsg(null);

    try {
      const data = await sportsApiService.getFixtures(forceRefresh);
      // Filter primarily for football (soccer) fixtures for this scoreboard
      const footballMatches = data.filter(m => m.sport === 'football');
      setFixtures(footballMatches);
    } catch (err) {
      console.error('Failed fetching football fixtures:', err);
      setErrorMsg('Unable to synchronize live API scores. Please retry.');
    } finally {
      setLoadingFixtures(false);
      setRefreshing(false);
    }
  };

  // 3. Fetch league standings from API-Football proxy
  const loadStandings = async (forceRefresh = false) => {
    setLoadingStandings(true);
    try {
      const data = await sportsApiService.getStandings(forceRefresh);
      // Sort ranks ascending
      const sorted = [...data].sort((a, b) => a.rank - b.rank);
      setStandings(sorted);
    } catch (err) {
      console.error('Failed loading standing data:', err);
    } finally {
      setLoadingStandings(false);
    }
  };

  // 4. Fetch specific match telemetry metrics
  const loadMatchStats = async (matchId: string) => {
    if (matchStats[matchId]) return; // Already cached locally in state
    
    setLoadingStats(prev => ({ ...prev, [matchId]: true }));
    try {
      const stats = await sportsApiService.getMatchStatistics(matchId, true);
      setMatchStats(prev => ({ ...prev, [matchId]: stats }));
    } catch (err) {
      console.error(`Failed loading stats for match ${matchId}:`, err);
    } finally {
      setLoadingStats(prev => ({ ...prev, [matchId]: false }));
    }
  };

  // 5. Profiler: Search/diagnose a team's season records
  const handleTeamProfileSearch = async (teamName: string) => {
    if (!teamName.trim()) return;
    setLoadingProfile(true);
    setProfileError(null);
    try {
      const stats = await sportsApiService.getTeamStatistics(teamName, 'football', true);
      setProfiledTeam(stats);
    } catch (err) {
      setProfileError(`Could not find diagnostics for team "${teamName}".`);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Set up initial payloads & background polling
  useEffect(() => {
    checkApiHealth();
    loadFixtures();

    // Setup real-time score updates polling every 15 seconds
    const interval = setInterval(() => {
      loadFixtures(true);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Sync tab loading
  useEffect(() => {
    if (activeTab === 'standings' && standings.length === 0) {
      loadStandings();
    }
  }, [activeTab]);

  const handleToggleMatchDetails = (matchId: string) => {
    if (expandedMatchId === matchId) {
      setExpandedMatchId(null);
    } else {
      setExpandedMatchId(matchId);
      loadMatchStats(matchId);
    }
  };

  // Form helper strings
  const getFormBubbleColor = (char: string) => {
    switch (char.toUpperCase()) {
      case 'W': return 'bg-geo-success text-white';
      case 'D': return 'bg-amber-500 text-black';
      case 'L': return 'bg-red-500/80 text-white';
      default: return 'bg-slate-700 text-slate-300';
    }
  };

  const isRealApiLive = (matchId: string) => matchId.startsWith('apifb_');

  // Separating games for view
  const liveGames = fixtures.filter(m => m.status === 'live');
  const otherGames = fixtures.filter(m => m.status !== 'live');

  return (
    <div id="live-scoreboard-widget" className="bg-geo-header border border-geo-border rounded-sm shadow-xl p-5 sm:p-6 space-y-6">
      
      {/* Top Header Row with Active Feed Status & Manual Sync */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-geo-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-geo-brand" />
            <h2 className="font-display font-black text-sm uppercase tracking-wider text-white">
              API-Football Matchday HQ
            </h2>
          </div>
          
          {/* Active credential status indicators */}
          {apiStatus ? (
            <div className="flex items-center space-x-2 select-none">
              <span className={`w-2 h-2 rounded-full ${apiStatus.apiFootball ? 'bg-geo-success animate-pulse' : 'bg-[#C99B09] animate-pulse'}`} />
              <span className="font-mono text-[9px] font-bold text-geo-text-muted uppercase tracking-wider">
                {apiStatus.apiFootball ? (
                  <span className="text-geo-success">Live API-Football feeds engaged</span>
                ) : (
                  <span>Using simulation (set API_FOOTBALL_KEY for live data)</span>
                )}
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse" />
              <span className="font-mono text-[9.5px] text-geo-text-muted uppercase">Checking feed handshake...</span>
            </div>
          )}
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => loadFixtures(true)}
            disabled={refreshing}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-geo-bg hover:bg-geo-card border border-geo-border hover:border-geo-border-light text-geo-text-light font-mono text-[10px] font-bold uppercase rounded-sm transition-all"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin text-geo-brand' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      {/* Internal Navigation Ribbon */}
      <div className="flex border-b border-geo-border/60">
        <button
          onClick={() => setActiveTab('matches')}
          className={`flex-1 py-2.5 text-center text-xs uppercase tracking-wider font-extrabold pb-3 relative transition-all ${
            activeTab === 'matches' ? 'text-geo-brand font-black' : 'text-geo-text-muted hover:text-white'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span>Live Scoreboard</span>
          </div>
          {activeTab === 'matches' && (
            <motion.div layoutId="scoreboardActiveLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-geo-brand" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('standings')}
          className={`flex-1 py-2.5 text-center text-xs uppercase tracking-wider font-extrabold pb-3 relative transition-all ${
            activeTab === 'standings' ? 'text-geo-brand font-black' : 'text-geo-text-muted hover:text-white'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>League Table</span>
          </div>
          {activeTab === 'standings' && (
            <motion.div layoutId="scoreboardActiveLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-geo-brand" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('profiler')}
          className={`flex-1 py-2.5 text-center text-xs uppercase tracking-wider font-extrabold pb-3 relative transition-all ${
            activeTab === 'profiler' ? 'text-geo-brand font-black' : 'text-geo-text-muted hover:text-white'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Search className="w-3.5 h-3.5" />
            <span>Team Profiler</span>
          </div>
          {activeTab === 'profiler' && (
            <motion.div layoutId="scoreboardActiveLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-geo-brand" />
          )}
        </button>
      </div>

      {/* Main Container Views switcher */}
      <div>
        <AnimatePresence mode="wait">
          
          {/* TAB 1: LIVE & RECENT FIXTURES SCOREBOARD */}
          {activeTab === 'matches' && (
            <motion.div
              key="matches-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              {loadingFixtures ? (
                <div className="flex flex-col items-center justify-center py-20 text-geo-text-muted space-y-3">
                  <div className="w-8 h-8 border-2 border-geo-brand/20 border-t-geo-brand rounded-full animate-spin" />
                  <span className="font-mono text-[10px] font-bold tracking-wider uppercase">Loading real-time match streams...</span>
                </div>
              ) : errorMsg ? (
                <div className="bg-geo-bg border border-red-950/30 rounded-sm p-4 text-center space-y-2">
                  <ShieldAlert className="w-8 h-8 text-red-500 mx-auto" />
                  <p className="text-xs font-bold text-white uppercase">{errorMsg}</p>
                </div>
              ) : fixtures.length === 0 ? (
                <div className="bg-geo-bg border border-geo-border rounded-sm py-12 px-6 text-center text-geo-text-muted space-y-2 max-w-sm mx-auto">
                  <Tv className="w-8 h-8 mx-auto text-geo-border" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">No Matches Scheduled</h4>
                  <p className="text-[11px] leading-relaxed">
                    There are no matches currently running on API-Football. Set mock variables or advance time to simulate records.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  
                  {/* LIVE GAMES SUBSECTION */}
                  {liveGames.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-1 text-[10px] font-mono text-red-500 font-bold uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping mr-1" />
                        <span>Active Matches ({liveGames.length})</span>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        {liveGames.map((match) => (
                          <div 
                            key={match.id} 
                            className="bg-geo-card/60 hover:bg-geo-card border border-geo-border rounded-sm transition-all overflow-hidden"
                          >
                            {/* Card Header information row */}
                            <div className="flex justify-between items-center px-4 py-2.5 bg-geo-bg/50 border-b border-geo-border text-[9.5px] font-mono select-none">
                              <span className="flex items-center text-red-400 font-black">
                                <span className="w-1 h-1 bg-red-500 rounded-full mr-1.5 animate-pulse" />
                                MATCH HOUR • {match.minute}'
                              </span>
                              
                              <div className="flex items-center space-x-1.5">
                                <span className="text-geo-text-muted font-bold">PREMIER LEAGUE</span>
                              </div>
                            </div>

                            {/* Core Score display and expand triggers */}
                            <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div 
                                onClick={() => handleToggleMatchDetails(match.id)}
                                className="flex-1 min-w-0 flex items-center justify-between cursor-pointer group pr-2"
                              >
                                <div className="space-y-1.5 flex-1 min-w-0 pr-4">
                                  <div className="flex items-center justify-between">
                                    <span className="font-display font-bold text-sm text-white group-hover:text-geo-brand transition-colors truncate uppercase">
                                      {match.homeTeam}
                                    </span>
                                    <span className="font-mono font-black text-sm text-geo-success">{match.score.home}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="font-display font-bold text-sm text-[#F0B90B] group-hover:text-geo-brand transition-colors truncate uppercase">
                                      {match.awayTeam}
                                    </span>
                                    <span className="font-mono font-black text-sm text-geo-success">{match.score.away}</span>
                                  </div>
                                </div>

                                <div className="pl-4 shrink-0 border-l border-geo-border text-geo-text-muted hover:text-white transition-colors">
                                  {expandedMatchId === match.id ? (
                                    <ChevronUp className="w-4 h-4 text-geo-brand" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </div>
                              </div>

                              {/* Action Quick Betting Odds panel */}
                              <div className="grid grid-cols-3 gap-2 shrink-0 w-full md:w-60">
                                <button
                                  onClick={() => addToSlip(match, 'home_win')}
                                  className={`p-2 rounded-xs border text-center transition-all select-none flex flex-col items-center justify-center gap-0.5 ${
                                    slipItem?.match.id === match.id && slipItem?.predictedOutcome === 'home_win'
                                      ? 'bg-geo-brand border-geo-brand text-black font-extrabold'
                                      : 'bg-geo-bg border-geo-border text-geo-text-muted hover:border-geo-brand hover:text-white font-bold'
                                  }`}
                                >
                                  <span className="text-[8px] font-mono tracking-wider text-geo-text-muted">HOME</span>
                                  <span className="font-mono text-xs font-black">{match.odds.homeWin.toFixed(2)}</span>
                                </button>
                                <button
                                  onClick={() => addToSlip(match, 'draw')}
                                  className={`p-2 rounded-xs border text-center transition-all select-none flex flex-col items-center justify-center gap-0.5 ${
                                    slipItem?.match.id === match.id && slipItem?.predictedOutcome === 'draw'
                                      ? 'bg-geo-brand border-geo-brand text-black font-extrabold'
                                      : 'bg-geo-bg border-geo-border text-geo-text-muted hover:border-geo-brand hover:text-white font-bold'
                                  }`}
                                >
                                  <span className="text-[8px] font-mono tracking-wider text-geo-text-muted">DRAW</span>
                                  <span className="font-mono text-xs font-black">{match.odds.draw.toFixed(2)}</span>
                                </button>
                                <button
                                  onClick={() => addToSlip(match, 'away_win')}
                                  className={`p-2 rounded-xs border text-center transition-all select-none flex flex-col items-center justify-center gap-0.5 ${
                                    slipItem?.match.id === match.id && slipItem?.predictedOutcome === 'away_win'
                                      ? 'bg-geo-brand border-geo-brand text-black font-extrabold'
                                      : 'bg-geo-bg border-geo-border text-geo-text-muted hover:border-geo-brand hover:text-white font-bold'
                                  }`}
                                >
                                  <span className="text-[8px] font-mono tracking-wider text-geo-text-muted">AWAY</span>
                                  <span className="font-mono text-xs font-black">{match.odds.awayWin.toFixed(2)}</span>
                                </button>
                              </div>
                            </div>

                            {/* Collapsible Telemetry Statistics panel */}
                            <AnimatePresence>
                              {expandedMatchId === match.id && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="border-t border-geo-border bg-geo-bg/30 overflow-hidden"
                                >
                                  {loadingStats[match.id] ? (
                                    <div className="py-6 flex items-center justify-center gap-2 text-geo-text-muted text-[10px] font-mono">
                                      <div className="w-3.5 h-3.5 border border-geo-brand/40 border-t-geo-brand rounded-full animate-spin" />
                                      <span>Fetching API Stats...</span>
                                    </div>
                                  ) : matchStats[match.id] ? (
                                    <div className="p-4 space-y-3 font-mono text-[10px] text-geo-text-muted">
                                      <div className="flex items-center gap-1 pb-1 border-b border-geo-border text-white text-[9.5px] uppercase font-bold tracking-wide">
                                        <Activity className="w-4 h-4 text-geo-brand" />
                                        <span>Live Match Telemetry Statistics</span>
                                      </div>

                                      {/* Side by side telemetry stats bars */}
                                      {(() => {
                                        const s = matchStats[match.id];
                                        const statsList = [
                                          { label: 'Ball Possession %', home: s.possession.home, away: s.possession.away, suffix: '%' },
                                          { label: 'Shots on Target', home: s.shotsOnGoal.home, away: s.shotsOnGoal.away },
                                          { label: 'Shots off Target', home: s.shotsOffGoal.home, away: s.shotsOffGoal.away },
                                          { label: 'Corner Kicks', home: s.corners.home, away: s.corners.away },
                                          { label: 'Fouls Committed', home: s.fouls.home, away: s.fouls.away },
                                          { label: 'Yellow Cards', home: s.yellowCards.home, away: s.yellowCards.away },
                                          { label: 'Red Cards', home: s.redCards.home, away: s.redCards.away, isDanger: true }
                                        ];

                                        return statsList.map((st, i) => {
                                          const total = st.home + st.away || 1;
                                          const homePct = Math.round((st.home / total) * 100);
                                          const awayPct = 100 - homePct;

                                          return (
                                            <div key={i} className="space-y-1">
                                              <div className="flex justify-between items-center text-[9px] font-bold">
                                                <span className={`${st.home > st.away ? 'text-white' : ''}`}>{st.home}{st.suffix ?? ''}</span>
                                                <span className="uppercase text-[8.5px] tracking-wider text-geo-text-muted">{st.label}</span>
                                                <span className={`${st.away > st.home ? 'text-white' : ''}`}>{st.away}{st.suffix ?? ''}</span>
                                              </div>
                                              <div className="h-1.5 bg-geo-bg rounded-xs overflow-hidden flex">
                                                <div 
                                                  className={`h-full ${st.isDanger ? 'bg-red-500' : 'bg-geo-brand'} transition-all duration-500`}
                                                  style={{ width: `${st.home > 0 || st.away > 0 ? homePct : 50}%` }}
                                                />
                                                <div 
                                                  className={`h-full ${st.isDanger ? 'bg-red-400/30' : 'bg-geo-border'} transition-all duration-500`}
                                                  style={{ width: `2px` }}
                                                />
                                                <div 
                                                  className={`h-full ${st.isDanger ? 'bg-red-650' : 'bg-geo-success'} transition-all duration-500`}
                                                  style={{ width: `${st.home > 0 || st.away > 0 ? awayPct : 50}%` }}
                                                />
                                              </div>
                                            </div>
                                          );
                                        });
                                      })()}
                                      
                                      <div className="pt-2 text-center text-[9px] text-geo-text-muted border-t border-geo-border border-dashed font-medium">
                                        Data provided through official sports registries. Settled procedurally in database.
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-4 text-center text-geo-text-muted text-[10px]">
                                      No telemetry stats reported for this event.
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* OTHER FIXTURES (UPCOMING / RECENT) */}
                  {otherGames.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-[10px] font-mono text-geo-text-muted font-bold uppercase tracking-wider">
                        <span>Scheduled & Concluded Fixtures ({otherGames.length})</span>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5">
                        {otherGames.map((match) => {
                          const isFinished = match.status === 'completed';
                          const startTime = new Date(match.commencesAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                          return (
                            <div 
                              key={match.id} 
                              className={`p-3.5 rounded-sm border ${isFinished ? 'bg-geo-bg/40 border-geo-border/60' : 'bg-geo-card/45 border-geo-border'} flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs`}
                            >
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="flex items-center space-x-2 text-[9px] font-mono uppercase tracking-wide">
                                  {isFinished ? (
                                    <span className="text-geo-text-muted bg-geo-bg px-1.5 py-0.5 rounded-xs border border-geo-border">Concluded FT</span>
                                  ) : (
                                    <span className="text-geo-brand bg-geo-brand/5 px-1.5 py-0.5 rounded-xs border border-geo-brand/10">Upcoming @ {startTime}</span>
                                  )}
                                  <span className="text-geo-text-muted">PREMIER LEAGUE</span>
                                </div>

                                <div className="flex items-center justify-between mt-2 max-w-sm">
                                  <div className="space-y-1 min-w-0 flex-1">
                                    <p className={`font-bold uppercase truncate ${match.result === 'home_win' ? 'text-geo-success' : 'text-white'}`}>{match.homeTeam}</p>
                                    <p className={`font-bold uppercase truncate ${match.result === 'away_win' ? 'text-geo-success' : 'text-[#F0B90B]'}`}>{match.awayTeam}</p>
                                  </div>

                                  {isFinished && (
                                    <div className="ml-4 px-2 py-1 bg-geo-bg rounded-xs font-mono font-black text-geo-success flex items-center gap-1">
                                      <span>{match.score.home}</span>
                                      <span className="text-geo-text-muted font-normal">:</span>
                                      <span>{match.score.away}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Betting panel choice button odds */}
                              {!isFinished && (
                                <div className="grid grid-cols-3 gap-1.5 shrink-0 w-full sm:w-56 self-center">
                                  <button
                                    onClick={() => addToSlip(match, 'home_win')}
                                    className={`py-1.5 px-2 rounded-xs border text-center transition-all flex flex-col justify-center items-center ${
                                      slipItem?.match.id === match.id && slipItem?.predictedOutcome === 'home_win'
                                        ? 'bg-geo-brand border-geo-brand text-black font-black'
                                        : 'bg-geo-bg border-geo-border text-geo-text-muted hover:border-geo-brand hover:text-white font-bold'
                                    }`}
                                  >
                                    <span className="text-[7.5px] font-mono leading-none tracking-wider font-bold">1</span>
                                    <span className="font-mono text-[10px] font-black leading-none mt-0.5">{match.odds.homeWin.toFixed(2)}</span>
                                  </button>
                                  <button
                                    onClick={() => addToSlip(match, 'draw')}
                                    className={`py-1.5 px-2 rounded-xs border text-center transition-all flex flex-col justify-center items-center ${
                                      slipItem?.match.id === match.id && slipItem?.predictedOutcome === 'draw'
                                        ? 'bg-geo-brand border-geo-brand text-black font-black'
                                        : 'bg-geo-bg border-geo-border text-geo-text-muted hover:border-geo-brand hover:text-white font-bold'
                                    }`}
                                  >
                                    <span className="text-[7.5px] font-mono leading-none tracking-wider font-bold">X</span>
                                    <span className="font-mono text-[10px] font-black leading-none mt-0.5">{match.odds.draw.toFixed(2)}</span>
                                  </button>
                                  <button
                                    onClick={() => addToSlip(match, 'away_win')}
                                    className={`py-1.5 px-2 rounded-xs border text-center transition-all flex flex-col justify-center items-center ${
                                      slipItem?.match.id === match.id && slipItem?.predictedOutcome === 'away_win'
                                        ? 'bg-geo-brand border-geo-brand text-black font-black'
                                        : 'bg-geo-bg border-geo-border text-geo-text-muted hover:border-geo-brand hover:text-white font-bold'
                                    }`}
                                  >
                                    <span className="text-[7.5px] font-mono leading-none tracking-wider font-bold">2</span>
                                    <span className="font-mono text-[10px] font-black leading-none mt-0.5">{match.odds.awayWin.toFixed(2)}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </motion.div>
          )}

          {/* TAB 2: SOCCER LEAGUE STANDINGS TABLE */}
          {activeTab === 'standings' && (
            <motion.div
              key="standings-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {loadingStandings ? (
                <div className="flex flex-col items-center justify-center py-20 text-geo-text-muted space-y-3">
                  <div className="w-8 h-8 border-2 border-geo-brand/20 border-t-geo-brand rounded-full animate-spin" />
                  <span className="font-mono text-[10px] font-semibold tracking-wider uppercase">Loading Table Standings...</span>
                </div>
              ) : standings.length === 0 ? (
                <div className="text-center py-12 text-geo-text-muted text-xs">
                  Standings database unpopulated. Check connection parameters.
                </div>
              ) : (
                <div className="overflow-x-auto border border-geo-border rounded-sm">
                  <table className="w-full text-left font-mono text-[10px] text-geo-text-muted">
                    <thead className="bg-geo-bg/85 text-[8.5px] text-white uppercase tracking-wider font-bold border-b border-geo-border select-none">
                      <tr>
                        <th className="py-3 px-3.5 text-center w-10">POS</th>
                        <th className="py-3 px-3">TEAM NAME</th>
                        <th className="py-3 px-2 text-center w-10">P</th>
                        <th className="py-3 px-2 text-center w-10">W</th>
                        <th className="py-3 px-2 text-center w-10">D</th>
                        <th className="py-3 px-2 text-center w-10">L</th>
                        <th className="py-3 px-2 text-center w-12">GD</th>
                        <th className="py-3 px-3 text-center w-14 text-geo-brand font-black">PTS</th>
                        <th className="py-3 px-3 text-center w-28 hidden sm:table-cell">FORM</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-geo-border bg-geo-card/25">
                      {standings.map((row) => {
                        const isMainDuo = row.rank <= 3;
                        const goalDiff = row.goalsFor - row.goalsAgainst;

                        return (
                          <tr 
                            key={row.team} 
                            onClick={() => {
                              setActiveTab('profiler');
                              setTeamSearchQuery(row.team);
                              handleTeamProfileSearch(row.team);
                            }}
                            className="hover:bg-geo-card/85 transition-colors cursor-pointer group"
                          >
                            <td className="py-3 px-3.5 text-center font-bold">
                              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] ${
                                isMainDuo 
                                  ? 'bg-[#F0B90B]/12 text-[#F0B90B] border border-[#F0B90B]/20 font-black' 
                                  : 'text-geo-text-muted'
                              }`}>
                                {row.rank}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-display font-black text-white uppercase group-hover:text-geo-brand transition-colors text-xs truncate max-w-[140px]">
                              {row.team}
                            </td>
                            <td className="py-3 px-2 text-center text-geo-text-light font-bold">{row.played}</td>
                            <td className="py-3 px-2 text-center text-geo-text-light">{row.win}</td>
                            <td className="py-3 px-2 text-center text-geo-text-light">{row.draw}</td>
                            <td className="py-3 px-2 text-center text-geo-text-light">{row.loss}</td>
                            <td className={`py-3 px-2 text-center ${goalDiff > 0 ? 'text-geo-success font-bold' : goalDiff < 0 ? 'text-red-400' : ''}`}>
                              {goalDiff > 0 ? `+${goalDiff}` : goalDiff}
                            </td>
                            <td className="py-3 px-3 text-center text-geo-brand font-black text-xs bg-geo-brand/5 border-x border-geo-border/40">
                              {row.points}
                            </td>
                            <td className="py-3 px-3 text-center hidden sm:table-cell select-none">
                              <div className="flex items-center justify-center space-x-1 font-sans text-[7.5px] font-black">
                                {(row.form || 'WWWDW').split('').slice(0, 5).map((char, index) => (
                                  <span 
                                    key={index} 
                                    className={`w-4 h-4 rounded-xs inline-flex items-center justify-center font-bold uppercase ${getFormBubbleColor(char)}`}
                                  >
                                    {char}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 3: TEAM DIAGNOSTIC PROFILER EXPLORER */}
          {activeTab === 'profiler' && (
            <motion.div
              key="profiler-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="block text-[9.5px] font-mono uppercase tracking-wider text-geo-text-muted font-bold">
                  Diagnose Season Performance
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-geo-text-muted w-4 h-4" />
                    <input
                      type="text"
                      value={teamSearchQuery}
                      onChange={(e) => setTeamSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleTeamProfileSearch(teamSearchQuery)}
                      placeholder="Enter Football Team (e.g., Real Madrid)..."
                      className="w-full bg-geo-bg border border-geo-border focus:border-geo-brand focus:outline-none rounded-sm py-2.5 pl-10 pr-4 text-xs font-bold text-geo-text-light uppercase tracking-wide"
                    />
                  </div>
                  <button
                    onClick={() => handleTeamProfileSearch(teamSearchQuery)}
                    disabled={loadingProfile}
                    className="px-5 py-2.5 bg-geo-brand hover:bg-[#E2AF0B] text-black font-display font-black text-xs uppercase tracking-wider rounded-sm transition-all focus:outline-none shrink-0"
                  >
                    {loadingProfile ? 'Analyzing...' : 'Analyze'}
                  </button>
                </div>
              </div>

              {/* Diagnostic Profile Results */}
              {profiledTeam ? (
                <div className="bg-geo-bg/40 border border-geo-border rounded-sm p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-geo-border/60 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5">
                        <ShieldCheck className="w-4.5 h-4.5 text-geo-brand" />
                        <h3 className="font-display font-black text-lg text-white uppercase tracking-tight">
                          {profiledTeam.team}
                        </h3>
                      </div>
                      <p className="font-mono text-[9px] text-[#02C076] font-bold uppercase tracking-wider">
                        Diagnostics Index Profile • League Season 2025
                      </p>
                    </div>

                    {/* Form indicator */}
                    <div className="flex items-center gap-1 select-none font-sans text-[8px] font-black">
                      <span className="font-mono text-[9px] text-geo-text-muted mr-1">FORM:</span>
                      {profiledTeam.form.split('').slice(0, 5).map((char, index) => (
                        <span 
                          key={index} 
                          className={`w-4 h-4 rounded-xs inline-flex items-center justify-center font-bold uppercase ${getFormBubbleColor(char)}`}
                        >
                          {char}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic stats layout */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                    <div className="bg-geo-bg/80 border border-geo-border/80 p-3 rounded-xs text-center space-y-1 select-none">
                      <span className="text-[8.5px] font-mono text-geo-text-muted uppercase block font-bold">Games Tracked</span>
                      <span className="text-lg font-mono font-black text-white block">{profiledTeam.fixtures.played}</span>
                    </div>
                    <div className="bg-geo-bg/80 border border-geo-border/80 p-3 rounded-xs text-center space-y-1 select-none">
                      <span className="text-[8.5px] font-mono text-geo-text-muted uppercase block font-bold">Wins Ratio</span>
                      <span className="text-lg font-mono font-black text-geo-success block">
                        {Math.round((profiledTeam.fixtures.wins / profiledTeam.fixtures.played) * 100)}%
                      </span>
                    </div>
                    <div className="bg-geo-bg/80 border border-geo-border/80 p-3 rounded-xs text-center space-y-1 select-none">
                      <span className="text-[8.5px] font-mono text-[#02C076] uppercase block font-bold">Clean Sheets</span>
                      <span className="text-lg font-mono font-black text-[#02C076] block">{profiledTeam.cleanSheets}</span>
                    </div>
                    <div className="bg-geo-bg/80 border border-geo-border/80 p-3 rounded-xs text-center space-y-1 select-none">
                      <span className="text-[8.5px] font-mono text-red-400 uppercase block font-bold">Failed to Score</span>
                      <span className="text-lg font-mono font-black text-red-400 block">{profiledTeam.failedToScore}</span>
                    </div>
                  </div>

                  {/* Secondary metric grids in details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-geo-border/50 pt-3 text-xs font-mono">
                    <div className="space-y-2">
                      <div className="flex justify-between font-bold text-[9px] uppercase hover:text-white">
                        <span>Total Goals Scored:</span>
                        <span className="text-geo-brand">{profiledTeam.goals.for}</span>
                      </div>
                      <div className="flex justify-between font-bold text-[9px] uppercase hover:text-white">
                        <span>Average Scored Proportion:</span>
                        <span className="text-geo-brand">{(profiledTeam.goals.for / profiledTeam.fixtures.played).toFixed(2)} / match</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between font-bold text-[9px] uppercase hover:text-white">
                        <span>Goals Conceded:</span>
                        <span className="text-geo-text-muted">{profiledTeam.goals.against}</span>
                      </div>
                      <div className="flex justify-between font-bold text-[9px] uppercase hover:text-white">
                        <span>Average Conceded Proportion:</span>
                        <span className="text-geo-text-muted">{(profiledTeam.goals.against / profiledTeam.fixtures.played).toFixed(2)} / match</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick diagnostic check banner */}
                  <div className="bg-geo-brand/5 border border-geo-brand/15 p-3 rounded-xs flex items-center space-x-2 text-[10.5px] select-none text-geo-text-muted">
                    <Info className="w-4.5 h-4.5 text-geo-brand shrink-0" />
                    <p className="font-sans leading-relaxed text-[11px]">
                      Analytical verdict: Based on form indexes, <b>{profiledTeam.team}</b> is presenting structured defense profiles with {(profiledTeam.cleanSheets / profiledTeam.fixtures.played * 100).toFixed(0)}% clean shut-out capability.
                    </p>
                  </div>
                </div>
              ) : profiledTeam === null && !loadingProfile && !profileError ? (
                <div className="border border-geo-border border-dashed rounded-sm py-14 text-center text-geo-text-muted space-y-1.5">
                  <TrendingUp className="w-7 h-7 mx-auto text-geo-border" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wide">Enter a football team to inspect</h4>
                  <p className="text-[10.5px] max-w-sm mx-auto leading-relaxed">
                    Search above or click any team name in the League Standings page to inspect diagnostics.
                  </p>
                </div>
              ) : profileError ? (
                <div className="bg-red-950/15 border border-red-900/30 rounded-sm p-4 text-center text-xs text-red-400">
                  {profileError}
                </div>
              ) : null}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
