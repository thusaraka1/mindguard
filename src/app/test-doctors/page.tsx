"use client";
import { useState, useEffect } from "react";

export default function TestDoctorsPage() {
    const [doctors, setDoctors] = useState<any[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/doctors")
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setDoctors(data.doctors);
                } else {
                    setError(data.error);
                }
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <div className="p-10 text-black">
            <h1 className="text-2xl font-bold mb-4">Doctors Test</h1>
            <div className="grid grid-cols-1 gap-4 mt-4">
                {doctors.map((d: any) => (
                    <div key={d.id} className="border p-4 rounded bg-white shadow">
                        <h2 className="font-bold text-lg">{d.name}</h2>
                        <p className="text-gray-600">{d.specialty}</p>
                        <div className="mt-2">
                            <h3 className="font-bold text-sm">Time Slots:</h3>
                            <pre className="text-xs bg-gray-100 p-2 overflow-auto max-h-40">
                                {JSON.stringify(d.timeSlots, null, 2)}
                            </pre>
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-10">
                <h2 className="text-xl font-bold">Raw Response</h2>
                <pre className="text-xs bg-gray-100 p-4 overflow-auto">{JSON.stringify(doctors, null, 2)}</pre>
            </div>
        </div>
    );
}
