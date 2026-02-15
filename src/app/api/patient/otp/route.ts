import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendSMS } from '@/lib/sms';

// In-memory OTP store (phone -> { otp, expiresAt })
// In production, use Redis or a DB table
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST: Check if phone is registered, generate OTP and send via SMS
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { phone } = body;

        if (!phone || phone.trim().length < 9) {
            return NextResponse.json({ error: 'Valid phone number is required' }, { status: 400 });
        }

        const cleanPhone = phone.trim();

        // Check if this phone number has any appointments
        const count = await prisma.appointment.count({
            where: { patientPhone: cleanPhone },
        });

        if (count === 0) {
            return NextResponse.json({
                success: false,
                registered: false,
                error: 'This phone number is not registered in our system. Please book an appointment first.'
            }, { status: 404 });
        }

        // Generate OTP
        const otp = generateOTP();
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

        // Store OTP
        otpStore.set(cleanPhone, { otp, expiresAt });

        // Send OTP via SMS
        const smsMessage = `Your MindGuard verification code is: ${otp}\nThis code expires in 5 minutes.\nDo not share this code with anyone.`;
        const smsSent = await sendSMS(cleanPhone, smsMessage);

        console.log(`🔐 OTP generated for ${cleanPhone}: ${otp} (SMS sent: ${smsSent})`);

        return NextResponse.json({
            success: true,
            registered: true,
            smsSent,
            message: smsSent
                ? 'Verification code sent to your phone number.'
                : 'SMS sending failed. Please try again.',
            // For development/testing, include OTP in response (remove in production)
            ...(process.env.NODE_ENV === 'development' ? { devOtp: otp } : {}),
        });
    } catch (error) {
        console.error('OTP generation error:', error);
        return NextResponse.json({ error: 'Failed to generate OTP' }, { status: 500 });
    }
}

// PUT: Verify OTP
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { phone, otp } = body;

        if (!phone || !otp) {
            return NextResponse.json({ error: 'Phone number and OTP are required' }, { status: 400 });
        }

        const cleanPhone = phone.trim();
        const stored = otpStore.get(cleanPhone);

        if (!stored) {
            return NextResponse.json({
                success: false,
                error: 'No OTP found. Please request a new code.',
            }, { status: 400 });
        }

        // Check expiry
        if (Date.now() > stored.expiresAt) {
            otpStore.delete(cleanPhone);
            return NextResponse.json({
                success: false,
                error: 'OTP has expired. Please request a new code.',
            }, { status: 400 });
        }

        // Check OTP match
        if (stored.otp !== otp.trim()) {
            return NextResponse.json({
                success: false,
                error: 'Invalid verification code. Please try again.',
            }, { status: 400 });
        }

        // OTP valid — clear it
        otpStore.delete(cleanPhone);

        console.log(`✅ OTP verified for ${cleanPhone}`);

        return NextResponse.json({ success: true, verified: true });
    } catch (error) {
        console.error('OTP verification error:', error);
        return NextResponse.json({ error: 'Failed to verify OTP' }, { status: 500 });
    }
}
