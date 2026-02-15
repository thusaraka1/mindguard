"use client";

import { useState, useEffect } from "react";
import { Bell, Search, LogOut, User, Settings, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function Header() {
    const router = useRouter();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [userName, setUserName] = useState("Doctor");
    const [userInitials, setUserInitials] = useState("DR");

    useEffect(() => {
        const stored = localStorage.getItem("mindguard_user");
        if (stored) {
            try {
                const user = JSON.parse(stored);
                const name = user.name || "Doctor";
                setUserName(name);
                const parts = name.replace(/^Dr\.?\s*/i, "").trim().split(" ");
                setUserInitials(parts.map((p: string) => p[0]).join("").slice(0, 2).toUpperCase() || "DR");
            } catch { /* ignore */ }
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("mindguard_user");
        router.push("/");
    };

    return (
        <header className="h-20 border-b border-border bg-white sticky top-0 z-40 px-8 flex items-center justify-between">
            <div>
                <h2 className="text-lg font-semibold text-slate-800">Welcome back, {userName}</h2>
                <p className="text-sm text-slate-500" suppressHydrationWarning>Today is {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</p>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search patient..."
                        onChange={(e) => {
                            if (e.target.value.length > 2 || e.target.value.length === 0) {
                                window.location.href = `/patients?q=${encodeURIComponent(e.target.value)}`;
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                window.location.href = `/patients?q=${encodeURIComponent((e.currentTarget as HTMLInputElement).value)}`;
                            }
                        }}
                        className="bg-slate-50 border border-slate-200 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary w-64 transition-all text-slate-700 placeholder:text-slate-400"
                    />
                </div>

                <button className="relative p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700">
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-2 right-2 h-2 w-2 bg-destructive rounded-full border-2 border-white"></span>
                </button>

                <div className="relative">
                    <button
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="flex items-center gap-2 hover:bg-slate-50 rounded-full p-1 pr-3 transition-colors border border-transparent hover:border-slate-100"
                    >
                        <div className="h-10 w-10 rounded-full border-2 border-slate-100 p-[2px] bg-white">
                            <div className="h-full w-full rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                {userInitials}
                            </div>
                        </div>
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                    </button>

                    {showUserMenu && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowUserMenu(false)}
                            ></div>
                            <div className="absolute right-0 top-14 w-56 bg-white border border-slate-100 rounded-xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2">
                                <div className="px-4 py-3 border-b border-slate-50 mb-1">
                                    <p className="text-sm font-bold text-slate-800">{userName}</p>
                                    <p className="text-xs text-slate-500">Medical Officer</p>
                                </div>
                                <div className="space-y-1 p-1">
                                    <Link href="/settings" className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-primary rounded-lg flex items-center gap-2 transition-colors">
                                        <User className="h-4 w-4" /> Profile
                                    </Link>
                                    <Link href="/settings" className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-primary rounded-lg flex items-center gap-2 transition-colors">
                                        <Settings className="h-4 w-4" /> Settings
                                    </Link>
                                    <div className="h-px bg-slate-50 my-1"></div>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-red-50 hover:text-red-600 rounded-lg flex items-center gap-2 transition-colors"
                                    >
                                        <LogOut className="h-4 w-4" /> Sign Out
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
