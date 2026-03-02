// Phase 21: Multi-Company / Multi-Tenant Types

export interface Company {
    id: string;
    name: string;
    displayName: string;
    logo?: string;
    industry: string;
    address: {
        street: string;
        city: string;
        state: string;
        pincode: string;
        country: string;
    };
    contact: {
        email: string;
        phone: string;
        website?: string;
    };
    taxInfo: {
        pan: string;
        tan: string;
        gstin?: string;
    };
    settings: {
        currency: string;
        timezone: string;
        dateFormat: string;
        financialYearStart: string; // MM-DD format
    };
    subscription: {
        plan: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
        status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
        validUntil: string;
        employeeLimit: number;
    };
    createdAt: string;
    createdBy: string;
    isActive: boolean;
}

export interface Branch {
    id: string;
    companyId: string;
    name: string;
    code: string;
    address: {
        street: string;
        city: string;
        state: string;
        pincode: string;
    };
    manager?: string; // Employee ID
    departments: string[];
    isHeadquarters: boolean;
    isActive: boolean;
    createdAt: string;
}

export interface CompanyContext {
    currentCompany: Company | null;
    currentBranch: Branch | null;
    availableCompanies: Company[];
    switchCompany: (companyId: string) => void;
    switchBranch: (branchId: string) => void;
}

export interface MultiTenantConfig {
    isolationLevel: 'SCHEMA' | 'DATABASE' | 'LOGICAL';
    sharedResources: {
        users: boolean; // Can users access multiple companies?
        masterData: boolean; // Share departments, designations?
    };
    billingMode: 'PER_COMPANY' | 'CONSOLIDATED';
}
