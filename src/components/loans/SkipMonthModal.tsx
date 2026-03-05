import { useState } from 'react';
import { Clock, X } from 'lucide-react';
import { useLoanStore } from '@/store/loanStore';
import { useDialog } from '@/components/DialogProvider';

interface SkipMonthModalProps {
    loanId: string;
    onClose: () => void;
}

export const SkipMonthModal = ({ loanId, onClose }: SkipMonthModalProps) => {
    const { requestSkipMonth, loans } = useLoanStore();
    const [monthYear, setMonthYear] = useState('');
    const [reason, setReason] = useState('');
    const { toast } = useDialog();

    const loan = loans.find(l => l.id === loanId);
    if (!loan) return null;

    const usedSkips = loan.skippedMonths?.filter(s => s.status === 'APPROVED').length || 0;
    const remainingSkips = (loan.allowedSkips || 2) - usedSkips;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!monthYear || !reason.trim()) {
            toast('Sabhi fields bharein!', 'error');
            return;
        }

        requestSkipMonth(loanId, monthYear, reason);
        toast('Skip request approval ke liye submit ho gayi!', 'success');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass max-w-md w-full p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                            <Clock className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Request Skip Month</h3>
                            <p className="text-sm text-dark-muted">Hold EMI for one month</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-dark-muted hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {remainingSkips <= 0 ? (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
                        <p className="text-red-400 text-sm">
                            ⚠️ No skips remaining! Maximum {loan.allowedSkips || 2} skips allowed per loan.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-4">
                            <p className="text-blue-400 text-sm">
                                📅 Remaining Skips: <span className="font-bold">{remainingSkips}</span>
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-white mb-2">
                                    Select Month
                                </label>
                                <input
                                    type="month"
                                    value={monthYear}
                                    onChange={(e) => setMonthYear(e.target.value)}
                                    min={new Date().toISOString().slice(0, 7)}
                                    className="w-full bg-[#1e293b] border border-slate-600 rounded-xl px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                    style={{ colorScheme: 'dark' }}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white mb-2">
                                    Reason for Skip
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="e.g., Medical emergency, unexpected expenses"
                                    className="w-full bg-[#1e293b] border border-slate-600 rounded-xl px-4 py-3 text-white placeholder:text-slate-400 min-h-[80px] focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                    required
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 bg-dark-surface hover:bg-white/5 text-white px-4 py-3 rounded-xl font-medium transition-all border border-dark-border"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white px-4 py-3 rounded-xl font-medium transition-all"
                                >
                                    Submit Request
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};
