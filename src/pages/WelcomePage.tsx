import { useNavigate, Navigate } from 'react-router-dom';
import { Building2, Users, PlusCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export const WelcomePage = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0f172a] relative overflow-hidden p-6">
            {/* Background Effects */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl -translate-y-1/2" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary-600/10 rounded-full blur-3xl translate-y-1/2" />

            <div className="w-full max-w-5xl z-10">
                <div className="text-center mb-16 animate-fade-in-up">
                    <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary-500/20">
                        <ShieldCheck className="w-12 h-12 text-white" />
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black text-white mb-4 tracking-tight">
                        SM <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-400">PAYROLL</span>
                    </h1>
                    <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                        Advanced Payroll & Human Resource Management System
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                    {/* Option 1: Company Login */}
                    <button
                        onClick={() => navigate('/login')}
                        className="group relative bg-slate-900/50 backdrop-blur-xl border border-slate-700 hover:border-primary-500 rounded-3xl p-8 text-left transition-all hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary-500/20"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl" />
                        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 border border-slate-700 group-hover:bg-primary-500 group-hover:border-primary-400 transition-colors">
                            <Building2 className="w-8 h-8 text-primary-400 group-hover:text-white transition-colors" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Company Login</h3>
                        <p className="text-slate-400 text-sm mb-6">Access your company dashboard, manage payroll, and settings.</p>
                        <div className="flex items-center text-primary-400 font-bold group-hover:translate-x-2 transition-transform">
                            Login Now <ArrowRight className="w-4 h-4 ml-2" />
                        </div>
                    </button>

                    {/* Option 2: Employee Login */}
                    <button
                        onClick={() => navigate('/login')}
                        className="group relative bg-slate-900/50 backdrop-blur-xl border border-slate-700 hover:border-emerald-500 rounded-3xl p-8 text-left transition-all hover:-translate-y-2 hover:shadow-2xl hover:shadow-emerald-500/20"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl" />
                        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 border border-slate-700 group-hover:bg-emerald-500 group-hover:border-emerald-400 transition-colors">
                            <Users className="w-8 h-8 text-emerald-400 group-hover:text-white transition-colors" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Employee Login</h3>
                        <p className="text-slate-400 text-sm mb-6">View your payslips, loans, leave balances, and attendance.</p>
                        <div className="flex items-center text-emerald-400 font-bold group-hover:translate-x-2 transition-transform">
                            Employee Access <ArrowRight className="w-4 h-4 ml-2" />
                        </div>
                    </button>

                    {/* Option 3: Create Company */}
                    <button
                        onClick={() => navigate('/company-setup')}
                        className="group relative bg-slate-900/50 backdrop-blur-xl border border-slate-700 hover:border-blue-500 rounded-3xl p-8 text-left transition-all hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-500/20"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl" />
                        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 border border-slate-700 group-hover:bg-blue-500 group-hover:border-blue-400 transition-colors">
                            <PlusCircle className="w-8 h-8 text-blue-400 group-hover:text-white transition-colors" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Create Company</h3>
                        <p className="text-slate-400 text-sm mb-6">New to SM Payroll? Setup your organization in seconds.</p>
                        <div className="flex items-center text-blue-400 font-bold group-hover:translate-x-2 transition-transform">
                            Get Started <ArrowRight className="w-4 h-4 ml-2" />
                        </div>
                    </button>
                </div>

                <div className="text-center mt-16 text-slate-600 text-sm font-medium">
                    Secure Enterprise Payroll System • v2.0
                </div>
            </div>
        </div>
    );
};
