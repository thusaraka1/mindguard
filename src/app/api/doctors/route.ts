import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const doctors = await prisma.doctor.findMany({
            where: { available: true },
            include: {
                timeSlots: {
                    where: {
                        date: { gte: new Date() },
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
