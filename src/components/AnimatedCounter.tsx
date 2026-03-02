// components/AnimatedCounter.tsx
import { useCountAnimation } from '@/hooks/useCountAnimation';

interface AnimatedCounterProps {
    value: number;
    duration?: number;
    prefix?: string;
    suffix?: string;
    decimals?: number;
    className?: string;
}

export const AnimatedCounter = ({
    value,
    duration = 2000,
    prefix = '',
    suffix = '',
    decimals = 0,
    className = ''
}: AnimatedCounterProps) => {
    const count = useCountAnimation(value, duration);

    const formattedValue = decimals > 0
        ? (count / Math.pow(10, decimals)).toFixed(decimals)
        : count.toLocaleString();

    return (
        <span className={className}>
            {prefix}{formattedValue}{suffix}
        </span>
    );
};
