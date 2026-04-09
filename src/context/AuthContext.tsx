import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/src/lib/firebase';
import { logAction } from '@/src/services/auditService';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'buyer' | 'organizer' | 'admin' | 'superadmin';
  phone?: string;
  dni?: string;
  suspended?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updateRole: (role: 'buyer' | 'organizer' | 'admin' | 'superadmin') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Fetch or create profile
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        
        // Hardcoded fallback for SuperAdmin
        const isSuperAdminEmail = firebaseUser.email === 'ridaofrancorg@gmail.com';

        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          // If it's the superadmin email but role isn't superadmin, update it
          if (isSuperAdminEmail && data.role !== 'superadmin') {
            const updatedProfile = { ...data, role: 'superadmin' as const };
            await setDoc(doc(db, 'users', firebaseUser.uid), updatedProfile);
            setProfile(updatedProfile);
          } else {
            setProfile(data);
          }
        } else {
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || '',
            role: isSuperAdminEmail ? 'superadmin' : 'buyer',
            suspended: false,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const updateRole = async (newRole: 'buyer' | 'organizer' | 'admin' | 'superadmin') => {
    if (!user || !profile) return;
    try {
      const updatedProfile = { ...profile, role: newRole, updatedAt: new Date() };
      await setDoc(doc(db, 'users', user.uid), updatedProfile);
      setProfile(updatedProfile);
      
      // Log the action
      await logAction('UPDATE_ROLE', 'users', user.uid, { oldRole: profile.role, newRole });
    } catch (error) {
      console.error("Failed to update role", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, updateRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
