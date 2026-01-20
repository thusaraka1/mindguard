import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
    label: string;
    value: string;
    trend?: string;
    trendUp?: boolean;
    icon: LucideIcon;
    color?: "primary" | "secondary" | "destructive" | "success" | "warning";
}

export function StatCard({ label, value, trend, trendUp, icon: Icon, color = "primary" }: StatCardProps) {
    const colorStyles = {
        primary: "bg-sky-50 text-sky-600 border-sky-100",
        secondary: "bg-teal-50 text-teal-600 border-teal-100",
        destructive: "bg-red-50 text-red-600 border-red-100",
        success: "bg-emerald-50 text-emerald-600 border-emerald-100",
        warning: "bg-amber-50 text-amber-600 border-amber-100",
    }[color];

    return (
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 group">
            <div className="flex justify-between items-start mb-3">
                <div className={cn("p-2.5 rounded-lg border", colorStyles)}>
                    <Icon className="h-5 w-5" />
                </div>
                {trend && (
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", trendUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
                        {trend}
                    </span>
                )}
            </div>
            <h3 className="text-2xl font-bold tracking-tight mb-0.5 text-slate-800">{value}</h3>
            <p className="text-sm text-slate-500 font-medium">{label}</p>
        </div>
    );
}
