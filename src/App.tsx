import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// ── Infrastructure (kept static — always needed, no async split) ──────────────
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PermissionRefreshSync } from '@/components/auth/PermissionRefreshSync';
import { ErrorBoundary, PageErrorBoundary } from '@/components/ErrorBoundary';
import { ForceIpRedirect } from '@/components/ForceIpRedirect';
import { LoanApprovalModal } from '@/components/LoanApprovalModal';
import { CommandPalette } from '@/components/CommandPalette';
import { CameraPunchWidget } from '@/components/CameraPunchWidget';
import { InstallPWA } from '@/components/InstallPWA';
import { SecurityAlertToast } from '@/components/security/SecurityAlertToast';
import { DialogProvider } from '@/components/DialogProvider';

// ── Stores / Hooks ────────────────────────────────────────────────────────────
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { useAuthStore } from '@/store/authStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import { usePayrollStore } from '@/store/payrollStore';
import { useLeaveStore } from '@/store/leaveStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useInternalDepartmentStore } from '@/store/departmentStore';
import { useInternalShiftStore } from '@/store/shiftStore';
import { useInternalWorkGroupStore } from '@/store/workGroupStore';
import { useRolePermissionsStore } from '@/store/rolePermissionsStore';
import { PERMISSIONS } from '@/config/permissions';
import { useDataSync } from '@/hooks/useDataSync';
import { useGlobalGPS } from '@/hooks/useGlobalGPS';
import { useBackgroundServices } from '@/hooks/useBackgroundServices';

// ── PageSkeleton — shown while lazy chunks are loading ────────────────────────
const PageSkeleton = () => (
    <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500" />
    </div>
);

// Helper: lazy-load a named export from a module without touching the source file
function lazyLoad<T extends Record<string, any>>(importer: () => Promise<T>, name: keyof T) {
    return lazy(() => importer().then(m => ({ default: m[name] })));
}

// ── Lazy Page Imports ─────────────────────────────────────────────────────────
const LoginPage         = lazyLoad(() => import('@/pages/LoginPage'), 'LoginPage');
const UnauthorizedPage  = lazyLoad(() => import('@/pages/UnauthorizedPage'), 'UnauthorizedPage');
const Dashboard         = lazyLoad(() => import('@/pages/Dashboard'), 'Dashboard');
const QuickActionPage   = lazyLoad(() => import('@/pages/QuickActionPage'), 'QuickActionPage');
const CompanySetup      = lazyLoad(() => import('@/pages/company/CompanySetup'), 'CompanySetup');
const NotFound          = lazyLoad(() => import('@/pages/NotFound'), 'NotFound');

// Employees
const EmployeeList      = lazyLoad(() => import('@/pages/employees/EmployeeList'), 'EmployeeList');
const EmployeeProfile   = lazyLoad(() => import('@/pages/employees/EmployeeProfile'), 'EmployeeProfile');
const EmployeeForm      = lazyLoad(() => import('@/pages/employees/EmployeeForm'), 'EmployeeForm');

// Attendance
const AttendanceDashboard = lazyLoad(() => import('./pages/attendance/AttendanceDashboard'), 'AttendanceDashboard');
const HolidayManager      = lazyLoad(() => import('./pages/attendance/HolidayManager'), 'HolidayManager');
const FaceKioskPage       = lazyLoad(() => import('./pages/attendance/FaceKioskPage'), 'FaceKioskPage');

// Production
const ProductionDashboard = lazyLoad(() => import('./pages/production/ProductionDashboard'), 'ProductionDashboard');
const RateManager         = lazyLoad(() => import('./pages/production/RateManager'), 'RateManager');
const WorkGroupManager    = lazyLoad(() => import('./pages/production/WorkGroupManager'), 'WorkGroupManager');
const BulkEntryForm       = lazyLoad(() => import('./pages/production/BulkEntryForm'), 'BulkEntryForm');

// Leaves / Loans / Approvals / Expenses
const LeaveDashboard    = lazyLoad(() => import('@/pages/leaves/LeaveDashboard'), 'LeaveDashboard');
const LoanDashboard     = lazyLoad(() => import('@/pages/loans/LoanDashboard'), 'LoanDashboard');
const ApprovalCenter    = lazyLoad(() => import('@/pages/approvals/ApprovalCenter'), 'ApprovalCenter');
const ExpensesDashboard = lazyLoad(() => import('@/pages/expenses/ExpensesDashboard'), 'ExpensesDashboard');

// Payroll
const PayrollDashboard  = lazyLoad(() => import('@/pages/payroll/PayrollDashboard'), 'PayrollDashboard');
const PayrollHistory    = lazyLoad(() => import('@/pages/payroll/PayrollHistory'), 'PayrollHistory');
const PayrollSimulation = lazyLoad(() => import('@/pages/payroll/PayrollSimulation'), 'PayrollSimulation');
const PayslipView       = lazyLoad(() => import('@/pages/payroll/PayslipView'), 'PayslipView');

// Calculators
const CTCCalculator   = lazyLoad(() => import('@/pages/calculators/CTCCalculator'), 'CTCCalculator');
const TDSCalculator   = lazyLoad(() => import('@/pages/calculators/TDSCalculator'), 'TDSCalculator');
const PFESICalculator = lazyLoad(() => import('@/pages/calculators/PFESICalculator'), 'PFESICalculator');

// Admin Tools
const BulkImport             = lazyLoad(() => import('@/pages/admin/BulkImport'), 'BulkImport');
const AuditLogs              = lazyLoad(() => import('@/pages/admin/AuditLogs'), 'AuditLogs');
const TrashManagement        = lazyLoad(() => import('@/pages/admin/TrashManagement'), 'TrashManagement');
const DraftManager           = lazyLoad(() => import('@/pages/admin/DraftManager'), 'DraftManager');
const DataConsistencyChecker = lazyLoad(() => import('@/pages/admin/DataConsistencyChecker'), 'DataConsistencyChecker');
const DataSeeding            = lazyLoad(() => import('@/pages/admin/DataSeeding'), 'DataSeeding');
const DatabaseBackup         = lazyLoad(() => import('@/pages/admin/DatabaseBackup'), 'DatabaseBackup');

// Settings
const GeneralSettings       = lazyLoad(() => import('@/pages/settings/GeneralSettings'), 'GeneralSettings');
const SecuritySettings      = lazyLoad(() => import('@/pages/settings/SecuritySettings'), 'SecuritySettings');
const ThemeCustomizer       = lazyLoad(() => import('@/pages/settings/ThemeCustomizer'), 'ThemeCustomizer');
const ConfigurationPage     = lazyLoad(() => import('@/pages/settings/ConfigurationPage'), 'ConfigurationPage');
const ServerStatusDashboard = lazyLoad(() => import('@/pages/settings/ServerStatusDashboard'), 'ServerStatusDashboard');
const NotificationSettings  = lazyLoad(() => import('@/pages/settings/NotificationSettings'), 'NotificationSettings');
const LanguageSettings      = lazyLoad(() => import('@/pages/settings/LanguageSettings'), 'LanguageSettings');
const UserProfile           = lazyLoad(() => import('@/pages/settings/UserProfile'), 'UserProfile');

// Statutory
const Form16Generator  = lazyLoad(() => import('@/pages/statutory/Form16Generator'), 'Form16Generator');
const StatutoryReports = lazyLoad(() => import('@/pages/statutory/StatutoryReports'), 'StatutoryReports');

// Security / Company / Sales / Mobile / Support
const SecurityAlerts         = lazyLoad(() => import('@/pages/security/SecurityAlerts'), 'SecurityAlerts');
const CompanySwitcher        = lazyLoad(() => import('@/pages/company/CompanySwitcher'), 'CompanySwitcher');
const SalesmanDashboard      = lazyLoad(() => import('@/pages/sales/SalesmanDashboard'), 'SalesmanDashboard');
const ClientListPage         = lazyLoad(() => import('@/pages/sales/ClientListPage'), 'ClientListPage');
const QuickCheckIn           = lazyLoad(() => import('@/pages/mobile/QuickCheckIn'), 'QuickCheckIn');
const MobileDashboard        = lazyLoad(() => import('@/pages/mobile/MobileDashboard'), 'MobileDashboard');
const HelpCenter             = lazyLoad(() => import('@/pages/support/HelpCenter'), 'HelpCenter');

// Reports / Finance
const ReportBuilder            = lazyLoad(() => import('@/pages/reports/ReportBuilder'), 'ReportBuilder');
const ScheduledReports         = lazyLoad(() => import('@/pages/reports/ScheduledReports'), 'ScheduledReports');
const CustomReportBuilder      = lazyLoad(() => import('@/pages/reports/CustomReportBuilder'), 'CustomReportBuilder');
const FinanceDashboard         = lazyLoad(() => import('@/pages/finance/FinanceDashboard'), 'FinanceDashboard');
const DepartmentFinanceReport  = lazyLoad(() => import('@/pages/finance/DepartmentFinanceReport'), 'DepartmentFinanceReport');
const CostCenterMapping        = lazyLoad(() => import('@/pages/finance/CostCenterMapping'), 'CostCenterMapping');
const AdvanceSalaryManagement  = lazyLoad(() => import('@/pages/finance/AdvanceSalaryManagement'), 'AdvanceSalaryManagement');

// ── Helper component for Company Check ───────────────────────────────────────
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

// ── Auth Guard: agar token hai toh login page nahi dikhega, seedha dashboard ──
const AuthGuard = ({ children }: { children: JSX.Element }) => {
    const { isAuthenticated } = useAuthStore();
    if (isAuthenticated) return <Navigate to="/dashboard" replace />;
    return children;
};

function App() {
    const { fetchCompanies } = useMultiCompanyStore();
    const { fetchEmployees } = useEmployeeStore();
    const { fetchAttendance } = useAttendanceStore();
    const { fetchPayroll } = usePayrollStore();
    const { fetchLeaves } = useLeaveStore();
    const { fetchExpenses } = useExpenseStore();
    const fetchDepartments = useInternalDepartmentStore(s => s.fetchDepartments);
    const fetchShifts = useInternalShiftStore(s => s.fetchShifts);
    const fetchGroups = useInternalWorkGroupStore(s => s.fetchGroups);
    const fetchRolePermissions = useRolePermissionsStore(s => s.fetchPermissions);

    // Smart Auto-Sync: every 30s, only when tab is visible
    useDataSync(30000);

    const { isAuthenticated } = useAuthStore();

    // ── Global GPS: App Load request, Always active ──
    useGlobalGPS();

    // ── Background Services: Wake Lock + Custom SW + GPS Bridge ──
    useBackgroundServices();

    const { currentCompanyId } = useMultiCompanyStore();

    useEffect(() => {
        // Fetch data on login OR when the active company changes
        if (!isAuthenticated) return;
        fetchCompanies();
        fetchEmployees();
        fetchAttendance();
        fetchPayroll();
        fetchLeaves();
        fetchExpenses();
        if (currentCompanyId) {
            fetchDepartments(currentCompanyId);
            fetchShifts(currentCompanyId);
            fetchGroups(currentCompanyId);
            fetchRolePermissions(currentCompanyId); // Load saved permissions from DB
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
        // Zustand store functions are stable references — safe to omit from deps
    }, [isAuthenticated, currentCompanyId]); // eslint-disable-line

    return (
        <ErrorBoundary>
            <DialogProvider>
                <BrowserRouter>
                    <PermissionRefreshSync />
                    <ForceIpRedirect />
                    <LoanApprovalModal />
                    <CommandPalette />
                    <CameraPunchWidget />
                    <InstallPWA />
                    <SecurityAlertToast />

                    <Suspense fallback={<PageSkeleton />}>
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
                                    <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_EMPLOYEES} />}>
                                        <Route path="/employees" element={<EmployeeList />} />
                                        <Route path="/employees/new" element={<EmployeeForm />} />
                                        <Route path="/employees/:id" element={<EmployeeProfile />} />
                                        <Route path="/employees/:id/edit" element={<EmployeeForm />} />
                                    </Route>

                                    {/* Attendance Module */}
                                    <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_ATTENDANCE} />}>
                                        <Route path="/attendance" element={<PageErrorBoundary pageName="Attendance"><AttendanceDashboard /></PageErrorBoundary>} />
                                        <Route path="/attendance/holidays" element={<PageErrorBoundary pageName="Holiday Manager"><HolidayManager /></PageErrorBoundary>} />
                                        <Route path="/attendance/kiosk" element={<PageErrorBoundary pageName="Face Kiosk"><FaceKioskPage /></PageErrorBoundary>} />
                                    </Route>

                                    {/* Salesman Dashboard (Optional depending on usage context, but View Salesman applies) */}
                                    <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_SALESMAN} />}>
                                        <Route path="/salesman" element={<PageErrorBoundary pageName="Salesman Dashboard"><SalesmanDashboard /></PageErrorBoundary>} />
                                        <Route path="/salesman/clients" element={<PageErrorBoundary pageName="Client / Party List"><ClientListPage /></PageErrorBoundary>} />
                                    </Route>

                                    {/* Production Module */}
                                    <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_PRODUCTION} />}>
                                        <Route path="/production" element={<PageErrorBoundary pageName="Production Dashboard"><ProductionDashboard /></PageErrorBoundary>} />
                                        <Route path="/production/rates" element={<PageErrorBoundary pageName="Rate Manager"><RateManager /></PageErrorBoundary>} />
                                        <Route path="/production/workgroups" element={<PageErrorBoundary pageName="Work Groups"><WorkGroupManager /></PageErrorBoundary>} />
                                        <Route path="/production/bulk" element={<PageErrorBoundary pageName="Bulk Production Entry"><BulkEntryForm /></PageErrorBoundary>} />
                                    </Route>

                                    {/* Leaves & Loans Module */}
                                    <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_LEAVES} />}>
                                        <Route path="/leaves" element={<PageErrorBoundary pageName="Leave Dashboard"><LeaveDashboard /></PageErrorBoundary>} />
                                    </Route>
                                    <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_OWN_LOANS} />}>
                                        <Route path="/loans" element={<PageErrorBoundary pageName="Loan Manager"><LoanDashboard /></PageErrorBoundary>} />
                                    </Route>

                                    {/* Approvals Module */}
                                    <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_APPROVALS} />}>
                                        <Route path="/approvals" element={<PageErrorBoundary pageName="Approval Center"><ApprovalCenter /></PageErrorBoundary>} />
                                    </Route>

                                    {/* Payroll Module */}
                                    <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_PAYROLL} />}>
                                        <Route path="/payroll" element={<PageErrorBoundary pageName="Payroll Dashboard"><PayrollDashboard /></PageErrorBoundary>} />
                                        <Route path="/payroll/history" element={<PageErrorBoundary pageName="Payroll History"><PayrollHistory /></PageErrorBoundary>} />
                                        <Route path="/payroll/simulation" element={<PageErrorBoundary pageName="Payroll Simulation"><PayrollSimulation /></PageErrorBoundary>} />
                                        <Route path="/payroll/slip/:id" element={<PageErrorBoundary pageName="Payslip"><PayslipView /></PageErrorBoundary>} />
                                    </Route>

                                    {/* Expenses module */}
                                    <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_OWN_EXPENSES} />}>
                                        <Route path="/expenses" element={<PageErrorBoundary pageName="Expenses"><ExpensesDashboard /></PageErrorBoundary>} />
                                    </Route>

                                    {/* Calculator Pages */}
                                    <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.USE_CALCULATORS} />}>
                                        <Route path="/calculators/ctc" element={<CTCCalculator />} />
                                        <Route path="/calculators/tds" element={<TDSCalculator />} />
                                        <Route path="/calculators/pfesi" element={<PFESICalculator />} />
                                    </Route>

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
                    </Suspense>
                </BrowserRouter>
            </DialogProvider>
        </ErrorBoundary>
    );
}

export default App;
