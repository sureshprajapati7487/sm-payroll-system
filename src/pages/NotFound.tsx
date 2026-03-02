import { AlertTriangle, Home, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const NotFound = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
            <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>

            <h1 className="text-6xl font-bold text-white mb-2">404</h1>
            <h2 className="text-2xl font-semibold text-dark-muted mb-6">Page Not Found</h2>

            <p className="max-w-md text-dark-muted mb-8">
                The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
            </p>

            <div className="flex gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="px-6 py-3 rounded-xl border border-dark-border text-white hover:bg-dark-surface transition-all flex items-center gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Go Back
                </button>
                <button
                    onClick={() => navigate('/')}
                    className="px-6 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white transition-all flex items-center gap-2"
                >
                    <Home className="w-4 h-4" />
                    Dashboard
                </button>
            </div>
        </div>
    );
};
