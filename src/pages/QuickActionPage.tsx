import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { useLoanStore } from '@/store/loanStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export const QuickActionPage = () => {
    const [searchParams] = useSearchParams();
    const { action: paramAction, id: paramId } = useParams();
    const navigate = useNavigate();
    const { approveLoan, rejectLoan, loans } = useLoanStore();

    // Status State
    const [status, setStatus] = useState<'LOADING' | 'SUCCESS' | 'ERROR' | 'INFO'>('LOADING');
    const [message, setMessage] = useState('Processing your request...');
    const [details, setDetails] = useState('');
    const [loanContext, setLoanContext] = useState<{ amount: number; empName: string } | null>(null);

    useEffect(() => {
        const processAction = async () => {
            // Support both Clean URL (/go/approve/123) and Token URL (/quick-action?token=...)
            let loanId = paramId;
            let action = paramAction ? paramAction.toUpperCase() : null;

            // Fallback to Token if Params missing
            if (!loanId) {
                const token = searchParams.get('token');
                if (token) {
                    try {
                        const decoded = JSON.parse(atob(token));
                        loanId = decoded.loanId;
                        action = searchParams.get('action');
                    } catch (e) {
                        console.error("Token Decode Failed", e);
                    }
                }
            }

            if (!loanId || !action) {
                setStatus('ERROR');
                setMessage('Invalid Link');
                setDetails('Missing token or action parameters.');
                return;
            }

            try {
                // 1. Validation
                const loan = loans.find(l => l.id === loanId); // Sync Access

                if (!loan) {
                    setStatus('ERROR');
                    setMessage('Loan Not Found');
                    return;
                }

                // FETCH CONTEXT
                const emp = useEmployeeStore.getState().employees.find(e => e.id === loan.employeeId);
                setLoanContext({
                    amount: loan.amount,
                    empName: emp?.name || 'Unknown Employee'
                });

                if (loan.status !== 'REQUESTED') {
                    setStatus('INFO');
                    setMessage('Already Processed');
                    setDetails(`Current Status: ${loan.status}`);
                    return;
                }

                // 2. Perform Action
                // Simulate network delay
                await new Promise(r => setTimeout(r, 1500));

                if (action === 'APPROVE') {
                    approveLoan(loanId);
                    setStatus('SUCCESS');
                    setMessage('Loan Approved Successfully');
                } else if (action === 'REJECT') {
                    rejectLoan(loanId);
                    setStatus('SUCCESS');
                    setMessage('Loan Rejected');
                } else {
                    throw new Error("Unknown Action");
                }

            } catch (err) {
                console.error(err);
                setStatus('ERROR');
                setMessage('Processing Failed');
                setDetails('The link may be expired or invalid.');
            }
        };

        processAction();
    }, [searchParams, loans, approveLoan, rejectLoan]);

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="glass max-w-md w-full p-8 rounded-2xl text-center space-y-6">

                {/* CONTEXT HEADER */}
                {loanContext && (
                    <div className="bg-dark-bg/50 p-4 rounded-xl border border-dark-border mb-4">
                        <p className="text-sm text-dark-muted mb-1">Request for</p>
                        <h3 className="text-xl font-bold text-white mb-2">{loanContext.empName}</h3>
                        <div className="flex justify-center items-baseline gap-1">
                            <span className="text-2xl font-bold text-primary-400">₹{loanContext.amount.toLocaleString()}</span>
                        </div>
                    </div>
                )}

                {status === 'LOADING' && (
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="w-16 h-16 text-primary-500 animate-spin" />
                        <h2 className="text-xl font-bold text-white">Verifying Token...</h2>
                        <p className="text-dark-muted">Please wait while we secure the connection.</p>
                    </div>
                )}

                {status === 'SUCCESS' && (
                    <div className="flex flex-col items-center gap-4 animate-in zoom-in-95">
                        <div className="w-20 h-20 bg-success/20 rounded-full flex items-center justify-center mb-2">
                            <CheckCircle className="w-10 h-10 text-success" />
                        </div>
                        <h2 className="text-2xl font-bold text-white">{message}</h2>
                        <p className="text-dark-muted">The system has been updated automatically.</p>
                        <button
                            onClick={() => {
                                const targetId = paramId || (searchParams.get('token') ? JSON.parse(atob(searchParams.get('token')!)).loanId : '');
                                const targetLoan = loans.find(l => l.id === targetId);
                                const emp = targetLoan ? useEmployeeStore.getState().employees.find(e => e.id === targetLoan.employeeId) : null;

                                if (emp) {
                                    navigate(`/loans?search=${encodeURIComponent(emp.name)}`);
                                } else {
                                    navigate('/loans');
                                }
                            }}
                            className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium"
                        >
                            Go to Dashboard
                        </button>
                    </div>
                )}

                {status === 'INFO' && (
                    <div className="flex flex-col items-center gap-4 animate-in zoom-in-95">
                        <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-2">
                            <CheckCircle className="w-10 h-10 text-blue-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-white">{message}</h2>
                        <p className="text-dark-muted">{details}</p>
                        <button
                            onClick={() => navigate(`/loans?search=${encodeURIComponent(loanContext?.empName || '')}`)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-medium transition-all w-full flex items-center justify-center gap-2"
                        >
                            View Loan Status
                        </button>
                    </div>
                )}

                {status === 'ERROR' && (
                    <div className="flex flex-col items-center gap-4 animate-in zoom-in-95">
                        <div className="w-20 h-20 bg-danger/20 rounded-full flex items-center justify-center mb-2">
                            <XCircle className="w-10 h-10 text-danger" />
                        </div>
                        <h2 className="text-2xl font-bold text-white">{message}</h2>
                        <p className="text-dark-muted">{details}</p>
                        <button
                            onClick={() => navigate('/loans')}
                            className="px-6 py-2 bg-dark-surface border border-dark-border hover:bg-white/5 text-white rounded-lg transition-colors"
                        >
                            Back to Safety
                        </button>
                    </div>
                )}

                <div className="pt-6 border-t border-dark-border">
                    <p className="text-xs text-dark-muted">SM Payroll Automated Approval System</p>
                </div>
            </div>
        </div>
    );
};
