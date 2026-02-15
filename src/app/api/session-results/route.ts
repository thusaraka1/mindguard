import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST: Save session results and mark appointment as COMPLETED
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            appointmentId,
            duration,
            recordedTemp,
            prescription,
            prediction,
            probability,
            confidence,
            sessionAverages,
        } = body;

        if (!appointmentId) {
            return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 });
        }

        // Check appointment exists
        const appointment = await prisma.appointment.findUnique({
            where: { id: appointmentId },
        });

        if (!appointment) {
            return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
        }

        // Create session record and update appointment status in a transaction
        const [sessionRecord] = await prisma.$transaction([
            prisma.sessionRecord.create({
                data: {
                    appointmentId,
                    duration: duration || 0,
                    recordedTemp: recordedTemp ?? null,
                    prescription: prescription || null,
                    prediction: prediction || null,
                    probability: probability ?? null,
                    confidence: confidence ?? null,
                    avgHeartRate: sessionAverages?.heart_rate ?? null,
                    avgBodyTemp: sessionAverages?.body_temp ?? null,
                    avgSpeechNoise: sessionAverages?.speech_noise_db ?? null,
                    avgMovement: sessionAverages?.movement_level ?? null,
                    avgEcgVariability: sessionAverages?.ecg_variability ?? null,
                    avgFacialStress: sessionAverages?.facial_stress_score ?? null,
                    age: sessionAverages?.age ?? null,
                    gender: sessionAverages?.gender ?? null,
                    province: sessionAverages?.province ?? null,
                },
            }),
            prisma.appointment.update({
                where: { id: appointmentId },
                data: { status: 'COMPLETED' },
            }),
        ]);

        return NextResponse.json({ success: true, sessionRecord });
    } catch (error) {
        console.error('Save session results error:', error);
        return NextResponse.json({ error: 'Failed to save session results' }, { status: 500 });
    }
}

// GET: Fetch session record by appointmentId
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const appointmentId = searchParams.get('appointmentId');

        if (!appointmentId) {
            return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 });
        }

        const sessionRecord = await prisma.sessionRecord.findUnique({
            where: { appointmentId },
            include: {
                appointment: {
                    include: {
                        doctor: { select: { name: true, specialty: true } },
                    },
                },
            },
        });

        if (!sessionRecord) {
            return NextResponse.json({ error: 'No session record found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, sessionRecord });
    } catch (error) {
        console.error('Get session results error:', error);
        return NextResponse.json({ error: 'Failed to fetch session results' }, { status: 500 });
    }
}
