import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { Roles, EmployeeStatus } from '@/types';
import { Building2, MapPin, ArrowRight } from 'lucide-react';
import { PasswordStrengthInput, isPasswordValid } from '@/components/ui/PasswordStrengthInput';
import { useDialog } from '@/components/DialogProvider';

export const CompanySetup = () => {
    const navigate = useNavigate();
    const { addCompany, switchCompany } = useMultiCompanyStore();
    const { addEmployee } = useEmployeeStore();
    const { alert } = useDialog();

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        address: '',
        gstNumber: '',
        panNumber: '',
        logo: '',
        licenseKey: '',
        // Admin User
        adminEmail: '',
        adminUserId: '',
        adminPassword: '',
        adminName: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validate License Key
        if (formData.licenseKey !== 'SURESH8824') {
            setError('Invalid License Key! Please contact administrator.');
            return;
        }
        // Password strength check
        if (!isPasswordValid(formData.adminPassword)) {
            setError('Password weak hai! Min 8 characters, 1 number aur 1 letter hona chahiye.');
            return;
        }

        setIsSubmitting(true);

        // Add dummy delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Create Company
        const newCompany = {
            name: formData.name,
            code: formData.code.toUpperCase(),
            address: formData.address,
            gstNumber: formData.gstNumber.toUpperCase(),
            panNumber: formData.panNumber.toUpperCase(),
            logo: formData.logo || `https://ui-avatars.com/api/?name=${formData.name}`,
            employeeCount: 0,
            isActive: true
        };

        // Await the async addCompany and get back the created company
        const createdCompany = await addCompany({ ...newCompany });

        if (createdCompany) {
            switchCompany(createdCompany.id);

            // Create Admin Employee — pass companyId explicitly so addEmployee
            // doesn't fail due to currentCompanyId not being set yet in the store.
            try {
                await addEmployee({
                    code: formData.adminUserId.toUpperCase(),
                    name: formData.adminName,
                    email: formData.adminEmail,
                    phone: '',
                    department: 'Administration',
                    designation: 'Super Administrator',
                    role: Roles.SUPER_ADMIN,
                    joiningDate: new Date().toISOString().split('T')[0],
                    status: EmployeeStatus.ACTIVE,
                    shift: 'GENERAL',
                    salaryType: 'MONTHLY' as any,
                    basicSalary: 0,
                    password: formData.adminPassword,
                    companyId: createdCompany.id
                }, createdCompany.id); // ← explicit companyId override
            } catch (empErr: any) {
                setError(`Company created but admin user setup failed: ${empErr?.message || empErr}. Please add admin manually.`);
                setIsSubmitting(false);
                // Still navigate to login — company exists, user can login via server fallback
                setTimeout(() => navigate('/login'), 2500);
                return;
            }

            // Show Success Message
            await alert({
                title: '✅ Company Created!',
                message: 'Aapki company successfully create ho gayi. Ab apni Admin ID se login karein.',
                variant: 'info',
            });

            navigate('/login');
        } else {
            setError('Company creation failed. Please check server connection.');
        }

        setIsSubmitting(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0f172a] relative overflow-hidden p-4">
            {/* Background Effects */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl -translate-y-1/2" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary-600/10 rounded-full blur-3xl translate-y-1/2" />

            <div className="w-full max-w-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-8 relative z-10 animate-fade-in-up">

                <div className="text-center mb-10">
                    <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary-500/20">
                        <Building2 className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-2">Setup Your Organization</h1>
                    <p className="text-slate-400">Welcome to SM Payroll. Let's start by creating your company profile.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                <span className="text-red-400 text-lg">⚠</span>
                            </div>
                            <p className="text-red-300 text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Company Name *</label>
                            <input
                                required
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder-slate-600"
                                placeholder="e.g. SM Industries"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Company Short Code *</label>
                            <input
                                required
                                type="text"
                                value={formData.code}
                                onChange={e => setFormData({ ...formData, code: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder-slate-600 uppercase"
                                placeholder="e.g. SMI"
                                maxLength={6}
                            />
                            <p className="text-[10px] text-slate-500">Used for IDs (e.g. SMI-001)</p>
                        </div>

                        <div className="md:col-span-2 space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Official Address</label>
                            <div className="relative">
                                <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder-slate-600"
                                    placeholder="Registered Office Address"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Admin User Section */}
                    <div className="p-6 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-xl border border-blue-500/30">
                        <h3 className="text-sm font-bold text-blue-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs">👤</span>
                            Company Login Credentials
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Company Login ID *</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.adminUserId}
                                    onChange={e => setFormData({ ...formData, adminUserId: e.target.value.toUpperCase() })}
                                    className="w-full bg-slate-950 border border-blue-500/30 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-slate-600 font-mono uppercase"
                                    placeholder="ADMIN-001"
                                    maxLength={15}
                                />
                                <p className="text-[10px] text-slate-500">This will be your Login User ID</p>
                            </div>
                            <div className="md:col-span-2">
                                <PasswordStrengthInput
                                    label="Password *"
                                    value={formData.adminPassword}
                                    onChange={v => setFormData({ ...formData, adminPassword: v })}
                                    placeholder="Min 8 chars, 1 number"
                                    required
                                    showStrength={true}
                                    className="[&_label]:text-slate-400 [&_input]:bg-slate-950 [&_input]:border-blue-500/30 [&_input]:rounded-xl [&_input]:px-4 [&_input]:py-3"
                                />
                            </div>

                            <div className="col-span-1 md:col-span-2 my-2 border-t border-blue-500/20"></div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Admin Name *</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.adminName}
                                    onChange={e => setFormData({ ...formData, adminName: e.target.value })}
                                    className="w-full bg-slate-950 border border-blue-500/30 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-slate-600"
                                    placeholder="John Doe"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Email *</label>
                                <input
                                    required
                                    type="email"
                                    value={formData.adminEmail}
                                    onChange={e => setFormData({ ...formData, adminEmail: e.target.value })}
                                    className="w-full bg-slate-950 border border-blue-500/30 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-slate-600"
                                    placeholder="admin@company.com"
                                />
                            </div>
                        </div>
                    </div>

                    {/* License Key */}
                    <div className="p-6 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/30">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">🔑</span>
                                License Key *
                            </label>
                            <input
                                required
                                type="text"
                                value={formData.licenseKey}
                                onChange={e => setFormData({ ...formData, licenseKey: e.target.value.toUpperCase() })}
                                className="w-full bg-slate-950 border border-amber-500/30 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder-amber-900/50 font-mono text-center tracking-widest text-lg"
                                placeholder="ENTER ACTIVATION KEY"
                            />
                            <p className="text-[10px] text-amber-400/70">Contact administrator for activation key</p>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-4 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-primary-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                    >
                        {isSubmitting ? 'Creating Workspace...' : 'Create Company Workspace'}
                        {!isSubmitting && <ArrowRight className="w-5 h-5" />}
                    </button>

                    <div className="text-center mt-6">
                        <p className="text-slate-500 text-sm">
                            Already have an account?{' '}
                            <button
                                type="button"
                                onClick={() => navigate('/login')}
                                className="text-primary-400 hover:text-primary-300 font-bold hover:underline transition-colors"
                            >
                                Login here
                            </button>
                        </p>
                    </div>

                </form>
            </div>
        </div >
    );
};
