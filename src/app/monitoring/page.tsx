"use client";

import { Shell } from "@/components/layout/Shell";
import { Activity, Play } from "lucide-react";
import Link from "next/link";

export default function MonitoringPage() {
    return (
        <Shell>
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Live Monitoring</h1>
                    <p className="text-slate-500">Select an active session to view real-time data.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Active Session Card */}
                    <div className="bg-white border border-primary/20 rounded-xl p-6 shadow-md shadow-primary/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                        </div>

                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                                ND
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">Nimali De Silva</h3>
                                <p className="text-xs text-slate-500 uppercase tracking-wider">Session ID: #8824</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-3 mb-6">
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-500">Duration</span>
                                <span className="font-mono font-bold">00:14:22</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Heart Rate</span>
                                <span className="font-mono font-bold text-red-500">88 BPM</span>
                            </div>
                        </div>

                        <Link href="/session/103">
                            <button className="w-full bg-primary hover:bg-sky-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all">
                                <Play className="h-4 w-4 fill-current" /> Initialize View
                            </button>
                        </Link>
                    </div>

                    {/* No other active sessions */}
                    <div className="border border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 min-h-[250px]">
                        <Activity className="h-8 w-8 mb-2 opacity-50" />
                        <p className="font-medium text-sm">No other active sessions</p>
                    </div>
                </div>
            </div>
        </Shell>
    );
}
