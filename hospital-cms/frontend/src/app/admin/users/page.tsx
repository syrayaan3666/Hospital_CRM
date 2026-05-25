'use client';

import { useEffect, useMemo, useState } from 'react';
import AuthGuard from '../../../components/AuthGuard';
import DashboardLayout from '../../../components/DashboardLayout';
import apiClient from '../../../lib/axios';
import type { ApiResponse } from '../../../types';
import { AdminUserRow, formatDate, formatPersonName } from '../shared';

const roleTone: Record<string, string> = {
  ADMIN: 'bg-slate-100 text-slate-700',
  DOCTOR: 'bg-emerald-50 text-emerald-700',
  RECEPTIONIST: 'bg-blue-50 text-blue-700',
  LAB_STAFF: 'bg-amber-50 text-amber-700',
  PATIENT: 'bg-violet-50 text-violet-700',
};

export default function AdminUsersPage() {
  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <DashboardLayout>
        <AdminUsersContent />
      </DashboardLayout>
    </AuthGuard>
  );
}

function AdminUsersContent() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadUsers = async () => {
      try {
        const response = await apiClient.get<ApiResponse<AdminUserRow[]>>('/admin/users');
        if (mounted) {
          setUsers(response.data.data);
          setError(null);
        }
      } catch {
        if (mounted) {
          setError('Unable to load users');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadUsers();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((user) => {
      const name = formatPersonName(user.firstName, user.lastName).toLowerCase();
      return [name, user.email.toLowerCase(), user.role.toLowerCase(), user.phone ?? '']
        .join(' ')
        .includes(query);
    });
  }, [search, users]);

  const toggleUserStatus = async (user: AdminUserRow) => {
    const nextStatus = !user.isActive;
    setSavingId(user.id);

    try {
      const response = await apiClient.patch<ApiResponse<AdminUserRow>>(`/admin/users/${user.id}/status`, {
        isActive: nextStatus,
      });

      setUsers((current) => current.map((entry) => (entry.id === user.id ? response.data.data : entry)));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
            <p className="mt-1 text-sm text-gray-500">Review login accounts and suspend or restore access.</p>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, or role"
            className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none transition focus:border-blue-500 md:max-w-sm"
          />
        </div>
      </section>

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={6}>
                    Loading users...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td className="px-4 py-4 text-red-600" colSpan={6}>
                    {error}
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={6}>
                    No users matched your search.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900">{formatPersonName(user.firstName, user.lastName)}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${roleTone[user.role] ?? 'bg-gray-100 text-gray-700'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-700">{user.phone ?? '--'}</td>
                    <td className="px-4 py-4 text-gray-700">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => toggleUserStatus(user)}
                        disabled={savingId === user.id}
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition ${user.isActive ? 'border border-red-200 text-red-700 hover:bg-red-50' : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'} disabled:cursor-wait disabled:opacity-60`}
                      >
                        {savingId === user.id ? 'Saving...' : user.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}