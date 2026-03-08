import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPWA() {
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showBanner, setShowBanner] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [showIOSGuide, setShowIOSGuide] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Check if already installed
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as any).standalone === true;
        if (isStandalone) return;

        // Check if dismissed before (last 3 days)
        const lastDismiss = localStorage.getItem('pwa-dismiss-time');
        if (lastDismiss && Date.now() - parseInt(lastDismiss) < 3 * 24 * 60 * 60 * 1000) return;

        // Detect iOS
        const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(ios);

        if (ios) {
            // iOS doesn't fire beforeinstallprompt — show manual guide after delay
            setTimeout(() => setShowBanner(true), 3000);
        }

        // Android / Chrome — listen for install prompt
        const handler = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e as BeforeInstallPromptEvent);
            setTimeout(() => setShowBanner(true), 3000);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (isIOS) {
            setShowIOSGuide(true);
            return;
        }
        if (!installPrompt) return;
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice.outcome === 'accepted') {
            setShowBanner(false);
            setInstallPrompt(null);
        }
    };

    const handleDismiss = () => {
        setShowBanner(false);
        setDismissed(true);
        localStorage.setItem('pwa-dismiss-time', Date.now().toString());
    };

    if (dismissed || (!showBanner)) return null;

    return (
        <>
            {/* Install Banner */}
            <AnimatePresence>
                {showBanner && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-6 md:w-96"
                    >
                        <div className="bg-gradient-to-r from-indigo-600/95 to-violet-600/95 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-indigo-400/30 flex items-center gap-3">
                            {/* App Icon */}
                            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                                <Smartphone className="w-6 h-6 text-white" />
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-white text-sm">Phone pe Install Karo</div>
                                <div className="text-indigo-200 text-xs mt-0.5 leading-tight">
                                    SM Payroll — home screen pe add karo, bilkul app jaisa
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={handleInstall}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-indigo-700 text-xs font-bold hover:bg-indigo-50 transition-colors"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Install
                                </button>
                                <button
                                    onClick={handleDismiss}
                                    className="p-2 rounded-xl text-indigo-200 hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* iOS Guide Modal */}
            <AnimatePresence>
                {showIOSGuide && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end justify-center p-4"
                        onClick={() => setShowIOSGuide(false)}
                    >
                        <motion.div
                            initial={{ y: 100 }}
                            animate={{ y: 0 }}
                            exit={{ y: 100 }}
                            className="w-full max-w-md bg-dark-card rounded-2xl p-6 border border-dark-border"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-white font-bold text-lg">iPhone pe Install Karo</h3>
                                <button onClick={() => setShowIOSGuide(false)} className="text-dark-muted hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="space-y-3">
                                {[
                                    { step: '1', text: 'Safari mein yeh page kholo', icon: '🌐' },
                                    { step: '2', text: 'Neeche Share button (⬆) dabao', icon: '📤' },
                                    { step: '3', text: '"Add to Home Screen" select karo', icon: '➕' },
                                    { step: '4', text: '"Add" dabao — App install ho jayegi!', icon: '✅' },
                                ].map(({ step, text, icon }) => (
                                    <div key={step} className="flex items-center gap-3 p-3 bg-dark-surface rounded-xl">
                                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-lg shrink-0">
                                            {icon}
                                        </div>
                                        <div className="text-sm text-white">{text}</div>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => setShowIOSGuide(false)}
                                className="mt-5 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors"
                            >
                                Samajh Gaya!
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
