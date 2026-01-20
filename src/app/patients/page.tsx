"use client";

import { Shell } from "@/components/layout/Shell";
import { Search, ArrowRight } from "lucide-react";
import Link from "next/link";
import { patients as allPatients } from "@/lib/data";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";

function PatientsList() {
    const searchParams = useSearchParams();
    const query = searchParams.get("q")?.toLowerCase() || "";
    const [filteredPatients, setFilteredPatients] = useState(allPatients);

    useEffect(() => {
        if (query) {
            setFilteredPatients(allPatients.filter(p =>
                p.name.toLowerCase().includes(query) ||
                p.condition.toLowerCase().includes(query) ||
                p.id.includes(query)
            ));
        } else {
            setFilteredPatients(allPatients); // Reset if empty
        }
    }, [query]);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Patient Registry</h1>
                    <p className="text-slate-500">Manage patient records and history.</p>
                </div>
                <button className="bg-primary hover:bg-sky-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm">
                    + Add New Patient
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search patients..."
                            defaultValue={query}
                            onChange={(e) => {
                                const val = e.target.value.toLowerCase();
                                setFilteredPatients(allPatients.filter(p =>
                                    p.name.toLowerCase().includes(val) ||
                                    p.condition.toLowerCase().includes(val) ||
                                    p.id.includes(val)
                                ));
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>
                    <select className="bg-slate-50 border border-slate-200 rounded-lg px-4 text-sm text-slate-600 focus:outline-none">
                        <option>All Conditions</option>
                        <option>Anxiety</option>
                        <option>ADHD</option>
                    </select>
                </div>

                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-3">Patient Name</th>
                            <th className="px-6 py-3">Age / Gender</th>
                            <th className="px-6 py-3">Condition</th>
                            <th className="px-6 py-3">Last Visit</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredPatients.length > 0 ? (
                            filteredPatients.map((p) => (
                                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="px-6 py-4 font-bold text-slate-800">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-bold">
                                                {p.name.split(" ").map(n => n[0]).join("")}
                                            </div>
                                            {p.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">{p.age} <span className="text-slate-300">/</span> {p.gender == "Male" ? "M" : "F"}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 rounded text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100">
                                            {p.condition}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">{p.lastVisit}</td>
                                    <td className="px-6 py-4 text-right">
                                        <Link href={`/patients/${p.id}`} className="text-primary hover:underline font-medium inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            View <ArrowRight className="h-3 w-3" />
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                                    No patients found matching your search.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function PatientsPage() {
    return (
        <Shell>
            <Suspense fallback={<div>Loading...</div>}>
                <PatientsList />
            </Suspense>
        </Shell>
    );
}
