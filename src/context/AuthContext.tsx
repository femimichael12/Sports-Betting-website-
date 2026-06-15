/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User, 
  signInWithPopup, 
  signInAnonymously,
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  serverTimestamp, 
  collection, 
  addDoc 
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType, checkDemoMode } from '../lib/firebase';
import { UserProfile, Transaction } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isDemo: boolean;
  loginWithGoogle: () => Promise<void>;
  loginAnonymously: (customUsername?: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, username: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  adjustBalance: (amount: number, type: 'deposit' | 'withdrawal' | 'bet_placed' | 'bet_payout', description: string) => Promise<void>;
  updateUsername: (newUsername: string) => Promise<void>;
  loginAsDemo: (customUsername?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState<boolean>(() => localStorage.getItem('fembet_demo_mode') === 'true');

  const loadDemoUser = (customUsername?: string) => {
    const mockUser = {
      uid: 'demo_user_123',
      email: 'demo@sportsbook.sim',
      displayName: customUsername || 'Demo Bettor',
      emailVerified: true,
      isAnonymous: true,
    } as any;
    setUser(mockUser);

    const stored = localStorage.getItem('fembet_db_users');
    let users = stored ? JSON.parse(stored) : [];
    let matchProfile = users.find((u: any) => u.userId === 'demo_user_123');
    if (!matchProfile) {
      matchProfile = {
        userId: 'demo_user_123',
        username: customUsername || 'Demo Bettor',
        email: 'demo@sportsbook.sim',
        balance: 1000.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      users.push(matchProfile);
      localStorage.setItem('apex_db_users', JSON.stringify(users));
    } else if (customUsername) {
      matchProfile.username = customUsername;
      localStorage.setItem('apex_db_users', JSON.stringify(users));
    }
    setProfile(matchProfile);
  };

  const loginAsDemo = async (customUsername?: string) => {
    setLoading(true);
    localStorage.setItem('fembet_demo_mode', 'true');
    setIsDemo(true);
    loadDemoUser(customUsername);
    setLoading(false);
  };

  // Helper code to handle /users/{userId} profile fetching / initialization
  const fetchAndSyncProfile = async (firebaseUser: User): Promise<UserProfile | null> => {
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    let userDocSnap;
    
    try {
      userDocSnap = await getDoc(userDocRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
    }

    if (userDocSnap?.exists()) {
      const data = userDocSnap.data();
      const userProfile: UserProfile = {
        userId: data.userId,
        username: data.username,
        email: data.email,
        balance: data.balance,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
      setProfile(userProfile);
      return userProfile;
    } else {
      // Setup a brand new user profile document
      const defaultUsername = firebaseUser.displayName || 
        (firebaseUser.email ? firebaseUser.email.split('@')[0] : `bettor_${Math.floor(1000 + Math.random() * 9000)}`);
      
      const newProfile: UserProfile = {
        userId: firebaseUser.uid,
        username: defaultUsername,
        email: firebaseUser.email || 'guest@sportsbook.sim',
        balance: 1000.0, // Match firestore.rules expected starting value
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(userDocRef, newProfile);
        setProfile(newProfile);
        return newProfile;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${firebaseUser.uid}`);
      }
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    if (localStorage.getItem('apex_demo_mode') === 'true') {
      loadDemoUser();
      return;
    }
    await fetchAndSyncProfile(user);
  };

  // Google Sign In integration (signInWithPopup works smoothly in frames)
  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        localStorage.setItem('apex_demo_mode', 'false');
        setIsDemo(false);
        await fetchAndSyncProfile(result.user);
      }
    } catch (error) {
      console.error('Google Auth login failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Anonymous Login (Guest Bettor Mode)
  const loginAnonymously = async (customUsername?: string) => {
    try {
      setLoading(true);
      const result = await signInAnonymously(auth);
      if (result.user) {
        localStorage.setItem('apex_demo_mode', 'false');
        setIsDemo(false);
        const userDocRef = doc(db, 'users', result.user.uid);
        const usernameStr = customUsername && customUsername.trim().length >= 3 
          ? customUsername.trim().substring(0, 32)
          : `guest_${Math.floor(1000 + Math.random() * 9000)}`;

        const newProfile: UserProfile = {
          userId: result.user.uid,
          username: usernameStr,
          email: 'guest@sportsbook.sim',
          balance: 1000.0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        try {
          await setDoc(userDocRef, newProfile);
          setProfile(newProfile);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `users/${result.user.uid}`);
        }
      }
    } catch (error: any) {
      console.error('Guest login failed:', error);
      const errCode = error?.code || '';
      const errMsg = error?.message || '';
      if (
        errCode === 'auth/admin-restricted-operation' || 
        errCode === 'auth/configuration-not-found' ||
        errMsg.includes('admin-restricted-operation') ||
        errMsg.includes('configuration-not-found')
      ) {
        throw new Error("Anonymous Authentication (Guest Mode) is not enabled under Build > Authentication in your Firebase project console. To resolve this instantly, please tap the button below to continue in Offline Demo Mode, enable the Anonymous provider inside your project's Firebase Console, or sign in via Google.");
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async (email: string, password: string, username: string) => {
    try {
      setLoading(true);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (result.user) {
        const userDocRef = doc(db, 'users', result.user.uid);
        const newProfile: UserProfile = {
          userId: result.user.uid,
          username: username.trim() || email.split('@')[0],
          email: email,
          balance: 1000.0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        try {
          await setDoc(userDocRef, newProfile);
          setProfile(newProfile);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `users/${result.user.uid}`);
        }

        try {
          await sendEmailVerification(result.user);
        } catch (verificationError) {
          console.warn('Verification email send failed on registration:', verificationError);
        }
      }
    } catch (error: any) {
      console.error('Registration failed:', error);
      if (error?.code === 'auth/operation-not-allowed' || error?.message?.includes('operation-not-allowed')) {
        throw new Error("Email/Password Authentication is not enabled in your Firebase project. To register, please enable the 'Email/Password' sign-in provider under the Build > Authentication > Sign-in method tab in your Firebase Console.");
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    try {
      setLoading(true);
      const result = await signInWithEmailAndPassword(auth, email, password);
      if (result.user) {
        await fetchAndSyncProfile(result.user);
      }
    } catch (error: any) {
      console.error('Email login failed:', error);
      if (error?.code === 'auth/operation-not-allowed' || error?.message?.includes('operation-not-allowed')) {
        throw new Error("Email/Password Authentication is not enabled in your Firebase project. To use Email login, please enable the 'Email/Password' sign-in provider under the Build > Authentication > Sign-in method tab in your Firebase Console.");
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Password reset request failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendVerificationEmail = async () => {
    try {
      if (!auth.currentUser) throw new Error("No user is currently authenticated");
      await sendEmailVerification(auth.currentUser);
    } catch (error) {
      console.error('Email verification send failed:', error);
      throw error;
    }
  };

  const refreshUser = async () => {
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        setUser(auth.currentUser);
        await fetchAndSyncProfile(auth.currentUser);
      }
    } catch (error) {
      console.error('Error refreshing auth user:', error);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      if (localStorage.getItem('apex_demo_mode') === 'true') {
        localStorage.setItem('apex_demo_mode', 'false');
        setIsDemo(false);
      } else {
        await signOut(auth);
      }
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Adjusts user profile Balance and writes a corresponding Ledger Transaction log
  const adjustBalance = async (
    amount: number, 
    type: 'deposit' | 'withdrawal' | 'bet_placed' | 'bet_payout', 
    description: string
  ) => {
    if (!user || !profile) return;

    const newBalance = Number((profile.balance + amount).toFixed(2));
    if (newBalance < 0) {
      throw new Error("Insufficient funds for this transaction");
    }

    // 1. Write the transaction entry in /transactions
    const transId = `tx_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const txRef = doc(db, 'transactions', transId);
    const txData: Transaction = {
      id: transId,
      userId: user.uid,
      amount,
      type,
      description,
      createdAt: serverTimestamp()
    };

    try {
      await setDoc(txRef, txData);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `transactions/${transId}`);
    }

    // 2. Update the user collection balance
    const userDocRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(userDocRef, {
        balance: newBalance,
        updatedAt: serverTimestamp()
      });
      
      // Update local React state coordinates
      setProfile(prev => prev ? { ...prev, balance: newBalance } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const updateUsername = async (newUsername: string) => {
    if (!user || !profile) return;
    const name = newUsername.trim();
    if (name.length < 3 || name.length > 32) {
      throw new Error("Username must be between 3 and 32 characters");
    }

    const userDocRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(userDocRef, {
        username: name,
        updatedAt: serverTimestamp()
      });
      setProfile(prev => prev ? { ...prev, username: name } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        localStorage.setItem('apex_demo_mode', 'false');
        setIsDemo(false);
        setUser(firebaseUser);
        await fetchAndSyncProfile(firebaseUser);
      } else {
        if (localStorage.getItem('fembet_demo_mode') === 'true') {
          setIsDemo(true);
          loadDemoUser();
        } else {
          setIsDemo(false);
          setUser(null);
          setProfile(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isDemo,
      loginWithGoogle,
      loginAnonymously,
      registerWithEmail,
      loginWithEmail,
      sendPasswordReset,
      sendVerificationEmail,
      refreshUser,
      logout,
      refreshProfile,
      adjustBalance,
      updateUsername,
      loginAsDemo
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
