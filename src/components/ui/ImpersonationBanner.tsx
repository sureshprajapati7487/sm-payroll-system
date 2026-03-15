import { useAuthStore } from '@/store/authStore';
import { ShieldAlert, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const ImpersonationBanner = () => {
    const { impersonatedRole, setImpersonatedRole } = useAuthStore();

    if (!impersonatedRole) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -50, opacity: 0 }}
                className="fixed top-0 left-0 right-0 z-[100] px-4 py-2 bg-amber-500 text-amber-950 font-medium flex items-center justify-center gap-3 shadow-lg shadow-amber-500/20"
            >
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <span className="text-sm">
                    👀 You are previewing the app as <strong className="font-extrabold px-1 tracking-wide">{impersonatedRole.replace(/_/g, ' ')}</strong>. Modifications you make will use this role's permissions.
                </span>
                <button
                    onClick={() => setImpersonatedRole(null)}
                    className="ml-4 flex items-center gap-1.5 px-3 py-1 bg-amber-950/10 hover:bg-amber-950/20 rounded-md transition-all text-sm font-bold active:scale-95 shrink-0"
                >
                    <X className="w-4 h-4" /> Stop Preview
                </button>
            </motion.div>
        </AnimatePresence>
    );
};
