'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, CheckCircle2, Clock3, Loader2, MapPin, Stethoscope, Users } from 'lucide-react';
import AuthGuard from '../../../../components/AuthGuard';
import DashboardLayout from '../../../../components/DashboardLayout';
import apiClient from '../../../../lib/axios';
import {
  type ApiEnvelope,
  type DepartmentRecord,
  type DoctorRecord,
  type PatientRecord,
  formatDateInputValue,
  toCurrency,
  toShortDate,
} from '../../shared';

interface BookingState {
  patientId: string;
  departments: DepartmentRecord[];
  doctors: DoctorRecord[];
  availableSlots: string[];
  selectedDepartmentId: string;
  selectedDoctorId: string;
  selectedDate: string;
  selectedSlot: string;
  reason: string;
  loadingDepartments: boolean;
  loadingDoctors: boolean;
  loadingSlots: boolean;
  submitting: boolean;
  error: string | null;
}

function initialBookingState(): BookingState {
  return {
    patientId: '',
    departments: [],
    doctors: [],
    availableSlots: [],
    selectedDepartmentId: '',
    selectedDoctorId: '',
    selectedDate: '',
    selectedSlot: '',
    reason: '',
    loadingDepartments: true,
    loadingDoctors: false,
    loadingSlots: false,
    submitting: false,
    error: null,
  };
}

export default function BookAppointmentPage() {
  return (
    <AuthGuard allowedRoles={['PATIENT']}>
      <DashboardLayout>
        <BookAppointmentContent />
      </DashboardLayout>
    </AuthGuard>
  );
}

function BookAppointmentContent() {
  const router = useRouter();
  const [state, setState] = useState<BookingState>(initialBookingState());

  useEffect(() => {
    let active = true;

    const loadPatientAndDepartments = async (): Promise<void> => {
      setState((current) => ({ ...current, loadingDepartments: true, error: null }));

      try {
        const [patientResponse, departmentsResponse] = await Promise.all([
          apiClient.get<ApiEnvelope<PatientRecord>>('/patients/me'),
          apiClient.get<ApiEnvelope<DepartmentRecord[]>>('/departments'),
        ]);

        if (!active) {
          return;
        }

        setState((current) => ({
          ...current,
          patientId: patientResponse.data.data.id,
          departments: departmentsResponse.data.data,
          loadingDepartments: false,
        }));
      } catch (error) {
        if (!active) {
          return;
        }

        setState((current) => ({
          ...current,
          loadingDepartments: false,
          error: error instanceof Error ? error.message : 'Unable to load booking data',
        }));
      }
    };

    void loadPatientAndDepartments();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!state.selectedDepartmentId) {
      setState((current) => ({
        ...current,
        doctors: [],
        selectedDoctorId: '',
        selectedDate: '',
        selectedSlot: '',
        availableSlots: [],
      }));
      return;
    }

    let active = true;

    const loadDoctors = async (): Promise<void> => {
      setState((current) => ({
        ...current,
        loadingDoctors: true,
        error: null,
        selectedDoctorId: '',
        selectedDate: '',
        selectedSlot: '',
        availableSlots: [],
      }));

      try {
        const response = await apiClient.get<ApiEnvelope<DoctorRecord[]>>(
          `/doctors?departmentId=${encodeURIComponent(state.selectedDepartmentId)}`,
        );

        if (!active) {
          return;
        }

        setState((current) => ({
          ...current,
          doctors: response.data.data,
          loadingDoctors: false,
        }));
      } catch (error) {
        if (!active) {
          return;
        }

        setState((current) => ({
          ...current,
          doctors: [],
          loadingDoctors: false,
          error: error instanceof Error ? error.message : 'Unable to load doctors',
        }));
      }
    };

    void loadDoctors();

    return () => {
      active = false;
    };
  }, [state.selectedDepartmentId]);

  const selectedDepartment = useMemo(
    () => state.departments.find((department) => department.id === state.selectedDepartmentId) ?? null,
    [state.departments, state.selectedDepartmentId],
  );

  const selectedDoctor = useMemo(
    () => state.doctors.find((doctor) => doctor.id === state.selectedDoctorId) ?? null,
    [state.doctors, state.selectedDoctorId],
  );

  const tomorrow = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return formatDateInputValue(date);
  }, []);

  const isSelectedDateAllowed = useMemo(() => {
    if (!selectedDoctor || !state.selectedDate) {
      return false;
    }

    const selectedDay = new Date(`${state.selectedDate}T00:00:00`).toLocaleDateString('en-US', {
      weekday: 'long',
    });

    return selectedDoctor.availableDays.map((day) => day.toUpperCase()).includes(selectedDay.toUpperCase());
  }, [selectedDoctor, state.selectedDate]);

  useEffect(() => {
    if (!selectedDoctor || !state.selectedDate || !isSelectedDateAllowed) {
      setState((current) => ({ ...current, availableSlots: [], selectedSlot: '' }));
      return;
    }

    let active = true;

    const loadSlots = async (): Promise<void> => {
      setState((current) => ({ ...current, loadingSlots: true, selectedSlot: '', error: null }));

      try {
        const response = await apiClient.get<ApiEnvelope<string[]>>(
          `/appointments/slots?doctorId=${encodeURIComponent(selectedDoctor.id)}&date=${encodeURIComponent(state.selectedDate)}`,
        );

        if (!active) {
          return;
        }

        setState((current) => ({
          ...current,
          availableSlots: response.data.data,
          loadingSlots: false,
        }));
      } catch (error) {
        if (!active) {
          return;
        }

        setState((current) => ({
          ...current,
          availableSlots: [],
          loadingSlots: false,
          error: error instanceof Error ? error.message : 'Unable to load slots',
        }));
      }
    };

    void loadSlots();

    return () => {
      active = false;
    };
  }, [isSelectedDateAllowed, selectedDoctor, state.selectedDate]);

  const currentStep = useMemo(() => {
    if (!state.selectedDepartmentId) {
      return 1;
    }

    if (!state.selectedDoctorId) {
      return 2;
    }

    if (!state.selectedDate) {
      return 3;
    }

    if (!state.selectedSlot) {
      return 4;
    }

    return 5;
  }, [state.selectedDate, state.selectedDepartmentId, state.selectedDoctorId, state.selectedSlot]);

  const estimatedFee = selectedDoctor ? toCurrency(selectedDoctor.consultationFee) : '—';

  const handleDepartmentSelect = (departmentId: string): void => {
    setState((current) => ({
      ...current,
      selectedDepartmentId: departmentId,
      selectedDoctorId: '',
      selectedDate: '',
      selectedSlot: '',
      reason: '',
      availableSlots: [],
    }));
  };

  const handleDoctorSelect = (doctorId: string): void => {
    setState((current) => ({
      ...current,
      selectedDoctorId: doctorId,
      selectedDate: '',
      selectedSlot: '',
      availableSlots: [],
    }));
  };

  const handleDateSelect = (dateValue: string): void => {
    setState((current) => ({
      ...current,
      selectedDate: dateValue,
      selectedSlot: '',
      availableSlots: [],
    }));
  };

  const handleConfirmBooking = async (): Promise<void> => {
    if (!selectedDoctor || !state.patientId || !state.selectedDate || !state.selectedSlot || !state.reason.trim()) {
      return;
    }

    setState((current) => ({ ...current, submitting: true, error: null }));

    try {
      await apiClient.post<ApiEnvelope<unknown>>('/appointments', {
        patientId: state.patientId,
        doctorId: selectedDoctor.id,
        appointmentType: 'ONLINE',
        scheduledAt: `${state.selectedDate}T${state.selectedSlot}:00`,
        reason: state.reason.trim(),
      });

      router.push('/patient/appointments');
    } catch (error) {
      setState((current) => ({
        ...current,
        submitting: false,
        error: error instanceof Error ? error.message : 'Unable to book appointment',
      }));
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Book an Appointment</h2>
            <p className="mt-1 text-sm text-slate-500">Choose a department, pick a doctor, then reserve an available slot.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StepChip label="Department" active={currentStep === 1} done={currentStep > 1} />
            <StepChip label="Doctor" active={currentStep === 2} done={currentStep > 2} />
            <StepChip label="Date" active={currentStep === 3} done={currentStep > 3} />
            <StepChip label="Time" active={currentStep === 4} done={currentStep > 4} />
            <StepChip label="Confirm" active={currentStep === 5} done={false} />
          </div>
        </div>
      </section>

      {state.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <section className="space-y-6">
          <WizardStep
            number={1}
            title="Select Department"
            description="Start with the care area that matches your needs."
            active={currentStep === 1}
            completed={currentStep > 1}
          >
            {state.loadingDepartments ? (
              <LoadingGrid label="Loading departments" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {state.departments.map((department) => {
                  const active = department.id === state.selectedDepartmentId;
                  return (
                    <button
                      key={department.id}
                      type="button"
                      onClick={() => handleDepartmentSelect(department.id)}
                      className={`rounded-2xl border p-4 text-left transition ${active ? 'border-sky-500 bg-sky-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                    >
                      <p className="font-semibold text-slate-900">{department.name}</p>
                      <p className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{department.code}</p>
                      <p className="mt-3 text-sm text-slate-600">{department.description ?? 'No description available.'}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </WizardStep>

          <WizardStep
            number={2}
            title="Select Doctor"
            description="Pick a doctor in the chosen department."
            active={currentStep === 2}
            completed={currentStep > 2}
          >
            {!state.selectedDepartmentId ? (
              <InlineHint icon={Users} message="Select a department first to see matching doctors." />
            ) : state.loadingDoctors ? (
              <LoadingGrid label="Loading doctors" />
            ) : state.doctors.length === 0 ? (
              <InlineHint icon={Stethoscope} message="No doctors are available for this department yet." />
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {state.doctors.map((doctor) => {
                  const active = doctor.id === state.selectedDoctorId;
                  return (
                    <button
                      key={doctor.id}
                      type="button"
                      onClick={() => handleDoctorSelect(doctor.id)}
                      className={`rounded-2xl border p-4 text-left transition ${active ? 'border-sky-500 bg-sky-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">{doctor.firstName} {doctor.lastName}</p>
                          <p className="mt-1 text-sm text-slate-600">{doctor.specialization}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {toCurrency(doctor.consultationFee)}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                        <MetaPill icon={MapPin} label={doctor.department.name} />
                        <MetaPill icon={Clock3} label={`${doctor.startTime} - ${doctor.endTime}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </WizardStep>

          <WizardStep
            number={3}
            title="Select Date"
            description="Choose a future day when this doctor is available."
            active={currentStep === 3}
            completed={currentStep > 3}
          >
            {!selectedDoctor ? (
              <InlineHint icon={CalendarDays} message="Choose a doctor first to unlock the schedule." />
            ) : (
              <div className="grid gap-4 lg:grid-cols-[1fr_0.7fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="appointment-date">
                    Appointment date
                  </label>
                  <input
                    id="appointment-date"
                    type="date"
                    min={tomorrow}
                    value={state.selectedDate}
                    onChange={(event) => handleDateSelect(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  />
                  <p className="mt-2 text-xs text-slate-500">Only future dates are allowed.</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">Available days</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedDoctor.availableDays.map((day) => (
                      <span key={day} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {day}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-slate-500">Selected date must match one of these days.</p>
                </div>
              </div>
            )}
          </WizardStep>

          <WizardStep
            number={4}
            title="Select Time Slot"
            description="Pick one of the available slots for the chosen date."
            active={currentStep === 4}
            completed={currentStep > 4}
          >
            {!selectedDoctor || !state.selectedDate ? (
              <InlineHint icon={Clock3} message="Choose a doctor and date to see available slots." />
            ) : !isSelectedDateAllowed ? (
              <InlineHint icon={CalendarDays} message="That date is not one of the doctor's available days." />
            ) : state.loadingSlots ? (
              <LoadingGrid label="Loading slots" />
            ) : state.availableSlots.length === 0 ? (
              <InlineHint icon={Clock3} message="No slots are available for the selected day. Try another date." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {state.availableSlots.map((slot) => {
                  const active = slot === state.selectedSlot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        setState((current) => ({ ...current, selectedSlot: slot }));
                      }}
                      className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${active ? 'border-sky-500 bg-sky-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            )}
          </WizardStep>
        </section>

        <aside className="space-y-6">
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h3 className="text-lg font-semibold text-slate-900">Booking Summary</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <SummaryRow label="Department" value={selectedDepartment?.name ?? '—'} />
              <SummaryRow label="Doctor" value={selectedDoctor ? `${selectedDoctor.firstName} ${selectedDoctor.lastName}` : '—'} />
              <SummaryRow label="Date" value={state.selectedDate ? toShortDate(state.selectedDate) : '—'} />
              <SummaryRow label="Time" value={state.selectedSlot || '—'} />
              <SummaryRow label="Fee" value={estimatedFee} />
            </div>
          </section>

          <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm">
            <h3 className="text-lg font-semibold">Confirm Booking</h3>
            <p className="mt-2 text-sm text-white/70">Add a short reason for the visit, then confirm the appointment.</p>

            <div className="mt-4 space-y-3">
              <textarea
                rows={5}
                value={state.reason}
                onChange={(event) => setState((current) => ({ ...current, reason: event.target.value }))}
                placeholder="Reason for visit"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/30 focus:ring-2 focus:ring-white/10"
              />

              <button
                type="button"
                disabled={state.submitting || !selectedDoctor || !state.selectedDate || !state.selectedSlot || !state.reason.trim() || !isSelectedDateAllowed}
                onClick={() => void handleConfirmBooking()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {state.submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirm Booking
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

interface WizardStepProps {
  number: number;
  title: string;
  description: string;
  active: boolean;
  completed: boolean;
  children: ReactNode;
}

function WizardStep({ number, title, description, active, completed, children }: WizardStepProps) {
  return (
    <section className={`rounded-3xl border bg-white p-5 shadow-sm ring-1 ${active ? 'border-sky-200 ring-sky-100' : completed ? 'border-emerald-200 ring-emerald-100' : 'border-slate-100 ring-slate-100'}`}>
      <div className="flex items-start gap-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${active ? 'bg-sky-600 text-white' : completed ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
          {number}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

function StepChip({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${active ? 'bg-sky-600 text-white' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
      {label}
    </span>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function InlineHint({ icon: Icon, message }: { icon: ComponentType<{ className?: string }>; message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
      <Icon className="h-4 w-4" />
      {message}
    </div>
  );
}

function LoadingGrid({ label }: { label: string }) {
  return (
    <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function MetaPill({ icon: Icon, label }: { icon: ComponentType<{ className?: string }>; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
