"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Lock, Mail, Shield, AlertCircle, CheckCircle, ArrowRight, Activity,
    Phone, ChevronLeft, Loader2, KeyRound, Smartphone
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Detect if input is phone number ─── */
function isPhoneNumber(value: string): boolean {
    const cleaned = value.replace(/[\s\-()]/g, "");
    return /^(\+?\d{9,15}|0\d{9,10})$/.test(cleaned);
}

export default function LoginPage() {
    const router = useRouter();

    // Step management
    const [step, setStep] = useState<"identifier" | "password" | "otp">("identifier");
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [otpValue, setOtpValue] = useState("");

    // Loading / error / success states
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    // OTP-specific
    const [otpSending, setOtpSending] = useState(false);
    const [otpMessage, setOtpMessage] = useState("");

    // Patient records
    const [patientRecords, setPatientRecords] = useState<any[] | null>(null);
    const [patientName, setPatientName] = useState("");
    const [allPatients, setAllPatients] = useState<any[]>([]);
    const [showPatientSelection, setShowPatientSelection] = useState(false);

    // Computed
    const isPhone = isPhoneNumber(identifier);

    // Refs for auto-focus
    const passwordRef = useRef<HTMLInputElement>(null);
    const otpRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (step === "password" && passwordRef.current) passwordRef.current.focus();
        if (step === "otp" && otpRef.current) otpRef.current.focus();
    }, [step]);

    /* ═══ Step 1: Handle identifier submission ═══ */
    const handleIdentifierSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");

        if (!identifier.trim()) {
            setError("Please enter your email or phone number.");
            return;
        }

        if (isPhone) {
            // It's a phone number → send OTP
            setOtpSending(true);
            try {
                const res = await fetch("/api/patient/otp", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ phone: identifier.trim() }),
                });
                const data = await res.json();
                if (data.success && data.registered) {
                    setStep("otp");
                    setOtpMessage(data.message || "Verification code sent!");
                    if (data.devOtp) console.log("🔐 Dev OTP:", data.devOtp);
                } else {
                    setError(data.error || "Phone number not registered. Please book an appointment first.");
                }
            } catch {
                setError("Network error. Please try again.");
            } finally {
                setOtpSending(false);
            }
        } else {
            // It's an email → go to password step
            setStep("password");
        }
    };

    /* ═══ Step 2A: Handle password login (Admin/Doctor) ═══ */
    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: identifier.trim(), password }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                localStorage.setItem("safekitscan_user", JSON.stringify(data.user));
                setSuccessMsg(`Welcome back, ${data.user.name}!`);

                // Short delay for the success animation
                setTimeout(() => {
                    if (data.user.role === "ADMIN") {
                        router.push("/admin");
                    } else if (data.user.role === "DOCTOR") {
                        router.push("/doctor-portal");
                    } else {
                        router.push("/dashboard");
                    }
                }, 600);
            } else {
                setError(data.error || "Invalid credentials. Please try again.");
            }
        } catch {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    /* ═══ Step 2B: Handle OTP verification (Patient) ═══ */
    const handleOtpVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const res = await fetch("/api/patient/otp", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: identifier.trim(), otp: otpValue.trim() }),
            });
            const data = await res.json();

            if (data.success && data.verified) {
                setSuccessMsg("Verified! Loading your records...");
                await fetchPatientRecords();
            } else {
                setError(data.error || "Invalid verification code.");
            }
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    /* ═══ Fetch patient records ═══ */
    const fetchPatientRecords = async () => {
        try {
            const res = await fetch(`/api/patient/records?phone=${encodeURIComponent(identifier.trim())}`);
            const data = await res.json();
            if (data.success && data.patients.length > 0) {
                setAllPatients(data.patients);
                if (data.patients.length === 1) {
                    setPatientName(data.patients[0].name);
                    setPatientRecords(data.patients[0].appointments);
                    setShowPatientSelection(false);
                } else {
                    setShowPatientSelection(true);
                    setPatientName("");
                }
            } else {
                setError(data.error || "No records found.");
            }
        } catch {
            setError("Network error. Please try again.");
        }
    };

    /* ═══ Resend OTP ═══ */
    const handleResendOTP = async () => {
        setOtpSending(true);
        setError("");
        setOtpMessage("");
        setOtpValue("");
        try {
            const res = await fetch("/api/patient/otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: identifier.trim() }),
            });
            const data = await res.json();
            if (data.success) {
                setOtpMessage("New verification code sent!");
                if (data.devOtp) console.log("🔐 Dev OTP:", data.devOtp);
            } else {
                setError(data.error || "Failed to resend code.");
            }
        } catch {
            setError("Network error.");
        } finally {
            setOtpSending(false);
        }
    };

    /* ═══ Go back to Step 1 ═══ */
    const handleBack = () => {
        setStep("identifier");
        setPassword("");
        setOtpValue("");
        setError("");
        setSuccessMsg("");
        setOtpMessage("");
        setPatientRecords(null);
        setPatientName("");
        setAllPatients([]);
        setShowPatientSelection(false);
    };

    /* ═══ Animation Variants ═══ */
    const slideVariants = {
        enter: (direction: number) => ({ x: direction > 0 ? 80 : -80, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (direction: number) => ({ x: direction > 0 ? -80 : 80, opacity: 0 }),
    };

    // If patient records are loaded, show them
    if (patientRecords !== null || showPatientSelection) {
        return (
            <div className="min-h-screen w-full flex bg-slate-50 dark:bg-slate-950">
                {/* Left Branding */}
                <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 overflow-hidden text-white flex-col justify-between p-12">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-600/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-600/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="h-10 w-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center shadow-inner">
                                <Activity className="h-6 w-6 text-emerald-400" />
                            </div>
                            <span className="text-2xl font-bold tracking-tight">Safe Kit Scan</span>
                        </div>
                    </div>
                    <div className="relative z-10 max-w-md">
                        <h1 className="text-4xl font-bold leading-tight mb-6">
                            Your Health <br /> <span className="text-emerald-400">Records</span>
                        </h1>
                        <p className="text-slate-400 text-lg leading-relaxed">
                            View your appointments, session reports, and treatment history — all in one place.
                        </p>
                    </div>
                    <div className="relative z-10 text-xs text-slate-500 font-mono">v1.0.4-stable • SLMC Approved System</div>
                </div>

                {/* Right: Records */}
                <div className="w-full lg:w-1/2 flex flex-col p-8 overflow-y-auto">
                    <div className="w-full max-w-2xl mx-auto">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {showPatientSelection ? "Select Patient" : `${patientName}'s Records`}
                                </h2>
                                <p className="text-slate-500 text-sm mt-1">Phone: {identifier}</p>
                            </div>
                            <button onClick={handleBack} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 transition-colors">
                                <ChevronLeft className="h-4 w-4" /> Back to Login
                            </button>
                        </div>

                        {showPatientSelection && (
                            <div className="space-y-3 mb-6">
                                {allPatients.map((p: any, i: number) => (
                                    <button key={i} onClick={() => { setPatientName(p.name); setPatientRecords(p.appointments); setShowPatientSelection(false); }}
                                        className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 hover:shadow-md transition-all">
                                        <p className="font-bold text-slate-800 dark:text-white">{p.name}</p>
                                        <p className="text-sm text-slate-500">{p.appointments?.length || 0} appointment(s)</p>
                                    </button>
                                ))}
                            </div>
                        )}

                        {patientRecords && patientRecords.length > 0 && (
                            <div className="space-y-3">
                                {patientRecords.map((appt: any, i: number) => (
                                    <div key={appt.id || i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:shadow-md transition-shadow">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <p className="font-bold text-slate-800 dark:text-white">
                                                    {new Date(appt.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                                                </p>
                                                <p className="text-sm text-slate-500">{appt.timeSlot}</p>
                                            </div>
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${appt.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : appt.status === "CANCELLED" ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"}`}>
                                                {appt.status}
                                            </span>
                                        </div>
                                        {appt.doctor && <p className="text-sm text-slate-600 dark:text-slate-400"><span className="font-medium">Doctor:</span> {appt.doctor.name} — {appt.doctor.specialty}</p>}
                                        {appt.notes && <p className="text-xs text-slate-400 mt-2 italic">{appt.notes}</p>}
                                        {appt.report && (
                                            <Link href={`/reports?id=${appt.id}`} className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                                                View Report <ArrowRight className="h-3 w-3" />
                                            </Link>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {patientRecords && patientRecords.length === 0 && (
                            <div className="text-center py-16">
                                <AlertCircle className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                                <p className="text-slate-500 font-medium">No records found</p>
                                <p className="text-xs text-slate-400 mt-1">Your appointment records will appear here after your visit.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full flex bg-slate-50 dark:bg-slate-950">
            {/* ═══ Left Side — Branding ═══ */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 overflow-hidden text-white flex-col justify-between p-12">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="h-10 w-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center shadow-inner">
                            <Activity className="h-6 w-6 text-blue-400" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight">Safe Kit Scan</span>
                    </div>
                </div>
                <div className="relative z-10 max-w-md">
                    <h1 className="text-4xl font-bold leading-tight mb-6">
                        AI-Powered Real-Time <br /> <span className="text-blue-400">Patient Analysis</span>
                    </h1>
                    <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                        Streamline your workflow with automated clinical insights. Making doctor&apos;s work easier through intelligent monitoring.
                    </p>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/10">
                            <Shield className="h-4 w-4 text-emerald-400" />
                            <span className="text-sm font-medium">HIPAA Compliant</span>
                        </div>
                        <div className="flex items-center gap-2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/10">
                            <Activity className="h-4 w-4 text-blue-400" />
                            <span className="text-sm font-medium">Live AI Assistance</span>
                        </div>
                    </div>
                </div>
                <div className="relative z-10 text-xs text-slate-500 font-mono">v1.0.4-stable • SLMC Approved System</div>
            </div>

            {/* ═══ Right Side — Login Form ═══ */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
                <div className="w-full max-w-md space-y-8">
                    {/* Mobile logo */}
                    <div className="text-center lg:text-left">
                        <div className="lg:hidden flex justify-center mb-6">
                            <div className="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <Activity className="h-7 w-7 text-white" />
                            </div>
                        </div>

                        <AnimatePresence mode="wait">
                            {step === "identifier" && (
                                <motion.div key="id-header" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Welcome</h2>
                                    <p className="text-slate-500 mt-2">Enter your email or phone number to continue.</p>
                                </motion.div>
                            )}
                            {step === "password" && (
                                <motion.div key="pw-header" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Enter Password</h2>
                                    <p className="text-slate-500 mt-2">Sign in to your staff account.</p>
                                </motion.div>
                            )}
                            {step === "otp" && (
                                <motion.div key="otp-header" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Verify Phone</h2>
                                    <p className="text-slate-500 mt-2">Enter the code sent to <span className="font-semibold text-slate-700 dark:text-slate-300">{identifier}</span>.</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* ═══ STEP FORMS ═══ */}
                    <AnimatePresence mode="wait" custom={step === "identifier" ? -1 : 1}>
                        {step === "identifier" && (
                            <motion.form key="step-identifier" custom={1} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: "easeOut" }} onSubmit={handleIdentifierSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email or Phone Number</label>
                                    <div className="relative">
                                        {isPhone ? <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" /> : <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />}
                                        <input type="text" required autoFocus value={identifier} onChange={(e) => { setIdentifier(e.target.value); setError(""); }}
                                            className="w-full pl-10 pr-4 py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
                                            placeholder="doctor@hospital.lk or 07X XXXX XXX" />
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                        {identifier.trim() && (
                                            <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${isPhone ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20" : "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20"}`}>
                                                {isPhone ? <><Smartphone className="h-3 w-3" /> Patient — OTP will be sent</> : <><KeyRound className="h-3 w-3" /> Staff — Password required</>}
                                            </motion.span>
                                        )}
                                    </div>
                                </div>
                                {error && <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2 border border-red-200 dark:border-red-500/20"><AlertCircle className="h-4 w-4 flex-shrink-0" />{error}</div>}
                                <button type="submit" disabled={otpSending || !identifier.trim()} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                    {otpSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Continue <ArrowRight className="h-4 w-4" /></>}
                                </button>
                            </motion.form>
                        )}

                        {step === "password" && (
                            <motion.form key="step-password" custom={1} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: "easeOut" }} onSubmit={handlePasswordLogin} className="space-y-6">
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                    <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center"><Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" /></div>
                                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-800 dark:text-white truncate">{identifier}</p><p className="text-xs text-slate-500">Staff account</p></div>
                                    <button type="button" onClick={handleBack} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">Change</button>
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                                        <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-700">Forgot?</a>
                                    </div>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                        <input ref={passwordRef} type="password" required value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }}
                                            className="w-full pl-10 pr-4 py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 dark:text-white placeholder:text-slate-400" placeholder="••••••••" />
                                    </div>
                                </div>
                                {error && <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2 border border-red-200 dark:border-red-500/20"><AlertCircle className="h-4 w-4 flex-shrink-0" />{error}</div>}
                                {successMsg && <div className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2 border border-emerald-200 dark:border-emerald-500/20"><CheckCircle className="h-4 w-4 flex-shrink-0" />{successMsg}</div>}
                                <div className="flex gap-3">
                                    <button type="button" onClick={handleBack} className="px-5 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-medium"><ChevronLeft className="h-5 w-5" /></button>
                                    <button type="submit" disabled={isLoading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Sign In <ArrowRight className="h-4 w-4" /></>}
                                    </button>
                                </div>
                            </motion.form>
                        )}

                        {step === "otp" && (
                            <motion.form key="step-otp" custom={1} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: "easeOut" }} onSubmit={handleOtpVerify} className="space-y-6">
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                    <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center"><Phone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></div>
                                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-800 dark:text-white truncate">{identifier}</p><p className="text-xs text-slate-500">Patient account</p></div>
                                    <button type="button" onClick={handleBack} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">Change</button>
                                </div>
                                {otpMessage && <div className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2 border border-emerald-200 dark:border-emerald-500/20"><CheckCircle className="h-4 w-4 flex-shrink-0" />{otpMessage}</div>}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Verification Code</label>
                                    <div className="relative">
                                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                        <input ref={otpRef} type="text" required maxLength={6} value={otpValue} onChange={(e) => { setOtpValue(e.target.value.replace(/\D/g, "")); setError(""); }}
                                            className="w-full pl-10 pr-4 py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800 dark:text-white placeholder:text-slate-400 text-center text-xl tracking-[0.5em] font-mono" placeholder="000000" />
                                    </div>
                                    <div className="flex justify-end mt-2">
                                        <button type="button" onClick={handleResendOTP} disabled={otpSending} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50">{otpSending ? "Sending..." : "Resend Code"}</button>
                                    </div>
                                </div>
                                {error && <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2 border border-red-200 dark:border-red-500/20"><AlertCircle className="h-4 w-4 flex-shrink-0" />{error}</div>}
                                {successMsg && <div className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2 border border-emerald-200 dark:border-emerald-500/20"><CheckCircle className="h-4 w-4 flex-shrink-0" />{successMsg}</div>}
                                <div className="flex gap-3">
                                    <button type="button" onClick={handleBack} className="px-5 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-medium"><ChevronLeft className="h-5 w-5" /></button>
                                    <button type="submit" disabled={isLoading || otpValue.length < 6} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Verify & Continue <ArrowRight className="h-4 w-4" /></>}
                                    </button>
                                </div>
                            </motion.form>
                        )}
                    </AnimatePresence>

                    {/* Footer */}
                    <div className="pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
                        <p className="text-xs text-slate-400">
                            By signing in, you agree to our <a href="#" className="underline hover:text-slate-600 dark:hover:text-slate-300">Privacy Policy</a> and <a href="#" className="underline hover:text-slate-600 dark:hover:text-slate-300">Terms of Service</a>.
                            <br />
                            <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline font-medium no-underline">← Back to Home</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
