import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET: List all appointments for admin
export async function GET() {
    try {
        const appointments = await prisma.appointment.findMany({
            include: { doctor: true },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json({ success: true, appointments });
    } catch (error) {
        console.error('Admin fetch appointments error:', error);
        return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 });
    }
}

// PATCH: Update appointment (mark paid, change status)
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, paid, status } = body;

        if (!id) {
            return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (paid !== undefined) updateData.paid = paid;
        if (status !== undefined) updateData.status = status;

        const appointment = await prisma.appointment.update({
            where: { id },
            data: updateData,
            include: { doctor: true },
        });

        return NextResponse.json({ success: true, appointment });
    } catch (error) {
        console.error('Admin update appointment error:', error);
        return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 });
    }
}
