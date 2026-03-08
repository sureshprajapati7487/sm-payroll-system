import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CustomFieldType = 'text' | 'number' | 'date' | 'select';

export interface CustomField {
    id: string;
    module: 'employee'; // Extensible for future modules (e.g., 'loan', 'leave')
    name: string;
    type: CustomFieldType;
    required: boolean;
    options?: string[]; // Comma-separated or array of options for 'select' type
    isActive: boolean;
}

interface CustomFieldState {
    fields: CustomField[];
    addField: (field: Omit<CustomField, 'id'>) => void;
    updateField: (id: string, updates: Partial<CustomField>) => void;
    deleteField: (id: string) => void;
    getFieldsByModule: (module: CustomField['module']) => CustomField[];
}

export const useCustomFieldStore = create<CustomFieldState>()(
    persist(
        (set, get) => ({
            fields: [],

            addField: (field) => {
                const newField: CustomField = {
                    ...field,
                    id: Math.random().toString(36).substr(2, 9),
                };
                set((state) => ({ fields: [...state.fields, newField] }));
            },

            updateField: (id, updates) => {
                set((state) => ({
                    fields: state.fields.map((f) => (f.id === id ? { ...f, ...updates } : f)),
                }));
            },

            deleteField: (id) => {
                set((state) => ({
                    fields: state.fields.filter((f) => f.id !== id),
                }));
            },

            getFieldsByModule: (module) => {
                return get().fields.filter((f) => f.module === module && f.isActive);
            },
        }),
        {
            name: 'sm-custom-fields-v1',
        }
    )
);
