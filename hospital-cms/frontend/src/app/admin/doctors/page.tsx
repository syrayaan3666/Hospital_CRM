'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AuthGuard from '../../../components/AuthGuard';
import DashboardLayout from '../../../components/DashboardLayout';
import apiClient from '../../../lib/axios';
import type { ApiResponse } from '../../../types';
import { AdminDoctorRow, formatMoney, formatPersonName, joinDays } from '../shared';

export default function AdminDoctorsPage() {
  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <DashboardLayout>
        <AdminDoctorsContent />
      </DashboardLayout>
    </AuthGuard>
  );
}

function AdminDoctorsContent() {
  const [doctors, setDoctors] = useState<AdminDoctorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadDoctors = async () => {
      try {
        const response = await apiClient.get<ApiResponse<AdminDoctorRow[]>>('/doctors');
        if (mounted) {
          setDoctors(response.data.data);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadDoctors();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredDoctors = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return doctors;
    }

    return doctors.filter((doctor) => {
      const haystack = [
        formatPersonName(doctor.firstName, doctor.lastName),
        doctor.email ?? '',
        doctor.department.name,
        doctor.specialization,
        doctor.licenseNumber,
        joinDays(doctor.availableDays),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [doctors, search]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Doctor Directory</h2>
            <p className="mt-1 text-sm text-gray-500">Manage doctor access, schedules, and profile details.</p>
          </div>
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search doctors"
              className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none transition focus:border-blue-500 md:w-80"
            />
            <Link href="/admin/doctors/new" className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
              Add Doctor
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Doctor</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Fee</th>
                <th className="px-4 py-3 font-medium">Schedule</th>
                <th className="px-4 py-3 font-medium">License</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={5}>
                    Loading doctors...
                  </td>
                </tr>
              ) : filteredDoctors.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={5}>
                    No doctors matched your search.
                  </td>
                </tr>
              ) : (
                filteredDoctors.map((doctor) => (
                  <tr key={doctor.id}>
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900">{formatPersonName(doctor.firstName, doctor.lastName)}</div>
                      <div className="text-xs text-gray-500">{doctor.specialization}</div>
                    </td>
                    <td className="px-4 py-4 text-gray-700">{doctor.department.name}</td>
                    <td className="px-4 py-4 text-gray-700">{formatMoney(doctor.consultationFee)}</td>
                    <td className="px-4 py-4 text-gray-700">
                      <div>{doctor.startTime} - {doctor.endTime}</div>
                      <div className="text-xs text-gray-500">{joinDays(doctor.availableDays)} · {doctor.slotDurationMinutes} min slots</div>
                    </td>
                    <td className="px-4 py-4 text-gray-700">{doctor.licenseNumber}</td>
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