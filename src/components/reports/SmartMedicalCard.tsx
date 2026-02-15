"use client";

import { useEffect, useState } from "react";
import { QrCode, AlertTriangle, CheckCircle } from "lucide-react";
import { Patient } from "@/lib/data";

interface ReportData {
    prescription?: string;
    prediction?: string;
    probability?: number;
    confidence?: number;
    sessionAverages?: {
        heart_rate: number;
        body_temp: number;
        speech_noise_db: number;
        movement_level: number;
        ecg_variability: number;
        facial_stress_score: number;
        age: number;
        gender: string;
        province: string;
    };
    recordedTemp?: number;
    duration?: number;
    patientName?: string;
    patientEmail?: string;
    patientPhone?: string;
    appointmentDate?: string;
    appointmentTime?: string;
}

export function SmartMedicalCard({ prescription, patient, reportData }: { prescription?: string, patient?: Patient, reportData?: ReportData }) {
    // Use patient info from reportData (real appointment), then static patient, then fallback
    const pName = reportData?.patientName || patient?.name || "Unknown Patient";
    const pContact = reportData?.patientPhone || reportData?.patientEmail || patient?.contact || "N/A";
    const pId = patient?.id || "N/A";
    const pAge = patient?.age || reportData?.sessionAverages?.age || 12;
    const pGender = reportData?.sessionAverages?.gender || patient?.gender || "N/A";
    const pDistrict = patient?.district || reportData?.sessionAverages?.province || "N/A";

    const [doctorName, setDoctorName] = useState("Attending Physician");
    useEffect(() => {
        try {
            const u = JSON.parse(localStorage.getItem("mindguard_user") || "{}");
            if (u.name) setDoctorName(u.name);
        } catch {}
    }, []);

    const sa = reportData?.sessionAverages;
    const prediction = reportData?.prediction;
    const isNormal = prediction === "Normal";
    const prob = reportData?.probability;
    const confidence = reportData?.confidence;
    const dur = reportData?.duration || 0;
    const durationStr = `${Math.floor(dur / 60)}m ${dur % 60}s`;

    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="bg-white text-slate-900 w-full max-w-2xl mx-auto p-8 rounded-sm shadow-2xl border border-slate-200">
            {/* Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-serif font-bold uppercase tracking-wider">Medical Health Card</h1>
                    <p className="text-sm font-semibold text-slate-600">MindGuard Pediatric Monitoring System</p>
                </div>
                <div className="text-right">
                    <p className="text-xs font-mono">ID: MG-{pId}</p>
                    <p className="text-xs font-mono">DATE: {today}</p>
                </div>
            </div>

            {/* Patient Info */}
            <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                    <h3 className="text-xs font-bold uppercase text-slate-500 mb-1">Patient Name</h3>
                    <p className="text-lg font-serif">{pName}</p>
                </div>
                <div>
                    <h3 className="text-xs font-bold uppercase text-slate-500 mb-1">Age / Gender</h3>
                    <p className="text-lg font-serif">{pAge} Years / {pGender}</p>
                </div>
                <div>
                    <h3 className="text-xs font-bold uppercase text-slate-500 mb-1">District</h3>
                    <p className="text-lg font-serif">{pDistrict}</p>
                </div>
                <div>
                    <h3 className="text-xs font-bold uppercase text-slate-500 mb-1">Guardian Contact</h3>
                    <p className="text-lg font-serif">{pContact}</p>
                </div>
            </div>

            {/* ML Prediction Result */}
            {prediction && (
                <div className={`p-5 border-2 rounded-lg mb-8 ${isNormal ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-300'}`}>
                    <div className="flex items-center gap-3 mb-3">
                        {isNormal ? (
                            <CheckCircle className="h-7 w-7 text-emerald-600" />
                        ) : (
                            <AlertTriangle className="h-7 w-7 text-red-600" />
                        )}
                        <div>
                            <h3 className="font-bold text-lg">AI Assessment: <span className={isNormal ? 'text-emerald-700' : 'text-red-700'}>{prediction}</span></h3>
                            <p className="text-xs text-slate-500">Confidence: {confidence?.toFixed(1)}% • Probability: {((prob || 0) * 100).toFixed(1)}%</p>
                        </div>
                    </div>
                    <p className={`text-sm ${isNormal ? 'text-emerald-700' : 'text-red-700'}`}>
                        {isNormal
                            ? "The AI model indicates the patient's physiological and behavioral parameters are within normal ranges."
                            : "The AI model has detected parameters outside normal ranges. Further clinical evaluation is recommended."
                        }
                    </p>
                </div>
            )}

            {/* Session Observations - Real Data */}
            {sa ? (
                <div className="bg-slate-50 p-4 border border-slate-200 mb-8">
                    <h3 className="font-bold border-b border-slate-300 pb-2 mb-3">Session Data Summary (Duration: {durationStr})</h3>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Body Temperature</span>
                            <span className="font-bold font-mono">{reportData?.recordedTemp?.toFixed(1) || sa.body_temp.toFixed(1)}°C</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Avg Heart Rate</span>
                            <span className="font-bold font-mono">{sa.heart_rate.toFixed(1)} BPM</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">ECG Variability</span>
                            <span className="font-bold font-mono">{sa.ecg_variability.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Speech Noise</span>
                            <span className="font-bold font-mono">{sa.speech_noise_db.toFixed(1)} dB</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Movement Level</span>
                            <span className="font-bold font-mono">{sa.movement_level.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Facial Stress Score</span>
                            <span className="font-bold font-mono">{sa.facial_stress_score.toFixed(1)} / 14</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-slate-50 p-4 border border-slate-200 mb-8">
                    <h3 className="font-bold border-b border-slate-300 pb-2 mb-2">Automated Clinical Observations</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>No live session data available for this report.</li>
                        <li>Please start a session to generate AI-powered observations.</li>
                    </ul>
                </div>
            )}

            {/* Prescription Section */}
            {prescription && (
                <div className="bg-blue-50/50 p-4 border border-blue-100 mb-8">
                    <h3 className="font-bold border-b border-blue-200 pb-2 mb-2 text-blue-900">Doctor&apos;s Prescription & Notes</h3>
                    <p className="text-sm font-serif whitespace-pre-wrap text-slate-800">{prescription}</p>
                </div>
            )}

            {/* Footer / Authentication */}
            <div className="flex justify-between items-end mt-12 pt-4 border-t border-slate-200">
                <div>
                    <p className="text-xs text-slate-500">Authorized Medical Officer</p>
                    <div className="h-10 border-b border-dotted border-slate-400 w-48 mb-1"></div>
                    <p className="font-serif italic">Dr. {doctorName}</p>
                </div>

                <div className="flex flex-col items-center">
                    <div className="border-4 border-black p-1">
                        <QrCode className="h-16 w-16 text-black" />
                    </div>
                    <p className="text-[10px] uppercase font-bold mt-1 tracking-widest">Digitally Signed</p>
                </div>
            </div>
        </div>
    );
}
