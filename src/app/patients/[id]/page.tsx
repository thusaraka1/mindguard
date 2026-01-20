"use client";

import { use } from 'react';
import { Shell } from "@/components/layout/Shell";
import { ArrowLeft, Edit, Calendar, CloudLightning } from "lucide-react";
import Link from "next/link";
import { SmartMedicalCard } from "@/components/reports/SmartMedicalCard";
import { getPatient } from '@/lib/data';

export default function PatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const patientId = resolvedParams.id;
    const patient = getPatient(patientId);

    if (!patient) {
        return (
            <Shell>
                <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">Patient Not Found</h1>
                    <Link href="/patients" className="text-primary hover:underline">Return to Registry</Link>
                </div>
            </Shell>
        );
    }

    return (
        <Shell>
            <div className="flex flex-col gap-6 max-w-5xl mx-auto">
                {/* Navigation */}
                <div className="flex items-center gap-4">
                    <Link href="/patients" className="p-2 hover:bg-muted rounded-full transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <h1 className="text-2xl font-bold">Patient Profile</h1>
                </div>

                {/* Profile Header */}
                <div className="bg-card border border-border rounded-xl p-6 flex items-start gap-6 shadow-sm">
                    <div className="h-32 w-32 rounded-xl bg-slate-800 flex items-center justify-center text-4xl font-bold text-slate-600">
                        {patient.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-3xl font-bold">{patient.name}</h2>
                                <p className="text-muted-foreground font-mono mt-1">ID: MG-{patientId}</p>
                            </div>
                            <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors text-sm font-medium">
                                <Edit className="h-4 w-4" /> Edit Details
                            </button>
                        </div>

                        <div className="grid grid-cols-4 gap-8 mt-6">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Age / Gender</p>
                                <p className="font-semibold">{patient.age} Years / {patient.gender}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">First Seen</p>
                                <p className="font-semibold">Oct 12, 2025</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Diagnosis</p>
                                <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded text-sm font-medium">{patient.condition}</span>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Sessions</p>
                                <p className="font-semibold">4 Completed</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* History Column */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-card border border-border rounded-xl p-6">
                            <h3 className="font-semibold mb-4 flex items-center gap-2">
                                <Calendar className="h-4 w-4" /> Session History
                            </h3>
                            <div className="relative border-l border-border ml-2 space-y-6">
                                {[
                                    { date: "Jan 12, 2026", status: "Follow-up", active: false },
                                    { date: "Dec 20, 2025", status: "Routine Check", active: false },
                                    { date: "Nov 15, 2025", status: "Initial Assessment", active: false },
                                ].map((s, i) => (
                                    <div key={i} className="ml-4 relative">
                                        <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-600 border border-background"></div>
                                        <p className="text-sm font-medium">{s.date}</p>
                                        <p className="text-xs text-muted-foreground">{s.status}</p>
                                        <button className="text-xs text-primary hover:underline mt-1">View Report</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Latest Report Preview */}
                    <div className="lg:col-span-2 space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <CloudLightning className="h-5 w-5 text-amber-500" /> Latest Session Analysis
                        </h3>
                        {/* Embed the Smart Card for preview */}
                        <div className="zoom-90 origin-top-left transform scale-95">
                            <SmartMedicalCard patient={patient} />
                        </div>
                    </div>
                </div>
            </div>
        </Shell>
    );
}
