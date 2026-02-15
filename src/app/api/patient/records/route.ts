import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch appointments by phone number for patient login
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const phone = searchParams.get('phone');

        if (!phone) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        const appointments = await prisma.appointment.findMany({
            where: {
                patientPhone: phone,
            },
            include: {
                doctor: {
                    select: {
                        name: true,
                        specialty: true,
                    }
                },
                sessionRecord: true,
            },
            orderBy: { date: 'desc' },
        });

        if (appointments.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No records found for this phone number'
            }, { status: 404 });
        }

        // Auto-fix: if sessionRecord exists but status is not COMPLETED, update it
        for (const app of appointments) {
            if (app.sessionRecord && app.status !== 'COMPLETED') {
                await prisma.appointment.update({
                    where: { id: app.id },
                    data: { status: 'COMPLETED' },
                });
                (app as any).status = 'COMPLETED';
            }
        }

        // Group appointments by patient name
        const groupedAppointments: { [key: string]: typeof appointments } = {};

        appointments.forEach(app => {
            if (!groupedAppointments[app.patientName]) {
                groupedAppointments[app.patientName] = [];
            }
            groupedAppointments[app.patientName].push(app);
        });

        const patients = Object.entries(groupedAppointments).map(([name, apps]) => ({
            name,
            appointments: apps.map(a => ({
                id: a.id,
                doctorName: a.doctor.name,
                doctorSpecialty: a.doctor.specialty,
                date: a.date,
                timeSlot: a.timeSlot,
                status: a.status,
                paid: a.paid,
                notes: a.notes,
                createdAt: a.createdAt,
                sessionRecord: a.sessionRecord ? {
                    prediction: a.sessionRecord.prediction,
                    probability: a.sessionRecord.probability,
                    confidence: a.sessionRecord.confidence,
                    prescription: a.sessionRecord.prescription,
                    duration: a.sessionRecord.duration,
                    recordedTemp: a.sessionRecord.recordedTemp,
                    avgHeartRate: a.sessionRecord.avgHeartRate,
                    avgBodyTemp: a.sessionRecord.avgBodyTemp,
                    avgSpeechNoise: a.sessionRecord.avgSpeechNoise,
                    avgMovement: a.sessionRecord.avgMovement,
                    avgEcgVariability: a.sessionRecord.avgEcgVariability,
                    avgFacialStress: a.sessionRecord.avgFacialStress,
                    createdAt: a.sessionRecord.createdAt,
                } : null,
            }))
        }));

        return NextResponse.json({
            success: true,
            patients
        });
    } catch (error) {
        console.error('Patient records error:', error);
        return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
    }
}
