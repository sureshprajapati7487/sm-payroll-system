import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { AdminDashboard } from './dashboard/AdminDashboard';
import { ManagerDashboard } from './dashboard/ManagerDashboard';
import { EmployeeDashboard } from './dashboard/EmployeeDashboard';

export const Dashboard = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();

    // Auto-redirect small screens to Mobile Dashboard
    useEffect(() => {
        const check = () => {
            const preferFull = sessionStorage.getItem('prefer-full-dashboard');
            if (window.innerWidth < 640 && !preferFull) {
                navigate('/mobile/dashboard', { replace: true });
            }
        };
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, [navigate]);

    const role = user?.role;
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return <AdminDashboard />;
    if (role === 'MANAGER') return <ManagerDashboard />;
    return <EmployeeDashboard />;
};
