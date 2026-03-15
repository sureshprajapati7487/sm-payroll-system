import { useEffect } from 'react';
import { useSecurityStore } from '@/store/securityStore';

export const ForceIpRedirect = () => {
    useEffect(() => {
        // Fetch current IP into the security store for gating access
        useSecurityStore.getState().fetchCurrentIp();

        if (window.location.hostname === 'localhost') {
            const newUrl = window.location.href.replace('localhost', '127.0.0.1');
            window.location.replace(newUrl);
        }
    }, []);

    return null;
};
