"use client";

import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface ShellProps {
    children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden" suppressHydrationWarning>
            <Sidebar />
            <div className="flex-1 flex flex-col ml-64 relative z-0">
                <Header />
                <main className="flex-1 overflow-y-auto p-8 relative">
                    {/* Subtle medical background pattern or gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-100 -z-10 pointer-events-none"></div>
                    {children}
                </main>
            </div>
        </div>
    );
}
