"use client";

import { Clock, MoreHorizontal, Play, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { patients } from "@/lib/data";

// Extract appointments from the centralized patient list
const appointments = patients.filter(p => p.upcomingAppointment).map(p => ({
    id: p.id,
    name: p.name,
    time: p.upcomingAppointment,
    status: p.status || "Pending",
    type: p.type || "General Checkup"
}));

export function AppointmentList() {
    const nextPatient = appointments.find(a => a.status === "Pending");

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
                                <span className="text-sm text-slate-500 font-medium flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {nextPatient.time}</span>
                            </div>

                            <h3 className="text-3xl font-bold text-slate-800 mb-1">{nextPatient.name}</h3>
                            <p className="text-slate-500 font-medium">{nextPatient.type}</p>
                        </div>

                        <div className="flex gap-3">
                            <Link href={`/session/${nextPatient.id}`}>
                                <button className="bg-primary hover:bg-sky-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-sky-500/20 active:scale-95">
                                    <Play className="h-4 w-4 fill-current" /> Start Session
                                </button>
                            </Link>
                            <Link href={`/patients/${nextPatient.id}`}>
                                <button className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold transition-all">
                                    View Profile
                                </button>
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* List of All Appointments */}
            <div className="bg-white border border-slate-200 rounded-2xl flex-1 flex flex-col shadow-sm">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
                    <h3 className="font-bold text-slate-800">Today&apos;s Schedule</h3>
                    <button className="text-xs font-medium text-primary hover:underline flex items-center gap-1">View Calendar <ArrowRight className="h-3 w-3" /></button>
                </div>

                <div className="divide-y divide-slate-100 overflow-y-auto max-h-[400px]">
                    {appointments.map((apt) => (
                        <div key={apt.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm",
                                    apt.status === "Pending" ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500"
                                )}>
                                    {apt.name.split(" ").map(n => n[0]).join("")}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">{apt.name}</p>
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <span>{apt.time}</span>
                                        <span className="text-slate-300">•</span>
                                        <span>{apt.type}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <StatusBadge status={apt.status} />
                                <button className="p-2 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <MoreHorizontal className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
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
    }[status] || "bg-slate-50 text-slate-500";

    return (
        <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wide", styles)}>
            {status}
        </span>
    );
}
