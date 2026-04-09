import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, LogOut, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { db } from '@/src/lib/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { Card } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { seedEventsIfMissing } from '@/src/services/eventService';

interface PlatformSettings {
  commissionRate: number;
  minimumTicketFee: number;
  platformName: string;
  supportEmail: string;
}

interface AuditLogEntry {
  id: string;
  user: string;
  action: string;
  target: string;
  timestamp: any;
}

export default function PlatformConfig() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings>({
    commissionRate: 5,
    minimumTicketFee: 50,
    platformName: 'ENTRA',
    supportEmail: 'support@entra.com',
  });
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seedingEvents, setSeedingEvents] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [seedStatus, setSeedStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [formChanged, setFormChanged] = useState(false);

  // Check authorization - only superadmin
  if (!user || user.email !== 'ridaofrancorg@gmail.com') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Card className="glass border-orange-500/20 p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <p className="text-red-400 font-semibold">Unauthorized Access</p>
          </div>
          <p className="text-slate-300 text-sm">
            This page is restricted to superadmin accounts only.
          </p>
        </Card>
      </div>
    );
  }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch platform settings
      try {
        const settingsDoc = await getDocs(
          query(collection(db, 'platform_config'))
        );
        if (!settingsDoc.empty) {
          const settingsData = settingsDoc.docs[0].data();
          setSettings((prev) => ({
            ...prev,
            ...settingsData,
          }));
        }
      } catch (err) {
        console.log('Platform config not found, using defaults');
      }

      // Fetch audit log
      try {
        const auditSnapshot = await getDocs(
          query(
            collection(db, 'audit_log'),
            orderBy('timestamp', 'desc'),
            limit(20)
          )
        );
        const auditData: AuditLogEntry[] = [];
        auditSnapshot.forEach((docSnap) => {
          auditData.push({
            id: docSnap.id,
            ...docSnap.data(),
          } as AuditLogEntry);
        });
        setAuditLog(auditData);
      } catch (err) {
        console.log('Audit log not available');
      }
    } catch (error) {
      console.error('Error fetching config data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key: keyof PlatformSettings, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [key]: key === 'commissionRate' || key === 'minimumTicketFee' ? parseFloat(value) : value,
    }));
    setFormChanged(true);
    setSaveStatus('idle');
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setSaveStatus('idle');

      await setDoc(doc(db, 'platform_config', 'settings'), settings);

      setSaveStatus('success');
      setFormChanged(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleSeedEvents = async () => {
    try {
      setSeedingEvents(true);
      setSeedStatus('idle');

      await seedEventsIfMissing();

      setSeedStatus('success');
      setTimeout(() => setSeedStatus('idle'), 3000);
    } catch (error) {
      console.error('Error seeding events:', error);
      setSeedStatus('error');
    } finally {
      setSeedingEvents(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Loader className="w-12 h-12 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-8 h-8 text-orange-500" />
          <h1 className="font-heading text-4xl orange-text-gradient">Platform Configuration</h1>
        </div>
        <p className="text-slate-400">Superadmin settings and platform management</p>
      </motion.div>

      {/* Platform Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <Card className="glass border-orange-500/20 p-6 md:p-8">
          <h2 className="font-heading text-2xl orange-text-gradient mb-6">Platform Settings</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Commission Rate */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Commission Rate (%)
              </label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings.commissionRate}
                onChange={(e) => handleSettingChange('commissionRate', e.target.value)}
                className="w-full bg-slate-800/50 border border-orange-500/30 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
              />
              <p className="text-xs text-slate-500 mt-1">
                Platform commission on each ticket sale
              </p>
            </div>

            {/* Minimum Ticket Fee */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Minimum Ticket Fee (ARS)
              </label>
              <Input
                type="number"
                min="0"
                step="1"
                value={settings.minimumTicketFee}
                onChange={(e) => handleSettingChange('minimumTicketFee', e.target.value)}
                className="w-full bg-slate-800/50 border border-orange-500/30 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
              />
              <p className="text-xs text-slate-500 mt-1">
                Minimum fee per ticket transaction
              </p>
            </div>

            {/* Platform Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Platform Name
              </label>
              <Input
                type="text"
                value={settings.platformName}
                onChange={(e) => handleSettingChange('platformName', e.target.value)}
                className="w-full bg-slate-800/50 border border-orange-500/30 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
              />
              <p className="text-xs text-slate-500 mt-1">
                Platform display name
              </p>
            </div>

            {/* Support Email */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Support Email
              </label>
              <Input
                type="email"
                value={settings.supportEmail}
                onChange={(e) => handleSettingChange('supportEmail', e.target.value)}
                className="w-full bg-slate-800/50 border border-orange-500/30 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
              />
              <p className="text-xs text-slate-500 mt-1">
                Contact email for user support
              </p>
            </div>
          </div>

          {/* Save Button with Status */}
          <div className="flex items-center gap-4">
            <Button
              onClick={handleSaveSettings}
              disabled={!formChanged || saving}
              className="bg-orange-gradient hover:opacity-90 disabled:opacity-50 text-white font-semibold px-6 py-2 rounded-lg transition"
            >
              {saving ? (
                <>
                  <Loader className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
            {saveStatus === 'success' && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-green-400"
              >
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm">Saved successfully</span>
              </motion.div>
            )}
            {saveStatus === 'error' && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-red-400"
              >
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">Error saving settings</span>
              </motion.div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Demo Events Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <Card className="glass border-orange-500/20 p-6 md:p-8">
          <h2 className="font-heading text-2xl orange-text-gradient mb-4">Demo Events</h2>
          <p className="text-slate-400 mb-6">
            Seed the platform with demo events if none exist. This is useful for testing and demonstrations.
          </p>

          <div className="flex items-center gap-4">
            <Button
              onClick={handleSeedEvents}
              disabled={seedingEvents}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 disabled:opacity-50 text-white font-semibold px-6 py-2 rounded-lg transition"
            >
              {seedingEvents ? (
                <>
                  <Loader className="w-4 h-4 animate-spin mr-2" />
                  Seeding...
                </>
              ) : (
                'Seed Demo Events'
              )}
            </Button>
            {seedStatus === 'success' && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-green-400"
              >
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm">Demo events created</span>
              </motion.div>
            )}
            {seedStatus === 'error' && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-red-400"
              >
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">Error seeding events</span>
              </motion.div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Audit Log */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="glass border-orange-500/20 p-6 md:p-8">
          <h2 className="font-heading text-2xl orange-text-gradient mb-6">Audit Log</h2>
          {auditLog.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No audit log entries yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orange-500/20">
                    <th className="text-left py-3 px-4 text-slate-400 font-semibold">User</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-semibold">Action</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-semibold">Target</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-semibold">Date & Time</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/20 transition"
                    >
                      <td className="py-3 px-4 text-slate-200">{entry.user}</td>
                      <td className="py-3 px-4 text-slate-300 font-medium">{entry.action}</td>
                      <td className="py-3 px-4 text-slate-400">{entry.target}</td>
                      <td className="py-3 px-4 text-slate-400">
                        {entry.timestamp?.toDate?.()?.toLocaleString() || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
