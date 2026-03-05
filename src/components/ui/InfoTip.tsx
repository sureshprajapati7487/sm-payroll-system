/**
 * InfoTip.tsx — Global Reusable Info Tooltip Component
 *
 * Har jagah use karo jahan kisi field/setting ka explanation chahiye.
 *
 * Usage:
 *   <InfoTip id="ctcAmount" label="CTC Amount" />
 *   <InfoTip id="pfRate" label="PF Rate (%)" inline />
 *
 * Tips data: src/utils/allTips.ts mein add karo
 */

import { useState } from 'react';
import { allTips } from '@/utils/allTips';

interface InfoTipProps {
    /** Key jo allTips.ts mein hona chahiye */
    id: string;
    /** Field ka label text — agar label="" toh sirf ? button dikhega */
    label?: string;
    /** inline=true: label + ? ek hi line mein (default). inline=false: stacked */
    inline?: boolean;
    /** Extra CSS classes for wrapper div */
    className?: string;
}

/**
 * InfoTip — Click karo ? pe → explanation + example expand hota hai
 */
export function InfoTip({ id, label = '', inline = true, className = '' }: InfoTipProps) {
    const [open, setOpen] = useState(false);
    const tip = allTips[id];

    return (
        <div className={`${className}`}>
            {/* Label + ? Button Row */}
            <div className={`flex items-center gap-1.5 ${inline ? '' : 'mb-1'}`}>
                {label && (
                    <label className="text-xs text-slate-400 uppercase tracking-wide">
                        {label}
                    </label>
                )}
                {tip && (
                    <button
                        type="button"
                        onClick={() => setOpen(o => !o)}
                        className={`
                            w-4 h-4 rounded-full text-[10px] font-bold
                            flex items-center justify-center
                            transition-all duration-150 shrink-0
                            ${open
                                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                                : 'bg-slate-700 text-slate-400 hover:bg-orange-500/60 hover:text-white'
                            }
                        `}
                        title="Iske baare mein jaano"
                        aria-label={`${label || id} ke baare mein jaano`}
                        aria-expanded={open}
                    >
                        ?
                    </button>
                )}
            </div>

            {/* Explanation Panel */}
            {open && tip && (
                <div className="mt-1.5 rounded-xl border border-orange-500/30 bg-slate-900/95 p-3 shadow-xl shadow-black/30 text-left animate-in fade-in slide-in-from-top-1 duration-150">
                    <p className="text-[11px] font-bold text-orange-400 mb-1 flex items-center gap-1">
                        ℹ️ Matlab kya hai?
                    </p>
                    <p className="text-xs text-slate-300 leading-relaxed">{tip.meaning}</p>

                    {tip.example && (
                        <div className="mt-2 rounded-lg bg-slate-800 px-3 py-2">
                            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">📌 Example</p>
                            <pre className="text-xs text-green-400 whitespace-pre-wrap font-mono leading-relaxed">
                                {tip.example}
                            </pre>
                        </div>
                    )}

                    {tip.formula && (
                        <div className="mt-2 rounded-lg bg-blue-900/30 border border-blue-500/20 px-3 py-2">
                            <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">🔢 Formula</p>
                            <pre className="text-xs text-blue-300 whitespace-pre-wrap font-mono">{tip.formula}</pre>
                        </div>
                    )}

                    {tip.note && (
                        <p className="mt-2 text-[10px] text-amber-400/80 leading-relaxed">
                            ⚠️ {tip.note}
                        </p>
                    )}

                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="mt-2 text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
                    >
                        Band karo ✕
                    </button>
                </div>
            )}
        </div>
    );
}

export default InfoTip;
