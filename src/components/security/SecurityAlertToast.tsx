import { useEffect, useState } from 'react';
import { useSecurityAlertsStore, SecurityAlert } from '@/store/securityAlertsStore';
import { ShieldAlert, X, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';

export const SecurityAlertToast = () => {
    const alerts = useSecurityAlertsStore(s => s.alerts);
    const acknowledgeAlert = useSecurityAlertsStore(s => s.acknowledgeAlert);
    const navigate = useNavigate();

    const [activeToast, setActiveToast] = useState<SecurityAlert | null>(null);

    // Watch for new critical/high alerts
    useEffect(() => {
        // Find the most recent unacknowledged high/critical alert from the last 10 seconds
        const recentCutoff = new Date(Date.now() - 10000).toISOString();
        const latestAlert = [...alerts]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .find(
                a => !a.isAcknowledged &&
                    a.timestamp >= recentCutoff &&
                    ['critical', 'high'].includes(a.severity)
            );

        if (latestAlert && (!activeToast || activeToast.id !== latestAlert.id)) {
            setActiveToast(latestAlert);
        }
    }, [alerts, activeToast]);

    // Auto-dismiss after 8 seconds
    useEffect(() => {
        if (!activeToast) return;

        const timer = setTimeout(() => {
            setActiveToast(null);
        }, 8000);

        return () => clearTimeout(timer);
    }, [activeToast]);

    if (!activeToast) return null;

    const isCritical = activeToast.severity === 'critical';

    return (
        <div className="fixed top-6 right-6 z-[9999] max-w-sm w-full animate-in slide-in-from-right-8 fade-in duration-300">
            <div className={clsx(
                "relative overflow-hidden rounded-2xl shadow-2xl border p-4 backdrop-blur-md",
                isCritical
                    ? "bg-red-950/90 border-red-500/50 shadow-red-500/20"
                    : "bg-amber-950/90 border-amber-500/50 shadow-amber-500/20"
            )}>
                {/* Glow effect */}
                <div className={clsx(
                    "absolute -max-w-xs aspect-square rounded-full blur-[80px] -top-20 -right-20 opacity-40 pointer-events-none",
                    isCritical ? "bg-red-500" : "bg-amber-500"
                )} />

                <div className="relative flex gap-4">
                    <div className={clsx(
                        "mt-1 p-2 rounded-xl h-fit",
                        isCritical ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
                    )}>
                        <ShieldAlert className="w-6 h-6" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                            <h3 className={clsx(
                                "font-bold text-sm tracking-wide",
                                isCritical ? "text-red-100" : "text-amber-100"
                            )}>
                                {activeToast.title}
                            </h3>
                            <button
                                onClick={() => setActiveToast(null)}
                                className="text-white/50 hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <p className={clsx(
                            "mt-1 text-xs line-clamp-2",
                            isCritical ? "text-red-200/80" : "text-amber-200/80"
                        )}>
                            {activeToast.description}
                        </p>

                        <div className="mt-4 flex items-center gap-3">
                            <button
                                onClick={() => {
                                    acknowledgeAlert(activeToast.id);
                                    setActiveToast(null);
                                }}
                                className={clsx(
                                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                                    isCritical
                                        ? "bg-red-500 hover:bg-red-600 text-white"
                                        : "bg-amber-500 hover:bg-amber-600 text-amber-950"
                                )}
                            >
                                Acknowledge
                            </button>
                            <button
                                onClick={() => {
                                    setActiveToast(null);
                                    navigate('/security/alerts');
                                }}
                                className="flex items-center gap-1 text-xs font-medium text-white/70 hover:text-white transition-colors"
                            >
                                View Details
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Progress bar for auto-dismiss */}
                <div className="absolute bottom-0 left-0 h-1 w-full bg-black/20">
                    <div
                        className={clsx(
                            "h-full animate-[shrink_8s_linear_forwards]",
                            isCritical ? "bg-red-500" : "bg-amber-500"
                        )}
                        style={{ animationName: 'shrinkWidth' }}
                    />
                </div>
                <style>{`
                    @keyframes shrinkWidth {
                        from { width: 100%; }
                        to { width: 0%; }
                    }
                `}</style>
            </div>
        </div>
    );
};
