// Phase 16: CTC Breakdown Calculator

import { CTCBreakdown } from '@/types/statutory';
import { StatutoryCalculator } from './statutoryCalculator';
import { ProfessionalTaxCalculator } from './professionalTax';
import { TDSCalculator } from './tdsCalculator';

export class CTCCalculator {
    /**
     * Calculate complete CTC breakdown
     */
    static calculateCTC(params: {
        basicSalary: number;
        hraPercentage?: number; // Default 40% of basic
        specialAllowancePercentage?: number; // Default 20% of basic
        state?: string; // For PT
        section80C?: number; // For TDS
        section80D?: number; // For TDS
    }): CTCBreakdown {
        const { basicSalary, state = 'MAHARASHTRA' } = params;

        // HRA = 40% of basic (standard)
        const hra = Math.round(basicSalary * (params.hraPercentage || 0.40));

        // Special Allowance = 20% of basic
        const specialAllowance = Math.round(basicSalary * (params.specialAllowancePercentage || 0.20));

        // Gross Salary = Basic + HRA + Special Allowance
        const grossSalary = basicSalary + hra + specialAllowance;

        // Calculate PF
        const pf = StatutoryCalculator.calculatePF(basicSalary);
        const employeePF = pf.employeeContribution;
        const employerPF = pf.employerContribution;

        // Calculate ESI
        const esi = StatutoryCalculator.calculateESI(grossSalary);
        const employeeESI = esi.employeeContribution;
        const employerESI = esi.employerContribution;

        // Calculate Professional Tax
        const professionalTax = ProfessionalTaxCalculator.calculatePT(grossSalary, state);

        // Calculate TDS (monthly)
        const monthlyTDS = TDSCalculator.calculateMonthlyTDS(grossSalary, {
            section80C: params.section80C,
            section80D: params.section80D
        });

        // Gratuity = 4.81% of basic (standard practice)
        const gratuity = Math.round(basicSalary * 0.0481);

        // Total CTC = Gross + Employer share (PF + ESI + Gratuity)
        const totalCTC = grossSalary + employerPF + employerESI + gratuity;

        // Total Deductions = Employee PF + Employee ESI + PT + TDS
        const totalDeductions = employeePF + employeeESI + professionalTax + monthlyTDS;

        // Net Salary = Gross - Total Deductions
        const netSalary = grossSalary - totalDeductions;

        return {
            // Employer Cost
            basicSalary,
            hra,
            specialAllowance,
            employerPF,
            employerESI,
            gratuity,
            totalCTC,

            // Employee Deductions
            employeePF,
            employeeESI,
            professionalTax,
            tds: monthlyTDS,
            totalDeductions,

            // In-hand
            grossSalary,
            netSalary
        };
    }

    /**
     * Calculate CTC from desired net salary (reverse calculation)
     */
    static calculateCTCFromNetSalary(desiredNetSalary: number, state = 'MAHARASHTRA'): CTCBreakdown {
        // Iterative approach to find CTC that gives desired net
        let basicSalary = Math.round(desiredNetSalary / 0.6); // Rough estimate
        let attempt = 0;
        const maxAttempts = 10;

        while (attempt < maxAttempts) {
            const ctc = this.calculateCTC({ basicSalary, state });
            const diff = ctc.netSalary - desiredNetSalary;

            if (Math.abs(diff) < 100) {
                // Close enough
                return ctc;
            }

            // Adjust basic salary
            basicSalary = Math.round(basicSalary - (diff / 0.6));
            attempt++;
        }

        return this.calculateCTC({ basicSalary, state });
    }

    /**
     * Get component-wise breakdown
     */
    static getComponentBreakdown(ctc: CTCBreakdown) {
        return {
            earnings: [
                { name: 'Basic Salary', amount: ctc.basicSalary },
                { name: 'HRA', amount: ctc.hra },
                { name: 'Special Allowance', amount: ctc.specialAllowance }
            ],
            employerContributions: [
                { name: 'PF (Employer)', amount: ctc.employerPF },
                { name: 'ESI (Employer)', amount: ctc.employerESI },
                { name: 'Gratuity', amount: ctc.gratuity }
            ],
            deductions: [
                { name: 'PF (Employee)', amount: ctc.employeePF },
                { name: 'ESI (Employee)', amount: ctc.employeeESI },
                { name: 'Professional Tax', amount: ctc.professionalTax },
                { name: 'TDS', amount: ctc.tds }
            ]
        };
    }
}
