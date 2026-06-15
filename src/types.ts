/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  userId: string;
  username: string;
  email: string;
  balance: number;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

export interface Match {
  id: string;
  sport: 'football' | 'basketball' | 'tennis' | 'esports';
  homeTeam: string;
  awayTeam: string;
  commencesAt: any; // Firestore Timestamp or ISO string
  status: 'upcoming' | 'live' | 'completed' | 'cancelled';
  odds: {
    homeWin: number;
    awayWin: number;
    draw: number;
  };
  score: {
    home: number;
    away: number;
  };
  minute?: number;
  result: 'home_win' | 'away_win' | 'draw' | 'pending';
  createdAt: any;
}

export interface Bet {
  id: string;
  userId: string;
  username: string;
  matchId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  predictedOutcome: 'home_win' | 'away_win' | 'draw';
  odds: number;
  amount: number;
  potentialWin: number;
  status: 'pending' | 'won' | 'lost' | 'cancelled';
  createdAt: any;
  resolvedAt?: any;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number; // positive for deposit/win, negative for withdraw/placed bet
  type: 'deposit' | 'withdrawal' | 'bet_placed' | 'bet_payout';
  description: string;
  createdAt: any;
}
