"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
    Activity, Users, Calendar, Clock, Plus, Trash2, Check,
    X, ChevronDown, ChevronRight, DollarSign, Shield, Star,
    Stethoscope, ArrowLeft, RefreshCw, CheckCircle, AlertCircle,
    Search, Edit3, Mail, Lock, Save, UserPlus, KeyRound
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

/* ─── Types ─── */
interface TimeSlotType { id: string; time: string; date: string; room: string; isBooked: boolean; }
interface DoctorType {
    id: string; name: string; specialty: string; bio: string; experience: number;
    consultFee: number; rating: number; available: boolean;
    availableDays: string; availableTime: string;
    timeSlots: TimeSlotType[];
    _count: { appointments: number }; userEmail: string | null;
}
interface AppointmentType {
    id: string; doctorId: string; patientName: string; patientEmail: string;
    patientPhone: string | null; date: string; timeSlot: string;
    status: string; paid: boolean; notes: string | null; createdAt: string;
    doctor: { name: string; specialty: string; consultFee: number };
}

/* ─── Toast ─── */
function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
    useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-[200] flex items-center gap-2 px-5 py-3 rounded-xl shadow-xl text-sm font-medium ${type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}
        >
            {type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {message}
        </motion.div>
    );
}

/* ═══════════════════════════════════════ */
/*           ADMIN PANEL PAGE             */
/* ═══════════════════════════════════════ */
export default function AdminPage() {
    const [doctors, setDoctors] = useState<DoctorType[]>([]);
    const [appointments, setAppointments] = useState<AppointmentType[]>([]);
    const [activeTab, setActiveTab] = useState<"doctors" | "appointments">("doctors");
    const [expandedDoctor, setExpandedDoctor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    // Admin auth state
    const [isAdmin, setIsAdmin] = useState(false);
    const [authChecked, setAuthChecked] = useState(false);
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");
    const [loginError, setLoginError] = useState("");
    const [loginLoading, setLoginLoading] = useState(false);

    // Check if already logged in as admin
    useEffect(() => {
        const stored = localStorage.getItem("mindguard_user");
        if (stored) {
            try {
                const user = JSON.parse(stored);
                if (user.role === "ADMIN") {
                    setIsAdmin(true);
                }
            } catch { /* ignore */ }
        }
        setAuthChecked(true);
    }, []);

    // Admin login handler
    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginLoading(true);
        setLoginError("");
        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: loginEmail, password: loginPassword }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                if (data.user.role === "ADMIN") {
                    localStorage.setItem("mindguard_user", JSON.stringify(data.user));
                    setIsAdmin(true);
                } else {
                    setLoginError("Access denied. This login is for administrators only.");
                }
            } else {
                setLoginError(data.error || "Invalid credentials. Please try again.");
            }
        } catch {
            setLoginError("Network error. Please try again.");
        } finally {
            setLoginLoading(false);
        }
    };

    // Create Doctor Modal
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [createForm, setCreateForm] = useState({
        name: "", specialty: "", bio: "", experience: "5",
        consultFee: "2500", email: "", password: "", rating: "4.5",
    });
    const [creating, setCreating] = useState(false);

    // Edit Doctor Modal
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState<{
        id: string; name: string; specialty: string; bio: string;
        experience: string; consultFee: string; rating: string; available: boolean;
    } | null>(null);
    const [saving, setSaving] = useState(false);

    // Reset Credentials Modal
    const [credModalOpen, setCredModalOpen] = useState(false);
    const [credForm, setCredForm] = useState<{ doctorId: string; doctorName: string; currentEmail: string; email: string; password: string }>(
        { doctorId: "", doctorName: "", currentEmail: "", email: "", password: "" }
    );
    const [resetting, setResetting] = useState(false);

    // Slot/Date input
    const [newSlotTime, setNewSlotTime] = useState("");
    const [newDate, setNewDate] = useState("");

    // Bulk Slot Generation State (Session)
    const [genDate, setGenDate] = useState(new Date().toISOString().split("T")[0]);
    const [genStartTime, setGenStartTime] = useState("09:00");
    const [genDuration, setGenDuration] = useState("15");
    const [genCount, setGenCount] = useState("10");
    const [genRoom, setGenRoom] = useState("Room 1");

    const handleBulkGenerate = async (doctorId: string) => {
        if (!genDate || !genStartTime || !genDuration || !genCount) {
            showToast("Please fill all fields", "error");
            return;
        }

        try {
            const res = await fetch(`/api/admin/doctors/${doctorId}/slots`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date: genDate,
                    startTime: genStartTime,
                    duration: genDuration,
                    count: genCount,
                    room: genRoom
                }),
            });
            const data = await res.json();
            if (data.success) {
                showToast(`${data.added} slots generated for ${genDate}!`);
                fetchDoctors();
            } else {
                showToast(data.error || "Failed to generate slots", "error");
            }
        } catch {
            showToast("Network error during generation", "error");
        }
    };

    const showToast = (message: string, type: "success" | "error" = "success") => setToast({ message, type });

    // ─── Fetch ───
    const fetchDoctors = async () => {
        const res = await fetch("/api/admin/doctors");
        const data = await res.json();
        if (data.success) setDoctors(data.doctors);
    };
    const fetchAppointments = async () => {
        const res = await fetch("/api/admin/appointments");
        const data = await res.json();
        if (data.success) setAppointments(data.appointments);
    };

    useEffect(() => {
        if (!isAdmin) return;
        Promise.all([fetchDoctors(), fetchAppointments()]).finally(() => setLoading(false));
    }, [isAdmin]);

    // ─── Admin Login Screen ───
    if (!authChecked) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="h-8 w-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="absolute inset-0">
                    <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px]" />
                    <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px]" />
                </div>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="relative z-10 w-full max-w-md"
                >
                    <div className="bg-card border border-border rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
                        <div className="text-center mb-8">
                            <div className="h-14 w-14 mx-auto rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25 mb-4">
                                <Shield className="h-7 w-7 text-white" />
                            </div>
                            <h1 className="text-2xl font-bold text-foreground mb-2">Admin Access</h1>
                            <p className="text-sm text-muted-foreground">Sign in with your administrator credentials</p>
                        </div>

                        <form onSubmit={handleAdminLogin} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-2">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                                        placeholder="admin@mindguard.lk"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-2">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input type="password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all"
                                    />
                                </div>
                            </div>

                            {loginError && (
                                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                    {loginError}
                                </div>
                            )}

                            <button type="submit" disabled={loginLoading}
                                className="w-full py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 shadow-lg shadow-purple-600/20 transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 text-white">
                                {loginLoading ? (
                                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Shield className="h-4 w-4" />
                                        Sign In as Admin
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <Link href="/landing" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                                ← Back to Home
                            </Link>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    // ─── Create Doctor ───
    const handleCreateDoctor = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            const res = await fetch("/api/admin/doctors", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...createForm,
                    experience: parseInt(createForm.experience) || 5,
                    consultFee: parseFloat(createForm.consultFee) || 2500,
                    rating: parseFloat(createForm.rating) || 4.5,
                }),
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Dr. ${createForm.name} created with login: ${createForm.email}`);
                setCreateForm({ name: "", specialty: "", bio: "", experience: "5", consultFee: "2500", email: "", password: "", rating: "4.5" });
                setCreateModalOpen(false);
                fetchDoctors();
            } else {
                showToast(data.error || "Failed to create doctor", "error");
            }
        } catch { showToast("Network error", "error"); }
        finally { setCreating(false); }
    };

    // ─── Edit Doctor ───
    const openEditModal = (doc: DoctorType) => {
        setEditForm({
            id: doc.id, name: doc.name, specialty: doc.specialty,
            bio: doc.bio || "", experience: String(doc.experience),
            consultFee: String(doc.consultFee), rating: String(doc.rating),
            available: doc.available,
        });
        setEditModalOpen(true);
    };

    const handleEditDoctor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editForm) return;
        setSaving(true);
        try {
            const res = await fetch("/api/admin/doctors", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: editForm.id, name: editForm.name, specialty: editForm.specialty,
                    bio: editForm.bio, experience: parseInt(editForm.experience) || 5,
                    consultFee: parseFloat(editForm.consultFee) || 2500,
                    rating: parseFloat(editForm.rating) || 4.5,
                    available: editForm.available,
                }),
            });
            const data = await res.json();
            if (data.success) { showToast("Doctor updated"); setEditModalOpen(false); fetchDoctors(); }
            else showToast(data.error || "Failed", "error");
        } catch { showToast("Network error", "error"); }
        finally { setSaving(false); }
    };

    // ─── Delete Doctor ───
    const deleteDoctor = async (id: string, name: string) => {
        if (!confirm(`Delete ${name}? This will also remove their login account and all time slots/dates.`)) return;
        const res = await fetch("/api/admin/doctors", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
        });
        const data = await res.json();
        if (data.success) { showToast(`${name} deleted`); fetchDoctors(); }
        else showToast(data.error || "Failed", "error");
    };

    // ─── Reset Credentials ───
    const openCredModal = (doc: DoctorType) => {
        setCredForm({
            doctorId: doc.id, doctorName: doc.name,
            currentEmail: doc.userEmail || "", email: doc.userEmail || "", password: "",
        });
        setCredModalOpen(true);
    };

    const handleResetCredentials = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!credForm.email && !credForm.password) {
            showToast("Enter a new email or password", "error");
            return;
        }
        setResetting(true);
        try {
            const body: Record<string, string> = {};
            if (credForm.email && credForm.email !== credForm.currentEmail) body.email = credForm.email;
            if (credForm.password) body.password = credForm.password;

            if (Object.keys(body).length === 0) {
                showToast("No changes to save", "error");
                setResetting(false);
                return;
            }

            const res = await fetch(`/api/admin/doctors/${credForm.doctorId}/credentials`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Credentials updated for ${credForm.doctorName}`);
                setCredModalOpen(false);
                fetchDoctors();
            } else {
                showToast(data.error || "Failed to reset credentials", "error");
            }
        } catch { showToast("Network error", "error"); }
        finally { setResetting(false); }
    };

    // ─── Slot Management ───
    const addSlot = async (doctorId: string) => {
        if (!newSlotTime) return;
        const res = await fetch(`/api/admin/doctors/${doctorId}/slots`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slots: [newSlotTime] }),
        });
        const data = await res.json();
        if (data.success) { showToast(`Slot ${newSlotTime} added`); setNewSlotTime(""); fetchDoctors(); }
        else showToast(data.error || "Failed", "error");
    };

    const removeSlot = async (doctorId: string, slotId: string) => {
        if (!confirm("Are you sure you want to remove this slot?")) return;
        try {
            const res = await fetch(`/api/admin/doctors/${doctorId}/slots`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slotId }),
            });
            if (res.ok) fetchDoctors();
            else showToast("Failed to remove slot", "error");
        } catch {
            showToast("Network error", "error");
        }
    };

    const removeSession = async (doctorId: string, dateISO: string, label: string) => {
        if (!confirm(`Delete ALL slots for ${label}? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/admin/doctors/${doctorId}/slots`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date: dateISO }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast(`Deleted ${data.deleted} slots for ${label}`);
                fetchDoctors();
            } else showToast(data.error || "Failed to delete session", "error");
        } catch {
            showToast("Network error", "error");
        }
    };

    // ─── Appointment Management ───
    const togglePaid = async (appointmentId: string, currentPaid: boolean) => {
        const res = await fetch("/api/admin/appointments", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: appointmentId, paid: !currentPaid }),
        });
        const data = await res.json();
        if (data.success) {
            showToast(!currentPaid ? "Marked as Paid ✓" : "Marked as Unpaid");
            fetchAppointments();
        } else showToast(data.error || "Failed", "error");
    };

    const updateStatus = async (appointmentId: string, status: string) => {
        const res = await fetch("/api/admin/appointments", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: appointmentId, status }),
        });
        const data = await res.json();
        if (data.success) { showToast(`Status → ${status}`); fetchAppointments(); }
        else showToast(data.error || "Failed", "error");
    };

    // Filter
    const filteredAppointments = appointments.filter(a =>
        a.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.patientEmail.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const stats = {
        totalDoctors: doctors.length,
        totalAppointments: appointments.length,
        paidAppointments: appointments.filter(a => a.paid).length,
        pendingPayments: appointments.filter(a => !a.paid && a.status !== "CANCELLED").length,
    };

    const inputClass = "w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all";
    const labelClass = "block text-sm font-medium text-muted-foreground mb-1.5";

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="h-8 w-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Toast */}
            <AnimatePresence>{toast && <Toast {...toast} onClose={() => setToast(null)} />}</AnimatePresence>

            {/* Header */}
            <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/landing" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                            <Shield className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold">Admin Panel</h1>
                            <p className="text-xs text-muted-foreground">MindGuard Management</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <button onClick={() => { fetchDoctors(); fetchAppointments(); showToast("Refreshed"); }} className="p-2 rounded-lg hover:bg-accent hover:text-foreground text-muted-foreground transition-colors">
                            <RefreshCw className="h-4 w-4" />
                        </button>
                        <Link href="/" onClick={() => localStorage.removeItem("mindguard_user")} className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3">
                            Logout
                        </Link>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: "Doctors", value: stats.totalDoctors, icon: <Stethoscope className="h-5 w-5" />, gradient: "from-blue-500 to-cyan-500" },
                        { label: "Total Appointments", value: stats.totalAppointments, icon: <Calendar className="h-5 w-5" />, gradient: "from-violet-500 to-purple-500" },
                        { label: "Paid", value: stats.paidAppointments, icon: <DollarSign className="h-5 w-5" />, gradient: "from-emerald-500 to-teal-500" },
                        { label: "Pending Payment", value: stats.pendingPayments, icon: <Clock className="h-5 w-5" />, gradient: "from-amber-500 to-orange-500" },
                    ].map(s => (
                        <div key={s.label} className="bg-card border border-border rounded-xl p-5">
                            <div className={`inline-flex p-2.5 rounded-lg bg-gradient-to-br ${s.gradient} shadow-lg mb-3`}>{s.icon}</div>
                            <p className="text-2xl font-bold">{s.value}</p>
                            <p className="text-xs text-muted-foreground">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Tabs + Action */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex gap-1 bg-muted rounded-xl p-1 border border-border">
                        {(["doctors", "appointments"] as const).map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={`px-5 py-2.5 rounded-lg text-sm font-medium capitalize transition-all ${activeTab === tab ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg" : "text-muted-foreground hover:text-foreground"}`}>
                                {tab === "doctors" ? <Stethoscope className="h-4 w-4 inline mr-2" /> : <Calendar className="h-4 w-4 inline mr-2" />}
                                {tab}
                            </button>
                        ))}
                    </div>
                    {activeTab === "doctors" && (
                        <button onClick={() => setCreateModalOpen(true)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-sm font-semibold shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 transition-all active:scale-[0.98]">
                            <UserPlus className="h-4 w-4" /> Add Doctor
                        </button>
                    )}
                </div>

                {/* ═══ DOCTORS TAB ═══ */}
                {activeTab === "doctors" && (
                    <div className="space-y-4">
                        {doctors.length === 0 ? (
                            <div className="text-center py-16">
                                <Stethoscope className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                                <p className="text-muted-foreground">No doctors yet</p>
                                <p className="text-xs text-muted-foreground mt-1">Click &quot;Add Doctor&quot; to create one</p>
                            </div>
                        ) : doctors.map(doctor => (
                            <div key={doctor.id} className="bg-card border border-border rounded-xl overflow-hidden">
                                {/* Doctor Header Row */}
                                <div className="flex items-center justify-between p-5">
                                    <button onClick={() => setExpandedDoctor(expandedDoctor === doctor.id ? null : doctor.id)}
                                        className="flex items-center gap-4 flex-1 text-left">
                                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-border flex items-center justify-center flex-shrink-0">
                                            <Stethoscope className="h-5 w-5 text-cyan-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-foreground">{doctor.name}</h3>
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                <span className="text-cyan-400">{doctor.specialty}</span>
                                                <span>•</span>
                                                <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {doctor.rating}</span>
                                                <span>•</span>
                                                <span>Rs. {doctor.consultFee?.toLocaleString()}</span>
                                                <span>•</span>
                                                <span>{doctor.experience}yr exp</span>
                                                <span>•</span>
                                                <span>{doctor._count.appointments} appts</span>
                                            </div>
                                            {doctor.userEmail && (
                                                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                                    <Mail className="h-3 w-3" /> {doctor.userEmail}
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                    <div className="flex items-center gap-2 ml-4">
                                        <div className="hidden sm:flex gap-2 text-xs">
                                            <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{doctor.timeSlots.length} slots</span>
                                        </div>
                                        <button onClick={() => openEditModal(doctor)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-blue-400 transition-colors" title="Edit Doctor">
                                            <Edit3 className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => openCredModal(doctor)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-amber-400 transition-colors" title="Reset Credentials">
                                            <KeyRound className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => deleteDoctor(doctor.id, doctor.name)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-red-400 transition-colors" title="Delete Doctor">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => setExpandedDoctor(expandedDoctor === doctor.id ? null : doctor.id)} className="p-2 text-muted-foreground">
                                            {expandedDoctor === doctor.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded: Slots & Dates */}
                                <AnimatePresence>
                                    {expandedDoctor === doctor.id && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                            <div className="border-t border-border p-5">
                                                {/* Session Manager (Bulk Generate) */}
                                                <div className="mb-6 p-4 bg-accent/30 rounded-xl border border-border">
                                                    <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                                                        <Calendar className="h-4 w-4 text-blue-400" /> Create Session
                                                    </h4>
                                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                                                        <div>
                                                            <label className="text-[10px] text-muted-foreground block mb-1">Date</label>
                                                            <input type="date" value={genDate} onChange={e => setGenDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className="w-full px-2 py-1.5 rounded-lg bg-input border border-border text-xs [color-scheme:dark]" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-muted-foreground block mb-1">Start Time</label>
                                                            <input type="time" value={genStartTime} onChange={e => setGenStartTime(e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-input border border-border text-xs [color-scheme:dark]" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-muted-foreground block mb-1">Duration (mins)</label>
                                                            <input type="number" value={genDuration} onChange={e => setGenDuration(e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-input border border-border text-xs" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-muted-foreground block mb-1">Count</label>
                                                            <input type="number" value={genCount} onChange={e => setGenCount(e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-input border border-border text-xs" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-muted-foreground block mb-1">Room</label>
                                                            <input type="text" value={genRoom} onChange={e => setGenRoom(e.target.value)} placeholder="e.g. Room 101" className="w-full px-2 py-1.5 rounded-lg bg-input border border-border text-xs" />
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleBulkGenerate(doctor.id)}
                                                        className="w-full py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                                                    >
                                                        <Plus className="h-3.5 w-3.5" /> Generate Session Slots
                                                    </button>
                                                </div>

                                                {/* Slots Grouped by Date */}
                                                <div>
                                                    <h4 className="text-sm font-semibold text-muted-foreground mb-3">Existing Sessions</h4>
                                                    {Object.entries(doctor.timeSlots.reduce((acc, slot) => {
                                                        const d = new Date(slot.date.split('T')[0] + 'T12:00:00');
                                                        const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" });
                                                        const key = `${dateStr} — ${slot.room}`;
                                                        if (!acc[key]) acc[key] = { slots: [] as TimeSlotType[], dateISO: slot.date };
                                                        acc[key].slots.push(slot);
                                                        return acc;
                                                    }, {} as Record<string, { slots: TimeSlotType[]; dateISO: string }>)).map(([dateRoom, { slots, dateISO }]) => (
                                                        <div key={dateRoom} className="mb-4 last:mb-0">
                                                            <div className="flex items-center justify-between mb-2 border-b border-border/50 pb-1">
                                                                <h5 className="text-xs font-medium text-cyan-400">{dateRoom}</h5>
                                                                <button
                                                                    onClick={() => removeSession(doctor.id, dateISO, dateRoom)}
                                                                    className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-0.5 rounded-md transition-colors"
                                                                    title="Delete entire session"
                                                                >
                                                                    <Trash2 className="h-3 w-3" /> Delete Session
                                                                </button>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {slots.sort((a, b) => a.time.localeCompare(b.time)).map(slot => (
                                                                    <div key={slot.id} className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm ${slot.isBooked ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-blue-500/10 border-blue-500/20 text-blue-300"}`}>
                                                                        {slot.time}
                                                                        {slot.isBooked && <span className="text-[10px] bg-red-500/20 px-1 rounded">Booked</span>}
                                                                        <button onClick={() => removeSlot(doctor.id, slot.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300" title="Remove Slot">
                                                                            <X className="h-3 w-3" />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {doctor.timeSlots.length === 0 && <p className="text-xs text-slate-500 italic text-center py-4">No sessions scheduled</p>}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                )}

                {/* ═══ APPOINTMENTS TAB ═══ */}
                {activeTab === "appointments" && (
                    <div>
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by patient name, email, or doctor..."
                                className="w-full pl-10 pr-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                        </div>

                        <div className="bg-card border border-border rounded-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border text-left">
                                            <th className="px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Patient</th>
                                            <th className="px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Doctor</th>
                                            <th className="px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date & Time</th>
                                            <th className="px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fee</th>
                                            <th className="px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                            <th className="px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAppointments.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                                                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                                    No appointments yet
                                                </td>
                                            </tr>
                                        ) : filteredAppointments.map(appt => (
                                            <tr key={appt.id} className="border-b border-border hover:bg-accent/50 transition-colors">
                                                <td className="px-5 py-4">
                                                    <p className="font-medium text-foreground">{appt.patientName}</p>
                                                    <p className="text-xs text-muted-foreground">{appt.patientEmail}</p>
                                                    {appt.patientPhone && <p className="text-xs text-muted-foreground">{appt.patientPhone}</p>}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="font-medium text-foreground">{appt.doctor.name}</p>
                                                    <p className="text-xs text-cyan-400">{appt.doctor.specialty}</p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="font-medium text-foreground">{new Date(appt.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                                                    <p className="text-xs text-muted-foreground">{appt.timeSlot}</p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="font-semibold text-emerald-400">Rs. {appt.doctor.consultFee?.toLocaleString()}</p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <select value={appt.status} onChange={e => updateStatus(appt.id, e.target.value)}
                                                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border bg-transparent cursor-pointer focus:outline-none ${appt.status === "CONFIRMED" ? "text-emerald-400 border-emerald-500/30" :
                                                            appt.status === "CANCELLED" ? "text-red-400 border-red-500/30" :
                                                                "text-amber-400 border-amber-500/30"
                                                            }`}>
                                                        <option value="PENDING" className="bg-popover text-popover-foreground">Pending</option>
                                                        <option value="CONFIRMED" className="bg-popover text-popover-foreground">Confirmed</option>
                                                        <option value="CANCELLED" className="bg-popover text-popover-foreground">Cancelled</option>
                                                    </select>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <button onClick={() => togglePaid(appt.id, appt.paid)}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${appt.paid
                                                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                                                            : "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                                                            }`}>
                                                        {appt.paid ? <Check className="h-3.5 w-3.5" /> : <DollarSign className="h-3.5 w-3.5" />}
                                                        {appt.paid ? "Paid" : "Mark Paid"}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ CREATE DOCTOR MODAL ═══ */}
            <AnimatePresence>
                {createModalOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setCreateModalOpen(false)}>
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                            <div className="relative p-6 border-b border-border">
                                <div className="h-1 absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500" />
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                                            <UserPlus className="h-5 w-5 text-white" />
                                        </div>
                                        <h3 className="font-bold text-lg text-foreground">Create New Doctor</h3>
                                    </div>
                                    <button onClick={() => setCreateModalOpen(false)} className="p-2 rounded-lg hover:bg-accent hover:text-foreground text-muted-foreground transition-colors">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={handleCreateDoctor} className="p-6 space-y-4">
                                {/* Doctor Details Section */}
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Stethoscope className="h-3.5 w-3.5" /> Doctor Details
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className={labelClass}>Full Name *</label>
                                        <input required value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} className={inputClass} placeholder="Dr. First Last" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Specialty *</label>
                                        <select required value={createForm.specialty} onChange={e => setCreateForm({ ...createForm, specialty: e.target.value })} className={inputClass}>
                                            <option value="" className="bg-popover text-popover-foreground">Select specialty</option>
                                            {["Psychiatrist", "Neurologist", "Clinical Psychologist", "Pediatrician", "Occupational Therapist", "Speech Therapist", "Counselor", "Behavioral Therapist"].map(s => (
                                                <option key={s} value={s} className="bg-popover text-popover-foreground">{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Experience (years)</label>
                                        <input type="number" min="0" max="50" value={createForm.experience} onChange={e => setCreateForm({ ...createForm, experience: e.target.value })} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Consultation Fee (Rs.)</label>
                                        <input type="number" min="0" value={createForm.consultFee} onChange={e => setCreateForm({ ...createForm, consultFee: e.target.value })} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Rating</label>
                                        <input type="number" min="1" max="5" step="0.1" value={createForm.rating} onChange={e => setCreateForm({ ...createForm, rating: e.target.value })} className={inputClass} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className={labelClass}>Bio / Description</label>
                                        <textarea value={createForm.bio} onChange={e => setCreateForm({ ...createForm, bio: e.target.value })} rows={2} className={`${inputClass} resize-none`} placeholder="Short bio about the doctor..." />
                                    </div>
                                </div>

                                {/* Login Credentials Section */}
                                <div className="pt-2 border-t border-border">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
                                        <Lock className="h-3.5 w-3.5" /> Login Credentials
                                    </p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>Email *</label>
                                            <input type="email" required value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} className={inputClass} placeholder="doctor@mindguard.lk" />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Password *</label>
                                            <input type="text" required value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} className={inputClass} placeholder="Initial password" />
                                        </div>
                                    </div>
                                </div>

                                <button type="submit" disabled={creating}
                                    className="w-full py-3.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                                    {creating ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        : <><UserPlus className="h-4 w-4" /> Create Doctor & Login Account</>}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ EDIT DOCTOR MODAL ═══ */}
            <AnimatePresence>
                {editModalOpen && editForm && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setEditModalOpen(false)}>
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
                            <div className="relative p-6 border-b border-border">
                                <div className="h-1 absolute top-0 left-0 right-0 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                                            <Edit3 className="h-5 w-5 text-white" />
                                        </div>
                                        <h3 className="font-bold text-lg text-foreground">Edit Doctor</h3>
                                    </div>
                                    <button onClick={() => setEditModalOpen(false)} className="p-2 rounded-lg hover:bg-accent hover:text-foreground text-muted-foreground transition-colors">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={handleEditDoctor} className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className={labelClass}>Full Name</label>
                                        <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Specialty</label>
                                        <select value={editForm.specialty} onChange={e => setEditForm({ ...editForm, specialty: e.target.value })} className={inputClass}>
                                            {["Psychiatrist", "Neurologist", "Clinical Psychologist", "Pediatrician", "Occupational Therapist", "Speech Therapist", "Counselor", "Behavioral Therapist"].map(s => (
                                                <option key={s} value={s} className="bg-popover text-popover-foreground">{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Experience (years)</label>
                                        <input type="number" value={editForm.experience} onChange={e => setEditForm({ ...editForm, experience: e.target.value })} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Consultation Fee (Rs.)</label>
                                        <input type="number" value={editForm.consultFee} onChange={e => setEditForm({ ...editForm, consultFee: e.target.value })} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Rating</label>
                                        <input type="number" min="1" max="5" step="0.1" value={editForm.rating} onChange={e => setEditForm({ ...editForm, rating: e.target.value })} className={inputClass} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className={labelClass}>Bio</label>
                                        <textarea value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} rows={2} className={`${inputClass} resize-none`} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <div className={`relative h-6 w-11 rounded-full transition-colors ${editForm.available ? "bg-emerald-500" : "bg-slate-700"}`}>
                                                <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${editForm.available ? "translate-x-5" : "translate-x-0.5"}`} />
                                            </div>
                                            <span className="text-sm text-muted-foreground">{editForm.available ? "Available for booking" : "Not available"}</span>
                                        </label>
                                    </div>
                                </div>

                                <button type="submit" disabled={saving}
                                    className="w-full py-3.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                                    {saving ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        : <><Save className="h-4 w-4" /> Save Changes</>}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ RESET CREDENTIALS MODAL ═══ */}
            <AnimatePresence>
                {credModalOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setCredModalOpen(false)}>
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
                            <div className="relative p-6 border-b border-border">
                                <div className="h-1 absolute top-0 left-0 right-0 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500" />
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                                            <KeyRound className="h-5 w-5 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-foreground">Reset Credentials</h3>
                                            <p className="text-xs text-muted-foreground">{credForm.doctorName}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setCredModalOpen(false)} className="p-2 rounded-lg hover:bg-accent hover:text-foreground text-muted-foreground transition-colors">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={handleResetCredentials} className="p-6 space-y-5">
                                {/* Current credentials display */}
                                <div className="px-4 py-3 rounded-xl bg-accent/30 border border-border">
                                    <p className="text-xs text-muted-foreground mb-1">Current Login Email</p>
                                    <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                        {credForm.currentEmail || "No account linked"}
                                    </p>
                                </div>

                                {/* New credentials */}
                                <div>
                                    <label className={labelClass}>
                                        <Mail className="h-3.5 w-3.5 inline mr-1.5" />
                                        New Email
                                    </label>
                                    <input type="email" value={credForm.email}
                                        onChange={e => setCredForm({ ...credForm, email: e.target.value })}
                                        className={inputClass} placeholder="new.email@mindguard.lk" />
                                    <p className="text-xs text-muted-foreground mt-1">Leave unchanged to keep current email</p>
                                </div>

                                <div>
                                    <label className={labelClass}>
                                        <Lock className="h-3.5 w-3.5 inline mr-1.5" />
                                        New Password
                                    </label>
                                    <input type="text" value={credForm.password}
                                        onChange={e => setCredForm({ ...credForm, password: e.target.value })}
                                        className={inputClass} placeholder="Enter new password" />
                                    <p className="text-xs text-muted-foreground mt-1">Leave empty to keep current password</p>
                                </div>

                                <button type="submit" disabled={resetting}
                                    className="w-full py-3.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 shadow-lg shadow-violet-600/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                                    {resetting ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        : <><KeyRound className="h-4 w-4" /> Update Credentials</>}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
