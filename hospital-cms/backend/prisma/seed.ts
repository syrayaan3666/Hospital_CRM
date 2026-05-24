import "dotenv/config";
import bcrypt from "bcryptjs";
import { AppointmentStatus, AppointmentType, BillStatus, BloodGroup, Gender, PaymentMethod, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

const password = "Test@1234";
const passwordHashPromise = bcrypt.hash(password, 12);

const departmentSeedData = [
	{ name: "Cardiology", code: "CARD", description: "Heart and vascular care" },
	{ name: "Orthopedics", code: "ORTH", description: "Bones, joints, and musculoskeletal care" },
	{ name: "Neurology", code: "NEUR", description: "Brain and nervous system care" },
	{ name: "General Medicine", code: "GMED", description: "Primary care and internal medicine" },
	{ name: "Pathology", code: "PATH", description: "Laboratory diagnostics and reporting" },
] as const;

async function main() {
	const passwordHash = await passwordHashPromise;

	await prisma.$transaction(async (tx) => {
		console.log("Seeding departments...");
		const departments = new Map<string, { id: string; name: string; code: string }>();

		for (const department of departmentSeedData) {
			const row = await tx.department.upsert({
				where: { code: department.code },
				update: { name: department.name, description: department.description },
				create: department,
			});

			departments.set(department.name, row);
		}
		console.log("Departments complete.");

		console.log("Seeding users and profiles...");

		const admin = await tx.user.upsert({
			where: { email: "admin@hospital.com" },
			update: {
				firstName: "Admin",
				lastName: "User",
				passwordHash,
				role: Role.ADMIN,
				isActive: true,
			},
			create: {
				email: "admin@hospital.com",
				passwordHash,
				role: Role.ADMIN,
				firstName: "Admin",
				lastName: "User",
				isActive: true,
			},
		});

		const doctor1User = await tx.user.upsert({
			where: { email: "doctor@hospital.com" },
			update: {
				firstName: "Dr. Rahul",
				lastName: "Sharma",
				passwordHash,
				role: Role.DOCTOR,
				isActive: true,
			},
			create: {
				email: "doctor@hospital.com",
				passwordHash,
				role: Role.DOCTOR,
				firstName: "Dr. Rahul",
				lastName: "Sharma",
				isActive: true,
			},
		});

		const doctor1 = await tx.doctor.upsert({
			where: { licenseNumber: "MCI-2024-001" },
			update: {
				userId: doctor1User.id,
				departmentId: departments.get("Cardiology")!.id,
				firstName: "Dr. Rahul",
				lastName: "Sharma",
				specialization: "Interventional Cardiology",
				consultationFee: 800,
				availableDays: ["MONDAY", "WEDNESDAY", "FRIDAY"],
				startTime: "09:00",
				endTime: "17:00",
				slotDurationMinutes: 30,
			},
			create: {
				userId: doctor1User.id,
				departmentId: departments.get("Cardiology")!.id,
				licenseNumber: "MCI-2024-001",
				firstName: "Dr. Rahul",
				lastName: "Sharma",
				specialization: "Interventional Cardiology",
				consultationFee: 800,
				availableDays: ["MONDAY", "WEDNESDAY", "FRIDAY"],
				startTime: "09:00",
				endTime: "17:00",
				slotDurationMinutes: 30,
			},
		});

		const doctor2User = await tx.user.upsert({
			where: { email: "doctor2@hospital.com" },
			update: {
				firstName: "Dr. Priya",
				lastName: "Menon",
				passwordHash,
				role: Role.DOCTOR,
				isActive: true,
			},
			create: {
				email: "doctor2@hospital.com",
				passwordHash,
				role: Role.DOCTOR,
				firstName: "Dr. Priya",
				lastName: "Menon",
				isActive: true,
			},
		});

		const doctor2 = await tx.doctor.upsert({
			where: { licenseNumber: "MCI-2024-002" },
			update: {
				userId: doctor2User.id,
				departmentId: departments.get("Neurology")!.id,
				firstName: "Dr. Priya",
				lastName: "Menon",
				specialization: "Neurological Surgery",
				consultationFee: 1000,
				availableDays: ["TUESDAY", "THURSDAY"],
				startTime: "10:00",
				endTime: "16:00",
				slotDurationMinutes: 45,
			},
			create: {
				userId: doctor2User.id,
				departmentId: departments.get("Neurology")!.id,
				licenseNumber: "MCI-2024-002",
				firstName: "Dr. Priya",
				lastName: "Menon",
				specialization: "Neurological Surgery",
				consultationFee: 1000,
				availableDays: ["TUESDAY", "THURSDAY"],
				startTime: "10:00",
				endTime: "16:00",
				slotDurationMinutes: 45,
			},
		});

		await tx.user.upsert({
			where: { email: "reception@hospital.com" },
			update: {
				firstName: "Sneha",
				lastName: "Patel",
				passwordHash,
				role: Role.RECEPTIONIST,
				isActive: true,
			},
			create: {
				email: "reception@hospital.com",
				passwordHash,
				role: Role.RECEPTIONIST,
				firstName: "Sneha",
				lastName: "Patel",
				isActive: true,
			},
		});

		await tx.user.upsert({
			where: { email: "lab@hospital.com" },
			update: {
				firstName: "Ravi",
				lastName: "Kumar",
				passwordHash,
				role: Role.LAB_STAFF,
				isActive: true,
			},
			create: {
				email: "lab@hospital.com",
				passwordHash,
				role: Role.LAB_STAFF,
				firstName: "Ravi",
				lastName: "Kumar",
				isActive: true,
			},
		});

		const patient1User = await tx.user.upsert({
			where: { email: "patient@hospital.com" },
			update: {
				firstName: "Arjun",
				lastName: "Verma",
				phone: "9876543210",
				passwordHash,
				role: Role.PATIENT,
				isActive: true,
			},
			create: {
				email: "patient@hospital.com",
				passwordHash,
				role: Role.PATIENT,
				firstName: "Arjun",
				lastName: "Verma",
				phone: "9876543210",
				isActive: true,
			},
		});

		const patient1 = await tx.patient.upsert({
			where: { medicalRecordNumber: "HOSP-2024-00001" },
			update: {
				userId: patient1User.id,
				firstName: "Arjun",
				lastName: "Verma",
				gender: Gender.MALE,
				dateOfBirth: new Date("1990-05-15"),
				bloodGroup: BloodGroup.B_POS,
				phone: "9876543210",
				email: "patient@hospital.com",
				allergies: ["Penicillin", "Aspirin"],
				chronicConditions: ["Hypertension"],
				emergencyContactName: "Sunita Verma",
				emergencyContactPhone: "9876543211",
			},
			create: {
				userId: patient1User.id,
				medicalRecordNumber: "HOSP-2024-00001",
				firstName: "Arjun",
				lastName: "Verma",
				gender: Gender.MALE,
				dateOfBirth: new Date("1990-05-15"),
				bloodGroup: BloodGroup.B_POS,
				phone: "9876543210",
				email: "patient@hospital.com",
				allergies: ["Penicillin", "Aspirin"],
				chronicConditions: ["Hypertension"],
				emergencyContactName: "Sunita Verma",
				emergencyContactPhone: "9876543211",
			},
		});

		const patient2User = await tx.user.upsert({
			where: { email: "patient2@hospital.com" },
			update: {
				firstName: "Kavya",
				lastName: "Reddy",
				phone: "9123456780",
				passwordHash,
				role: Role.PATIENT,
				isActive: true,
			},
			create: {
				email: "patient2@hospital.com",
				passwordHash,
				role: Role.PATIENT,
				firstName: "Kavya",
				lastName: "Reddy",
				phone: "9123456780",
				isActive: true,
			},
		});

		const patient2 = await tx.patient.upsert({
			where: { medicalRecordNumber: "HOSP-2024-00002" },
			update: {
				userId: patient2User.id,
				firstName: "Kavya",
				lastName: "Reddy",
				gender: Gender.FEMALE,
				dateOfBirth: new Date("1985-08-22"),
				bloodGroup: BloodGroup.O_POS,
				phone: "9123456780",
				email: "patient2@hospital.com",
				allergies: [],
				chronicConditions: ["Diabetes Type 2"],
				emergencyContactName: null,
				emergencyContactPhone: null,
			},
			create: {
				userId: patient2User.id,
				medicalRecordNumber: "HOSP-2024-00002",
				firstName: "Kavya",
				lastName: "Reddy",
				gender: Gender.FEMALE,
				dateOfBirth: new Date("1985-08-22"),
				bloodGroup: BloodGroup.O_POS,
				phone: "9123456780",
				email: "patient2@hospital.com",
				allergies: [],
				chronicConditions: ["Diabetes Type 2"],
				emergencyContactName: null,
				emergencyContactPhone: null,
			},
		});

		console.log("Users and profiles complete.");

		console.log("Seeding appointments...");
		const now = new Date();
		const yesterday = new Date(now);
		yesterday.setDate(now.getDate() - 7);
		yesterday.setHours(10, 0, 0, 0);

		const tomorrow = new Date(now);
		tomorrow.setDate(now.getDate() + 1);
		tomorrow.setHours(11, 0, 0, 0);

		const dayAfterTomorrow = new Date(now);
		dayAfterTomorrow.setDate(now.getDate() + 2);
		dayAfterTomorrow.setHours(12, 0, 0, 0);

		const appointment1 = await tx.appointment.upsert({
			where: { appointmentNumber: "APT-2024-00001" },
			update: {
				patientId: patient1.id,
				doctorId: doctor1.id,
				departmentId: doctor1.departmentId,
				appointmentType: AppointmentType.WALK_IN,
				status: AppointmentStatus.COMPLETED,
				scheduledAt: yesterday,
				durationMinutes: 30,
				reason: "Chest pain and shortness of breath",
				notes: "Completed sample appointment",
			},
			create: {
				appointmentNumber: "APT-2024-00001",
				patientId: patient1.id,
				doctorId: doctor1.id,
				departmentId: doctor1.departmentId,
				appointmentType: AppointmentType.WALK_IN,
				status: AppointmentStatus.COMPLETED,
				scheduledAt: yesterday,
				durationMinutes: 30,
				reason: "Chest pain and shortness of breath",
				notes: "Completed sample appointment",
			},
		});

		const appointment2 = await tx.appointment.upsert({
			where: { appointmentNumber: "APT-2024-00002" },
			update: {
				patientId: patient1.id,
				doctorId: doctor1.id,
				departmentId: doctor1.departmentId,
				appointmentType: AppointmentType.ONLINE,
				status: AppointmentStatus.SCHEDULED,
				scheduledAt: tomorrow,
				durationMinutes: 30,
				reason: "Follow-up appointment",
				notes: "Tomorrow sample appointment",
			},
			create: {
				appointmentNumber: "APT-2024-00002",
				patientId: patient1.id,
				doctorId: doctor1.id,
				departmentId: doctor1.departmentId,
				appointmentType: AppointmentType.ONLINE,
				status: AppointmentStatus.SCHEDULED,
				scheduledAt: tomorrow,
				durationMinutes: 30,
				reason: "Follow-up appointment",
				notes: "Tomorrow sample appointment",
			},
		});

		const appointment3 = await tx.appointment.upsert({
			where: { appointmentNumber: "APT-2024-00003" },
			update: {
				patientId: patient2.id,
				doctorId: doctor2.id,
				departmentId: doctor2.departmentId,
				appointmentType: AppointmentType.WALK_IN,
				status: AppointmentStatus.SCHEDULED,
				scheduledAt: dayAfterTomorrow,
				durationMinutes: 45,
				reason: "Neurology consultation",
				notes: "Day after tomorrow sample appointment",
			},
			create: {
				appointmentNumber: "APT-2024-00003",
				patientId: patient2.id,
				doctorId: doctor2.id,
				departmentId: doctor2.departmentId,
				appointmentType: AppointmentType.WALK_IN,
				status: AppointmentStatus.SCHEDULED,
				scheduledAt: dayAfterTomorrow,
				durationMinutes: 45,
				reason: "Neurology consultation",
				notes: "Day after tomorrow sample appointment",
			},
		});

		console.log("Appointments complete.");

		console.log("Seeding consultation and prescription...");
		const consultation = await tx.consultation.upsert({
			where: { appointmentId: appointment1.id },
			update: {
				patientId: patient1.id,
				doctorId: doctor1.id,
				consultationAt: yesterday,
				vitals: {
					bp: "130/85",
					temperature: 98.6,
					weight: 72,
					height: 175,
					pulse: 78,
					spo2: 98,
				},
				symptoms: "Chest pain and shortness of breath",
				diagnosis: "Stable Angina",
				notes: "Patient advised lifestyle modification and medication",
				isLocked: true,
			},
			create: {
				appointmentId: appointment1.id,
				patientId: patient1.id,
				doctorId: doctor1.id,
				consultationAt: yesterday,
				vitals: {
					bp: "130/85",
					temperature: 98.6,
					weight: 72,
					height: 175,
					pulse: 78,
					spo2: 98,
				},
				symptoms: "Chest pain and shortness of breath",
				diagnosis: "Stable Angina",
				notes: "Patient advised lifestyle modification and medication",
				isLocked: true,
			},
		});

		const prescription = await tx.prescription.upsert({
			where: { consultationId: consultation.id },
			update: {
				patientId: patient1.id,
				doctorId: doctor1.id,
				remarks: "Follow prescribed treatment plan",
			},
			create: {
				prescriptionNumber: "PRX-2024-00001",
				consultationId: consultation.id,
				patientId: patient1.id,
				doctorId: doctor1.id,
				remarks: "Follow prescribed treatment plan",
			},
		});

		const existingPrescriptionItem = await tx.prescriptionItem.findFirst({
			where: {
				prescriptionId: prescription.id,
				medicineName: "Atorvastatin",
			},
		});

		if (existingPrescriptionItem) {
			await tx.prescriptionItem.update({
				where: { id: existingPrescriptionItem.id },
				data: {
					dosage: "10mg",
					frequency: "Once daily",
					durationDays: 30,
					quantity: 30,
					instructions: "Take at bedtime",
				},
			});
		} else {
			await tx.prescriptionItem.create({
				data: {
					prescriptionId: prescription.id,
					medicineName: "Atorvastatin",
					dosage: "10mg",
					frequency: "Once daily",
					durationDays: 30,
					quantity: 30,
					instructions: "Take at bedtime",
				},
			});
		}

		console.log("Consultation and prescription complete.");

		const existingNotification = await tx.notification.findFirst({
			where: {
				userId: patient1User.id,
				title: "Welcome to Hospital CMS",
			},
		});

		if (existingNotification) {
			await tx.notification.update({
				where: { id: existingNotification.id },
				data: {
					message: "Your profile and first consultation data have been seeded.",
					type: "SYSTEM",
					isRead: false,
					readAt: null,
				},
			});
		} else {
			await tx.notification.create({
				data: {
					userId: patient1User.id,
					title: "Welcome to Hospital CMS",
					message: "Your profile and first consultation data have been seeded.",
					type: "SYSTEM",
				},
			});
		}

		console.log("Seeding bill...");
		const subtotal = 800;
		const taxAmount = 144;
		const totalAmount = subtotal + taxAmount;

		const bill = await tx.bill.upsert({
			where: { billNumber: "BILL-2024-00001" },
			update: {
				patientId: patient1.id,
				appointmentId: appointment1.id,
				consultationId: consultation.id,
				status: BillStatus.PAID,
				paymentMethod: PaymentMethod.CASH,
				dueAt: null,
				paidAt: yesterday,
				subtotal,
				discountAmount: 0,
				taxAmount,
				totalAmount,
				amountPaid: totalAmount,
				notes: "Seeded paid consultation bill",
			},
			create: {
				billNumber: "BILL-2024-00001",
				patientId: patient1.id,
				appointmentId: appointment1.id,
				consultationId: consultation.id,
				status: BillStatus.PAID,
				paymentMethod: PaymentMethod.CASH,
				issuedAt: yesterday,
				paidAt: yesterday,
				subtotal,
				discountAmount: 0,
				taxAmount,
				totalAmount,
				amountPaid: totalAmount,
				notes: "Seeded paid consultation bill",
			},
		});

		const existingBillItem = await tx.billItem.findFirst({
			where: {
				billId: bill.id,
				description: "Consultation Fee",
			},
		});

		if (existingBillItem) {
			await tx.billItem.update({
				where: { id: existingBillItem.id },
				data: {
					quantity: 1,
					unitPrice: 800,
					amount: 800,
				},
			});
		} else {
			await tx.billItem.create({
				data: {
					billId: bill.id,
					description: "Consultation Fee",
					quantity: 1,
					unitPrice: 800,
					amount: 800,
				},
			});
		}

		console.log("Bill complete.");
		console.log("Seed finished successfully.");
	});
}

main()
	.catch((error) => {
		console.error("Seed failed:", error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});