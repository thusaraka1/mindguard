import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

// GET: List all doctors with their slots, dates, and user info
export async function GET() {
    try {
        const doctors = await prisma.doctor.findMany({
            include: {
                timeSlots: { orderBy: { time: 'asc' } },
                _count: { select: { appointments: true } },
            },
            orderBy: { name: 'asc' },
        });

        // Also get linked user accounts for each doctor
        const doctorIds = doctors.map(d => d.id);
        const users = await prisma.user.findMany({
            where: { doctorId: { in: doctorIds } },
            select: { id: true, email: true, doctorId: true },
        });

        const doctorsWithUsers = doctors.map(doc => ({
            ...doc,
            userEmail: users.find(u => u.doctorId === doc.id)?.email || null,
        }));

        return NextResponse.json({ success: true, doctors: doctorsWithUsers });
    } catch (error) {
        console.error('Admin fetch doctors error:', error);
        return NextResponse.json({ error: 'Failed to fetch doctors' }, { status: 500 });
    }
}

// POST: Create a new doctor + their login user account
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, specialty, bio, experience, consultFee, email, password, rating } = body;

        if (!name || !specialty || !email || !password) {
            return NextResponse.json(
                { error: 'Name, specialty, email, and password are required' },
                { status: 400 }
            );
        }

        // Check if email already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
        }

        // Create doctor profile
        const doctor = await prisma.doctor.create({
            data: {
                name,
                specialty,
                bio: bio || null,
                experience: experience || 5,
                consultFee: consultFee || 2500,
                rating: rating || 4.5,
            },
        });

        // Create doctor's login account
        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
                role: 'DOCTOR',
                doctorId: doctor.id,
            },
        });

        return NextResponse.json({ success: true, doctor: { ...doctor, userEmail: email } });
    } catch (error) {
        console.error('Admin create doctor error:', error);
        return NextResponse.json({ error: 'Failed to create doctor' }, { status: 500 });
    }
}

// PATCH: Update doctor info (fee, bio, specialty, availability, etc.)
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, ...updateData } = body;

        if (!id) {
            return NextResponse.json({ error: 'Doctor ID is required' }, { status: 400 });
        }

        // Only allow specific fields to be updated
        const allowedFields = ['name', 'specialty', 'bio', 'experience', 'consultFee', 'rating', 'available', 'availableDays', 'availableTime'];
        const filtered: Record<string, unknown> = {};
        for (const key of allowedFields) {
            if (updateData[key] !== undefined) filtered[key] = updateData[key];
        }

        const doctor = await prisma.doctor.update({
            where: { id },
            data: filtered,
        });

        return NextResponse.json({ success: true, doctor });
    } catch (error) {
        console.error('Admin update doctor error:', error);
        return NextResponse.json({ error: 'Failed to update doctor' }, { status: 500 });
    }
}

// DELETE: Delete a doctor and their user account
export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'Doctor ID is required' }, { status: 400 });
        }

        // Delete linked user account first
        await prisma.user.deleteMany({ where: { doctorId: id } });

        // Delete the doctor (cascades to time slots and available dates)
        await prisma.doctor.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Admin delete doctor error:', error);
        return NextResponse.json({ error: 'Failed to delete doctor' }, { status: 500 });
    }
}
