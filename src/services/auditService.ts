import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';

export interface AuditLogEntry {
  userId: string;
  userEmail: string;
  action: string;
  target: string;
  targetId: string;
  details: any;
  timestamp: Timestamp;
}

export async function logAction(action: string, target: string, targetId: string, details: any = {}) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const logEntry: AuditLogEntry = {
      userId: user.uid,
      userEmail: user.email || 'unknown',
      action,
      target,
      targetId,
      details,
      timestamp: Timestamp.now()
    };

    await addDoc(collection(db, 'audit_log'), logEntry);
  } catch (error) {
    console.error("Failed to log action", error);
  }
}
