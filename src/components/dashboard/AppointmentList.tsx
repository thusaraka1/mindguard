"use client";

import { Clock, MoreHorizontal, Play, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

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

export function AppointmentList({ appointments, loading }: { appointments: Appointment[]; loading?: boolean }) {
    const todayStr = new Date().toDateString();
    const todayAppts = appointments
        .filter(a => new Date(a.date).toDateString() === todayStr)
        .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));

    const nextPatient = todayAppts.find(a => a.status !== "CANCELLED" && a.status !== "COMPLETED");

    if (loading) {
        return (
            <div className="flex items-center justify-center h-48">
                <div className="h-8 w-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 h-full">
            {/* Next Patient Highlight Card */}
            {nextPatient && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    {/* Decorative Accent */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-8 -mt-8"></div>

                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="bg-primary text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Up Next</span>
                                <span className="text-sm text-slate-500 font-medium flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {nextPatient.timeSlot}</span>
                            </div>

                            <h3 className="text-3xl font-bold text-slate-800 mb-1">{nextPatient.patientName}</h3>
                            <p className="text-slate-500 font-medium">{nextPatient.notes || "General Session"}</p>
                        </div>

                        <div className="flex gap-3">
                            <Link href={`/session/${nextPatient.id}?name=${encodeURIComponent(nextPatient.patientName)}&email=${encodeURIComponent(nextPatient.patientEmail)}&phone=${encodeURIComponent(nextPatient.patientPhone || "")}&date=${encodeURIComponent(nextPatient.date)}&time=${encodeURIComponent(nextPatient.timeSlot)}`}>
                                <button className="bg-primary hover:bg-sky-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-sky-500/20 active:scale-95">
                                    <Play className="h-4 w-4 fill-current" /> Start Session
                                </button>
                            </Link>
                            <button className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold transition-all">
                                View Profile
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* List of All Appointments */}
            <div className="bg-white border border-slate-200 rounded-2xl flex-1 flex flex-col shadow-sm">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
                    <h3 className="font-bold text-slate-800">Today&apos;s Schedule</h3>
                    <Link href="/doctor-portal" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">View All <ArrowRight className="h-3 w-3" /></Link>
                </div>

                <div className="divide-y divide-slate-100 overflow-y-auto max-h-[400px]">
                    {todayAppts.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">No appointments today.</div>
                    ) : todayAppts.map((apt) => {
                        const statusLabel = apt.status === "COMPLETED" ? "Completed"
                            : apt.status === "CANCELLED" ? "Cancelled"
                            : apt.status === "IN_PROGRESS" ? "In Progress"
                            : "Pending";
                        return (
                            <div key={apt.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm",
                                        statusLabel === "Pending" ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500"
                                    )}>
                                        {apt.patientName.split(" ").map(n => n[0]).join("")}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{apt.patientName}</p>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <span>{apt.timeSlot}</span>
                                            <span className="text-slate-300">&bull;</span>
                                            <span>{apt.notes || "General Session"}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <StatusBadge status={statusLabel} />
                                    <button className="p-2 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles = {
        "Completed": "bg-emerald-50 text-emerald-600 border-emerald-100",
        "In Progress": "bg-amber-50 text-amber-600 border-amber-100",
        "Pending": "bg-slate-50 text-slate-500 border-slate-100",
        "Cancelled": "bg-red-50 text-red-500 border-red-100",
    }[status] || "bg-slate-50 text-slate-500";

    return (
        <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wide", styles)}>
            {status}
        </span>
    );
}
