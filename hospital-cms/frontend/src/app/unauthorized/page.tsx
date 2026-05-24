'use client';

import { useRouter } from 'next/navigation';
import useAuthStore from '../../store/auth.store';
import type { Role } from '../../types';

const dashboardByRole: Record<Role, string> = {
  PATIENT: '/patient/dashboard',
  DOCTOR: '/doctor/dashboard',
  RECEPTIONIST: '/reception/dashboard',
  LAB_STAFF: '/lab/dashboard',
  ADMIN: '/admin/dashboard',
};

export default function UnauthorizedPage() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  const handleGoToDashboard = () => {
    if (!user) {
      router.push('/login');
      return;
    }

    router.push(dashboardByRole[user.role]);
  };

  const handleSignOut = () => {
    clearAuth();
    router.push('/login');
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg shadow-gray-200/70 ring-1 ring-gray-100">
        <div className="text-6xl font-bold text-gray-300">403</div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-900">Access Denied</h1>
        <p className="mt-3 text-sm text-gray-500">You don't have permission to view this page</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleGoToDashboard}
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Sign Out
          </button>
        </div>
      </section>
    </main>
  );
}
