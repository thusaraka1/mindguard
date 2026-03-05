import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Use start of today (midnight UTC) so today's slots are included
        // even if current time is past midnight — the slot's *time* field
        // determines whether it can still be booked, not the date alone.
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);

        const doctors = await prisma.doctor.findMany({
            where: { available: true },
            include: {
                timeSlots: {
                    where: {
                        date: { gte: todayStart },
                        isBooked: false
                    },
                    orderBy: [{ date: 'asc' }, { time: 'asc' }]
                }
            },
            orderBy: { rating: 'desc' },
        });
        return NextResponse.json({ success: true, doctors });
    } catch (error: any) {
        console.error('Fetch doctors error:', error);
        return NextResponse.json({
            success: false,
            error: error?.message || 'Failed to fetch doctors',
            details: JSON.stringify(error)
        }, { status: 500 });
    }
}
