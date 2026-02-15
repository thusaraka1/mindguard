const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // --- Seed Doctors ---
    const doctorsData = [
        {
            name: 'Dr. Amaya Perera', specialty: 'Psychiatrist',
            bio: 'Specialist in child and adolescent mental health with 12 years of clinical experience in cognitive behavioral therapy.',
            rating: 4.9, experience: 12, consultFee: 3500,
            availableDays: 'Mon,Tue,Wed,Thu,Fri', availableTime: '09:00-17:00',
        },
        {
            name: 'Dr. Kavinda Silva', specialty: 'Neurologist',
            bio: 'Expert in pediatric neurology and neurodevelopmental disorders with advanced IoT-based diagnostic approaches.',
            rating: 4.8, experience: 15, consultFee: 4000,
            availableDays: 'Mon,Wed,Fri', availableTime: '10:00-16:00',
        },
        {
            name: 'Dr. Nishani Fernando', specialty: 'Clinical Psychologist',
            bio: 'Focused on anxiety, depression, and trauma recovery using evidence-based therapeutic techniques.',
            rating: 4.7, experience: 8, consultFee: 2500,
            availableDays: 'Tue,Thu,Sat', availableTime: '08:00-14:00',
        },
        {
            name: 'Dr. Rashan Jayawardena', specialty: 'Pediatrician',
            bio: 'General pediatric care with special interest in developmental milestones and behavioral assessments.',
            rating: 4.6, experience: 10, consultFee: 3000,
            availableDays: 'Mon,Tue,Wed,Thu', availableTime: '09:00-15:00',
        },
        {
            name: 'Dr. Dilini Rajapakse', specialty: 'Occupational Therapist',
            bio: 'Specializes in sensory integration therapy and helping children develop daily living skills.',
            rating: 4.8, experience: 9, consultFee: 2800,
            availableDays: 'Mon,Wed,Fri,Sat', availableTime: '08:30-16:30',
        },
        {
            name: 'Dr. Tharindu Gamage', specialty: 'Speech Therapist',
            bio: 'Expert in language development disorders and communication therapy for children with ASD.',
            rating: 4.5, experience: 7, consultFee: 2200,
            availableDays: 'Tue,Thu,Fri', availableTime: '10:00-18:00',
        },
    ];

    const createdDoctors = [];
    for (const doc of doctorsData) {
        const doctor = await prisma.doctor.create({ data: doc });
        createdDoctors.push(doctor);
    }
    console.log(`✅ ${createdDoctors.length} doctors seeded`);

    // --- Seed Admin User ---
    const adminPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
        data: {
            email: 'admin@mindguard.lk',
            name: 'System Admin',
            password: adminPassword,
            role: 'ADMIN',
            doctorId: null,
        },
    });
    console.log('✅ Admin user seeded (admin@mindguard.lk / admin123)');

    // --- Seed Doctor Users (linked to Doctor profiles) ---
    const doctorPassword = await bcrypt.hash('doctor123', 10);
    for (const doctor of createdDoctors) {
        const emailName = doctor.name.replace('Dr. ', '').toLowerCase().replace(/\s+/g, '.');
        await prisma.user.create({
            data: {
                email: `${emailName}@mindguard.lk`,
                name: doctor.name,
                password: doctorPassword,
                role: 'DOCTOR',
                doctorId: doctor.id,
            },
        });
    }
    console.log('✅ Doctor users seeded (password: doctor123)');

    // --- Seed Default Time Slots for first 3 doctors (next 14 days) ---
    const defaultSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00'];
    const rooms = ['Room 101', 'Room 202', 'Room 303'];
    const today = new Date();
    for (let i = 0; i < Math.min(3, createdDoctors.length); i++) {
        for (let d = 1; d <= 14; d++) {
            const date = new Date(today);
            date.setDate(date.getDate() + d);
            // Store as UTC midnight to avoid timezone drift
            const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            // Skip Sundays
            if (date.getDay() === 0) continue;
            for (const time of defaultSlots) {
                await prisma.timeSlot.create({
                    data: { doctorId: createdDoctors[i].id, date: utcDate, time, room: rooms[i] },
                });
            }
        }
    }
    console.log('✅ Time slots seeded (next 14 days) for first 3 doctors');

    console.log('🎉 Seeding complete!');
}

main()
    .catch((e) => {
        console.error('Seeding error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
