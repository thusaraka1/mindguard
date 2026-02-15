"use client";

import { Shell } from "@/components/layout/Shell";
import { SmartMedicalCard } from "@/components/reports/SmartMedicalCard";
import { Download, Printer } from "lucide-react";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getPatient } from "@/lib/data";

function ReportsContent() {
    const searchParams = useSearchParams();
    const patientId = searchParams.get("id");
    const fromPortal = searchParams.get("fromPortal");
    const patient = patientId ? getPatient(patientId) : undefined;

    // Parse full report data (from new session flow via URL)
    const rawData = searchParams.get("data");
    let reportDataFromUrl: any = null;
    if (rawData) {
        try { reportDataFromUrl = JSON.parse(rawData); } catch { /* fallback */ }
    }

    // If accessed from doctor-portal "View Report", load from DB
    const [dbReportData, setDbReportData] = useState<any>(null);
    const [loadingDb, setLoadingDb] = useState(false);

    useEffect(() => {
        if (fromPortal && patientId && !reportDataFromUrl) {
            setLoadingDb(true);
            fetch(`/api/session-results?appointmentId=${patientId}`)
                .then(r => r.json())
                .then(data => {
                    if (data.success && data.sessionRecord) {
                        const sr = data.sessionRecord;
                        const appt = sr.appointment;
                        setDbReportData({
                            prescription: sr.prescription,
                            prediction: sr.prediction,
                            probability: sr.probability,
                            confidence: sr.confidence,
                            sessionAverages: {
                                heart_rate: sr.avgHeartRate || 0,
                                body_temp: sr.avgBodyTemp || 0,
                                speech_noise_db: sr.avgSpeechNoise || 0,
                                movement_level: sr.avgMovement || 0,
                                ecg_variability: sr.avgEcgVariability || 0,
                                facial_stress_score: sr.avgFacialStress || 0,
                                age: sr.age || 12,
                                gender: sr.gender || "N/A",
                                province: sr.province || "N/A",
                            },
                            recordedTemp: sr.recordedTemp,
                            duration: sr.duration,
                            patientName: appt?.patientName,
                            patientEmail: appt?.patientEmail,
                            patientPhone: appt?.patientPhone,
                        });
                    }
                })
                .catch(() => {})
                .finally(() => setLoadingDb(false));
        }
    }, [fromPortal, patientId, reportDataFromUrl]);

    const reportData = reportDataFromUrl || dbReportData;
    const prescription = reportData?.prescription || searchParams.get("prescription") || undefined;

    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Patient Medical Cards</h1>
                    <p className="text-muted-foreground">View and download authenticated records.</p>
                </div>
                <div className="flex gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors text-sm font-medium">
                        <Printer className="h-4 w-4" /> Print
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors text-sm font-medium">
                        <Download className="h-4 w-4" /> Download PDF
                    </button>
                </div>
            </div>

            {/* Card Preview Area */}
            <div className="bg-muted/30 p-8 rounded-3xl border border-border flex justify-center shadow-inner">
                {loadingDb ? (
                    <p className="text-muted-foreground py-12">Loading session results…</p>
                ) : (
                    <SmartMedicalCard
                        prescription={prescription}
                        patient={patient}
                        reportData={reportData}
                    />
                )}
            </div>
        </div>
    );
}

export default function ReportsPage() {
    return (
        <Shell>
            <Suspense fallback={<div>Loading reports...</div>}>
                <ReportsContent />
            </Suspense>
        </Shell>
    );
}
