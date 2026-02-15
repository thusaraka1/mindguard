import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Get time slots for a doctor
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const slots = await prisma.timeSlot.findMany({
            where: { doctorId: id },
            orderBy: { time: 'asc' },
        });
        return NextResponse.json({ success: true, slots });
    } catch (error) {
        console.error('Fetch slots error:', error);
        return NextResponse.json({ error: 'Failed to fetch slots' }, { status: 500 });
    }
}

// POST: Add time slots for a doctor
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const body = await request.json();
        // New payload: Create a "Session" (multiple slots)
        const { date, startTime, count, duration, room } = body;

        if (!date || !startTime || !count || !duration) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const slotDate = new Date(date + 'T00:00:00.000Z');

        const [startH, startM] = startTime.split(':').map(Number);
        const dummyBase = new Date(2000, 0, 1, startH, startM, 0, 0);

        const slotsData = [];
        for (let i = 0; i < Number(count); i++) {
            const slotTime = new Date(dummyBase.getTime() + i * Number(duration) * 60000);
            const hh = String(slotTime.getHours()).padStart(2, '0');
            const mm = String(slotTime.getMinutes()).padStart(2, '0');
            const timeStr = `${hh}:${mm}`;

            slotsData.push({
                doctorId: id,
                date: slotDate,
                time: timeStr,
                room: room || 'Room 1',
                isBooked: false
            });
        }

        const result = await prisma.timeSlot.createMany({
            data: slotsData,
            skipDuplicates: true,
        });

        return NextResponse.json({ success: true, added: result.count });
    } catch (error: any) {
        console.error('Add slots error:', error);
        return NextResponse.json({ error: error.message || 'Failed to add slots' }, { status: 500 });
    }
}

// DELETE: Remove a single slot or all slots for a date
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: doctorId } = await params;
    try {
        const body = await request.json();
        const { slotId, date } = body;

        // Bulk delete: remove all slots for a specific date
        if (date) {
            const deleteDate = new Date(date.split('T')[0] + 'T00:00:00.000Z');

            const result = await prisma.timeSlot.deleteMany({
                where: {
                    doctorId,
                    date: deleteDate,
                },
            });

            return NextResponse.json({ success: true, deleted: result.count });
        }

        // Single delete
        if (!slotId) {
            return NextResponse.json({ error: 'Slot ID or date is required' }, { status: 400 });
        }

        await prisma.timeSlot.delete({
            where: { id: slotId },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Delete slot error:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete slot' }, { status: 500 });
    }
}
