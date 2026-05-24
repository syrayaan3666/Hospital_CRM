'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '../../lib/axios';
import useAuthStore from '../../store/auth.store';
import type { Role, TokenPair } from '../../types';
import type { AxiosError } from 'axios';

interface LoginErrorResponse {
  success: false;
  error?: {
    message?: string;
  };
}

const dashboardByRole: Record<Role, string> = {
  PATIENT: '/patient/dashboard',
  DOCTOR: '/doctor/dashboard',
  RECEPTIONIST: '/reception/dashboard',
  LAB_STAFF: '/lab/dashboard',
  ADMIN: '/admin/dashboard',
};

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Email and password are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiClient.post<{ success: boolean; data: TokenPair }>('/auth/login', {
        email,
        password,
      });

      const { accessToken, user } = response.data.data;
      setAuth(user, accessToken);
      router.push(dashboardByRole[user.role]);
    } catch (error: unknown) {
      const axiosError = error as AxiosError<LoginErrorResponse>;
      const message = axiosError.response?.data.error?.message ?? 'Unable to sign in.';
      setErrorMessage(message);
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg shadow-blue-100/60 ring-1 ring-gray-100">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white shadow-md shadow-blue-200">
            H
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-gray-900">
            Hospital Management System
          </h1>
          <p className="mt-2 text-sm text-gray-500">Sign in to your account</p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 pr-20 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute inset-y-0 right-0 flex items-center px-4 text-sm font-medium text-blue-600 transition hover:text-blue-700"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {errorMessage ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </section>
    </main>
  );
}
