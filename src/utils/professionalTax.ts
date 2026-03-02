// Phase 16: Professional Tax Calculator (State-wise)

import { ProfessionalTaxSlab } from '@/types/statutory';

export class ProfessionalTaxCalculator {
    // Professional Tax Slabs by State (as of 2024)
    private static readonly PT_SLABS: Record<string, ProfessionalTaxSlab> = {
        'MAHARASHTRA': {
            state: 'Maharashtra',
            slabs: [
                { from: 0, to: 7500, tax: 0 },
                { from: 7501, to: 10000, tax: 175 },
                { from: 10001, to: 999999999, tax: 200 }
            ]
        },
        'KARNATAKA': {
            state: 'Karnataka',
            slabs: [
                { from: 0, to: 15000, tax: 0 },
                { from: 15001, to: 20000, tax: 150 },
                { from: 20001, to: 999999999, tax: 200 }
            ]
        },
        'WEST_BENGAL': {
            state: 'West Bengal',
            slabs: [
                { from: 0, to: 10000, tax: 0 },
                { from: 10001, to: 15000, tax: 110 },
                { from: 15001, to: 25000, tax: 130 },
                { from: 25001, to: 40000, tax: 150 },
                { from: 40001, to: 999999999, tax: 200 }
            ]
        },
        'TAMIL_NADU': {
            state: 'Tamil Nadu',
            slabs: [
                { from: 0, to: 21000, tax: 0 },
                { from: 21001, to: 30000, tax: 135 },
                { from: 30001, to: 45000, tax: 150 },
                { from: 45001, to: 60000, tax: 180 },
                { from: 60001, to: 75000, tax: 195 },
                { from: 75001, to: 999999999, tax: 208 }
            ]
        },
        'ANDHRA_PRADESH': {
            state: 'Andhra Pradesh',
            slabs: [
                { from: 0, to: 15000, tax: 0 },
                { from: 15001, to: 20000, tax: 150 },
                { from: 20001, to: 999999999, tax: 200 }
            ]
        },
        'TELANGANA': {
            state: 'Telangana',
            slabs: [
                { from: 0, to: 15000, tax: 0 },
                { from: 15001, to: 20000, tax: 150 },
                { from: 20001, to: 999999999, tax: 200 }
            ]
        },
        'GUJARAT': {
            state: 'Gujarat',
            slabs: [
                { from: 0, to: 5999, tax: 0 },
                { from: 6000, to: 8999, tax: 80 },
                { from: 9000, to: 11999, tax: 150 },
                { from: 12000, to: 999999999, tax: 200 }
            ]
        },
        'MADHYA_PRADESH': {
            state: 'Madhya Pradesh',
            slabs: [
                { from: 0, to: 15000, tax: 0 },
                { from: 15001, to: 999999999, tax: 208 }
            ]
        }
    };

    /**
     * Calculate monthly professional tax
     */
    static calculatePT(monthlyGross: number, state: string): number {
        const stateKey = state.toUpperCase().replace(/\s+/g, '_');
        const stateSlab = this.PT_SLABS[stateKey];

        if (!stateSlab) {
            // State not listed = No PT
            return 0;
        }

        // Find applicable slab
        for (const slab of stateSlab.slabs) {
            if (monthlyGross >= slab.from && monthlyGross <= slab.to) {
                return slab.tax;
            }
        }

        return 0;
    }

    /**
     * Get all supported states
     */
    static getSupportedStates(): string[] {
        return Object.values(this.PT_SLABS).map(s => s.state);
    }

    /**
     * Get slabs for a state
     */
    static getSlabsForState(state: string): ProfessionalTaxSlab | null {
        const stateKey = state.toUpperCase().replace(/\s+/g, '_');
        return this.PT_SLABS[stateKey] || null;
    }

    /**
     * Check if PT is applicable
     */
    static isApplicable(monthlyGross: number, state: string): boolean {
        return this.calculatePT(monthlyGross, state) > 0;
    }
}
