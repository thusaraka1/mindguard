export type Patient = {
    id: string;
    name: string;
    age: number;
    gender: "Male" | "Female";
    condition: string;
    lastVisit: string;
    contact: string;
    district: string;
    upcomingAppointment?: string; // e.g., "09:00 AM"
    status?: "Completed" | "In Progress" | "Pending";
    type?: string;
};

export const patients: Patient[] = [
    {
        id: "101",
        name: "Amaya Perera",
        age: 12,
        gender: "Female",
        condition: "Anxiety",
        lastVisit: "Jan 10, 2026",
        contact: "+94 77 111 2222",
        district: "Gampaha",
        upcomingAppointment: "09:00 AM",
        status: "Completed",
        type: "Follow-up"
    },
    {
        id: "102",
        name: "Kasun Jayasuriya",
        age: 14,
        gender: "Male",
        condition: "ADHD",
        lastVisit: "Jan 12, 2026",
        contact: "+94 71 333 4444",
        district: "Kandy",
        upcomingAppointment: "10:30 AM",
        status: "In Progress",
        type: "Initial Assessment"
    },
    {
        id: "103",
        name: "Nimali De Silva",
        age: 16,
        gender: "Female",
        condition: "Depression",
        lastVisit: "Jan 18, 2026",
        contact: "+94 70 555 6666",
        district: "Colombo",
        upcomingAppointment: "11:45 AM",
        status: "Pending",
        type: "Crisis Intervention"
    },
    {
        id: "104",
        name: "Chenul Rathnayake",
        age: 11,
        gender: "Male",
        condition: "Behavioral",
        lastVisit: "Jan 20, 2026",
        contact: "+94 76 777 8888",
        district: "Galle",
        upcomingAppointment: "02:00 PM",
        status: "Pending",
        type: "Follow-up"
    },
    {
        id: "105",
        name: "Suresh Dias",
        age: 13,
        gender: "Male",
        condition: "Anxiety",
        lastVisit: "Dec 30, 2025",
        contact: "+94 72 999 0000",
        district: "Matara"
    },
];

export const getPatient = (id: string) => patients.find(p => p.id === id);

export const searchPatients = (query: string) => {
    const lowerQuery = query.toLowerCase();
    return patients.filter(p =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.condition.toLowerCase().includes(lowerQuery) ||
        p.id.includes(lowerQuery)
    );
};
