'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthGuard from '../../../../components/AuthGuard';
import DashboardLayout from '../../../../components/DashboardLayout';
import apiClient from '../../../../lib/axios';
import type { ApiResponse } from '../../../../types';
import { AdminDepartmentRow } from '../../shared';

const defaultForm = {
  name: '',
  code: '',
  description: '',
  isActive: true,
};

export default function AdminDepartmentCreatePage() {
  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <DashboardLayout>
        <AdminDepartmentCreateContent />
      </DashboardLayout>
    </AuthGuard>
  );
}

function AdminDepartmentCreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const departmentId = searchParams.get('departmentId');
  const [departments, setDepartments] = useState<AdminDepartmentRow[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadDepartments = async () => {
      try {
        const response = await apiClient.get<ApiResponse<AdminDepartmentRow[]>>('/departments');
        if (mounted) {
          setDepartments(response.data.data);
        }
      } catch {
        if (mounted) {
          setError('Unable to load departments');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadDepartments();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!departmentId || departments.length === 0) {
      return;
    }

    const existing = departments.find((department) => department.id === departmentId);

    if (existing) {
      setForm({
        name: existing.name,
        code: existing.code,
        description: existing.description ?? '',
        isActive: existing.isActive,
      });
    }
  }, [departmentId, departments]);

  const mode = useMemo(() => (departmentId ? 'update' : 'create'), [departmentId]);

  const updateField = (field: keyof typeof form, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (mode === 'create') {
        await apiClient.post('/admin/departments', {
          name: form.name,
          code: form.code,
          description: form.description || null,
        });
      } else {
        await apiClient.patch(`/admin/departments/${departmentId}`, {
          name: form.name,
          code: form.code,
          description: form.description || null,
          isActive: form.isActive,
        });
      }

      router.push('/admin/departments');
    } catch {
      setError('Unable to save department');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-xl font-semibold text-gray-900">{mode === 'create' ? 'Add Department' : 'Edit Department'}</h2>
        <p className="mt-1 text-sm text-gray-500">Create the department record that doctors and appointment flows will reference.</p>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Department name" value={form.name} onChange={(value) => updateField('name', value)} required />
          <Field label="Department code" value={form.code} onChange={(value) => updateField('code', value.toUpperCase())} required />
        </div>

        <label className="block text-sm font-medium text-gray-700">
          Description
          <textarea
            value={form.description}
            onChange={(event) => updateField('description', event.target.value)}
            rows={4}
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none transition focus:border-blue-500"
            placeholder="Optional summary for staff reference"
          />
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => updateField('isActive', event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          <span className="text-sm text-gray-700">Department active state</span>
        </label>

        <p className="text-xs text-gray-500">Inactive departments are hidden from booking flows until they are reactivated.</p>

        {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading || saving}
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Department'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/departments')}
            className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, required = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none transition focus:border-blue-500"
      />
    </label>
  );
}