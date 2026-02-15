UPDATE "Appointment" SET status = 'COMPLETED' WHERE id IN (SELECT "appointmentId" FROM "SessionRecord") AND status != 'COMPLETED';
SELECT id, "patientName", status FROM "Appointment" ORDER BY date DESC;
