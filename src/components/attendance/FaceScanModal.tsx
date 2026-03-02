import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { ScanFace, CheckCircle2, Loader2, Camera } from 'lucide-react';
import { clsx } from 'clsx';

interface FaceScanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (imageSrc: string) => void;
    mode: 'IN' | 'OUT';
}

export const FaceScanModal = ({ isOpen, onClose, onSuccess, mode }: FaceScanModalProps) => {
    const webcamRef = useRef<Webcam>(null);
    const [step, setStep] = useState<'IDLE' | 'SCANNING' | 'VERIFYING' | 'SUCCESS' | 'FAILED'>('IDLE');
    const [scanProgress, setScanProgress] = useState(0);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('IDLE');
            setScanProgress(0);
        }
    }, [isOpen]);

    const startScan = useCallback(() => {
        setStep('SCANNING');

        // Simulate Scanning Progress
        let progress = 0;
        const interval = setInterval(() => {
            progress += 5;
            setScanProgress(progress);

            if (progress >= 100) {
                clearInterval(interval);
                setStep('VERIFYING');

                // Simulate Verification Delay
                setTimeout(() => {
                    setStep('SUCCESS');
                    // Capture Image
                    const imageSrc = webcamRef.current?.getScreenshot();

                    setTimeout(() => {
                        if (imageSrc) onSuccess(imageSrc);
                        onClose();
                    }, 1500);
                }, 1500);
            }
        }, 100);
    }, [onSuccess, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-2xl overflow-hidden shadow-2xl relative">

                {/* Header */}
                <div className="p-4 bg-dark-bg/50 border-b border-dark-border flex justify-between items-center">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <ScanFace className="text-primary-500" />
                        Face Attendance: Check {mode}
                    </h3>
                    <button onClick={onClose} className="text-dark-muted hover:text-white">✕</button>
                </div>

                {/* Camera View */}
                <div className="relative aspect-[4/3] bg-black group overflow-hidden">
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        className={clsx(
                            "w-full h-full object-cover opacity-80",
                            step === 'SUCCESS' && "opacity-100"
                        )}
                        mirrored={true}
                    />

                    {/* Overlay UI */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">

                        {/* Scanning Animation Frame */}
                        {step === 'SCANNING' && (
                            <div className="absolute inset-0 border-2 border-primary-500/50 animate-pulse">
                                <div className="absolute top-0 left-0 w-full h-1 bg-primary-500 shadow-[0_0_20px_theme(colors.primary.500)] animate-[scan_2s_ease-in-out_infinite]" />
                            </div>
                        )}

                        {/* Face Box Target */}
                        {step === 'IDLE' && (
                            <div className="w-48 h-64 border-2 border-dashed border-white/50 rounded-3xl" />
                        )}

                        {/* State Messages */}
                        {step === 'VERIFYING' && (
                            <div className="bg-black/70 px-6 py-3 rounded-full flex items-center gap-3 backdrop-blur-md">
                                <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                                <span className="text-white font-medium">Matching Face ID...</span>
                            </div>
                        )}

                        {step === 'SUCCESS' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-success/20 backdrop-blur-sm animate-in zoom-in duration-300">
                                <div className="bg-white rounded-full p-4 shadow-xl">
                                    <CheckCircle2 className="w-12 h-12 text-success" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-6 bg-dark-card flex flex-col items-center gap-4">
                    {step === 'IDLE' && (
                        <button
                            onClick={startScan}
                            className="w-full py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-primary-600/20 flex items-center justify-center gap-2 transition-all"
                        >
                            <Camera className="w-5 h-5" />
                            Scan My Face
                        </button>
                    )}

                    {step === 'SCANNING' && (
                        <div className="w-full">
                            <div className="flex justify-between text-xs text-dark-muted mb-2">
                                <span>Scanning generic features...</span>
                                <span>{scanProgress}%</span>
                            </div>
                            <div className="w-full h-2 bg-dark-bg rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary-500 transition-all duration-100"
                                    style={{ width: `${scanProgress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <p className="text-xs text-center text-dark-muted">
                        Wait for the green focus box. Ensure good lighting. <br />
                        One Face = One Employee ID.
                    </p>
                </div>
            </div>
        </div>
    );
};
