import { useNavigate } from 'react-router-dom';
import { ShieldBan, ArrowLeft } from 'lucide-react';

export const UnauthorizedPage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 rounded-full bg-danger/10 flex items-center justify-center mb-6 animate-pulse">
                <ShieldBan className="w-12 h-12 text-danger" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Access Denied</h1>
            <p className="text-slate-400 max-w-md mb-8">
                You do not have permission to view this specific module.
                Please contact the Super Admin if you believe this is a mistake.
            </p>

            <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-dark-card border border-dark-border hover:bg-dark-border transition-colors text-white font-medium"
            >
                <ArrowLeft className="w-4 h-4" />
                Return to Dashboard
            </button>
        </div>
    );
};
