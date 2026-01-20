import { QrCode } from "lucide-react"; // Using an icon as placeholder for real QR
import { Patient } from "@/lib/data";

export function SmartMedicalCard({ prescription, patient }: { prescription?: string, patient?: Patient }) {
    // Default fallback if no patient is passed (e.g. standalone preview)
    const p = patient || {
        name: "Dasun Perera",
        age: 14,
        gender: "Male",
        district: "Colombo, Western Province",
        contact: "+94 77 123 4567",
        id: "MG-2024-8821X"
    };

    return (
        <div className="bg-white text-slate-900 w-full max-w-2xl mx-auto p-8 rounded-sm shadow-2xl border border-slate-200">
            {/* Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-serif font-bold uppercase tracking-wider">Medical Health Card</h1>
                    <p className="text-sm font-semibold text-slate-600">MindGuard Pediatric Monitoring System</p>
                </div>
                <div className="text-right">
                    <p className="text-xs font-mono">ID: MG-{p.id}</p>
                    <p className="text-xs font-mono">DATE: 2026-01-20</p>
                </div>
            </div>

            {/* Patient Info */}
            <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                    <h3 className="text-xs font-bold uppercase text-slate-500 mb-1">Patient Name</h3>
                    <p className="text-lg font-serif">{p.name}</p>
                </div>
                <div>
                    <h3 className="text-xs font-bold uppercase text-slate-500 mb-1">Age / Gender</h3>
                    <p className="text-lg font-serif">{p.age} Years / {p.gender}</p>
                </div>
                <div>
                    <h3 className="text-xs font-bold uppercase text-slate-500 mb-1">District</h3>
                    <p className="text-lg font-serif">{p.district || "Colombo"}</p>
                </div>
                <div>
                    <h3 className="text-xs font-bold uppercase text-slate-500 mb-1">Guardian Contact</h3>
                    <p className="text-lg font-serif">{p.contact}</p>
                </div>
            </div>

            {/* Clinical Observations */}
            <div className="bg-slate-50 p-4 border border-slate-200 mb-8">
                <h3 className="font-bold border-b border-slate-300 pb-2 mb-2">Automated Clinical Observations</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Patient exhibited <span className="font-bold text-red-600">elevated anxiety</span> signals during "School Performance" topic.</li>
                    <li>Voice analysis detected significant jitter (High Stress).</li>
                    <li>Restlessness index: 7/10 (Above Normal).</li>
                    <li>Recommendation: Follow-up counseling session required.</li>
                </ul>
            </div>

            {/* Prescription Section */}
            {prescription && (
                <div className="bg-blue-50/50 p-4 border border-blue-100 mb-8">
                    <h3 className="font-bold border-b border-blue-200 pb-2 mb-2 text-blue-900">Doctor's Prescription & Notes</h3>
                    <p className="text-sm font-serif whitespace-pre-wrap text-slate-800">{prescription}</p>
                </div>
            )}

            {/* Footer / Authentication */}
            <div className="flex justify-between items-end mt-12 pt-4 border-t border-slate-200">
                <div>
                    <p className="text-xs text-slate-500">Authorized Medical Officer</p>
                    <div className="h-10 border-b border-dotted border-slate-400 w-48 mb-1"></div>
                    <p className="font-serif italic">Dr. Nethmini (SLMC 8821)</p>
                </div>

                <div className="flex flex-col items-center">
                    <div className="border-4 border-black p-1">
                        <QrCode className="h-16 w-16 text-black" />
                    </div>
                    <p className="text-[10px] uppercase font-bold mt-1 tracking-widest">Digitally Signed</p>
                </div>
            </div>
        </div>
    );
}
