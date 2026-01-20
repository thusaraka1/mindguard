"use client";

import { Shell } from "@/components/layout/Shell";
import { SmartMedicalCard } from "@/components/reports/SmartMedicalCard";
import { Download, Printer } from "lucide-react";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getPatient } from "@/lib/data"; // Ensure import

function ReportsContent() {
    const searchParams = useSearchParams();
    const prescription = searchParams.get("prescription") || undefined;
    const patientId = searchParams.get("id");
    const patient = patientId ? getPatient(patientId) : undefined;

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
                <SmartMedicalCard prescription={prescription} patient={patient} />
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
