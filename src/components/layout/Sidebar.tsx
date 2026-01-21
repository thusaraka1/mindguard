"use client";

import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Activity, FileText, Settings, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: Users, label: "Patients", href: "/patients" },
    { icon: Activity, label: "Live Monitoring", href: "/monitoring" },
    { icon: FileText, label: "Reports", href: "/reports" },
    { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 h-screen bg-white border-r border-border flex flex-col fixed left-0 top-0 z-50 shadow-sm" suppressHydrationWarning>
            <div className="p-6 flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="font-bold text-xl tracking-tight text-slate-800">MindGuard</h1>
                    <p className="text-xs text-slate-500">Pediatric Monitor</p>
                </div>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group font-medium",
                                isActive
                                    ? "bg-primary text-white shadow-md shadow-primary/30"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            <item.icon className={cn("h-5 w-5", isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600")} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-border">
                <div className="bg-slate-50 rounded-xl p-4 border border-border">
                    <p className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wider">System Status</p>
                    <div className="flex items-center gap-2" suppressHydrationWarning={true}>
                        <span className="relative flex h-2.5 w-2.5" suppressHydrationWarning={true}>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" suppressHydrationWarning={true}></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" suppressHydrationWarning={true}></span>
                        </span>
                        <span className="text-xs font-bold text-slate-700" suppressHydrationWarning={true}>Online & Secure</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
