import { useState } from 'react';
import { AlertTriangle, Shield, User, Clock, CheckCircle, Eye, XCircle, Trash2, CheckCheck, Filter } from 'lucide-react';
import { useSecurityAlertsStore, SecurityAlert, SecurityAlertType } from '@/store/securityAlertsStore';

export const SecurityAlerts = () => {
    const { alerts, markAsRead, acknowledgeAlert, acknowledgeAll, deleteAlert, getUnreadCount, getCriticalCount } = useSecurityAlertsStore();
    const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
    const [selectedType, setSelectedType] = useState<SecurityAlertType | 'all'>('all');
    const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);

    const filteredAlerts = alerts.filter(a => {
        const matchSeverity = selectedSeverity === 'all' || a.severity === selectedSeverity;
        const matchType = selectedType === 'all' || a.type === selectedType;
        return matchSeverity && matchType;
    });

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'text-red-400 bg-red-500/20 border-red-500/30';
            case 'high': return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
            case 'medium': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
            case 'low': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
            default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
        }
    };

    const getAlertIcon = (type: string) => {
        switch (type) {
            case 'god_mode_enabled': return '👑';
            case 'permission_escalation': return '🔐';
            case 'role_change': return '👤';
            case 'salary_access': return '💰';
            case 'bulk_delete': return '🗑️';
            case 'security_setting_change': return '⚙️';
            case 'failed_login': return '🚫';
            case 'suspicious_ip': return '🌐';
            case 'permission_denied': return '🚫';
            case 'access_denied': return '🛑';
            case 'data_export': return '📤';
            default: return '⚠️';
        }
    };

    const ALERT_TYPES: { value: SecurityAlertType | 'all', label: string }[] = [
        { value: 'all', label: 'All Event Types' },
        { value: 'god_mode_enabled', label: 'God Mode' },
        { value: 'role_change', label: 'Role Changes' },
        { value: 'permission_escalation', label: 'Permission Escalation' },
        { value: 'permission_denied', label: 'Permission Denied' },
        { value: 'failed_login', label: 'Failed Logins' },
        { value: 'data_export', label: 'Data Exports' },
        { value: 'salary_access', label: 'Salary Data Access' },
        { value: 'bulk_delete', label: 'Bulk Deletes' },
    ];

    const handleAlertClick = (alert: SecurityAlert) => {
        setSelectedAlert(alert);
        if (!alert.isRead) {
            markAsRead(alert.id);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Shield className="w-8 h-8 text-primary-500" />
                        Security Alerts
                    </h1>
                    <p className="text-dark-muted mt-1">Monitor critical system events and admin actions</p>
                </div>
                {alerts.some(a => !a.isAcknowledged) && (
                    <button
                        onClick={() => acknowledgeAll()}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-medium rounded-xl shadow-lg transition-all"
                    >
                        <CheckCheck className="w-4 h-4" />
                        Acknowledge All
                    </button>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass p-6 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-dark-muted text-sm">Unread Alerts</div>
                            <div className="text-3xl font-bold text-white mt-1">{getUnreadCount()}</div>
                        </div>
                        <div className="p-3 bg-blue-500/20 rounded-xl">
                            <Eye className="w-6 h-6 text-blue-400" />
                        </div>
                    </div>
                </div>

                <div className="glass p-6 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-dark-muted text-sm">Critical Alerts</div>
                            <div className="text-3xl font-bold text-red-400 mt-1">{getCriticalCount()}</div>
                        </div>
                        <div className="p-3 bg-red-500/20 rounded-xl">
                            <AlertTriangle className="w-6 h-6 text-red-400" />
                        </div>
                    </div>
                </div>

                <div className="glass p-6 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-dark-muted text-sm">Total Alerts (30d)</div>
                            <div className="text-3xl font-bold text-white mt-1">{alerts.length}</div>
                        </div>
                        <div className="p-3 bg-primary-500/20 rounded-xl">
                            <Shield className="w-6 h-6 text-primary-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="glass rounded-2xl p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="flex gap-2 flex-wrap">
                    {['all', 'critical', 'high', 'medium', 'low'].map(severity => (
                        <button
                            key={severity}
                            onClick={() => setSelectedSeverity(severity)}
                            className={`px-4 py-2 rounded-lg transition-all text-sm font-medium ${selectedSeverity === severity
                                ? 'bg-primary-500 text-white'
                                : 'bg-dark-surface text-dark-muted hover:bg-white/5'
                                }`}
                        >
                            {severity.charAt(0).toUpperCase() + severity.slice(1)}
                        </button>
                    ))}
                </div>

                <div className="relative min-w-[200px]">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <Filter className="h-4 w-4 text-dark-muted" />
                    </div>
                    <select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value as any)}
                        className="form-select w-full bg-dark-bg border border-dark-border rounded-xl pl-10 pr-10 py-2.5 text-dark-text text-sm focus:border-primary-500 hover:border-dark-border/80 transition-colors"
                    >
                        {ALERT_TYPES.map(type => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Alerts List */}
            <div className="glass rounded-2xl overflow-hidden">
                <div className="max-h-[600px] overflow-y-auto">
                    {filteredAlerts.length === 0 ? (
                        <div className="p-12 text-center text-dark-muted">
                            <Shield className="w-16 h-16 mx-auto mb-4 opacity-20" />
                            <div className="text-lg">No alerts found</div>
                            <div className="text-sm mt-2">System is secure and running smoothly</div>
                        </div>
                    ) : (
                        <div className="divide-y divide-dark-border">
                            {filteredAlerts.map(alert => (
                                <div
                                    key={alert.id}
                                    onClick={() => handleAlertClick(alert)}
                                    className={`p-4 cursor-pointer transition-all hover:bg-white/5 ${!alert.isRead ? 'bg-primary-500/5' : ''
                                        }`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="text-3xl">{getAlertIcon(alert.type)}</div>

                                        <div className="flex-1 min-w-0 group">
                                            <div className="flex items-start justify-between gap-4 mb-2">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="text-white font-semibold">{alert.title}</h3>
                                                        {!alert.isRead && (
                                                            <div className="w-2 h-2 bg-primary-500 rounded-full" />
                                                        )}
                                                    </div>
                                                    <p className="text-dark-muted text-sm">{alert.description}</p>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider border ${getSeverityColor(alert.severity)}`}>
                                                        {alert.severity.toUpperCase()}
                                                    </span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteAlert(alert.id);
                                                            if (selectedAlert?.id === alert.id) setSelectedAlert(null);
                                                        }}
                                                        className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-all"
                                                        title="Delete Alert"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 text-xs text-dark-muted">
                                                <div className="flex items-center gap-1">
                                                    <User className="w-3 h-3" />
                                                    {alert.userName}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(alert.timestamp).toLocaleString()}
                                                </div>
                                                {alert.ipAddress && (
                                                    <div className="flex items-center gap-1">
                                                        🌐 {alert.ipAddress}
                                                    </div>
                                                )}
                                            </div>

                                            {alert.isAcknowledged && (
                                                <div className="mt-2 flex items-center gap-2 text-xs text-green-400">
                                                    <CheckCircle className="w-4 h-4" />
                                                    Acknowledged
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Detail Modal */}
            {selectedAlert && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
                    <div className="glass rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="text-4xl">{getAlertIcon(selectedAlert.type)}</div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-white">{selectedAlert.title}</h2>
                                        <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium border ${getSeverityColor(selectedAlert.severity)}`}>
                                            {selectedAlert.severity.toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedAlert(null)}
                                    className="p-2 hover:bg-white/5 rounded-lg transition-all"
                                >
                                    <XCircle className="w-6 h-6 text-dark-muted" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 bg-dark-surface rounded-xl">
                                    <div className="text-sm text-dark-muted mb-2">Description</div>
                                    <div className="text-white">{selectedAlert.description}</div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-dark-surface rounded-xl">
                                        <div className="text-sm text-dark-muted mb-2">User</div>
                                        <div className="text-white">{selectedAlert.userName}</div>
                                    </div>
                                    <div className="p-4 bg-dark-surface rounded-xl">
                                        <div className="text-sm text-dark-muted mb-2">Timestamp</div>
                                        <div className="text-white">{new Date(selectedAlert.timestamp).toLocaleString()}</div>
                                    </div>
                                </div>

                                {selectedAlert.ipAddress && (
                                    <div className="p-4 bg-dark-surface rounded-xl">
                                        <div className="text-sm text-dark-muted mb-2">IP Address</div>
                                        <div className="text-white font-mono">{selectedAlert.ipAddress}</div>
                                    </div>
                                )}

                                {selectedAlert.metadata && Object.keys(selectedAlert.metadata).length > 0 && (
                                    <div className="p-4 bg-dark-surface rounded-xl">
                                        <div className="text-sm text-dark-muted mb-3">Additional Context</div>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(selectedAlert.metadata).map(([key, val]) => (
                                                <div key={key} className="bg-dark-bg border border-dark-border px-3 py-1.5 rounded-lg flex items-center gap-2">
                                                    <span className="text-[10px] uppercase tracking-wide text-dark-muted font-bold select-none">{key}</span>
                                                    <span className="text-sm text-white font-mono break-all">{String(val)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {!selectedAlert.isAcknowledged && (
                                    <button
                                        onClick={() => {
                                            acknowledgeAlert(selectedAlert.id);
                                            setSelectedAlert({ ...selectedAlert, isAcknowledged: true });
                                        }}
                                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-6 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle className="w-5 h-5" />
                                        Acknowledge Alert
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
