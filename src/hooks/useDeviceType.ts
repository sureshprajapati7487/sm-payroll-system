import { useState, useEffect } from 'react';

export const useDeviceType = () => {
    const [deviceType, setDeviceType] = useState({
        isMobile: window.innerWidth < 768,
        isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
        isDesktop: window.innerWidth >= 1024
    });

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            setDeviceType({
                isMobile: width < 768,
                isTablet: width >= 768 && width < 1024,
                isDesktop: width >= 1024
            });
        };

        // Attach event listener
        window.addEventListener('resize', handleResize);

        // Call once to ensure accurate initial state if dimensions changed before mount
        handleResize();

        // Cleanup
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return deviceType;
};
