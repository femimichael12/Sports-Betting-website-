/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Match } from '../types';
import { 
  sportsApiService, 
  StandingTeam, 
  MatchStatistics, 
  TeamStatistics 
} from '../services/sportsApi';

export interface LiveEvent {
  id: string;
  minute: number;
  type: 'goal' | 'red_card' | 'yellow_card' | 'corner' | 'shot_on_target' | 'kickoff' | 'full_time';
  team: 'home' | 'away' | null;
  detail: string;
}

export interface LiveNotification {
  id: string;
  type: 'goal' | 'red_card' | 'corner' | 'odds_change';
  message: string;
  matchTitle: string;
  timestamp: number;
}

interface UseSportsDataReturn {
  matches: Match[];
  loading: boolean;
  error: string | null;
  lobbyView: 'fixtures' | 'standings';
  setLobbyView: (view: 'fixtures' | 'standings') => void;
  activeAnalysisMatch: Match | null;
  setActiveAnalysisMatch: (match: Match | null) => void;
  matchStats: MatchStatistics | null;
  statsLoading: boolean;
  standings: StandingTeam[];
  standingsLoading: boolean;
  refreshFixtures: () => Promise<void>;
  teamStats: { home: TeamStatistics | null; away: TeamStatistics | null };
  teamStatsLoading: boolean;
  
  // Real-time Sports Center Features
  oddsChanges: Record<string, { homeWin: 'up' | 'down' | null; awayWin: 'up' | 'down' | null; draw: 'up' | 'down' | null }>;
  timelineEvents: LiveEvent[];
  notifications: LiveNotification[];
  dismissNotification: (id: string) => void;
  optimisticTriggerEvent: (matchId: string, eventType: 'goal' | 'red_card' | 'corner' | 'shot_on_target', side: 'home' | 'away') => Promise<void>;
}

export function useSportsData(pollIntervalMs = 12000): UseSportsDataReturn {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [lobbyView, setLobbyView] = useState<'fixtures' | 'standings'>('fixtures');
  const [activeAnalysisMatch, setActiveAnalysisMatch] = useState<Match | null>(null);
  
  const [matchStats, setMatchStats] = useState<MatchStatistics | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  
  const [standings, setStandings] = useState<StandingTeam[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(false);

  const [teamStats, setTeamStats] = useState<{ home: TeamStatistics | null; away: TeamStatistics | null }>({
    home: null,
    away: null,
  });
  const [teamStatsLoading, setTeamStatsLoading] = useState(false);

  // Real-time live sports center states
  const [oddsChanges, setOddsChanges] = useState<Record<string, { homeWin: 'up' | 'down' | null; awayWin: 'up' | 'down' | null; draw: 'up' | 'down' | null }>>({});
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<LiveEvent[]>([]);

  // Refs for tracking previous state to identify incremental updates
  const previousMatchOddsRef = useRef<Record<string, { homeWin: number; awayWin: number; draw: number }>>({});
  const previousMatchScoresRef = useRef<Record<string, { home: number; away: number; minute: number }>>({});
  const previousStatsRef = useRef<Record<string, { corners: number; redCards: number }>>({});
  const activeMatchRef = useRef<Match | null>(null);
  const timelineCacheRef = useRef<Record<string, LiveEvent[]>>({});

  useEffect(() => {
    activeMatchRef.current = activeAnalysisMatch;
  }, [activeAnalysisMatch]);

  /**
   * Helper to append live notification alerts
   */
  const addNotification = useCallback((type: 'goal' | 'red_card' | 'corner' | 'odds_change', message: string, matchTitle: string) => {
    const fresh: LiveNotification = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      message,
      matchTitle,
      timestamp: Date.now()
    };
    setNotifications(prev => [fresh, ...prev].slice(0, 5)); // Keep latest 5 notification banners

    // Auto-dismiss standard toasts after 7 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== fresh.id));
    }, 7000);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  /**
   * Generates interactive realistic timeline events based on current score & match stats
   */
  const generateBaselineTimeline = useCallback((match: Match, stats: MatchStatistics | null): LiveEvent[] => {
    const list: LiveEvent[] = [];
    const home = match.homeTeam;
    const away = match.awayTeam;
    const limit = match.status === 'completed' ? 90 : Math.max(1, match.minute ?? 45);

    // Baseline kickoff kick-starts
    list.push({
      id: `${match.id}_kickoff`,
      minute: 1,
      type: 'kickoff',
      team: null,
      detail: `📍 Kickoff! Match underway inside high-spec Arena Hub.`
    });

    // Goals distributed deterministically based on match values
    const scoreSum = match.score.home + match.score.away;
    let homeDrawn = 0;
    let awayDrawn = 0;

    for (let i = 0; i < scoreSum; i++) {
      const charSeed = match.id.charCodeAt(i % match.id.length) + i;
      const min = Math.max(5, Math.min(limit - 2, 12 + (charSeed % 72)));

      if (homeDrawn < match.score.home && (awayDrawn >= match.score.away || charSeed % 2 === 0)) {
        homeDrawn++;
        list.push({
          id: `${match.id}_goal_baseline_h_${i}`,
          minute: min,
          type: 'goal',
          team: 'home',
          detail: `⚽ GOAL! Exceptional link-up maneuver allows ${home} to score! (${homeDrawn} - ${awayDrawn})`
        });
      } else {
        awayDrawn++;
        list.push({
          id: `${match.id}_goal_baseline_a_${i}`,
          minute: min,
          type: 'goal',
          team: 'away',
          detail: `⚽ GOAL! Magnificent targeted shot from ${away} hits top corner! (${homeDrawn} - ${awayDrawn})`
        });
      }
    }

    if (stats) {
      // Hydrate some corners
      const totalCorners = stats.corners.home + stats.corners.away;
      for (let i = 0; i < totalCorners; i++) {
        const charSeed = match.id.charCodeAt(i % match.id.length) + i * 7;
        const min = Math.max(4, Math.min(limit, 8 + (charSeed % 80)));
        const isHome = i % 2 === 0;
        
        list.push({
          id: `${match.id}_corner_baseline_${i}`,
          minute: min,
          type: 'corner',
          team: isHome ? 'home' : 'away',
          detail: `⛳ Corner Kick awarded for ${isHome ? home : away} after defensive blocking.`
        });
      }

      // Hydrate Red Cards
      for (let i = 0; i < stats.redCards.home; i++) {
        const min = Math.max(25, Math.min(limit, 42 + i * 15));
        list.push({
          id: `${match.id}_red_baseline_h_${i}`,
          minute: min,
          type: 'red_card',
          team: 'home',
          detail: `🔴 RED CARD! Professional foul by ${home} player earns direct eviction.`
        });
      }
      for (let i = 0; i < stats.redCards.away; i++) {
        const min = Math.max(25, Math.min(limit, 44 + i * 15));
        list.push({
          id: `${match.id}_red_baseline_a_${i}`,
          minute: min,
          type: 'red_card',
          team: 'away',
          detail: `🔴 RED CARD! Harsh sliding tackle yields dismissal for ${away} defender.`
        });
      }
    }

    if (match.status === 'completed') {
      list.push({
        id: `${match.id}_fulltime`,
        minute: 90,
        type: 'full_time',
        team: null,
        detail: `🏁 Full-Time Whistle! Final score settled: ${home} ${match.score.home} - ${match.score.away} ${away}.`
      });
    }

    // Sort by minute descending so newest displays at top
    return list.sort((a, b) => b.minute - a.minute);
  }, []);

  /**
   * Refreshes matches and live odds.
   */
  const refreshFixtures = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
    }
    try {
      const data = await sportsApiService.getFixtures(true);
      setMatches(data);
      setError(null);

      // Track Incremental Odds Changes & Trigger Notification
      const prevOdds = previousMatchOddsRef.current;
      const computedOddsChanges: typeof oddsChanges = {};

      data.forEach((m) => {
        const prev = prevOdds[m.id];
        if (prev) {
          computedOddsChanges[m.id] = {
            homeWin: m.odds.homeWin > prev.homeWin ? 'up' : m.odds.homeWin < prev.homeWin ? 'down' : null,
            awayWin: m.odds.awayWin > prev.awayWin ? 'up' : m.odds.awayWin < prev.awayWin ? 'down' : null,
            draw: m.odds.draw > prev.draw ? 'up' : m.odds.draw < prev.draw ? 'down' : null,
          };
          
          if (m.odds.homeWin !== prev.homeWin && activeMatchRef.current?.id === m.id) {
            console.log(`[ODDS DRIFT] Selected Match Odds Updated: homeWin ${prev.homeWin} -> ${m.odds.homeWin}`);
          }
        } else {
          computedOddsChanges[m.id] = { homeWin: null, awayWin: null, draw: null };
        }
        prevOdds[m.id] = {
          homeWin: m.odds.homeWin,
          awayWin: m.odds.awayWin,
          draw: m.odds.draw,
        };
      });
      setOddsChanges(computedOddsChanges);
      previousMatchOddsRef.current = prevOdds;

      // Track incremental Scores / Minutes changes to fire toasts
      const prevScores = previousMatchScoresRef.current;
      data.forEach((m) => {
        const prev = prevScores[m.id];
        if (prev && m.status === 'live') {
          const matchTitle = `${m.homeTeam} vs ${m.awayTeam}`;
          
          // Home goal
          if (m.score.home > prev.home) {
            addNotification('goal', `⚽ GOAL! ${m.homeTeam} scores! (${m.score.home} - ${m.score.away})`, matchTitle);
            
            // Inject directly into active timeline
            if (activeMatchRef.current?.id === m.id) {
              setTimelineEvents(prevTimeline => [
                {
                  id: `live_g_h_${Date.now()}`,
                  minute: m.minute || 45,
                  type: 'goal',
                  team: 'home',
                  detail: `⚽ Live GOAL! ${m.homeTeam} converts a magnificent shot! Current score: ${m.score.home} - ${m.score.away}`
                },
                ...prevTimeline
              ]);
            }
          }
          
          // Away goal
          if (m.score.away > prev.away) {
            addNotification('goal', `⚽ GOAL! ${m.awayTeam} scores! (${m.score.home} - ${m.score.away})`, matchTitle);
            
            if (activeMatchRef.current?.id === m.id) {
              setTimelineEvents(prevTimeline => [
                {
                  id: `live_g_a_${Date.now()}`,
                  minute: m.minute || 45,
                  type: 'goal',
                  team: 'away',
                  detail: `⚽ Live GOAL! ${m.awayTeam} clinches it! Current score: ${m.score.home} - ${m.score.away}`
                },
                ...prevTimeline
              ]);
            }
          }
        }
        // Save current for next comparison
        prevScores[m.id] = {
          home: m.score.home,
          away: m.score.away,
          minute: m.minute || 0
        };
      });
      previousMatchScoresRef.current = prevScores;

      // Select first active match as default analysis match if none is set
      if (!activeMatchRef.current && data.length > 0) {
        setActiveAnalysisMatch(data[0]);
      }
    } catch (err: any) {
      console.warn('Silent/Normal matches sync warning:', err);
      if (matches.length === 0) {
        setError('Failed to fetch sports fixtures. Using offline cached data.');
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, [matches.length, addNotification]);

  /**
   * Manual trigger / live polling loop for auto-refresh
   */
  useEffect(() => {
    refreshFixtures(false);

    const interval = setInterval(() => {
      console.log('[POLLING ENGINE] Auto-refreshing live match scores and odds...');
      refreshFixtures(true);
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [refreshFixtures, pollIntervalMs]);

  /**
   * Fetches the head-to-head match stats and overlays live events
   */
  useEffect(() => {
    if (!activeAnalysisMatch) {
      setMatchStats(null);
      setTimelineEvents([]);
      return;
    }

    let isSubscribed = true;
    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        const stats = await sportsApiService.getMatchStatistics(activeAnalysisMatch.id);
        if (isSubscribed) {
          setMatchStats(stats);
          
          // Generate or fetch timeline cache
          if (!timelineCacheRef.current[activeAnalysisMatch.id]) {
            const baseline = generateBaselineTimeline(activeAnalysisMatch, stats);
            timelineCacheRef.current[activeAnalysisMatch.id] = baseline;
          }
          setTimelineEvents(timelineCacheRef.current[activeAnalysisMatch.id]);

          // Compare statistics changes for active selection
          const prevStatsMap = previousStatsRef.current;
          const prev = prevStatsMap[activeAnalysisMatch.id];
          if (prev) {
            const matchTitle = `${activeAnalysisMatch.homeTeam} vs ${activeAnalysisMatch.awayTeam}`;
            
            // Check Red cards
            const currentTotalRed = stats.redCards.home + stats.redCards.away;
            const prevTotalRed = prev.redCards;
            if (currentTotalRed > prevTotalRed) {
              const teamName = stats.redCards.home > (prevStatsMap[activeAnalysisMatch.id]?.redCards || 0) ? activeAnalysisMatch.homeTeam : activeAnalysisMatch.awayTeam;
              const side = stats.redCards.home > (prevStatsMap[activeAnalysisMatch.id]?.redCards || 0) ? 'home' : 'away';
              
              addNotification('red_card', `🔴 RED CARD! Sent off for ${teamName}!`, matchTitle);
              
              setTimelineEvents(prevTimeline => [
                {
                  id: `live_red_${Date.now()}`,
                  minute: activeAnalysisMatch.minute || 45,
                  type: 'red_card',
                  team: side,
                  detail: `🔴 Red Dismissal! Player of ${teamName} received orders to leave the field!`
                },
                ...prevTimeline
              ]);
            }

            // Check Corners
            const currentTotalCorners = stats.corners.home + stats.corners.away;
            const prevTotalCorners = prev.corners;
            if (currentTotalCorners > prevTotalCorners) {
              const side = stats.corners.home > (prevStatsMap[activeAnalysisMatch.id]?.corners || 0) ? 'home' : 'away';
              const teamName = side === 'home' ? activeAnalysisMatch.homeTeam : activeAnalysisMatch.awayTeam;
              
              addNotification('corner', `⛳ Corner kick to ${teamName}`, matchTitle);
              
              setTimelineEvents(prevTimeline => [
                {
                  id: `live_corner_${Date.now()}`,
                  minute: activeAnalysisMatch.minute || 45,
                  type: 'corner',
                  team: side,
                  detail: `⛳ Corner kick awarded. ${teamName} launches a quick offensive swing.`
                },
                ...prevTimeline
              ]);
            }
          }

          // Store for next loop comparison
          prevStatsMap[activeAnalysisMatch.id] = {
            corners: stats.corners.home + stats.corners.away,
            redCards: stats.redCards.home + stats.redCards.away
          };
          previousStatsRef.current = prevStatsMap;
        }
      } catch (err) {
        console.warn('Could not fetch realtime statistics for fixture:', activeAnalysisMatch.id);
        if (isSubscribed) {
          setMatchStats(null);
          // Set simple timeline baseline without stats
          if (!timelineCacheRef.current[activeAnalysisMatch.id]) {
            timelineCacheRef.current[activeAnalysisMatch.id] = generateBaselineTimeline(activeAnalysisMatch, null);
          }
          setTimelineEvents(timelineCacheRef.current[activeAnalysisMatch.id]);
        }
      } finally {
        if (isSubscribed) {
          setStatsLoading(false);
        }
      }
    };

    fetchStats();
    return () => {
      isSubscribed = false;
    };
  }, [activeAnalysisMatch?.id, generateBaselineTimeline, addNotification]);

  /**
   * Fetch specific Season Diagnostics stats (teamStats) for both home and away teams on the active analysis match
   */
  useEffect(() => {
    if (!activeAnalysisMatch) {
      setTeamStats({ home: null, away: null });
      return;
    }

    let isSubscribed = true;
    const fetchTeamPerformance = async () => {
      setTeamStatsLoading(true);
      try {
        const [home, away] = await Promise.all([
          sportsApiService.getTeamStatistics(activeAnalysisMatch.homeTeam, activeAnalysisMatch.sport),
          sportsApiService.getTeamStatistics(activeAnalysisMatch.awayTeam, activeAnalysisMatch.sport),
        ]);
        if (isSubscribed) {
          setTeamStats({ home, away });
        }
      } catch (err) {
        console.warn('Could not fetch seasonal performance diagnostics for teams:', err);
      } finally {
        if (isSubscribed) {
          setTeamStatsLoading(false);
        }
      }
    };

    fetchTeamPerformance();
    return () => {
      isSubscribed = false;
    };
  }, [activeAnalysisMatch?.id, activeAnalysisMatch?.homeTeam, activeAnalysisMatch?.awayTeam, activeAnalysisMatch?.sport]);

  /**
   * Fetches league standings when tab is opened
   */
  useEffect(() => {
    if (lobbyView !== 'standings') return;

    let isSubscribed = true;
    const fetchStandingsData = async () => {
      setStandingsLoading(true);
      try {
        const data = await sportsApiService.getStandings();
        if (isSubscribed) {
          setStandings(data);
        }
      } catch (err) {
        console.warn('Could not pull standings feed:', err);
      } finally {
        if (isSubscribed) {
          setStandingsLoading(false);
        }
      }
    };

    fetchStandingsData();
    return () => {
      isSubscribed = false;
    };
  }, [lobbyView]);

  /**
   * ADVANCED REAL-TIME ENGAGEMENT ACTION:
   * Triggers an optimistic live event and saves it in the backend node cache
   * so it is permanently updated across subsequent polling cycles!
   */
  const optimisticTriggerEvent = useCallback(async (matchId: string, eventType: 'goal' | 'red_card' | 'corner' | 'shot_on_target', side: 'home' | 'away') => {
    // 1. Instantly update matches state locally on the client (Optimistic state update)
    setMatches((prevMatches) => {
      return prevMatches.map((m) => {
        if (m.id !== matchId) return m;

        const updatedOdds = { ...m.odds };
        const updatedScore = { ...m.score };
        const activeMinute = m.minute || 1;

        if (eventType === 'goal') {
          updatedScore[side] += 1;
          
          // Instantly shift odds on goal optimistically!
          const diff = updatedScore.home - updatedScore.away;
          if (diff > 0) {
            updatedOdds.homeWin = Math.max(1.05, Number((updatedOdds.homeWin * 0.75).toFixed(2)));
            updatedOdds.awayWin = Math.min(30.00, Number((updatedOdds.awayWin * 1.6).toFixed(2)));
          } else if (diff < 0) {
            updatedOdds.homeWin = Math.min(30.00, Number((updatedOdds.homeWin * 1.6).toFixed(2)));
            updatedOdds.awayWin = Math.max(1.05, Number((updatedOdds.awayWin * 0.75).toFixed(2)));
          } else {
            updatedOdds.homeWin = Number((updatedOdds.homeWin * 1.05).toFixed(2));
            updatedOdds.awayWin = Number((updatedOdds.awayWin * 1.05).toFixed(2));
          }
        }

        return {
          ...m,
          score: updatedScore,
          odds: updatedOdds,
          minute: activeMinute,
          status: 'live' // force live scoreboard
        };
      });
    });

    // 2. Also update matchStats immediately for reactive view updates
    setMatchStats((prevStats) => {
      if (!prevStats) return null;
      const stats = { ...prevStats };
      
      if (eventType === 'corner') {
        stats.corners[side] += 1;
      } else if (eventType === 'red_card') {
        stats.redCards[side] += 1;
      } else if (eventType === 'shot_on_target') {
        stats.shotsOnGoal[side] += 1;
      }

      // Slightly perturb possession
      if (eventType === 'goal' || eventType === 'shot_on_target') {
        stats.possession.home = side === 'home' ? Math.min(70, stats.possession.home + 3) : Math.max(30, stats.possession.home - 3);
        stats.possession.away = 100 - stats.possession.home;
      }

      return stats;
    });

    // 3. Manually push to the current selected active timeline immediately
    const teamName = side === 'home' ? activeMatchRef.current?.homeTeam || 'Home' : activeMatchRef.current?.awayTeam || 'Away';
    let detailMessage = '';
    const min = activeMatchRef.current?.minute || 45;

    if (eventType === 'goal') {
      detailMessage = `⚽ GOAL! Manual strategic injection triggers massive goal for ${teamName}! Score: ${
        side === 'home'
          ? (activeMatchRef.current?.score.home || 0) + 1
          : activeMatchRef.current?.score.home || 0
      } - ${
        side === 'away'
          ? (activeMatchRef.current?.score.away || 0) + 1
          : activeMatchRef.current?.score.away || 0
      }`;
    } else if (eventType === 'red_card') {
      detailMessage = `🔴 RED CARD! Ref brands direct card showing early dismissal for ${teamName}!`;
    } else if (eventType === 'corner') {
      detailMessage = `⛳ CORNER KICK! Swift corner executed inside the left ring by ${teamName}.`;
    } else if (eventType === 'shot_on_target') {
      detailMessage = `🎯 SHOT ON TARGET! Strong drive on goals by ${teamName} forces brilliant save!`;
    }

    const liveId = `trigger_${Date.now()}`;
    const liveNewEvent: LiveEvent = {
      id: liveId,
      minute: min,
      type: eventType === 'shot_on_target' ? 'shot_on_target' : (eventType === 'red_card' ? 'red_card' : (eventType === 'corner' ? 'corner' : 'goal')),
      team: side,
      detail: detailMessage
    };

    setTimelineEvents(prev => [liveNewEvent, ...prev]);
    
    // Save generated timeline in reference cache
    if (activeMatchRef.current) {
      const matchId = activeMatchRef.current.id;
      if (!timelineCacheRef.current[matchId]) {
        timelineCacheRef.current[matchId] = [];
      }
      timelineCacheRef.current[matchId] = [liveNewEvent, ...timelineCacheRef.current[matchId]];
    }

    // 4. Fire dynamic on-screen alerts banner
    const alertTitle = activeMatchRef.current ? `${activeMatchRef.current.homeTeam} vs ${activeMatchRef.current.awayTeam}` : 'Real-time Event';
    if (eventType === 'goal') {
      addNotification('goal', `🚀 INJECTED GOAL! ${teamName} scores!`, alertTitle);
    } else if (eventType === 'red_card') {
      addNotification('red_card', `🔴 SENT OFF! ${teamName} down to 10 men!`, alertTitle);
    } else {
      addNotification('corner', `📢 ACTION: ${eventType.replace('_', ' ').toUpperCase()} for ${teamName}!`, alertTitle);
    }

    // 5. POST to the server simulation router to persist in Express Cache so regular polls retain it
    try {
      const response = await fetch('/api/football/simulate-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, eventType, side })
      });
      if (response.ok) {
        console.log(`[ACTION WRITER] Server-simulated cache written successfully: ${matchId}`);
      }
    } catch (err) {
      console.warn('[ACTION WRITER] Silent POST exception:', err);
    }
  }, [addNotification]);

  return {
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
    refreshFixtures,
    teamStats,
    teamStatsLoading,
    
    // Live Sports Center outputs
    oddsChanges,
    timelineEvents,
    notifications,
    dismissNotification,
    optimisticTriggerEvent
  };
}
