"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Shell } from "@/components/layout/Shell";
import { motion } from "framer-motion";
import Link from "next/link";
import {
    Calendar, Clock, Users, Mail, Phone, FileText,
    CheckCircle, AlertCircle, Stethoscope, DollarSign, RefreshCw,
    Search, Play, ArrowRight, Activity
} from "lucide-react";

interface AppointmentType {
    id: string; patientName: string; patientEmail: string;
    patientPhone: string | null; date: string; timeSlot: string;
    status: string; paid: boolean; notes: string | null; createdAt: string;
}

export default function DoctorPortalPage() {
    const [doctorId, setDoctorId] = useState<string | null>(null);
    const [doctorName, setDoctorName] = useState("");
    const [appointments, setAppointments] = useState<AppointmentType[]>([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<"upcoming" | "past" | "all">("all");
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const stored = localStorage.getItem("mindguard_user");
        if (stored) {
            const user = JSON.parse(stored);
            if (user.doctorId) {
                setDoctorId(user.doctorId);
                setDoctorName(user.name || "Doctor");
            }
        }
        setInitialLoading(false);
    }, []);

    const fetchAppointments = useCallback((isRefresh = false) => {
        if (!doctorId) return;
        if (isRefresh) setRefreshing(true);
        fetch(`/api/doctor/patients?doctorId=${doctorId}`)
            .then(r => r.json())
            .then(data => {
                if (data.success) setAppointments(data.appointments);
            })
            .catch(() => { })
            .finally(() => setRefreshing(false));
    }, [doctorId]);

    useEffect(() => {
        if (doctorId) fetchAppointments();
    }, [doctorId, fetchAppointments]);

    const now = new Date();
    const todayStr = now.toDateString();

    // Filter by time
    const timeFiltered = appointments.filter(a => {
        const apptDate = new Date(a.date);
        if (filter === "upcoming") return apptDate >= new Date(todayStr);
        if (filter === "past") return apptDate < new Date(todayStr);
        return true;
    });

    // Filter by search
    const filteredAppointments = timeFiltered.filter(a =>
        a.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.patientEmail.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const todayCount = appointments.filter(a => new Date(a.date).toDateString() === todayStr).length;
    const paidCount = appointments.filter(a => a.paid).length;
    const upcomingCount = appointments.filter(a => new Date(a.date) >= new Date(todayStr)).length;

    // Find next pending patient (today or upcoming)
    const nextPatient = appointments
        .filter(a => new Date(a.date) >= new Date(todayStr) && a.status !== "CANCELLED")
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

    if (initialLoading) {
        return (
            <Shell>
                <div className="flex items-center justify-center h-full">
                    <div className="h-8 w-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                </div>
            </Shell>
        );
    }

    if (!doctorId) {
        return (
            <Shell>
                <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-4">
                        <AlertCircle className="h-12 w-12 mx-auto text-amber-400" />
                        <h2 className="text-2xl font-bold text-slate-800">Not Logged In</h2>
                        <p className="text-slate-500">Please log in with your doctor account to view patients.</p>
                        <Link href="/" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary hover:bg-sky-600 text-white font-semibold text-sm mt-4">
                            Go to Login
                        </Link>
                    </div>
                </div>
            </Shell>
        );
    }

    return (
        <Shell>
            <div className="flex flex-col gap-6 h-full">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                            <Stethoscope className="h-8 w-8 text-primary" />
                            Doctor Dashboard
                        </h1>
                        <p className="text-slate-500">Welcome back, <span className="font-semibold text-slate-700">{doctorName}</span>. Here are your registered patients.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => fetchAppointments(true)} className="px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-600 flex items-center gap-2 transition-colors">
                            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
                        </button>
                        <Link href="/" onClick={() => localStorage.removeItem("mindguard_user")}
                            className="px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-sm font-medium text-slate-600 transition-colors">
                            Logout
                        </Link>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: "Total Patients", value: appointments.length, icon: Users, color: "text-primary", bgColor: "bg-primary/10" },
                        { label: "Today's Patients", value: todayCount, icon: Calendar, color: "text-emerald-600", bgColor: "bg-emerald-50" },
                        { label: "Upcoming", value: upcomingCount, icon: Clock, color: "text-violet-600", bgColor: "bg-violet-50" },
                        { label: "Paid", value: paidCount, icon: DollarSign, color: "text-amber-600", bgColor: "bg-amber-50" },
                    ].map(s => (
                        <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                            <div className={`inline-flex p-2.5 rounded-lg ${s.bgColor} mb-3`}>
                                <s.icon className={`h-5 w-5 ${s.color}`} />
                            </div>
                            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Next Patient Highlight Card */}
                {nextPatient && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-8 -mt-8"></div>
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="bg-primary text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Up Next</span>
                                    <span className="text-sm text-slate-500 font-medium flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5" /> {nextPatient.timeSlot}
                                    </span>
                                    <span className="text-sm text-slate-400">
                                        {new Date(nextPatient.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </span>
                                </div>
                                <h3 className="text-3xl font-bold text-slate-800 mb-1">{nextPatient.patientName}</h3>
                                <p className="text-slate-500 font-medium flex items-center gap-2">
                                    <Mail className="h-3.5 w-3.5" /> {nextPatient.patientEmail}
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <Link href={`/session/${nextPatient.id}?name=${encodeURIComponent(nextPatient.patientName)}&email=${encodeURIComponent(nextPatient.patientEmail)}&phone=${encodeURIComponent(nextPatient.patientPhone || '')}&date=${encodeURIComponent(nextPatient.date)}&time=${encodeURIComponent(nextPatient.timeSlot)}`}>
                                    <button className="bg-primary hover:bg-sky-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-sky-500/20 active:scale-95">
                                        <Play className="h-4 w-4 fill-current" /> Start Session
                                    </button>
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                {/* Filter + Search */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex gap-1 bg-slate-100 rounded-xl p-1 border border-slate-200">
                        {(["all", "upcoming", "past"] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-5 py-2.5 rounded-lg text-sm font-medium capitalize transition-all ${filter === f ? "bg-primary text-white shadow-md shadow-primary/30" : "text-slate-500 hover:text-slate-900"}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <div className="relative flex-1 w-full sm:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search patients..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                    </div>
                </div>

                {/* Patient List */}
                <div className="bg-white border border-slate-200 rounded-2xl flex-1 flex flex-col shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
                        <h3 className="font-bold text-slate-800">Registered Patients</h3>
                        <span className="text-xs font-medium text-slate-400">{filteredAppointments.length} patient{filteredAppointments.length !== 1 ? 's' : ''}</span>
                    </div>

                    <div className="divide-y divide-slate-100 overflow-y-auto max-h-[500px]">
                        {filteredAppointments.length === 0 ? (
                            <div className="text-center py-16">
                                <Users className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                                <p className="text-slate-500 font-medium">No patients found</p>
                                <p className="text-xs text-slate-400 mt-1">
                                    {filter === "upcoming" ? "No upcoming appointments" : filter === "past" ? "No past appointments" : "Patients who book appointments will appear here"}
                                </p>
                            </div>
                        ) : (
                            filteredAppointments.map((appt, i) => (
                                <motion.div
                                    key={appt.id}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.03 }}
                                    className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                                            {appt.patientName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{appt.patientName}</p>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <span>{new Date(appt.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                                                <span className="text-slate-300">•</span>
                                                <span>{appt.timeSlot}</span>
                                                <span className="text-slate-300">•</span>
                                                <span className="flex items-center gap-1">
                                                    <Mail className="h-3 w-3" /> {appt.patientEmail}
                                                </span>
                                            </div>
                                            {appt.notes && (
                                                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                                    <FileText className="h-3 w-3" /> {appt.notes}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {/* Status badge */}
                                        {appt.status === "COMPLETED" ? (
                                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wide bg-emerald-50 text-emerald-600 border-emerald-100 flex items-center gap-1">
                                                <CheckCircle className="h-3 w-3" /> Completed
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wide bg-sky-50 text-sky-600 border-sky-100 flex items-center gap-1">
                                                <CheckCircle className="h-3 w-3" /> Confirmed
                                            </span>
                                        )}

                                        {/* Start Session or View Report button */}
                                        {appt.status === "COMPLETED" ? (
                                            <Link href={`/reports?id=${appt.id}&fromPortal=1`}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm">
                                                <FileText className="h-3.5 w-3.5" /> View Report
                                            </Link>
                                        ) : (
                                            <Link href={`/session/${appt.id}?name=${encodeURIComponent(appt.patientName)}&email=${encodeURIComponent(appt.patientEmail)}&phone=${encodeURIComponent(appt.patientPhone || '')}&date=${encodeURIComponent(appt.date)}&time=${encodeURIComponent(appt.timeSlot)}`}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity bg-primary hover:bg-sky-600 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm">
                                                <Play className="h-3.5 w-3.5 fill-current" /> Start Session
                                            </Link>
                                        )}
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </Shell>
    );
}
