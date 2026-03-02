// Phase 16: PF & ESI Calculation Engine

import { PFCalculation, ESICalculation } from '@/types/statutory';

export class StatutoryCalculator {
    // PF Thresholds (as of 2024)
    private static readonly PF_WAGE_CEILING = 15000;
    private static readonly PF_EMPLOYEE_RATE = 0.12; // 12%
    private static readonly PF_EMPLOYER_RATE = 0.12; // 12% (3.67% EPF + 8.33% EPS)

    // ESI Thresholds (as of 2024)
    private static readonly ESI_WAGE_CEILING = 21000;
    private static readonly ESI_EMPLOYEE_RATE = 0.0075; // 0.75%
    private static readonly ESI_EMPLOYER_RATE = 0.0325; // 3.25%

    /**
     * Calculate PF (Provident Fund)
     */
    static calculatePF(basicSalary: number): PFCalculation {
        // PF is mandatory if basic <= 15,000
        // Optional if basic > 15,000

        if (basicSalary <= 0) {
            return {
                employeeContribution: 0,
                employerContribution: 0,
                totalPF: 0,
                isApplicable: false,
                reason: 'Invalid salary'
            };
        }

        // Calculate on actual basic or ceiling, whichever is lower
        const pfWage = Math.min(basicSalary, this.PF_WAGE_CEILING);

        const employeeContribution = Math.round(pfWage * this.PF_EMPLOYEE_RATE);
        const employerContribution = Math.round(pfWage * this.PF_EMPLOYER_RATE);

        return {
            employeeContribution,
            employerContribution,
            totalPF: employeeContribution + employerContribution,
            isApplicable: true
        };
    }

    /**
     * Calculate ESI (Employee State Insurance)
     */
    static calculateESI(grossSalary: number): ESICalculation {
        // ESI applicable if gross <= 21,000

        if (grossSalary <= 0) {
            return {
                employeeContribution: 0,
                employerContribution: 0,
                totalESI: 0,
                isApplicable: false,
                reason: 'Invalid salary'
            };
        }

        if (grossSalary > this.ESI_WAGE_CEILING) {
            return {
                employeeContribution: 0,
                employerContribution: 0,
                totalESI: 0,
                isApplicable: false,
                reason: `Gross salary exceeds ESI ceiling of ₹${this.ESI_WAGE_CEILING}`
            };
        }

        const employeeContribution = Math.round(grossSalary * this.ESI_EMPLOYEE_RATE);
        const employerContribution = Math.round(grossSalary * this.ESI_EMPLOYER_RATE);

        return {
            employeeContribution,
            employerContribution,
            totalESI: employeeContribution + employerContribution,
            isApplicable: true
        };
    }

    /**
     * Check if PF is mandatory
     */
    static isPFMandatory(basicSalary: number): boolean {
        return basicSalary <= this.PF_WAGE_CEILING;
    }

    /**
     * Check if ESI is applicable
     */
    static isESIApplicable(grossSalary: number): boolean {
        return grossSalary > 0 && grossSalary <= this.ESI_WAGE_CEILING;
    }
}
