// Phase 22: Skeleton Loader Components — Enhanced with shimmer & more variants

// ── Shimmer base class (shared) ───────────────────────────────────────────────
const S = 'bg-dark-border/60 rounded animate-pulse';

// ── 1. Generic stat cards (4-col) ─────────────────────────────────────────────
export const SkeletonStats = ({ cols = 4 }: { cols?: number }) => (
    <div className={`grid grid-cols-2 md:grid-cols-${cols} gap-4`}>
        {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="glass rounded-2xl p-5 space-y-3 border border-dark-border">
                <div className={`h-3 ${S} w-1/2`} />
                <div className={`h-8 ${S} w-3/4`} />
                <div className={`h-3 ${S} w-1/3`} />
            </div>
        ))}
    </div>
);

// ── 2. Table skeleton ──────────────────────────────────────────────────────────
export const SkeletonTable = ({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) => (
    <div className="glass rounded-2xl overflow-hidden border border-dark-border">
        {/* Header */}
        <div className="flex gap-4 p-4 border-b border-dark-border bg-dark-bg/30">
            {Array.from({ length: cols }).map((_, i) => (
                <div key={i} className={`flex-1 h-3 ${S}`} />
            ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-4 p-4 border-b border-dark-border/40 items-center">
                {/* Avatar-like first cell */}
                <div className={`w-9 h-9 rounded-full ${S} shrink-0`} />
                <div className={`flex-[2] h-3.5 ${S}`} />
                {Array.from({ length: cols - 2 }).map((_, j) => (
                    <div key={j} className={`flex-1 h-3.5 ${S}`} />
                ))}
            </div>
        ))}
    </div>
);

// ── 3. Card grid skeleton (for Employee list) ──────────────────────────────────
export const SkeletonCardGrid = ({ cards = 6 }: { cards?: number }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="glass rounded-2xl border border-dark-border p-6 flex flex-col items-center gap-4">
                <div className={`w-20 h-20 rounded-full ${S}`} />
                <div className={`h-4 ${S} w-2/3`} />
                <div className={`h-3 ${S} w-1/2`} />
                <div className={`h-3 ${S} w-1/4`} />
                <div className="w-full border-t border-dark-border pt-4 flex justify-between">
                    <div className="space-y-1.5 w-1/3">
                        <div className={`h-2.5 ${S} w-full`} />
                        <div className={`h-3 ${S} w-3/4`} />
                    </div>
                    <div className="space-y-1.5 w-1/3">
                        <div className={`h-2.5 ${S} w-full`} />
                        <div className={`h-3 ${S} w-3/4`} />
                    </div>
                </div>
            </div>
        ))}
    </div>
);

// ── 4. List skeleton (leave requests, approvals) ───────────────────────────────
export const SkeletonList = ({ items = 5 }: { items?: number }) => (
    <div className="space-y-3">
        {Array.from({ length: items }).map((_, i) => (
            <div key={i} className="glass rounded-xl border border-dark-border p-4 flex items-center gap-4">
                <div className={`w-11 h-11 rounded-full ${S} shrink-0`} />
                <div className="flex-1 space-y-2">
                    <div className={`h-4 ${S} w-1/3`} />
                    <div className={`h-3 ${S} w-1/2`} />
                </div>
                <div className={`h-7 w-20 rounded-full ${S}`} />
            </div>
        ))}
    </div>
);

// ── 5. Single card skeleton ────────────────────────────────────────────────────
export const SkeletonCard = () => (
    <div className="glass rounded-2xl border border-dark-border p-6 space-y-3">
        <div className={`h-4 ${S} w-1/3`} />
        <div className={`h-8 ${S} w-2/3`} />
        <div className={`h-4 ${S} w-full`} />
    </div>
);

// ── 6. Form skeleton ───────────────────────────────────────────────────────────
export const SkeletonForm = () => (
    <div className="glass rounded-2xl border border-dark-border p-6 space-y-5">
        {[1, 2, 3].map(i => (
            <div key={i}>
                <div className={`h-3 ${S} w-1/4 mb-2`} />
                <div className={`h-10 ${S} w-full`} />
            </div>
        ))}
        <div className={`h-12 ${S} w-full`} />
    </div>
);

// ── 7. Page-level full skeleton (stats + table) ────────────────────────────────
export const SkeletonPage = ({
    statCols = 4,
    tableRows = 6,
    tableCols = 5,
    title = true
}: {
    statCols?: number;
    tableRows?: number;
    tableCols?: number;
    title?: boolean;
}) => (
    <div className="space-y-6">
        {title && (
            <div className="space-y-2">
                <div className={`h-7 ${S} w-48`} />
                <div className={`h-4 ${S} w-72`} />
            </div>
        )}
        <SkeletonStats cols={statCols} />
        <SkeletonTable rows={tableRows} cols={tableCols} />
    </div>
);
