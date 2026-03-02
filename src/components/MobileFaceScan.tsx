import { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle, XCircle, Loader, Sun, Zap } from 'lucide-react';
import Webcam from 'react-webcam';

interface MobileFaceScanProps {
    onCapture: (imageSrc: string) => void;
    onCancel: () => void;
}

export const MobileFaceScan = ({ onCapture, onCancel }: MobileFaceScanProps) => {
    const webcamRef = useRef<Webcam>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [lightLevel, setLightLevel] = useState<'good' | 'low' | 'checking'>('checking');
    const [flash, setFlash] = useState(false);

    useEffect(() => {
        // Simulate light level detection
        setTimeout(() => {
            setLightLevel('good'); // In production, use actual light detection
        }, 1000);
    }, []);

    const capture = () => {
        if (webcamRef.current) {
            setIsCapturing(true);

            // Flash effect for low light
            if (lightLevel === 'low') {
                setFlash(true);
                setTimeout(() => setFlash(false), 100);
            }

            setTimeout(() => {
                const imageSrc = webcamRef.current?.getScreenshot();
                if (imageSrc) {
                    setCapturedImage(imageSrc);
                }
                setIsCapturing(false);
            }, lightLevel === 'low' ? 150 : 50);
        }
    };

    const confirmCapture = () => {
        if (capturedImage) {
            onCapture(capturedImage);
        }
    };

    const retake = () => {
        setCapturedImage(null);
    };

    const videoConstraints = {
        width: 1280,
        height: 720,
        facingMode: 'user',
        aspectRatio: 16 / 9
    };

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
            {/* Header */}
            <div className="bg-dark-card/90 backdrop-blur-sm p-4 flex items-center justify-between">
                <div>
                    <h2 className="text-white font-semibold">Face Recognition Check-In</h2>
                    <p className="text-dark-muted text-xs">Position your face in the frame</p>
                </div>
                <button
                    onClick={onCancel}
                    className="p-2 hover:bg-white/10 rounded-lg transition-all"
                >
                    <XCircle className="w-6 h-6 text-white" />
                </button>
            </div>

            {/* Camera View */}
            <div className="flex-1 relative flex items-center justify-center bg-black">
                {!capturedImage ? (
                    <>
                        <Webcam
                            ref={webcamRef}
                            audio={false}
                            screenshotFormat="image/jpeg"
                            videoConstraints={videoConstraints}
                            className="w-full h-full object-cover"
                            mirrored
                        />

                        {/* Flash overlay */}
                        {flash && (
                            <div className="absolute inset-0 bg-white animate-pulse" />
                        )}

                        {/* Face guide overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-64 h-80 border-4 border-primary-500 rounded-full opacity-50">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-8">
                                    <div className="text-white text-sm bg-black/50 px-3 py-1 rounded-full">
                                        Align your face
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Light level indicator */}
                        {lightLevel !== 'checking' && (
                            <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/50 px-3 py-2 rounded-lg">
                                <Sun className={`w-4 h-4 ${lightLevel === 'good' ? 'text-green-400' : 'text-yellow-400'}`} />
                                <span className="text-white text-xs">
                                    {lightLevel === 'good' ? 'Good Light' : 'Low Light'}
                                </span>
                                {lightLevel === 'low' && (
                                    <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <img
                        src={capturedImage}
                        alt="Captured"
                        className="w-full h-full object-cover"
                    />
                )}
            </div>

            {/* Bottom Controls */}
            <div className="bg-dark-card/90 backdrop-blur-sm p-6">
                {!capturedImage ? (
                    <div className="flex flex-col items-center gap-4">
                        <button
                            onClick={capture}
                            disabled={isCapturing || lightLevel === 'checking'}
                            className="w-20 h-20 rounded-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-lg"
                        >
                            {isCapturing ? (
                                <Loader className="w-8 h-8 text-white animate-spin" />
                            ) : (
                                <Camera className="w-8 h-8 text-white" />
                            )}
                        </button>

                        {lightLevel === 'low' && (
                            <div className="text-center">
                                <p className="text-yellow-400 text-sm">Low light detected</p>
                                <p className="text-dark-muted text-xs">Flash will be used automatically</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={retake}
                            className="flex items-center justify-center gap-2 bg-dark-surface hover:bg-white/5 text-white px-6 py-4 rounded-xl transition-all"
                        >
                            <XCircle className="w-5 h-5" />
                            Retake
                        </button>
                        <button
                            onClick={confirmCapture}
                            className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-6 py-4 rounded-xl transition-all"
                        >
                            <CheckCircle className="w-5 h-5" />
                            Confirm
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
