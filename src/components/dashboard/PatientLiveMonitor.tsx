"use client";

import { useEffect, useState, useRef } from "react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { motion } from "framer-motion";
import { Mic, Activity, Zap, Camera, Thermometer, Smile, VideoOff, MicOff, AudioWaveform } from "lucide-react";
import { io } from "socket.io-client";

// Mock data generator for sensors other than voice
const generateData = (prev: number, min: number, max: number, volatility: number) => {
    const change = (Math.random() - 0.5) * volatility;
    let next = prev + change;
    if (next > max) next = max;
    if (next < min) next = min;
    return next;
};

interface PatientLiveMonitorProps {
    onDataUpdate?: (data: {
        heartRate: number;
        speechNoise: number;
        movementLevel: number;
        facialStress: number;
    }) => void;
}

export function PatientLiveMonitor({ onDataUpdate }: PatientLiveMonitorProps = {}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null); // Hidden canvas for capture
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
    const [voiceLevel, setVoiceLevel] = useState(40);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [voiceData, setVoiceData] = useState<{ time: number, voice: number }[]>(
        Array(50).fill(0).map((_, i) => ({ time: i, voice: 40 }))
    );

    // AI Analysis State
    const [aiState, setAiState] = useState({ emotion: "Analyzing...", score: 0 });
    const [faceRegion, setFaceRegion] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
    const [socketConnected, setSocketConnected] = useState(false);

    // Voice Feature Extraction State
    const [voiceFeatures, setVoiceFeatures] = useState({
        avgDb: 40,
        variance: 0,
        silenceRatio: 100,
        zeroCrossingRate: 0,
        speechNoiseDb: 40  // Composite score for dataset
    });
    const dBHistoryRef = useRef<number[]>([]);
    const silenceCountRef = useRef(0);
    const totalCountRef = useRef(0);

    // Refs for graph data (avoids interval recreation on every state change)
    const heartRateRef = useRef(heartRate);
    const tempRef = useRef(temp);
    const gsrRef = useRef(gsr);
    const voiceLevelRef = useRef(voiceLevel);
    const aiStateRef = useRef(aiState);

    // Keep refs in sync with state
    useEffect(() => { heartRateRef.current = heartRate; }, [heartRate]);
    useEffect(() => { tempRef.current = temp; }, [temp]);
    useEffect(() => { gsrRef.current = gsr; }, [gsr]);
    useEffect(() => { voiceLevelRef.current = voiceLevel; }, [voiceLevel]);
    useEffect(() => { aiStateRef.current = aiState; }, [aiState]);

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

    // Camera & Mic Setup AND Socket IO
    useEffect(() => {
        let animationFrameId: number;
        let captureInterval: NodeJS.Timeout;

        // 1. Setup Socket — force WebSocket (polling is unreliable for large base64 frames)
        const socket = io("http://localhost:5000", {
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: Infinity,
        });

        socket.on("connect", () => {
            console.log("Connected to AI Brain");
            setSocketConnected(true);
        });

        // 2. Receive Frame Processing Results + Sensor Data (reliable direct channel)
        let frameCount = 0;
        socket.on("frame_processed", (data: any) => {
            frameCount++;
            if (frameCount % 20 === 1) {
                console.log(`🖼️ frame_processed #${frameCount}:`, {
                    bpm: data.bpm, temp: data.body_temp,
                    move: data.movement_level,
                    emotion: data.emotion, score: data.score
                });
            }
            setFaceRegion(data.region);
            setAiState({ emotion: data.emotion, score: data.score });

            // Update sensor values from piggybacked data
            if (data.bpm !== undefined) setHeartRate(data.bpm);
            if (data.body_temp !== undefined) setTemp(data.body_temp);
            if (data.movement_level !== undefined) {
                setGsr(Math.round(data.movement_level * 10));
            }
        });

        // 3. Also listen for MindGuard Global Updates (backup channel from background thread)
        let updateCount = 0;
        socket.on("mindguard_update", (serverState: any) => {
            updateCount++;
            if (updateCount % 10 === 1) {
                console.log(`📡 mindguard_update #${updateCount}:`, {
                    bpm: serverState.bpm, temp: serverState.body_temp,
                    move: serverState.movement_level,
                    face: serverState.facial_emotion, score: serverState.facial_score
                });
            }
            if (serverState.bpm !== undefined) setHeartRate(serverState.bpm);
            if (serverState.body_temp !== undefined) setTemp(serverState.body_temp);
            if (serverState.movement_level !== undefined) {
                setGsr(Math.round(serverState.movement_level * 10));
            }
            if (serverState.facial_score !== undefined || serverState.facial_emotion) {
                setAiState({
                    emotion: serverState.facial_emotion || "Analyzing...",
                    score: serverState.facial_score ?? 0
                });
            }
        });

        socket.on("disconnect", (reason: string) => {
            console.log(`❌ Socket disconnected: ${reason}`);
            setSocketConnected(false);
        });

        socket.on("connect_error", (err: any) => {
            console.log(`❌ Socket connect error: ${err.message}`);
        });

        // 4. Start Media
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

                // Audio Level Loop - Calculate Real dB
                const checkAudioLevel = () => {
                    const analyser = analyserRef.current;
                    const dataArray = dataArrayRef.current;

                    if (analyser && dataArray) {
                        // Get time domain data for RMS calculation
                        analyser.getByteTimeDomainData(dataArray as Uint8Array<ArrayBuffer>);

                        // Calculate RMS (Root Mean Square)
                        let sumSquares = 0;
                        for (let i = 0; i < dataArray.length; i++) {
                            const normalized = (dataArray[i] - 128) / 128; // Normalize to -1 to 1
                            sumSquares += normalized * normalized;
                        }
                        const rms = Math.sqrt(sumSquares / dataArray.length);

                        // Convert to dB (with floor and ceiling)
                        // Reference: 0 dB = full scale, typical speech ~60-70 dB SPL
                        // We map RMS to approximate SPL-like values
                        let dB = 0;
                        if (rms > 0.001) {
                            // 20 * log10(rms) gives dB relative to full scale
                            // Map to realistic SPL range: 30-90 dB
                            dB = 20 * Math.log10(rms) + 90; // Offset to get positive values
                            dB = Math.max(30, Math.min(90, dB)); // Clamp to 30-90 range
                        } else {
                            dB = 30; // Silence floor
                        }

                        setVoiceLevel(dB);
                        setIsSpeaking(dB > 50); // Speaking threshold

                        // Update voice data for graph (fast updates)
                        setVoiceData(prev => {
                            const newData = [...prev.slice(1), { time: Date.now(), voice: dB }];
                            return newData;
                        });

                        // === VOICE FEATURE EXTRACTION ===
                        // Track dB history (keep last 100 samples ~1.5 seconds)
                        dBHistoryRef.current.push(dB);
                        if (dBHistoryRef.current.length > 100) {
                            dBHistoryRef.current.shift();
                        }

                        // Track silence ratio
                        totalCountRef.current++;
                        if (dB < 45) {
                            silenceCountRef.current++;
                        }

                        // Calculate Zero Crossing Rate (voice tremor indicator)
                        let zeroCrossings = 0;
                        for (let i = 1; i < dataArray.length; i++) {
                            if ((dataArray[i] - 128) * (dataArray[i - 1] - 128) < 0) {
                                zeroCrossings++;
                            }
                        }
                        const zcr = zeroCrossings / dataArray.length;

                        // Update features every 50 samples
                        if (dBHistoryRef.current.length >= 50 && totalCountRef.current % 50 === 0) {
                            const history = dBHistoryRef.current;
                            const avg = history.reduce((a, b) => a + b, 0) / history.length;
                            const variance = history.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / history.length;
                            const stdDev = Math.sqrt(variance);
                            const silenceRatio = (silenceCountRef.current / totalCountRef.current) * 100;

                            // Composite Speech_Noise_dB score
                            // Higher = more "noise" indicators (stress signs)
                            const speechNoiseDb = Math.min(100, Math.max(0,
                                avg + (stdDev * 2) + (zcr * 50) - (silenceRatio * 0.3)
                            ));

                            setVoiceFeatures({
                                avgDb: Math.round(avg),
                                variance: Math.round(stdDev * 10) / 10,
                                silenceRatio: Math.round(silenceRatio),
                                zeroCrossingRate: Math.round(zcr * 1000) / 10,
                                speechNoiseDb: Math.round(speechNoiseDb)
                            });
                        }
                    }
                    animationFrameId = requestAnimationFrame(checkAudioLevel);
                };
                checkAudioLevel();

                // 5. Start Frame Capture for AI
                let frameSendCount = 0;
                captureInterval = setInterval(() => {
                    if (videoRef.current && canvasRef.current && socket.connected) {
                        const video = videoRef.current;
                        const canvas = canvasRef.current;
                        const ctx = canvas.getContext('2d');

                        if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
                            // Optimize: Resize to smaller width (e.g. 480px) to reduce bandwidth/latency
                            const scaleFactor = 480 / video.videoWidth;
                            canvas.width = 480;
                            canvas.height = video.videoHeight * scaleFactor;

                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            // Reduce quality slightly for speed
                            const base64 = canvas.toDataURL('image/jpeg', 0.5);
                            socket.emit('process_frame', base64);
                            frameSendCount++;
                            if (frameSendCount % 50 === 1) {
                                console.log(`📤 Frame sent #${frameSendCount} (${(base64.length / 1024).toFixed(0)}KB) socket=${socket.connected}`);
                            }
                        } else if (frameSendCount === 0) {
                            console.log(`⏳ Video not ready: readyState=${video.readyState} (need ${video.HAVE_ENOUGH_DATA})`);
                        }
                    } else if (!socket.connected) {
                        console.log('⚠️ Frame skipped: socket not connected');
                    }
                }, 200); // 5 FPS (Every 200ms) - Much smoother than 1s

            } catch (err) {
                console.error("Error accessing media devices:", err);
                setHasPermission(false);
            }
        };

        startMedia();

        return () => {
            console.log("🛑 Stopping camera and audio...");

            // Stop animation frame
            if (animationFrameId) cancelAnimationFrame(animationFrameId);

            // Stop capture interval
            if (captureInterval) clearInterval(captureInterval);

            // Disconnect socket
            socket.disconnect();

            // Stop all media tracks (camera + mic)
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => {
                    console.log(`Stopping track: ${track.kind}`);
                    track.stop();
                });
                streamRef.current = null;
            }

            // Also stop video element source
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }

            // Close audio context
            if (audioContextRef.current) {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }

            console.log("✅ All media stopped");
        };
    }, []);

    // Graph Data Update Loop (uses refs for stable interval - no recreation)
    useEffect(() => {
        const interval = setInterval(() => {
            setData(prevData => {
                const newData = [...prevData.slice(1), {
                    time: Date.now(),
                    ecg: heartRateRef.current,
                    temp: tempRef.current,
                    gsr: gsrRef.current,
                    voice: voiceLevelRef.current
                }];
                return newData;
            });
        }, 200); // 5 Hz graph updates (smooth enough, no jank)

        return () => clearInterval(interval);
    }, []); // Empty deps = stable interval, reads from refs

    // Emit session data to parent for recording averages
    useEffect(() => {
        if (!onDataUpdate) return;
        const dataInterval = setInterval(() => {
            onDataUpdate({
                heartRate: heartRateRef.current,
                speechNoise: voiceLevelRef.current,
                movementLevel: gsrRef.current / 10, // Convert back from µS display scale
                facialStress: aiStateRef.current.score ?? 0,
            });
        }, 1000); // Collect data every 1 second
        return () => clearInterval(dataInterval);
    }, [onDataUpdate]);

    // REST Polling Fallback - guaranteed to work even if Socket.IO events don't arrive
    useEffect(() => {
        let pollCount = 0;
        const pollInterval = setInterval(async () => {
            try {
                const res = await fetch('http://localhost:5000/api/state');
                if (res.ok) {
                    const s = await res.json();
                    pollCount++;

                    // Update sensor values
                    if (s.bpm !== undefined) setHeartRate(s.bpm);
                    if (s.body_temp !== undefined) setTemp(s.body_temp);
                    if (s.movement_level !== undefined) {
                        setGsr(Math.round(s.movement_level * 10));
                    }

                    // Update facial analysis
                    if (s.facial_emotion || s.facial_score !== undefined) {
                        setAiState({
                            emotion: s.facial_emotion || "Analyzing...",
                            score: s.facial_score ?? 0
                        });
                    }

                    if (pollCount % 20 === 1) {
                        console.log(`🔄 REST poll #${pollCount}: BPM=${s.bpm} Temp=${s.body_temp} Face=${s.facial_emotion}/${s.facial_score}`);
                    }
                }
            } catch (err) {
                // Server not reachable, skip
            }
        }, 500); // Poll every 500ms (2Hz)

        return () => clearInterval(pollInterval);
    }, []);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[600px]">
            {/* Video Feed Section */}
            <div className="lg:col-span-3 relative bg-black rounded-2xl overflow-hidden border border-slate-200 shadow-sm group min-h-[400px]">
                {/* Hidden Capture */}
                <canvas ref={canvasRef} className="hidden" />

                {/* 1. Underlying Real Video (Now Fully Visible) */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                />

                {/* 2. AI Overlay Box (Computed) - REMOVED for performance/UI preference */}
                {/* 
                  faceRegion && videoRef.current && (
                    <div ... />
                  )
                */}

                <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/60 z-20 flex flex-col justify-between p-6 pointer-events-none">
                    <div className="flex justify-between items-start">
                        <div className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">
                            LIVE
                        </div>
                        <div className="flex gap-2">
                            <span className={`backdrop-blur-md text-white/80 text-xs px-2 py-1 rounded border border-white/10 flex items-center gap-1 ${socketConnected ? 'bg-emerald-500/20 text-emerald-100' : 'bg-yellow-500/20 text-yellow-100'}`}>
                                <Activity className="h-3 w-3" />
                                {socketConnected ? 'AI Connected' : 'Connecting AI...'}
                            </span>
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
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center border ${aiState.score > 8 ? 'bg-red-500/20 border-red-500' : 'bg-emerald-500/20 border-emerald-500'}`}>
                                <Smile className={`h-6 w-6 ${aiState.score > 8 ? 'text-red-400' : 'text-emerald-400'}`} />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-300 uppercase tracking-wider font-bold">Detected Mood</p>
                                <p className="text-white font-bold text-sm capitalize">{aiState.emotion} (Score: {typeof aiState.score === 'number' ? aiState.score.toFixed(1) : aiState.score})</p>
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
            <div className="lg:col-span-1 flex flex-col gap-4 pb-6">
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
                    data={voiceData}
                    dataKey="voice"
                    color={isSpeaking ? "#10b981" : "#0ea5e9"}
                    icon={Mic}
                    subtext={voiceLevel < 45 ? "Silent" : voiceLevel < 60 ? "Quiet" : voiceLevel < 75 ? "Normal Speech" : "Loud"}
                    highlight={isSpeaking}
                />

                {/* Voice Analysis Panel */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-4 shadow-sm">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 uppercase tracking-wide mb-3">
                        <AudioWaveform className="h-3.5 w-3.5" /> Speech Analysis
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-600">Speech Noise</span>
                            <span className="text-sm font-bold text-indigo-700">{voiceFeatures.speechNoiseDb} dB</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-600">Variance</span>
                            <span className={`text-sm font-bold ${voiceFeatures.variance > 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {voiceFeatures.variance} {voiceFeatures.variance > 5 ? '⚠️' : '✓'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-600">Silence</span>
                            <span className="text-sm font-bold text-slate-700">{voiceFeatures.silenceRatio}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-600">Tremor (ZCR)</span>
                            <span className={`text-sm font-bold ${voiceFeatures.zeroCrossingRate > 30 ? 'text-red-600' : 'text-emerald-600'}`}>
                                {voiceFeatures.zeroCrossingRate}% {voiceFeatures.zeroCrossingRate > 30 ? '⚠️' : '✓'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SensorGraph({ label, value, data, dataKey, color, icon: Icon, subtext, highlight }: any) {
    return (
        <div className={`bg-white rounded-xl border p-4 flex flex-col relative overflow-hidden shadow-sm hover:shadow-md transition-all flex-1 min-h-[100px] ${highlight ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'}`}>
            <div className="flex justify-between items-start z-10 mb-2">
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                        <Icon className={`h-3.5 w-3.5 ${highlight ? 'text-emerald-500' : ''}`} /> {label}
                        {highlight && (
                            <span className="ml-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded-full font-bold animate-pulse">
                                SPEAKING
                            </span>
                        )}
                    </div>
                    <span className="text-2xl font-bold text-slate-800 tracking-tight">{value}</span>
                    <span className="text-xs text-slate-400 mt-0.5">{subtext}</span>
                </div>
            </div>

            <div className={`flex-1 absolute bottom-0 left-0 right-0 h-16 ${highlight ? 'opacity-60' : 'opacity-30'}`}>
                <ResponsiveContainer width="100%" height="100%" minHeight={1}>
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
            <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: color, opacity: highlight ? 0.6 : 0.2 }}></div>
        </div>
    );
}
