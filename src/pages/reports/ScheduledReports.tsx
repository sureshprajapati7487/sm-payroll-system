import { useState } from 'react';
import { Calendar, Mail, Clock, Power, Plus, Trash2, CheckCircle, Play } from 'lucide-react';
import { useScheduledReportStore } from '@/store/scheduledReportStore';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import { PERMISSIONS } from '@/config/permissions';

export const ScheduledReports = () => {
    const { reports, createScheduledReport, deleteScheduledReport, toggleReportStatus } = useScheduledReportStore();
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        reportType: 'payslip' as const,
        frequency: 'monthly' as const,
        dayOfWeek: 1,
        dayOfMonth: 1,
        recipients: '',
        enabled: true,
        createdBy: 'Admin'
    });

    const { hasPermission } = useAuthStore();
    const canSchedule = hasPermission(PERMISSIONS.SCHEDULE_REPORTS);

    // Manual "Run Now" — fetch CSV from backend
    const runNow = async (reportType: string, reportName: string) => {
        try {
            const response = await apiFetch(`/reports/download?type=${reportType}`);
            if (!response.ok) throw new Error('Download failed');

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to run report:', error);
        }
    };

    const handleCreate = () => {
        if (!formData.name || !formData.recipients) return;

        const recipientList = formData.recipients.split(',').map(e => e.trim());

        createScheduledReport({
            name: formData.name,
            reportType: formData.reportType,
            frequency: formData.frequency,
            dayOfWeek: (formData.frequency as string) === 'weekly' ? formData.dayOfWeek : undefined,
            dayOfMonth: formData.frequency === 'monthly' ? formData.dayOfMonth : undefined,
            recipients: recipientList,
            enabled: formData.enabled,
            createdBy: formData.createdBy
        });

        setFormData({ name: '', reportType: 'payslip', frequency: 'monthly', dayOfWeek: 1, dayOfMonth: 1, recipients: '', enabled: true, createdBy: 'Admin' });
        setShowForm(false);
    };

    const activeReports = reports.filter(r => r.enabled).length;
    const upcomingToday = reports.filter(r => {
        const nextRun = new Date(r.nextRun);
        const today = new Date();
        return r.enabled && nextRun.toDateString() === today.toDateString();
    }).length;

    const getFrequencyBadge = (freq: string) => {
        const colors = {
            daily: 'bg-blue-500/20 text-blue-400',
            weekly: 'bg-purple-500/20 text-purple-400',
            monthly: 'bg-green-500/20 text-green-400'
        };
        return colors[freq as keyof typeof colors] || 'bg-gray-500/20 text-gray-400';
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Calendar className="w-8 h-8 text-primary-500" />
                        Scheduled Reports
                    </h1>
                    <p className="text-dark-muted mt-1">Automate report generation and email delivery</p>
                </div>

                {canSchedule && (
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl transition-all flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        {showForm ? 'Cancel' : 'New Schedule'}
                    </button>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass rounded-2xl p-6">
                    <div className="text-dark-muted text-sm">Total Schedules</div>
                    <div className="text-3xl font-bold text-white mt-1">{reports.length}</div>
                </div>

                <div className="glass rounded-2xl p-6">
                    <div className="text-dark-muted text-sm">Active</div>
                    <div className="text-3xl font-bold text-green-400 mt-1">{activeReports}</div>
                </div>

                <div className="glass rounded-2xl p-6">
                    <div className="text-dark-muted text-sm">Running Today</div>
                    <div className="text-3xl font-bold text-primary-400 mt-1">{upcomingToday}</div>
                </div>

                <div className="glass rounded-2xl p-6">
                    <div className="text-dark-muted text-sm">Total Recipients</div>
                    <div className="text-3xl font-bold text-white mt-1">
                        {reports.reduce((sum, r) => sum + r.recipients.length, 0)}
                    </div>
                </div>
            </div>

            {/* Create Form */}
            {showForm && (
                <div className="glass rounded-2xl p-6 animate-slide-down">
                    <h3 className="text-lg font-semibold text-white mb-4">Create New Schedule</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            type="text"
                            placeholder="Schedule Name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white"
                        />
                        <select
                            value={formData.reportType}
                            onChange={(e) => setFormData({ ...formData, reportType: e.target.value as any })}
                            className="bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white"
                        >
                            <option value="payslip">Monthly Payslips</option>
                            <option value="attendance">Attendance Report</option>
                            <option value="statutory">Statutory Report</option>
                            <option value="custom">Custom Report</option>
                        </select>
                        <select
                            value={formData.frequency}
                            onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                            className="bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white"
                        >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                        {formData.frequency === 'monthly' && (
                            <input
                                type="number"
                                placeholder="Day of Month (1-31)"
                                value={formData.dayOfMonth}
                                onChange={(e) => setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) })}
                                className="bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white"
                                min="1"
                                max="31"
                            />
                        )}
                        {(formData.frequency as string) === 'weekly' && (
                            <select
                                value={formData.dayOfWeek}
                                onChange={(e) => setFormData({ ...formData, dayOfWeek: parseInt(e.target.value) })}
                                className="bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white"
                            >
                                <option value="1">Monday</option>
                                <option value="2">Tuesday</option>
                                <option value="3">Wednesday</option>
                                <option value="4">Thursday</option>
                                <option value="5">Friday</option>
                                <option value="6">Saturday</option>
                                <option value="0">Sunday</option>
                            </select>
                        )}
                        <input
                            type="text"
                            placeholder="Recipients (comma separated emails)"
                            value={formData.recipients}
                            onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
                            className="bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white col-span-2"
                        />
                    </div>
                    <button
                        onClick={handleCreate}
                        className="mt-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-6 py-3 rounded-xl transition-all"
                    >
                        Create Schedule
                    </button>
                </div>
            )}

            {/* Schedules List */}
            <div className="glass rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-dark-border">
                    <h3 className="text-lg font-semibold text-white">All Schedules</h3>
                </div>

                {reports.length === 0 ? (
                    <div className="p-12 text-center text-dark-muted">
                        <Calendar className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <div className="text-lg">No scheduled reports</div>
                        <div className="text-sm mt-2">Create your first automated report schedule</div>
                    </div>
                ) : (
                    <div className="divide-y divide-dark-border">
                        {reports.map((report) => (
                            <div key={report.id} className="p-6 hover:bg-white/5 transition-all">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h4 className="text-white font-semibold text-lg">{report.name}</h4>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getFrequencyBadge(report.frequency)}`}>
                                                {report.frequency.toUpperCase()}
                                            </span>
                                            <span className="px-3 py-1 bg-dark-surface text-dark-muted rounded-full text-xs">
                                                {report.reportType}
                                            </span>
                                            {report.enabled ? (
                                                <CheckCircle className="w-5 h-5 text-green-400" />
                                            ) : (
                                                <Power className="w-5 h-5 text-red-400" />
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mb-3">
                                            <div className="text-sm">
                                                <span className="text-dark-muted">Next Run: </span>
                                                <span className="text-white">
                                                    {new Date(report.nextRun).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="text-sm">
                                                <span className="text-dark-muted">Recipients: </span>
                                                <span className="text-white">{report.recipients.length}</span>
                                            </div>
                                            {report.lastRun && (
                                                <div className="text-sm">
                                                    <span className="text-dark-muted">Last Run: </span>
                                                    <span className="text-white">
                                                        {new Date(report.lastRun).toLocaleString()}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap">
                                            {report.recipients.slice(0, 3).map((email, idx) => (
                                                <span key={idx} className="px-2 py-1 bg-dark-surface text-dark-muted rounded text-xs">
                                                    <Mail className="w-3 h-3 inline mr-1" />
                                                    {email}
                                                </span>
                                            ))}
                                            {report.recipients.length > 3 && (
                                                <span className="text-dark-muted text-xs">
                                                    +{report.recipients.length - 3} more
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => runNow(report.reportType, report.name)}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 rounded-lg transition-all text-xs font-medium"
                                            title="Run Now — Download CSV"
                                        >
                                            <Play className="w-3 h-3" />
                                            Run Now
                                        </button>
                                        {canSchedule && (
                                            <>
                                                <button
                                                    onClick={() => toggleReportStatus(report.id)}
                                                    className={`p-2 rounded-lg transition-all ${report.enabled
                                                        ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400'
                                                        : 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
                                                        }`}
                                                    title={report.enabled ? 'Disable' : 'Enable'}
                                                >
                                                    <Power className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => deleteScheduledReport(report.id)}
                                                    className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <div className="text-blue-400 font-semibold text-sm mb-1">
                    <Clock className="w-4 h-4 inline mr-2" />
                    ℹ️ Run Now — CSV Download Available | Email Delivery: Coming Soon
                </div>
                <div className="text-dark-muted text-xs leading-relaxed">
                    <span className="text-green-400 font-medium">✅ Kaam karta hai:</span>{' '}
                    Kisi bhi schedule ka <strong className="text-white">"Run Now"</strong> button dabao — report turant CSV mein download ho jaayegi.
                    {' '}<span className="text-yellow-400 font-medium">⏳ Coming Soon:</span>{' '}
                    Automatic email delivery ke liye server-side cron job chahiye — woh abhi implement nahi hua hai.
                    Sab times IST (Indian Standard Time) mein hain.
                </div>
            </div>
        </div>
    );
};
