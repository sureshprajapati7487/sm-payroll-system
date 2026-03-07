const express = require('express');

const { StatutoryRule } = require('../database.js');
const Decimal = require('decimal.js');

const router = express.Router();

/**
 * Get Active Statutory Rule for a given date
 */
const getActiveRule = async (companyId, targetDate = new Date()) => {
    if (!companyId) return null;
    try {
        const rules = await StatutoryRule.findAll({
            where: { companyId },
            order: [['effectiveDate', 'DESC']]
        });
        const activeRule = rules.find(r => new Date(r.effectiveDate) <= new Date(targetDate));
        return activeRule || null;
    } catch {
        return null;
    }
};

/**
 * Calculate PF and ESI standalone logic
 */
router.post('/pf-esi', async (req, res) => {
    try {
        const { companyId, basicSalary = 0, grossSalary = 0, date } = req.body;

        let pfRate = 12;
        let pfCap = 1800;
        let esiRate = 0.75;
        let esiEmployerRate = 3.25;
        let esiThreshold = 21000;

        if (companyId) {
            const rule = await getActiveRule(companyId, date);
            if (rule) {
                pfRate = rule.pfRate;
                pfCap = rule.pfCappedAmount;
                esiRate = rule.esicRate;
                esiThreshold = rule.esicThreshold;
            }
        }

        const basicD = new Decimal(basicSalary);
        const grossD = new Decimal(grossSalary);

        // PF Math
        let pfRes = { isApplicable: false, employeeContribution: 0, employerContribution: 0, totalPF: 0, reason: '' };
        if (basicD.greaterThan(0)) {
            pfRes.isApplicable = true;
            const pfWage = Decimal.min(basicD, 15000); // PF wage ceiling is universally 15k
            const empPF = pfWage.times(pfRate).dividedBy(100).round();
            const emplPF = pfWage.times(pfRate).dividedBy(100).round(); // Employer PF matches employee rate historically

            pfRes.employeeContribution = empPF.toNumber();
            pfRes.employerContribution = emplPF.toNumber();
            pfRes.totalPF = empPF.plus(emplPF).toNumber();
        } else {
            pfRes.reason = 'Basic salary is zero';
        }

        // ESI Math
        let esiRes = { isApplicable: false, employeeContribution: 0, employerContribution: 0, totalESI: 0, reason: '' };
        if (grossD.greaterThan(0) && grossD.lessThanOrEqualTo(esiThreshold)) {
            esiRes.isApplicable = true;
            const empESI = grossD.times(esiRate).dividedBy(100).round();
            const emplESI = grossD.times(esiEmployerRate).dividedBy(100).round();

            esiRes.employeeContribution = empESI.toNumber();
            esiRes.employerContribution = emplESI.toNumber();
            esiRes.totalESI = empESI.plus(emplESI).toNumber();
        } else if (grossD.greaterThan(esiThreshold)) {
            esiRes.reason = `Gross salary exceeds ESI ceiling of ₹${esiThreshold}`;
        } else {
            esiRes.reason = 'Gross salary is zero';
        }

        res.json({
            pf: pfRes,
            esi: esiRes,
            appliedRates: { pfRate, esiRate, esiThreshold }
        });

    } catch (error) {
        console.error('PF/ESI Calc Error:', error);
        res.status(500).json({ error: 'Calculation failed' });
    }
});

/**
 * Professional Tax standalone logic
 */
const getPT = (grossAmount, rule, state) => {
    // Note: State logic is normally handled per company. 
    // If not supplied, fallbacks to simple Maharashtra style mapping.
    let pt = 0;
    if (rule && rule.ptSlabs && rule.ptSlabs.length > 0) {
        const slabs = [...rule.ptSlabs].sort((a, b) => b.min - a.min);
        const match = slabs.find(s => grossAmount >= s.min && (s.max === null || grossAmount <= s.max));
        if (match) pt = match.tax;
    } else {
        // Fallback PT logic
        if (grossAmount > 15000) pt = 200;
        else if (grossAmount > 10000) pt = 150;
        else pt = 0;
    }
    return pt;
};

/**
 * Calculate full CTC
 */
router.post('/ctc', async (req, res) => {
    try {
        const { companyId, basicSalary = 0, state } = req.body;

        // Standard distribution logic 
        // We will build a standard salary structure matching the front-end logic:
        // Basic = input
        // HRA = 40% of Basic
        // Special Allowance = 10% of Basic
        const basicD = new Decimal(basicSalary);
        const hraD = basicD.times(0.4).round();
        const scD = basicD.times(0.1).round();
        const grossD = basicD.plus(hraD).plus(scD);

        const rule = await getActiveRule(companyId);

        let pfRate = 12;
        let esiRate = 0.75;
        let esiEmployerRate = 3.25;
        let esiThreshold = 21000;

        if (rule) {
            pfRate = rule.pfRate;
            esiRate = rule.esicRate;
            esiThreshold = rule.esicThreshold;
        }

        let empPF = new Decimal(0);
        let emplPF = new Decimal(0);
        if (basicD.lessThanOrEqualTo(15000)) {
            empPF = basicD.times(pfRate).dividedBy(100).round();
            emplPF = basicD.times(pfRate).dividedBy(100).round();
        }

        let empESI = new Decimal(0);
        let emplESI = new Decimal(0);
        if (grossD.lessThanOrEqualTo(esiThreshold)) {
            empESI = grossD.times(esiRate).dividedBy(100).round();
            emplESI = grossD.times(esiEmployerRate).dividedBy(100).round();
        }

        const ptD = new Decimal(getPT(grossD.toNumber(), rule, state));

        // Gratuity is typically 4.81% of Basic (15 days per year / 26 working days * 12 months)
        const gratuityD = basicD.times(0.0481).round();

        // Totals
        const totalDeductions = empPF.plus(empESI).plus(ptD);
        const netSalary = grossD.minus(totalDeductions);

        // CTC = Gross + Employer PF + Employer ESI + Gratuity
        const totalCTC = grossD.plus(emplPF).plus(emplESI).plus(gratuityD);

        res.json({
            basicSalary: basicD.toNumber(),
            hra: hraD.toNumber(),
            specialAllowance: scD.toNumber(),
            grossSalary: grossD.toNumber(),

            employeePF: empPF.toNumber(),
            employeeESI: empESI.toNumber(),
            professionalTax: ptD.toNumber(),
            tds: 0, // Base TDS is 0 in monthly basic CTC calc projection
            totalDeductions: totalDeductions.toNumber(),

            netSalary: netSalary.toNumber(),

            employerPF: emplPF.toNumber(),
            employerESI: emplESI.toNumber(),
            gratuity: gratuityD.toNumber(),

            totalCTC: totalCTC.toNumber()
        });

    } catch (error) {
        console.error('CTC Calc Error:', error);
        res.status(500).json({ error: 'Calculation failed' });
    }
});


/**
 * TDS Calculation Engine
 */
router.post('/tds', async (req, res) => {
    try {
        const { annualSalary = 0, section80C = 0, section80D = 0, customSlabs } = req.body;

        // Basic Logic matching the ui tdsCalculator
        // NEW REGIME SLABS (FY 2024-25)
        const DEFAULT_NEW_SLABS = [
            { min: 1500000, max: null, rate: 0.30 },
            { min: 1200000, max: 1500000, rate: 0.20 },
            { min: 1000000, max: 1200000, rate: 0.15 },
            { min: 700000, max: 1000000, rate: 0.10 },
            { min: 300000, max: 700000, rate: 0.05 },
            { min: 0, max: 300000, rate: 0 }
        ];

        // OLD REGIME SLABS
        const DEFAULT_OLD_SLABS = [
            { min: 1000000, max: null, rate: 0.30 },
            { min: 500000, max: 1000000, rate: 0.20 },
            { min: 250000, max: 500000, rate: 0.05 },
            { min: 0, max: 250000, rate: 0 }
        ];

        const getSlabs = (regime) => {
            if (customSlabs) {
                if (regime === 'NEW' && customSlabs.newRegime) return customSlabs.newRegime;
                if (regime === 'OLD' && customSlabs.oldRegime) return customSlabs.oldRegime;
            }
            return regime === 'NEW' ? DEFAULT_NEW_SLABS : DEFAULT_OLD_SLABS;
        };

        const calculateTaxAmount = (taxableIncome, regime) => {
            // For Old Regime, rebate under 87A up to 5L 
            if (regime === 'OLD' && taxableIncome <= 500000) return 0;
            // For New Regime, rebate under 87A up to 7L
            if (regime === 'NEW' && taxableIncome <= 700000) return 0;

            const slabs = getSlabs(regime);
            let tax = 0;
            let remainingIncome = taxableIncome;

            for (const slab of slabs) {
                if (remainingIncome > slab.min) {
                    const taxableInThisSlab = slab.max
                        ? Math.min(remainingIncome - slab.min, slab.max - slab.min)
                        : remainingIncome - slab.min;

                    tax += taxableInThisSlab * slab.rate;
                }
            }

            // Add 4% Health & Education Cess
            const cess = tax * 0.04;
            return Math.round(tax + cess);
        };

        const standardDeduction = 50000; // Applicable for both regimes now

        // Old Regime calculation
        const oldTaxable = Math.max(0, annualSalary - standardDeduction - section80C - section80D);
        const oldRegimeTax = calculateTaxAmount(oldTaxable, 'OLD');

        // New Regime calculation (no 80C/80D)
        const newTaxable = Math.max(0, annualSalary - standardDeduction);
        const newRegimeTax = calculateTaxAmount(newTaxable, 'NEW');

        // Recommendation
        const oldIsBetter = oldRegimeTax < newRegimeTax;

        res.json({
            grossIncome: annualSalary,
            standardDeduction,
            section80C,
            section80D,

            oldRegimeTaxableIncome: oldTaxable,
            oldRegimeTax,

            newRegimeTaxableIncome: newTaxable,
            newRegimeTax,

            recommendedRegime: oldIsBetter ? 'OLD' : 'NEW',
            monthlyTDS: Math.round((oldIsBetter ? oldRegimeTax : newRegimeTax) / 12)
        });

    } catch (error) {
        console.error('TDS Calc Error:', error);
        res.status(500).json({ error: 'Calculation failed' });
    }
});

module.exports = router;