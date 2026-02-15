"use client";

import { use, useEffect, useState, useRef, useCallback } from 'react';
import { Shell } from "@/components/layout/Shell";
import { PatientLiveMonitor } from "@/components/dashboard/PatientLiveMonitor";
import { ArrowLeft, StopCircle, FileText, Activity, Thermometer, Circle, Loader2, User, MapPin, Usb, Wifi, Check, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type SessionPhase = "temp-record" | "session" | "ending";

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const searchParams = useSearchParams();
    const router = useRouter();
    const [duration, setDuration] = useState(0);
    const [phase, setPhase] = useState<SessionPhase>("temp-record");

    // Temperature recording state
    const [liveTemp, setLiveTemp] = useState<number>(0);
    const [recordedTemp, setRecordedTemp] = useState<number | null>(null);

    // Patient demographics (doctor enters at session start)
    const [patientAge, setPatientAge] = useState<string>("");
    const [patientGender, setPatientGender] = useState<string>("");
    const [patientProvince, setPatientProvince] = useState<string>("");

    // Port selection state
    const [ports, setPorts] = useState<{ device: string; description: string; likely_esp32: boolean }[]>([]);
    const [selectedPort, setSelectedPort] = useState<string>("");
    const [portStatus, setPortStatus] = useState<string>("loading");
    const [portConnected, setPortConnected] = useState(false);
    const [portError, setPortError] = useState<string>("");
    const [portConnecting, setPortConnecting] = useState(false);
    const [portsLoading, setPortsLoading] = useState(true);

    // Patient info from URL params (passed from doctor-portal)
    const patientName = searchParams.get("name") || "Unknown Patient";
    const patientEmail = searchParams.get("email") || "";
    const patientPhone = searchParams.get("phone") || "";
    const appointmentDate = searchParams.get("date") || "";
    const appointmentTime = searchParams.get("time") || "";

    // Session data collection
    const sessionDataRef = useRef<{
        heartRates: number[];
        speechNoise: number[];
        movementLevels: number[];
        ecgVariability: number[];
        facialStress: number[];
    }>({
        heartRates: [],
        speechNoise: [],
        movementLevels: [],
        ecgVariability: [],
        facialStress: [],
    });

    // End session state
    const [showModal, setShowModal] = useState(false);
    const [prescription, setPrescription] = useState("");
    const [predicting, setPredicting] = useState(false);

    // Poll live temperature from backend during temp-record phase
    useEffect(() => {
        if (phase !== "temp-record") return;
        const interval = setInterval(async () => {
            try {
                const res = await fetch('http://localhost:5000/api/state');
                if (res.ok) {
                    const s = await res.json();
                    if (s.body_temp !== undefined) setLiveTemp(s.body_temp);
                }
            } catch { /* server not ready */ }
        }, 500);
        return () => clearInterval(interval);
    }, [phase]);

    // Fetch available COM ports on mount
    const fetchPorts = useCallback(async () => {
        setPortsLoading(true);
        try {
            const res = await fetch('http://localhost:5000/api/ports');
            if (res.ok) {
                const data = await res.json();
                setPorts(data.ports || []);
                setPortStatus(data.serial_status || "Disconnected");
                setPortConnected(data.connected || false);
                if (data.current && data.current !== "null") {
                    setSelectedPort(data.current);
                }
            }
        } catch {
            setPortStatus("Backend offline");
        } finally {
            setPortsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPorts();
    }, [fetchPorts]);

    const handleSelectPort = async (port: string) => {
        setPortConnecting(true);
        setPortError("");
        setPortConnected(false);
        setLiveTemp(0);
        try {
            const res = await fetch('http://localhost:5000/api/ports/select', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ port }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setSelectedPort(data.port);
                setPortStatus(data.status);
                setPortConnected(data.connected || false);
                setPortError("");
            } else {
                setPortError(data.error || "Failed to connect to port");
                setPortStatus(data.error || "Connection failed");
                setPortConnected(false);
            }
        } catch {
            setPortError("Backend offline — cannot connect");
            setPortStatus("Backend offline");
            setPortConnected(false);
        } finally {
            setPortConnecting(false);
        }
    };

    // Timer for session phase
    useEffect(() => {
        if (phase !== "session") return;
        const timer = setInterval(() => setDuration(d => d + 1), 1000);
        return () => clearInterval(timer);
    }, [phase]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleRecordTemp = () => {
        setRecordedTemp(liveTemp);
    };

    const handleStartSession = () => {
        if (recordedTemp === null || !patientAge || !patientGender || !patientProvince || !portConnected) return;
        setPhase("session");
    };

    // Callback to collect data from PatientLiveMonitor
    const handleDataUpdate = useCallback((data: {
        heartRate: number;
        speechNoise: number;
        movementLevel: number;
        facialStress: number;
    }) => {
        const ref = sessionDataRef.current;
        if (data.heartRate > 0) ref.heartRates.push(data.heartRate);
        if (data.speechNoise > 0) ref.speechNoise.push(data.speechNoise);
        ref.movementLevels.push(data.movementLevel);
        ref.facialStress.push(data.facialStress);
        // Derive ECG variability from heart rate
        const hrv = Math.max(0, 120 - data.heartRate);
        ref.ecgVariability.push(hrv);
    }, []);

    const handleEndSession = () => {
        setShowModal(true);
    };

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const confirmEndSession = async () => {
        setPredicting(true);
        setPhase("ending");

        try {
            const d = sessionDataRef.current;
            const sessionAverages = {
                heart_rate: Math.round(avg(d.heartRates) * 10) / 10 || 75,
                body_temp: recordedTemp || 36.5,
                speech_noise_db: Math.round(avg(d.speechNoise) * 10) / 10 || 40,
                movement_level: Math.round(avg(d.movementLevels) * 10) / 10 || 0,
                ecg_variability: Math.round(avg(d.ecgVariability) * 10) / 10 || 50,
                facial_stress_score: Math.round(avg(d.facialStress) * 10) / 10 || 0,
                age: parseInt(patientAge) || 12,
                gender: patientGender || "Female",
                province: patientProvince || "Western",
            };

            // Call ML prediction API
            let prediction = { prediction: "Unknown", probability: 0, confidence: 0, input_used: sessionAverages };
            try {
                const res = await fetch('http://localhost:5000/api/predict', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(sessionAverages),
                });
                if (res.ok) {
                    prediction = await res.json();
                }
            } catch (err) {
                console.error("ML prediction failed:", err);
            }

            // Save session results to database and mark appointment as COMPLETED
            try {
                await fetch('/api/session-results', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        appointmentId: resolvedParams.id,
                        duration,
                        recordedTemp,
                        prescription,
                        prediction: prediction.prediction,
                        probability: prediction.probability,
                        confidence: prediction.confidence,
                        sessionAverages,
                    }),
                });
            } catch (err) {
                console.error("Failed to save session results:", err);
            }

            // Navigate to report with all data including patient info
            const reportData = encodeURIComponent(JSON.stringify({
                prescription,
                prediction: prediction.prediction,
                probability: prediction.probability,
                confidence: prediction.confidence,
                sessionAverages,
                recordedTemp,
                duration,
                patientName,
                patientEmail,
                patientPhone,
                appointmentDate,
                appointmentTime,
            }));

            router.push(`/reports?id=${resolvedParams.id}&data=${reportData}`);
        } catch (err) {
            console.error("Prediction failed:", err);
            // Navigate anyway with prescription only
            const fallbackData = encodeURIComponent(JSON.stringify({
                prescription,
                patientName,
                patientEmail,
                patientPhone,
            }));
            router.push(`/reports?id=${resolvedParams.id}&data=${fallbackData}`);
        }
    };

    // ==========================================
    // PHASE 1: Temperature Recording
    // ==========================================
    if (phase === "temp-record") {
        return (
            <Shell>
                <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] gap-8">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold mb-2">Pre-Session Temperature Recording</h1>
                        <p className="text-muted-foreground">Patient: <span className="font-semibold text-foreground">{patientName}</span></p>
                        <p className="text-sm text-muted-foreground mt-1">Please measure the patient&apos;s body temperature using the MLX90614 sensor and record it before starting the session.</p>
                    </div>

                    {/* Sensor Port Selection */}
                    <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-xl min-w-[400px]">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <Usb className="h-6 w-6 text-blue-500" />
                                <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Sensor Port</span>
                            </div>
                            <button
                                onClick={fetchPorts}
                                disabled={portsLoading}
                                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                title="Refresh ports"
                            >
                                <RefreshCw className={`h-4 w-4 ${portsLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {/* Connection status */}
                        <div className={`flex items-center gap-2 mb-4 text-xs font-bold px-3 py-2 rounded-lg ${
                            portConnected 
                                ? 'bg-emerald-50 text-emerald-600' 
                                : portStatus.startsWith('Error') || portError
                                ? 'bg-red-50 text-red-500'
                                : portStatus === 'Backend offline'
                                ? 'bg-red-50 text-red-500'
                                : 'bg-amber-50 text-amber-600'
                        }`}>
                            <Wifi className="h-3.5 w-3.5" />
                            {portError || portStatus}
                        </div>

                        {/* Port options */}
                        <div className="space-y-2">
                            {ports.map((p) => (
                                <button
                                    key={p.device}
                                    onClick={() => handleSelectPort(p.device)}
                                    disabled={portConnecting}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${
                                        selectedPort === p.device
                                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                                            : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 text-slate-700'
                                    }`}
                                >
                                    <div>
                                        <p className="font-bold text-sm">{p.device}</p>
                                        <p className="text-xs text-slate-500">{p.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {p.likely_esp32 && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-600 border border-green-200">ESP32</span>
                                        )}
                                        {selectedPort === p.device && <Check className="h-4 w-4 text-blue-500" />}
                                    </div>
                                </button>
                            ))}

                        </div>

                        {portConnecting && (
                            <div className="flex items-center gap-2 mt-3 text-xs text-blue-500">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting to port...
                            </div>
                        )}

                        {ports.length === 0 && !portsLoading && portStatus !== 'Backend offline' && (
                            <p className="text-xs text-slate-400 mt-2">No COM ports detected. Please connect the ESP32 device and click refresh.</p>
                        )}
                    </div>

                    {/* Live Temperature Display */}
                    <div className="bg-white border-2 border-sky-200 rounded-3xl p-10 shadow-xl flex flex-col items-center gap-6 min-w-[400px]">
                        <div className="flex items-center gap-3">
                            <Thermometer className="h-8 w-8 text-orange-500" />
                            <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Live Body Temperature</span>
                        </div>

                        <div className="relative">
                            <span className={`text-7xl font-mono font-bold tracking-tight ${!portConnected ? 'text-slate-300' : liveTemp > 37.5 ? 'text-red-500' : liveTemp > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                                {portConnected && liveTemp > 0 ? liveTemp.toFixed(1) : "--.-"}
                            </span>
                            <span className="text-2xl text-slate-400 ml-1">°C</span>
                            {portConnected && liveTemp > 0 && (
                                <span className="absolute -top-2 -right-4 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                </span>
                            )}
                        </div>

                        {!portConnected && (
                            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full">Connect to a sensor port above to get live readings</p>
                        )}
                        {portConnected && liveTemp === 0 && (
                            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full">Waiting for sensor data...</p>
                        )}

                        {/* Record Button */}
                        <button
                            onClick={handleRecordTemp}
                            disabled={!portConnected || liveTemp === 0}
                            className="flex items-center gap-2 px-8 py-3 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-red-500/30 transition-all text-lg"
                        >
                            <Circle className="h-5 w-5 fill-current" /> Record Temperature
                        </button>

                        {/* Recorded Value */}
                        {recordedTemp !== null && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-4 text-center animate-in fade-in zoom-in-95 duration-200">
                                <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider mb-1">Recorded Temperature</p>
                                <p className="text-4xl font-mono font-bold text-emerald-700">{recordedTemp.toFixed(1)}°C</p>
                                <p className="text-xs text-emerald-500 mt-1">This value will be used in the final report</p>
                            </div>
                        )}
                    </div>

                    {/* Patient Demographics */}
                    <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-xl min-w-[400px]">
                        <div className="flex items-center gap-3 mb-6">
                            <User className="h-6 w-6 text-indigo-500" />
                            <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Patient Demographics</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Age (Years)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="120"
                                    value={patientAge}
                                    onChange={(e) => setPatientAge(e.target.value)}
                                    placeholder="e.g. 12"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-slate-800"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Gender</label>
                                <select
                                    value={patientGender}
                                    onChange={(e) => setPatientGender(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-slate-800 bg-white"
                                >
                                    <option value="">Select...</option>
                                    <option value="Female">Female</option>
                                    <option value="Male">Male</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className="block text-xs font-bold text-slate-600 mb-1">
                                <MapPin className="h-3 w-3 inline mr-1" />Province
                            </label>
                            <select
                                value={patientProvince}
                                onChange={(e) => setPatientProvince(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-slate-800 bg-white"
                            >
                                <option value="">Select province...</option>
                                <option value="Western">Western</option>
                                <option value="Central">Central</option>
                                <option value="Southern">Southern</option>
                                <option value="Northern">Northern</option>
                                <option value="Eastern">Eastern</option>
                                <option value="North Western">North Western</option>
                                <option value="Sabaragamuwa">Sabaragamuwa</option>
                                <option value="Uva">Uva</option>
                            </select>
                        </div>
                    </div>

                    {/* Start Session Button */}
                    <button
                        onClick={handleStartSession}
                        disabled={recordedTemp === null || !patientAge || !patientGender || !patientProvince || !portConnected}
                        className="flex items-center gap-3 px-10 py-4 bg-primary hover:bg-sky-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-sky-500/30 transition-all text-lg"
                    >
                        <Activity className="h-5 w-5" /> Start Live Session
                    </button>
                </div>
            </Shell>
        );
    }

    // ==========================================
    // PHASE 2: Live Session
    // ==========================================
    return (
        <Shell>
            <div className="flex flex-col min-h-[calc(100vh-140px)] gap-4 relative overflow-auto">
                {/* Session Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/doctor-portal" className="p-2 hover:bg-muted rounded-full transition-colors">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-3">
                                Live Session
                                <span className="text-xs font-mono bg-destructive text-white px-2 py-1 rounded animate-pulse">REC</span>
                            </h1>
                            <p className="text-muted-foreground text-sm">Patient: <span className="text-foreground font-medium">{patientName}</span></p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Recorded Temp Badge */}
                        <div className="flex flex-col items-end pr-4 border-r border-border">
                            <span className="text-xs text-muted-foreground">Recorded Temp</span>
                            <span className="font-mono text-lg font-bold text-orange-500">{recordedTemp?.toFixed(1)}°C</span>
                        </div>

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
                            <PatientLiveMonitor onDataUpdate={handleDataUpdate} />
                        </div>
                    </div>
                </div>

                {/* Prescription Modal Overlay */}
                {showModal && (
                    <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 rounded-xl">
                        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 transform transition-all scale-100 animate-in fade-in zoom-in-95 duration-200">
                            <h2 className="text-xl font-bold text-slate-900 mb-2">Session Complete</h2>
                            <p className="text-sm text-slate-500 mb-1">Session duration: <span className="font-bold">{formatTime(duration)}</span></p>
                            <p className="text-sm text-slate-500 mb-4">Recorded body temperature: <span className="font-bold text-orange-600">{recordedTemp?.toFixed(1)}°C</span></p>

                            <div className="mb-6">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Doctor&apos;s Prescription & Notes</label>
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
                                    disabled={predicting}
                                    className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmEndSession}
                                    disabled={predicting}
                                    className="px-6 py-2 bg-primary hover:bg-sky-600 disabled:bg-sky-300 text-white font-bold rounded-lg shadow-lg shadow-sky-500/20 transition-all flex items-center gap-2"
                                >
                                    {predicting ? (
                                        <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</>
                                    ) : (
                                        <><FileText className="h-4 w-4" /> Generate Medical Card</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Shell>
    );
}

// Map district to province for model input
function getProvince(district: string): string {
    const map: Record<string, string> = {
        "Colombo": "Western", "Gampaha": "Western", "Kalutara": "Western",
        "Kandy": "Central", "Matale": "Central", "Nuwara Eliya": "Central",
        "Galle": "Southern", "Matara": "Southern", "Hambantota": "Southern",
        "Jaffna": "Northern", "Kilinochchi": "Northern", "Mullaitivu": "Northern",
        "Batticaloa": "Eastern", "Ampara": "Eastern", "Trincomalee": "Eastern",
        "Kurunegala": "North Western", "Puttalam": "North Western",
        "Anuradhapura": "North Western", "Polonnaruwa": "North Western",
        "Ratnapura": "Sabaragamuwa", "Kegalle": "Sabaragamuwa",
        "Badulla": "Uva", "Monaragala": "Uva",
    };
    return map[district] || "Western";
}
