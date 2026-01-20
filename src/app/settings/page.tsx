"use client";

import { Shell } from "@/components/layout/Shell";
import { Settings, User, Bell, Lock, Globe } from "lucide-react";

export default function SettingsPage() {
    return (
        <Shell>
            <div className="flex flex-col gap-6 max-w-4xl mx-auto">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
                    <p className="text-slate-500">Manage system preferences and account.</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100">
                    {/* Section */}
                    <div className="p-6 flex items-start gap-4">
                        <div className="p-2 bg-slate-100 rounded-lg">
                            <User className="h-5 w-5 text-slate-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-800 text-lg">Account Profile</h3>
                            <p className="text-sm text-slate-500 mb-4">Manage your personal details and medical license info.</p>
                            <button className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50">Edit Profile</button>
                        </div>
                    </div>

                    {/* Section */}
                    <div className="p-6 flex items-start gap-4">
                        <div className="p-2 bg-slate-100 rounded-lg">
                            <Bell className="h-5 w-5 text-slate-600" />
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg">Notifications</h3>
                                    <p className="text-sm text-slate-500">Email alerts for upcoming sessions.</p>
                                </div>
                                <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                    <input type="checkbox" name="toggle" id="toggle" className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-slate-300 checked:right-0 checked:border-primary" />
                                    <label htmlFor="toggle" className="toggle-label block overflow-hidden h-6 rounded-full bg-slate-300 cursor-pointer"></label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section */}
                    <div className="p-6 flex items-start gap-4">
                        <div className="p-2 bg-slate-100 rounded-lg">
                            <Lock className="h-5 w-5 text-slate-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-800 text-lg">Security</h3>
                            <p className="text-sm text-slate-500 mb-4">Two-factor authentication and password.</p>
                            <button className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50">Change Password</button>
                        </div>
                    </div>

                    {/* Section */}
                    <div className="p-6 flex items-start gap-4">
                        <div className="p-2 bg-slate-100 rounded-lg">
                            <Globe className="h-5 w-5 text-slate-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-800 text-lg">System Language</h3>
                            <select className="mt-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-700">
                                <option>English (US)</option>
                                <option>Sinhala</option>
                                <option>Tamil</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </Shell>
    );
}
