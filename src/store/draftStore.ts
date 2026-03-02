import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Draft {
    id: string;
    type: 'payroll' | 'attendance' | 'employee' | 'loan';
    entityId?: string;
    title: string;
    data: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
    autoSaved: boolean;
    syncStatus: 'synced' | 'pending' | 'offline';
}

interface DraftState {
    drafts: Draft[];
    autoSaveEnabled: boolean;
    lastSyncTime: string | null;

    // Actions
    saveDraft: (draft: Omit<Draft, 'id' | 'createdAt' | 'updatedAt' | 'autoSaved' | 'syncStatus'>) => void;
    updateDraft: (id: string, data: Partial<Draft['data']>) => void;
    deleteDraft: (id: string) => void;
    getDraft: (id: string) => Draft | undefined;
    getDraftsByType: (type: Draft['type']) => Draft[];
    toggleAutoSave: () => void;
    markSynced: (id: string) => void;
}

export const useDraftStore = create<DraftState>()(
    persist(
        (set, get) => ({
            drafts: [],
            autoSaveEnabled: true,
            lastSyncTime: null,

            saveDraft: (draft) => {
                const newDraft: Draft = {
                    ...draft,
                    id: `draft-${Date.now()}`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    autoSaved: get().autoSaveEnabled,
                    syncStatus: 'pending'
                };

                set(state => ({
                    drafts: [...state.drafts, newDraft]
                }));
            },

            updateDraft: (id, data) => {
                set(state => ({
                    drafts: state.drafts.map(d =>
                        d.id === id
                            ? {
                                ...d,
                                data: { ...d.data, ...data },
                                updatedAt: new Date().toISOString(),
                                syncStatus: 'pending' as const
                            }
                            : d
                    )
                }));
            },

            deleteDraft: (id) => {
                set(state => ({
                    drafts: state.drafts.filter(d => d.id !== id)
                }));
            },

            getDraft: (id) => {
                return get().drafts.find(d => d.id === id);
            },

            getDraftsByType: (type) => {
                return get().drafts.filter(d => d.type === type);
            },

            toggleAutoSave: () => {
                set(state => ({
                    autoSaveEnabled: !state.autoSaveEnabled
                }));
            },

            markSynced: (id) => {
                set(state => ({
                    drafts: state.drafts.map(d =>
                        d.id === id ? { ...d, syncStatus: 'synced' as const } : d
                    ),
                    lastSyncTime: new Date().toISOString()
                }));
            }
        }),
        {
            name: 'draft-store'
        }
    )
);

// Auto-save hook
export const useAutoSave = (draftId: string, data: Record<string, unknown>, _delay = 2000) => {
    const { updateDraft, autoSaveEnabled } = useDraftStore();

    // In real implementation, use debounced effect
    const save = () => {
        if (autoSaveEnabled) {
            updateDraft(draftId, data);
        }
    };

    return { save };
};
