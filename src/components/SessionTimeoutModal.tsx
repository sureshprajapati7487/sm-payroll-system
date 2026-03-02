import { AlertCircle, Clock, LogOut, RefreshCw } from 'lucide-react';

interface SessionTimeoutModalProps {
    secondsLeft: number;
    onStayLoggedIn: () => void;
    onLogout: () => void;
}

export const SessionTimeoutModal = ({ secondsLeft, onStayLoggedIn, onLogout }: SessionTimeoutModalProps) => {
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    const timeStr = mins > 0
        ? `${mins}:${String(secs).padStart(2, '0')}`
        : `${secs}s`;

    // Progress arc: how much of the 2-min warning has elapsed
    const totalWarning = 2 * 60;
    const progress = Math.round((secondsLeft / totalWarning) * 100);
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - progress / 100);

    const urgentColor = secondsLeft <= 30 ? '#ef4444' : secondsLeft <= 60 ? '#f59e0b' : '#8b5cf6';

    return (
        // Backdrop
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-dark-surface border border-dark-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-slide-up">
                {/* Top accent bar */}
                <div
                    className="h-1 transition-all duration-1000"
                    style={{ backgroundColor: urgentColor, width: `${progress}%` }}
                />

                <div className="p-8 text-center">
                    {/* Icon + Countdown ring */}
                    <div className="relative inline-flex items-center justify-center mb-6">
                        <svg width="96" height="96" className="-rotate-90">
                            <circle cx="48" cy="48" r={radius} fill="none" stroke="#1e293b" strokeWidth="6" />
                            <circle
                                cx="48" cy="48" r={radius}
                                fill="none"
                                stroke={urgentColor}
                                strokeWidth="6"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                className="transition-all duration-1000"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Clock className="w-8 h-8" style={{ color: urgentColor }} />
                        </div>
                    </div>

                    {/* Title */}
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <AlertCircle className="w-5 h-5 text-yellow-400" />
                        <h2 className="text-xl font-bold text-white">Session Expiring</h2>
                    </div>

                    <p className="text-dark-muted text-sm mb-2">
                        You have been inactive. Your session will expire in:
                    </p>

                    {/* Big Timer */}
                    <div
                        className="text-5xl font-black tracking-tight mb-6 transition-colors duration-500"
                        style={{ color: urgentColor }}
                    >
                        {timeStr}
                    </div>

                    <p className="text-dark-muted text-xs mb-8">
                        Any unsaved changes may be lost.
                    </p>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={onLogout}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-dark-bg hover:bg-white/5 text-dark-muted hover:text-white border border-dark-border rounded-xl transition-all font-medium"
                        >
                            <LogOut className="w-4 h-4" />
                            Logout Now
                        </button>
                        <button
                            onClick={onStayLoggedIn}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl transition-all font-bold shadow-lg shadow-primary-500/30"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Stay Logged In
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
