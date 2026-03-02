import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ReportColumn {
    id: string;
    label: string;
    field: string;
    category: 'employee' | 'payroll' | 'attendance' | 'statutory';
    visible: boolean;
}

export interface ReportFilter {
    id: string;
    field: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
    value: string;
}

export interface CustomReportTemplate {
    id: string;
    name: string;
    description: string;
    columns: ReportColumn[];
    filters: ReportFilter[];
    createdAt: string;
    updatedAt: string;
}

interface CustomReportState {
    templates: CustomReportTemplate[];
    availableColumns: ReportColumn[];

    // Actions
    saveTemplate: (template: Omit<CustomReportTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void;
    updateTemplate: (id: string, updates: Partial<CustomReportTemplate>) => void;
    deleteTemplate: (id: string) => void;
    getTemplate: (id: string) => CustomReportTemplate | undefined;
}

const DEFAULT_COLUMNS: ReportColumn[] = [
    // Employee Info
    { id: 'emp_id', label: 'Employee ID', field: 'employeeId', category: 'employee', visible: true },
    { id: 'emp_name', label: 'Full Name', field: 'name', category: 'employee', visible: true },
    { id: 'emp_dept', label: 'Department', field: 'department', category: 'employee', visible: true },
    { id: 'emp_desg', label: 'Designation', field: 'designation', category: 'employee', visible: false },
    { id: 'emp_join', label: 'Joining Date', field: 'joiningDate', category: 'employee', visible: false },

    // Payroll Info
    { id: 'pay_basic', label: 'Basic Salary', field: 'basicSalary', category: 'payroll', visible: true },
    { id: 'pay_hra', label: 'HRA', field: 'hra', category: 'payroll', visible: false },
    { id: 'pay_gross', label: 'Gross Salary', field: 'grossSalary', category: 'payroll', visible: true },
    { id: 'pay_net', label: 'Net Salary', field: 'netSalary', category: 'payroll', visible: true },
    { id: 'pay_bank', label: 'Bank Account', field: 'bankAccount', category: 'payroll', visible: false },

    // Attendance Info
    { id: 'att_present', label: 'Days Present', field: 'presentDays', category: 'attendance', visible: true },
    { id: 'att_absent', label: 'Days Absent', field: 'absentDays', category: 'attendance', visible: false },
    { id: 'att_ot', label: 'Overtime Hours', field: 'overtimeHours', category: 'attendance', visible: false },

    // Statutory Info
    { id: 'stat_pf', label: 'PF Number', field: 'pfNumber', category: 'statutory', visible: false },
    { id: 'stat_esi', label: 'ESI Number', field: 'esiNumber', category: 'statutory', visible: false },
    { id: 'stat_pan', label: 'PAN Number', field: 'panNumber', category: 'statutory', visible: false },
];

export const useCustomReportStore = create<CustomReportState>()(
    persist(
        (set, get) => ({
            templates: [],
            availableColumns: DEFAULT_COLUMNS,

            saveTemplate: (template) => {
                const newTemplate: CustomReportTemplate = {
                    ...template,
                    id: `tpl-${Date.now()}`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                set(state => ({
                    templates: [...state.templates, newTemplate]
                }));
            },

            updateTemplate: (id, updates) => {
                set(state => ({
                    templates: state.templates.map(t =>
                        t.id === id
                            ? { ...t, ...updates, updatedAt: new Date().toISOString() }
                            : t
                    )
                }));
            },

            deleteTemplate: (id) => {
                set(state => ({
                    templates: state.templates.filter(t => t.id !== id)
                }));
            },

            getTemplate: (id) => {
                return get().templates.find(t => t.id === id);
            }
        }),
        {
            name: 'custom-report-store'
        }
    )
);
