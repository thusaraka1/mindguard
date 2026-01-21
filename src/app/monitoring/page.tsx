"use client";

import { Shell } from "@/components/layout/Shell";
import { Activity, Play, Video } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export default function MonitoringPage() {
    const [stressData, setStressData] = useState({ score: 0, emotion: "Waiting..." });
    const [faceRegion, setFaceRegion] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
    const [connected, setConnected] = useState(false);

    // Refs for Webcam Capture
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        // 1. Connect to Processing Server
        const socket = io("http://localhost:5000");

        socket.on("connect", () => {
            console.log("Connected to AI Processing Server");
            setConnected(true);
        });

        // 2. Receive Processed DATA Only (No Image)
        socket.on("frame_processed", (data: any) => {
            setFaceRegion(data.region);
            setStressData({ score: data.score, emotion: data.emotion });
        });

        socket.on("disconnect", () => {
            setConnected(false);
        });

        // 3. Start Local Webcam
        const startWebcam = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Error accessing webcam:", err);
            }
        };
        startWebcam();

        // 4. Send Frames Periodically
        const interval = setInterval(() => {
            if (videoRef.current && canvasRef.current && socket.connected) {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');

                if (video.readyState === video.HAVE_ENOUGH_DATA && context) {
                    // Optimize: Resize to smaller width (320px)
                    const scaleFactor = 320 / video.videoWidth;
                    canvas.width = 320;
                    canvas.height = video.videoHeight * scaleFactor;

                    // Draw video frame to canvas
                    context.drawImage(video, 0, 0, canvas.width, canvas.height);

                    // Get Base64
                    const frame = canvas.toDataURL("image/jpeg", 0.5); // 0.5 quality

                    // Emit to Server
                    socket.emit('process_frame', frame);
                }
            }
        }, 100); // 10 FPS

        return () => {
            console.log("Cleaning up webcam and socket...");
            socket.disconnect();
            clearInterval(interval);

            // Reliable Stream Cleanup
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => {
                    track.stop();
                });
                streamRef.current = null;
            }
        };
    }, []);

    // Determine color based on score
    const getScoreColor = (score: number) => {
        if (score < 4) return "text-green-500";
        if (score < 9) return "text-yellow-500";
        return "text-red-500";
    };

    return (
        <Shell>
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Live Facial Monitoring</h1>
                    <p className="text-slate-500">Real-time Facial Stress Analysis (DeepFace)</p>
                </div>

                {/* Hidden Elements for Capture */}
                <video ref={videoRef} autoPlay playsInline muted className="hidden" />
                <canvas ref={canvasRef} className="hidden" />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Active Session Card */}
                    <div className="bg-white border border-primary/20 rounded-xl p-6 shadow-md shadow-primary/5 relative overflow-hidden group">

                        {/* VIDEO STREAM CONTAINER */}
                        <div className="mb-4 rounded-lg overflow-hidden border border-slate-200 bg-black relative h-64">
                            {/* 1. Underlying Real Video (Visible) */}
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                            />

                            {/* 2. AI Overlay Box - REMOVED */}
                            {/* 
                             faceRegion && videoRef.current && (
                                <div ... />
                             )
                            */}

                            {!connected && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm">
                                    Connecting to AI...
                                </div>
                            )}
                        </div>

                        <div className="absolute top-0 right-0 p-4 z-10">
                            <span className="relative flex h-3 w-3">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${connected ? 'bg-green-400' : 'bg-red-400'}`}></span>
                                <span className={`relative inline-flex rounded-full h-3 w-3 ${connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
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

                        <div className="bg-slate-50 rounded-lg p-3 mb-6 space-y-3">
                            <div className="flex justify-between text-sm items-center">
                                <span className="text-slate-500 flex items-center gap-2">
                                    <Video className="h-4 w-4" /> Facial Stress
                                </span>
                                <div className="text-right">
                                    <span className={`font-mono font-bold ${getScoreColor(stressData.score)} text-lg block`}>
                                        {stressData.score}/14
                                    </span>
                                    <span className="text-xs text-slate-400 font-medium uppercase">{stressData.emotion}</span>
                                </div>
                            </div>

                            {/* Visual Bar */}
                            <div className="w-full bg-slate-200 rounded-full h-2.5">
                                <div
                                    className={`h-2.5 rounded-full transition-all duration-500 ${stressData.score < 4 ? 'bg-green-500' : stressData.score < 9 ? 'bg-yellow-400' : 'bg-red-500'}`}
                                    style={{ width: `${(stressData.score / 14) * 100}%` }}
                                ></div>
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
