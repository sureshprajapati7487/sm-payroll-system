// NotificationSettings — Admin page for WhatsApp + Browser notification config
import { useState, useEffect } from 'react';
import {
    MessageSquare, Settings, CheckCircle, XCircle, AlertTriangle,
    Send, Eye, EyeOff, Loader2, Bell, Smartphone, Info
} from 'lucide-react';
import { API_URL } from '@/lib/apiConfig';

interface WAConfig {
    enabled: boolean;
    phoneNumberId: string;
    wabaToken: string;
    businessName: string;
}

const DEFAULT_CONFIG: WAConfig = { enabled: false, phoneNumberId: '', wabaToken: '', businessName: '' };

export const NotificationSettings = () => {
    const [config, setConfig] = useState<WAConfig>(DEFAULT_CONFIG);
    const [showToken, setShowToken] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testPhone, setTestPhone] = useState('');
    const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
    const [browserPerm, setBrowserPerm] = useState<NotificationPermission>('default');

    const showToast = (type: 'ok' | 'err', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 4000);
    };

    useEffect(() => {
        if ('Notification' in window) setBrowserPerm(Notification.permission);
        fetch(`${API_URL}/whatsapp/config`)
            .then(r => r.json())
            .then(d => setConfig(d))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/whatsapp/config`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            const data = await res.json();
            if (res.ok) showToast('ok', 'Configuration saved!');
            else showToast('err', data.error || 'Save failed');
        } catch { showToast('err', 'Server unreachable'); }
        setSaving(false);
    };

    const handleTest = async () => {
        if (!testPhone) { showToast('err', 'Enter a phone number'); return; }
        setTesting(true);
        try {
            const res = await fetch(`${API_URL}/whatsapp/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: testPhone }),
            });
            const data = await res.json();
            if (res.ok) showToast('ok', `Test message sent! ID: ${data.messageId || 'N/A'}`);
            else showToast('err', data.error || 'Test failed');
        } catch { showToast('err', 'Server unreachable'); }
        setTesting(false);
    };

    const requestBrowserPermission = async () => {
        if (!('Notification' in window)) { showToast('err', 'Browser does not support notifications'); return; }
        const perm = await Notification.requestPermission();
        setBrowserPerm(perm);
        if (perm === 'granted') showToast('ok', 'Browser notifications enabled!');
        else showToast('err', 'Permission denied');
    };

    if (loading) return (
        <div className="flex items-center justify-center p-16">
            <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
        </div>
    );

    return (
        <div className="p-6 space-y-6 max-w-3xl">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium transition-all
                    ${toast.type === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    {toast.type === 'ok' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {toast.msg}
                </div>
            )}

            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <MessageSquare className="w-8 h-8 text-green-400" />
                    Notification Settings
                </h1>
                <p className="text-dark-muted mt-1">Configure WhatsApp Business and browser notifications</p>
            </div>

            {/* ── WhatsApp Config ─────────────────────────────────────────── */}
            <div className="glass rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                            <Smartphone className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <h2 className="text-white font-semibold">WhatsApp Business API</h2>
                            <p className="text-xs text-slate-500">Meta Cloud API (WABA)</p>
                        </div>
                    </div>
                    {/* Enable toggle */}
                    <button onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))}
                        className={`relative w-12 h-6 rounded-full transition-colors ${config.enabled ? 'bg-green-500' : 'bg-slate-600'}`}>
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${config.enabled ? 'left-7' : 'left-1'}`} />
                    </button>
                </div>

                {/* Status badge */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium w-fit
                    ${config.enabled && config.phoneNumberId && config.wabaToken !== ''
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
                    {config.enabled && config.phoneNumberId ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    {config.enabled && config.phoneNumberId ? 'Configured & Active' : 'Not configured — fill in details below'}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1.5">Business Name</label>
                        <input value={config.businessName} onChange={e => setConfig(c => ({ ...c, businessName: e.target.value }))}
                            placeholder="SM Industries"
                            className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2.5 text-white text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1.5">Phone Number ID</label>
                        <input value={config.phoneNumberId} onChange={e => setConfig(c => ({ ...c, phoneNumberId: e.target.value }))}
                            placeholder="123456789012345"
                            className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2.5 text-white text-sm font-mono" />
                    </div>
                </div>

                <div>
                    <label className="block text-xs text-slate-400 mb-1.5">WABA Access Token (Bearer)</label>
                    <div className="relative">
                        <input value={config.wabaToken}
                            type={showToken ? 'text' : 'password'}
                            onChange={e => setConfig(c => ({ ...c, wabaToken: e.target.value }))}
                            placeholder="EAA..."
                            className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2.5 text-white text-sm font-mono pr-12" />
                        <button onClick={() => setShowToken(s => !s)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                            {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                        <Info className="w-3 h-3" /> Token stored on your server only — never sent to browser
                    </p>
                </div>

                <div className="flex gap-3">
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                        Save Config
                    </button>
                </div>
            </div>

            {/* ── Test Message ────────────────────────────────────────────── */}
            <div className="glass rounded-2xl p-6 space-y-4">
                <h2 className="text-white font-semibold flex items-center gap-2">
                    <Send className="w-5 h-5 text-blue-400" /> Send Test Message
                </h2>
                <div className="flex gap-3">
                    <input value={testPhone} onChange={e => setTestPhone(e.target.value)}
                        placeholder="9876543210"
                        className="flex-1 bg-dark-surface border border-dark-border rounded-xl px-4 py-2.5 text-white text-sm" />
                    <button onClick={handleTest} disabled={testing || !config.enabled}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-colors">
                        {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Send
                    </button>
                </div>
                {!config.enabled && (
                    <p className="text-xs text-yellow-400">Enable WhatsApp above and save config before testing.</p>
                )}
            </div>

            {/* ── Browser Notifications ───────────────────────────────────── */}
            <div className="glass rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-white font-semibold flex items-center gap-2">
                        <Bell className="w-5 h-5 text-primary-400" /> Browser Notifications
                    </h2>
                    <span className={`text-xs px-2 py-1 rounded-lg font-medium ${browserPerm === 'granted' ? 'bg-green-500/10 text-green-400' :
                        browserPerm === 'denied' ? 'bg-red-500/10 text-red-400' :
                            'bg-yellow-500/10 text-yellow-400'}`}>
                        {browserPerm === 'granted' ? 'Enabled' : browserPerm === 'denied' ? 'Blocked' : 'Not requested'}
                    </span>
                </div>
                {browserPerm !== 'granted' ? (
                    <button onClick={requestBrowserPermission} disabled={browserPerm === 'denied'}
                        className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-semibold">
                        <Bell className="w-4 h-4" /> Enable Browser Notifications
                    </button>
                ) : (
                    <p className="text-green-400 text-sm flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> Browser notifications are active
                    </p>
                )}
                {browserPerm === 'denied' && (
                    <p className="text-xs text-red-400">Permission denied. Go to browser site settings → Notifications → Allow.</p>
                )}
            </div>

            {/* ── Event Triggers Info ─────────────────────────────────────── */}
            <div className="glass rounded-2xl p-6 space-y-3">
                <h2 className="text-white font-semibold">Automatic Notification Triggers</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                        { event: 'Loan Request', desc: 'Admin notified when employee applies', icon: '🔔' },
                        { event: 'Loan Approved/Rejected', desc: 'Employee notified on decision', icon: '💵' },
                        { event: 'Leave Approved/Rejected', desc: 'Employee notified on decision', icon: '📅' },
                        { event: 'Payslip Generated', desc: 'Employee notified when salary slip ready', icon: '📄' },
                        { event: 'Punch Reminder', desc: 'Manual send from attendance page', icon: '⏰' },
                        { event: 'Custom Message', desc: 'Send any custom message to any employee', icon: '💬' },
                    ].map(row => (
                        <div key={row.event} className="flex items-start gap-2.5 p-3 bg-dark-surface rounded-xl">
                            <span className="text-lg">{row.icon}</span>
                            <div>
                                <p className="text-white text-sm font-medium">{row.event}</p>
                                <p className="text-xs text-slate-500">{row.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300">
                    <strong>How to get WABA credentials:</strong> Go to{' '}
                    <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="underline">
                        developers.facebook.com
                    </a>{' '}
                    → Your App → WhatsApp → API Setup → copy Phone Number ID and generate a token.
                </div>
            </div>
        </div>
    );
};
