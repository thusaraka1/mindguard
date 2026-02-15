import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch appointments for a specific doctor (CONFIRMED + COMPLETED, paid)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const doctorId = searchParams.get('doctorId');

        if (!doctorId) {
            return NextResponse.json({ error: 'doctorId is required' }, { status: 400 });
        }

        const appointments = await prisma.appointment.findMany({
            where: {
                doctorId,
                status: { in: ['CONFIRMED', 'COMPLETED'] },
                paid: true,
            },
            include: {
                sessionRecord: true,
            },
            orderBy: { date: 'asc' },
        });

        return NextResponse.json({ success: true, appointments });
    } catch (error) {
        console.error('Doctor patients error:', error);
        return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 });
    }
}
