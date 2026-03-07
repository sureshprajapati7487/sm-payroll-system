import { useState } from 'react';
import { Zap, X, IndianRupee } from 'lucide-react';
import { useLoanStore } from '@/store/loanStore';
import { useDialog } from '@/components/DialogProvider';
import { useAuthStore } from '@/store/authStore';

interface EarlySettlementModalProps {
    loanId: string;
    onClose: () => void;
}

export const EarlySettlementModal = ({ loanId, onClose }: EarlySettlementModalProps) => {
    const { requestEarlySettlement, approveSettlement, rejectSettlement, processSettlement, loans } = useLoanStore();
    const [discount, setDiscount] = useState(0);
    const { toast } = useDialog();
    const { user } = useAuthStore();

    const loan = loans.find(l => l.id === loanId);
    if (!loan) return null;

    const hasRequest = loan.settlementRequest;
    const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_ADMIN'].includes(user?.role || '');

    const handleRequestSettlement = () => {
        requestEarlySettlement(loanId);
        toast('Settlement request submit ho gayi!', 'success');
    };

    const handleApprove = () => {
        if (discount > loan.balance) {
            toast('Discount outstanding amount se zyada nahi ho sakta!', 'error');
            return;
        }
        approveSettlement(loanId, discount);
        toast('Settlement approved! Employee pay kar sakta hai.', 'success');
    };

    const handleReject = () => {
        rejectSettlement(loanId);
        toast('Settlement request rejected.', 'error');
    };

    const handleProcessPayment = () => {
        processSettlement(loanId);
        toast('Settlement process ho gaya! Loan band ho gaya.', 'success');
        onClose();
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass max-w-md w-full p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                            <Zap className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Early Settlement</h3>
                            <p className="text-sm text-dark-muted">Close loan with one payment</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-dark-muted hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {!hasRequest ? (
                    <>
                        <div className="bg-dark-surface/50 rounded-xl p-4 mb-4 space-y-3">
                            <div className="flex justify-between">
                                <span className="text-dark-muted">Outstanding Balance:</span>
                                <span className="text-white font-semibold">{formatCurrency(loan.balance)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-dark-muted">Settlement Amount:</span>
                                <span className="text-green-400 font-bold text-lg">{formatCurrency(loan.balance)}</span>
                            </div>
                        </div>

                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-4">
                            <p className="text-blue-400 text-sm">
                                💡 Pay the full outstanding amount to close this loan immediately. Admin may offer a discount.
                            </p>
                        </div>

                        <button
                            onClick={handleRequestSettlement}
                            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-4 py-3 rounded-xl font-medium transition-all"
                        >
                            Request Settlement
                        </button>
                    </>
                ) : hasRequest.status === 'PENDING' && isAdmin ? (
                    <>
                        <div className="bg-dark-surface/50 rounded-xl p-4 mb-4 space-y-3">
                            <div className="flex justify-between">
                                <span className="text-dark-muted">Outstanding:</span>
                                <span className="text-white font-semibold">{formatCurrency(hasRequest.outstandingAmount)}</span>
                            </div>
                            <div>
                                <label className="block text-sm text-dark-muted mb-2">Admin Discount (Optional)</label>
                                <div className="flex items-center gap-2">
                                    <IndianRupee className="w-4 h-4 text-dark-muted" />
                                    <input
                                        type="number"
                                        value={discount}
                                        onChange={(e) => setDiscount(Number(e.target.value))}
                                        max={loan.balance}
                                        className="flex-1 bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-white"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <div className="border-t border-dark-border pt-3 flex justify-between">
                                <span className="text-white font-medium">Final Payment:</span>
                                <span className="text-green-400 font-bold text-xl">
                                    {formatCurrency(hasRequest.outstandingAmount - discount)}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleReject}
                                className="flex-1 bg-dark-surface hover:bg-white/5 text-white px-4 py-3 rounded-xl font-medium transition-all border border-dark-border"
                            >
                                Reject
                            </button>
                            <button
                                onClick={handleApprove}
                                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white px-4 py-3 rounded-xl font-medium transition-all"
                            >
                                Approve
                            </button>
                        </div>
                    </>
                ) : hasRequest.status === 'APPROVED' ? (
                    <>
                        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-4">
                            <p className="text-green-400 font-medium mb-2">✅ Settlement Approved!</p>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-dark-muted">Original Amount:</span>
                                    <span className="text-white">{formatCurrency(hasRequest.outstandingAmount)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-dark-muted">Discount:</span>
                                    <span className="text-green-400">-{formatCurrency(hasRequest.discount)}</span>
                                </div>
                                <div className="flex justify-between border-t border-dark-border pt-2">
                                    <span className="text-white font-medium">Final Payment:</span>
                                    <span className="text-green-400 font-bold text-lg">{formatCurrency(hasRequest.settlementAmount)}</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleProcessPayment}
                            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-4 py-3 rounded-xl font-medium transition-all"
                        >
                            Process Payment & Close Loan
                        </button>
                    </>
                ) : (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                        <p className="text-yellow-400 text-sm">
                            ⏳ Settlement request pending admin approval...
                        </p>
                    </div>
                )}

                <button
                    onClick={onClose}
                    className="w-full mt-3 bg-dark-surface hover:bg-white/5 text-dark-muted px-4 py-2 rounded-xl font-medium transition-all"
                >
                    Close
                </button>
            </div>
        </div>
    );
};
