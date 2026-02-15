"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
    Activity, Heart, Brain, Shield, Star, Clock, Phone, Mail,
    MapPin, ChevronRight, Users, Award, Stethoscope, Calendar,
    X, CheckCircle, AlertCircle, Sparkles, ArrowRight, Menu,
    Pill, Microscope, Monitor, UserCheck
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

/* ─── Golden Ratio Constants ─── */
const PHI = 1.618;

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ─── Doctor Type from DB ─── */
interface DoctorData {
    id: string; name: string; specialty: string; bio: string | null;
    rating: number; experience: number; consultFee: number; available: boolean;
    availableDays?: string; availableTime?: string;
    timeSlots?: { id: string; time: string; date: string; room: string; isBooked: boolean }[];
}


/* ─── Animation Variants ─── */
import { Variants } from "framer-motion";

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 40 },
    visible: (i: number) => ({
        opacity: 1, y: 0,
        transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
    }),
};

const staggerContainer = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } },
};

/* ─── Animated Counter Hook ─── */
function useCounter(end: number, duration = 2000) {
    const [count, setCount] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: true });

    useEffect(() => {
        if (!inView) return;
        let start = 0;
        const increment = end / (duration / 16);
        const timer = setInterval(() => {
            start += increment;
            if (start >= end) { setCount(end); clearInterval(timer); }
            else setCount(Math.floor(start));
        }, 16);
        return () => clearInterval(timer);
    }, [inView, end, duration]);

    return { count, ref };
}

/* ─── Section Wrapper ─── */
function Section({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: "-80px" });
    return (
        <motion.section
            ref={ref}
            id={id}
            initial="hidden"
            animate={inView ? "visible" : "hidden"}
            variants={staggerContainer}
            className={`relative ${className}`}
        >
            {children}
        </motion.section>
    );
}

/* ─── Specialty Icons Map ─── */
function getSpecialtyIcon(specialty: string) {
    const s = specialty.toLowerCase();
    if (s.includes("psych")) return <Brain className="h-5 w-5" />;
    if (s.includes("neuro")) return <Monitor className="h-5 w-5" />;
    if (s.includes("pediatr")) return <Heart className="h-5 w-5" />;
    if (s.includes("occup")) return <UserCheck className="h-5 w-5" />;
    if (s.includes("speech")) return <Sparkles className="h-5 w-5" />;
    return <Stethoscope className="h-5 w-5" />;
}

/* ─── Star Rating ─── */
function StarRating({ rating }: { rating: number }) {
    return (
        <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
                <Star
                    key={i}
                    className={`h-3.5 w-3.5 ${i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                />
            ))}
            <span className="text-xs font-semibold text-muted-foreground ml-1">{rating.toFixed(1)}</span>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN LANDING PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
    const [doctors, setDoctors] = useState<DoctorData[]>([]);
    const [selectedDoctor, setSelectedDoctor] = useState<DoctorData | null>(null);
    const [bookingOpen, setBookingOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [bookingForm, setBookingForm] = useState({
        patientName: "", patientEmail: "", patientPhone: "", date: "", notes: "",
    });
    const [bookingStatus, setBookingStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeFilter, setActiveFilter] = useState("All");

    // Scroll Spy & Sticky Header
    const [activeSection, setActiveSection] = useState("");
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);

            // Find active section
            const sections = ["about", "services", "doctors", "contact"];
            const current = sections.find(section => {
                const el = document.getElementById(section);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    return rect.top >= 0 && rect.top <= 300; // Adjust offset as needed
                }
                return false;
            });
            // Fallback for scrolling down
            if (!current) {
                // If we are at the bottom, highlight contact
                if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 100) {
                    setActiveSection("contact");
                } else {
                    // Check which section is covering the most screen
                    let maxOverlap = 0;
                    let active = "";
                    sections.forEach(section => {
                        const el = document.getElementById(section);
                        if (el) {
                            const rect = el.getBoundingClientRect();
                            const overlap = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
                            if (overlap > maxOverlap) {
                                maxOverlap = overlap;
                                active = section;
                            }
                        }
                    });
                    if (active) setActiveSection(active);
                }
            }
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);
    const [doctorsLoading, setDoctorsLoading] = useState(true);

    // Patient login state
    const [patientLoginOpen, setPatientLoginOpen] = useState(false);
    const [patientPhone, setPatientPhone] = useState("");
    const [patientRecords, setPatientRecords] = useState<any[] | null>(null);
    const [patientName, setPatientName] = useState("");
    const [patientLoading, setPatientLoading] = useState(false);
    const [patientError, setPatientError] = useState("");
    const [allPatients, setAllPatients] = useState<any[]>([]);
    const [showPatientSelection, setShowPatientSelection] = useState(false);
    // OTP flow state
    const [otpStep, setOtpStep] = useState<"phone" | "otp" | "records">("phone");
    const [otpValue, setOtpValue] = useState("");
    const [otpSending, setOtpSending] = useState(false);
    const [otpMessage, setOtpMessage] = useState("");
    const [otpVerifying, setOtpVerifying] = useState(false);

    const resetPatientLogin = () => {
        setPatientPhone("");
        setPatientRecords(null);
        setPatientName("");
        setPatientError("");
        setAllPatients([]);
        setShowPatientSelection(false);
        setOtpStep("phone");
        setOtpValue("");
        setOtpMessage("");
    };

    // Step 1: Check if phone is registered and send OTP
    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patientPhone.trim()) return;
        setOtpSending(true);
        setPatientError("");
        setOtpMessage("");
        try {
            const res = await fetch('/api/patient/otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: patientPhone.trim() }),
            });
            const data = await res.json();
            if (data.success && data.registered) {
                setOtpStep("otp");
                setOtpMessage(data.message || "Verification code sent!");
                // For dev: auto-fill OTP if provided
                if (data.devOtp) {
                    console.log("🔐 Dev OTP:", data.devOtp);
                }
            } else {
                setPatientError(data.error || "Phone number not registered.");
            }
        } catch {
            setPatientError("Network error. Please try again.");
        } finally {
            setOtpSending(false);
        }
    };

    // Step 2: Verify OTP
    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otpValue.trim()) return;
        setOtpVerifying(true);
        setPatientError("");
        try {
            const res = await fetch('/api/patient/otp', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: patientPhone.trim(), otp: otpValue.trim() }),
            });
            const data = await res.json();
            if (data.success && data.verified) {
                // OTP verified — now fetch records
                await fetchPatientRecords();
            } else {
                setPatientError(data.error || "Invalid verification code.");
            }
        } catch {
            setPatientError("Network error. Please try again.");
        } finally {
            setOtpVerifying(false);
        }
    };

    // Step 3: Fetch records after OTP verified
    const fetchPatientRecords = async () => {
        setPatientLoading(true);
        setPatientError("");
        try {
            const res = await fetch(`/api/patient/records?phone=${encodeURIComponent(patientPhone.trim())}`);
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
                setOtpStep("records");
            } else {
                setPatientError(data.error || "No records found.");
            }
        } catch {
            setPatientError("Network error. Please try again.");
        } finally {
            setPatientLoading(false);
        }
    };

    // Resend OTP
    const handleResendOTP = async () => {
        setOtpSending(true);
        setPatientError("");
        setOtpMessage("");
        setOtpValue("");
        try {
            const res = await fetch('/api/patient/otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: patientPhone.trim() }),
            });
            const data = await res.json();
            if (data.success) {
                setOtpMessage("New verification code sent!");
                if (data.devOtp) console.log("🔐 Dev OTP:", data.devOtp);
            } else {
                setPatientError(data.error || "Failed to resend code.");
            }
        } catch {
            setPatientError("Network error.");
        } finally {
            setOtpSending(false);
        }
    };

    // Fetch doctors from DB
    useEffect(() => {
        fetch("/api/doctors", { cache: "no-store" })
            .then((r) => r.json())
            .then((data) => {
                if (data.success) setDoctors(data.doctors);
            })
            .catch(() => { })
            .finally(() => setDoctorsLoading(false));
    }, []);

    const specialties = ["All", ...Array.from(new Set(doctors.map((d) => d.specialty)))];
    const filteredDoctors = activeFilter === "All" ? doctors : doctors.filter((d) => d.specialty === activeFilter);

    const handleBooking = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDoctor) return;
        setIsSubmitting(true);
        setBookingStatus(null);
        try {
            const res = await fetch("/api/appointments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...bookingForm, doctorId: selectedDoctor.id }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setBookingStatus({
                    type: "success",
                    message: `Booking #${data.bookingNumber} confirmed with ${selectedDoctor.name}!\nTime: ${data.assignedTime} | Room: ${data.assignedRoom}\nConfirmation will be sent to ${bookingForm.patientEmail}${bookingForm.patientPhone ? ` and ${bookingForm.patientPhone}` : ''}.`
                });
                setBookingForm({ patientName: "", patientEmail: "", patientPhone: "", date: "", notes: "" });
                // Refresh doctors to update slot availability
                fetch("/api/doctors", { cache: "no-store" })
                    .then((r) => r.json())
                    .then((d) => { if (d.success) { setDoctors(d.doctors); setSelectedDoctor(d.doctors.find((doc: DoctorData) => doc.id === selectedDoctor.id) || null); } });
            } else {
                setBookingStatus({ type: "error", message: data.error || "Failed to book. Please try again." });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Derive available dates from time slots (only dates that have at least 1 unbooked slot)
    // Use UTC-safe date extraction to avoid timezone shifts
    const doctorAvailDates = Array.from(
        new Set(
            selectedDoctor?.timeSlots
                ?.filter((s) => !s.isBooked)
                .map((s) => s.date.split('T')[0])
        )
    ).sort() || [];

    // Count remaining (unbooked) slots for the selected date
    const slotsForSelectedDate = selectedDoctor?.timeSlots?.filter(
        (s) => s.date.split('T')[0] === bookingForm.date
    ) || [];
    const remainingSlots = slotsForSelectedDate.filter((s) => !s.isBooked).length;
    const totalSlots = slotsForSelectedDate.length;

    // Counter stats
    const statPatients = useCounter(12500);
    const statDoctors = useCounter(85);
    const statSpecialties = useCounter(24);
    const statSatisfaction = useCounter(98);

    return (
        <div suppressHydrationWarning className="min-h-screen bg-background text-foreground overflow-x-hidden">

            {/* ═══ NAVIGATION ═══ */}
            <nav suppressHydrationWarning className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/80 backdrop-blur-xl border-b border-border py-4 shadow-sm" : "bg-transparent py-6"}`}>
                <div suppressHydrationWarning className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                    {/* Logo & Brand */}
                    <div suppressHydrationWarning className="flex items-center gap-2.5">
                        <div suppressHydrationWarning className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-600/20">
                            <Activity className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-foreground">MindGuard</span>
                    </div>

                    {/* Desktop Nav */}
                    <div suppressHydrationWarning className="hidden md:flex items-center gap-8">
                        {["About", "Services", "Doctors", "Contact"].map((item) => {
                            const isActive = activeSection === item.toLowerCase();
                            return (
                                <a
                                    key={item}
                                    href={`#${item.toLowerCase()}`}
                                    className={`text-sm transition-colors font-medium relative group ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    {item}
                                    <span className={`absolute -bottom-1 left-0 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300 ${isActive ? "w-full" : "w-0 group-hover:w-full"}`} />
                                </a>
                            );
                        })}
                    </div>

                    <div suppressHydrationWarning className="hidden md:flex items-center gap-3">
                        {/* Auth Buttons */}
                        <button onClick={() => { setPatientLoginOpen(true); resetPatientLogin(); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium px-4 py-2">
                            Patient Login
                        </button>
                        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium px-4 py-2">
                            Doctor Login
                        </Link>
                        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium px-4 py-2">
                            Admin Login
                        </Link>
                        <Link href="/doctors" className="hidden md:flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:shadow-blue-500/40 transition-all active:scale-[0.98]">
                            <Stethoscope className="h-4 w-4" /> Book Appointment
                        </Link>
                        <ThemeToggle />
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden flex items-center gap-4">
                        <ThemeToggle />
                        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-foreground">
                            {mobileMenuOpen ? <X /> : <Menu />}
                        </button>
                    </div>
                </div>

                {/* Mobile Nav */}
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl"
                        >
                            <div className="px-6 py-4 space-y-3">
                                {["About", "Services", "Doctors", "Contact"].map((item) => (
                                    <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setMobileMenuOpen(false)} className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-2">
                                        {item}
                                    </a>
                                ))}
                                <button onClick={() => { setPatientLoginOpen(true); resetPatientLogin(); setMobileMenuOpen(false); }} className="block text-sm text-muted-foreground hover:text-foreground py-2 text-left w-full">Patient Login</button>
                                <Link href="/" className="block text-sm text-muted-foreground hover:text-foreground py-2">Doctor Login</Link>
                                <Link href="/admin" className="block text-sm text-muted-foreground hover:text-foreground py-2">Admin Login</Link>
                                <a href="#doctors" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-semibold px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-center mt-2">
                                    Channel a Doctor
                                </a>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>

            {/* ═══ HERO SECTION ═══ */}
            <section className="relative min-h-screen flex items-center pt-16">
                {/* Background effects */}
                <div suppressHydrationWarning className="absolute inset-0">
                    <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px]" />
                    <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[100px]" />
                </div>

                <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center relative z-10 text-center lg:text-left">
                    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-8">
                        <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/50 border border-border backdrop-blur-sm">
                            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-medium text-foreground">Available 24/7 for support</span>
                        </motion.div>
                        <motion.h1 variants={fadeUp} className="text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
                            Your Child's <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-cyan-400 to-teal-400">Mental Health</span> <br />
                            Matters to Us.
                        </motion.h1>
                        <motion.p variants={fadeUp} className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0">
                            Professional pediatric mental health monitoring with AI-powered insights and seamless doctor channeling. Early detection for a brighter future.
                        </motion.p>
                        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                            <a href="#doctors" className="px-8 py-4 rounded-2xl bg-foreground text-background font-semibold hover:opacity-90 transition-all flex items-center gap-2 shadow-xl shadow-blue-500/10 active:scale-95">
                                <Stethoscope className="h-5 w-5" />
                                Find a Doctor
                            </a>
                            <button onClick={() => { setPatientLoginOpen(true); resetPatientLogin(); }} className="px-8 py-4 rounded-2xl bg-accent border border-border hover:bg-accent/80 transition-all font-semibold active:scale-95 flex items-center gap-2">
                                <Activity className="h-5 w-5" />
                                Get Your Records
                            </button>
                        </motion.div>
                        <motion.div variants={fadeUp} className="flex items-center gap-8 pt-4 justify-center lg:justify-start">
                            <div className="text-left">
                                <p className="text-3xl font-bold text-foreground">12k+</p>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Happy Patients</p>
                            </div>
                            <div className="h-10 w-px bg-border" />
                            <div className="text-left">
                                <p className="text-3xl font-bold text-foreground">85+</p>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Specialists</p>
                            </div>
                            <div className="h-10 w-px bg-border" />
                            <div className="text-left">
                                <p className="text-3xl font-bold text-foreground">4.9</p>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Service Rating</p>
                            </div>
                        </motion.div>
                    </motion.div>

                    {/* Floating Cards Graphic */}
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: 0.2 }} className="relative hidden lg:block h-[600px]">
                        <motion.div animate={{ y: [0, -20, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-0">
                            {/* Card 1: Vitals */}
                            <div className="absolute top-10 right-10 w-64 bg-card/80 backdrop-blur-xl border border-border p-5 rounded-2xl shadow-2xl z-20">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
                                        <Heart className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Heart Rate</p>
                                        <p className="font-bold text-lg">72 BPM</p>
                                    </div>
                                </div>
                                <div className="h-16 flex items-end justify-between gap-1">
                                    {[40, 60, 55, 70, 65, 80, 75].map((h, i) => (
                                        <div key={i} className="w-full bg-red-500/20 rounded-t-sm" style={{ height: `${h}%` }} />
                                    ))}
                                </div>
                            </div>

                            {/* Card 2: AI Analysis */}
                            <div className="absolute bottom-20 left-10 w-72 bg-card/80 backdrop-blur-xl border border-border p-5 rounded-2xl shadow-2xl z-10">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                                        <Brain className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">AI Mood Analysis</p>
                                        <p className="font-bold text-lg">Calm & Focused</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs"><span>Stress Level</span><span>12%</span></div>
                                    <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden"><div className="h-full w-[12%] bg-emerald-400 rounded-full" /></div>
                                    <div className="flex justify-between text-xs pt-1"><span>Attention</span><span>88%</span></div>
                                    <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden"><div className="h-full w-[88%] bg-blue-400 rounded-full" /></div>
                                </div>
                            </div>

                            {/* Center Image */}
                            <div className="absolute inset-0 flex items-center justify-center -z-10">
                                <div className="w-96 h-96 relative rounded-full border border-border/50 flex items-center justify-center">
                                    <div className="absolute inset-0 rounded-full border border-blue-500/10 animate-[spin_10s_linear_infinite]" />
                                    <div className="absolute inset-4 rounded-full border border-cyan-500/10 animate-[spin_15s_linear_infinite_reverse]" />
                                    <div className="h-80 w-80 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 blur-3xl" />
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* ═══ ABOUT / STATS SECTION ═══ */}
            <Section id="about" className="py-32 px-6">
                <div className="max-w-7xl mx-auto">
                    <motion.div variants={fadeUp} custom={0} className="text-center max-w-3xl mx-auto mb-20">
                        <span className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 tracking-widest uppercase mb-4 block">About MindGuard</span>
                        <h2 className="text-4xl sm:text-5xl font-bold mb-6 tracking-tight">
                            Pioneering{" "}
                            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                                Digital Healthcare
                            </span>
                        </h2>
                        <p className="text-lg text-muted-foreground leading-relaxed">
                            MindGuard combines cutting-edge IoT sensors, AI-driven analysis, and a network of specialized doctors
                            to deliver comprehensive pediatric mental health monitoring and care. Our platform enables early detection,
                            real-time tracking, and seamless doctor channeling — all from one place.
                        </p>
                    </motion.div>

                    {/* Stats Grid */}
                    <div suppressHydrationWarning className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { value: statPatients, suffix: "+", label: "Patients Monitored", icon: <Users className="h-6 w-6" />, gradient: "from-blue-500 to-cyan-500" },
                            { value: statDoctors, suffix: "+", label: "Expert Doctors", icon: <Stethoscope className="h-6 w-6" />, gradient: "from-emerald-500 to-teal-500" },
                            { value: statSpecialties, suffix: "", label: "Medical Specialties", icon: <Award className="h-6 w-6" />, gradient: "from-amber-500 to-orange-500" },
                            { value: statSatisfaction, suffix: "%", label: "Patient Satisfaction", icon: <Heart className="h-6 w-6" />, gradient: "from-rose-500 to-pink-500" },
                        ].map((stat, i) => (
                            <motion.div
                                key={stat.label}
                                variants={fadeUp}
                                custom={i + 1}
                                className="group relative bg-card/50 backdrop-blur-sm border border-border rounded-2xl p-6 hover:bg-accent/50 hover:border-accent-foreground/10 transition-all duration-500"
                            >
                                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg mb-4`}>
                                    {stat.icon}
                                </div>
                                <p className="text-3xl sm:text-4xl font-bold tracking-tight">
                                    <span ref={stat.value.ref}>{stat.value.count.toLocaleString()}</span>
                                    <span className="text-lg">{stat.suffix}</span>
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </Section>

            {/* ═══ SERVICES SECTION ═══ */}
            <Section id="services" className="py-32 px-6">
                <div className="max-w-7xl mx-auto">
                    <motion.div variants={fadeUp} custom={0} className="text-center max-w-3xl mx-auto mb-20">
                        <span className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 tracking-widest uppercase mb-4 block">Our Services</span>
                        <h2 className="text-4xl sm:text-5xl font-bold mb-6 tracking-tight">
                            Comprehensive{" "}
                            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Care Solutions</span>
                        </h2>
                        <p className="text-lg text-muted-foreground leading-relaxed">
                            From real-time IoT monitoring to AI diagnostics and telemedicine, we provide a full spectrum of mental health services.
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            {
                                icon: <Monitor className="h-7 w-7" />, gradient: "from-blue-500 to-cyan-500",
                                title: "Real-time IoT Monitoring",
                                desc: "Continuous biometric tracking through wearable sensors — heart rate, temperature, movement, and voice intensity analyzed in real-time.",
                            },
                            {
                                icon: <Brain className="h-7 w-7" />, gradient: "from-violet-500 to-purple-500",
                                title: "AI-Powered Diagnostics",
                                desc: "Advanced machine learning models detect stress patterns, emotional states, and behavioral anomalies with clinical-grade accuracy.",
                            },
                            {
                                icon: <Stethoscope className="h-7 w-7" />, gradient: "from-emerald-500 to-teal-500",
                                title: "Doctor Channeling",
                                desc: "Book appointments with specialist psychiatrists, neurologists, and therapists through our seamless online platform.",
                            },
                            {
                                icon: <Microscope className="h-7 w-7" />, gradient: "from-amber-500 to-orange-500",
                                title: "Behavioral Analysis",
                                desc: "Facial expression analysis and movement pattern recognition to identify early signs of anxiety, depression, and developmental concerns.",
                            },
                            {
                                icon: <Pill className="h-7 w-7" />, gradient: "from-rose-500 to-pink-500",
                                title: "Treatment Plans",
                                desc: "Personalized treatment protocols generated from AI insights and reviewed by qualified healthcare professionals.",
                            },
                            {
                                icon: <Shield className="h-7 w-7" />, gradient: "from-sky-500 to-blue-500",
                                title: "Secure Health Records",
                                desc: "HIPAA-compliant storage of all patient data, session recordings, and analysis reports with end-to-end encryption.",
                            },
                        ].map((service, i) => (
                            <motion.div
                                key={service.title}
                                variants={fadeUp}
                                custom={i + 1}
                                className="group relative bg-card/30 backdrop-blur-sm border border-border rounded-2xl p-8 hover:bg-accent/30 hover:border-accent-foreground/10 transition-all duration-500 overflow-hidden"
                            >
                                {/* Hover glow */}
                                <div className={`absolute inset-0 bg-gradient-to-br ${service.gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500`} />

                                <div className={`inline-flex p-3.5 rounded-xl bg-gradient-to-br ${service.gradient} shadow-lg mb-5`}>
                                    {service.icon}
                                </div>
                                <h3 className="text-xl font-bold mb-3">{service.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{service.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </Section >

            {/* ═══ DOCTOR CHANNELING SECTION ═══ */}
            < Section id="doctors" className="py-32 px-6" >
                <div className="max-w-7xl mx-auto">
                    <motion.div variants={fadeUp} custom={0} className="text-center max-w-3xl mx-auto mb-12">
                        <span className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 tracking-widest uppercase mb-4 block">Channel a Doctor</span>
                        <h2 className="text-4xl sm:text-5xl font-bold mb-6 tracking-tight">
                            Our Expert{" "}
                            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Medical Team</span>
                        </h2>
                        <p className="text-lg text-muted-foreground leading-relaxed">
                            Choose from our network of highly qualified specialists. Book an appointment in seconds.
                        </p>
                    </motion.div>

                    {/* Filter pills */}
                    <motion.div variants={fadeUp} custom={1} className="flex flex-wrap justify-center gap-2 mb-12">
                        {specialties.map((s) => (
                            <button
                                key={s}
                                onClick={() => setActiveFilter(s)}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${activeFilter === s
                                    ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-600/20"
                                    : "bg-accent/50 text-muted-foreground hover:text-foreground hover:bg-accent border border-border"
                                    }`}
                            >
                                {s}
                            </button>
                        ))}
                    </motion.div>

                    {/* Doctor cards */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredDoctors.map((doctor, i) => (
                            <motion.div
                                key={doctor.id}
                                // variants={fadeUp} // Temporarily disabled for debugging
                                // custom={i + 2}
                                // layout
                                initial={{ opacity: 1, y: 0 }} // Force visible
                                className="group relative bg-card/30 backdrop-blur-sm border border-border rounded-2xl overflow-hidden hover:bg-accent/30 hover:border-accent-foreground/10 transition-all duration-500"
                            >
                                {/* Top gradient strip */}
                                <div className="h-1.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500" />

                                <div className="p-6">
                                    <div className="flex items-start gap-4 mb-4">
                                        {/* Avatar */}
                                        <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-border flex items-center justify-center flex-shrink-0">
                                            {getSpecialtyIcon(doctor.specialty)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-lg truncate">{doctor.name}</h3>
                                            <p className="text-sm text-cyan-600 dark:text-cyan-400 font-medium">{doctor.specialty}</p>
                                            <StarRating rating={doctor.rating} />
                                        </div>
                                    </div>

                                    <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2">{doctor.bio}</p>
                                    <div className="space-y-2 mb-5">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Clock className="h-3.5 w-3.5 text-blue-400" />
                                            <span>
                                                {doctor.timeSlots && doctor.timeSlots.length > 0 ? `${doctor.timeSlots.length} sessions available` : "No sessions available"}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">
                                                <span className="text-emerald-400 font-semibold">{doctor.experience}</span> years exp.
                                            </span>
                                            <span className="font-bold text-foreground">
                                                Rs. {doctor.consultFee?.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => { setSelectedDoctor(doctor); setBookingOpen(true); setBookingStatus(null); }}
                                        className="w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        <Calendar className="h-4 w-4" />
                                        Channel Now
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </Section >

            {/* ═══ TESTIMONIALS ═══ */}
            < Section id="testimonials" className="py-32 px-6" >
                <div className="max-w-7xl mx-auto">
                    <motion.div variants={fadeUp} custom={0} className="text-center max-w-3xl mx-auto mb-16">
                        <span className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 tracking-widest uppercase mb-4 block">Testimonials</span>
                        <h2 className="text-4xl sm:text-5xl font-bold mb-6 tracking-tight">
                            Trusted by{" "}
                            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Families</span>
                        </h2>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            {
                                name: "Malini Wickramasinghe",
                                role: "Parent",
                                quote: "MindGuard detected early signs of anxiety in my child that we completely overlooked. The doctor channeling made it so easy to get professional help immediately.",
                                rating: 5,
                            },
                            {
                                name: "Dr. Sunil Bandara",
                                role: "Pediatric Neurologist",
                                quote: "The IoT sensor data combined with AI analysis gives me unprecedented insight into my patients' conditions between appointments. A game-changer for pediatric care.",
                                rating: 5,
                            },
                            {
                                name: "Kumari Jayasena",
                                role: "Parent",
                                quote: "Being able to channel a specialist and share real-time monitoring data saved us weeks of waiting. The platform is beautifully simple to use.",
                                rating: 5,
                            },
                        ].map((testimonial, i) => (
                            <motion.div
                                key={testimonial.name}
                                variants={fadeUp}
                                custom={i + 1}
                                className="relative bg-card/30 backdrop-blur-sm border border-border rounded-2xl p-8 hover:bg-accent/30 transition-all duration-500"
                            >
                                <div className="flex items-center gap-1 mb-4">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                        <Star key={s} className={`h-4 w-4 ${s <= testimonial.rating ? "fill-amber-400 text-amber-400" : "text-muted"}`} />
                                    ))}
                                </div>
                                <p className="text-muted-foreground leading-relaxed mb-6 italic">&ldquo;{testimonial.quote}&rdquo;</p>
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm font-bold text-white">
                                        {testimonial.name.split(" ").map((n) => n[0]).join("")}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">{testimonial.name}</p>
                                        <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </Section >

            {/* ═══ CTA / CONTACT SECTION ═══ */}
            < Section id="contact" className="py-32 px-6" >
                <div className="max-w-4xl mx-auto relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-cyan-500/5 to-transparent rounded-3xl blur-3xl" />
                    <motion.div
                        variants={fadeUp}
                        custom={0}
                        className="relative bg-card/30 backdrop-blur-xl border border-border rounded-3xl p-12 sm:p-16 text-center"
                    >
                        <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-xl shadow-blue-500/20 mb-8">
                            <Sparkles className="h-8 w-8" />
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-bold mb-4 tracking-tight">
                            Ready to Take the First Step?
                        </h2>
                        <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
                            Whether you want to monitor your child&apos;s mental health or channel a specialist, MindGuard is here for you.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <a
                                href="#doctors"
                                className="inline-flex items-center justify-center gap-2 text-base font-semibold px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-xl shadow-blue-600/25 transition-all active:scale-95"
                            >
                                <Calendar className="h-5 w-5" />
                                Book an Appointment
                            </a>
                            <a
                                href="tel:+94112345678"
                                className="inline-flex items-center justify-center gap-2 text-base font-semibold px-8 py-4 rounded-2xl bg-card border border-border hover:bg-accent transition-all"
                            >
                                <Phone className="h-5 w-5" />
                                Call Us: +94 11 234 5678
                            </a>
                        </div>

                        <div className="flex flex-wrap justify-center gap-6 mt-10 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-blue-400" /> Colombo, Sri Lanka</div>
                            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-cyan-400" /> info@mindguard.lk</div>
                            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-emerald-400" /> +94 11 234 5678</div>
                        </div>
                    </motion.div>
                </div>
            </Section >

            {/* ═══ FOOTER ═══ */}
            < footer className="border-t border-border py-12 px-6" >
                <div className="max-w-7xl mx-auto">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
                        <div>
                            <div className="flex items-center gap-2.5 mb-4">
                                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                                    <Activity className="h-4 w-4 text-white" />
                                </div>
                                <span className="font-bold">MindGuard</span>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                AI-powered pediatric mental health monitoring and doctor channeling platform. SLMC approved.
                            </p>
                        </div>

                        <div>
                            <h4 className="font-semibold mb-4 text-sm">Platform</h4>
                            <ul className="space-y-2.5 text-sm text-muted-foreground">
                                <li><a href="#about" className="hover:text-foreground transition-colors">About Us</a></li>
                                <li><a href="#services" className="hover:text-foreground transition-colors">Services</a></li>
                                <li><a href="#doctors" className="hover:text-foreground transition-colors">Channel a Doctor</a></li>
                                <li><Link href="/" className="hover:text-foreground transition-colors">Doctor Portal</Link></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-semibold mb-4 text-sm">Resources</h4>
                            <ul className="space-y-2.5 text-sm text-muted-foreground">
                                <li><a href="#" className="hover:text-foreground transition-colors">Mental Health Guide</a></li>
                                <li><a href="#" className="hover:text-foreground transition-colors">FAQ</a></li>
                                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                                <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-semibold mb-4 text-sm">Contact</h4>
                            <ul className="space-y-2.5 text-sm text-muted-foreground">
                                <li className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> info@mindguard.lk</li>
                                <li className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> +94 11 234 5678</li>
                                <li className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> Colombo 07, Sri Lanka</li>
                            </ul>
                        </div>
                    </div>

                    <div className="border-t border-border pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <p className="text-xs text-muted-foreground">
                            © 2026 MindGuard. All rights reserved. SLMC Approved System v1.0.4
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Shield className="h-3.5 w-3.5 text-emerald-500" />
                            HIPAA Compliant • End-to-End Encrypted
                        </div>
                    </div>
                </div>
            </footer >

            {/* ═══ BOOKING MODAL ═══ */}
            <AnimatePresence>
                {
                    bookingOpen && selectedDoctor && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                            onClick={() => setBookingOpen(false)}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
                            >
                                {/* Modal Header */}
                                <div className="relative p-6 border-b border-border">
                                    <div className="h-1 absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500" />
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-border flex items-center justify-center">
                                                {getSpecialtyIcon(selectedDoctor.specialty)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg">{selectedDoctor.name}</h3>
                                                <p className="text-sm text-cyan-600 dark:text-cyan-400">{selectedDoctor.specialty}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setBookingOpen(false)} className="p-2 rounded-lg hover:bg-accent hover:text-foreground transition-colors">
                                            <X className="h-5 w-5 text-muted-foreground" />
                                        </button>
                                    </div>
                                </div>

                                {/* Modal Body */}
                                <form onSubmit={handleBooking} className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Full Name *</label>
                                        <input
                                            required
                                            value={bookingForm.patientName}
                                            onChange={(e) => setBookingForm({ ...bookingForm, patientName: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all text-sm"
                                            placeholder="Enter your full name"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Email *</label>
                                            <input
                                                type="email"
                                                required
                                                value={bookingForm.patientEmail}
                                                onChange={(e) => setBookingForm({ ...bookingForm, patientEmail: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all text-sm"
                                                placeholder="your@email.com"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Phone</label>
                                            <input
                                                type="tel"
                                                value={bookingForm.patientPhone}
                                                onChange={(e) => setBookingForm({ ...bookingForm, patientPhone: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all text-sm"
                                                placeholder="+94 7X XXX XXXX"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Available Date *</label>
                                        <select
                                            required
                                            value={bookingForm.date}
                                            onChange={(e) => setBookingForm({ ...bookingForm, date: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all text-sm"
                                        >
                                            <option value="" className="bg-popover text-popover-foreground">Select date</option>
                                            {doctorAvailDates.map((d: string) => {
                                                const dt = new Date(d + 'T12:00:00');
                                                const slotsLeft = selectedDoctor?.timeSlots?.filter(
                                                    (s) => !s.isBooked && s.date.split('T')[0] === d
                                                ).length || 0;
                                                return (
                                                    <option key={d} value={d} className="bg-popover text-popover-foreground">
                                                        {dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} — {slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} left
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        {doctorAvailDates.length === 0 && (
                                            <p className="text-xs text-amber-400 mt-1">No dates available yet</p>
                                        )}
                                        {bookingForm.date && (
                                            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                                <span className="text-2xl font-bold text-blue-400">{remainingSlots}</span>
                                                <span className="text-xs text-blue-300">of {totalSlots} bookings remaining for this date</span>
                                            </div>
                                        )}
                                        {bookingForm.date && remainingSlots === 0 && (
                                            <p className="text-xs text-red-400 mt-1">Fully booked — please choose another date</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Notes (optional)</label>
                                        <textarea
                                            value={bookingForm.notes}
                                            onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
                                            rows={3}
                                            className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all text-sm resize-none"
                                            placeholder="Briefly describe your concern..."
                                        />
                                    </div>

                                    {/* Fee */}
                                    <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-accent/50 border border-border">
                                        <span className="text-sm text-muted-foreground">Consultation Fee</span>
                                        <span className="text-lg font-bold text-foreground">Rs. {selectedDoctor.consultFee?.toLocaleString()}</span>
                                    </div>

                                    {/* Status message */}
                                    {bookingStatus && (
                                        <div className={`flex items-start gap-2 px-4 py-3 rounded-xl text-sm ${bookingStatus.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                                            }`}>
                                            {bookingStatus.type === "success" ? <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                                            {bookingStatus.message}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={isSubmitting || (bookingForm.date !== "" && remainingSlots === 0)}
                                        className="w-full py-3.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isSubmitting ? (
                                            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <CheckCircle className="h-4 w-4" />
                                                Confirm Appointment
                                            </>
                                        )}
                                    </button>
                                </form>
                            </motion.div>
                        </motion.div>
                    )
                }
            </AnimatePresence >

            {/* ═══ PATIENT LOGIN MODAL ═══ */}
            <AnimatePresence>
                {
                    patientLoginOpen && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                            onClick={() => setPatientLoginOpen(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
                            >
                                <div className="flex items-center justify-between p-6 border-b border-border">
                                    <div>
                                        <h2 className="text-xl font-bold text-foreground">Patient Records</h2>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {otpStep === "phone" && "Enter your phone number to verify your identity"}
                                            {otpStep === "otp" && "Enter the verification code sent to your phone"}
                                            {otpStep === "records" && "Your appointments and reports"}
                                        </p>
                                    </div>
                                    <button onClick={() => setPatientLoginOpen(false)} className="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-accent transition-colors">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="p-6">
                                    {/* Step indicator */}
                                    <div className="flex items-center gap-2 mb-6">
                                        <div className={`h-2 flex-1 rounded-full transition-colors ${otpStep === "phone" ? "bg-blue-500" : "bg-emerald-500"}`} />
                                        <div className={`h-2 flex-1 rounded-full transition-colors ${otpStep === "otp" ? "bg-blue-500" : otpStep === "records" ? "bg-emerald-500" : "bg-muted"}`} />
                                        <div className={`h-2 flex-1 rounded-full transition-colors ${otpStep === "records" ? "bg-emerald-500" : "bg-muted"}`} />
                                    </div>

                                    {/* STEP 1: Phone Number */}
                                    {otpStep === "phone" && (
                                        <form onSubmit={handleSendOTP}>
                                            <div className="relative mb-4">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <input
                                                    type="tel" value={patientPhone} onChange={e => setPatientPhone(e.target.value)}
                                                    placeholder="Enter your phone number"
                                                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
                                                    required
                                                    autoFocus
                                                />
                                            </div>
                                            <button type="submit" disabled={otpSending || !patientPhone.trim()}
                                                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2">
                                                {otpSending ? (
                                                    <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Checking...</>
                                                ) : (
                                                    <><ArrowRight className="h-4 w-4" /> Send Verification Code</>
                                                )}
                                            </button>
                                        </form>
                                    )}

                                    {/* STEP 2: OTP Verification */}
                                    {otpStep === "otp" && (
                                        <div>
                                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-4 flex items-start gap-3">
                                                <Shield className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-sm text-foreground font-medium">Verification code sent</p>
                                                    <p className="text-xs text-muted-foreground mt-1">A 6-digit code has been sent to <span className="font-bold text-foreground">{patientPhone}</span></p>
                                                    {otpMessage && <p className="text-xs text-blue-400 mt-1">{otpMessage}</p>}
                                                </div>
                                            </div>

                                            <form onSubmit={handleVerifyOTP}>
                                                <div className="mb-4">
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        maxLength={6}
                                                        value={otpValue}
                                                        onChange={e => setOtpValue(e.target.value.replace(/\D/g, ''))}
                                                        placeholder="Enter 6-digit code"
                                                        className="w-full text-center text-2xl font-mono tracking-[0.5em] py-4 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground placeholder:text-base placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
                                                        required
                                                        autoFocus
                                                    />
                                                </div>
                                                <button type="submit" disabled={otpVerifying || otpValue.length < 6}
                                                    className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2">
                                                    {otpVerifying ? (
                                                        <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying...</>
                                                    ) : (
                                                        <><CheckCircle className="h-4 w-4" /> Verify & View Records</>
                                                    )}
                                                </button>

                                                <div className="flex items-center justify-between mt-4">
                                                    <button type="button" onClick={() => { setOtpStep("phone"); setPatientError(""); setOtpValue(""); }}
                                                        className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                                                        ← Change number
                                                    </button>
                                                    <button type="button" onClick={handleResendOTP} disabled={otpSending}
                                                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50">
                                                        {otpSending ? "Sending..." : "Resend code"}
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    )}

                                    {/* STEP 3: Records */}
                                    {otpStep === "records" && (
                                        <div>
                                            {/* Patient Selection (if multiple patients under same phone) */}
                                            {showPatientSelection && (
                                                <div>
                                                    <h3 className="text-foreground font-bold mb-4">Select Profile</h3>
                                                    <div className="space-y-3">
                                                        {allPatients.map((p, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => {
                                                                    setPatientName(p.name);
                                                                    setPatientRecords(p.appointments);
                                                                    setShowPatientSelection(false);
                                                                }}
                                                                className="w-full text-left bg-accent/30 border border-border rounded-xl p-4 hover:bg-accent/50 transition-all group flex items-center justify-between"
                                                            >
                                                                <div className="flex items-center gap-4">
                                                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                                                                        {p.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-semibold text-foreground">{p.name}</p>
                                                                        <p className="text-xs text-muted-foreground">{p.appointments.length} appointment{p.appointments.length !== 1 ? 's' : ''}</p>
                                                                    </div>
                                                                </div>
                                                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Appointment List */}
                                            {patientRecords && patientRecords.length > 0 && !showPatientSelection && (
                                                <div>
                                                    <div className="flex items-center gap-3 mb-5">
                                                        {allPatients.length > 1 && (
                                                            <button
                                                                onClick={() => { setShowPatientSelection(true); setPatientRecords(null); }}
                                                                className="p-2 -ml-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                                            >
                                                                <ArrowRight className="h-4 w-4 rotate-180" />
                                                            </button>
                                                        )}
                                                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                                                            {patientName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-foreground">{patientName}</h3>
                                                            <p className="text-xs text-muted-foreground">{patientRecords.length} appointment{patientRecords.length !== 1 ? 's' : ''} found</p>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        {patientRecords.map((rec: any) => (
                                                            <div key={rec.id} className="bg-card border border-border rounded-xl p-4 hover:bg-accent/50 transition-colors">
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <div>
                                                                        <p className="font-semibold text-foreground text-sm">{rec.doctorName}</p>
                                                                        <p className="text-xs text-muted-foreground">{rec.doctorSpecialty}</p>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${rec.status === 'CONFIRMED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : rec.status === 'COMPLETED' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : rec.status === 'CANCELLED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                                                            {rec.status}
                                                                        </span>
                                                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${rec.paid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                                                            {rec.paid ? 'PAID' : 'UNPAID'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                                    <span className="flex items-center gap-1">
                                                                        <Calendar className="h-3 w-3" />
                                                                        {new Date(rec.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                    </span>
                                                                    <span className="flex items-center gap-1">
                                                                        <Clock className="h-3 w-3" />
                                                                        {rec.timeSlot}
                                                                    </span>
                                                                </div>
                                                                {rec.notes && (
                                                                    <p className="text-xs text-muted-foreground mt-2 italic">{rec.notes}</p>
                                                                )}

                                                                {/* Session Report for appointments with records */}
                                                                {rec.sessionRecord && (
                                                                    <div className="mt-3 pt-3 border-t border-border">
                                                                        <div className="flex items-center gap-2 mb-2">
                                                                            <Activity className="h-3.5 w-3.5 text-blue-400" />
                                                                            <span className="text-xs font-bold text-foreground">Session Report</span>
                                                                        </div>
                                                                        <div className="bg-accent/30 rounded-lg p-3">
                                                                            <div className="flex items-center justify-between mb-2">
                                                                                <span className="text-xs font-bold text-foreground">AI Assessment</span>
                                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rec.sessionRecord.prediction === 'Normal' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                                                                    {rec.sessionRecord.prediction}
                                                                                </span>
                                                                            </div>
                                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                                                <span>Confidence: <span className="text-foreground font-medium">{rec.sessionRecord.confidence?.toFixed(1)}%</span></span>
                                                                                <span>Probability: <span className="text-foreground font-medium">{((rec.sessionRecord.probability || 0) * 100).toFixed(1)}%</span></span>
                                                                                {rec.sessionRecord.avgHeartRate && <span>Heart Rate: <span className="text-foreground font-medium">{rec.sessionRecord.avgHeartRate.toFixed(1)} BPM</span></span>}
                                                                                {rec.sessionRecord.recordedTemp && <span>Body Temp: <span className="text-foreground font-medium">{rec.sessionRecord.recordedTemp.toFixed(1)}°C</span></span>}
                                                                                {rec.sessionRecord.avgFacialStress !== null && <span>Facial Stress: <span className="text-foreground font-medium">{rec.sessionRecord.avgFacialStress.toFixed(1)}/14</span></span>}
                                                                                {rec.sessionRecord.duration !== null && <span>Duration: <span className="text-foreground font-medium">{Math.floor((rec.sessionRecord.duration || 0) / 60)}m {(rec.sessionRecord.duration || 0) % 60}s</span></span>}
                                                                            </div>
                                                                            {rec.sessionRecord.prescription && (
                                                                                <div className="mt-2 pt-2 border-t border-border">
                                                                                    <p className="text-xs text-muted-foreground"><span className="font-bold text-foreground">Prescription:</span> {rec.sessionRecord.prescription}</p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {patientLoading && (
                                                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                                                    <div className="h-5 w-5 border-2 border-muted-foreground/30 border-t-blue-500 rounded-full animate-spin" />
                                                    <span className="text-sm">Loading records...</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Error display */}
                                    {patientError && (
                                        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-4 mt-4">
                                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                            {patientError}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    )
                }
            </AnimatePresence >
        </div >
    );
}
