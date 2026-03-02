import { useEffect } from 'react';

export const ForceIpRedirect = () => {
    useEffect(() => {
        if (window.location.hostname === 'localhost') {
            const newUrl = window.location.href.replace('localhost', '127.0.0.1');
            window.location.replace(newUrl);
        }
    }, []);

    return null;
};
