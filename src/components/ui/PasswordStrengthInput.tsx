import { useState, useMemo } from 'react';
import { Eye, EyeOff, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';

// ── Password rules ────────────────────────────────────────────────────────────
export interface PasswordCheck {
    label: string;
    pass: boolean;
}

export function getPasswordChecks(password: string): PasswordCheck[] {
    return [
        { label: 'Minimum 8 characters', pass: password.length >= 8 },
        { label: 'At least 1 number', pass: /[0-9]/.test(password) },
        { label: 'At least 1 letter', pass: /[a-zA-Z]/.test(password) },
        { label: 'No spaces', pass: !/\s/.test(password) && password.length > 0 },
    ];
}

export function getPasswordStrength(password: string): 0 | 1 | 2 | 3 {
    if (!password) return 0;
    const passed = getPasswordChecks(password).filter(c => c.pass).length;
    if (password.length >= 12 && passed === 4 && /[^a-zA-Z0-9]/.test(password)) return 3; // strong
    if (passed >= 3) return 2; // medium
    if (passed >= 1) return 1; // weak
    return 0;
}

export function isPasswordValid(password: string): boolean {
    return getPasswordChecks(password).every(c => c.pass);
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
    value: string;
    onChange: (v: string) => void;
    label?: string;
    placeholder?: string;
    required?: boolean;
    className?: string;
    /** If true, shows strength meter and rule checklist */
    showStrength?: boolean;
    /** If true, password input is shown as plain text by default */
    defaultVisible?: boolean;
}

const STRENGTH_META = [
    { label: 'Too weak', bar: 'bg-red-500', icon: ShieldX, text: 'text-red-400' },
    { label: 'Weak', bar: 'bg-orange-500', icon: ShieldAlert, text: 'text-orange-400' },
    { label: 'Medium', bar: 'bg-yellow-500', icon: ShieldAlert, text: 'text-yellow-400' },
    { label: 'Strong', bar: 'bg-green-500', icon: ShieldCheck, text: 'text-green-400' },
] as const;

const inputBaseCls = 'w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm focus:border-primary-500 outline-none transition-colors';

export const PasswordStrengthInput = ({
    value,
    onChange,
    label = 'Password',
    placeholder = 'Set password',
    required = false,
    className = '',
    showStrength = true,
    defaultVisible = false,
}: Props) => {
    const [visible, setVisible] = useState(defaultVisible);
    const [touched, setTouched] = useState(false);

    const checks = useMemo(() => getPasswordChecks(value), [value]);
    const strength = useMemo(() => getPasswordStrength(value), [value]);
    const meta = STRENGTH_META[strength];
    const StrengthIcon = meta.icon;

    // Only show hints after user starts typing
    const showHints = touched && value.length > 0 && showStrength;

    return (
        <div className={`space-y-1 ${className}`}>
            <label className="text-xs text-dark-muted uppercase tracking-wider">{label}</label>

            {/* Input row */}
            <div className="relative">
                <input
                    type={visible ? 'text' : 'password'}
                    value={value}
                    required={required}
                    placeholder={placeholder}
                    onFocus={() => setTouched(true)}
                    onChange={e => onChange(e.target.value)}
                    className={`${inputBaseCls} pr-10 font-mono ${showHints && !isPasswordValid(value)
                            ? 'border-orange-500/60'
                            : showHints && isPasswordValid(value)
                                ? 'border-green-500/60'
                                : ''
                        }`}
                />
                <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setVisible(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-white transition-colors"
                >
                    {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>

            {/* Strength bar + label */}
            {showHints && (
                <div className="space-y-2 pt-1">
                    {/* 4-segment strength bar */}
                    <div className="flex gap-1">
                        {[1, 2, 3, 4].map(seg => (
                            <div
                                key={seg}
                                className={`h-1 flex-1 rounded-full transition-all duration-300 ${seg <= strength + 1 ? meta.bar : 'bg-dark-border'
                                    }`}
                            />
                        ))}
                    </div>

                    {/* Strength label + icon */}
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${meta.text}`}>
                        <StrengthIcon className="w-3.5 h-3.5" />
                        {meta.label}
                    </div>

                    {/* Rule checklist */}
                    <ul className="space-y-0.5">
                        {checks.map(chk => (
                            <li
                                key={chk.label}
                                className={`flex items-center gap-1.5 text-xs transition-colors ${chk.pass ? 'text-green-400' : 'text-dark-muted'
                                    }`}
                            >
                                <span className="font-bold">{chk.pass ? '✓' : '○'}</span>
                                {chk.label}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
