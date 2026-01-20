"use client";

import { useEffect, useState, useRef } from "react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { motion } from "framer-motion";
import { Mic, Activity, Zap, Camera, Thermometer, Smile, VideoOff, MicOff } from "lucide-react";

// Mock data generator for sensors other than voice
const generateData = (prev: number, min: number, max: number, volatility: number) => {
    const change = (Math.random() - 0.5) * volatility;
    let next = prev + change;
    if (next > max) next = max;
    if (next < min) next = min;
    return next;
};

export function PatientLiveMonitor() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [data, setData] = useState<any[]>([]);
    const [heartRate, setHeartRate] = useState(75);
    const [temp, setTemp] = useState(36.5);
    const [gsr, setGsr] = useState(50);
    const [voiceLevel, setVoiceLevel] = useState(0);

    // Initialize data array
    useEffect(() => {
        const initialData = Array(50).fill(0).map((_, i) => ({
            time: i,
            ecg: 75,
            temp: 36.5,
            gsr: 50,
            voice: 0
        }));
        setData(initialData);
    }, []);

    // Camera & Mic Setup
    useEffect(() => {
        let animationFrameId: number;

        const startMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });

                streamRef.current = stream;
                setHasPermission(true);

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }

                // Audio Analysis Setup
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                audioContextRef.current = audioContext;
                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                analyserRef.current = analyser;

                const source = audioContext.createMediaStreamSource(stream);
                sourceRef.current = source;
                source.connect(analyser);

                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                dataArrayRef.current = dataArray;

                // Audio Level Loop
                const checkAudioLevel = () => {
                    const analyser = analyserRef.current;
                    const dataArray = dataArrayRef.current;

                    if (analyser && dataArray) {
                        analyser.getByteFrequencyData(dataArray as any);

                        let sum = 0;
                        for (let i = 0; i < dataArray.length; i++) {
                            sum += dataArray[i];
                        }
                        const average = sum / dataArray.length;

                        // Scale visually for the graph (0-100 approx)
                        setVoiceLevel(average * 1.5);
                    }
                    animationFrameId = requestAnimationFrame(checkAudioLevel);
                };
                checkAudioLevel();

            } catch (err) {
                console.error("Error accessing media devices:", err);
                setHasPermission(false);
            }
        };

        startMedia();

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    // Sensors Simulation Loop (Voice is now real)
    useEffect(() => {
        const interval = setInterval(() => {
            setHeartRate(prev => generateData(prev, 60, 110, 5));
            setTemp(prev => generateData(prev, 36.2, 37.2, 0.1));
            setGsr(prev => generateData(prev, 40, 80, 2));

            // Note: setVoiceLevel is handled by the audio context loop above

            setData(prevData => {
                const newData = [...prevData.slice(1), {
                    time: Date.now(),
                    ecg: heartRate,
                    temp: temp,
                    gsr: gsr,
                    voice: voiceLevel // Use the real-time audio level
                }];
                return newData;
            });
        }, 100);

        return () => clearInterval(interval);
    }, [heartRate, temp, gsr, voiceLevel]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
            {/* Video Feed Section */}
            <div className="lg:col-span-3 relative bg-black rounded-2xl overflow-hidden border border-slate-200 shadow-sm group min-h-[400px]">
                {/* Video Element */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted // Mute local preview to avoid feedback loop
                    className="absolute inset-0 w-full h-full object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/60 z-10 flex flex-col justify-between p-6 pointer-events-none">
                    <div className="flex justify-between items-start">
                        <div className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">
                            LIVE
                        </div>
                        <div className="flex gap-2">
                            <span className={`backdrop-blur-md text-white/80 text-xs px-2 py-1 rounded border border-white/10 flex items-center gap-1 ${hasPermission ? 'bg-emerald-500/20 text-emerald-100' : 'bg-destructive/40'}`}>
                                {hasPermission ? <Camera className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
                                {hasPermission ? 'Cam 01 Active' : 'No Signal'}
                            </span>
                            <span className={`backdrop-blur-md text-white/80 text-xs px-2 py-1 rounded border border-white/10 flex items-center gap-1 ${hasPermission ? 'bg-emerald-500/20 text-emerald-100' : 'bg-destructive/40'}`}>
                                {hasPermission ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                                {hasPermission ? 'Mic Active' : 'Muted'}
                            </span>
                        </div>
                    </div>

                    <div className="flex justify-between items-end">
                        <div className="bg-black/40 p-3 rounded-lg backdrop-blur-sm">
                            <h4 className="text-white font-bold text-lg flex items-center gap-2">Patient Observation</h4>
                            <p className="text-xs text-slate-300">AI Analysis Running: Facial Expressions & Posture</p>
                        </div>

                        {/* AI Mood Overlay */}
                        <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/20 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/50">
                                <Smile className="h-6 w-6 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-300 uppercase tracking-wider font-bold">Detected Mood</p>
                                <p className="text-white font-bold text-sm">Neutral / Calm</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Loading / Error State */}
                {hasPermission === false && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-0">
                        <p className="text-slate-400 text-sm">Camera access denied or unavailable</p>
                    </div>
                )}
                {hasPermission === null && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-0">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 border-4 border-slate-600 border-t-white rounded-full animate-spin"></div>
                            <p className="text-slate-400 text-xs">Connecting to secure stream...</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Sensor Graphs Sidebar */}
            <div className="lg:col-span-1 flex flex-col gap-4 h-full overflow-y-auto pr-1">
                <SensorGraph
                    label="ECG / Heart Rate"
                    value={`${Math.round(heartRate)} BPM`}
                    data={data}
                    dataKey="ecg"
                    color="#ef4444"
                    icon={Activity}
                    subtext="Normal Sinus Rhythm"
                />
                <SensorGraph
                    label="Body Temperature"
                    value={`${temp.toFixed(1)} °C`}
                    data={data}
                    dataKey="temp"
                    color="#f59e0b"
                    icon={Thermometer}
                    subtext="Stable"
                />
                <SensorGraph
                    label="GSR / Stress"
                    value={`${Math.round(gsr)} µS`}
                    data={data}
                    dataKey="gsr"
                    color="#8b5cf6"
                    icon={Zap}
                    subtext="Low Arousal"
                />
                <SensorGraph
                    label="Voice Intensity"
                    value={`${Math.round(voiceLevel)} dB`}
                    data={data}
                    dataKey="voice"
                    color="#0ea5e9"
                    icon={Mic}
                    subtext="Conversation Mode"
                />
            </div>
        </div>
    );
}

function SensorGraph({ label, value, data, dataKey, color, icon: Icon, subtext }: any) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col relative overflow-hidden shadow-sm hover:shadow-md transition-shadow flex-1 min-h-[100px]">
            <div className="flex justify-between items-start z-10 mb-2">
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                        <Icon className="h-3.5 w-3.5" /> {label}
                    </div>
                    <span className="text-2xl font-bold text-slate-800 tracking-tight">{value}</span>
                </div>
            </div>

            <div className="flex-1 absolute bottom-0 left-0 right-0 h-16 opacity-30">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <Line
                            type="monotone"
                            dataKey={dataKey}
                            stroke={color}
                            strokeWidth={3}
                            dot={false}
                            isAnimationActive={false}
                        />
                        <YAxis domain={['auto', 'auto']} hide />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Decorative accent line */}
            <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: color, opacity: 0.2 }}></div>
        </div>
    );
}
