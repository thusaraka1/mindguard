"use client";

import { use, useEffect, useState } from 'react';
import { Shell } from "@/components/layout/Shell";
import { PatientLiveMonitor } from "@/components/dashboard/PatientLiveMonitor";
import { ArrowLeft, StopCircle, FileText, Activity } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPatient } from "@/lib/data";

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const [duration, setDuration] = useState(0);

    // Get patient details safely
    const patient = getPatient(resolvedParams.id);

    // Timer effect
    useEffect(() => {
        const timer = setInterval(() => setDuration(d => d + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const [showModal, setShowModal] = useState(false);
    const [prescription, setPrescription] = useState("");

    const handleEndSession = () => {
        setShowModal(true);
    };

    const confirmEndSession = () => {
        // Navigate to reports with prescription data AND patient ID
        router.push(`/reports?id=${resolvedParams.id}&prescription=${encodeURIComponent(prescription)}`);
    };

    if (!patient) return <div className="p-10">Patient not found</div>;

    return (
        <Shell>
            <div className="flex flex-col min-h-[calc(100vh-140px)] gap-4 relative overflow-auto">
                {/* Session Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="p-2 hover:bg-muted rounded-full transition-colors">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-3">
                                Live Session
                                <span className="text-xs font-mono bg-destructive text-white px-2 py-1 rounded animate-pulse">REC</span>
                            </h1>
                            <p className="text-muted-foreground text-sm">Patient: <span className="text-foreground font-medium">{patient.name}</span> • ID: MG-{patient.id}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end pr-4 border-r border-border">
                            <span className="text-xs text-muted-foreground">Session Duration</span>
                            <span className="font-mono text-xl font-bold">{formatTime(duration)}</span>
                        </div>

                        <button
                            onClick={handleEndSession}
                            className="bg-destructive hover:bg-destructive/90 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all"
                        >
                            <StopCircle className="h-4 w-4" /> End Session
                        </button>
                    </div>
                </div>

                {/* Live Interface */}
                <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden p-6 shadow-2xl relative">
                    {/* Background Grid Pattern */}
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>

                    <div className="flex flex-col h-full gap-6">
                        <div className="flex justify-between items-center text-sm text-muted-foreground border-b border-border/50 pb-4">
                            <div className="flex gap-4">
                                <span className="flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-500" /> Sensors Active</span>
                                <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-secondary" /> Auto-Logging</span>
                            </div>
                            <div className="font-mono text-xs text-slate-500" suppressHydrationWarning>
                                LATENCY: 24ms
                            </div>
                        </div>

                        <div className="flex-1">
                            <PatientLiveMonitor />
                        </div>
                    </div>
                </div>

                {/* Prescription Modal Overlay */}
                {showModal && (
                    <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 rounded-xl">
                        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 transform transition-all scale-100 animate-in fade-in zoom-in-95 duration-200">
                            <h2 className="text-xl font-bold text-slate-900 mb-2">Session Complete</h2>
                            <p className="text-sm text-slate-500 mb-4">Please enter your prescription and clinical notes before generating the medical card.</p>

                            <div className="mb-6">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Doctor's Prescription & Notes</label>
                                <textarea
                                    className="w-full h-32 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none text-slate-800 text-sm"
                                    placeholder="e.g. Recommended CBT therapy twice a week. Prescribed mild anxiolytic..."
                                    value={prescription}
                                    onChange={(e) => setPrescription(e.target.value)}
                                    autoFocus
                                ></textarea>
                            </div>

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmEndSession}
                                    className="px-6 py-2 bg-primary hover:bg-sky-600 text-white font-bold rounded-lg shadow-lg shadow-sky-500/20 transition-all flex items-center gap-2"
                                >
                                    <FileText className="h-4 w-4" /> Generate Medical Card
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Shell>
    );
}
