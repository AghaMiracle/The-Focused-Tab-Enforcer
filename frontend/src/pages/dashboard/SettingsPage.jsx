import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LuInfo, LuRefreshCw, LuCircleCheck } from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';
import { institutionApi } from '../../utils/api';

// ─── Reusable layout components ───────────────────────────────────────────────
function SettingsSection({ title, children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="rounded-[2rem] p-6 flex flex-col gap-5"
      style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="tech-label pb-3 border-b"
        style={{ color: 'rgba(235,235,235,0.4)', borderColor: 'rgba(255,255,255,0.06)' }}>
        {title}
      </div>
      {children}
    </motion.div>
  );
}

function FieldRow({ label, hint, children }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3">
      <div className="md:w-64 shrink-0">
        <div className="text-sm font-medium text-[#ebebeb]">{label}</div>
        {hint && <div className="text-xs mt-0.5" style={{ color: 'rgba(235,235,235,0.4)' }}>{hint}</div>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function InputField({ value, onChange, placeholder, type = 'text', readOnly = false }) {
  return (
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder} readOnly={readOnly}
      className="w-full px-4 py-2.5 rounded-2xl text-sm text-[#ebebeb] outline-none transition-all"
      style={{
        background: readOnly ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        fontFamily: 'Space Grotesk, sans-serif',
        cursor: readOnly ? 'not-allowed' : 'text',
        opacity: readOnly ? 0.5 : 1,
      }}
      onFocus={(e) => { if (!readOnly) e.target.style.borderColor = 'rgba(204,255,0,0.5)'; }}
      onBlur={(e)  => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
    />
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="relative rounded-full transition-all duration-200 shrink-0"
      style={{ background: checked ? '#ccff00' : 'rgba(255,255,255,0.1)', width: 40, height: 22 }}
      aria-label={label}
    >
      <span className="absolute top-0.5 w-4 h-4 rounded-full bg-black transition-all duration-200"
        style={{ left: checked ? 20 : 2 }} />
    </button>
  );
}

function SaveButton({ onClick, loading, saved, label }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="px-6 py-2.5 rounded-2xl text-sm font-semibold transition-all hover:scale-[1.02] disabled:opacity-60 flex items-center gap-2"
      style={{ backgroundColor: saved ? 'rgba(204,255,0,0.8)' : '#ccff00', color: '#000' }}
      aria-label={label}
    >
      {loading && <LuRefreshCw size={14} className="animate-spin" aria-hidden="true" />}
      {saved && !loading && <LuCircleCheck size={14} aria-hidden="true" />}
      {loading ? 'Saving...' : saved ? 'Saved!' : 'Save'}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuth();

  // ── Institution Profile ──────────────────────────────────────────────────────
  const [profile, setProfile]         = useState({ name: user?.name || '', email: user?.email || '', website: '', address: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaved, setProfileSaved]     = useState(false);
  const [profileError, setProfileError]     = useState('');

  // ── Monitoring Defaults ──────────────────────────────────────────────────────
  const [monitoring, setMonitoring]   = useState({ tabSwitchLimit: 3, faceAbsenceFrames: 30, multipleFaceTolerance: 0, windowBlurSeconds: 10, requireWebcam: true, screenshotOnViolation: false });
  const [monLoading, setMonLoading]   = useState(false);
  const [monSaved, setMonSaved]       = useState(false);
  const [monError, setMonError]       = useState('');

  // ── Notifications ────────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState({ emailOnViolation: true, emailOnSessionEnd: false, inAppAlerts: true, weeklyReport: true, notifyEmail: user?.email || '' });
  const [notifLoading, setNotifLoading]   = useState(false);
  const [notifSaved, setNotifSaved]       = useState(false);
  const [notifError, setNotifError]       = useState('');

  // ── Data Retention ───────────────────────────────────────────────────────────
  const [retention, setRetention]     = useState({ sessionDataDays: 90, violationFrames: 30, autoDelete: false });
  const [retLoading, setRetLoading]   = useState(false);
  const [retSaved, setRetSaved]       = useState(false);
  const [retError, setRetError]       = useState('');

  // ── API Key ──────────────────────────────────────────────────────────────────
  const [apiKey, setApiKey]           = useState('');
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [keyLoading, setKeyLoading]   = useState(false);
  const [keyError, setKeyError]       = useState('');

  // ── Load profile + settings on mount ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [profileData, settingsData] = await Promise.all([
          institutionApi.getProfile(),
          institutionApi.getSettings(),
        ]);
        if (cancelled) return;

        const inst = profileData?.institution ?? profileData;
        setProfile({
          name:    inst.name    || '',
          email:   inst.email   || '',
          website: inst.website || '',
          address: inst.address || '',
        });

        const s = settingsData?.settings ?? settingsData ?? {};
        if (s.monitoringDefaults) {
          setMonitoring((prev) => ({ ...prev, ...s.monitoringDefaults }));
        }
        if (s.notifications) {
          setNotifications((prev) => ({ ...prev, ...s.notifications, notifyEmail: s.notifications.notifyEmail || user?.email || '' }));
        }
        if (s.retention) {
          setRetention((prev) => ({ ...prev, ...s.retention }));
        }
      } catch {
        // silently ignore; form keeps defaults
      }
    })();
    return () => { cancelled = true; };
  }, [user?.email]);

  // ── Save handlers ─────────────────────────────────────────────────────────────
  const saveProfile = async () => {
    setProfileLoading(true);
    setProfileError('');
    try {
      await institutionApi.updateProfile({
        name:    profile.name    || undefined,
        website: profile.website || undefined,
        address: profile.address || undefined,
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (err) {
      setProfileError(err.message || 'Failed to save profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const saveMonitoring = async () => {
    setMonLoading(true);
    setMonError('');
    try {
      await institutionApi.updateSettings({ monitoringDefaults: monitoring });
      setMonSaved(true);
      setTimeout(() => setMonSaved(false), 2500);
    } catch (err) {
      setMonError(err.message || 'Failed to save monitoring defaults.');
    } finally {
      setMonLoading(false);
    }
  };

  const saveNotifications = async () => {
    setNotifLoading(true);
    setNotifError('');
    try {
      await institutionApi.updateSettings({ notifications });
      setNotifSaved(true);
      setTimeout(() => setNotifSaved(false), 2500);
    } catch (err) {
      setNotifError(err.message || 'Failed to save notification preferences.');
    } finally {
      setNotifLoading(false);
    }
  };

  const saveRetention = async () => {
    setRetLoading(true);
    setRetError('');
    try {
      await institutionApi.updateSettings({ retention });
      setRetSaved(true);
      setTimeout(() => setRetSaved(false), 2500);
    } catch (err) {
      setRetError(err.message || 'Failed to save retention policy.');
    } finally {
      setRetLoading(false);
    }
  };

  const copyApiKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey).catch(() => {});
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 2000);
  };

  const rotateApiKey = async () => {
    setKeyLoading(true);
    setKeyError('');
    try {
      const data = await institutionApi.regenerateApiKey();
      setApiKey(data.apiKey || '');
    } catch (err) {
      setKeyError(err.message || 'Failed to rotate key.');
    } finally {
      setKeyLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-[#ebebeb]" style={{ letterSpacing: '-0.03em' }}>Settings</h2>
        <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)' }}>INSTITUTION CONFIGURATION</div>
      </div>

      {/* ── Institution Profile ── */}
      <SettingsSection title="INSTITUTION PROFILE" delay={0}>
        <FieldRow label="Institution Name">
          <InputField value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="Your institution name" />
        </FieldRow>
        <FieldRow label="Admin Email">
          <InputField type="email" value={profile.email} readOnly placeholder="admin@institution.edu" />
        </FieldRow>
        <FieldRow label="Website">
          <InputField value={profile.website} onChange={(e) => setProfile({ ...profile, website: e.target.value })} placeholder="https://institution.edu" />
        </FieldRow>
        <FieldRow label="Address / Country">
          <InputField value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} placeholder="Country or full address" />
        </FieldRow>
        {profileError && (
          <div className="px-4 py-2 rounded-2xl text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }} role="alert">{profileError}</div>
        )}
        <div className="flex justify-end pt-2">
          <SaveButton onClick={saveProfile} loading={profileLoading} saved={profileSaved} label="Save institution profile" />
        </div>
      </SettingsSection>

      {/* ── Global Monitoring Defaults ── */}
      <SettingsSection title="GLOBAL MONITORING DEFAULTS" delay={0.05}>
        <FieldRow label="Tab Switch Limit" hint="Max tab switches before violation is flagged">
          <div className="flex items-center gap-3">
            <input type="range" min={1} max={10} value={monitoring.tabSwitchLimit}
              onChange={(e) => setMonitoring({ ...monitoring, tabSwitchLimit: Number(e.target.value) })}
              className="flex-1 accent-[#ccff00]" aria-label="Tab switch limit" />
            <span className="tech-label w-6 text-center" style={{ color: '#ccff00' }}>{monitoring.tabSwitchLimit}</span>
          </div>
        </FieldRow>
        <FieldRow label="Face Absence Threshold" hint="Consecutive frames without a face before flagging">
          <div className="flex items-center gap-3">
            <input type="range" min={5} max={120} step={5} value={monitoring.faceAbsenceFrames}
              onChange={(e) => setMonitoring({ ...monitoring, faceAbsenceFrames: Number(e.target.value) })}
              className="flex-1 accent-[#ccff00]" aria-label="Face absence threshold" />
            <span className="tech-label w-10 text-center" style={{ color: '#ccff00' }}>{monitoring.faceAbsenceFrames}f</span>
          </div>
        </FieldRow>
        <FieldRow label="Multiple Face Tolerance" hint="Times multiple faces can appear before flagging">
          <div className="flex items-center gap-3">
            <input type="range" min={0} max={5} value={monitoring.multipleFaceTolerance}
              onChange={(e) => setMonitoring({ ...monitoring, multipleFaceTolerance: Number(e.target.value) })}
              className="flex-1 accent-[#ccff00]" aria-label="Multiple face tolerance" />
            <span className="tech-label w-6 text-center" style={{ color: '#ccff00' }}>{monitoring.multipleFaceTolerance}</span>
          </div>
        </FieldRow>
        <FieldRow label="Window Blur Seconds" hint="Seconds before window focus loss triggers a violation">
          <div className="flex items-center gap-3">
            <input type="range" min={3} max={60} value={monitoring.windowBlurSeconds}
              onChange={(e) => setMonitoring({ ...monitoring, windowBlurSeconds: Number(e.target.value) })}
              className="flex-1 accent-[#ccff00]" aria-label="Window blur seconds" />
            <span className="tech-label w-8 text-center" style={{ color: '#ccff00' }}>{monitoring.windowBlurSeconds}s</span>
          </div>
        </FieldRow>
        <FieldRow label="Require Webcam" hint="Block exam start if webcam is unavailable">
          <Toggle checked={monitoring.requireWebcam} onChange={(v) => setMonitoring({ ...monitoring, requireWebcam: v })} label="Toggle require webcam" />
        </FieldRow>
        <FieldRow label="Screenshot on Violation" hint="Capture a privacy-blurred snapshot when a violation occurs">
          <Toggle checked={monitoring.screenshotOnViolation} onChange={(v) => setMonitoring({ ...monitoring, screenshotOnViolation: v })} label="Toggle screenshot on violation" />
        </FieldRow>
        {monError && (
          <div className="px-4 py-2 rounded-2xl text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }} role="alert">{monError}</div>
        )}
        <div className="flex justify-end pt-2">
          <SaveButton onClick={saveMonitoring} loading={monLoading} saved={monSaved} label="Save monitoring defaults" />
        </div>
      </SettingsSection>

      {/* ── Notification Preferences ── */}
      <SettingsSection title="NOTIFICATION PREFERENCES" delay={0.1}>
        <FieldRow label="Email on Violation" hint="Send immediate email alert when a violation is detected">
          <Toggle checked={notifications.emailOnViolation} onChange={(v) => setNotifications({ ...notifications, emailOnViolation: v })} label="Toggle email on violation" />
        </FieldRow>
        <FieldRow label="Email on Session End" hint="Summary email when each exam session completes">
          <Toggle checked={notifications.emailOnSessionEnd} onChange={(v) => setNotifications({ ...notifications, emailOnSessionEnd: v })} label="Toggle email on session end" />
        </FieldRow>
        <FieldRow label="In-App Alerts" hint="Show real-time alerts in the monitoring dashboard">
          <Toggle checked={notifications.inAppAlerts} onChange={(v) => setNotifications({ ...notifications, inAppAlerts: v })} label="Toggle in-app alerts" />
        </FieldRow>
        <FieldRow label="Weekly Summary Report" hint="Receive a weekly digest of all exam activity">
          <Toggle checked={notifications.weeklyReport} onChange={(v) => setNotifications({ ...notifications, weeklyReport: v })} label="Toggle weekly summary report" />
        </FieldRow>
        <FieldRow label="Notification Email">
          <InputField type="email" value={notifications.notifyEmail}
            onChange={(e) => setNotifications({ ...notifications, notifyEmail: e.target.value })}
            placeholder="alerts@institution.edu" />
        </FieldRow>
        {notifError && (
          <div className="px-4 py-2 rounded-2xl text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }} role="alert">{notifError}</div>
        )}
        <div className="flex justify-end pt-2">
          <SaveButton onClick={saveNotifications} loading={notifLoading} saved={notifSaved} label="Save notification preferences" />
        </div>
      </SettingsSection>

      {/* ── Data Retention ── */}
      <SettingsSection title="DATA RETENTION POLICY" delay={0.15}>
        <FieldRow label="Session Data Retention" hint="Days to retain session logs before auto-deletion">
          <div className="flex items-center gap-3">
            <input type="range" min={7} max={365} step={7} value={retention.sessionDataDays}
              onChange={(e) => setRetention({ ...retention, sessionDataDays: Number(e.target.value) })}
              className="flex-1 accent-[#ccff00]" aria-label="Session data retention days" />
            <span className="tech-label w-16 text-center" style={{ color: '#ccff00' }}>{retention.sessionDataDays}d</span>
          </div>
        </FieldRow>
        <FieldRow label="Violation Frame Retention" hint="Days to retain violation snapshot frames">
          <div className="flex items-center gap-3">
            <input type="range" min={7} max={90} step={7} value={retention.violationFrames}
              onChange={(e) => setRetention({ ...retention, violationFrames: Number(e.target.value) })}
              className="flex-1 accent-[#ccff00]" aria-label="Violation frame retention days" />
            <span className="tech-label w-8 text-center" style={{ color: '#ccff00' }}>{retention.violationFrames}d</span>
          </div>
        </FieldRow>
        <FieldRow label="Auto-Delete Expired Data" hint="Automatically purge data beyond retention period">
          <Toggle checked={retention.autoDelete} onChange={(v) => setRetention({ ...retention, autoDelete: v })} label="Toggle auto-delete expired data" />
        </FieldRow>
        {retError && (
          <div className="px-4 py-2 rounded-2xl text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }} role="alert">{retError}</div>
        )}
        <div className="flex justify-end pt-2">
          <SaveButton onClick={saveRetention} loading={retLoading} saved={retSaved} label="Save data retention policy" />
        </div>
      </SettingsSection>

      {/* ── API Keys ── */}
      <SettingsSection title="API KEYS — EXTENSION COMMUNICATION" delay={0.2}>
        <FieldRow label="Live API Key" hint="Used by the browser extension to authenticate session events">
          <div className="flex gap-2">
            <div className="flex-1 px-4 py-2.5 rounded-2xl text-sm font-mono overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(235,235,235,0.6)', fontSize: 12, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
              aria-label="API key value">
              {apiKey || '— Click "Rotate Key" to generate —'}
            </div>
            <button onClick={copyApiKey} disabled={!apiKey}
              className="px-4 py-2.5 rounded-2xl text-sm font-medium transition-all shrink-0 disabled:opacity-40"
              style={{
                background: apiKeyCopied ? 'rgba(204,255,0,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${apiKeyCopied ? 'rgba(204,255,0,0.4)' : 'rgba(255,255,255,0.1)'}`,
                color: apiKeyCopied ? '#ccff00' : 'rgba(235,235,235,0.7)',
              }}
              aria-label="Copy API key">
              {apiKeyCopied ? '✓ Copied' : '⊕ Copy'}
            </button>
          </div>
        </FieldRow>

        <div className="flex items-start gap-3 px-4 py-3 rounded-2xl"
          style={{ background: 'rgba(204,255,0,0.04)', border: '1px solid rgba(204,255,0,0.12)' }} role="note">
          <LuInfo size={16} style={{ color: '#ccff00', shrink: 0, marginTop: 1 }} aria-hidden="true" />
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(235,235,235,0.55)' }}>
            Keep this key confidential. It grants the extension permission to submit session events.
            Rotate immediately if compromised. New keys take effect within 60 seconds.
          </p>
        </div>

        {keyError && (
          <div className="px-4 py-2 rounded-2xl text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }} role="alert">{keyError}</div>
        )}

        <div className="flex justify-end pt-2">
          <button onClick={rotateApiKey} disabled={keyLoading}
            className="px-6 py-2.5 rounded-2xl text-sm font-medium transition-all hover:bg-red-500/10 flex items-center gap-2 disabled:opacity-60"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
            aria-label="Rotate API key">
            <LuRefreshCw size={14} className={keyLoading ? 'animate-spin' : ''} aria-hidden="true" />
            {keyLoading ? 'Rotating...' : 'Rotate Key'}
          </button>
        </div>
      </SettingsSection>
    </div>
  );
}
