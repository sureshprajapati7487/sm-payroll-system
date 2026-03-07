import { useState } from 'react';
import { Database, Download, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { generateDemoData } from '@/utils/dataSeeder';
import { generateBackup, restoreBackup } from '@/utils/backupUtils';
import { apiFetch } from '@/lib/apiClient';

export const DataSeeding = () => {
    const [seeding, setSeeding] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);

    const handleSeed = async () => {
        setSeeding(true);
        addLog('Starting data generation...');

        try {
            await new Promise(resolve => setTimeout(resolve, 500)); // UI delay

            const { employees } = generateDemoData();

            // Import Stores dynamically to avoid circular deps or ensure fresh state
            const { useEmployeeStore } = await import('@/store/employeeStore');
            const { useLoanStore } = await import('@/store/loanStore');

            // 1. Seed Employees
            addLog(`Seeding ${employees.length} employees...`);
            const addEmployee = useEmployeeStore.getState().addEmployee;
            // We need to clear existing first? No, we just add.
            // But usually seeding implies fresh start.

            employees.forEach(e => {
                // Ensure no duplicate IDs if re-seeding?
                // Just add for now.
                addEmployee(e);
            });

            // 2. Seed Attendance (Simplified)
            // Skipped for now

            // 3. Seed Loans (Optional)
            if (Math.random() > 0.5) {
                const loanStore = useLoanStore.getState();
                const randomEmp = employees[0];
                if (randomEmp) {
                    loanStore.requestLoan({
                        amount: 50000,
                        reason: 'Home Renovation',
                        tenureMonths: 12,
                        type: 'ADVANCE_CASH' as any, // Using existing type
                        employeeId: randomEmp.id,
                        emiAmount: 4166,
                        issuedDate: new Date().toISOString().split('T')[0]
                    });
                    addLog('Created sample loan request');
                }
            }

            addLog(`Successfully added ${employees.length} staff members!`);
            addLog('Data seeding complete!');
        } catch (error) {
            addLog('Error seeding data');
            console.error(error);
        } finally {
            setSeeding(false);
        }
    };

    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmText, setConfirmText] = useState('');

    const executeClear = async () => {
        setClearing(true);
        setShowConfirmModal(false);
        setConfirmText('');
        addLog('Clearing current company data...');

        try {
            const { useMultiCompanyStore } = await import('@/store/multiCompanyStore');
            const currentCompanyId = useMultiCompanyStore.getState().currentCompanyId;

            if (!currentCompanyId) {
                addLog('Error: No company selected');
                setClearing(false);
                return;
            }

            addLog(`Triggering secure server data wipe for company: ${currentCompanyId}...`);

            const res = await apiFetch('/admin/clear-data', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId: currentCompanyId })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Server rejected data wipe');
            }

            const data = await res.json();
            addLog(`✅ Server response: ${data.message || 'Company data cleared successfully!'}`);
            addLog('Reloading page...');

            setTimeout(() => {
                window.location.reload();
            }, 1500);

        } catch (error) {
            console.error('Error clearing company data:', error);
            addLog('❌ Error clearing data');
            setClearing(false);
        }
    };



    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Database className="w-8 h-8 text-primary-500" />
                    Data Management
                </h1>
                <p className="text-dark-muted mt-1">Seed demo data for testing or clear system to factory defaults</p>
            </div>

            {/* Data Management Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Backup Data */}
                <div className="glass rounded-2xl p-6 border border-blue-500/20">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-blue-500/20 rounded-xl">
                            <Download className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Backup Data</h3>
                            <p className="text-sm text-dark-muted">Save a copy of your data</p>
                        </div>
                    </div>
                    <p className="text-dark-muted mb-6">
                        Download a full backup of your Employees, Payroll, and Loans.
                        Keep this file safe!
                    </p>
                    <button
                        onClick={() => {
                            generateBackup();
                            addLog('Backup downloaded successfully');
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                        <Database className="w-5 h-5" />
                        Download Backup
                    </button>
                </div>

                {/* Restore Data */}
                <div className="glass rounded-2xl p-6 border border-purple-500/20">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-purple-500/20 rounded-xl">
                            <RefreshCw className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Restore Data</h3>
                            <p className="text-sm text-dark-muted">Load data from a backup file</p>
                        </div>
                    </div>
                    <p className="text-dark-muted mb-6">
                        <span className="text-warning flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Overwrites current data!
                        </span>
                        Upload a previously saved backup file to restore your system.
                    </p>
                    <div className="relative">
                        <input
                            type="file"
                            accept=".json"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (!confirm('This will OVERWRITE all current data. Continue?')) return;

                                addLog('Restoring backup...');
                                const result = await restoreBackup(file);
                                if (result.success) {
                                    addLog(result.message);
                                    setTimeout(() => window.location.reload(), 2000);
                                } else {
                                    addLog('Error: ' + result.message);
                                }
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <button className="w-full bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2 pointer-events-none">
                            <Download className="w-5 h-5 rotate-180" />
                            Upload Backup File
                        </button>
                    </div>
                </div>

                {/* Seed Data (Demo) - Hidden or Minimized for Real User? Kept for testing if needed but de-emphasized */}
                <div className="glass rounded-2xl p-6 border border-green-500/10 opacity-60 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-green-500/10 rounded-xl">
                            <Database className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Load Demo Data</h3>
                            <p className="text-xs text-dark-muted">For testing purposes only</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSeed}
                        disabled={seeding}
                        className="w-full bg-dark-bg hover:bg-green-900/20 text-green-400 border border-green-500/20 px-4 py-2 rounded-xl transition-all"
                    >
                        {seeding ? 'Loading...' : 'Load Mock Data'}
                    </button>
                </div>

                {/* Clear Data */}
                <div className="glass rounded-2xl p-6 border border-red-500/20">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-red-500/20 rounded-xl">
                            <Trash2 className="w-6 h-6 text-red-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Clear Company Data</h3>
                            <p className="text-sm text-dark-muted">Reset current company only</p>
                        </div>
                    </div>
                    <p className="text-dark-muted mb-6">
                        Permanently delete attendance, production, loans, payroll, and expenses for the <span className="text-warning font-semibold">CURRENT COMPANY ONLY</span>. Other companies will NOT be affected.
                    </p>
                    <button
                        onClick={() => setShowConfirmModal(true)}
                        disabled={clearing}
                        className="w-full bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                        {clearing ? 'Resetting...' : 'Clear Company History'}
                    </button>
                </div>
            </div>

            {/* Logs */}
            <div className="glass rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Activity Log</h3>
                <div className="bg-black/50 rounded-xl p-4 font-mono text-sm h-48 overflow-y-auto">
                    {logs.length === 0 ? (
                        <div className="text-dark-muted italic">No activity yet...</div>
                    ) : (
                        logs.map((log, i) => (
                            <div key={i} className="text-green-400 mb-1">
                                <span className="text-dark-muted mr-2">&gt;</span>
                                {log}
                            </div>
                        ))
                    )}
                </div>
            </div>
            {/* Modal for Danger Zone Confirmation */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)} />
                    <div className="relative glass rounded-2xl border border-red-500/30 w-full max-w-md shadow-2xl shadow-red-500/10 overflow-hidden text-center">
                        <div className="h-2 w-full bg-gradient-to-r from-red-600 to-rose-500" />
                        <div className="p-8 space-y-6">
                            <div className="mx-auto w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center animate-pulse">
                                <AlertTriangle className="w-8 h-8 text-red-400" />
                            </div>

                            <div>
                                <h2 className="text-2xl font-bold text-white mb-2">Absolute Danger Zone</h2>
                                <p className="text-red-300 text-sm leading-relaxed font-medium">
                                    You are about to irreversibly destroy <strong className="text-white bg-red-500/30 px-1 rounded">ALL DATA</strong> for this company.
                                    This includes Payroll, Loans, Employees, and Production records.
                                    <br /><br />
                                    <strong>This CANNOT be undone.</strong>
                                </p>
                            </div>

                            <div className="text-left space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-dark-muted">
                                    Type <span className="text-red-400 font-bold select-all">DELETE</span> to confirm
                                </label>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder="Type DELETE here..."
                                    className="w-full bg-dark-surface border-2 border-dark-border focus:border-red-500 rounded-xl px-4 py-3 text-white text-center font-bold tracking-widest placeholder:tracking-normal placeholder:font-normal placeholder:text-dark-muted/50 outline-none transition-colors"
                                    autoComplete="off"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => { setShowConfirmModal(false); setConfirmText(''); }}
                                    className="flex-1 py-3 rounded-xl border border-dark-border hover:bg-white/5 text-dark-muted hover:text-white transition-colors font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeClear}
                                    disabled={confirmText !== 'DELETE'}
                                    className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:bg-dark-surface disabled:border disabled:border-dark-border disabled:text-dark-muted text-white transition-all font-bold shadow-lg shadow-red-500/20"
                                >
                                    Confirm Wipe
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
