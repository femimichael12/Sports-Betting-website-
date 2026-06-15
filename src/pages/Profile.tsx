/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType, collection, query, where, onSnapshot } from '../lib/firebase';
import { Transaction } from '../types';
import { 
  User, 
  Coins, 
  FileText, 
  Plus, 
  Minus, 
  Edit3, 
  Check, 
  HelpCircle,
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownLeft,
  Activity
} from 'lucide-react';
import { motion } from 'motion/react';

export default function Profile() {
  const { profile, updateUsername, adjustBalance, user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);

  // Simulation loading states
  const [simLoading, setSimLoading] = useState<string | null>(null);
  const [simAmount, setSimAmount] = useState('250');
  const [simError, setSimError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setNewUsername(profile.username);
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;

    // Fetch user transactions
    const q = query(collection(db, 'transactions'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Transaction[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        items.push({
          id: doc.id,
          userId: d.userId,
          amount: d.amount,
          type: d.type,
          description: d.description,
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt || Date.now()),
        });
      });

      // Sort locally in memory by date descending to prevent index requirements
      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setTransactions(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transactions');
    });

    return () => unsubscribe();
  }, [user]);

  const handleUpdateName = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setNameError(null);
    setNameSuccess(false);

    try {
      await updateUsername(newUsername);
      setNameSuccess(true);
      setIsEditingName(false);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (error: any) {
      setNameError(error?.message || "Could not update username.");
    }
  };

  const handleDepositSim = async (amount: number) => {
    if (amount <= 0) return;
    setSimError(null);
    try {
      setSimLoading('deposit');
      await adjustBalance(amount, 'deposit', `Simulated funding of credit wallet via banking pipeline.`);
    } catch (e: any) {
      setSimError(e?.message || "Failed to simulate credit deposit.");
    } finally {
      setSimLoading(null);
    }
  };

  const handleWithdrawalSim = async (amount: number) => {
    if (amount <= 0) return;
    setSimError(null);
    try {
      setSimLoading('withdrawal');
      await adjustBalance(-amount, 'withdrawal', `Simulated transfer of cash-out credits to checking account.`);
    } catch (e: any) {
      setSimError(e?.message || "Failed to simulate credit withdrawal.");
    } finally {
      setSimLoading(null);
    }
  };

  const getTransactionTypeBadge = (type: string, amount: number) => {
    switch (type) {
      case 'deposit':
        return (
          <span className="flex items-center space-x-1.5 text-geo-success font-mono text-[10px] font-bold bg-geo-success/10 px-2.5 py-1 rounded-sm border border-geo-success/20 uppercase tracking-wide">
            <ArrowDownLeft className="w-3.5 h-3.5 text-geo-success shrink-0" />
            <span>Fund Inflow</span>
          </span>
        );
      case 'withdrawal':
        return (
          <span className="flex items-center space-x-1.5 text-red-400 font-mono text-[10px] font-bold bg-red-950/20 px-2.5 py-1 rounded-sm border border-red-900/30 uppercase tracking-wide">
            <ArrowUpRight className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <span>Cash Out</span>
          </span>
        );
      case 'bet_placed':
        return (
          <span className="flex items-center space-x-1.5 text-geo-brand font-mono text-[10px] font-bold bg-geo-brand/10 px-2.5 py-1 rounded-sm border border-geo-brand/20 uppercase tracking-wide">
            <TrendingDown className="w-3.5 h-3.5 text-geo-brand" />
            <span>Wager placed</span>
          </span>
        );
      case 'bet_payout':
        return (
          <span className="flex items-center space-x-1.5 text-geo-success font-mono text-[10px] font-bold bg-geo-success/10 px-2.5 py-1 rounded-sm border border-geo-success/20 uppercase tracking-wide">
            <Plus className="w-3.5 h-3.5 text-geo-success" />
            <span>Bet Payout</span>
          </span>
        );
      default:
        return (
          <span className="text-geo-text-muted text-[10px] font-bold bg-geo-bg border border-geo-border px-2 py-0.5 rounded-sm uppercase tracking-wide">
            Adjustment
          </span>
        );
    }
  };

  return (
    <div id="profile-workspace" className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-6xl mx-auto">
      
      {/* LEFT COLUMN: User details, Change Username, simulated Deposits (Grid width 5) */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Profile Card */}
        <div className="bg-geo-card border border-geo-border rounded-sm p-6 shadow-md space-y-6">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-geo-brand rounded-sm flex items-center justify-center font-display text-2xl font-black text-black uppercase border border-geo-border">
              {profile ? profile.username[0] : 'U'}
            </div>
            <div className="space-y-1.5 flex-grow font-sans">
              
              <div className="flex items-center justify-between">
                {isEditingName ? (
                  <form onSubmit={handleUpdateName} className="flex gap-2 w-full">
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="bg-geo-bg border border-geo-border focus:border-geo-brand rounded-sm px-2.5 py-1 text-xs text-white font-bold focus:outline-none w-full uppercase tracking-wider"
                      minLength={3}
                      maxLength={32}
                    />
                    <button type="submit" className="p-1.5 bg-geo-brand text-black rounded-sm cursor-pointer hover:bg-geo-brand/90 transition-all font-bold">
                      <Check className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="font-display font-black text-lg text-white tracking-tight uppercase">{profile?.username}</h2>
                    <button onClick={() => setIsEditingName(true)} className="p-1 rounded-sm text-geo-text-muted hover:bg-geo-bg hover:text-white transition-colors cursor-pointer">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <p className="text-xs text-geo-text-muted font-medium truncate">{profile?.email}</p>
              
              {/* Account Security Verification Status */}
              <div className="mt-2 flex items-center">
                {user?.isAnonymous ? (
                  <span className="inline-flex items-center space-x-1 font-mono text-[9px] font-bold text-geo-text-muted bg-geo-bg px-2 py-0.5 rounded-sm border border-geo-border uppercase tracking-wider select-none">
                    Guest Mode Pass
                  </span>
                ) : user?.emailVerified ? (
                  <span className="inline-flex items-center space-x-1 font-mono text-[9px] font-bold text-geo-success bg-geo-success/10 px-2 py-0.5 rounded-sm border border-geo-success/20 uppercase tracking-wide select-none">
                    ✓ Ledger Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 font-mono text-[9px] font-bold text-red-400 bg-red-950/20 px-2 py-0.5 rounded-sm border border-red-900/30 uppercase tracking-wide select-none">
                    ⚠ Unverified Link
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Account Balance Widget */}
          <div className="bg-geo-bg border border-geo-border p-4.5 rounded-sm flex items-center justify-between relative overflow-hidden shadow-inner">
            <div className="space-y-1 z-10">
              <span className="text-[10px] text-geo-text-muted uppercase tracking-widest font-mono font-bold block">Free Bookmaker Credits</span>
              <span className="text-2xl font-mono font-black text-geo-brand tracking-tight leading-none block mt-1">
                ₦{profile?.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <Coins className="w-10 h-10 text-geo-brand/5 absolute -bottom-1 -right-1 stroke-[1.2]" />
          </div>

          {nameSuccess && (
            <p className="text-xs font-mono text-geo-success bg-geo-success/10 rounded-sm p-2.5 border border-geo-success/20">
              ✓ Username updated in ledger index successfully.
            </p>
          )}
          {nameError && (
            <p className="text-xs font-mono text-red-500 bg-red-950/20 rounded-sm p-2.5 border border-red-900/20">
              🚨 {nameError}
            </p>
          )}
        </div>

        {/* simulated wallet controls */}
        <div className="bg-geo-card border border-geo-border rounded-sm p-6 shadow-md space-y-5">
          <div>
            <h3 className="font-display font-black text-sm tracking-wide text-white uppercase flex items-center gap-2">
              <Activity className="w-4.5 h-4.5 text-geo-brand" />
              Simulated Ledger Funding
            </h3>
            <p className="text-xs text-geo-text-muted mt-1 font-medium">Simulate depositing or withdrawing free credits to/from the terminal.</p>
          </div>

          <div className="space-y-4">
            <div className="relative font-sans">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-geo-text-muted font-mono text-sm leading-none font-bold">₦</span>
              <input
                type="number"
                value={simAmount}
                onChange={(e) => setSimAmount(e.target.value)}
                placeholder="0.00"
                min="10"
                className="w-full bg-geo-bg border border-geo-border focus:border-geo-brand focus:outline-none rounded-sm py-3.5 pl-8 pr-4 text-xs font-mono font-black text-geo-text-light"
              />
            </div>

            {simError && (
              <p className="text-xs font-mono text-red-500 bg-red-950/25 rounded-sm p-2.5 border border-red-900/30">{simError}</p>
            )}

            <div className="grid grid-cols-2 gap-3.5">
              <button
                onClick={() => {
                  const val = Number(simAmount) || 0;
                  handleDepositSim(val);
                }}
                disabled={simLoading !== null || Number(simAmount) <= 0}
                className="flex items-center justify-center space-x-2 py-3 border border-geo-success/20 hover:border-geo-success/35 bg-geo-success/5 hover:bg-geo-success/10 text-geo-success rounded-sm font-display font-bold text-xs uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {simLoading === 'deposit' ? (
                  <span className="w-4 h-4 border-2 border-geo-success border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Inflow Wallet</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  const val = Number(simAmount) || 0;
                  handleWithdrawalSim(val);
                }}
                disabled={simLoading !== null || Number(simAmount) <= 0 || (profile ? profile.balance < (Number(simAmount) || 0) : true)}
                className="flex items-center justify-center space-x-2 py-3 border border-red-900/20 hover:border-red-900/35 bg-red-950/10 hover:bg-red-950/20 text-red-400 rounded-sm font-display font-bold text-xs uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {simLoading === 'withdrawal' ? (
                  <span className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Minus className="w-4 h-4" />
                    <span>Cash Out</span>
                  </>
                )}
              </button>
            </div>
            
            {/* Quick pre-sets */}
            <div className="flex gap-2 justify-center">
              {['100', '250', '500', '1000'].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setSimAmount(preset)}
                  className={`text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm border transition-colors cursor-pointer ${
                    simAmount === preset 
                      ? 'bg-geo-bg border-geo-brand text-geo-brand' 
                      : 'bg-geo-bg border-geo-border text-geo-text-muted hover:text-white hover:border-geo-border-light'
                  }`}
                >
                  ₦{preset}
                </button>
              ))}
            </div>

          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: Full Financial Transactions Ledger list (Grid width 7) */}
      <div className="lg:col-span-7 bg-geo-card border border-geo-border rounded-sm p-6 shadow-md h-fit">
        
        <div className="flex items-center justify-between border-b border-geo-border pb-4 mb-5">
          <div className="flex items-center space-x-2.5">
            <FileText className="w-5 h-5 text-geo-brand" />
            <h3 className="font-display font-black text-base text-white tracking-tight uppercase">Ledger Balance Audit</h3>
          </div>
          <span className="text-[10px] font-mono bg-geo-bg border border-geo-border rounded-sm px-2.5 py-1 text-geo-text-muted uppercase font-bold tracking-wider">
            {transactions.length} Events Total
          </span>
        </div>

        {transactions.length === 0 ? (
          <div className="py-20 text-center text-geo-text-muted">
            <FileText className="w-10 h-10 text-geo-border mx-auto mb-3" />
            <p className="text-xs font-bold uppercase tracking-wider">No ledger records compiled yet.</p>
            <p className="text-[11px] text-geo-text-muted mt-0.5 leading-relaxed font-semibold">Wagers or deposits will register transactions immediately.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {transactions.map((tx) => {
              const isPositive = tx.amount > 0;
              return (
                <div
                  key={tx.id}
                  className="bg-geo-bg border border-geo-border rounded-sm p-3.5 flex items-center justify-between gap-4 text-xs hover:border-geo-border-light transition-colors"
                >
                  <div className="space-y-1.5 flex-grow min-w-0 font-sans">
                    <p className="font-mono text-geo-text-light text-[11px] leading-relaxed truncate pr-2 font-bold uppercase tracking-wider">
                      {tx.description}
                    </p>
                    <div className="flex items-center space-x-2 text-[10px] font-mono text-geo-text-muted font-bold">
                      <span>TXID: {tx.id.substring(3, 8).toUpperCase()}</span>
                      <span>•</span>
                      <span>{tx.createdAt.toLocaleDateString()} {tx.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0 gap-1.5">
                    {getTransactionTypeBadge(tx.type, tx.amount)}
                    <span className={`font-mono font-black text-[13px] ${isPositive ? 'text-geo-success' : 'text-red-400'}`}>
                      {isPositive ? '+' : ''}${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

    </div>
  );
}
