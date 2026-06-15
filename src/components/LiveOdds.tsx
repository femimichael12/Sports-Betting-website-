/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useBetSlip } from '../context/BetSlipContext';
import { sportsApiService, BettingPlace } from '../services/sportsApi';
import { Match } from '../types';
import { 
  TrendingUp, 
  Search, 
  RefreshCw, 
  Zap, 
  Clock, 
  Calendar,
  Info,
  DollarSign,
  SearchCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function LiveOdds() {
  const { addToSlip, isSelectionActive } = useBetSlip();

  // Component states
  const [bettingPlaces, setBettingPlaces] = useState<BettingPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<boolean | null>(null);

  // 1. Check API credentials handshake
  const checkApiHealth = async () => {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        const data = await response.json();
        setApiStatus(data.apiKeysAvailable?.theOddsApi ?? false);
      }
    } catch (err) {
      console.warn('LiveOdds: gateway health check unsuccessful:', err);
    }
  };

  // 2. Load lists from The Odds API proxy
  const loadOdds = async (forceRefresh = false) => {
    if (!forceRefresh) setLoading(true);
    else setRefreshing(true);
    setErrorMsg(null);

    try {
      const data = await sportsApiService.getBettingOdds(forceRefresh);
      setBettingPlaces(data);
    } catch (err) {
      console.error('Failed loading current betting odds lines:', err);
      setErrorMsg('Unable to synchronize Real Odds feed. Serving backend simulation backup.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    checkApiHealth();
    loadOdds();

    // Background interval check every 30 seconds
    const timer = setInterval(() => {
      loadOdds(true);
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  // Map BettingPlace structure to standard Match structure for state/BetSlip synchronization
  const mapPlaceToMatch = (place: BettingPlace): Match => {
    return {
      id: place.id,
      sport: 'football', // Defaulting to football since UCL is fetched
      homeTeam: place.homeTeam,
      awayTeam: place.awayTeam,
      commencesAt: place.commencesAt,
      status: 'upcoming',
      odds: {
        homeWin: place.odds.homeWin,
        awayWin: place.odds.awayWin,
        draw: place.odds.draw
      },
      score: { home: 0, away: 0 },
      result: 'pending',
      createdAt: new Date().toISOString()
    };
  };

  const handleSelectOutcome = (place: BettingPlace, outcome: 'home_win' | 'draw' | 'away_win') => {
    const matchObject = mapPlaceToMatch(place);
    addToSlip(matchObject, outcome);
  };

  // Filter lists based on user search string
  const filteredOdds = bettingPlaces.filter(place => {
    const term = searchQuery.toLowerCase();
    return (
      place.homeTeam.toLowerCase().includes(term) ||
      place.awayTeam.toLowerCase().includes(term)
    );
  });

  // Unique key identifier of selecting choice
  const isSelected = (placeId: string, outcome: 'home_win' | 'draw' | 'away_win') => {
    return isSelectionActive(placeId, outcome);
  };

  const isRealOddsApiKeyActive = bettingPlaces.some(p => p.id.startsWith('oddsapi_'));

  return (
    <div id="live-odds-feed-widget" className="bg-geo-header border border-geo-border rounded-sm shadow-xl p-5 sm:p-6 space-y-5">
      
      {/* Top Title Bar & API Credential Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-geo-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-geo-brand animate-pulse" />
            <h2 className="font-display font-black text-sm uppercase tracking-wider text-white">
              The Odds API Live Market Board
            </h2>
          </div>
          
          <div className="flex items-center space-x-2 select-none">
            <span className={`w-2 h-2 rounded-full ${isRealOddsApiKeyActive ? 'bg-geo-success shadow-[0_0_8px_var(--color-geo-success)]' : 'bg-[#C99B09]'} animate-pulse`} />
            <span className="font-mono text-[9px] font-bold text-geo-text-muted uppercase tracking-wider">
              {isRealOddsApiKeyActive ? (
                <span className="text-geo-success">SECURE THE-ODDS-API LINES CONNECTED</span>
              ) : (
                <span>Using Simulation (Set THE_ODDS_API_KEY for Real-Time Books)</span>
              )}
            </span>
          </div>
        </div>

        {/* Sync trigger control button */}
        <button
          onClick={() => loadOdds(true)}
          disabled={refreshing}
          className="flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-geo-bg hover:bg-geo-card border border-geo-border hover:border-geo-border-light text-geo-text-light font-mono text-[10px] font-bold uppercase rounded-sm transition-all self-start sm:self-center"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin text-geo-brand' : ''}`} />
          <span>{refreshing ? 'Refreshing Markets...' : 'Refresh odds'}</span>
        </button>
      </div>

      {/* Dynamic Sub-Search Input Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-geo-text-muted w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search betting matches by team name..."
            className="w-full bg-geo-bg border border-geo-border focus:border-geo-brand focus:outline-none rounded-sm py-2 pl-10 pr-4 text-xs font-bold text-geo-text-light uppercase tracking-wide placeholder-geo-text-muted/65"
          />
        </div>
        
        <div className="flex items-center gap-1.5 text-geo-text-muted text-[10px] font-mono self-end sm:self-center bg-geo-bg px-2.5 py-1 rounded-xs border border-geo-border/60">
          <Clock className="w-3.5 h-3.5" />
          <span className="uppercase text-[9px]">UCL Soccer Sportsbook</span>
        </div>
      </div>

      {/* Primary Betting Lines Interactive Cards Area */}
      <div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-geo-text-muted space-y-3">
            <div className="w-8 h-8 border-2 border-geo-brand/20 border-t-geo-brand rounded-full animate-spin" />
            <span className="font-mono text-[10px] font-bold tracking-wider uppercase">Fetching current bookmaker lines...</span>
          </div>
        ) : errorMsg && filteredOdds.length === 0 ? (
          <div className="bg-geo-bg border border-red-950/30 rounded-sm p-5 text-center space-y-2">
            <Info className="w-8 h-8 text-[#C99B09] mx-auto" />
            <p className="text-xs font-bold text-white uppercase">{errorMsg}</p>
          </div>
        ) : filteredOdds.length === 0 ? (
          <div className="bg-geo-bg border border-geo-border rounded-sm py-14 px-6 text-center text-geo-text-muted space-y-2 max-w-sm mx-auto">
            <SearchCode className="w-8 h-8 mx-auto text-geo-border" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">No Matches Match Query</h4>
            <p className="text-[10.5px] leading-relaxed">
              We couldn't find any current market lists matching "{searchQuery}". Search for another team name or refresh odds.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filteredOdds.map((place) => {
                const isRealOddsMatch = place.id.startsWith('oddsapi_');
                const kickoffDate = new Date(place.commencesAt);
                const isHappeningToday = kickoffDate.toDateString() === new Date().toDateString();

                return (
                  <motion.div
                    key={place.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="bg-geo-card hover:bg-geo-card/90 border border-geo-border hover:border-geo-border-light rounded-sm p-4.5 space-y-3 flex flex-col justify-between transition-all"
                  >
                    {/* Header Row */}
                    <div className="flex justify-between items-center text-[9px] font-mono text-geo-text-muted select-none">
                      <div className="flex items-center space-x-1.5 font-bold">
                        <Calendar className="w-3.5 h-3.5 text-geo-brand" />
                        <span>
                          {isHappeningToday 
                            ? `TODAY @ ${kickoffDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : kickoffDate.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          }
                        </span>
                      </div>
                      
                      {isRealOddsMatch && (
                        <span className="px-1 bg-geo-success/15 border border-geo-success/25 rounded-xs text-geo-success font-black tracking-widest text-[7.5px] flex items-center gap-1 uppercase">
                          <Zap className="w-2.5 h-2.5 fill-current" />
                          <span>H2H REAL</span>
                        </span>
                      )}
                    </div>

                    {/* Team Names Visualized elegantly */}
                    <div className="py-2 space-y-2 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-display font-black text-sm text-white uppercase tracking-tight truncate max-w-[85%]">
                          {place.homeTeam}
                        </span>
                        <span className="font-mono text-[9px] text-geo-text-muted uppercase font-bold shrink-0">H</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="font-display font-black text-sm text-[#F0B90B] uppercase tracking-tight truncate max-w-[85%]">
                          {place.awayTeam}
                        </span>
                        <span className="font-mono text-[9px] text-[#F0B90B] uppercase font-bold shrink-0">A</span>
                      </div>
                    </div>

                    {/* Interactive Selection Grid Action Controllers */}
                    <div className="space-y-1.5 pt-3.5 border-t border-geo-border/60">
                      <div className="grid grid-cols-3 gap-2">
                        {/* Option 1: HOME */}
                        <button
                          onClick={() => handleSelectOutcome(place, 'home_win')}
                          className={`py-2 px-1 rounded-xs border text-center transition-all select-none flex flex-col items-center justify-center gap-0.5 ${
                            isSelected(place.id, 'home_win')
                              ? 'bg-geo-brand border-geo-brand text-black font-extrabold shadow-[0_0_12px_rgba(240,185,11,0.25)]'
                              : 'bg-geo-bg border-geo-border text-geo-text-light hover:border-geo-brand hover:bg-geo-card hover:text-white font-bold'
                          }`}
                        >
                          <span className="text-[7.5px] font-mono tracking-wider text-geo-text-muted uppercase">Home (1)</span>
                          <span className="font-mono text-xs font-black">{place.odds.homeWin.toFixed(2)}</span>
                        </button>

                        {/* Option 2: DRAW */}
                        <button
                          onClick={() => handleSelectOutcome(place, 'draw')}
                          className={`py-2 px-1 rounded-xs border text-center transition-all select-none flex flex-col items-center justify-center gap-0.5 ${
                            isSelected(place.id, 'draw')
                              ? 'bg-geo-brand border-geo-brand text-black font-extrabold shadow-[0_0_12px_rgba(240,185,11,0.25)]'
                              : 'bg-geo-bg border-geo-border text-geo-text-light hover:border-geo-brand hover:bg-geo-card hover:text-white font-bold'
                          }`}
                        >
                          <span className="text-[7.5px] font-mono tracking-wider text-geo-text-muted uppercase">Draw (X)</span>
                          <span className="font-mono text-xs font-black">{place.odds.draw.toFixed(2)}</span>
                        </button>

                        {/* Option 3: AWAY */}
                        <button
                          onClick={() => handleSelectOutcome(place, 'away_win')}
                          className={`py-2 px-1 rounded-xs border text-center transition-all select-none flex flex-col items-center justify-center gap-0.5 ${
                            isSelected(place.id, 'away_win')
                              ? 'bg-geo-brand border-geo-brand text-black font-extrabold shadow-[0_0_12px_rgba(240,185,11,0.25)]'
                              : 'bg-geo-bg border-geo-border text-geo-text-light hover:border-geo-brand hover:bg-geo-card hover:text-white font-bold'
                          }`}
                        >
                          <span className="text-[7.5px] font-mono tracking-wider text-geo-text-muted uppercase">Away (2)</span>
                          <span className="font-mono text-xs font-black">{place.odds.awayWin.toFixed(2)}</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {infoFooter()}
    </div>
  );

  function infoFooter() {
    return (
      <div className="bg-geo-brand/5 border border-geo-brand/15 p-3 rounded-xs flex items-start space-x-2 text-[10px] select-none text-geo-text-muted">
        <Info className="w-4 h-4 text-geo-brand shrink-0 mt-0.5" />
        <div className="font-sans leading-relaxed text-[11px] space-y-1">
          <p>
            <b>Selection Directions</b>: Tap either the <b>Home</b>, <b>Draw</b> or <b>Away</b> price blocks inside any fixture card above to activate the instant Betting Slip on the right console side.
          </p>
          <p className="text-[10px] opacity-80">
            * Odds figures represent standard European prices. Real-world changes are tracked securely and cached server-side to limit API throttling bounds.
          </p>
        </div>
      </div>
    );
  }
}
