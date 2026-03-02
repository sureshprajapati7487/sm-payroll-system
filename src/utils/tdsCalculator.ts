// Phase 16: TDS Calculator (Income Tax)

import { TDSCalculation } from '@/types/statutory';

export class TDSCalculator {
    // FY 2024-25 Tax Slabs (New Regime - Default from AY 2024-25)
    private static readonly NEW_REGIME_SLABS = [
        { from: 0, to: 300000, rate: 0 },
        { from: 300001, to: 700000, rate: 0.05 },
        { from: 700001, to: 1000000, rate: 0.10 },
        { from: 1000001, to: 1200000, rate: 0.15 },
        { from: 1200001, to: 1500000, rate: 0.20 },
        { from: 1500001, to: 999999999, rate: 0.30 }
    ];

    // Old Regime Slabs (with deductions)
    private static readonly OLD_REGIME_SLABS = [
        { from: 0, to: 250000, rate: 0 },
        { from: 250001, to: 500000, rate: 0.05 },
        { from: 500001, to: 1000000, rate: 0.20 },
        { from: 1000001, to: 999999999, rate: 0.30 }
    ];

    // Standard Deduction (Old Regime Only)
    private static readonly STANDARD_DEDUCTION = 50000;

    // Section 87A Rebate
    private static readonly REBATE_87A_LIMIT = 700000;
    private static readonly REBATE_87A_AMOUNT = 25000;

    /**
     * Calculate tax using slab method
     */
    private static calculateTaxBySlab(
        taxableIncome: number,
        slabs: { from: number; to: number; rate: number }[]
    ): number {
        let tax = 0;

        for (const slab of slabs) {
            if (taxableIncome > slab.from) {
                const taxableInSlab = Math.min(taxableIncome, slab.to) - slab.from;
                tax += taxableInSlab * slab.rate;
            }
        }

        return Math.round(tax);
    }

    /**
     * Calculate TDS for an employee
     */
    static calculateTDS(
        annualGrossSalary: number,
        deductions: {
            section80C?: number; // Max 150000
            section80D?: number; // Max 25000 for self, 50000 for senior citizen
            nps?: number; // Max 50000
            homeLoanInterest?: number; // Max 200000
            other?: number;
        } = {}
    ): TDSCalculation {
        // NEW REGIME CALCULATION (No deductions except standard)
        const newRegimeTaxableIncome = annualGrossSalary;
        let newRegimeTax = this.calculateTaxBySlab(newRegimeTaxableIncome, this.NEW_REGIME_SLABS);

        // 87A Rebate for new regime
        if (newRegimeTaxableIncome <= this.REBATE_87A_LIMIT) {
            newRegimeTax = Math.max(0, newRegimeTax - this.REBATE_87A_AMOUNT);
        }

        // Add 4% cess
        newRegimeTax = Math.round(newRegimeTax * 1.04);

        // OLD REGIME CALCULATION (With deductions)
        const standardDeduction = this.STANDARD_DEDUCTION;
        const section80C = Math.min(deductions.section80C || 0, 150000);
        const section80D = Math.min(deductions.section80D || 0, 25000);
        const nps = Math.min(deductions.nps || 0, 50000);
        const homeLoanInterest = Math.min(deductions.homeLoanInterest || 0, 200000);
        const otherDeductions = deductions.other || 0;

        const totalOldRegimeDeductions = standardDeduction + section80C + section80D + nps + homeLoanInterest + otherDeductions;
        const oldRegimeTaxableIncome = Math.max(0, annualGrossSalary - totalOldRegimeDeductions);

        let oldRegimeTax = this.calculateTaxBySlab(oldRegimeTaxableIncome, this.OLD_REGIME_SLABS);

        // 87A Rebate for old regime
        if (oldRegimeTaxableIncome <= 500000) {
            oldRegimeTax = Math.max(0, oldRegimeTax - 12500);
        }

        // Add 4% cess
        oldRegimeTax = Math.round(oldRegimeTax * 1.04);

        // Recommend regime
        const recommendedRegime = oldRegimeTax < newRegimeTax ? 'OLD' : 'NEW';
        const finalTax = Math.min(oldRegimeTax, newRegimeTax);
        const monthlyTDS = Math.round(finalTax / 12);

        return {
            grossIncome: annualGrossSalary,
            standardDeduction,
            section80C,
            section80D,
            otherDeductions: nps + homeLoanInterest + otherDeductions,
            taxableIncome: recommendedRegime === 'NEW' ? newRegimeTaxableIncome : oldRegimeTaxableIncome,
            oldRegimeTax,
            newRegimeTax,
            recommendedRegime,
            monthlyTDS
        };
    }

    /**
     * Calculate monthly TDS
     */
    static calculateMonthlyTDS(monthlyGross: number, deductions = {}): number {
        const annualGross = monthlyGross * 12;
        const tds = this.calculateTDS(annualGross, deductions);
        return tds.monthlyTDS;
    }

    /**
     * Get tax breakdown by slab
     */
    static getTaxBreakdown(taxableIncome: number, regime: 'OLD' | 'NEW' = 'NEW') {
        const slabs = regime === 'NEW' ? this.NEW_REGIME_SLABS : this.OLD_REGIME_SLABS;
        const breakdown: { slab: string; tax: number }[] = [];

        for (const slab of slabs) {
            if (taxableIncome > slab.from) {
                const taxableInSlab = Math.min(taxableIncome, slab.to) - slab.from;
                const taxInSlab = Math.round(taxableInSlab * slab.rate);

                if (taxInSlab > 0) {
                    breakdown.push({
                        slab: `₹${slab.from.toLocaleString()} - ₹${slab.to.toLocaleString()}`,
                        tax: taxInSlab
                    });
                }
            }
        }

        return breakdown;
    }
}
