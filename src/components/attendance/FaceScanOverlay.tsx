import { CheckCircle } from 'lucide-react';

// ── Animated Face Overlay ──────────────────────────────────────────────────────
export const FaceScanOverlay = ({ scanned }: { scanned: boolean }) => (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Corner brackets */}
        <div className="relative w-36 h-44">
            {/* Top-left */}
            <span className={`absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 rounded-tl-lg transition-all duration-700 ${scanned ? 'border-green-400' : 'border-blue-400'}`} />
            {/* Top-right */}
            <span className={`absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 rounded-tr-lg transition-all duration-700 ${scanned ? 'border-green-400' : 'border-blue-400'}`} />
            {/* Bottom-left */}
            <span className={`absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 rounded-bl-lg transition-all duration-700 ${scanned ? 'border-green-400' : 'border-blue-400'}`} />
            {/* Bottom-right */}
            <span className={`absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 rounded-br-lg transition-all duration-700 ${scanned ? 'border-green-400' : 'border-blue-400'}`} />
            {/* Oval face guide */}
            <div className={`absolute inset-4 rounded-full border-2 border-dashed transition-all duration-700 ${scanned ? 'border-green-400/60' : 'border-blue-400/40 animate-pulse'}`} />
            {/* Scan line */}
            {!scanned && (
                <div
                    className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent"
                    style={{ animation: 'scanline 2s linear infinite', top: '30%' }}
                />
            )}
            {scanned && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-green-400 drop-shadow-lg" />
                </div>
            )}
        </div>
    </div>
);
