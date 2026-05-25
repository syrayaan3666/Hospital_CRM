'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '../../../components/AuthGuard';
import DashboardLayout from '../../../components/DashboardLayout';
import apiClient from '../../../lib/axios';
import type { Patient, ApiResponse } from '../../../types';

export default function PatientsPage() {
  const router = useRouter();
  const [q, setQ] = useState<string>('');
  const [results, setResults] = useState<Patient[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const res = await apiClient.get<ApiResponse<Patient[]>>(`/patients/search?q=${encodeURIComponent(q)}`);
      setResults(res.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard allowedRoles={["DOCTOR"]}>
      <DashboardLayout>
        <div>
          <form onSubmit={handleSearch} className="mb-4 flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or phone" className="w-full rounded border p-2" />
            <button type="submit" className="rounded bg-blue-600 px-3 py-2 text-white">Search</button>
          </form>

          {loading ? <div>Searching...</div> : null}

          <div className="space-y-2">
            {results.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded border p-3">
                <div>
                  <div className="font-medium">{p.firstName} {p.lastName}</div>
                  <div className="text-sm text-gray-600">{p.phone} • Age: {Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365))}</div>
                </div>
                <div>
                  <button onClick={() => router.push(`/doctor/patients/${p.id}`)} className="rounded bg-gray-800 px-3 py-1 text-white">View History</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}
