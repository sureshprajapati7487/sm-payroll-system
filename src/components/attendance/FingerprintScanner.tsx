import { CheckCircle, Fingerprint } from 'lucide-react';

// ── Fingerprint Scanner UI ────────────────────────────────────────────────────
export const FingerprintScanner = ({
    scanning, progress, verified
}: { scanning: boolean; progress: number; verified: boolean }) => (
    <div className="flex flex-col items-center gap-4 py-4">
        {/* Ring */}
        <div className="relative w-28 h-28">
            {/* Background ring */}
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" fill="none" stroke="#1e293b" strokeWidth="6" />
                <circle
                    cx="50" cy="50" r="44" fill="none"
                    stroke={verified ? '#22c55e' : scanning ? '#60a5fa' : '#334155'}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 44}`}
                    strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
                    style={{ transition: 'stroke-dashoffset 0.3s ease, stroke 0.5s ease' }}
                />
            </svg>
            {/* Center icon */}
            <div className={`absolute inset-3 rounded-full flex items-center justify-center transition-all duration-500 ${verified ? 'bg-green-500/15' : scanning ? 'bg-blue-500/15' : 'bg-slate-800'}`}>
                {verified ? (
                    <CheckCircle className="w-10 h-10 text-green-400" />
                ) : (
                    <Fingerprint className={`w-10 h-10 transition-all duration-300 ${scanning ? 'text-blue-400' : 'text-slate-500'}`} />
                )}
            </div>
            {/* Ripple when scanning */}
            {scanning && (
                <span className="absolute inset-0 rounded-full border-2 border-blue-400/30 animate-ping" />
            )}
        </div>

        <p className={`text-sm font-semibold text-center transition-colors duration-300 ${verified ? 'text-green-400' : scanning ? 'text-blue-400' : 'text-slate-400'}`}>
            {verified ? '✅ Fingerprint Verified!' : scanning ? `Scanning... ${Math.round(progress)}%` : 'Button dabao aur finger rakh do'}
        </p>
        {scanning && (
            <div className="w-full bg-slate-800 rounded-full h-1">
                <div
                    className="bg-gradient-to-r from-blue-500 to-indigo-400 h-1 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>
        )}
    </div>
);
