/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// IN-MEMORY HIGH FIDELITY SIMULATION CACHE
// Utilized when API keys are not yet configured in env
interface SimulatedMatch {
  id: string;
  sport: 'football' | 'basketball' | 'tennis' | 'esports';
  homeTeam: string;
  awayTeam: string;
  score: { home: number; away: number };
  status: 'upcoming' | 'live' | 'completed';
  minute: number;
  commencesAt: string;
  odds: { homeWin: number; awayWin: number; draw: number };
  stats: {
    possession: { home: number; away: number };
    shotsOnGoal: { home: number; away: number };
    shotsOffGoal: { home: number; away: number };
    fouls: { home: number; away: number };
    corners: { home: number; away: number };
    yellowCards: { home: number; away: number };
    redCards: { home: number; away: number };
  };
}

let simulatedMatches: SimulatedMatch[] = [
  {
    id: 'api_sim_match_1',
    sport: 'football',
    homeTeam: 'Arsenal FC',
    awayTeam: 'Manchester City',
    score: { home: 1, away: 1 },
    status: 'live',
    minute: 54,
    commencesAt: new Date(Date.now() - 54 * 60 * 1000).toISOString(),
    odds: { homeWin: 2.10, awayWin: 2.45, draw: 3.20 },
    stats: {
      possession: { home: 48, away: 52 },
      shotsOnGoal: { home: 4, away: 5 },
      shotsOffGoal: { home: 3, away: 2 },
      fouls: { home: 8, away: 6 },
      corners: { home: 3, away: 4 },
      yellowCards: { home: 1, away: 2 },
      redCards: { home: 0, away: 0 }
    }
  },
  {
    id: 'api_sim_match_2',
    sport: 'football',
    homeTeam: 'Real Madrid',
    awayTeam: 'FC Barcelona',
    score: { home: 0, away: 0 },
    status: 'upcoming',
    minute: 0,
    commencesAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    odds: { homeWin: 1.90, awayWin: 2.80, draw: 3.50 },
    stats: {
      possession: { home: 0, away: 0 },
      shotsOnGoal: { home: 0, away: 0 },
      shotsOffGoal: { home: 0, away: 0 },
      fouls: { home: 0, away: 0 },
      corners: { home: 0, away: 0 },
      yellowCards: { home: 0, away: 0 },
      redCards: { home: 0, away: 0 }
    }
  },
  {
    id: 'api_sim_match_3',
    sport: 'basketball',
    homeTeam: 'LA Lakers',
    awayTeam: 'Boston Celtics',
    score: { home: 86, away: 82 },
    status: 'live',
    minute: 34,
    commencesAt: new Date(Date.now() - 34 * 60 * 1000).toISOString(),
    odds: { homeWin: 1.55, awayWin: 2.45, draw: 15.00 },
    stats: {
      possession: { home: 50, away: 50 },
      shotsOnGoal: { home: 34, away: 32 }, // Shots Completed
      shotsOffGoal: { home: 18, away: 20 }, // Shots Missed
      fouls: { home: 12, away: 14 },
      corners: { home: 0, away: 0 },
      yellowCards: { home: 0, away: 0 },
      redCards: { home: 0, away: 0 }
    }
  },
  {
    id: 'api_sim_match_4',
    sport: 'tennis',
    homeTeam: 'Carlos Alcaraz',
    awayTeam: 'Jannik Sinner',
    score: { home: 1, away: 1 }, // Set Score
    status: 'live',
    minute: 95,
    commencesAt: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
    odds: { homeWin: 1.80, awayWin: 1.95, draw: 35.00 },
    stats: {
      possession: { home: 52, away: 48 },
      shotsOnGoal: { home: 10, away: 8 }, // Aces
      shotsOffGoal: { home: 3, away: 4 }, // Double Faults
      fouls: { home: 0, away: 0 },
      corners: { home: 0, away: 0 },
      yellowCards: { home: 0, away: 0 },
      redCards: { home: 0, away: 0 }
    }
  },
  {
    id: 'api_sim_match_5',
    sport: 'esports',
    homeTeam: 'T1 esports',
    awayTeam: 'G2 Gaming',
    score: { home: 2, away: 1 }, // Map score
    status: 'live',
    minute: 31,
    commencesAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
    odds: { homeWin: 1.30, awayWin: 3.40, draw: 12.00 },
    stats: {
      possession: { home: 60, away: 40 }, // objective control
      shotsOnGoal: { home: 18, away: 12 }, // kill score
      shotsOffGoal: { home: 12, away: 18 }, // death score
      fouls: { home: 0, away: 0 },
      corners: { home: 4, away: 2 }, // buildings destroyed
      yellowCards: { home: 0, away: 0 },
      redCards: { home: 0, away: 0 }
    }
  },
  {
    id: 'api_sim_match_6',
    sport: 'football',
    homeTeam: 'Bay Munich',
    awayTeam: 'Borussia Dortmund',
    score: { home: 3, away: 0 },
    status: 'completed',
    minute: 90,
    commencesAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    odds: { homeWin: 1.45, awayWin: 4.50, draw: 3.80 },
    stats: {
      possession: { home: 62, away: 38 },
      shotsOnGoal: { home: 9, away: 2 },
      shotsOffGoal: { home: 4, away: 5 },
      fouls: { home: 7, away: 9 },
      corners: { home: 6, away: 3 },
      yellowCards: { home: 1, away: 1 },
      redCards: { home: 0, away: 1 }
    }
  }
];

// PREMIER LEAGUE STANDINGS CACHE SIMULATION
const SIMULATED_STANDINGS = [
  { rank: 1, team: 'Manchester City', played: 38, win: 28, draw: 7, loss: 3, points: 91, goalsFor: 96, goalsAgainst: 34 },
  { rank: 2, team: 'Arsenal FC', played: 38, win: 28, draw: 5, loss: 5, points: 89, goalsFor: 91, goalsAgainst: 29 },
  { rank: 3, team: 'Liverpool FC', played: 38, win: 24, draw: 10, loss: 4, points: 82, goalsFor: 86, goalsAgainst: 41 },
  { rank: 11, team: 'Bay Munich', played: 34, win: 23, draw: 3, loss: 8, points: 72, goalsFor: 94, goalsAgainst: 45 },
  { rank: 4, team: 'Aston Villa', played: 38, win: 20, draw: 8, loss: 10, points: 68, goalsFor: 76, goalsAgainst: 61 },
  { rank: 5, team: 'Tottenham Hotspur', played: 38, win: 20, draw: 6, loss: 12, points: 66, goalsFor: 74, goalsAgainst: 61 },
  { rank: 6, team: 'Chelsea FC', played: 38, win: 18, draw: 9, loss: 11, points: 63, goalsFor: 77, goalsAgainst: 63 },
  { rank: 7, team: 'Newcastle United', played: 38, win: 18, draw: 6, loss: 14, points: 60, goalsFor: 85, goalsAgainst: 62 },
  { rank: 8, team: 'Manchester United', played: 38, win: 18, draw: 6, loss: 14, points: 60, goalsFor: 57, goalsAgainst: 58 }
];

// SERVER-SIDE IN-MEMORY CACHE DICTIONARY & INTERFACES (To protect API keys and reduce server load)
interface ServerCacheEntry<T> {
  data: T;
  timestamp: number;
}
const serverCacheStorage: Record<string, ServerCacheEntry<any>> = {};
const BACKEND_CACHE_TTL = 120000; // 2 minutes server-side cache TTL to reduce API usage

function getFromBackendCache<T>(key: string): T | null {
  const entry = serverCacheStorage[key];
  if (entry && Date.now() - entry.timestamp < BACKEND_CACHE_TTL) {
    return entry.data as T;
  }
  return null;
}

function setToBackendCache<T>(key: string, data: T): void {
  serverCacheStorage[key] = {
    data,
    timestamp: Date.now()
  };
}

// PERIODIC MATCH SIMULATOR GAME LOOP
// Runs background ticks to mimic live games, scoring goals, ticking minutes for multiple sports
setInterval(() => {
  simulatedMatches = simulatedMatches.map(match => {
    if (match.status === 'upcoming') {
      const commencesTime = new Date(match.commencesAt).getTime();
      if (Date.now() >= commencesTime || Math.random() < 0.05) {
        return {
          ...match,
          status: 'live',
          minute: 1,
          commencesAt: new Date().toISOString()
        };
      }
      return match;
    }

    if (match.status === 'live') {
      const nextMinute = match.minute + 1;
      
      // Different end criteria based on sport
      const isEnded = 
        (match.sport === 'football' && nextMinute > 90) ||
        (match.sport === 'basketball' && nextMinute > 48) ||
        (match.sport === 'tennis' && match.score.home >= 3 || match.score.away >= 3) ||
        (match.sport === 'esports' && match.score.home >= 3 || match.score.away >= 3);

      if (isEnded) {
        return {
          ...match,
          status: 'completed',
          minute: match.sport === 'football' ? 90 : match.sport === 'basketball' ? 48 : match.minute
        };
      }

      let homeScore = match.score.home;
      let awayScore = match.score.away;
      let scoreEvent = false;

      // Sport specific score generation
      if (match.sport === 'football') {
        if (Math.random() < 0.035) {
          homeScore += 1;
          scoreEvent = true;
        } else if (Math.random() < 0.035) {
          awayScore += 1;
          scoreEvent = true;
        }
      } else if (match.sport === 'basketball') {
        if (Math.random() < 0.35) {
          const pts = Math.random() < 0.7 ? 2 : 3;
          homeScore += pts;
          scoreEvent = true;
        } else if (Math.random() < 0.35) {
          const pts = Math.random() < 0.7 ? 2 : 3;
          awayScore += pts;
          scoreEvent = true;
        }
      } else if (match.sport === 'tennis') {
        // Sets tracker (stochastic sets bump)
        if (Math.random() < 0.02) {
          if (Math.random() < 0.5) homeScore += 1;
          else awayScore += 1;
          scoreEvent = true;
        }
      } else if (match.sport === 'esports') {
        // Maps tracker
        if (Math.random() < 0.03) {
          if (Math.random() < 0.5) homeScore += 1;
          else awayScore += 1;
          scoreEvent = true;
        }
      }

      // Update statistics live metrics
      const stats = { ...match.stats };
      if (Math.random() < 0.4) {
        const side = Math.random() < 0.5 ? 'home' : 'away';
        if (match.sport === 'football') {
          stats.possession = {
            home: side === 'home' ? Math.min(75, stats.possession.home + 2) : Math.max(25, stats.possession.home - 2),
            away: side === 'home' ? Math.max(25, stats.possession.away - 2) : Math.min(75, stats.possession.away + 2)
          };
          if (Math.random() < 0.4) stats.shotsOnGoal[side] += 1;
          if (Math.random() < 0.4) stats.shotsOffGoal[side] += 1;
          if (Math.random() < 0.3) stats.fouls[side] += 1;
          if (Math.random() < 0.2) stats.corners[side] += 1;
          if (Math.random() < 0.06) stats.yellowCards[side] += 1;
        } else if (match.sport === 'basketball') {
          stats.possession = { home: 50, away: 50 }; // basket ball back and forth
          if (Math.random() < 0.7) stats.shotsOnGoal[side] += 1; // Completed throws
          if (Math.random() < 0.5) stats.shotsOffGoal[side] += 1; // Misses
          if (Math.random() < 0.3) stats.fouls[side] += 1;
        } else if (match.sport === 'tennis') {
          if (Math.random() < 0.2) stats.shotsOnGoal[side] += 1; // Aces
          if (Math.random() < 0.1) stats.shotsOffGoal[side] += 1; // Double faults
        } else if (match.sport === 'esports') {
          if (Math.random() < 0.5) stats.shotsOnGoal[side] += 1; // Kill count
          if (Math.random() < 0.5) stats.shotsOffGoal[side] += 1; // Death count
          if (Math.random() < 0.3) stats.corners[side] += 1; // Towers destroyed
        }
      }

      // Live dynamics adjusting betting odds
      let odds = { ...match.odds };
      if (scoreEvent || nextMinute % 6 === 0) {
        const scoreDiff = homeScore - awayScore;
        const coef = match.sport === 'basketball' ? 0.02 : 0.25;
        
        if (scoreDiff > 0) {
          odds.homeWin = Math.max(1.02, 1.4 - (scoreDiff * coef));
          odds.awayWin = Math.min(45, 2.1 + (scoreDiff * coef * 2));
          odds.draw = match.sport === 'football' ? Math.max(1.5, 2.2 + (scoreDiff * 0.4)) : 15.00;
        } else if (scoreDiff < 0) {
          odds.homeWin = Math.min(45, 2.1 + (Math.abs(scoreDiff) * coef * 2));
          odds.awayWin = Math.max(1.02, 1.4 - (Math.abs(scoreDiff) * coef));
          odds.draw = match.sport === 'football' ? Math.max(1.5, 2.2 + (Math.abs(scoreDiff) * 0.4)) : 15.00;
        } else {
          odds.homeWin = Math.max(1.4, 1.8 + (nextMinute * 0.005));
          odds.awayWin = Math.max(1.4, 1.9 + (nextMinute * 0.005));
          odds.draw = match.sport === 'football' ? Math.max(1.15, 3.1 - (nextMinute * 0.015)) : 15.00;
        }

        odds.homeWin = Number(odds.homeWin.toFixed(2));
        odds.awayWin = Number(odds.awayWin.toFixed(2));
        odds.draw = Number(odds.draw.toFixed(2));
      }

      return {
        ...match,
        minute: nextMinute,
        score: { home: homeScore, away: awayScore },
        odds,
        stats
      };
    }

    if (match.status === 'completed' && Math.random() < 0.02) {
      // Warm reset for simulations
      const matchesPool: [string, string, 'football' | 'basketball' | 'tennis' | 'esports'][] = [
        ['Manchester United', 'Liverpool FC', 'football'],
        ['Phoenix Suns', 'Denver Nuggets', 'basketball'],
        ['Alexander Zverev', 'Daniil Medvedev', 'tennis'],
        ['Faker esports', 'Gen.G Gaming', 'esports'],
        ['Manchester City', 'Bayern Munich', 'football']
      ];
      const entry = matchesPool[Math.floor(Math.random() * matchesPool.length)];
      return {
        id: match.id,
        sport: entry[2],
        homeTeam: entry[0],
        awayTeam: entry[1],
        score: { home: 0, away: 0 },
        status: 'upcoming',
        minute: 0,
        commencesAt: new Date(Date.now() + 12 * 60 * 1000).toISOString(),
        odds: { homeWin: 1.85, awayWin: 2.15, draw: entry[2] === 'football' ? 3.30 : 18.00 },
        stats: {
          possession: { home: 50, away: 50 },
          shotsOnGoal: { home: 0, away: 0 },
          shotsOffGoal: { home: 0, away: 0 },
          fouls: { home: 0, away: 0 },
          corners: { home: 0, away: 0 },
          yellowCards: { home: 0, away: 0 },
          redCards: { home: 0, away: 0 }
        }
      };
    }

    return match;
  });
}, 10000); // 10s simulation tick

// API ENDPOINTS

// 1. HEALTHCHECK
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    apiKeysAvailable: {
      apiFootball: !!(process.env.API_FOOTBALL_KEY || process.env.RAPIDAPI_KEY),
      theOddsApi: !!process.env.THE_ODDS_API_KEY
    }
  });
});

// 2. LIVE FIXTURES proxy with seamless multi-sport caching
app.get('/api/football/fixtures', async (req, res) => {
  const cacheKey = 'football_fixtures';
  const cachedData = getFromBackendCache<any[]>(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  const footballKey = process.env.API_FOOTBALL_KEY || process.env.RAPIDAPI_KEY;
  let finalMatches: any[] = [];

  // Use raw simulated multi-sports as foundation
  const baseSims = simulatedMatches.map(m => ({
    id: m.id,
    sport: m.sport,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    commencesAt: m.commencesAt,
    status: m.status,
    odds: m.odds,
    score: m.score,
    minute: m.minute,
    result: m.status === 'completed'
      ? (m.score.home > m.score.away ? 'home_win' : m.score.home < m.score.away ? 'away_win' : 'draw')
      : 'pending'
  }));

  if (footballKey) {
    try {
      const headers: any = {
        'x-rapidapi-host': 'v3.football.api-sports.io',
      };
      if (process.env.RAPIDAPI_KEY) {
        headers['x-rapidapi-key'] = process.env.RAPIDAPI_KEY;
        headers['x-rapidapi-host'] = 'api-football-v1.p.rapidapi.com';
      } else {
        headers['x-apisports-key'] = footballKey;
      }

      // Fetch live fixtures from API-Football
      const url = process.env.RAPIDAPI_KEY
        ? 'https://api-football-v1.p.rapidapi.com/v3/fixtures?live=all'
        : 'https://v3.football.api-sports.io/fixtures?live=all';

      const response = await fetch(url, { headers });
      const data = await response.json();

      if (data && data.response && Array.isArray(data.response)) {
        const mappedLiveFootball = data.response.map((entry: any) => {
          const homeWin = 1.3 + Math.random();
          const awayWin = 1.5 + Math.random();
          const draw = 2.4 + Math.random();

          return {
            id: `apifb_${entry.fixture.id}`,
            sport: 'football',
            homeTeam: entry.teams.home.name,
            awayTeam: entry.teams.away.name,
            commencesAt: entry.fixture.date,
            status: entry.fixture.status.short === 'FT' ? 'completed' : ['1H', '2H', 'HT'].includes(entry.fixture.status.short) ? 'live' : 'upcoming',
            odds: {
              homeWin: Number(homeWin.toFixed(2)),
              awayWin: Number(awayWin.toFixed(2)),
              draw: Number(draw.toFixed(2))
            },
            score: {
              home: entry.goals.home ?? 0,
              away: entry.goals.away ?? 0
            },
            minute: entry.fixture.status.elapsed ?? 0,
            result: entry.fixture.status.short === 'FT'
              ? (entry.goals.home > entry.goals.away ? 'home_win' : entry.goals.home < entry.goals.away ? 'away_win' : 'draw')
              : 'pending'
          };
        });

        // Blend real live football fixtures with non-football simulated fixtures (basketball, tennis, esports)
        // This replaces mock football with real API data, while maintaining robust multi-sport availability!
        const nonFootballSims = baseSims.filter(m => m.sport !== 'football');
        finalMatches = [...mappedLiveFootball, ...nonFootballSims];
      }
    } catch (err) {
      console.error('API-Football failure. Gracefully serving simulation layer cache:', err);
    }
  }

  // Fallback to high fidelity simulated multi-sport if finalMatches is empty
  if (finalMatches.length === 0) {
    finalMatches = baseSims;
  }

  setToBackendCache(cacheKey, finalMatches);
  return res.json(finalMatches);
});

// MULTICAST OPTIMISTIC SIMULATED ACTIONS
app.post('/api/football/simulate-event', (req, res) => {
  const { matchId, eventType, side } = req.body;
  if (!matchId || !eventType || !side) {
    return res.status(400).json({ error: 'Missing parameters: matchId, eventType, side and required' });
  }

  // Find in memory simulated matches
  const match = simulatedMatches.find(m => m.id === matchId);
  if (match) {
    if (eventType === 'goal') {
      match.score[side] += 1;
      // Adjust odds procedurally immediately in server memory
      const diff = match.score.home - match.score.away;
      if (diff > 0) {
        match.odds.homeWin = Math.max(1.05, Number((match.odds.homeWin * 0.75).toFixed(2)));
        match.odds.awayWin = Math.min(30.00, Number((match.odds.awayWin * 1.6).toFixed(2)));
      } else if (diff < 0) {
        match.odds.homeWin = Math.min(30.00, Number((match.odds.homeWin * 1.6).toFixed(2)));
        match.odds.awayWin = Math.max(1.05, Number((match.odds.awayWin * 0.75).toFixed(2)));
      } else {
        match.odds.homeWin = Number((match.odds.homeWin * 1.05).toFixed(2));
        match.odds.awayWin = Number((match.odds.awayWin * 1.05).toFixed(2));
      }
    } else if (eventType === 'red_card') {
      match.stats.redCards[side] += 1;
    } else if (eventType === 'corner') {
      match.stats.corners[side] += 1;
    } else if (eventType === 'shot_on_target') {
      match.stats.shotsOnGoal[side] += 1;
    }

    // Mark as live if upcoming
    if (match.status === 'upcoming') {
      match.status = 'live';
      match.minute = 1;
    }

    // Invalidate main caches so polls read updated serverside memory states
    // Note: serverCacheStorage is declared around line 183 in server.ts
    // We can clear those entries as needed:
    for (const key of Object.keys(serverCacheStorage)) {
      if (key.includes('fixtures') || key.includes(matchId)) {
        delete serverCacheStorage[key];
      }
    }

    return res.json({ success: true, match });
  }

  return res.status(404).json({ error: 'Match template not found to simulate action' });
});

// 3. SECURE ODDS API Proxy with cache protect
app.get('/api/football/odds', async (req, res) => {
  const cacheKey = 'football_odds';
  const cachedOdds = getFromBackendCache<any[]>(cacheKey);
  if (cachedOdds) {
    return res.json(cachedOdds);
  }

  const oddsApiKey = process.env.THE_ODDS_API_KEY;
  let finalOdds: any[] = [];

  if (oddsApiKey) {
    try {
      // UEFA Champions League soccer odds
      const url = `https://api.the-odds-api.com/v4/sports/soccer_uefa_champs_league/odds/?apiKey=${oddsApiKey}&regions=eu&markets=h2h`;
      const response = await fetch(url);
      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        finalOdds = data.map((game: any) => {
          let homeWin = 1.95;
          let awayWin = 2.15;
          let draw = 3.20;

          const bookmaker = game.bookmakers?.[0];
          const market = bookmaker?.markets?.[0];
          if (market && Array.isArray(market.outcomes)) {
            const h = market.outcomes.find((o: any) => o.name === game.home_team);
            const a = market.outcomes.find((o: any) => o.away_team);
            const d = market.outcomes.find((o: any) => o.name.toLowerCase() === 'draw');

            if (h) homeWin = h.price;
            if (a) awayWin = a.price;
            if (d) draw = d.price;
          }

          return {
            id: `oddsapi_${game.id}`,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            commencesAt: game.commence_time,
            odds: { homeWin, awayWin, draw }
          };
        });
      }
    } catch (err) {
      console.error('Odds API fetch failure, using backup model:', err);
    }
  }

  if (finalOdds.length === 0) {
    // Generate odds based on active simulated matches
    finalOdds = simulatedMatches.map(m => ({
      id: m.id,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      commencesAt: m.commencesAt,
      odds: m.odds
    }));
  }

  setToBackendCache(cacheKey, finalOdds);
  return res.json(finalOdds);
});

// 4. LEAGUE STANDINGS proxy (API-Football) with robust caching
app.get('/api/football/standings', async (req, res) => {
  const cacheKey = 'football_standings';
  const cachedStandings = getFromBackendCache<any[]>(cacheKey);
  if (cachedStandings) {
    return res.json(cachedStandings);
  }

  const footballKey = process.env.API_FOOTBALL_KEY || process.env.RAPIDAPI_KEY;
  let finalStandings: any[] = [];

  if (footballKey) {
    try {
      const headers: any = {};
      if (process.env.RAPIDAPI_KEY) {
        headers['x-rapidapi-key'] = process.env.RAPIDAPI_KEY;
        headers['x-rapidapi-host'] = 'api-football-v1.p.rapidapi.com';
      } else {
        headers['x-apisports-key'] = footballKey;
      }

      // League 39 - Premier League, Season 2025
      const url = process.env.RAPIDAPI_KEY
        ? 'https://api-football-v1.p.rapidapi.com/v3/standings?league=39&season=2025'
        : 'https://v3.football.api-sports.io/standings?league=39&season=2025';

      const response = await fetch(url, { headers });
      const data = await response.json();

      if (data?.response?.[0]?.league?.standings?.[0]) {
        const standingsRaw = data.response[0].league.standings[0];
        finalStandings = standingsRaw.map((item: any) => ({
          rank: item.rank,
          team: item.team.name,
          played: item.all.played,
          win: item.all.win,
          draw: item.all.draw,
          loss: item.all.lose,
          points: item.points,
          goalsFor: item.all.goals.for,
          goalsAgainst: item.all.goals.against,
          form: item.form || 'WWWDW'
        }));
      }
    } catch (err) {
      console.error('API-Football standings failure, using simulated league standings:', err);
    }
  }

  if (finalStandings.length === 0) {
    finalStandings = SIMULATED_STANDINGS;
  }

  setToBackendCache(cacheKey, finalStandings);
  return res.json(finalStandings);
});

// 5. MATCH STATISTICS proxy (API-Football) with caching
app.get('/api/football/statistics', async (req, res) => {
  const { fixtureId } = req.query;
  if (!fixtureId) {
    return res.status(400).json({ error: 'fixtureId parameter is required' });
  }

  const cacheKey = `football_statistics_${fixtureId}`;
  const cachedStats = getFromBackendCache<any>(cacheKey);
  if (cachedStats) {
    return res.json(cachedStats);
  }

  const footballKey = process.env.API_FOOTBALL_KEY || process.env.RAPIDAPI_KEY;
  const isRealApiMatch = typeof fixtureId === 'string' && fixtureId.startsWith('apifb_');
  let finalStats: any = null;

  if (footballKey && isRealApiMatch) {
    try {
      const numericId = fixtureId.replace('apifb_', '');
      const headers: any = {};
      if (process.env.RAPIDAPI_KEY) {
        headers['x-rapidapi-key'] = process.env.RAPIDAPI_KEY;
        headers['x-rapidapi-host'] = 'api-football-v1.p.rapidapi.com';
      } else {
        headers['x-apisports-key'] = footballKey;
      }

      const url = process.env.RAPIDAPI_KEY
        ? `https://api-football-v1.p.rapidapi.com/v3/fixtures/statistics?fixture=${numericId}`
        : `https://v3.football.api-sports.io/fixtures/statistics?fixture=${numericId}`;

      const response = await fetch(url, { headers });
      const data = await response.json();

      if (data?.response && data.response.length >= 2) {
        const homeStats = data.response[0].statistics;
        const awayStats = data.response[1].statistics;

        const getVal = (statsArr: any[], type: string) => {
          const item = statsArr.find((s: any) => s.type === type);
          return item ? item.value : 0;
        };

        const parsedPosHome = parseInt(getVal(homeStats, 'Ball Possession')?.toString() || '50');
        const parsedPosAway = parseInt(getVal(awayStats, 'Ball Possession')?.toString() || '50');

        finalStats = {
          possession: {
            home: isNaN(parsedPosHome) ? 50 : parsedPosHome,
            away: isNaN(parsedPosAway) ? 50 : parsedPosAway
          },
          shotsOnGoal: {
            home: getVal(homeStats, 'Shots on Goal') ?? 0,
            away: getVal(awayStats, 'Shots on Goal') ?? 0
          },
          shotsOffGoal: {
            home: getVal(homeStats, 'Shots off Goal') ?? 0,
            away: getVal(awayStats, 'Shots off Goal') ?? 0
          },
          fouls: {
            home: getVal(homeStats, 'Fouls') ?? 0,
            away: getVal(awayStats, 'Fouls') ?? 0
          },
          corners: {
            home: getVal(homeStats, 'Corner Kicks') ?? 0,
            away: getVal(awayStats, 'Corner Kicks') ?? 0
          },
          yellowCards: {
            home: getVal(homeStats, 'Yellow Cards') ?? 0,
            away: getVal(awayStats, 'Yellow Cards') ?? 0
          },
          redCards: {
            home: getVal(homeStats, 'Red Cards') ?? 0,
            away: getVal(awayStats, 'Red Cards') ?? 0
          }
        };
      }
    } catch (err) {
      console.error('API-Football statistics fetch failure, fallback to simulators:', err);
    }
  }

  // Fallback to local simulated stats search by match ID
  if (!finalStats) {
    const matched = simulatedMatches.find(m => m.id === fixtureId);
    if (matched) {
      finalStats = matched.stats;
    } else {
      // Fallback default
      finalStats = {
        possession: { home: 49, away: 51 },
        shotsOnGoal: { home: 5, away: 4 },
        shotsOffGoal: { home: 6, away: 5 },
        fouls: { home: 10, away: 11 },
        corners: { home: 3, away: 4 },
        yellowCards: { home: 1, away: 1 },
        redCards: { home: 0, away: 0 }
      };
    }
  }

  setToBackendCache(cacheKey, finalStats);
  return res.json(finalStats);
});

// 6. TEAM STATISTICS proxy (API-Football) with elegant backend caching
app.get('/api/football/team-statistics', async (req, res) => {
  const { teamName, sport } = req.query;
  if (!teamName) {
    return res.status(400).json({ error: 'teamName parameters is required' });
  }

  const chosenSport = (sport || 'football').toString();
  const cacheKey = `team_statistics_${encodeURIComponent(teamName.toString())}_${chosenSport}`;
  const cachedTeamStats = getFromBackendCache<any>(cacheKey);
  if (cachedTeamStats) {
    return res.json(cachedTeamStats);
  }

  const footballKey = process.env.API_FOOTBALL_KEY || process.env.RAPIDAPI_KEY;
  let finalTeamStats: any = null;

  // Let's call API-Football team stats if we are for football
  if (footballKey && chosenSport === 'football') {
    try {
      const headers: any = {};
      if (process.env.RAPIDAPI_KEY) {
        headers['x-rapidapi-key'] = process.env.RAPIDAPI_KEY;
        headers['x-rapidapi-host'] = 'api-football-v1.p.rapidapi.com';
      } else {
        headers['x-apisports-key'] = footballKey;
      }

      // First retrieve teamId by searching teamName
      const resolvedName = encodeURIComponent(teamName.toString());
      const searchUrl = process.env.RAPIDAPI_KEY
        ? `https://api-football-v1.p.rapidapi.com/v3/teams?name=${resolvedName}`
        : `https://v3.football.api-sports.io/teams?name=${resolvedName}`;

      const teamSearchResp = await fetch(searchUrl, { headers });
      const searchResult = await teamSearchResp.json();

      if (searchResult?.response?.[0]?.team?.id) {
        const apiTeamId = searchResult.response[0].team.id;
        
        // Fetch detailed stats for Premier League League (39) of Season 2025
        const statsUrl = process.env.RAPIDAPI_KEY
          ? `https://api-football-v1.p.rapidapi.com/v3/teams/statistics?league=39&season=2025&team=${apiTeamId}`
          : `https://v3.football.api-sports.io/teams/statistics?league=39&season=2025&team=${apiTeamId}`;

        const statsResp = await fetch(statsUrl, { headers });
        const statsResult = await statsResp.json();

        if (statsResult?.response) {
          const r = statsResult.response;
          finalTeamStats = {
            team: teamName,
            sport: 'football',
            form: r.form || 'WWWDW',
            fixtures: {
              played: r.fixtures.played.total ?? 38,
              wins: r.fixtures.wins.total ?? 22,
              draws: r.fixtures.draws.total ?? 8,
              losses: r.fixtures.loses.total ?? 8
            },
            goals: {
              for: r.goals.for.total.total ?? 68,
              against: r.goals.against.total.total ?? 32
            },
            cleanSheets: r.clean_sheets.total ?? 12,
            failedToScore: r.failed_to_score.total ?? 4
          };
        }
      }
    } catch (err) {
      console.error('API-Football team statistics failure, will fallback:', err);
    }
  }

  if (!finalTeamStats) {
    // Elegant fallback simulation model
    const code = teamName.toString().charCodeAt(0) + teamName.toString().charCodeAt(teamName.toString().length - 1);
    const wins = 16 + (code % 10);
    const losses = 6 + (code % 7);
    const draws = 38 - wins - losses;
    const goalsFor = 50 + (code % 30);
    const goalsAgainst = 22 + (code % 20);

    finalTeamStats = {
      team: teamName,
      sport: chosenSport,
      form: 'WWDWW',
      fixtures: {
        played: 38,
        wins,
        draws,
        losses
      },
      goals: {
        for: goalsFor,
        against: goalsAgainst
      },
      cleanSheets: 8 + (code % 8),
      failedToScore: 1 + (code % 5)
    };
  }

  setToBackendCache(cacheKey, finalTeamStats);
  return res.json(finalTeamStats);
});

// VITE SERVER OR STATIC CONTENT MIDDLEWARE SETUP

async function bootstrap() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Binds strictly to Port 3000 and 0.0.0.0 host
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[API GATEWAY CORE] Running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("FATAL: Failed bootstrapping server:", err);
});
