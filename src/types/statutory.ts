// Phase 16: Statutory Compliance Types for India

export interface PFCalculation {
    employeeContribution: number;
    employerContribution: number;
    totalPF: number;
    isApplicable: boolean;
    reason?: string;
}

export interface ESICalculation {
    employeeContribution: number;
    employerContribution: number;
    totalESI: number;
    isApplicable: boolean;
    reason?: string;
}

export interface ProfessionalTaxSlab {
    state: string;
    slabs: {
        from: number;
        to: number;
        tax: number;
    }[];
}

export interface TDSCalculation {
    grossIncome: number;
    standardDeduction: number;
    section80C: number; // Investments
    section80D: number; // Medical insurance
    otherDeductions: number;
    taxableIncome: number;
    oldRegimeTax: number;
    newRegimeTax: number;
    recommendedRegime: 'OLD' | 'NEW';
    monthlyTDS: number;
}

export interface CTCBreakdown {
    // Employer Cost
    basicSalary: number;
    hra: number;
    specialAllowance: number;
    employerPF: number;
    employerESI: number;
    gratuity: number;
    totalCTC: number;

    // Employee Deductions
    employeePF: number;
    employeeESI: number;
    professionalTax: number;
    tds: number;
    totalDeductions: number;

    // In-hand Salary
    grossSalary: number;
    netSalary: number;
}

export interface Form16Data {
    employeeId: string;
    employeeName: string;
    panNumber: string;
    financialYear: string;
    tanNumber: string; // Company TAN
    employerName: string;
    grossSalary: number;
    deductions: {
        section80C: number;
        section80D: number;
        standardDeduction: number;
        other: number;
    };
    taxableIncome: number;
    taxDeducted: number;
    quarters: {
        q1: { salary: number; tds: number };
        q2: { salary: number; tds: number };
        q3: { salary: number; tds: number };
        q4: { salary: number; tds: number };
    };
}
