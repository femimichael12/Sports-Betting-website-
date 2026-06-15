/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType, collection, query, where, onSnapshot } from '../lib/firebase';
import { Transaction } from '../types';
import { 
  Wallet as WalletIcon,
  Coins, 
  ArrowUpRight, 
  ArrowDownLeft, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Minus, 
  CreditCard, 
  Search, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Filter,
  DollarSign,
  Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Payment channels
interface PaymentMethod {
  id: string;
  name: string;
  type: 'card' | 'crypto' | 'bank';
  number: string;
  logo: string;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'visa', name: 'Visa Gold Card', type: 'card', number: '•••• •••• •••• 4242', logo: '💳' },
  { id: 'crypto_usdt', name: 'USDT (ERC-20/EVM)', type: 'crypto', number: '0x71C...3a92', logo: '🟢' },
  { id: 'crypto_btc', name: 'Bitcoin (SegWit)', type: 'crypto', number: 'bc1q9...f64x', logo: '🪙' },
  { id: 'bank_transfer', name: 'ACH Checking Account', type: 'bank', number: '•••• •••• 9811', logo: '🏛️' },
];

export default function Wallet() {
  const { profile, adjustBalance, user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  
  // Deposit state
  const [depositAmount, setDepositAmount] = useState('100');
  const [selectedDepositMethod, setSelectedDepositMethod] = useState(PAYMENT_METHODS[0].id);
  const [depositSuccess, setDepositSuccess] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositing, setDepositing] = useState(false);

  // Withdrawal state
  const [withdrawAmount, setWithdrawAmount] = useState('50');
  const [selectedWithdrawMethod, setSelectedWithdrawMethod] = useState(PAYMENT_METHODS[0].id);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  // Active Tab/Mode: "deposit" | "withdraw"
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');

  // Load transactions
  useEffect(() => {
    if (!user) return;

    setLoading(true);
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

      // Sort locally by date descending
      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setTransactions(items);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transactions');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Financial Stats calculated from transactions
  const stats = useMemo(() => {
    let totalDeposited = 0;
    let totalWithdrawn = 0;
    let totalBetsPlaced = 0;
    let totalPayouts = 0;

    transactions.forEach(tx => {
      if (tx.type === 'deposit') totalDeposited += Math.abs(tx.amount);
      if (tx.type === 'withdrawal') totalWithdrawn += Math.abs(tx.amount);
      if (tx.type === 'bet_placed') totalBetsPlaced += Math.abs(tx.amount);
      if (tx.type === 'bet_payout') totalPayouts += Math.abs(tx.amount);
    });

    const netProfit = totalPayouts - totalBetsPlaced;
    const isProfitable = netProfit >= 0;

    // Determine Vip Tier
    let rbacTier = 'Bronze Bettor';
    const volume = totalDeposited + totalWithdrawn + totalBetsPlaced + totalPayouts;
    if (volume > 15000) rbacTier = 'Vip Diamond';
    else if (volume > 5000) rbacTier = 'Platinum Elite';
    else if (volume > 1500) rbacTier = 'Gold Champion';
    else if (volume > 500) rbacTier = 'Silver pro';

    return {
      totalDeposited,
      totalWithdrawn,
      totalBetsPlaced,
      totalPayouts,
      netProfit,
      isProfitable,
      rbacTier
    };
  }, [transactions]);

  // Construct actual history path coordinates for balance trend SVG chart
  const balanceTrend = useMemo(() => {
    if (transactions.length === 0) {
      return [{ date: 'Initial', balance: 1000.0 }];
    }

    // Process from oldest to newest to build correct trace
    const chronologicalTx = [...transactions].reverse();
    let rollingBalance = 1000.0; // Current rule configuration sets starting balance at 1000
    const datapoints = [{ date: 'Initial', balance: rollingBalance }];

    chronologicalTx.forEach((tx) => {
      rollingBalance += tx.amount;
      datapoints.push({
        date: tx.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        balance: Number(rollingBalance.toFixed(2))
      });
    });

    // Take max latest 12 entries to look clean on graph
    return datapoints.slice(-12);
  }, [transactions]);

  // Compute SVG viewBox and path
  const chartPath = useMemo(() => {
    if (balanceTrend.length < 2) return { line: '', area: '' };

    const width = 600;
    const height = 140;
    const padding = 15;

    const balances = balanceTrend.map(d => d.balance);
    const minBal = Math.min(...balances) * 0.95; // 5% breathing room below
    const maxBal = Math.max(...balances) * 1.05; // 5% breathing room above
    const deltaBal = maxBal - minBal || 1;

    const getX = (index: number) => padding + (index / (balanceTrend.length - 1)) * (width - padding * 2);
    const getY = (bal: number) => height - padding - ((bal - minBal) / deltaBal) * (height - padding * 2);

    let lineString = '';
    let areaString = '';

    balanceTrend.forEach((pt, idx) => {
      const x = getX(idx);
      const y = getY(pt.balance);

      if (idx === 0) {
        lineString = `M ${x} ${y}`;
        areaString = `M ${x} ${height - padding} L ${x} ${y}`;
      } else {
        lineString += ` L ${x} ${y}`;
        areaString += ` L ${x} ${y}`;
      }
    });

    // Close area string for gradients
    const firstX = getX(0);
    const lastX = getX(balanceTrend.length - 1);
    areaString += ` L ${lastX} ${height - padding} Z`;

    return { line: lineString, area: areaString };
  }, [balanceTrend]);

  // Deposit actions
  const handleDeposit = async () => {
    const amount = Number(depositAmount);
    setDepositError(null);
    setDepositSuccess(false);

    if (isNaN(amount) || amount <= 0) {
      setDepositError('Invalid deposit credit volume.');
      return;
    }
    if (amount < 2000) {
      setDepositError('Minimum transaction deposit amount is ₦2,000.00');
      return;
    }
    if (amount > 10000000.0) {
      setDepositError('Maximum single transactions deposit cap exceeded.');
      return;
    }

    setDepositing(true);
    const method = PAYMENT_METHODS.find(m => m.id === selectedDepositMethod);
    const desc = `Deposit: Credits funded via ${method?.name || 'External Ledger Transfer'} (${method?.number})`;

    try {
      await adjustBalance(amount, 'deposit', desc);
      setDepositSuccess(true);
      setDepositAmount('100');
      setTimeout(() => setDepositSuccess(false), 5000);
    } catch (err: any) {
      setDepositError(err?.message || 'Inflow failure inside the payment ledger network.');
    } finally {
      setDepositing(false);
    }
  };

  // Withdrawal actions
  const handleWithdrawal = async () => {
    const amount = Number(withdrawAmount);
    setWithdrawError(null);
    setWithdrawSuccess(false);

    if (isNaN(amount) || amount <= 0) {
      setWithdrawError('Invalid cash-out credit volume.');
      return;
    }
    if (amount < 2000) {
      setWithdrawError('Minimum cash out volume is ₦2,000.00');
      return;
    }
    if (!profile || profile.balance < amount) {
      setWithdrawError('Insufficient balance to satisfy withdrawal process.');
      return;
    }

    setWithdrawing(true);
    const method = PAYMENT_METHODS.find(m => m.id === selectedWithdrawMethod);
    const desc = `Withdrawal: Cash-out processed to ${method?.name || 'Authorized Bank Portal'} (${method?.number})`;

    try {
      // Withdrawal decreases balance, adjust balance requires negative number
      await adjustBalance(-amount, 'withdrawal', desc);
      setWithdrawSuccess(true);
      setWithdrawAmount('50');
      setTimeout(() => setWithdrawSuccess(false), 5000);
    } catch (err: any) {
      setWithdrawError(err?.message || 'Outflow ledger error. Please verify account eligibility.');
    } finally {
      setWithdrawing(false);
    }
  };

  // Filter & Search ledger
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            tx.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'all' || tx.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [transactions, searchTerm, selectedType]);

  // Export mock statement
  const handleExportStatement = () => {
    const header = 'Date,Transaction ID,Amount,Type,Description\n';
    const rows = transactions.map(tx => {
      return `"${tx.createdAt.toISOString()}","${tx.id}",${tx.amount},"${tx.type}","${tx.description.replace(/"/g, '""')}"`;
    }).join('\n');
    
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `FEMBET_Statement_${user?.uid.slice(0, 5) || 'Ledger'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="wallet-workspace" className="max-w-7xl mx-auto space-y-8 px-1">
      
      {/* HEADER STATEMENT PANEL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-geo-border pb-6">
        <div>
          <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-geo-brand bg-geo-brand/5 px-2.5 py-1 border border-geo-brand/10 rounded-sm">
            Terminal Ledger Core
          </span>
          <h1 className="font-display font-black text-3xl text-white tracking-tight uppercase mt-2">
            My Bettor Wallet
          </h1>
          <p className="text-sm text-geo-text-muted mt-1 max-w-2xl">
            Real-time balance settlement, secure withdrawals, digital transaction journals, and multi-network deposit funnels linked to your account.
          </p>
        </div>
      </div>

      {/* THREE BENTO STATE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* balance panel */}
        <div className="md:col-span-2 bg-gradient-to-br from-geo-card to-[#232931] border border-geo-border rounded-sm p-6 relative overflow-hidden shadow-lg flex flex-col justify-between min-h-[170px]">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-mono tracking-widest text-geo-text-muted uppercase font-bold block">Available Balance</span>
              <span className="text-3xl sm:text-4xl font-mono font-black text-geo-success tracking-tight">
                ₦{profile?.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="w-12 h-12 bg-geo-success/10 border border-geo-success/20 rounded-sm flex items-center justify-center text-geo-success">
              <Coins className="w-6 h-6 stroke-[2]" />
            </div>
          </div>

          <div className="border-t border-geo-border pt-4 mt-4 flex items-center justify-between text-xs font-mono text-geo-text-muted">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-geo-success animate-pulse" />
              <span className="font-bold">Sync Secured: Google Cloud Database</span>
            </div>
            <span className="font-bold uppercase tracking-wider text-[10px] text-geo-brand">Live Settlement</span>
          </div>
          <Coins className="w-32 h-32 text-geo-success/[0.02] absolute -bottom-8 -right-8 pointer-events-none stroke-[1]" />
        </div>

        {/* inflow tracker */}
        <div className="bg-geo-card border border-geo-border rounded-sm p-6 shadow-md flex flex-col justify-between min-h-[170px]">
          <div className="flex justify-between items-start">
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono tracking-widest text-geo-text-muted uppercase font-bold block">Wallet Inflows</span>
              <span className="text-2xl font-mono font-black text-white">
                ₦{stats.totalDeposited.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="w-10 h-10 bg-geo-success/5 border border-geo-success/15 rounded-sm flex items-center justify-center text-geo-success">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>
          <div className="text-[10px] font-mono text-geo-text-muted mt-3 pt-3 border-t border-geo-border/60 flex justify-between font-bold uppercase tracking-wider">
            <span>Bet Payouts Recv:</span>
            <span className="text-geo-success">₦{stats.totalPayouts.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* outflow tracker */}
        <div className="bg-geo-card border border-geo-border rounded-sm p-6 shadow-md flex flex-col justify-between min-h-[170px]">
          <div className="flex justify-between items-start">
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono tracking-widest text-geo-text-muted uppercase font-bold block">Wallet Outflows</span>
              <span className="text-2xl font-mono font-black text-white">
                ₦{stats.totalWithdrawn.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="w-10 h-10 bg-red-950/10 border border-red-900/20 rounded-sm flex items-center justify-center text-red-400">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="text-[10px] font-mono text-geo-text-muted mt-3 pt-3 border-t border-geo-border/60 flex justify-between font-bold uppercase tracking-wider">
            <span>Staked In Bets:</span>
            <span className="text-geo-brand">₦{stats.totalBetsPlaced.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

      </div>

      {/* MIDDLE CONTAINER: TRANSACTING TERMINAL & BALANCE LINE CHART */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* TRANSACTION ACTION WINDOW (Col span 5 for UI density) */}
        <div className="lg:col-span-5 bg-geo-card border border-geo-border rounded-sm p-6 shadow-md h-fit">
          
          {/* TAB CHANNEL BUTTONS */}
          <div className="grid grid-cols-2 bg-geo-bg border border-geo-border p-1 rounded-sm mb-6">
            <button
              onClick={() => { setActiveTab('deposit'); setDepositError(null); setDepositSuccess(false); }}
              className={`py-3.5 text-center font-display font-bold text-xs uppercase cursor-pointer rounded-sm tracking-wider transition-all duration-150 flex items-center justify-center gap-2 ${
                activeTab === 'deposit' 
                  ? 'bg-geo-card text-geo-success border border-geo-success/15 tracking-widest font-black shadow-md' 
                  : 'text-geo-text-muted hover:text-geo-text-light hover:bg-geo-card/40'
              }`}
            >
              <Plus className="w-4 h-4 text-geo-success" />
              <span>Inflow Credits</span>
            </button>
            <button
              onClick={() => { setActiveTab('withdraw'); setWithdrawError(null); setWithdrawSuccess(false); }}
              className={`py-3.5 text-center font-display font-bold text-xs uppercase cursor-pointer rounded-sm tracking-wider transition-all duration-150 flex items-center justify-center gap-2 ${
                activeTab === 'withdraw' 
                  ? 'bg-geo-card text-red-400 border border-red-900/15 tracking-widest font-black shadow-md' 
                  : 'text-geo-text-muted hover:text-geo-text-light hover:bg-geo-card/40'
              }`}
            >
              <Minus className="w-4 h-4 text-red-400" />
              <span>Cash Out</span>
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'deposit' ? (
              <motion.div
                key="deposit-tab"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                className="space-y-5"
              >
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-geo-text-muted block mb-2">
                    Enter Deposit Credit Volume
                  </label>
                  <div className="relative font-sans">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-geo-text-muted font-mono text-sm leading-none font-bold">₦</span>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="0.00"
                      min="2000"
                      className="w-full bg-geo-bg border border-geo-border focus:border-geo-success focus:outline-none rounded-sm py-4 pl-9 pr-4 text-sm font-mono font-black text-white"
                    />
                  </div>
                </div>

                {/* Instant Presets */}
                <div className="grid grid-cols-4 gap-2">
                  {['2000', '5000', '10000', '50000'].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setDepositAmount(preset)}
                      className={`text-[10px] font-mono font-bold uppercase tracking-wider py-2 rounded-sm border transition-colors cursor-pointer ${
                        depositAmount === preset 
                          ? 'bg-geo-success/15 border-geo-success text-geo-success font-black' 
                          : 'bg-geo-bg border-geo-border text-geo-text-muted hover:text-white hover:border-geo-border-light'
                      }`}
                    >
                      +₦{Number(preset).toLocaleString()}
                    </button>
                  ))}
                </div>

                {/* Simulated Funding Channels */}
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-geo-text-muted block mb-2">
                    Funding Payment Network Network Gateway
                  </label>
                  <div className="space-y-2">
                    {PAYMENT_METHODS.map((method) => (
                      <button
                        key={method.id}
                        onClick={() => setSelectedDepositMethod(method.id)}
                        className={`w-full text-left p-3 border rounded-sm flex items-center justify-between transition-colors cursor-pointer ${
                          selectedDepositMethod === method.id 
                            ? 'bg-geo-bg border-geo-success/35 text-white' 
                            : 'bg-geo-bg/40 border-geo-border text-geo-text-muted hover:text-geo-text-light hover:border-geo-border-light'
                        }`}
                      >
                        <div className="flex items-center space-x-3 text-xs">
                          <span className="text-lg">{method.logo}</span>
                          <div>
                            <p className="font-bold text-[11px] text-geo-text-light uppercase tracking-wider">{method.name}</p>
                            <p className="font-mono text-[9px] text-[#848E9C] font-semibold mt-0.5">{method.number}</p>
                          </div>
                        </div>
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          selectedDepositMethod === method.id ? 'border-geo-success bg-geo-success/20' : 'border-geo-border'
                        }`}>
                          {selectedDepositMethod === method.id && <div className="w-1.5 h-1.5 rounded-full bg-geo-success" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message display banner */}
                {depositSuccess && (
                  <div className="text-[11px] font-mono text-geo-success bg-geo-success/10 rounded-sm p-3 border border-geo-success/20 flex gap-2 items-start">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-black uppercase tracking-wider">Transaction Settled</p>
                      <p className="text-geo-text-muted mt-0.5 font-semibold">Inflow coordinates synchronized successfully with cloud ledger.</p>
                    </div>
                  </div>
                )}
                {depositError && (
                  <div className="text-[11px] font-mono text-red-400 bg-red-950/25 rounded-sm p-3 border border-red-900/30 flex gap-2 items-start">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-black uppercase tracking-wider">Ledger Denied</p>
                      <p className="text-geo-text-muted mt-0.5 font-semibold">{depositError}</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleDeposit}
                  disabled={depositing || Number(depositAmount) <= 0}
                  className="w-full py-4 bg-geo-success text-black rounded-sm cursor-pointer hover:bg-geo-success/90 transition-all font-display font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {depositing ? (
                    <span className="w-4.5 h-4.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4.5 h-4.5 stroke-[2.5]" />
                      <span>Confirm Deposit Log</span>
                    </>
                  )}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="withdraw-tab"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-5"
              >
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-geo-text-muted block mb-2">
                    Enter Cash Out Credit Volume
                  </label>
                  <div className="relative font-sans">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-geo-text-muted font-mono text-sm leading-none font-bold">₦</span>
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      min="2000"
                      className="w-full bg-geo-bg border border-geo-border focus:border-red-500 focus:outline-none rounded-sm py-4 pl-9 pr-4 text-sm font-mono font-black text-white"
                    />
                  </div>
                </div>

                {/* Instant Presets */}
                <div className="grid grid-cols-4 gap-2">
                  {['2000', '5000', '10000', '50000'].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setWithdrawAmount(preset)}
                      className={`text-[10px] font-mono font-bold uppercase tracking-wider py-2 rounded-sm border transition-colors cursor-pointer ${
                        withdrawAmount === preset 
                          ? 'bg-red-950/20 border-red-500 text-red-400 font-black' 
                          : 'bg-geo-bg border-geo-border text-geo-text-muted hover:text-white hover:border-geo-border-light'
                      }`}
                    >
                      ₦{Number(preset).toLocaleString()}
                    </button>
                  ))}
                </div>

                {/* Simulated Withdrawal Channels */}
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-geo-text-muted block mb-2">
                    Destination Payment Network Gateway
                  </label>
                  <div className="space-y-2">
                    {PAYMENT_METHODS.map((method) => (
                      <button
                        key={method.id}
                        onClick={() => setSelectedWithdrawMethod(method.id)}
                        className={`w-full text-left p-3 border rounded-sm flex items-center justify-between transition-colors cursor-pointer ${
                          selectedWithdrawMethod === method.id 
                            ? 'bg-geo-bg border-red-900/35 text-white' 
                            : 'bg-geo-bg/40 border-geo-border text-geo-text-muted hover:text-geo-text-light hover:border-geo-border-light'
                        }`}
                      >
                        <div className="flex items-center space-x-3 text-xs">
                          <span className="text-lg">{method.logo}</span>
                          <div>
                            <p className="font-bold text-[11px] text-geo-text-light uppercase tracking-wider">{method.name}</p>
                            <p className="font-mono text-[9px] text-[#848E9C] font-semibold mt-0.5">{method.number}</p>
                          </div>
                        </div>
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          selectedWithdrawMethod === method.id ? 'border-red-500 bg-red-950/20' : 'border-geo-border'
                        }`}>
                          {selectedWithdrawMethod === method.id && <div className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error & Success banner */}
                {withdrawSuccess && (
                  <div className="text-[11px] font-mono text-geo-success bg-geo-success/10 rounded-sm p-3 border border-geo-success/20 flex gap-2 items-start">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-black uppercase tracking-wider">Outflow Authorized</p>
                      <p className="text-geo-text-muted mt-0.5 font-semibold">Ledger synchronized. Cash-out value dispersed to selective network.</p>
                    </div>
                  </div>
                )}
                {withdrawError && (
                  <div className="text-[11px] font-mono text-red-400 bg-red-950/25 rounded-sm p-3 border border-red-900/30 flex gap-2 items-start">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-black uppercase tracking-wider">Outflow Blocked</p>
                      <p className="text-geo-text-muted mt-0.5 font-semibold">{withdrawError}</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleWithdrawal}
                  disabled={withdrawing || Number(withdrawAmount) <= 0 || (profile ? profile.balance < (Number(withdrawAmount) || 0) : true)}
                  className="w-full py-4 bg-red-500 text-black rounded-sm cursor-pointer hover:bg-red-400 transition-all font-display font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {withdrawing ? (
                    <span className="w-4.5 h-4.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Minus className="w-4.5 h-4.5 stroke-[2.5]" />
                      <span>Confirm Withdrawal Log</span>
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* BALANCE TIME TREND GRAPH (Col span 7 for high-tech terminal dashboard feel) */}
        <div className="lg:col-span-7 bg-geo-card border border-geo-border rounded-sm p-6 shadow-md flex flex-col justify-between">
          <div className="space-y-1 border-b border-geo-border pb-4">
            <h3 className="font-display font-black text-base text-white tracking-tight uppercase flex items-center gap-2">
              <Briefcase className="w-4.5 h-4.5 text-geo-brand" />
              Dynamic Ledger Balance History Trend
            </h3>
            <p className="text-xs text-geo-text-muted font-medium">Reconstructed historical balance projection tracing chronological settlements (₦).</p>
          </div>

          <div className="relative py-8 flex items-center justify-center w-full min-h-[200px]" id="balance-history-chart">
            {balanceTrend.length < 2 ? (
              <div className="text-center text-geo-text-muted flex flex-col items-center">
                <Coins className="w-10 h-10 text-geo-border mb-3" />
                <p className="text-xs font-bold uppercase tracking-wider">Analyzing balance points...</p>
                <p className="text-[10px] text-geo-text-muted font-semibold mt-1">Make deposits, withdrawals or wagers to compile ledger vectors.</p>
              </div>
            ) : (
              <div className="w-full">
                {/* SVG Area Line Chart */}
                <svg viewBox="0 0 600 140" className="w-full overflow-visible drop-shadow-[0_0_15px_rgba(2,192,118,0.05)]">
                  <defs>
                    <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#02C076" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#02C076" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="chart-line-grad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#F0B90B" />
                      <stop offset="100%" stopColor="#02C076" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal grid guide lines */}
                  <line x1="15" y1="30" x2="585" y2="30" stroke="#2B3139" strokeWidth="0.5" strokeDasharray="4 4" />
                  <line x1="15" y1="70" x2="585" y2="70" stroke="#2B3139" strokeWidth="0.5" strokeDasharray="4 4" />
                  <line x1="15" y1="110" x2="585" y2="110" stroke="#2B3139" strokeWidth="0.5" strokeDasharray="4 4" />

                  {/* Area fill */}
                  <path d={chartPath.area} fill="url(#chart-area-grad)" />

                  {/* Line track */}
                  <path d={chartPath.line} fill="none" stroke="url(#chart-line-grad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                  {/* Datapoint coordinates dots */}
                  {balanceTrend.map((pt, idx) => {
                    const width = 600;
                    const height = 140;
                    const padding = 15;
                    const balances = balanceTrend.map(d => d.balance);
                    const minBal = Math.min(...balances) * 0.95;
                    const maxBal = Math.max(...balances) * 1.05;
                    const deltaBal = maxBal - minBal || 1;
                    const getX = (i: number) => padding + (i / (balanceTrend.length - 1)) * (width - padding * 2);
                    const getY = (bal: number) => height - padding - ((bal - minBal) / deltaBal) * (height - padding * 2);

                    const cx = getX(idx);
                    const cy = getY(pt.balance);

                    return (
                      <g key={idx} className="group cursor-help">
                        <circle
                          cx={cx}
                          cy={cy}
                          r="4"
                          fill="#0b0e11"
                          stroke={idx === balanceTrend.length - 1 ? '#F0B90B' : '#02C076'}
                          strokeWidth="2"
                        />
                        {/* Hover coordinates box */}
                        <title>{`${pt.date}: ₦${pt.balance.toLocaleString()}`}</title>
                      </g>
                    );
                  })}
                </svg>

                {/* Coordinates Timeline axis */}
                <div className="flex justify-between text-[10px] font-mono text-geo-text-muted mt-5 font-bold uppercase tracking-wider px-3 border-t border-geo-border/60 pt-4">
                  <span>{balanceTrend[0]?.date || ''} (₦{balanceTrend[0]?.balance || 0})</span>
                  <span className="text-center font-black text-geo-brand">Balance Wave</span>
                  <span>{balanceTrend[balanceTrend.length - 1]?.date || ''} (₦{balanceTrend[balanceTrend.length - 1]?.balance || 0})</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick analysis statements */}
          <div className="p-4 bg-geo-bg border border-geo-border rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-auto">
            <div className="space-y-1">
              <span className="text-[10px] text-geo-text-muted uppercase font-mono font-bold tracking-wider block">Net Wager Yield Profitability</span>
              <span className={`text-base font-mono font-black ${stats.isProfitable ? 'text-geo-success' : 'text-red-400'}`}>
                {stats.isProfitable ? '+₦' : '-₦'}{Math.abs(stats.netProfit).toLocaleString('en-US', { minimumFractionDigits: 2 })} Net Yield
              </span>
            </div>
            <div className="text-right text-[10px] font-mono text-geo-text-muted font-bold uppercase tracking-wider">
              {stats.netProfit >= 0 ? (
                <span className="text-geo-success flex items-center gap-1">
                  <TrendingUp className="w-4.5 h-4.5" /> Book Yield positive
                </span>
              ) : (
                <span className="text-red-400 flex items-center gap-1">
                  <TrendingDown className="w-4.5 h-4.5" /> Book Yield net deficit
                </span>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* BOTTOM CONTAINER: ADVANCED SEARCHABLE TRANS JOURNAL */}
      <div className="bg-geo-card border border-geo-border rounded-sm p-6 shadow-md">
        
        {/* Table header controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-geo-border pb-4 mb-6">
          <div className="flex items-center space-x-2.5">
            <div className="w-1.5 h-6 bg-geo-brand rounded-r-sm" />
            <h3 className="font-display font-black text-base text-white tracking-tight uppercase">
              Financial Journals Ledger Book
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Download balance statement Excel */}
            {transactions.length > 0 && (
              <button
                onClick={handleExportStatement}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-geo-bg border border-geo-border hover:border-geo-border-light text-geo-text-light hover:text-white rounded-sm text-xs font-mono font-black uppercase tracking-wider cursor-pointer transition-colors"
                title="Download CSV log"
              >
                <Download className="w-4 h-4 text-geo-brand" />
                <span>Export Journal</span>
              </button>
            )}
            
            {/* Transaction total count */}
            <span className="text-[10px] font-mono bg-geo-bg border border-geo-border rounded-sm px-3.5 py-2.5 text-geo-text-muted uppercase font-bold tracking-wider">
              {filteredTransactions.length} of {transactions.length} Journals Shown
            </span>
          </div>
        </div>

        {/* INPUT SELECT SEARCH CONTROLS */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
          {/* Query Filter description in input */}
          <div className="md:col-span-7 relative font-sans">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-geo-text-muted w-4 h-4" />
            <input
              type="text"
              placeholder="Search Ledger entries by description, TXID matching..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-geo-bg border border-geo-border focus:border-geo-brand focus:outline-none rounded-sm py-2.5 pl-10 pr-4 text-xs font-medium text-geo-text-light placeholder-geo-text-muted"
            />
          </div>

          {/* Group Filter by transaction types */}
          <div className="md:col-span-5 flex relative font-mono text-xs font-bold leading-none">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-geo-text-muted">
              <Filter className="w-4 h-4" />
            </div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-geo-bg border border-geo-border text-xs text-geo-text-light rounded-sm pl-10 pr-3 py-2.5 focus:border-geo-brand focus:outline-none appearance-none cursor-pointer uppercase tracking-wider"
            >
              <option value="all">Filter: ALL AUDITED TRANSACTIONS</option>
              <option value="deposit">Filter: DEPOSIT INFLOWS ONLY</option>
              <option value="withdrawal">Filter: CASH OUT WITHDRAWALS</option>
              <option value="bet_placed">Filter: STAKED WAGER PLACEMENTS</option>
              <option value="bet_payout">Filter: RESOLVED PAYOUT CREDITS</option>
            </select>
            {/* Chevron picker indicator */}
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-geo-text-muted">
              ▼
            </div>
          </div>
        </div>

        {/* DATA CONTAINER */}
        {loading ? (
          <div className="py-24 text-center">
            <span className="inline-block w-8 h-8 border-4 border-geo-brand border-t-transparent rounded-full animate-spin" />
            <p className="text-xs uppercase font-mono tracking-widest text-geo-text-muted mt-4 font-bold">Querying secure records indexes...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-geo-border rounded-sm">
            <Coins className="w-12 h-12 text-geo-border mx-auto mb-4 stroke-[1.2]" />
            <p className="text-xs font-bold uppercase tracking-wider text-geo-text-muted">No accounting journals resolved.</p>
            <p className="text-[11px] text-geo-text-muted mt-1 leading-relaxed font-semibold max-w-sm mx-auto">
              Confirm your search query keywords or filter categories. Newly registered transaction indices will map here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-geo-border text-[10px] font-mono text-geo-text-muted uppercase font-extrabold tracking-widest bg-geo-bg/50">
                  <th className="py-3 px-4">Timeline Transaction ID</th>
                  <th className="py-3 px-4">Journal Description</th>
                  <th className="py-3 px-4">Settlement Category</th>
                  <th className="py-3 px-4 text-right">Credit Value (NGN)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-geo-border">
                {filteredTransactions.map((tx) => {
                  const isPositive = tx.amount > 0;
                  
                  // Setup type pill visual styles
                  let categoryPill = '';
                  if (tx.type === 'deposit') {
                    categoryPill = 'bg-geo-success/15 border-geo-success/20 text-geo-success';
                  } else if (tx.type === 'withdrawal') {
                    categoryPill = 'bg-red-950/20 border-red-900/30 text-red-400';
                  } else if (tx.type === 'bet_placed') {
                    categoryPill = 'bg-geo-brand/10 border-geo-brand/20 text-geo-brand';
                  } else {
                    categoryPill = 'bg-geo-success/10 border-geo-success/20 text-geo-success';
                  }

                  return (
                    <tr key={tx.id} className="hover:bg-geo-bg/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-extrabold text-geo-text-light">{tx.id.toUpperCase()}</span>
                          <span className="text-[9px] text-geo-text-muted">{tx.createdAt.toLocaleDateString()} {tx.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-sans font-bold text-geo-text-light whitespace-normal min-w-[240px] max-w-md">
                        {tx.description}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[9px] font-black uppercase tracking-wider">
                        <span className={`inline-block px-2.5 py-1 border rounded-sm ${categoryPill}`}>
                          {tx.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-sm">
                        <span className={isPositive ? 'text-geo-success' : 'text-red-400'}>
                          {isPositive ? '+' : ''}₦{tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

    </div>
  );
}
