import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
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
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName: string, phone?: string, dni?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  logout: () => Promise<void>;
  updateRole: (role: 'buyer' | 'organizer' | 'admin' | 'superadmin') => Promise<void>;
  updateUserProfile: (data: { displayName?: string; phone?: string; dni?: string }) => Promise<void>;
  changeEmail: (newEmail: string, currentPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // ======================== FETCH / CREATE PROFILE ========================
  const fetchOrCreateProfile = async (firebaseUser: FirebaseUser) => {
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    const isSuperAdminEmail = firebaseUser.email === 'ridaofrancorg@gmail.com';

    if (userDoc.exists()) {
      const data = userDoc.data() as UserProfile;
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
        phone: '',
        dni: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
      setProfile(newProfile);
    }
  };

  // Check for redirect result on mount (after Google sends user back)
  useEffect(() => {
    getRedirectResult(auth).catch((error) => {
      console.error('[AuthContext] Redirect result error:', error);
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        await fetchOrCreateProfile(firebaseUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ======================== GOOGLE LOGIN ========================
  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
        console.error('Google login failed', error);
      }
      throw error;
    }
  };

  // ======================== EMAIL REGISTER ========================
  const registerWithEmail = async (email: string, password: string, displayName: string, phone?: string, dni?: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Setear el displayName en el perfil de Firebase Auth
      await updateProfile(userCredential.user, { displayName });

      // Enviar email de verificación
      await sendEmailVerification(userCredential.user);

      // El profile se crea automáticamente en onAuthStateChanged,
      // pero como displayName tarda en propagarse, lo forzamos acá
      const newProfile: UserProfile = {
        uid: userCredential.user.uid,
        email: email,
        displayName: displayName,
        photoURL: '',
        role: email === 'ridaofrancorg@gmail.com' ? 'superadmin' : 'buyer',
        suspended: false,
        phone: phone || '',
        dni: dni || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await setDoc(doc(db, 'users', userCredential.user.uid), newProfile);
      setProfile(newProfile);

      await logAction('REGISTER_EMAIL', 'users', userCredential.user.uid, { email });
    } catch (error) {
      console.error('Email registration failed', error);
      throw error;
    }
  };

  // ======================== EMAIL LOGIN ========================
  const loginWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Email login failed', error);
      throw error;
    }
  };

  // ======================== PASSWORD RESET ========================
  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Password reset failed', error);
      throw error;
    }
  };

  // ======================== RESEND VERIFICATION ========================
  const resendVerification = async () => {
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
      } catch (error) {
        console.error('Resend verification failed', error);
        throw error;
      }
    }
  };

  // ======================== LOGOUT ========================
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  // ======================== UPDATE ROLE ========================
  const updateRole = async (newRole: 'buyer' | 'organizer' | 'admin' | 'superadmin') => {
    if (!user || !profile) return;
    try {
      const updatedProfile = { ...profile, role: newRole, updatedAt: new Date() };
      await setDoc(doc(db, 'users', user.uid), updatedProfile);
      setProfile(updatedProfile);
      await logAction('UPDATE_ROLE', 'users', user.uid, { oldRole: profile.role, newRole });
    } catch (error) {
      console.error('Failed to update role', error);
    }
  };

  // ======================== UPDATE USER PROFILE ========================
  const updateUserProfile = async (data: { displayName?: string; phone?: string; dni?: string }) => {
    if (!user || !profile) return;
    try {
      // Si cambió el displayName, actualizarlo también en Firebase Auth
      if (data.displayName && data.displayName !== user.displayName) {
        await updateProfile(user, { displayName: data.displayName });
      }

      const updatedProfile = {
        ...profile,
        ...data,
        updatedAt: new Date(),
      };
      await setDoc(doc(db, 'users', user.uid), updatedProfile);
      setProfile(updatedProfile);

      await logAction('UPDATE_PROFILE', 'users', user.uid, {
        fields: Object.keys(data),
      });
    } catch (error) {
      console.error('Failed to update profile', error);
      throw error;
    }
  };

  // ======================== CHANGE EMAIL ========================
  const changeEmail = async (newEmail: string, currentPassword: string) => {
    if (!user) throw new Error('No user logged in');

    // Solo usuarios con email+password pueden cambiar email.
    // Google users tienen el email atado a su cuenta de Google.
    const emailProvider = user.providerData.find(p => p.providerId === 'password');
    if (!emailProvider) {
      throw new Error('GOOGLE_USER');
    }

    try {
      // Re-autenticar antes de operación sensible
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Cambiar email (Firebase manda verificación al nuevo email)
      await updateEmail(user, newEmail);

      // Actualizar en Firestore
      if (profile) {
        const updatedProfile = { ...profile, email: newEmail, updatedAt: new Date() };
        await setDoc(doc(db, 'users', user.uid), updatedProfile);
        setProfile(updatedProfile);
      }

      // Enviar verificación al nuevo email
      await sendEmailVerification(user);

      await logAction('CHANGE_EMAIL', 'users', user.uid, {
        oldEmail: emailProvider.email,
        newEmail,
      });
    } catch (error: any) {
      console.error('Failed to change email', error);
      throw error;
    }
  };

  // ======================== CHANGE PASSWORD ========================
  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!user) throw new Error('No user logged in');

    const emailProvider = user.providerData.find(p => p.providerId === 'password');
    if (!emailProvider) {
      throw new Error('GOOGLE_USER');
    }

    try {
      // Re-autenticar antes de operación sensible
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Cambiar contraseña
      await updatePassword(user, newPassword);

      await logAction('CHANGE_PASSWORD', 'users', user.uid, {});
    } catch (error: any) {
      console.error('Failed to change password', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        login,
        loginWithEmail,
        registerWithEmail,
        resetPassword,
        resendVerification,
        logout,
        updateRole,
        updateUserProfile,
        changeEmail,
        changePassword,
      }}
    >
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
