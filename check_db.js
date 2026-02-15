const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Connecting to database...');
        const doctorCount = await prisma.doctor.count();
        console.log(`Doctors: ${doctorCount}`);

        const slotCount = await prisma.timeSlot.count();
        console.log(`TimeSlots: ${slotCount}`);

        const dateCount = await prisma.availableDate.count();
        console.log(`AvailableDates: ${dateCount}`);

        console.log('Database connection successful.');
    } catch (e) {
        console.error('Database connection failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
