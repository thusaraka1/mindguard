"use client";

import { useState, useEffect, useCallback } from "react";
import { Shell } from "@/components/layout/Shell";
import { StatCard } from "@/components/dashboard/StatCard";
import { AppointmentList } from "@/components/dashboard/AppointmentList";
import { Users, Activity, AlertTriangle, Clock, Search, FileText } from "lucide-react";

interface Appointment {
    id: string;
    patientName: string;
    patientEmail: string;
    patientPhone: string | null;
    date: string;
    timeSlot: string;
    status: string;
    paid: boolean;
    notes: string | null;
    createdAt: string;
}

export default function DashboardPage() {
    const [doctorId, setDoctorId] = useState<string | null>(null);
    const [doctorName, setDoctorName] = useState("Doctor");
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem("mindguard_user");
        if (stored) {
            try {
                const user = JSON.parse(stored);
                if (user.doctorId) setDoctorId(user.doctorId);
                if (user.name) setDoctorName(user.name);
            } catch { /* ignore */ }
        }
        setLoading(false);
    }, []);

    const fetchAppointments = useCallback(() => {
        if (!doctorId) return;
        fetch(`/api/doctor/patients?doctorId=${doctorId}`)
            .then(r => r.json())
            .then(data => {
                if (data.success) setAppointments(data.appointments);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [doctorId]);

    useEffect(() => {
        if (doctorId) fetchAppointments();
    }, [doctorId, fetchAppointments]);

    const todayStr = new Date().toDateString();
    const todayAppts = appointments.filter(a => new Date(a.date).toDateString() === todayStr);
    const pendingToday = todayAppts.filter(a => a.status !== "CANCELLED").length;
    const completedToday = todayAppts.filter(a => a.status === "COMPLETED").length;
    const totalPatients = new Set(appointments.map(a => a.patientEmail)).size;
    const remaining = pendingToday - completedToday;

    return (
        <Shell>
            <div className="flex flex-col gap-6 h-full">
                <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Observer Dashboard</h1>
                        <p className="text-slate-500">Overview of patient activity and pending sessions.</p>
                    </div>

                    {/* Quick Patient Lookup */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Lookup past patient ID/Name..."
                            className="bg-white border border-slate-200 rounded-lg py-3 pl-10 pr-4 text-sm w-full md:w-80 shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-400"
                        />
                    </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        label="Total Patients"
                        value={String(totalPatients)}
                        icon={Users}
                        trend={`${appointments.length} appointments`}
                        trendUp={true}
                    />
                    <StatCard
                        label="Today's Sessions"
                        value={String(pendingToday)}
                        icon={Clock}
                        trend={remaining > 0 ? `${remaining} Remaining` : "All done"}
                        trendUp={true}
                        color="secondary"
                    />
                    <StatCard
                        label="Anxiety Alerts"
                        value="0"
                        icon={AlertTriangle}
                        color="destructive"
                        trend="—"
                        trendUp={true}
                    />
                    <StatCard
                        label="System Health"
                        value="98%"
                        icon={Activity}
                        color="success"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4 flex-1">
                    {/* Main Content: Appointment List */}
                    <div className="lg:col-span-2">
                        <AppointmentList appointments={appointments} loading={loading} />
                    </div>

                    {/* Side Panel: Recent Activity / Quick Links */}
                    <div className="flex flex-col gap-6">
                        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                Recent Reports
                            </h3>
                            <div className="space-y-3">
                                {appointments.length > 0 ? appointments.slice(0, 3).map((a, i) => (
                                    <div key={a.id} className="flex gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-slate-100 group">
                                        <div className="h-10 w-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 group-hover:bg-white group-hover:shadow-sm transition-all">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700 group-hover:text-primary transition-colors">Session Report #{i + 1}</p>
                                            <p className="text-xs text-slate-400">{a.patientName} &bull; Dr. {doctorName}</p>
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-sm text-slate-400">No reports yet.</p>
                                )}
                            </div>
                            <button className="w-full mt-4 py-2.5 text-xs font-bold text-center text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors uppercase tracking-wide">View All Reports</button>
                        </div>

                        {/* System Status Mini Widget */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-400 text-xs font-mono space-y-2 shadow-lg">
                            <div className="flex justify-between">
                                <span>SERVER</span>
                                <span className="text-emerald-400 font-bold">ONLINE</span>
                            </div>
                            <div className="flex justify-between">
                                <span>DATABASE</span>
                                <span className="text-emerald-400 font-bold">CONNECTED</span>
                            </div>
                            <div className="flex justify-between">
                                <span>AI ENGINE</span>
                                <span className="text-emerald-400 font-bold">READY</span>
                            </div>
                            <div className="pt-3 border-t border-slate-800 mt-2 text-center text-[10px] text-slate-500">
                                MINDGUARD SYSTEM v1.0.4
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Shell>
    );
}
