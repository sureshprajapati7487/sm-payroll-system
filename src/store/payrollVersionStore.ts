import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PayrollVersion {
    id: string;
    versionNumber: number;
    month: string;
    year: number;
    createdAt: string;
    createdBy: string;
    status: 'draft' | 'simulated' | 'finalized' | 'rolled-back';
    totalEmployees: number;
    totalAmount: number;
    changes: string[];
    snapshotData: Record<string, unknown>;
}

interface PayrollVersionState {
    versions: PayrollVersion[];
    currentVersion: PayrollVersion | null;

    // Actions
    createVersion: (month: string, year: number, userId: string) => PayrollVersion;
    finalizeVersion: (versionId: string) => void;
    rollbackToVersion: (versionId: string) => void;
    getVersionHistory: (month: string, year: number) => PayrollVersion[];
    compareVersions: (v1: string, v2: string) => { added: string[]; removed: string[]; modified: string[] };
}

export const usePayrollVersionStore = create<PayrollVersionState>()(
    persist(
        (set, get) => ({
            versions: [],
            currentVersion: null,

            createVersion: (month, year, userId) => {
                const versionNumber = get().versions.filter(v =>
                    v.month === month && v.year === year
                ).length + 1;

                const newVersion: PayrollVersion = {
                    id: `version-${Date.now()}`,
                    versionNumber,
                    month,
                    year,
                    createdAt: new Date().toISOString(),
                    createdBy: userId,
                    status: 'draft',
                    totalEmployees: 0,
                    totalAmount: 0,
                    changes: [],
                    snapshotData: {}
                };

                set(state => ({
                    versions: [...state.versions, newVersion],
                    currentVersion: newVersion
                }));

                return newVersion;
            },

            finalizeVersion: (versionId) => {
                set(state => ({
                    versions: state.versions.map(v =>
                        v.id === versionId ? { ...v, status: 'finalized' as const } : v
                    )
                }));
            },

            rollbackToVersion: (versionId) => {
                const version = get().versions.find(v => v.id === versionId);
                if (!version) return;

                // Mark current as rolled-back
                set(state => ({
                    versions: state.versions.map(v =>
                        v.status === 'finalized' && v.month === version.month && v.year === version.year
                            ? { ...v, status: 'rolled-back' as const }
                            : v
                    ),
                    currentVersion: version
                }));

                // Create new version from rollback
                const newVersion: PayrollVersion = {
                    ...version,
                    id: `version-${Date.now()}`,
                    versionNumber: get().versions.filter(v =>
                        v.month === version.month && v.year === version.year
                    ).length + 1,
                    createdAt: new Date().toISOString(),
                    status: 'draft',
                    changes: [...version.changes, `Rolled back to v${version.versionNumber}`]
                };

                set(state => ({
                    versions: [...state.versions, newVersion],
                    currentVersion: newVersion
                }));
            },

            getVersionHistory: (month, year) => {
                return get().versions.filter(v => v.month === month && v.year === year)
                    .sort((a, b) => b.versionNumber - a.versionNumber);
            },

            compareVersions: (v1Id, v2Id) => {
                const ver1 = get().versions.find(v => v.id === v1Id);
                const ver2 = get().versions.find(v => v.id === v2Id);

                if (!ver1 || !ver2) {
                    return { added: [], removed: [], modified: [] };
                }

                // Simplified comparison
                return {
                    added: ver2.changes.filter(c => !ver1.changes.includes(c)),
                    removed: ver1.changes.filter(c => !ver2.changes.includes(c)),
                    modified: []
                };
            }
        }),
        {
            name: 'payroll-version-store'
        }
    )
);
