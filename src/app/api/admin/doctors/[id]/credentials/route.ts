import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// PATCH: Reset doctor login credentials (email and/or password)
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email && !password) {
            return NextResponse.json(
                { error: 'Email or password is required' },
                { status: 400 }
            );
        }

        // Find the user linked to this doctor
        const user = await prisma.user.findFirst({ where: { doctorId: id } });
        if (!user) {
            return NextResponse.json(
                { error: 'No login account found for this doctor' },
                { status: 404 }
            );
        }

        // Check if new email is already taken by another user
        if (email && email !== user.email) {
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) {
                return NextResponse.json(
                    { error: 'Email already in use by another account' },
                    { status: 409 }
                );
            }
        }

        const updateData: Record<string, string> = {};
        if (email) updateData.email = email;
        if (password) updateData.password = await bcrypt.hash(password, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: updateData,
        });

        return NextResponse.json({
            success: true,
            message: 'Credentials updated successfully',
            updatedEmail: email || user.email,
        });
    } catch (error) {
        console.error('Reset credentials error:', error);
        return NextResponse.json(
            { error: 'Failed to reset credentials' },
            { status: 500 }
        );
    }
}
