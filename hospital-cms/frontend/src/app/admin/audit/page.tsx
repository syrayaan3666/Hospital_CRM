'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import AuthGuard from '../../../components/AuthGuard';
import DashboardLayout from '../../../components/DashboardLayout';
import apiClient from '../../../lib/axios';
import type { ApiResponse } from '../../../types';
import { AdminAuditLogRow, formatDateTime, formatPersonName } from '../shared';

interface AuditPageResponse extends ApiResponse<AdminAuditLogRow[]> {
	pagination: {
		total: number;
		page: number;
		limit: number;
		totalPages: number;
	};
}

const defaultFilters = {
  search: '',
  action: '',
  entityName: '',
  from: '',
  to: '',
};

export default function AdminAuditPage() {
  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <DashboardLayout>
        <AdminAuditContent />
      </DashboardLayout>
    </AuthGuard>
  );
}

function AdminAuditContent() {
  const [logs, setLogs] = useState<AdminAuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(defaultFilters);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = async (submittedFilters = filters) => {
    setLoading(true);

    try {
      const response = await apiClient.get<AuditPageResponse>('/admin/audit-logs', {
        params: {
          limit: 100,
          action: submittedFilters.action || undefined,
          entityName: submittedFilters.entityName || undefined,
          from: submittedFilters.from || undefined,
          to: submittedFilters.to || undefined,
        },
      });

      setLogs(response.data.data);
      setError(null);
    } catch {
      setError('Unable to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    const query = filters.search.trim().toLowerCase();

    if (!query) {
      return logs;
    }

    return logs.filter((log) => {
      const haystack = [
        log.action,
        log.entityName,
        log.entityId,
        log.ipAddress ?? '',
        log.user ? formatPersonName(log.user.firstName, log.user.lastName) : '',
        log.user?.email ?? '',
        JSON.stringify(log.details ?? ''),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [filters.search, logs]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loadLogs(filters);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-xl font-semibold text-gray-900">Audit Trail</h2>
        <p className="mt-1 text-sm text-gray-500">Search staff activity by user, action, entity, or date range.</p>
      </section>

      <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 md:grid-cols-2 xl:grid-cols-5">
        <Field label="Search" value={filters.search} onChange={(value) => setFilters((current) => ({ ...current, search: value }))} placeholder="Email, action, entity, or IP" />
        <Field label="Action" value={filters.action} onChange={(value) => setFilters((current) => ({ ...current, action: value }))} placeholder="CREATE, UPDATE, etc." />
        <Field label="Entity" value={filters.entityName} onChange={(value) => setFilters((current) => ({ ...current, entityName: value }))} placeholder="User, Department, Doctor" />
        <Field label="From" type="date" value={filters.from} onChange={(value) => setFilters((current) => ({ ...current, from: value }))} />
        <Field label="To" type="date" value={filters.to} onChange={(value) => setFilters((current) => ({ ...current, to: value }))} />
        <div className="flex items-end gap-3 xl:col-span-5">
          <button type="submit" className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
            Apply Filters
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters(defaultFilters);
              void loadLogs(defaultFilters);
            }}
            className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
      </form>

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={5}>
                    Loading audit logs...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td className="px-4 py-4 text-red-600" colSpan={5}>
                    {error}
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={5}>
                    No audit entries matched your filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-4 text-gray-700">{formatDateTime(log.createdAt)}</td>
                    <td className="px-4 py-4 text-gray-700">
                      <div className="font-medium text-gray-900">
                        {log.user ? formatPersonName(log.user.firstName, log.user.lastName) : 'System'}
                      </div>
                      <div className="text-xs text-gray-500">{log.user?.email ?? '--'}</div>
                    </td>
                    <td className="px-4 py-4 text-gray-700">{log.action}</td>
                    <td className="px-4 py-4 text-gray-700">
                      <div className="font-medium text-gray-900">{log.entityName}</div>
                      <div className="text-xs text-gray-500">{log.entityId}</div>
                    </td>
                    <td className="px-4 py-4 text-gray-700">
                      <pre className="max-w-lg whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
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

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none transition focus:border-blue-500"
      />
    </label>
  );
}