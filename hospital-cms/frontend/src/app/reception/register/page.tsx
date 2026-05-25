'use client';

import { useState, type FormEvent } from 'react';
import AuthGuard from '../../../components/AuthGuard';
import DashboardLayout from '../../../components/DashboardLayout';
import apiClient from '../../../lib/axios';
import type { BloodGroup, Gender } from '../../../types';
import { bloodGroupOptions } from '../shared';

interface RegisterFormState {
	firstName: string;
	lastName: string;
	dateOfBirth: string;
	gender: Gender | '';
	bloodGroup: BloodGroup | '';
	phone: string;
	address: string;
	emergencyContactName: string;
	emergencyContactPhone: string;
	allergies: string[];
	chronicConditions: string[];
	allergyDraft: string;
	conditionDraft: string;
	loading: boolean;
	error: string | null;
	success: string | null;
}

const initialState: RegisterFormState = {
	firstName: '',
	lastName: '',
	dateOfBirth: '',
	gender: '',
	bloodGroup: '',
	phone: '',
	address: '',
	emergencyContactName: '',
	emergencyContactPhone: '',
	allergies: [],
	chronicConditions: [],
	allergyDraft: '',
	conditionDraft: '',
	loading: false,
	error: null,
	success: null,
};

function emailFromPhone(phone: string): string {
	const compact = phone.replace(/\D/g, '');
	return `${compact}@hospital.patient`;
}

export default function ReceptionRegisterPage() {
	const [form, setForm] = useState<RegisterFormState>(initialState);

	const update = (patch: Partial<RegisterFormState>) => {
		setForm((current) => ({ ...current, ...patch }));
	};

	const addTag = (field: 'allergies' | 'chronicConditions', draftField: 'allergyDraft' | 'conditionDraft') => {
		const value = form[draftField].trim();
		if (!value) return;
		update({
			[field]: [...form[field], value],
			[draftField]: '',
		} as Partial<RegisterFormState>);
	};

	const removeTag = (field: 'allergies' | 'chronicConditions', value: string) => {
		update({ [field]: form[field].filter((item) => item !== value) } as Partial<RegisterFormState>);
	};

	const resetForm = () => setForm(initialState);

	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		update({ loading: true, error: null, success: null });

		try {
			const response = await apiClient.post('/auth/register', {
				email: emailFromPhone(form.phone),
				password: 'Patient@123',
				role: 'PATIENT',
				firstName: form.firstName,
				lastName: form.lastName,
				phone: form.phone,
				dateOfBirth: form.dateOfBirth,
				gender: form.gender,
				bloodGroup: form.bloodGroup || null,
				address: form.address,
				allergies: form.allergies,
				chronicConditions: form.chronicConditions,
				emergencyContactName: form.emergencyContactName,
				emergencyContactPhone: form.emergencyContactPhone,
			});

			const patientCode = response.data.data.patient?.medicalRecordNumber ?? 'N/A';
			update({ success: `Patient registered successfully. Patient code: ${patientCode}`, loading: false });
		} catch (error) {
			update({ loading: false, error: error instanceof Error ? error.message : 'Unable to register patient' });
		}
	};

	return (
		<AuthGuard allowedRoles={['RECEPTIONIST']}>
			<DashboardLayout>
				<form onSubmit={submit} className="space-y-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
					<section className="space-y-4">
						<h2 className="text-xl font-semibold text-gray-900">Personal Information</h2>
						<div className="grid gap-4 md:grid-cols-2">
							<label className="block text-sm font-medium text-gray-700">First Name<input required value={form.firstName} onChange={(event) => update({ firstName: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2" /></label>
							<label className="block text-sm font-medium text-gray-700">Last Name<input required value={form.lastName} onChange={(event) => update({ lastName: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2" /></label>
							<label className="block text-sm font-medium text-gray-700">Date of Birth<input required type="date" value={form.dateOfBirth} onChange={(event) => update({ dateOfBirth: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2" /></label>
							<label className="block text-sm font-medium text-gray-700">Gender<select required value={form.gender} onChange={(event) => update({ gender: event.target.value as Gender | '' })} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2"><option value="">Select gender</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></label>
							<label className="block text-sm font-medium text-gray-700">Blood Group<select value={form.bloodGroup} onChange={(event) => update({ bloodGroup: event.target.value as BloodGroup | '' })} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2"><option value="">Select blood group</option>{bloodGroupOptions.map((group) => <option key={group} value={group}>{group}</option>)}</select></label>
							<label className="block text-sm font-medium text-gray-700">Phone<input required value={form.phone} onChange={(event) => update({ phone: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2" /></label>
							<label className="block text-sm font-medium text-gray-700 md:col-span-2">Address<textarea value={form.address} onChange={(event) => update({ address: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2" rows={3} /></label>
						</div>
					</section>

					<section className="space-y-4">
						<h2 className="text-xl font-semibold text-gray-900">Emergency Contact</h2>
						<div className="grid gap-4 md:grid-cols-2">
							<label className="block text-sm font-medium text-gray-700">Emergency Contact Name<input value={form.emergencyContactName} onChange={(event) => update({ emergencyContactName: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2" /></label>
							<label className="block text-sm font-medium text-gray-700">Emergency Contact Phone<input value={form.emergencyContactPhone} onChange={(event) => update({ emergencyContactPhone: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2" /></label>
						</div>
					</section>

					<section className="space-y-4">
						<h2 className="text-xl font-semibold text-gray-900">Medical Information</h2>
						<div className="grid gap-4 md:grid-cols-2">
							<div>
								<label className="block text-sm font-medium text-gray-700">Allergies</label>
								<div className="mt-2 flex gap-2">
									<input value={form.allergyDraft} onChange={(event) => update({ allergyDraft: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag('allergies', 'allergyDraft'); } }} className="w-full rounded-xl border border-gray-300 px-3 py-2" placeholder="Type allergy and press Enter" />
									<button type="button" onClick={() => addTag('allergies', 'allergyDraft')} className="rounded-xl border border-gray-300 px-4 py-2">Add</button>
								</div>
								<div className="mt-3 flex flex-wrap gap-2">
									{form.allergies.map((item) => <button type="button" key={item} onClick={() => removeTag('allergies', item)} className="rounded-full bg-rose-50 px-3 py-1 text-sm text-rose-700">{item} ×</button>)}
								</div>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700">Chronic Conditions</label>
								<div className="mt-2 flex gap-2">
									<input value={form.conditionDraft} onChange={(event) => update({ conditionDraft: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag('chronicConditions', 'conditionDraft'); } }} className="w-full rounded-xl border border-gray-300 px-3 py-2" placeholder="Type condition and press Enter" />
									<button type="button" onClick={() => addTag('chronicConditions', 'conditionDraft')} className="rounded-xl border border-gray-300 px-4 py-2">Add</button>
								</div>
								<div className="mt-3 flex flex-wrap gap-2">
									{form.chronicConditions.map((item) => <button type="button" key={item} onClick={() => removeTag('chronicConditions', item)} className="rounded-full bg-sky-50 px-3 py-1 text-sm text-sky-700">{item} ×</button>)}
								</div>
							</div>
						</div>
					</section>

					<div className="flex flex-wrap gap-3">
						<button type="submit" disabled={form.loading} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-70">{form.loading ? 'Registering...' : 'Register Patient'}</button>
						<button type="button" onClick={resetForm} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">Register Another</button>
						<button type="button" onClick={() => window.location.assign('/reception/appointments')} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">Book Appointment</button>
					</div>

					{form.error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{form.error}</div> : null}
					{form.success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{form.success}</div> : null}
				</form>
			</DashboardLayout>
		</AuthGuard>
	);
}
