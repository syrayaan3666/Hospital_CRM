'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '../../../../components/AuthGuard';
import DashboardLayout from '../../../../components/DashboardLayout';
import apiClient from '../../../../lib/axios';
import type { ApiResponse } from '../../../../types';
import { AdminDepartmentRow } from '../../shared';

const defaultForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  departmentId: '',
  specialization: '',
  licenseNumber: '',
  consultationFee: '',
  startTime: '09:00',
  endTime: '17:00',
  slotDurationMinutes: '30',
  availableDays: 'Mon,Tue,Wed,Thu,Fri',
  yearsOfExperience: '',
  bio: '',
};

export default function AdminDoctorCreatePage() {
  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <DashboardLayout>
        <AdminDoctorCreateContent />
      </DashboardLayout>
    </AuthGuard>
  );
}

function AdminDoctorCreateContent() {
  const router = useRouter();
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
          if (response.data.data.length > 0) {
            setForm((current) => ({ ...current, departmentId: current.departmentId || response.data.data[0].id }));
          }
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

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const availableDaysPreview = useMemo(
    () => form.availableDays.split(',').map((day) => day.trim()).filter(Boolean),
    [form.availableDays],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await apiClient.post('/admin/doctors', {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        phone: form.phone || null,
        departmentId: form.departmentId,
        specialization: form.specialization,
        licenseNumber: form.licenseNumber,
        consultationFee: Number(form.consultationFee),
        startTime: form.startTime,
        endTime: form.endTime,
        slotDurationMinutes: Number(form.slotDurationMinutes),
        availableDays: availableDaysPreview,
        yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : null,
        bio: form.bio || null,
      });

      router.push('/admin/doctors');
    } catch {
      setError('Unable to create doctor profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-xl font-semibold text-gray-900">Add Doctor</h2>
        <p className="mt-1 text-sm text-gray-500">Create the login account and clinical profile in one step.</p>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="First name" value={form.firstName} onChange={(value) => updateField('firstName', value)} required />
          <Field label="Last name" value={form.lastName} onChange={(value) => updateField('lastName', value)} required />
          <Field label="Email" type="email" value={form.email} onChange={(value) => updateField('email', value)} required />
          <Field label="Temporary password" type="password" value={form.password} onChange={(value) => updateField('password', value)} required />
          <Field label="Phone" value={form.phone} onChange={(value) => updateField('phone', value)} />
          <label className="block text-sm font-medium text-gray-700">
            Department
            <select
              value={form.departmentId}
              onChange={(event) => updateField('departmentId', event.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none transition focus:border-blue-500"
              required
              disabled={loading}
            >
              <option value="">Select department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <Field label="Specialization" value={form.specialization} onChange={(value) => updateField('specialization', value)} required />
          <Field label="License number" value={form.licenseNumber} onChange={(value) => updateField('licenseNumber', value)} required />
          <Field label="Consultation fee" type="number" value={form.consultationFee} onChange={(value) => updateField('consultationFee', value)} required />
          <Field label="Start time" type="time" value={form.startTime} onChange={(value) => updateField('startTime', value)} required />
          <Field label="End time" type="time" value={form.endTime} onChange={(value) => updateField('endTime', value)} required />
          <Field label="Slot duration (minutes)" type="number" value={form.slotDurationMinutes} onChange={(value) => updateField('slotDurationMinutes', value)} required />
          <Field label="Years of experience" type="number" value={form.yearsOfExperience} onChange={(value) => updateField('yearsOfExperience', value)} />
        </div>

        <label className="block text-sm font-medium text-gray-700">
          Available days
          <input
            value={form.availableDays}
            onChange={(event) => updateField('availableDays', event.target.value)}
            placeholder="Mon,Tue,Wed,Thu,Fri"
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none transition focus:border-blue-500"
          />
        </label>

        <label className="block text-sm font-medium text-gray-700">
          Qualification / bio
          <textarea
            value={form.bio}
            onChange={(event) => updateField('bio', event.target.value)}
            rows={4}
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none transition focus:border-blue-500"
            placeholder="Use this to capture qualifications, certifications, and profile notes"
          />
        </label>

        {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Create Doctor'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/doctors')}
            className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none transition focus:border-blue-500"
      />
    </label>
  );
}