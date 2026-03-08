/**
 * allTips.ts — Poore Project ke liye Centralized Tips Registry
 *
 * Har tip mein:
 *   meaning:  Is field ka kya matlab hai (Hindi mein)
 *   example:  Real-world example
 *   formula?: (optional) Calculation formula
 *   note?:    (optional) Warning / important caveat
 *
 * Naya tip add karna ho toh bas yahan ek entry daal do,
 * aur component mein <InfoTip id="newKey" label="New Label" /> likh do.
 */

export interface TipEntry {
    meaning: string;
    example?: string;
    formula?: string;
    note?: string;
}

export const allTips: Record<string, TipEntry> = {

    // ─────────────────────────────────────────────────────────────────────────
    // EMPLOYEE / HR
    // ─────────────────────────────────────────────────────────────────────────
    ctcAmount: {
        meaning: 'CTC (Cost to Company) — company ek employee par kul kitna kharch karti hai saal mein. Isme salary, PF, ESI, bonus sab shamil hain.',
        example: 'CTC ₹6,00,000/yr → Monthly take-home ≈ ₹42,000 (deductions ke baad)',
        formula: 'CTC = Gross Salary + Employer PF + Employer ESI + Gratuity + Other Benefits',
    },
    basicSalary: {
        meaning: 'Basic salary — employee ki mool talab. Iske upar hi PF, HRA, aur anya allowances calculate hote hain.',
        example: 'CTC ₹6L mein Basic = 40–50% = ₹20,000–₹25,000/month',
        note: 'Basic salary jitna zyada, PF contribution utna zyada hoga.',
    },
    hraAmount: {
        meaning: 'HRA (House Rent Allowance) — ghar ka kiraya dene ke liye milta hai. Tax mein chhut lete hain agar actual rent dete hain.',
        example: 'Agar Basic = ₹20,000 toh HRA = 40–50% = ₹8,000–₹10,000',
        formula: 'HRA Exemption = min(Actual HRA, Rent - 10% of Basic, 40/50% of Basic)',
    },
    pfContribution: {
        meaning: 'PF (Provident Fund) — retirement ke liye compulsory saving. Employee aur employer dono 12% basic salary dete hain.',
        example: 'Basic ₹15,000 → Employee PF = ₹1,800 | Employer PF = ₹1,800',
        formula: 'PF = 12% of Basic (max basic ₹15,000 take capped)',
        note: 'Agar basic ₹15,000 se zyada hai, PF capping ₹1,800 par hogi (unless opted out).',
    },
    esiContribution: {
        meaning: 'ESI (Employee State Insurance) — health insurance scheme. Gross salary ≤ ₹21,000 wale employees ke liye mandatory.',
        example: 'Gross ₹18,000 → Employee ESI = ₹162 (0.9%) | Employer ESI = ₹756 (3.25%)',
        formula: 'Employee ESI = 0.9% of Gross | Employer ESI = 3.25% of Gross',
        note: 'Gross salary ₹21,000 se zyada hone par ESI deduction band ho jaata hai.',
    },
    tdsAmount: {
        meaning: 'TDS (Tax Deducted at Source) — income tax jo har mahine salary se kaat ke sarkar ko jaata hai.',
        example: 'Annual taxable income ₹8L → Tax ~₹52,500 → Monthly TDS ≈ ₹4,375',
        formula: 'Monthly TDS = (Annual Tax Liability) / 12',
        note: 'Investment proofs submit karne par TDS kam ho jaata hai.',
    },
    gratuityAmount: {
        meaning: 'Gratuity — 5 saal ki service ke baad company deti hai, ek reward ki tarah.',
        formula: 'Gratuity = (Basic × 15 × Years of Service) / 26',
        example: 'Basic ₹20,000, 10 saal ka service → Gratuity = (20,000×15×10)/26 = ₹1,15,385',
    },
    bonusAmount: {
        meaning: 'Performance ya statutory bonus jo salary ke saath ya alag diya jaata hai.',
        example: '₹21,000 saalaana minimum statutory bonus (agar applicable)',
        note: 'Bonus taxable income mein count hoti hai.',
    },
    otRate: {
        meaning: 'Overtime Rate — normally regular pay se 2x hota hai. Company policy ke hisab se alag ho sakta hai.',
        example: 'Hourly rate ₹100 → OT rate = ₹200/hr',
        formula: 'OT Amount = OT Hours × (Daily Rate / 8) × 2',
    },
    joiningDate: {
        meaning: 'Employee ki official joining date — iske basis pe experience, gratuity eligibility, aur arrears calculate hote hain.',
        example: 'Joining 15 March → March mein half-month salary milegi',
    },
    probationPeriod: {
        meaning: 'Naye employee pe observation ki period. Is dauran benefits limited ho sakte hain.',
        example: '3 month probation → PF enroll hoga, lekin leave balance shayad na ho',
    },
    noticePeriod: {
        meaning: 'Job chhodni ho toh itne advance mein notice dena zaroori hai.',
        example: '30 days notice = pehle inform karo, 30 din baad relieving milegi',
    },
    department: {
        meaning: 'Kaunse team/vibhag mein yeh employee kaam karta hai.',
        example: 'Sales, Finance, HR, Operations, Production etc.',
    },
    designation: {
        meaning: 'Employee ka job title / position.',
        example: 'Sales Executive, Senior Accountant, HR Manager',
    },
    shiftType: {
        meaning: 'Employee kis waqt kaam karta hai — morning, evening, ya night shift.',
        example: 'Morning: 9AM-6PM | Night: 10PM-7AM',
    },
    bankAccountNo: {
        meaning: 'Salary transfer ke liye employee ka bank account number.',
        note: 'Galat account number dene par salary dusre ke account mein ja sakti hai!',
    },
    ifscCode: {
        meaning: 'Bank branch ka unique code — NEFT/RTGS ke liye zarori.',
        example: 'SBIN0001234 — SBI branch ka IFSC code',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // PAYROLL
    // ─────────────────────────────────────────────────────────────────────────
    grossSalary: {
        meaning: 'Sabhi allowances jod ke total salary — koi bhi deduction karne se pehle.',
        formula: 'Gross = Basic + HRA + DA + All Allowances',
        example: 'Basic ₹20K + HRA ₹8K + Other ₹5K = Gross ₹33K',
    },
    netSalary: {
        meaning: 'Sab deductions (PF, ESI, TDS, advances) katne ke baad hand mein aane wali salary.',
        formula: 'Net = Gross - PF - ESI - TDS - Loan EMI - Advances',
        example: 'Gross ₹33K - Deductions ₹8K = Net ₹25K',
    },
    totalDeductions: {
        meaning: 'Gross salary se kaati gai sab raqam — PF, ESI, tax, loan, advance.',
        example: 'PF ₹1,800 + ESI ₹162 + TDS ₹2,000 = Total ₹3,962',
    },
    lop: {
        meaning: 'LOP (Loss of Pay) — jab employee bina approved leave ke absent rahe toh salary se yeh amount kata jaata hai.',
        formula: 'LOP = (Gross / Working Days) × Absent Days',
        example: '1 day LOP: Gross ₹30,000, 26 working days → ₹1,154 cut',
    },
    arrears: {
        meaning: 'Pichle kisi mahine ki baaki reh gayi salary ya increment jo ab di ja rahi hai.',
        example: 'April mein increment hua ₹2,000/month, May mein arrears milenge April ka ₹2,000',
    },
    salaryMonth: {
        meaning: 'Kaunse mahine ki salary generate ho rahi hai.',
        example: 'February 2025 ki salary → February ka attendance dekha jaayega',
    },
    payrollStatus: {
        meaning: 'Salary processing ka current stage.',
        example: 'Draft → Processing → Approved → Disbursed → Locked',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // ATTENDANCE
    // ─────────────────────────────────────────────────────────────────────────
    punchInTime: {
        meaning: 'Employee ne office mein aane ka time record kiya.',
        example: '09:02 AM punch-in = 2 minute late',
    },
    punchOutTime: {
        meaning: 'Employee ne office se jaane ka time record kiya.',
        example: 'Punch-out 6:30 PM = 30 min overtime (agar shift 6 PM hai)',
    },
    workingHours: {
        meaning: 'Punch-in se punch-out ke beech ka net working time.',
        formula: 'Working Hours = Punch-out - Punch-in - Break Time',
    },
    overtimeHours: {
        meaning: 'Shift ke baad extra kaam ka time — OT rate se pay hota hai.',
        example: 'Shift 9-6, leave 7PM → 1 hr OT',
    },
    lateEntry: {
        meaning: 'Shift start se zyada der baad aana. Ek limit se zyada late toh half-day ya LOP ho sakta hai.',
        example: 'Policy: 30 min late allowed. 31+ min = half day mark',
    },
    earlyExit: {
        meaning: 'Shift khatam hone se pehle chale jaana.',
        example: 'Shift ends 6PM, left at 4PM = 2hr early exit = half day',
    },
    attendanceStatus: {
        meaning: 'Us din ki attendance ka status.',
        example: 'P = Present | A = Absent | H = Half Day | L = Leave | WO = Week Off | PH = Public Holiday',
    },
    leaveBalance: {
        meaning: 'Kite din ki leave baaki hai abhi tak is saal mein.',
        example: 'EL: 10 remaining | SL: 5 remaining | CL: 3 remaining',
    },
    leaveType: {
        meaning: 'Konsa type ki leave apply ki gayi hai.',
        example: 'EL = Earned Leave | SL = Sick Leave | CL = Casual Leave | LWP = Leave Without Pay',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // LOANS
    // ─────────────────────────────────────────────────────────────────────────
    loanAmount: {
        meaning: 'Employee ne company se kitna loan liya.',
        example: '₹50,000 loan — 10 kisto mein katega',
    },
    loanInterestRate: {
        meaning: 'Loan par lagaya gaya saalaana byaj dar (agar company byaj leti ho).',
        example: '5% pa = ₹50,000 loan par ₹2,500/year byaj',
        note: 'Zyatar companies interest-free loan deti hain employees ko.',
    },
    emiAmount: {
        meaning: 'Har mahine salary se loan ki kitni raqam kategi.',
        formula: 'EMI = Loan Amount / Tenure Months (simple) | Complex: EMI = P×r×(1+r)^n / ((1+r)^n - 1)',
        example: '₹50,000 loan, 10 months → EMI ₹5,000/month',
    },
    loanTenure: {
        meaning: 'Kitne mahine mein loan ka poora payment hoga.',
        example: '12 months = 1 saal mein loan complete',
    },
    loanStatus: {
        meaning: 'Loan ka current status.',
        example: 'Pending → Approved → Active → Completed | Rejected',
    },
    outstandingBalance: {
        meaning: 'Abhi tak kitna loan baaki hai pay karna.',
        example: 'Loan ₹50K, paid ₹30K → Outstanding ₹20,000',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // PRODUCTION
    // ─────────────────────────────────────────────────────────────────────────
    productionUnits: {
        meaning: 'Ek din mein kitne units/pieces ka kaam kiya employee ne.',
        example: '120 shirts stitched, rate ₹8/shirt → ₹960 production pay',
    },
    ratePerUnit: {
        meaning: 'Ek unit kaam karne ka rate — piece-rate mein payment is se hoti hai.',
        example: 'Rate ₹8/unit → 100 units = ₹800',
    },
    productionPay: {
        meaning: 'Units × Rate = Total production earnings us din.',
        formula: 'Production Pay = Units Produced × Rate per Unit',
    },
    workGroup: {
        meaning: 'Konse group ya team mein yeh employee production karta hai.',
        example: 'Stitching Group A, Finishing Group B',
    },
    targetUnits: {
        meaning: 'Ek din mein kitne units banana expected hai (benchmark).',
        example: '100 units/day target — 120 banaye toh 20% above target',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // EXPENSES
    // ─────────────────────────────────────────────────────────────────────────
    expenseCategory: {
        meaning: 'Expense kis kaam ke liye tha — travel, food, hotel, tools etc.',
        example: 'Travel | Food | Accommodation | Office Supplies | Client Entertainment',
    },
    expenseLimit: {
        meaning: 'Is category mein maximum kitna expense allowed hai.',
        example: 'Food: ₹500/day limit. Isse zyada submit kiya toh approve nahi hoga.',
    },
    expenseStatus: {
        meaning: 'Expense claim ka current approval status.',
        example: 'Pending → Approved → Reimbursed | Rejected',
    },
    billAmount: {
        meaning: 'Bill ya receipt mein likha actual amount.',
        note: 'Bill ke bina reimbursement claim nahi kiya ja sakta.',
    },
    expenseDate: {
        meaning: 'Expense kis date ko hua — travel date ya purchase date.',
        example: 'Hotel check-in date ya flight date',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // SALESMAN / GPS
    // ─────────────────────────────────────────────────────────────────────────
    gpsRadiusMeters: {
        meaning: 'Salesman ko client location se is distance ke andar hona chahiye tab hi check-in allowed hoga.',
        example: '50m = Client ki building ke andar ya bilkul gate ke paas\n100m = Gali ke corner se bhi check-in ho sakta hai\n500m = Kareeb ke area se bhi check-in ho sakta hai',
    },
    maxDailyVisits: {
        meaning: 'Ek salesman ek din mein maximum kitne clients visit kar sakta hai.',
        example: '20 = Ek din mein 20 se zyada check-in system reject kar dega',
    },
    minVisitDurationMins: {
        meaning: 'Client ke paas kam se kam itna time rehna zaroori hai. Is se kam time mein visit invalid mani jaayegi.',
        example: '5 min = 5 minute se kam rahe toh visit record nahi hoga (fake visit roka jaayega)',
    },
    maxVisitDurationMins: {
        meaning: 'Ek visit maximum itne time ki ho sakti hai. Isse zyada time pe auto-checkout ho jaayega.',
        example: '180 min = 3 ghante se zyada ek jagah rahe toh auto check-out',
    },
    checkInTime: {
        meaning: 'Is time window ke bahar check-in allowed nahi. Office hours set karo.',
        example: '08:00 – 20:00 = Raat 8 baje ke baad check-in nahi ho sakta',
    },
    autoCheckoutHours: {
        meaning: 'Agar salesman check-out karna bhool gaya, toh itne ghante baad system automatically close kar dega.',
        example: '8 ghante = Subah 10 baje check-in kiya, raat 6 baje auto check-out',
    },
    baseCommissionPct: {
        meaning: 'Har order value pe base commission percentage jo salesman ko milega.',
        example: '2% = ₹10,000 ka order → ₹200 commission',
    },
    bonusSlabs: {
        meaning: 'Agar monthly order target cross ho toh extra bonus commission milega — slab ke hisab se.',
        example: 'Slab 1: ₹50,000+ order → +3%\nSlab 2: ₹1,00,000+ order → +5%\nMtlab: ₹1L order pe 2%+5% = 7% total commission',
    },
    dailyVisitTarget: {
        meaning: 'Ek din mein salesman ko kitne clients visit karne chahiye — performance metric ke liye.',
        example: '8 = Agar 8 se kam visits ki toh dashboard pe "Below Target" dikhega',
    },
    monthlyOrderTarget: {
        meaning: 'Mahine mein salesman ko kitne rupaye ke orders lane chahiye.',
        example: '₹2,00,000 = Agar ₹1,50,000 ke order laye toh 75% achieve dikhega',
    },
    monthlyCollectionTarget: {
        meaning: 'Mahine mein salesman ko kitna outstanding amount collect karna chahiye.',
        example: '₹1,50,000 = Paise wapas lene ka monthly target',
    },
    maxClientsPerSalesman: {
        meaning: 'Ek salesman ko maximum kitne clients assign ho sakte hain.',
        example: '100 = 100 se zyada clients ek salesman ko assign nahi honge',
    },
    overdueAlertDays: {
        meaning: 'Itne din baad bhi client ko visit nahi kiya toh dashboard pe "Overdue" alert aayega.',
        example: '7 din = 7 din se zyada ho gaye next visit nahi ki → ⚠️ Overdue',
    },
    gpsRequired: {
        meaning: 'GPS on hona mandatory hai. Bina GPS ke check-in allow nahi.',
        example: 'ON = GPS off hai toh check-in button disable hoga',
    },
    photoRequired: {
        meaning: 'Check-in ke time client ka photo lena zaroori.',
        example: 'ON = Photo kheeche bina check-in complete nahi hoga',
    },
    competitorTracking: {
        meaning: 'Salesman competitor brands ki information note kar sake.',
        example: 'ON = Client visit mein "Competitor Product" field aayega',
    },
    offlineMode: {
        meaning: 'Internet nahi hone par bhi kaam karo, internet aane pe sync hoga.',
        example: 'ON = Network nahi hai phir bhi visit save hogi, baad mein upload',
    },
    totalSalesAmount: {
        meaning: 'Is period mein salesman ke sab orders ki total value.',
        example: '10 orders × avg ₹15,000 = ₹1,50,000 total sales',
    },
    clientCount: {
        meaning: 'Salesman ke assigned clients ki total sankhya.',
        example: '45 clients assigned → unhe regularly visit karna hai',
    },
    visitEfficiency: {
        meaning: 'Kitne visits mein orders mila — conversion rate.',
        formula: 'Efficiency = (Orders / Visits) × 100%',
        example: '10 visits, 3 orders → 30% efficiency',
    },
    collectionAmount: {
        meaning: 'Clients se outstanding amounts collect kiye gaye is period mein.',
        example: 'Client A: ₹25,000 + Client B: ₹15,000 = ₹40,000 collection',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // SYSTEM SETTINGS
    // ─────────────────────────────────────────────────────────────────────────
    companyName: {
        meaning: 'Company ka official registered naam jo payslips aur reports mein dikhega.',
        example: 'Suresh Enterprises Pvt. Ltd.',
    },
    financialYear: {
        meaning: 'Company ka annual accounting period.',
        example: 'India standard: April 2024 – March 2025',
    },
    workingDaysPerMonth: {
        meaning: 'Mahine mein kitne din kaam hota hai — salary calculation ke liye use hota hai.',
        example: '26 days = salary/26 × present days = earned salary',
    },
    weeklyOff: {
        meaning: 'Har hafte konse din ka off hota hai (holiday nahi, regular off).',
        example: 'Sunday only | Saturday + Sunday | Alternate Saturday',
    },
    gracePeriodMins: {
        meaning: 'Shift start ke baad kitne minute tak late aana allowed hai bina penalty ke.',
        example: '10 min grace = 9:10 AM tak on-time maana jaayega (shift 9 AM hai)',
    },
    halfDayThresholdHrs: {
        meaning: 'Agar itne se kam ghante kaam kiya toh full day absent nahi, half day hoga.',
        example: '4 hrs = 4 ghante se kam kaam kiya → half day',
    },
    minWorkingHrs: {
        meaning: 'Is se kam ghante kaam kiya toh present nahi maana jaayega.',
        example: '6 hrs = 5 ghante kaam kiya → absent mark hoga',
    },
    autoApproveLeave: {
        meaning: 'Leave request automatic approve ho jaaye — manual approval ki zarurat nahi.',
        example: 'ON = Employee apply kare, auto approved after 24 hrs',
    },
    pfRegistrationNo: {
        meaning: 'Company ka PF department se mila registration number — mandatory for compliance.',
        example: 'MH/MUM/1234567/000/0000001',
    },
    esiRegistrationNo: {
        meaning: 'ESIC department se mila company registration number.',
        example: '31-00-123456-000-0001',
    },
    panNumber: {
        meaning: 'Company ka PAN card number — TDS filing ke liye mandatory.',
        example: 'AABCS1429B',
    },
    tanNumber: {
        meaning: 'TAN — TDS deduct karne wali companies ke liye zaruri registration.',
        example: 'PNEC03049E',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // CALCULATORS
    // ─────────────────────────────────────────────────────────────────────────
    taxRegime: {
        meaning: 'Old regime ya New regime — dono mein alag tax slab aur exemptions hain.',
        example: 'Old: Zyada deductions (80C, HRA etc.) | New: Lower flat rates, kam exemptions',
        note: 'New regime 2024 se default hai, employee switch kar sakta hai.',
    },
    investmentDeclaration: {
        meaning: 'Employee apni investments (80C, NPS, health insurance etc.) declare karta hai — tax save karne ke liye.',
        example: '80C mein ₹1.5L (PPF + ELSS) → tax mein ₹46,800 ki bachhat',
    },
    section80c: {
        meaning: 'Section 80C mein ₹1.5 Lakh tak investment pe tax deduction milti hai.',
        example: 'PPF, ELSS, Home Loan principal, Life Insurance premium — sab 80C mein aata hai',
        formula: 'Max Deduction = ₹1,50,000/year',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // APPROVALS
    // ─────────────────────────────────────────────────────────────────────────
    approvalStatus: {
        meaning: 'Request ka abhi kya status hai.',
        example: 'Pending → Approved → Rejected | Forwarded',
    },
    approvalLevel: {
        meaning: 'Kitne levels se approve hona zaroori hai is request ke liye.',
        example: 'Level 1: Manager | Level 2: HR | Level 3: MD',
    },
    remarksField: {
        meaning: 'Approve/reject karte waqt reason ya note likhne ki jagah.',
        example: 'Rejection reason: "Medical certificate nahi diya"',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // LEAVE FORM FIELDS
    // ─────────────────────────────────────────────────────────────────────────
    leaveTypeField: {
        meaning: 'Konsa type ki leave apply kar rahe hain.',
        example: 'CASUAL = Routine kaam | SICK = Beemari | PAID = Paid vacation | UNPAID = Bina pay ke',
        note: 'Casual leave balance zero ho toh UNPAID lagega.',
    },
    leaveStartDate: {
        meaning: 'Leave kis date se shuru hogi.',
        example: 'startDate = 2025-03-10 = 10 March se leave start',
    },
    leaveEndDate: {
        meaning: 'Leave kab khatam hogi. Multiple days ke liye end date set karo.',
        example: '10 March se 12 March = 3 din ki leave',
    },
    halfDayLeave: {
        meaning: 'Aadhe din ki leave — 0.5 day count hogi. Sirf ek date pe hoti hai.',
        example: 'Half day = subah jaao dopahar baad chhutthi',
        note: 'Half Day select karne par End Date auto-fill ho jaati hai.',
    },
    leaveReason: {
        meaning: 'Leave kyun chahiye — manager is reason ko dekhkar approve ya reject karta hai.',
        example: 'Fever hai | Shaadi mein jaana | Doctor appointment',
    },
    leaveEmployee: {
        meaning: 'Kis employee ke liye leave apply ho rahi hai.',
        example: 'Admin ya Manager dusre employee ki taraf se bhi apply kar sakte hain.',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // LOAN FORM EXTRAS
    // ─────────────────────────────────────────────────────────────────────────
    loanTypeField: {
        meaning: 'Loan kis kaam ke liye hai.',
        example: 'PF_LOAN = PF fund advance | ADVANCE_CASH = Urgent cash | FOOD = Canteen dues | FINE = Company penalty',
    },
    loanReason: {
        meaning: 'Loan kyun chahiye — Manager ko dikhta hai approval ke waqt.',
        example: 'Ghar ki repair | Medical emergency | Bachche ki fees | Vehicle breakdown',
    },
    loanApprover: {
        meaning: 'Kaun approve karega yeh loan. WhatsApp notification isi ko jaati hai.',
        example: 'Senior Manager ya HR Admin select karo',
    },
    loanCheckingApprover: {
        meaning: 'Pehle ye verify karega documents aur amount, phir final approver ke paas jaayega.',
        example: 'Accounts pehle check karega, HR final approve karega',
    },
    loanIssuedDate: {
        meaning: 'Kab loan diya gaya ya kab se EMI shuru hogi.',
        example: 'March 1 issue kiya, April se EMI katna shuru hoga',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // SHIFT CONFIGURATION
    // ─────────────────────────────────────────────────────────────────────────
    shiftName: {
        meaning: 'Shift ka naam — reports aur employee profiles mein pehchana jaayega.',
        example: 'Morning Shift | Night Shift | General | Rotational A',
    },
    shiftStartTime: {
        meaning: 'Is shift ka official start time. Iske baad aana late maana jaayega.',
        example: '09:00 = Subah 9 baje kaam shuru',
    },
    shiftEndTime: {
        meaning: 'Is shift ka official end time. Iske baad kaam karna overtime count hoga.',
        example: '18:00 = Shaam 6 baje shift khatam',
    },
    shiftGraceMins: {
        meaning: 'Itne minute late aana allowed bina penalty ke. Isse zyada der pe late mark.',
        example: '10 min = 9:10 tak on-time. 9:11 pe Late Entry.',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // SALARY TYPE CONFIG
    // ─────────────────────────────────────────────────────────────────────────
    salaryTypeLabel: {
        meaning: 'Payslip mein dikhne wala naam is salary component ka.',
        example: 'House Rent Allowance | Transport Allowance | Medical Allowance',
    },
    salaryTypeKey: {
        meaning: 'System ka unique internal code — spaces allowed nahi.',
        example: 'houseRentAllowance | transportAllowance',
        note: 'Baad mein change karna purana payroll data affect kar sakta hai.',
    },
    salaryTypeBasis: {
        meaning: 'Yeh component kaise calculate hota hai.',
        example: 'FIXED = ₹3,000 hamesha | PERCENTAGE = Basic ka 40% = ₹8,000 (Basic ₹20K pe)',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // CUSTOM FIELDS CONFIG
    // ─────────────────────────────────────────────────────────────────────────
    customFieldLabel: {
        meaning: 'Form mein dikhne wala field ka naam.',
        example: 'Blood Group | Emergency Contact | Aadhaar Number | Vehicle Number',
    },
    customFieldType: {
        meaning: 'Is field mein kya type ka data enter hoga.',
        example: 'TEXT = Koi bhi text | NUMBER = Sirf number | DATE = Calendar date | SELECT = Dropdown choice',
    },
    customFieldRequired: {
        meaning: 'Mandatory hai ya optional.',
        example: 'ON = Bina bhare save nahi hoga | OFF = Chhod sakte hain',
    },
    customFieldPlaceholder: {
        meaning: 'Khaali field mein hint text — user ko guide karta hai.',
        example: 'Enter A+/B-/O+  or  DD-MM-YYYY',
    },
    customFieldModule: {
        meaning: 'Yeh field kaun se module ke form mein dikhega.',
        example: 'EMPLOYEE = Employee add/edit form mein dikhega',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // WORKFLOW CONFIG
    // ─────────────────────────────────────────────────────────────────────────
    workflowName: {
        meaning: 'Is approval workflow ka naam.',
        example: 'Standard Leave Approval | Fast-Track Loan | 3-Level HR Review',
    },
    workflowModule: {
        meaning: 'Yeh workflow kaunse module ki requests par apply hoga.',
        example: 'leave = Leave requests | loan = Loan requests',
    },
    workflowStep: {
        meaning: 'Ek approval step — kaun approve karega is stage pe.',
        example: 'Step 1: Manager → Step 2: HR → Step 3: Director\nHar step pe us role wala user approve karega.',
    },
    workflowActive: {
        meaning: 'ON karo toh nayi requests isi chain se jaayengi.',
        example: 'OFF = Direct approve | ON = Manager → HR → Super Admin sab approve karein',
        note: 'Ek module pe ek hi workflow active ho sakta hai.',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // STATUTORY SETTINGS
    // ─────────────────────────────────────────────────────────────────────────
    pfWages: {
        meaning: 'PF deduction ke liye salary limit. Isse upar PF nahi katega.',
        example: 'Limit ₹15,000 = Basic ₹20K ho toh bhi PF sirf ₹15K pe = ₹1,800',
        formula: 'PF = 12% × min(Basic, PF Wage Limit)',
    },
    esiWages: {
        meaning: 'ESI ke liye Gross salary ki limit. Isse zyada Gross pe ESI band.',
        example: 'Limit ₹21,000 = Gross ₹22K hone pe ESI automatically stop',
        note: 'Yeh limit government set karta hai.',
    },
    ptApplicable: {
        meaning: 'Professional Tax — state government ka salary tax. Har state mein alag slab.',
        example: 'Maharashtra: ₹200/month (salary ₹10K+)',
        note: 'Kuch states mein PT nahi hota (Delhi etc.).',
    },
    labourWelfareFund: {
        meaning: 'State Labour Welfare Fund contribution — semi-annual ya annual.',
        example: 'Maharashtra LWF: Employee ₹6 + Employer ₹12 = ₹18 per 6 months',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // ROLE ACCESS CONFIG
    // ─────────────────────────────────────────────────────────────────────────
    roleScope: {
        meaning: 'Yeh role kitna data dekh sakta hai.',
        example: 'OWN = Sirf apna | TEAM = Apne dept ke sabka | ALL = Poori company ka',
        note: 'Super Admin ka scope hamesha ALL hota hai, change nahi hota.',
    },
    permissionToggle: {
        meaning: 'Is role ko yeh kaam karne ki permission hai ya nahi.',
        example: 'ON = User yeh action kar sakta hai | OFF = Button dikhega hi nahi',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // PRODUCTION ENTRY
    // ─────────────────────────────────────────────────────────────────────────
    productionDate: {
        meaning: 'Kaunse din ka production entry kar rahe hain.',
        example: '2025-03-08 = Aaj ke din ki units record karein',
        note: 'Aage ki date ka entry nahi kar sakte.',
    },
    productionWorker: {
        meaning: 'Kaunse employee ne yeh production units banaye.',
        example: 'Ram Kumar — Stitching Group A',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // REPORT BUILDER
    // ─────────────────────────────────────────────────────────────────────────
    reportDateRange: {
        meaning: 'Report kis period ka data dikhayegi.',
        example: '1 Jan – 31 Jan = January ka poora data report mein',
    },
    reportModule: {
        meaning: 'Kaunse module ka data report mein chahiye.',
        example: 'ATTENDANCE = Punch data | PAYROLL = Salary | LOANS = Loan balances',
    },
    reportColumns: {
        meaning: 'Report mein kaunse columns dikhane hain — tick karo jo chahiye.',
        example: 'Name ✓ | Department ✓ | Gross ✓ | PF ✗ (nahi chahiye toh untick)',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // CONFIGURATION TABS (A-Z)
    // ─────────────────────────────────────────────────────────────────────────
    deptName: {
        meaning: 'Department ka naam, jaise Production ya Sales.',
    },
    deptDescription: {
        meaning: 'Department ke baare mein short detail.',
    },
    deptSalaryBasis: {
        meaning: 'Yahan chunen ki salary kaise calculate hogi (Monthly, Daily, etc.).',
    },
    deptDefaultSalaryType: {
        meaning: 'Naye employee join karne par konsa format lagega.',
    },
    deptCostCenter: {
        meaning: 'Accounts ke liye internal track code.',
    },
    deptHeadCount: {
        meaning: 'Is department mein kitne log chahiye (Target).',
    },

    ruleZeroPresence: {
        meaning: 'Agar mahine me 0 attendance ho, toh koi salary/allowance nahi milegi.',
    },
    ruleSandwich: {
        meaning: 'Holidays ka paisa tabhi milega agar ek din pehle aur baad me present ho.',
    },

    attActionLabel: {
        meaning: 'Naya custom attendance action ka naam.',
    },
    attActionIcon: {
        meaning: 'Pehchan ke liye ek chhota icon (emoji).',
    },
    attActionKey: {
        meaning: 'System uses this code internally (e.g. WFH).',
    },
    attActionColor: {
        meaning: 'UI mein dikhne wala color.',
    },

    holidayName: {
        meaning: 'Chhutti ka naam (e.g. Diwali).',
    },
    holidayDate: {
        meaning: 'Kis din chhutti hai.',
    },
    holidayType: {
        meaning: 'Festival, National ya Optional holiday.',
    },

    punchMethods: {
        meaning: 'Employee kaise haziri lagaega (Face, GPS, Photo).',
    },
    punchLocationName: {
        meaning: 'Office ya branch ka naam jahan se haziri lagani hai.',
    },
    punchRadius: {
        meaning: 'Kitne meter ke andar se haziri lagana allowed hai.',
    },

    sysKeyLabel: {
        meaning: 'System variable ka user-friendly naam.',
        example: 'Max OT Hours',
    },
    sysKeyVal: {
        meaning: 'Is key ki required value.',
        example: '50 (hours)',
    },
    sysKeyCat: {
        meaning: 'Kis module / category ke liye hai.',
    },
    sysKeySecret: {
        meaning: 'Security mask: dusre (non-admin) users se chupayega.',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // SALESMAN TASKS (SalesmanDashboard)
    // ─────────────────────────────────────────────────────────────────────────
    taskTitle: {
        meaning: 'Task ka chota naam. (Ye kya kaam karna hai)',
        example: '10 naye dukano par visit karna hai',
    },
    taskDesc: {
        meaning: 'Task ke baare mein puri detail (agar chahiye toh).',
    },
    taskPriority: {
        meaning: 'Kaam kitna zaroori hai (High, Medium, Low).',
    },
    taskDueDate: {
        meaning: 'Kis tareekh tak yeh task poora hona chahiye.',
    },
    taskAssignTo: {
        meaning: 'Kis employee (salesman) ko yeh task karna hai.',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // CLIENT MANAGEMENT (ClientListPage)
    // ─────────────────────────────────────────────────────────────────────────
    clientName: {
        meaning: 'Party ya dukan / office ka main naam.',
        example: 'Sharma Traders',
    },
    clientShopName: {
        meaning: 'Board par jo Dukan ka naam likha ho.',
    },
    clientOwnerName: {
        meaning: 'Jo Dukan chalate hain unka purna naam.',
    },
    clientMobile: {
        meaning: 'WhatsApp number ya primary calling number.',
    },
    clientAltMobile: {
        meaning: 'Koi doosra number agar pehla nahi lag raha.',
    },
    clientCategory: {
        meaning: 'Industry ya kisme deal karte hain.',
        example: 'Grocery, Pharmacy, Hardware',
    },
    clientType: {
        meaning: 'Party ka type kaisa hai.',
        example: 'Retail, Wholesale, Distributor',
    },
    clientStatus: {
        meaning: 'Party abhi active hai ya inactive.',
        note: 'INACTIVE ko visit allow nahi hoti.',
    },
    clientCreditLimit: {
        meaning: 'Maximum kitne baki payment tak maal de sakte hain.',
        example: '₹50,000 agar set kiya, toh 50,000 se upar balance nahi hona chahiye.',
    },
    clientOutstanding: {
        meaning: 'Party ke upar abhi kitna paisa udhar hai.',
    },
    clientFullAddress: {
        meaning: 'Pura pata bill aur GPS verification ke liye.',
    },
    clientNotes: {
        meaning: 'Baki koi extra jaankaari (Time, preference etc.).',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK-OUT MODAL
    // ─────────────────────────────────────────────────────────────────────────
    checkoutOutcome: {
        meaning: 'Visit ka natija (kya hua).',
        example: 'Order Milla, Koi Order Nahi, Follow Up Chahiye etc.',
    },
    checkoutOrderAmount: {
        meaning: 'Agar order mila toh kitne rupaye ka mila.',
    },
    checkoutCollection: {
        meaning: 'Agar purana udhar/payment receive hua toh kitna liya.',
    },
    checkoutNextVisit: {
        meaning: 'Agli baar inn-se kab milna hai?',
    },
    checkoutNotes: {
        meaning: 'Salesman ka input ke visit kaisa raha. (Feedback)',
    },
};

