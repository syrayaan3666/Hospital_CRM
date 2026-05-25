'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AuthGuard from '../../../components/AuthGuard';
import DashboardLayout from '../../../components/DashboardLayout';
import apiClient from '../../../lib/axios';
import type { ApiResponse } from '../../../types';
import { AdminDepartmentRow, AdminDoctorRow, formatDate } from '../shared';

export default function AdminDepartmentsPage() {
  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <DashboardLayout>
        <AdminDepartmentsContent />
      </DashboardLayout>
    </AuthGuard>
  );
}

function AdminDepartmentsContent() {
  const [departments, setDepartments] = useState<AdminDepartmentRow[]>([]);
  const [doctors, setDoctors] = useState<AdminDoctorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const [departmentsResponse, doctorsResponse] = await Promise.all([
          apiClient.get<ApiResponse<AdminDepartmentRow[]>>('/departments'),
          apiClient.get<ApiResponse<AdminDoctorRow[]>>('/doctors'),
        ]);

        if (mounted) {
          setDepartments(departmentsResponse.data.data);
          setDoctors(doctorsResponse.data.data);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const departmentCounts = useMemo(() => {
    return doctors.reduce<Record<string, number>>((accumulator, doctor) => {
      accumulator[doctor.department.id] = (accumulator[doctor.department.id] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [doctors]);

  const filteredDepartments = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return departments;
    }

    return departments.filter((department) => {
      const haystack = [department.name, department.code, department.description ?? ''].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [departments, search]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Department Registry</h2>
            <p className="mt-1 text-sm text-gray-500">Keep clinical departments organized and discoverable.</p>
          </div>
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search departments"
              className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none transition focus:border-blue-500 md:w-80"
            />
            <Link href="/admin/departments/new" className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
              Add Department
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Doctors</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={6}>
                    Loading departments...
                  </td>
                </tr>
              ) : filteredDepartments.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={6}>
                    No departments matched your search.
                  </td>
                </tr>
              ) : (
                filteredDepartments.map((department) => (
                  <tr key={department.id}>
                    <td className="px-4 py-4 font-medium text-gray-900">{department.name}</td>
                    <td className="px-4 py-4 text-gray-700">{department.code}</td>
                    <td className="px-4 py-4 text-gray-700">{departmentCounts[department.id] ?? 0}</td>
                    <td className="px-4 py-4 text-gray-700">{department.description ?? '--'}</td>
                    <td className="px-4 py-4 text-gray-700">{formatDate(department.createdAt)}</td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/departments/new?departmentId=${department.id}`}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                      >
                        Edit
                      </Link>
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