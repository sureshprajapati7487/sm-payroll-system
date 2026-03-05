import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { LoginPage } from '@/pages/LoginPage';
import { UnauthorizedPage } from '@/pages/UnauthorizedPage';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { EmployeeList } from '@/pages/employees/EmployeeList';
import { EmployeeProfile } from '@/pages/employees/EmployeeProfile';
import { EmployeeForm } from '@/pages/employees/EmployeeForm';
import { AttendanceDashboard } from './pages/attendance/AttendanceDashboard';
import { HolidayManager } from './pages/attendance/HolidayManager';
import { FaceKioskPage } from './pages/attendance/FaceKioskPage';
import { ProductionDashboard } from './pages/production/ProductionDashboard';
import { RateManager } from './pages/production/RateManager';
import { WorkGroupManager } from './pages/production/WorkGroupManager';
import { BulkEntryForm } from './pages/production/BulkEntryForm';
import { LeaveDashboard } from '@/pages/leaves/LeaveDashboard';
import { LoanDashboard } from '@/pages/loans/LoanDashboard';
import { PayrollDashboard } from '@/pages/payroll/PayrollDashboard';
import { PayrollHistory } from '@/pages/payroll/PayrollHistory';
import { PayrollSimulation } from '@/pages/payroll/PayrollSimulation';
import { PayslipView } from '@/pages/payroll/PayslipView';
import { QuickActionPage } from '@/pages/QuickActionPage';
import { Dashboard } from '@/pages/Dashboard';
import { ForceIpRedirect } from '@/components/ForceIpRedirect';
import { LoanApprovalModal } from '@/components/LoanApprovalModal';
import { ExpensesDashboard } from '@/pages/expenses/ExpensesDashboard';
import { ApprovalCenter } from '@/pages/approvals/ApprovalCenter';

// New Calculator Pages
import { CTCCalculator } from '@/pages/calculators/CTCCalculator';
import { TDSCalculator } from '@/pages/calculators/TDSCalculator';
import { PFESICalculator } from '@/pages/calculators/PFESICalculator';

// New Admin Pages
import { BulkImport } from '@/pages/admin/BulkImport';
import { AuditLogs } from '@/pages/admin/AuditLogs';
import { TrashManagement } from '@/pages/admin/TrashManagement';
import { DraftManager } from '@/pages/admin/DraftManager';
import { DataConsistencyChecker } from '@/pages/admin/DataConsistencyChecker';
import { DataSeeding } from '@/pages/admin/DataSeeding';

// New Settings Pages
import { GeneralSettings } from '@/pages/settings/GeneralSettings';
import { SecuritySettings } from '@/pages/settings/SecuritySettings';
import { ThemeCustomizer } from '@/pages/settings/ThemeCustomizer';
import { ConfigurationPage } from '@/pages/settings/ConfigurationPage';
import { ServerStatusDashboard } from '@/pages/settings/ServerStatusDashboard';
import { NotificationSettings } from '@/pages/settings/NotificationSettings';
import { LanguageSettings } from '@/pages/settings/LanguageSettings';

// New Statutory Pages
import { Form16Generator } from '@/pages/statutory/Form16Generator';
import { StatutoryReports } from '@/pages/statutory/StatutoryReports';

// Security Pages
import { SecurityAlerts } from '@/pages/security/SecurityAlerts';

// Company Pages
import { CompanySwitcher } from '@/pages/company/CompanySwitcher';

// Mobile Pages
import { QuickCheckIn } from '@/pages/mobile/QuickCheckIn';
import { MobileDashboard } from '@/pages/mobile/MobileDashboard';

// Components
import { CommandPalette } from '@/components/CommandPalette';
import { ErrorBoundary, PageErrorBoundary } from '@/components/ErrorBoundary';
import { CameraPunchWidget } from '@/components/CameraPunchWidget';
import { GlobalPunchFAB } from '@/components/GlobalPunchFAB';

// New Reporting & Finance Pages
import { ReportBuilder } from '@/pages/reports/ReportBuilder';
import { ScheduledReports } from '@/pages/reports/ScheduledReports';
import { CustomReportBuilder } from '@/pages/reports/CustomReportBuilder';
import { FinanceDashboard } from '@/pages/finance/FinanceDashboard';
import { DepartmentFinanceReport } from '@/pages/finance/DepartmentFinanceReport';
import { CostCenterMapping } from '@/pages/finance/CostCenterMapping';
import { AdvanceSalaryManagement } from '@/pages/finance/AdvanceSalaryManagement';

import { UserProfile } from '@/pages/settings/UserProfile';
import { DatabaseBackup } from '@/pages/admin/DatabaseBackup';
import { HelpCenter } from '@/pages/support/HelpCenter';
import { NotFound } from '@/pages/NotFound';
import { SalesmanDashboard } from '@/pages/sales/SalesmanDashboard';
import { ClientListPage } from '@/pages/sales/ClientListPage';



import { CompanySetup } from '@/pages/company/CompanySetup';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';

// Helper component for Company Check
const CompanyGuard = ({ children }: { children: JSX.Element }) => {
    const { companies, isLoading } = useMultiCompanyStore();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    if (companies.length === 0) {
        return <Navigate to="/company-setup" replace />;
    }
    return children;
};

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import { usePayrollStore } from '@/store/payrollStore';
import { useLeaveStore } from '@/store/leaveStore';
import { useExpenseStore } from '@/store/expenseStore';

// ── Auth Guard: agar token hai toh login page nahi dikhega, seedha dashboard ──
const AuthGuard = ({ children }: { children: JSX.Element }) => {
    const { isAuthenticated } = useAuthStore();
    if (isAuthenticated) return <Navigate to="/dashboard" replace />;
    return children;
};

import { useDataSync } from '@/hooks/useDataSync';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { useGlobalGPS } from '@/hooks/useGlobalGPS';
import { SessionTimeoutModal } from '@/components/SessionTimeoutModal';

function App() {
    const { fetchCompanies } = useMultiCompanyStore();
    const { fetchEmployees } = useEmployeeStore();
    const { fetchAttendance } = useAttendanceStore();
    const { fetchPayroll } = usePayrollStore();
    const { fetchLeaves } = useLeaveStore();
    const { fetchExpenses } = useExpenseStore();

    // Smart Auto-Sync: every 30s, only when tab is visible
    useDataSync(30000);

    // Session Timeout: 30 min inactivity → 2 min countdown → auto-logout
    const { showWarning, secondsLeft, extendSession, doLogout } = useSessionTimeout(30 * 60 * 1000);

    const { isAuthenticated } = useAuthStore();

    // ── Global GPS: Login ke baad request, Logout tak active ──
    useGlobalGPS(isAuthenticated);

    useEffect(() => {
        // Only fetch data after user has logged in (has a valid token)
        if (!isAuthenticated) return;
        fetchCompanies();
        fetchEmployees();
        fetchAttendance();
        fetchPayroll();
        fetchLeaves();
        fetchExpenses();
    }, [isAuthenticated]);

    return (
        <ErrorBoundary>
            <BrowserRouter>
                <ForceIpRedirect />
                <LoanApprovalModal />
                <CommandPalette />
                <CameraPunchWidget />
                <GlobalPunchFAB />
                {showWarning && (
                    <SessionTimeoutModal
                        secondsLeft={secondsLeft}
                        onStayLoggedIn={extendSession}
                        onLogout={doLogout}
                    />
                )}
                <Routes>
                    {/* Public Routes — AuthGuard: already logged-in users seedha /dashboard jao */}
                    <Route path="/" element={<AuthGuard><LoginPage /></AuthGuard>} />
                    <Route path="/login" element={<AuthGuard><LoginPage /></AuthGuard>} />
                    <Route path="/company-setup" element={<CompanySetup />} />
                    <Route path="/quick-action" element={<QuickActionPage />} />
                    <Route path="/go/:action/:id" element={<QuickActionPage />} />

                    {/* Protected Dashboard Routes */}
                    <Route element={<ProtectedRoute />}>
                        <Route element={
                            <CompanyGuard>
                                <DashboardLayout />
                            </CompanyGuard>
                        }>
                            {/* Dashboard is no longer default root, but default AFTER login */}
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/unauthorized" element={<UnauthorizedPage />} />

                            {/* Employee Module */}
                            <Route path="/employees" element={<EmployeeList />} />
                            <Route path="/employees/new" element={<EmployeeForm />} />
                            <Route path="/employees/:id" element={<EmployeeProfile />} />
                            <Route path="/employees/:id/edit" element={<EmployeeForm />} />

                            {/* Existing Modules */}
                            <Route path="/attendance" element={<PageErrorBoundary pageName="Attendance"><AttendanceDashboard /></PageErrorBoundary>} />
                            <Route path="/attendance/holidays" element={<PageErrorBoundary pageName="Holiday Manager"><HolidayManager /></PageErrorBoundary>} />
                            <Route path="/attendance/kiosk" element={<PageErrorBoundary pageName="Face Kiosk"><FaceKioskPage /></PageErrorBoundary>} />
                            <Route path="/salesman" element={<PageErrorBoundary pageName="Salesman Dashboard"><SalesmanDashboard /></PageErrorBoundary>} />
                            <Route path="/salesman/clients" element={<PageErrorBoundary pageName="Client / Party List"><ClientListPage /></PageErrorBoundary>} />
                            <Route path="/production" element={<PageErrorBoundary pageName="Production Dashboard"><ProductionDashboard /></PageErrorBoundary>} />
                            <Route path="/production/rates" element={<PageErrorBoundary pageName="Rate Manager"><RateManager /></PageErrorBoundary>} />
                            <Route path="/production/workgroups" element={<PageErrorBoundary pageName="Work Groups"><WorkGroupManager /></PageErrorBoundary>} />
                            <Route path="/production/bulk" element={<PageErrorBoundary pageName="Bulk Production Entry"><BulkEntryForm /></PageErrorBoundary>} />
                            <Route path="/leaves" element={<PageErrorBoundary pageName="Leave Dashboard"><LeaveDashboard /></PageErrorBoundary>} />
                            <Route path="/loans" element={<PageErrorBoundary pageName="Loan Manager"><LoanDashboard /></PageErrorBoundary>} />
                            <Route path="/approvals" element={<PageErrorBoundary pageName="Approval Center"><ApprovalCenter /></PageErrorBoundary>} />
                            <Route path="/payroll" element={<PageErrorBoundary pageName="Payroll Dashboard"><PayrollDashboard /></PageErrorBoundary>} />
                            <Route path="/payroll/history" element={<PageErrorBoundary pageName="Payroll History"><PayrollHistory /></PageErrorBoundary>} />
                            <Route path="/payroll/simulation" element={<PageErrorBoundary pageName="Payroll Simulation"><PayrollSimulation /></PageErrorBoundary>} />
                            <Route path="/payroll/slip/:id" element={<PageErrorBoundary pageName="Payslip"><PayslipView /></PageErrorBoundary>} />

                            {/* Expenses */}
                            <Route path="/expenses" element={<PageErrorBoundary pageName="Expenses"><ExpensesDashboard /></PageErrorBoundary>} />

                            {/* Calculator Pages */}
                            <Route path="/calculators/ctc" element={<CTCCalculator />} />
                            <Route path="/calculators/tds" element={<TDSCalculator />} />
                            <Route path="/calculators/pfesi" element={<PFESICalculator />} />

                            {/* Admin Tools */}
                            <Route path="/admin/bulk-import" element={<PageErrorBoundary pageName="Bulk Import"><BulkImport /></PageErrorBoundary>} />
                            <Route path="/admin/audit-logs" element={<PageErrorBoundary pageName="Audit Logs"><AuditLogs /></PageErrorBoundary>} />
                            <Route path="/admin/backup" element={<PageErrorBoundary pageName="Database Backup"><DatabaseBackup /></PageErrorBoundary>} />
                            <Route path="/admin/trash" element={<PageErrorBoundary pageName="Trash Management"><TrashManagement /></PageErrorBoundary>} />
                            <Route path="/admin/drafts" element={<PageErrorBoundary pageName="Draft Manager"><DraftManager /></PageErrorBoundary>} />
                            <Route path="/admin/consistency" element={<PageErrorBoundary pageName="Data Consistency"><DataConsistencyChecker /></PageErrorBoundary>} />
                            <Route path="/admin/seed" element={<PageErrorBoundary pageName="Data Seeding"><DataSeeding /></PageErrorBoundary>} />

                            {/* Reports & Finance */}
                            <Route path="/reports/builder" element={<PageErrorBoundary pageName="Report Builder"><ReportBuilder /></PageErrorBoundary>} />
                            <Route path="/reports/custom" element={<PageErrorBoundary pageName="Custom Reports"><CustomReportBuilder /></PageErrorBoundary>} />
                            <Route path="/reports/scheduled" element={<PageErrorBoundary pageName="Scheduled Reports"><ScheduledReports /></PageErrorBoundary>} />
                            <Route path="/finance/dashboard" element={<PageErrorBoundary pageName="Finance Dashboard"><FinanceDashboard /></PageErrorBoundary>} />
                            <Route path="/finance/department" element={<PageErrorBoundary pageName="Department Finance"><DepartmentFinanceReport /></PageErrorBoundary>} />
                            <Route path="/finance/cost-centers" element={<PageErrorBoundary pageName="Cost Centers"><CostCenterMapping /></PageErrorBoundary>} />
                            <Route path="/finance/advance-salary" element={<PageErrorBoundary pageName="Advance Salary"><AdvanceSalaryManagement /></PageErrorBoundary>} />

                            {/* Statutory Compliance */}
                            <Route path="/statutory/form16" element={<PageErrorBoundary pageName="Form 16 Generator"><Form16Generator /></PageErrorBoundary>} />
                            <Route path="/statutory/reports" element={<PageErrorBoundary pageName="Statutory Reports"><StatutoryReports /></PageErrorBoundary>} />

                            {/* Settings */}
                            <Route path="/settings" element={<GeneralSettings />} />
                            <Route path="/settings/security" element={<SecuritySettings />} />
                            <Route path="/settings/profile" element={<UserProfile />} />
                            <Route path="/settings/theme" element={<ThemeCustomizer />} />
                            <Route path="/settings/language" element={<LanguageSettings />} />
                            <Route path="/settings/server-status" element={<ServerStatusDashboard />} />
                            <Route path="/settings/notifications" element={<NotificationSettings />} />
                            <Route path="/configuration" element={<ConfigurationPage />} />
                            <Route path="/security/alerts" element={<SecurityAlerts />} />

                            {/* Company Management */}
                            <Route path="/company/switcher" element={<CompanySwitcher />} />

                            {/* Mobile Features */}
                            <Route path="/mobile/checkin" element={<QuickCheckIn />} />
                            <Route path="/mobile/dashboard" element={<MobileDashboard />} />

                            <Route path="/help" element={<HelpCenter />} />
                        </Route>
                    </Route>

                    {/* Public Routes */}
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </BrowserRouter>
        </ErrorBoundary>
    );
}

export default App;
