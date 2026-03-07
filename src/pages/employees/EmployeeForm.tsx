import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEmployeeStore } from '@/store/employeeStore';
import { useDepartmentStore } from '@/store/departmentStore';
import { useShiftStore } from '@/store/shiftStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { useWorkGroupStore } from '@/store/workGroupStore';
import { Employee, EmployeeStatus, Roles, SalaryType, ShiftType, StatutoryConfig } from '@/types';
import { ArrowLeft, Save, User, Briefcase, CreditCard, Upload, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { PasswordStrengthInput, isPasswordValid } from '@/components/ui/PasswordStrengthInput';
import { InfoTip } from '@/components/ui/InfoTip';
import { useAuthStore } from '@/store/authStore';
import { PERMISSIONS } from '@/config/permissions';

const DEFAULT_STATUTORY: StatutoryConfig = {
    pfApplicable: true,
    pfRate: 12,
    pfCapped: true,
    esicApplicable: true,
    esicRate: 0.75,
    ptApplicable: true,
    ptAmount: 200,
    tdsApplicable: true,
    tdsPanLinked: true,
    tdsDeclaredInvestment: 0,
};

// ── Accordion Section ──────────────────────────────────────────────────────────
const AccordionSection = ({
    icon, title, defaultOpen = false, children
}: { icon: React.ReactNode; title: string; defaultOpen?: boolean; children: React.ReactNode }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="glass rounded-xl border border-dark-border overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors"
            >
                <span className="text-base font-bold text-white flex items-center gap-3">
                    {icon} {title}
                </span>
                <span className={`transition-transform duration-300 text-dark-muted ${open ? 'rotate-180' : ''}`}>
                    <ChevronDown className="w-5 h-5" />
                </span>
            </button>
            {open && (
                <div className="px-6 pb-6 border-t border-dark-border/50 pt-5">
                    {children}
                </div>
            )}
        </div>
    );
};

// Reusable Toggle Switch
const Toggle = ({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) => (
    <div className="flex items-start justify-between gap-4">
        <div>
            <p className="text-sm font-semibold text-white">{label}</p>
            {desc && <p className="text-xs text-dark-muted mt-0.5">{desc}</p>}
        </div>
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${checked ? 'bg-primary-600' : 'bg-dark-border'}`}
        >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-md transform transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    </div>
);

// Statutory sub-card
const StatutoryCard = ({ color, icon, title, subtitle, enabled, onToggle, children }: {
    color: string; icon: string; title: string; subtitle: string;
    enabled: boolean; onToggle: (v: boolean) => void; children: React.ReactNode
}) => {
    const [expanded, setExpanded] = useState(enabled);
    useEffect(() => { if (enabled) setExpanded(true); }, [enabled]);

    return (
        <div className={`rounded-xl border overflow-hidden transition-all ${enabled ? `border-${color}-500/40 bg-${color}-500/5` : 'border-dark-border bg-dark-bg/30'}`}>
            <div className="p-4 flex items-center gap-3">
                <span className="text-2xl">{icon}</span>
                <div className="flex-1 cursor-pointer" onClick={() => enabled && setExpanded(!expanded)}>
                    <p className={`font-bold text-sm ${enabled ? `text-${color}-400` : 'text-dark-muted'}`}>{title}</p>
                    <p className="text-xs text-dark-muted">{subtitle}</p>
                </div>
                {/* Always-visible toggle in header */}
                <button
                    type="button"
                    onClick={() => onToggle(!enabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${enabled ? `bg-${color}-600` : 'bg-dark-border'}`}
                    title={enabled ? 'Click to disable' : 'Click to enable'}
                >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-md transform transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                {enabled && (
                    <button type="button" onClick={() => setExpanded(!expanded)} className="p-1 text-dark-muted hover:text-white ml-1">
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                )}
            </div>
            {enabled && expanded && (
                <div className={`px-4 pb-4 border-t border-${color}-500/20`}>
                    <div className="pt-4">{children}</div>
                </div>
            )}
        </div>
    );
};

const inputCls = "w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm focus:border-primary-500 outline-none";

export const EmployeeForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { addEmployee, updateEmployee, getEmployeeById, generateNextCode, _rawEmployees } = useEmployeeStore();
    const { departments } = useDepartmentStore();
    const { shifts } = useShiftStore();
    const { currentCompanyId } = useMultiCompanyStore();
    const { groups: workGroups, assignments: workAssignments, assignEmployee, unassignEmployee } = useWorkGroupStore();
    const { hasPermission } = useAuthStore();
    const isEditMode = !!id;
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [codeError, setCodeError] = useState<string | null>(null); // Live code duplicate check

    const [formData, setFormData] = useState<Partial<Employee>>({
        name: '',
        email: '',
        phone: '',
        code: '',
        department: '',
        designation: '',
        role: Roles.EMPLOYEE,
        status: EmployeeStatus.ACTIVE,
        shift: 'MORNING' as ShiftType,
        salaryType: SalaryType.MONTHLY,
        basicSalary: 0,
        joiningDate: new Date().toISOString().split('T')[0],
        bankDetails: { accountNumber: '', ifscCode: '', bankName: '', panCard: '', aadharNumber: '' },
        documents: { aadharUrl: '', panUrl: '' },
        statutoryConfig: { ...DEFAULT_STATUTORY }
    });

    useEffect(() => {
        if (!isEditMode && !formData.code) {
            setFormData(prev => ({ ...prev, code: generateNextCode() }));
        }
    }, [isEditMode, generateNextCode, formData.code]);

    useEffect(() => {
        if (isEditMode && id) {
            const employee = getEmployeeById(id);
            if (employee) {
                setFormData({ ...employee, statutoryConfig: { ...DEFAULT_STATUTORY, ...employee.statutoryConfig } });
            } else navigate('/employees');
        }
    }, [id, isEditMode, getEmployeeById, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError(null);

        if (!currentCompanyId) {
            setSubmitError('⚠️ Koi Company Select Nahi Hai! Pehle Settings → Company Setup mein company create karein.');
            return;
        }
        if (!formData.name || !formData.email || !formData.code) {
            setSubmitError('Please fill all required fields: Name, Email, Employee Code');
            return;
        }
        if (codeError) {
            setSubmitError('Employee Code already in use. Ek unique code dalein.');
            return;
        }
        // Password strength validation — only if a password is being set
        if (formData.password && !isPasswordValid(formData.password)) {
            setSubmitError('Password weak hai! Min 8 characters, 1 number aur 1 letter hona chahiye.');
            return;
        }
        setSubmitting(true);
        try {
            if (isEditMode && id) {
                await updateEmployee(id, formData);
            } else {
                await addEmployee({ ...formData as Employee, avatar: `https://ui-avatars.com/api/?name=${formData.name}&background=random` });
            }
            navigate('/employees');
        } catch (err: any) {
            setSubmitError(err?.message || 'Save karne mein error aaya. Server check karein.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Live code duplicate check
        if (field === 'code' && !isEditMode) {
            const upperCode = (value as string).trim().toUpperCase();
            const exists = _rawEmployees.some(e => e.code.toUpperCase() === upperCode);
            setCodeError(exists && upperCode ? `Code "${upperCode}" already used by another employee` : null);
        }
    };
    const handleBankChange = (field: string, value: any) => setFormData(prev => ({ ...prev, bankDetails: { ...prev.bankDetails!, [field]: value } }));
    const handleStatutoryChange = (field: keyof StatutoryConfig, value: any) => setFormData(prev => ({
        ...prev,
        statutoryConfig: { ...prev.statutoryConfig!, [field]: value }
    }));

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, docType: 'aadharUrl' | 'panUrl') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setFormData(prev => ({ ...prev, documents: { ...prev.documents, [docType]: reader.result as string } }));
            reader.readAsDataURL(file);
        }
    };

    // Relative Info Handlers
    const handleRelativeChange = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            relativeInfo: { ...prev.relativeInfo, [field]: value }
        }));
    };

    const handleRelativeFileChange = (e: React.ChangeEvent<HTMLInputElement>, key: 'photoUrl' | 'aadharUrl' | 'panUrl') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setFormData(prev => ({
                ...prev,
                relativeInfo: { ...prev.relativeInfo, [key]: reader.result as string }
            }));
            reader.readAsDataURL(file);
        }
    };

    const sc = formData.statutoryConfig!;

    const canManageFinancials = hasPermission(PERMISSIONS.VIEW_SALARY);

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/employees')} className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white">{isEditMode ? 'Edit Employee' : 'New Employee'}</h1>
                    <p className="text-dark-muted">Fill in the details below</p>
                </div>
            </div>

            {/* Error Banner */}
            {submitError && (
                <div className="bg-red-500/15 border border-red-500/40 rounded-xl px-4 py-3 flex items-start gap-3">
                    <span className="text-red-400 text-xl">⚠️</span>
                    <div>
                        <p className="text-red-300 font-semibold text-sm">Error</p>
                        <p className="text-red-200 text-sm">{submitError}</p>
                    </div>
                    <button onClick={() => setSubmitError(null)} className="ml-auto text-red-400 hover:text-red-200">✕</button>
                </div>
            )}

            {/* No Company Warning */}
            {!currentCompanyId && (
                <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="text-yellow-400 text-xl">🏢</span>
                    <p className="text-yellow-300 text-sm font-medium">
                        Koi Company active nahi hai. Employee save karne ke liye pehle <strong>Settings → Company Setup</strong> mein company create karein.
                    </p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">

                {/* 1. Personal Details */}
                <AccordionSection defaultOpen={true} icon={<User className="w-5 h-5 text-primary-400" />} title="Personal Information">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-xs text-dark-muted uppercase">Full Name *</label>
                            <input required type="text" value={formData.name} onChange={e => handleChange('name', e.target.value)}
                                className={inputCls} placeholder="John Doe" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-dark-muted uppercase">Email Address *</label>
                            <input required type="email" value={formData.email} onChange={e => handleChange('email', e.target.value)}
                                className={inputCls} placeholder="john@company.com" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-dark-muted uppercase">Phone Number</label>
                            <input type="tel" value={formData.phone} onChange={e => handleChange('phone', e.target.value)}
                                className={inputCls} placeholder="+91 98765 43210" />
                        </div>
                        <div className="space-y-1">
                            <InfoTip id="joiningDate" label="Joining Date" />
                            <input type="date" value={formData.joiningDate} onChange={e => handleChange('joiningDate', e.target.value)} className={inputCls} />
                        </div>
                    </div>
                </AccordionSection>

                {/* 2. Employment Details */}
                <AccordionSection icon={<Briefcase className="w-5 h-5 text-warning" />} title="Employment Details">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-xs text-dark-muted uppercase">Employee Code *</label>
                            <input required type="text" value={formData.code} onChange={e => handleChange('code', e.target.value)}
                                className={inputCls + ' font-mono' + (codeError ? ' border-red-500' : '')} placeholder="EMP-001" />
                            {codeError && (
                                <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                                    ⚠️ {codeError}
                                </p>
                            )}
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-dark-muted uppercase">Department</label>
                            <select value={formData.department} onChange={e => handleChange('department', e.target.value)} className={inputCls}>
                                <option value="">Select Department</option>
                                {workGroups.map(g => (
                                    <option key={g.id} value={g.name}>
                                        {g.name}{g.department ? ` (${g.department})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {/* ── Work Allocation (main dept) ── */}
                        <div className="space-y-1">
                            <label className="text-xs text-dark-muted uppercase flex items-center gap-1">
                                Work Allocation
                            </label>
                            <select
                                value={id ? (workAssignments[id] || '') : ''}
                                onChange={e => {
                                    if (!id) return;
                                    if (e.target.value) assignEmployee(id, e.target.value);
                                    else unassignEmployee(id);
                                }}
                                className={inputCls}
                                disabled={!id}
                            >
                                <option value="">-- Select --</option>
                                {departments.map(dept => (
                                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                                ))}
                            </select>
                            {!id && <p className="text-[10px] text-dark-muted">Save karne ke baad assign hoga</p>}
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-dark-muted uppercase">Designation</label>
                            <input type="text" value={formData.designation} onChange={e => handleChange('designation', e.target.value)}
                                className={inputCls} placeholder="e.g. Senior Manager" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-dark-muted uppercase">Shift</label>
                            <select value={formData.shift} onChange={e => handleChange('shift', e.target.value)} className={inputCls}>
                                <option value="">Select Shift</option>
                                {shifts.map(shift => (
                                    <option key={shift.id} value={shift.id}>{shift.name} ({shift.startTime} - {shift.endTime})</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-dark-muted uppercase">Role (System Access)</label>
                            <select value={formData.role} onChange={e => handleChange('role', e.target.value)} className={inputCls}>
                                <option value={Roles.EMPLOYEE}>Employee (Restricted)</option>
                                <option value={Roles.MANAGER}>Manager (Team View)</option>
                                <option value={Roles.ACCOUNT_ADMIN}>Account Admin</option>
                                <option value={Roles.ADMIN}>Admin</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-dark-muted uppercase">Status</label>
                            <select value={formData.status} onChange={e => handleChange('status', e.target.value)} className={inputCls}>
                                <option value={EmployeeStatus.ACTIVE}>Active</option>
                                <option value={EmployeeStatus.INACTIVE}>Inactive</option>
                                <option value={EmployeeStatus.SUSPENDED}>Suspended</option>
                            </select>
                        </div>
                        <PasswordStrengthInput
                            label="Login Password"
                            value={formData.password || ''}
                            onChange={v => handleChange('password', v)}
                            placeholder="Set employee password"
                            showStrength={true}
                        />
                    </div>
                </AccordionSection>

                {canManageFinancials ? (
                    <>
                        {/* 3. Financial & Bank Details */}
                        <AccordionSection icon={<CreditCard className="w-5 h-5 text-success" />} title="Financial & Bank Details">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-xs text-dark-muted uppercase">Salary Type</label>
                                    <select value={formData.salaryType} onChange={e => handleChange('salaryType', e.target.value)} className={inputCls}>
                                        <option value={SalaryType.MONTHLY}>Monthly Fixed</option>
                                        <option value={SalaryType.DAILY}>Daily Wage</option>
                                        <option value={SalaryType.HOURLY}>Hourly Basis</option>
                                        <option value={SalaryType.PRODUCTION}>Production / Quantity Basis</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <InfoTip
                                        id="basicSalary"
                                        label={formData.salaryType === SalaryType.MONTHLY ? 'Monthly Salary' :
                                            formData.salaryType === SalaryType.DAILY ? 'Daily Rate' :
                                                formData.salaryType === SalaryType.PRODUCTION ? 'Min. Guarantee (Optional)' : 'Hourly Rate'}
                                    />
                                    <input type="number" value={formData.basicSalary}
                                        onChange={e => handleChange('basicSalary', Number(e.target.value))} className={inputCls} />
                                </div>
                                <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-dark-border/50">
                                    <div className="space-y-1">
                                        <label className="text-xs text-dark-muted uppercase">Bank Name</label>
                                        <input type="text" value={formData.bankDetails?.bankName} onChange={e => handleBankChange('bankName', e.target.value)}
                                            className={inputCls} placeholder="e.g. HDFC Bank" />
                                    </div>
                                    <div className="space-y-1">
                                        <InfoTip id="bankAccountNo" label="Account Number" />
                                        <input type="text" value={formData.bankDetails?.accountNumber} onChange={e => handleBankChange('accountNumber', e.target.value)} className={inputCls} />
                                    </div>
                                    <div className="space-y-1">
                                        <InfoTip id="ifscCode" label="IFSC Code" />
                                        <input type="text" value={formData.bankDetails?.ifscCode} onChange={e => handleBankChange('ifscCode', e.target.value)} className={inputCls} />
                                    </div>
                                </div>
                                {/* KYC */}
                                <div className="col-span-1 md:col-span-2 pt-4 border-t border-dark-border/50">
                                    <h3 className="text-sm font-bold text-white mb-4">KYC & Identity Documents</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-xs text-dark-muted uppercase">PAN Card Number</label>
                                                <input type="text" value={formData.bankDetails?.panCard} onChange={e => handleBankChange('panCard', e.target.value)}
                                                    className={inputCls + ' uppercase'} placeholder="ABCDE1234F" maxLength={10} />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-dark-muted uppercase">Upload PAN Photo</label>
                                                <div className="border border-dashed border-dark-border rounded-lg p-4 text-center hover:bg-white/5 transition-colors relative">
                                                    <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => handleFileChange(e, 'panUrl')} />
                                                    {formData.documents?.panUrl ? (
                                                        <div className="relative h-32 w-full">
                                                            <img src={formData.documents.panUrl} alt="PAN" className="h-full w-full object-contain mb-2" />
                                                            <p className="text-xs text-success">✓ Uploaded</p>
                                                        </div>
                                                    ) : (<div className="flex flex-col items-center gap-2 py-4"><Upload className="w-8 h-8 text-dark-muted" /><p className="text-xs text-dark-muted">Upload PAN</p></div>)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-xs text-dark-muted uppercase">Aadhar Number</label>
                                                <input type="text" value={formData.bankDetails?.aadharNumber} onChange={e => handleBankChange('aadharNumber', e.target.value)}
                                                    className={inputCls} placeholder="1234 5678 9012" maxLength={12} />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-dark-muted uppercase">Upload Aadhar Photo</label>
                                                <div className="border border-dashed border-dark-border rounded-lg p-4 text-center hover:bg-white/5 transition-colors relative">
                                                    <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => handleFileChange(e, 'aadharUrl')} />
                                                    {formData.documents?.aadharUrl ? (
                                                        <div className="relative h-32 w-full">
                                                            <img src={formData.documents.aadharUrl} alt="Aadhar" className="h-full w-full object-contain mb-2" />
                                                            <p className="text-xs text-success">✓ Uploaded</p>
                                                        </div>
                                                    ) : (<div className="flex flex-col items-center gap-2 py-4"><Upload className="w-8 h-8 text-dark-muted" /><p className="text-xs text-dark-muted">Upload Aadhar</p></div>)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </AccordionSection>

                        {/* 4. Relative / Emergency Contact */}
                        <AccordionSection icon={<span className="text-xl">👨‍👩‍👧</span>} title="Relative / Emergency Contact">

                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                <div className="space-y-1">
                                    <label className="text-xs text-dark-muted uppercase">Relative Name</label>
                                    <input type="text" value={formData.relativeInfo?.name || ''}
                                        onChange={e => handleRelativeChange('name', e.target.value)}
                                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none"
                                        placeholder="e.g. Ramesh Kumar" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-dark-muted uppercase">Relation</label>
                                    <select value={formData.relativeInfo?.relation || ''}
                                        onChange={e => handleRelativeChange('relation', e.target.value)}
                                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none">
                                        <option value="">Select Relation</option>
                                        {['Father', 'Mother', 'Spouse', 'Son', 'Daughter', 'Brother', 'Sister', 'Uncle', 'Aunt', 'Friend', 'Other'].map(r => (
                                            <option key={r} value={r}>{r}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-dark-muted uppercase">Phone Number</label>
                                    <input type="tel" value={formData.relativeInfo?.phone || ''}
                                        onChange={e => handleRelativeChange('phone', e.target.value)}
                                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none"
                                        placeholder="+91 98765 43210" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-dark-muted uppercase">Date of Birth</label>
                                    <input type="date" value={formData.relativeInfo?.dateOfBirth || ''}
                                        onChange={e => handleRelativeChange('dateOfBirth', e.target.value)}
                                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-dark-muted uppercase">Occupation</label>
                                    <input type="text" value={formData.relativeInfo?.occupation || ''}
                                        onChange={e => handleRelativeChange('occupation', e.target.value)}
                                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none"
                                        placeholder="e.g. Farmer, Business" />
                                </div>
                                <div className="space-y-1 md:col-span-1">
                                    <label className="text-xs text-dark-muted uppercase">Address</label>
                                    <input type="text" value={formData.relativeInfo?.address || ''}
                                        onChange={e => handleRelativeChange('address', e.target.value)}
                                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none"
                                        placeholder="Village / City, State" />
                                </div>
                            </div>

                            {/* KYC & Documents */}
                            <div className="border-t border-dark-border/50 pt-6">
                                <h3 className="text-sm font-bold text-white mb-4">📄 KYC Documents of Relative</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div className="space-y-1">
                                        <label className="text-xs text-dark-muted uppercase">Aadhar Number</label>
                                        <input type="text" value={formData.relativeInfo?.aadharNumber || ''}
                                            onChange={e => handleRelativeChange('aadharNumber', e.target.value)}
                                            className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none"
                                            placeholder="1234 5678 9012" maxLength={12} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-dark-muted uppercase">PAN Number</label>
                                        <input type="text" value={formData.relativeInfo?.panNumber || ''}
                                            onChange={e => handleRelativeChange('panNumber', e.target.value.toUpperCase())}
                                            className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:border-primary-500 outline-none uppercase"
                                            placeholder="ABCDE1234F" maxLength={10} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Photo Upload */}
                                    {([
                                        { key: 'photoUrl', label: '🧑 Relative Photo', hint: 'Passport-size photo' },
                                        { key: 'aadharUrl', label: '🪪 Aadhar Card', hint: 'Front side of Aadhar' },
                                        { key: 'panUrl', label: '💳 PAN Card', hint: 'Front side of PAN' },
                                    ] as { key: 'photoUrl' | 'aadharUrl' | 'panUrl'; label: string; hint: string }[]).map(({ key, label, hint }) => (
                                        <div key={key} className="space-y-1">
                                            <label className="text-xs text-dark-muted uppercase">{label}</label>
                                            <div className="border border-dashed border-dark-border rounded-lg p-4 text-center hover:bg-white/5 transition-colors relative">
                                                <input type="file" accept="image/*"
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    onChange={e => handleRelativeFileChange(e, key)} />
                                                {formData.relativeInfo?.[key] ? (
                                                    <div className="relative h-32 w-full">
                                                        <img src={formData.relativeInfo[key]} alt={label} className="h-full w-full object-contain" />
                                                        <p className="text-xs text-success mt-1">✓ Uploaded</p>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-2 py-4">
                                                        <Upload className="w-7 h-7 text-dark-muted" />
                                                        <p className="text-xs text-dark-muted">{hint}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </AccordionSection>

                        {/* 5. Govt Statutory Deductions */}
                        <AccordionSection icon={<ShieldCheck className="w-5 h-5 text-blue-400" />} title="Govt. Statutory Deductions">
                            <p className="text-sm text-dark-muted mb-6">Enable deductions applicable to this employee. These will be auto-calculated in salary slips.</p>

                            <div className="space-y-4">

                                {/* PF */}
                                <StatutoryCard color="blue" icon="🏦" title="PF — Provident Fund"
                                    subtitle={sc.pfApplicable ? `${sc.pfRate ?? 12}% of Basic${sc.pfCapped ? ' (max ₹1,800)' : ' (uncapped)'}` : 'Not applicable'}
                                    enabled={sc.pfApplicable} onToggle={v => handleStatutoryChange('pfApplicable', v)}>
                                    <div className="space-y-4">
                                        {sc.pfApplicable && (
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-xs text-dark-muted uppercase">UAN Number</label>
                                                    <input type="text" value={sc.pfNumber || ''} onChange={e => handleStatutoryChange('pfNumber', e.target.value)}
                                                        className={inputCls} placeholder="100XXXXXXXXX" />
                                                </div>
                                                <div className="space-y-1">
                                                    <InfoTip id="pfContribution" label="Rate (%)" />
                                                    <input type="number" min="0" max="20" value={sc.pfRate ?? 12} onChange={e => handleStatutoryChange('pfRate', Number(e.target.value))}
                                                        className={inputCls} />
                                                </div>
                                                <div className="flex flex-col justify-end">
                                                    <Toggle checked={sc.pfCapped ?? true} onChange={v => handleStatutoryChange('pfCapped', v)} label="Cap at ₹1,800" desc="Standard statutory limit" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </StatutoryCard>

                                {/* ESIC */}
                                <StatutoryCard color="green" icon="🏥" title="ESIC — Employee State Insurance"
                                    subtitle={sc.esicApplicable ? `${sc.esicRate ?? 0.75}% of Gross (only if gross ≤ ₹21,000)` : 'Not applicable'}
                                    enabled={sc.esicApplicable} onToggle={v => handleStatutoryChange('esicApplicable', v)}>
                                    <div className="space-y-4">
                                        {sc.esicApplicable && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-xs text-dark-muted uppercase">ESIC IP Number</label>
                                                    <input type="text" value={sc.esicNumber || ''} onChange={e => handleStatutoryChange('esicNumber', e.target.value)}
                                                        className={inputCls} placeholder="ESIC IP Number" />
                                                </div>
                                                <div className="space-y-1">
                                                    <InfoTip id="esiContribution" label="Rate (%) — Default 0.75" />
                                                    <input type="number" min="0" max="5" step="0.01" value={sc.esicRate ?? 0.75} onChange={e => handleStatutoryChange('esicRate', Number(e.target.value))}
                                                        className={inputCls} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </StatutoryCard>

                                {/* PT */}
                                <StatutoryCard color="yellow" icon="🏛️" title="PT — Professional Tax"
                                    subtitle={sc.ptApplicable ? `₹${sc.ptAmount ?? 'Auto-slab'}/month (${sc.ptState || 'State slab'})` : 'Not applicable'}
                                    enabled={sc.ptApplicable} onToggle={v => handleStatutoryChange('ptApplicable', v)}>
                                    <div className="space-y-4">
                                        {sc.ptApplicable && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-xs text-dark-muted uppercase">State</label>
                                                    <select value={sc.ptState || ''} onChange={e => handleStatutoryChange('ptState', e.target.value)} className={inputCls}>
                                                        <option value="">Auto-slab</option>
                                                        {['Andhra Pradesh', 'Gujarat', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Tamil Nadu', 'Telangana', 'West Bengal'].map(s => (
                                                            <option key={s} value={s}>{s}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs text-dark-muted uppercase">Custom Monthly Amount (₹)</label>
                                                    <input type="number" min="0" max="2500" value={sc.ptAmount ?? ''} onChange={e => handleStatutoryChange('ptAmount', e.target.value === '' ? undefined : Number(e.target.value))}
                                                        className={inputCls} placeholder="Leave blank for auto-slab" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </StatutoryCard>

                                {/* TDS */}
                                <StatutoryCard color="red" icon="📋" title="TDS — Tax Deducted at Source"
                                    subtitle={sc.tdsApplicable ? (sc.tdsPercentage !== undefined ? `${sc.tdsPercentage}% flat override` : 'Auto income-tax slab calculation') : 'Not applicable'}
                                    enabled={sc.tdsApplicable} onToggle={v => handleStatutoryChange('tdsApplicable', v)}>
                                    <div className="space-y-4">
                                        {sc.tdsApplicable && (
                                            <div className="space-y-4">
                                                <Toggle checked={sc.tdsPanLinked ?? true} onChange={v => handleStatutoryChange('tdsPanLinked', v)} label="PAN is linked" desc="If unlinked, flat 20% TDS is deducted" />
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <label className="text-xs text-dark-muted uppercase">Declared 80C Investments (₹/year)</label>
                                                        <input type="number" min="0" max="150000" value={sc.tdsDeclaredInvestment ?? 0} onChange={e => handleStatutoryChange('tdsDeclaredInvestment', Number(e.target.value))}
                                                            className={inputCls} placeholder="e.g. 100000" />
                                                        <p className="text-xs text-dark-muted">Max ₹1,50,000 under 80C (PPF, LIC, ELSS etc.)</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-xs text-dark-muted uppercase">Manual TDS % Override (optional)</label>
                                                        <input type="number" min="0" max="30" value={sc.tdsPercentage ?? ''} onChange={e => handleStatutoryChange('tdsPercentage', e.target.value === '' ? undefined : Number(e.target.value))}
                                                            className={inputCls} placeholder="Leave blank for auto-slab" />
                                                        <p className="text-xs text-dark-muted">Overrides auto-calculation if filled</p>
                                                    </div>
                                                </div>
                                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                                    <p className="text-xs text-blue-300 font-medium">ℹ️ New Regime Slabs (FY 2024-25)</p>
                                                    <div className="grid grid-cols-2 gap-x-6 mt-2 text-xs text-dark-muted">
                                                        <span>₹0 – ₹3L → Nil</span><span>₹3L – ₹6L → 5%</span>
                                                        <span>₹6L – ₹9L → 10%</span><span>₹9L – ₹12L → 15%</span>
                                                        <span>₹12L – ₹15L → 20%</span><span>Above ₹15L → 30%</span>
                                                    </div>
                                                    <p className="text-xs text-dark-muted mt-1">+ 4% Health &amp; Education Cess | Standard Deduction ₹50,000</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </StatutoryCard>

                            </div>
                        </AccordionSection>
                    </>
                ) : (
                    <div className="glass p-6 rounded-2xl border border-dark-border flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-dark-bg/80 flex items-center justify-center">
                                <ShieldCheck className="w-6 h-6 text-dark-muted" />
                            </div>
                            <div>
                                <h3 className="text-white font-medium text-sm">Financials Access Restricted</h3>
                                <p className="text-xs text-dark-muted">Aapke paas financial details view ya change karne ka permission nahi hai.</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-4 pt-6">
                    <button type="button" onClick={() => navigate('/employees')} className="px-6 py-2 rounded-lg text-dark-muted hover:text-white transition-colors">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting || !currentCompanyId}
                        className="px-8 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition-colors font-medium shadow-lg shadow-primary-600/20"
                    >
                        {submitting ? (
                            <><span className="animate-spin">⟳</span> Saving...</>
                        ) : (
                            <><Save className="w-4 h-4" /> Save Employee</>
                        )}
                    </button>
                </div>

            </form >
        </div >
    );
};