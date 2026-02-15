import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { doctorId, patientName, patientEmail, patientPhone, date, notes } = body;

        if (!doctorId || !patientName || !patientEmail || !date) {
            return NextResponse.json(
                { error: 'Doctor, patient name, email, and date are required' },
                { status: 400 }
            );
        }

        const bookingDate = new Date(date.split('T')[0] + 'T00:00:00.000Z');

        // Find the next available (unbooked) time slot for this doctor on this date
        const nextSlot = await prisma.timeSlot.findFirst({
            where: {
                doctorId,
                date: bookingDate,
                isBooked: false,
            },
            orderBy: { time: 'asc' },
        });

        if (!nextSlot) {
            return NextResponse.json(
                { error: 'No available slots remaining for this date. Please choose another date.' },
                { status: 409 }
            );
        }

        // Mark the slot as booked and create the appointment in a transaction
        const [appointment] = await prisma.$transaction([
            prisma.appointment.create({
                data: {
                    doctorId,
                    patientName,
                    patientEmail,
                    patientPhone: patientPhone || null,
                    date: bookingDate,
                    timeSlot: nextSlot.time,
                    notes: notes || null,
                },
                include: { doctor: true },
            }),
            prisma.timeSlot.update({
                where: { id: nextSlot.id },
                data: { isBooked: true },
            }),
        ]);

        // Count booking number for this date (how many booked so far including this one)
        const bookingNumber = await prisma.appointment.count({
            where: {
                doctorId,
                date: bookingDate,
                status: { not: 'CANCELLED' },
            },
        });

        // Send SMS Notification
        if (patientPhone) {
            const dateStr = new Date(date.split('T')[0] + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const fee = appointment.doctor.consultFee ? `Rs. ${appointment.doctor.consultFee.toLocaleString()}` : 'TBD';
            const refNo = appointment.id.slice(-6).toUpperCase();

            const smsMessage = `MindGuard Booking Confirmed!\nPatient: ${patientName}\nRef: ${refNo} | Booking #${bookingNumber}\nDoctor: ${appointment.doctor.name}\nDate: ${dateStr}\nTime: ${nextSlot.time}\nRoom: ${nextSlot.room}\nFee: ${fee}\n\nThank you for choosing MindGuard.`;

            try {
                const { sendSMS } = await import('@/lib/sms');
                await sendSMS(patientPhone, smsMessage);
            } catch (err) {
                console.error("Failed to send booking SMS:", err);
            }
        }

        return NextResponse.json({
            success: true,
            appointment,
            assignedTime: nextSlot.time,
            assignedRoom: nextSlot.room,
            bookingNumber,
        });
    } catch (error) {
        console.error('Book appointment error:', error);
        return NextResponse.json({ error: 'Failed to book appointment' }, { status: 500 });
    }
}
