import { useEffect } from 'react';
import { useSecurityStore } from '@/store/securityStore';

export const ForceIpRedirect = () => {
    useEffect(() => {
        // Fetch current IP into the security store for gating access
        useSecurityStore.getState().fetchCurrentIp();

        if (window.location.hostname === 'localhost') {
            // Replace only the hostname portion, not any occurrence of "localhost" in the URL
            const newUrl = window.location.href.replace(
                /^(https?:\/\/)localhost(:\d+)?/,
                `$1127.0.0.1$2`
            );
            window.location.replace(newUrl);
        }
    }, []);

    return null;
};
