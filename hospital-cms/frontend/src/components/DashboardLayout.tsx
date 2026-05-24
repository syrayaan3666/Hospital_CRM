'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Building2, CalendarDays, FileText, LayoutDashboard, LogOut, LucideIcon, Stethoscope, Users, ShieldCheck, FlaskConical, UserPlus, BadgeDollarSign, ClipboardList } from 'lucide-react';
import apiClient from '../lib/axios';
import useAuthStore from '../store/auth.store';
import type { Role } from '../types';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const roleNavigation: Record<Role, NavItem[]> = {
  PATIENT: [
    { label: 'Dashboard', href: '/patient/dashboard', icon: LayoutDashboard },
    { label: 'Appointments', href: '/patient/appointments', icon: CalendarDays },
    { label: 'Medical Records', href: '/patient/records', icon: FileText },
    { label: 'Lab Reports', href: '/patient/reports', icon: FlaskConical },
    { label: 'Bills', href: '/patient/bills', icon: BadgeDollarSign },
  ],
  DOCTOR: [
    { label: 'Dashboard', href: '/doctor/dashboard', icon: LayoutDashboard },
    { label: 'My Appointments', href: '/doctor/appointments', icon: CalendarDays },
    { label: 'Patient History', href: '/doctor/patients', icon: Users },
  ],
  RECEPTIONIST: [
    { label: 'Dashboard', href: '/reception/dashboard', icon: LayoutDashboard },
    { label: 'Appointments', href: '/reception/appointments', icon: CalendarDays },
    { label: 'Register Patient', href: '/reception/register', icon: UserPlus },
    { label: 'Billing', href: '/reception/billing', icon: BadgeDollarSign },
  ],
  LAB_STAFF: [
    { label: 'Dashboard', href: '/lab/dashboard', icon: LayoutDashboard },
    { label: 'Test Orders', href: '/lab/orders', icon: ClipboardList },
  ],
  ADMIN: [
    { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Users', href: '/admin/users', icon: Users },
    { label: 'Doctors', href: '/admin/doctors', icon: Stethoscope },
    { label: 'Departments', href: '/admin/departments', icon: Building2 },
    { label: 'Audit Logs', href: '/admin/audit', icon: ShieldCheck },
  ],
};

const roleLabels: Record<Role, string> = {
  PATIENT: 'Patient',
  DOCTOR: 'Doctor',
  RECEPTIONIST: 'Receptionist',
  LAB_STAFF: 'Lab Staff',
  ADMIN: 'Admin',
};

const routeTitles: Array<{ prefix: string; title: string }> = [
  { prefix: '/patient/dashboard', title: 'Patient Dashboard' },
  { prefix: '/patient/appointments/book', title: 'Book Appointment' },
  { prefix: '/patient/appointments', title: 'Appointments' },
  { prefix: '/patient/records', title: 'Medical Records' },
  { prefix: '/patient/reports', title: 'Lab Reports' },
  { prefix: '/patient/bills', title: 'Bills' },
  { prefix: '/doctor/dashboard', title: 'Doctor Dashboard' },
  { prefix: '/doctor/appointments', title: 'My Appointments' },
  { prefix: '/doctor/patients', title: 'Patient History' },
  { prefix: '/reception/dashboard', title: 'Reception Dashboard' },
  { prefix: '/reception/appointments', title: 'Appointments' },
  { prefix: '/reception/register', title: 'Register Patient' },
  { prefix: '/reception/billing', title: 'Billing' },
  { prefix: '/lab/dashboard', title: 'Lab Dashboard' },
  { prefix: '/lab/orders', title: 'Test Orders' },
  { prefix: '/admin/dashboard', title: 'Admin Dashboard' },
  { prefix: '/admin/users', title: 'Users' },
  { prefix: '/admin/doctors', title: 'Doctors' },
  { prefix: '/admin/departments', title: 'Departments' },
  { prefix: '/admin/audit', title: 'Audit Logs' },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, accessToken, clearAuth } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);

  const navigation = useMemo(() => {
    if (!user) {
      return [] as NavItem[];
    }

    return roleNavigation[user.role];
  }, [user]);

  const pageTitle = useMemo(() => {
    const match = routeTitles.find((entry) => pathname?.startsWith(entry.prefix));
    return match?.title ?? 'Dashboard';
  }, [pathname]);

  useEffect(() => {
    if (!user || !accessToken) {
      return;
    }

    let mounted = true;

    const loadUnreadCount = async () => {
      try {
        const response = await apiClient.get<{ success: boolean; data: number }>('/notifications/unread-count');
        if (mounted) {
          setUnreadCount(response.data.data);
        }
      } catch {
        if (mounted) {
          setUnreadCount(0);
        }
      }
    };

    loadUnreadCount();

    return () => {
      mounted = false;
    };
  }, [accessToken, user]);

  const handleSignOut = () => {
    clearAuth();
    router.push('/login');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-16 flex-col bg-blue-900 text-white shadow-xl shadow-blue-950/20 md:w-64">
        <div className="flex h-16 items-center justify-center border-b border-white/10 md:justify-start md:px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-blue-900 font-bold">
            H
          </div>
          <span className="ml-3 hidden text-sm font-semibold tracking-wide md:block">Hospital CMS</span>
        </div>

        <nav className="flex-1 space-y-1 px-2 py-4 md:px-3">
          {navigation.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center rounded-xl px-3 py-3 text-sm font-medium transition ${active ? 'bg-white text-blue-900' : 'text-white/85 hover:bg-white/10 hover:text-white'}`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="ml-3 hidden md:block">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="pl-16 md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white/95 px-4 backdrop-blur md:px-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{pageTitle}</h1>
            <p className="text-sm text-gray-500">{user.name}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="relative rounded-full border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-100"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                  {unreadCount}
                </span>
              ) : null}
            </button>

            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold text-gray-900">{user.name}</div>
              <div className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {roleLabels[user.role]}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:block">Sign out</span>
            </button>
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
