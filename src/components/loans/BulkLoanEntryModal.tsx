import { useState } from 'react';
import { useLoanStore } from '@/store/loanStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { LoanType } from '@/types';
import { X, Plus, Trash2, Check, Upload } from 'lucide-react';
import { clsx } from 'clsx';

import { useAuthStore } from '@/store/authStore';
import { useSystemConfigStore } from '@/store/systemConfigStore';
import { useDialog } from '@/components/DialogProvider';

interface BulkLoanEntryModalProps {
    onClose: () => void;
}

interface LoanRow {
    id: string;
    employeeId: string;
    type: LoanType;
    amount: number;
    tenureMonths: number;
    emiAmount: number;
    startDate: string;
    checkingApproverId?: string; // Optional
    remarks?: string; // New
    error?: string;
}

export const BulkLoanEntryModal = ({ onClose }: BulkLoanEntryModalProps) => {
    const { requestLoan } = useLoanStore();
    const { employees } = useEmployeeStore();
    const { user } = useAuthStore();
    const { confirm, toast } = useDialog();

    const [rows, setRows] = useState<LoanRow[]>([
        { id: '1', employeeId: '', type: LoanType.ADVANCE_CASH, amount: 0, tenureMonths: 1, emiAmount: 0, startDate: new Date().toISOString().split('T')[0] }
    ]);

    const addRow = () => {
        setRows([...rows, {
            id: Math.random().toString(36).substr(2, 9),
            employeeId: '',
            type: LoanType.ADVANCE_CASH,
            amount: 0,
            tenureMonths: 1,
            emiAmount: 0,
            startDate: new Date().toISOString().split('T')[0]
        }]);
    };

    const removeRow = (id: string) => {
        if (rows.length > 1) {
            setRows(rows.filter(r => r.id !== id));
        }
    };

    const updateRow = (id: string, field: keyof LoanRow, value: any) => {
        setRows(rows.map(r => {
            if (r.id === id) {
                const updated = { ...r, [field]: value };
                // Auto-calc EMI if amount/tenure changes
                if (field === 'amount' || field === 'tenureMonths') {
                    if (updated.tenureMonths > 0) {
                        updated.emiAmount = Math.ceil(updated.amount / updated.tenureMonths);
                    }
                }
                // Reverse Calc: If EMI changed
                if (field === 'emiAmount' && updated.emiAmount > 0) {
                    updated.tenureMonths = Math.ceil(updated.amount / updated.emiAmount);
                }
                return updated;
            }
            return r;
        }));
    };

    const handleSubmit = async () => {
        // Validate
        const validRows = rows.filter(r => r.employeeId && r.amount > 0);
        if (validRows.length === 0) {
            toast('Pehle kam se kam ek valid loan entry add karein.', 'error');
            return;
        }

        const ok = await confirm({
            title: `${validRows.length} Loan Entries Process Karein?`,
            message: `${validRows.length} employees ke liye loan/advance entries submit hogi.`,
            confirmLabel: 'Haan, Process Karo',
            cancelLabel: 'Cancel',
            variant: 'warning',
        });
        if (ok) {
            validRows.forEach(row => {
                requestLoan({
                    employeeId: row.employeeId,
                    type: row.type,
                    amount: row.amount,
                    tenureMonths: row.tenureMonths,
                    emiAmount: row.emiAmount,
                    reason: row.remarks || 'Bulk Entry',
                    issuedDate: row.startDate,
                    approverId: user?.id || 'ADMIN',
                    checkingApproverId: row.checkingApproverId
                });
            });
            onClose();
        }
    };

    // Note: If requestLoan only sets to REQUESTED, I might need to iterate and approve them if user desires instant issue.
    // For now, let's stick to Requesting them in bulk. Or update store to allow direct Issue.

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-0">
            <div className="bg-dark-bg w-full h-full flex flex-col animate-in zoom-in-95">

                <div className="p-6 border-b border-dark-border flex justify-between items-center bg-dark-bg/50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Upload className="w-6 h-6 text-primary-400" />
                            Bulk Loan Entry
                        </h2>
                        <p className="text-dark-muted text-sm">Issue multiple loans/advances at once.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-dark-muted hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-4">
                    <table className="w-full text-left text-sm border-separate border-spacing-y-2">
                        <thead>
                            <tr className="text-dark-muted">
                                <th className="px-4">Employee</th>
                                <th className="px-4">Type</th>
                                <th className="px-4 w-32">Amount</th>
                                <th className="px-4 w-24">Tenure (M)</th>
                                <th className="px-4 w-32">EMI</th>
                                <th className="px-4 w-40">Date</th>
                                <th className="px-4 w-48">Remarks</th>
                                <th className="px-4 w-32">Checker (Opt)</th>
                                <th className="px-4 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => {
                                const isInvalid = !row.employeeId || !row.amount || Number(row.amount) <= 0;
                                return (
                                    <tr key={row.id} className={clsx(
                                        "text-white transition-colors",
                                        isInvalid
                                            ? "bg-red-500/5 border-l-2 border-red-500/50"
                                            : "bg-dark-bg/30 border-l-2 border-transparent"
                                    )}>
                                        <td className="p-2">
                                            <select
                                                value={row.employeeId}
                                                onChange={e => updateRow(row.id, 'employeeId', e.target.value)}
                                                className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1.5 focus:border-primary-500"
                                            >
                                                <option value="">Select Employee</option>
                                                {employees.map(e => (
                                                    <option key={e.id} value={e.id}>{e.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <select
                                                value={row.type}
                                                onChange={e => updateRow(row.id, 'type', e.target.value as LoanType)}
                                                className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1.5"
                                            >
                                                {useSystemConfigStore.getState().loanTypes.map(lt => (
                                                    <option key={lt.key} value={lt.key}>{lt.label}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="number"
                                                value={row.amount}
                                                onChange={e => updateRow(row.id, 'amount', Number(e.target.value))}
                                                className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-right font-mono"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="number"
                                                value={row.tenureMonths}
                                                onChange={e => updateRow(row.id, 'tenureMonths', Number(e.target.value))}
                                                className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-center"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="number"
                                                value={row.emiAmount}
                                                onChange={e => updateRow(row.id, 'emiAmount', Number(e.target.value))}
                                                className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-right font-mono"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="date"
                                                value={row.startDate}
                                                onChange={e => updateRow(row.id, 'startDate', e.target.value)}
                                                className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-xs"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="text"
                                                value={row.remarks || ''}
                                                onChange={e => updateRow(row.id, 'remarks', e.target.value)}
                                                placeholder="Optional..."
                                                className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-xs"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <select
                                                value={row.checkingApproverId || ''}
                                                onChange={e => updateRow(row.id, 'checkingApproverId', e.target.value)}
                                                className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-xs text-dark-muted focus:text-white"
                                            >
                                                <option value="">None</option>
                                                {employees.filter(e => e.role === 'ADMIN' || e.role === 'MANAGER' || e.role === 'SUPER_ADMIN' || e.role === 'ACCOUNT_ADMIN').map(mgr => (
                                                    <option key={mgr.id} value={mgr.id}>{mgr.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-2 text-center">
                                            <button
                                                onClick={() => removeRow(row.id)}
                                                className="p-1.5 hover:bg-red-500/20 text-dark-muted hover:text-red-500 rounded transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}

                        </tbody>
                    </table>

                    <button
                        onClick={addRow}
                        className="mt-4 flex items-center gap-2 px-4 py-2 border border-dashed border-dark-border rounded-lg text-dark-muted hover:text-white hover:border-primary-500 transition-colors w-full justify-center"
                    >
                        <Plus className="w-4 h-4" />
                        Add Another Row
                    </button>
                </div>

                <div className="p-4 border-t border-dark-border bg-dark-bg/50 rounded-b-2xl flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-dark-muted hover:text-white transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-bold shadow-lg shadow-primary-600/20 transition-all"
                    >
                        <Check className="w-5 h-5" />
                        Process Entries
                    </button>
                </div>

            </div>
        </div>
    );
};
