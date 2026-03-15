/**
 * MaskedField — Visual indicator for redacted / masked sensitive data
 *
 * Usage:
 *   <MaskedField value={maskSalary(employee.basicSalary)} isMasked={!canViewSalary} />
 *   <MaskedField value={maskAadhaar(emp.bankDetails.aadharNumber)} isMasked={!canViewFullBank} />
 */
import { Lock } from 'lucide-react';

interface MaskedFieldProps {
    /** The (already masked or unmasked) string to display */
    value: string;
    /** If true, renders the value with a lock icon + reddish styling */
    isMasked: boolean;
    /** Extra className on the container */
    className?: string;
    /** Tooltip text override — defaults to "You don't have permission to view this field" */
    tooltip?: string;
}

export const MaskedField = ({
    value,
    isMasked,
    className = '',
    tooltip = "You don't have permission to view this field",
}: MaskedFieldProps) => {
    if (!isMasked) {
        return <span className={className}>{value}</span>;
    }

    return (
        <span
            className={`inline-flex items-center gap-1 group/masked relative cursor-help ${className}`}
            title={tooltip}
        >
            {/* Masked value with tracking for a "redacted" feel */}
            <span className="font-mono text-dark-muted/70 tracking-widest select-none">
                {value}
            </span>
            <Lock className="w-3 h-3 text-dark-muted/50 flex-shrink-0" />

            {/* Tooltip */}
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-dark-card border border-dark-border rounded-lg text-[10px] text-dark-muted whitespace-nowrap
                opacity-0 invisible group-hover/masked:opacity-100 group-hover/masked:visible transition-all z-50 shadow-xl pointer-events-none">
                🔒 {tooltip}
            </span>
        </span>
    );
};
