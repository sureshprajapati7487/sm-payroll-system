import { useState, useEffect } from 'react';
import { Shield, Plus, X, Clock, Eye, LogOut } from 'lucide-react';
import { useAuditStore } from '@/store/auditStore';

export const SecuritySettings = () => {
    const { ipRestrictions, sessions, addIPRestriction, removeIPRestriction, fetchSessions, fetchIPRestrictions, revokeSession } = useAuditStore();
    const [newIP, setNewIP] = useState('');
    const [ipDescription, setIpDescription] = useState('');

    useEffect(() => {
        fetchSessions();
        fetchIPRestrictions();
    }, [fetchSessions, fetchIPRestrictions]);

    const handleAddIP = () => {
        if (!newIP) return;
        addIPRestriction({
            ipAddress: newIP,
            description: ipDescription,
            isWhitelisted: true,
            createdBy: 'current-user'
        });
        setNewIP('');
        setIpDescription('');
    };

    const activeSessions = sessions.filter(s => s.isActive);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Shield className="w-8 h-8 text-primary-500" />
                    Security Settings
                </h1>
                <p className="text-dark-muted mt-1">Manage IP restrictions, sessions, and data masking</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* IP Whitelist */}
                <div className="glass rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">IP Whitelist</h3>

                    {/* Add IP Form */}
                    <div className="space-y-3 mb-4">
                        <input
                            type="text"
                            value={newIP}
                            onChange={(e) => setNewIP(e.target.value)}
                            placeholder="IP Address (e.g., 192.168.1.100)"
                            className="w-full bg-dark-surface border border-dark-border rounded-lg px-4 py-2 text-white"
                        />
                        <input
                            type="text"
                            value={ipDescription}
                            onChange={(e) => setIpDescription(e.target.value)}
                            placeholder="Description (e.g., Office Network)"
                            className="w-full bg-dark-surface border border-dark-border rounded-lg px-4 py-2 text-white"
                        />
                        <button
                            onClick={handleAddIP}
                            className="w-full flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Add IP Address
                        </button>
                    </div>

                    {/* IP List */}
                    <div className="space-y-2">
                        {ipRestrictions.length === 0 ? (
                            <div className="text-center py-8 text-dark-muted text-sm">
                                No IP restrictions configured<br />
                                All IPs are allowed
                            </div>
                        ) : (
                            ipRestrictions.map((ip) => (
                                <div key={ip.id} className="flex items-center justify-between bg-dark-surface rounded-lg p-3">
                                    <div>
                                        <div className="text-white font-medium">{ip.ipAddress}</div>
                                        <div className="text-dark-muted text-xs">{ip.description}</div>
                                    </div>
                                    <button
                                        onClick={() => removeIPRestriction(ip.id)}
                                        className="text-red-400 hover:text-red-300 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Active Sessions */}
                <div className="glass rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">
                        Active Sessions ({activeSessions.length})
                    </h3>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {activeSessions.length === 0 ? (
                            <div className="text-center py-8 text-dark-muted text-sm">
                                No active sessions
                            </div>
                        ) : (
                            activeSessions.map((session) => (
                                <div key={session.id} className="bg-dark-surface rounded-lg p-3 text-sm flex justify-between items-center group">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="text-white font-medium">User ID: {session.userId}</div>
                                            <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">
                                                Active
                                            </span>
                                        </div>
                                        <div className="text-dark-muted text-xs space-y-1">
                                            <div>Login: {new Date(session.loginTime).toLocaleString()}</div>
                                            <div>Last Activity: {new Date(session.lastActivity).toLocaleString()}</div>
                                            <div>IP: {session.ipAddress}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => revokeSession(session.id)}
                                        className="text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 p-2 rounded opacity-0 group-hover:opacity-100 transition-all ml-4"
                                        title="Revoke session (Force Logout)"
                                    >
                                        <LogOut className="w-4 h-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Session Settings */}
                <div className="glass rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        Session Timeout
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-dark-muted mb-2">
                                Auto-logout after inactivity
                            </label>
                            <select className="w-full bg-dark-surface border border-dark-border rounded-lg px-4 py-2 text-white">
                                <option value="15">15 minutes</option>
                                <option value="30" selected>30 minutes</option>
                                <option value="60">1 hour</option>
                                <option value="120">2 hours</option>
                                <option value="0">Never</option>
                            </select>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-dark-surface rounded-lg">
                            <div>
                                <div className="text-white text-sm font-medium">Concurrent Sessions</div>
                                <div className="text-dark-muted text-xs">Allow multiple devices</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" defaultChecked />
                                <div className="w-11 h-6 bg-dark-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Data Masking */}
                <div className="glass rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Eye className="w-5 h-5" />
                        Data Masking Rules
                    </h3>

                    <div className="space-y-3">
                        {[
                            { field: 'Bank Account', enabled: true },
                            { field: 'Aadhaar Number', enabled: true },
                            { field: 'PAN Number', enabled: true },
                            { field: 'Phone Number', enabled: false },
                            { field: 'Email Address', enabled: false },
                            { field: 'Salary Amount', enabled: true }
                        ].map((rule) => (
                            <div key={rule.field} className="flex items-center justify-between p-3 bg-dark-surface rounded-lg">
                                <div>
                                    <div className="text-white text-sm">{rule.field}</div>
                                    <div className="text-dark-muted text-xs">
                                        {rule.enabled ? 'Masked for non-admin users' : 'Visible to all'}
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" defaultChecked={rule.enabled} />
                                    <div className="w-11 h-6 bg-dark-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                                </label>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <div className="text-xs text-blue-400">
                            ℹ️ Masked data is only visible to SUPER_ADMIN and ADMIN roles
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
