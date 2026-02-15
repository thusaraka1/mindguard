# ==========================================
# 1. SETUP & CONFIG
# ==========================================
import os
import cv2
import threading
import time
import json
import logging
import joblib
import numpy as np
import pandas as pd
import base64
from collections import deque
from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
# Patch for DeepFace/TF compatibility
import tensorflow as tf
import keras
try:
    tf.keras = keras
except:
    pass
from deepface import DeepFace
try:
    import pyaudio
    import audioop
    HAS_PYAUDIO = True
except ImportError:
    HAS_PYAUDIO = False
    logging.warning("pyaudio not available - audio thread will be disabled")
import serial
import serial.tools.list_ports
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("MindGuard")

# Suppress noisy werkzeug WebSocket assertion errors (harmless with threading mode)
logging.getLogger('werkzeug').setLevel(logging.WARNING)

app = Flask(__name__)

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

# Initialize SocketIO with threading mode (NOT eventlet) so DeepFace C code
# doesn't block the event loop and prevent socket events from being received
socketio = SocketIO(app, cors_allowed_origins="*", max_http_buffer_size=10000000, async_mode='threading')

# Global State
state = {
    # Inputs from ESP32
    "bpm": 70.0,              # Heart rate from AD8232
    "hrv": 50.0,              # ECG Variability (derived)
    "body_temp": 36.5,        # Body temperature from MLX90614
    "movement_level": 0.0,    # Movement from ADXL345 accelerometer
    "accel_x": 0.0,           # Raw accelerometer X
    "accel_y": 0.0,           # Raw accelerometer Y
    "accel_z": 0.0,           # Raw accelerometer Z
    "heart_signal": 0,        # Raw ECG signal from AD8232
    "leads_off": True,        # ECG leads status
    
    # Inputs from other sources
    "audio_db": 40.0,         # Speech noise from microphone
    "facial_score": 0,        # Stress score from camera (0-14 scale)
    "facial_emotion": "Neutral",
    "facial_confidence": 0.0,
    
    # Output
    "prediction_result": "Normal",
    "prediction_prob": 0.0,
    
    # System Status
    "serial_status": "Disconnected",
    "serial_connected": False,
    "mic_status": "Disconnected", 
    "model_status": "Loading..."
}

# =============================================================================
# 2. RESPONSIVE EMOTION TRACKER (From facial_server.py)
# =============================================================================
class ResponsiveEmotionTracker:
    """
    Responsive emotion tracker that:
    - Uses raw DeepFace output directly for responsiveness
    - Only smooths the STRESS SCORE (not the emotion label)
    - Immediately responds to high-confidence emotion changes
    - Uses short history for noise reduction without lag
    """
    def __init__(self):
        self.emotion_history = deque(maxlen=3)
        self.score_history = deque(maxlen=5)
        self.last_emotion = "neutral"
        self.last_score = 2.0
        
    def get_stable_emotion(self, raw_emotions):
        current_dominant = max(raw_emotions, key=raw_emotions.get)
        current_confidence = raw_emotions[current_dominant]
        
        # HIGH CONFIDENCE: Trust immediately
        if current_confidence > 40:
            self.last_emotion = current_dominant
            return current_dominant, current_confidence
        
        # MEDIUM CONFIDENCE: Check consistency
        if current_confidence > 25:
            self.emotion_history.append(current_dominant)
            if len(self.emotion_history) >= 2:
                recent = list(self.emotion_history)[-2:]
                if recent.count(current_dominant) >= 1:
                    self.last_emotion = current_dominant
                    return current_dominant, current_confidence
        
        # LOW CONFIDENCE: Stick with last
        return self.last_emotion, current_confidence
    
    def get_smoothed_score(self, raw_score):
        self.score_history.append(raw_score)
        if len(self.score_history) >= 3:
            scores = list(self.score_history)[-3:]
            smoothed = sorted(scores)[1]  # Median
        else:
            smoothed = raw_score
        self.last_score = smoothed
        return smoothed

def calculate_weighted_stress(emotions):
    w_fear, w_angry, w_disgust, w_sad = 0.12, 0.10, 0.08, 0.06
    w_neutral, w_happy, w_surprise = 0.01, 0.05, 0.02

    score = (
        (emotions.get('fear', 0) * w_fear) +
        (emotions.get('angry', 0) * w_angry) +
        (emotions.get('disgust', 0) * w_disgust) +
        (emotions.get('sad', 0) * w_sad) +
        (emotions.get('neutral', 0) * w_neutral) - 
        (emotions.get('happy', 0) * w_happy) -
        (emotions.get('surprise', 0) * w_surprise)
    )
    score += 2.0
    return max(0, min(14, round(score, 1)))

emotion_tracker = ResponsiveEmotionTracker()
processing_lock = threading.Lock()

# ==========================================
# 3. WEBSOCKET HANDLERS
# ==========================================
@socketio.on('connect')
def handle_connect():
    logger.info(f"🟢 Client Connected: {request.sid}")
    emit('mindguard_update', state)

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"Client Disconnected: {request.sid}")

@socketio.on('process_frame')
def handle_frame(base64_string):
    logger.debug(f"📸 process_frame received ({len(base64_string)} chars)")
    # Drop frame if already processing
    if processing_lock.locked():
        return

    # Non-blocking acquire: if busy, skip this frame (Frame Dropping)
    if not processing_lock.acquire(blocking=False):
        return

    try:
        start_time = time.time()
        
        try:
            # Decode Base64
            if "," in base64_string:
                base64_string = base64_string.split(",")[1]
            try:
                img_data = base64.b64decode(base64_string)
                nparr = np.frombuffer(img_data, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            except Exception:
                return # Bad Frame

            if frame is None:
                return

            # Analyze
            try:
                results = DeepFace.analyze(
                    frame, 
                    actions=['emotion'], 
                    detector_backend='opencv',
                    enforce_detection=False, 
                    silent=True
                )
                
                if results:
                    res = results[0]
                    raw_emotions = res['emotion']
                    region = res['region']
                    
                    # Logic
                    emotion, confidence = emotion_tracker.get_stable_emotion(raw_emotions)
                    raw_stress = calculate_weighted_stress(raw_emotions)
                    smoothed_stress = emotion_tracker.get_smoothed_score(raw_stress)
                    
                    # Update Global State
                    state["facial_emotion"] = emotion.capitalize()
                    state["facial_score"] = float(smoothed_stress)
                    state["facial_confidence"] = float(confidence)
                    logger.info(f"🎭 Face: {emotion} score={smoothed_stress:.1f} conf={confidence:.0f}%")
                    
                    # Emit Immediate Feedback + Full Sensor State
                    emit('frame_processed', {
                        'region': region, 
                        'score': state["facial_score"],
                        'emotion': state["facial_emotion"],
                        'confidence': state["facial_confidence"],
                        'is_smooth': True,
                        # Include sensor data so frontend updates via this reliable channel
                        'bpm': state["bpm"],
                        'body_temp': state["body_temp"],
                        'movement_level': state["movement_level"],
                        'audio_db': state["audio_db"],
                        'serial_status': state["serial_status"],
                        'prediction_result': state["prediction_result"],
                        'prediction_prob': state["prediction_prob"]
                    })
                    
            except ValueError:
                # No Face Detected
                # Slowly decay score
                state["facial_score"] = max(0, state["facial_score"] - 0.5)
                state["facial_emotion"] = "No Subject"
                
                emit('frame_processed', {
                    'region': None,
                    'score': state["facial_score"],
                    'emotion': "No Subject",
                    'confidence': 0.0,
                    'is_smooth': True,
                    'bpm': state["bpm"],
                    'body_temp': state["body_temp"],
                    'movement_level': state["movement_level"],
                    'audio_db': state["audio_db"],
                    'serial_status': state["serial_status"],
                    'prediction_result': state["prediction_result"],
                    'prediction_prob': state["prediction_prob"]
                })
                
        except Exception as e:
            logger.error(f"Frame Processing Error: {e}")

        logger.info(f"Frame processed in {time.time() - start_time:.3f}s")

    finally:
        processing_lock.release()

# ==========================================
# 4. AUDIO ANALYZER THREAD
# ==========================================
def audio_thread():
    if not HAS_PYAUDIO:
        state["mic_status"] = "No pyaudio"
        logger.warning("🎤 Audio thread disabled (pyaudio not installed)")
        return
    p = pyaudio.PyAudio()
    try:
        stream = p.open(format=pyaudio.paInt16,
                        channels=1,
                        rate=44100,
                        input=True,
                        frames_per_buffer=1024)
        
        state["mic_status"] = "Listening"
        logger.info("🎤 Microphone Started")

        while True:
            data = stream.read(1024, exception_on_overflow=False)
            rms = audioop.rms(data, 2)
            if rms > 0:
                db = 20 * np.log10(rms)
                state["audio_db"] = round(db, 1)
            time.sleep(0.1)

    except Exception as e:
        state["mic_status"] = "Error"
        logger.error(f"Mic Error: {e}")
    finally:
        p.terminate()

# ==========================================
# 5. SERIAL SENSOR THREAD (+ SIMULATOR)
# ==========================================

# Port selection state — managed via REST API from frontend
_selected_serial_port = None
_serial_thread_ref = None
_serial_stop_event = threading.Event()


@app.route('/api/ports', methods=['GET'])
def list_ports():
    """List available COM ports for frontend selection"""
    ports = list(serial.tools.list_ports.comports())
    esp_keywords = ["USB", "Arduino", "CH340", "CP210", "Silicon Labs", "ESP"]
    port_list = []
    for p in ports:
        is_esp = any(kw in p.description for kw in esp_keywords)
        port_list.append({
            "device": p.device,
            "description": p.description,
            "likely_esp32": is_esp,
        })
    return jsonify({
        "ports": port_list,
        "current": _selected_serial_port,
        "serial_status": state["serial_status"],
        "connected": state.get("serial_connected", False),
    })


@app.route('/api/ports/select', methods=['POST'])
def select_port_api():
    """Select a COM port or simulator from frontend, restart serial thread"""
    global _selected_serial_port, _serial_thread_ref
    
    data = request.get_json()
    port = data.get('port', '').strip()
    
    if not port:
        return jsonify({"error": "Port is required"}), 400
    
    # Validate port exists (unless simulator)
    if port != 'SIMULATOR':
        ports = list(serial.tools.list_ports.comports())
        port_devices = [p.device for p in ports]
        if port not in port_devices:
            return jsonify({"error": f"Port {port} not found", "available": port_devices}), 404
    
    # Stop existing serial thread and wait for it to release the port
    _serial_stop_event.set()
    if _serial_thread_ref and _serial_thread_ref.is_alive():
        _serial_thread_ref.join(timeout=5)
    time.sleep(1)
    _serial_stop_event.clear()
    
    # Reset connection state
    state["serial_connected"] = False
    state["body_temp"] = 0.0
    state["bpm"] = 0.0
    
    # Set new port and start new serial thread
    _selected_serial_port = port
    state["serial_status"] = "Connecting..."
    _serial_thread_ref = threading.Thread(target=serial_thread, daemon=True)
    _serial_thread_ref.start()
    
    # Wait briefly to check if connection succeeded
    time.sleep(3)
    
    current_status = state["serial_status"]
    if current_status.startswith("Error"):
        logger.error(f"Port connection failed: {current_status}")
        return jsonify({"success": False, "error": current_status, "port": port}), 500
    
    logger.info(f"Port selected via API: {port} -> {current_status}")
    return jsonify({"success": True, "port": port, "status": current_status, "connected": state["serial_connected"]})


def _check_cli_port():
    """Check command-line args for --port or --sim flags (optional convenience)"""
    global _selected_serial_port
    import sys
    args = sys.argv[1:]
    if '--simulator' in args or '--sim' in args:
        _selected_serial_port = "SIMULATOR"
        return True
    for i, arg in enumerate(args):
        if arg == '--port' and i + 1 < len(args):
            _selected_serial_port = args[i + 1]
            return True
    return False

def _run_simulator():
    """Generate realistic fake sensor data for testing without ESP32"""
    import math
    import random
    
    logger.info("🎮 SIMULATOR: Generating fake sensor data every 500ms")
    logger.info("🎮 SIMULATOR: BPM 60-100, Temp 36.0-37.5, Movement 0-5")
    
    sim_bpm = 72.0
    sim_temp = 36.5
    sim_move = 0.5
    tick = 0
    
    while True:
        try:
            tick += 1
            
            # Simulate realistic sensor drift
            sim_bpm += random.uniform(-2, 2)
            sim_bpm = max(55, min(110, sim_bpm))
            
            sim_temp += random.uniform(-0.1, 0.1)
            sim_temp = max(35.5, min(38.0, round(sim_temp, 1)))
            
            sim_move += random.uniform(-0.3, 0.3)
            sim_move = max(0, min(8, round(sim_move, 1)))
            
            # Occasional stress spikes (every ~30 seconds)
            if tick % 60 == 0:
                sim_bpm = random.uniform(85, 105)
                sim_move = random.uniform(2, 5)
                logger.info("🎮 SIMULATOR: Stress spike!")
            
            # Calculate derived values
            ax = random.uniform(-0.5, 0.5)
            ay = random.uniform(-0.5, 0.5)
            az = 9.8 + random.uniform(-0.3, 0.3)
            magnitude = math.sqrt(ax**2 + ay**2 + az**2)
            movement = abs(magnitude - 9.8) + sim_move
            movement = min(10, round(movement, 1))
            
            # Update global state (same as real serial_thread)
            state["bpm"] = round(sim_bpm, 0)
            state["hrv"] = max(0, round(120.0 - sim_bpm, 1))
            state["body_temp"] = sim_temp
            state["accel_x"] = round(ax, 2)
            state["accel_y"] = round(ay, 2)
            state["accel_z"] = round(az, 2)
            state["movement_level"] = movement
            state["heart_signal"] = random.randint(1800, 3000)
            state["leads_off"] = False
            state["last_serial_update"] = time.time()
            
            if tick % 10 == 1:
                logger.info(f"🎮 SIM: BPM={state['bpm']}, Temp={state['body_temp']}°C, Move={state['movement_level']}, HRV={state['hrv']}")
            
            time.sleep(0.5)
            
        except Exception as e:
            logger.error(f"🎮 Simulator error: {e}")
            time.sleep(1)

def serial_thread():
    """Read JSON sensor data from ESP32 via serial port, or simulate if not found"""
    import math
    import traceback
    import random
    
    global _selected_serial_port
    
    try:
        # Use the port selected via API or CLI
        selected_port = _selected_serial_port
        
        if selected_port == "SIMULATOR":
            logger.info("Starting SIMULATOR mode...")
            state["serial_status"] = "Simulator Mode"
            _run_simulator()
            return
                
        if not selected_port:
            # No port selected yet — wait for frontend to select one
            state["serial_status"] = "Waiting for port selection..."
            logger.info("No port selected. Waiting for frontend to select via /api/ports/select...")
            while not _selected_serial_port and not _serial_stop_event.is_set():
                time.sleep(0.5)
            if _serial_stop_event.is_set():
                return
            # Restart with the newly selected port
            serial_thread()
            return
        
        # ESP32 runs at 115200 baud
        ser = None
        try:
            ser = serial.Serial(selected_port, 115200, timeout=1)
        except (PermissionError, serial.SerialException) as e:
            logger.error(f"❌ Cannot open {selected_port}: {e}")
            logger.info(f"🔄 Retrying in 3 seconds (port may still be locked)...")
            time.sleep(3)
            try:
                ser = serial.Serial(selected_port, 115200, timeout=1)
            except Exception as e2:
                state["serial_status"] = f"Error: Port {selected_port} access denied"
                state["serial_connected"] = False
                logger.error(f"❌ Retry failed for {selected_port}: {e2}")
                return
        
        state["serial_status"] = f"Connected ({selected_port})"
        state["serial_connected"] = True
        logger.info(f"🔌 Serial Connected: {selected_port} at 115200 baud")
        
        try:
            # Wait for ESP32 to boot after serial reset
            time.sleep(2)
            
            # Flush any boot messages
            ser.reset_input_buffer()
            logger.info("🔌 Serial buffer flushed, waiting for data...")
            
            line_count = 0
            json_count = 0
            boot_error_count = 0
            no_json_timeout = time.time()
            
            while not _serial_stop_event.is_set():
                try:
                    if ser.in_waiting > 0:
                        line = ser.readline().decode('utf-8', errors='ignore').strip()
                        
                        if not line:
                            continue
                        
                        line_count += 1
                        
                        # Detect ESP32 boot loop / flash corruption
                        if "invalid header" in line or "boot:" in line or "rst:0x" in line or "RTCWDT" in line:
                            boot_error_count += 1
                            if boot_error_count <= 5:
                                logger.warning(f"⚠️ ESP32 boot message [{boot_error_count}]: {line[:100]}")
                            if boot_error_count >= 5:
                                state["serial_status"] = f"ESP32 Boot Error ({selected_port}) - Re-flash firmware!"
                                state["serial_connected"] = False
                                logger.error(f"❌ ESP32 is in a boot loop! Flash is corrupted. Re-upload firmware via Arduino IDE.")
                                # Keep trying — the ESP32 might recover
                                time.sleep(2)
                                ser.reset_input_buffer()
                                boot_error_count = 0
                                continue
                        
                        # Log first 10 raw lines to diagnose format
                        if line_count <= 10:
                            logger.info(f"📥 Serial Raw [{line_count}]: {line[:100]}")
                        
                        # Try to parse JSON from ESP32
                        if line.startswith('{') and line.endswith('}'):
                            try:
                                data = json.loads(line)
                                state["last_serial_update"] = time.time()
                                json_count += 1
                                
                                # Restore connection status if we were in boot error
                                if not state["serial_connected"] or "Boot Error" in state.get("serial_status", ""):
                                    state["serial_status"] = f"Connected ({selected_port})"
                                    state["serial_connected"] = True
                                    logger.info(f"🔌 ESP32 recovered! Now receiving valid JSON data.")
                                
                                # Remove stale marker when fresh data arrives
                                if "(Stale)" in state.get("serial_status", ""):
                                    state["serial_status"] = f"Connected ({selected_port})"
                                
                                # Parse accelerometer data
                                if 'accel' in data:
                                    accel = data['accel']
                                    state["accel_x"] = accel.get('x', 0)
                                    state["accel_y"] = accel.get('y', 0)
                                    state["accel_z"] = accel.get('z', 0)
                                    
                                    # Calculate movement level (0-10 scale)
                                    magnitude = math.sqrt(
                                        state["accel_x"]**2 + 
                                        state["accel_y"]**2 + 
                                        state["accel_z"]**2
                                    )
                                    movement = abs(magnitude - 9.8)
                                    state["movement_level"] = min(10, round(movement, 1))
                                
                                # Parse temperature data
                                if 'temp' in data:
                                    temp = data['temp']
                                    body_temp = temp.get('body', 0)
                                    if body_temp and not math.isnan(body_temp) and 20 < body_temp < 45:
                                        state["body_temp"] = round(body_temp, 1)
                                
                                # Parse heart rate data
                                if 'heart' in data:
                                    heart = data['heart']
                                    state["heart_signal"] = heart.get('signal', 0)
                                    state["leads_off"] = heart.get('leads_off', True)
                                    
                                    bpm = heart.get('bpm', 0)
                                    if bpm > 0:
                                        state["bpm"] = bpm
                                        state["hrv"] = max(0, 120.0 - state["bpm"])
                                        
                                # Log every 10th JSON reading
                                if json_count % 10 == 1:
                                    logger.info(f"📊 Sensor: BPM={state['bpm']}, Temp={state['body_temp']}°C, Move={state['movement_level']}, LeadsOff={state['leads_off']}")
                                    
                            except json.JSONDecodeError as e:
                                if line_count <= 20:
                                    logger.warning(f"⚠️ JSON parse error: {e} | Line: {line[:80]}")
                                
                        # Fallback: Legacy BPM format
                        elif "BPM:" in line:
                            try:
                                val = float(line.split("BPM:")[1].strip().split()[0])
                                if val > 0:
                                    state["bpm"] = val
                                    state["hrv"] = 120.0 - state["bpm"]
                                    state["last_serial_update"] = time.time()
                            except:
                                pass
                        
                        # Fallback: CSV format "temp,accelX,accelY,accelZ,heartSignal"
                        elif "," in line:
                            try:
                                parts = line.split(",")
                                if len(parts) >= 3:
                                    # Try to parse as numbers
                                    vals = [float(p.strip()) for p in parts if p.strip()]
                                    if len(vals) >= 1:
                                        state["last_serial_update"] = time.time()
                                        if line_count <= 20:
                                            logger.info(f"📥 CSV fallback: {vals}")
                            except:
                                pass
                                
                    time.sleep(0.05)  # 20 Hz polling
                    
                except (PermissionError, serial.SerialException) as e:
                    logger.error(f"❌ Serial connection lost: {e}")
                    state["serial_status"] = f"Disconnected ({selected_port})"
                    state["serial_connected"] = False
                    break
                except Exception as e:
                    logger.error(f"❌ Serial read error: {e}")
                    time.sleep(0.5)
        finally:
            # ALWAYS close the serial port to release the lock
            if ser and ser.is_open:
                ser.close()
                logger.info(f"🔌 Serial port {selected_port} closed cleanly")
            state["serial_connected"] = False
                
    except Exception as e:
        state["serial_status"] = f"Error: {str(e)[:80]}"
        state["serial_connected"] = False
        state["body_temp"] = 0.0
        state["bpm"] = 0.0
        logger.error(f"Serial Thread Error: {e}")
        logger.error(traceback.format_exc())

# ==========================================
# 6. AI PREDICTOR BRAIN
# ==========================================
def predictor_thread():
    # Load Artifacts
    ARTIFACTS_DIR = 'model_artifacts'
    if os.path.exists(ARTIFACTS_DIR):
        files = os.listdir(ARTIFACTS_DIR)
        if len(files) == 1 and os.path.isdir(os.path.join(ARTIFACTS_DIR, files[0])):
            ARTIFACTS_DIR = os.path.join(ARTIFACTS_DIR, files[0])

    model, scaler, metadata = None, None, None

    try:
        files = os.listdir(ARTIFACTS_DIR)
        model_file = next((f for f in files if f.endswith('.h5')), None)
        scaler_file = next((f for f in files if f.endswith('_scaler.pkl')), None)
        metadata_file = next((f for f in files if f.endswith('_metadata.json')), None)
        
        if all([model_file, scaler_file, metadata_file]):
            model = keras.models.load_model(os.path.join(ARTIFACTS_DIR, model_file))
            scaler = joblib.load(os.path.join(ARTIFACTS_DIR, scaler_file))
            with open(os.path.join(ARTIFACTS_DIR, metadata_file), 'r') as f:
                metadata = json.load(f)
            state["model_status"] = "Ready"
            logger.info("✅ AI Model Loaded Successfully")
        else:
            raise Exception("Missing artifact files")
    except Exception as e:
        logger.error(f"❌ Model Loading Failed: {e}")
        state["model_status"] = "Failed"

    logger.info("🧠 AI Brain Started")
    
    broadcast_count = 0
    
    while True:
        try:
            # Run prediction if model is ready
            if state["model_status"] == "Ready" and model and scaler and metadata:
                try:
                    input_cols = metadata['columns']
                    input_data = {col: 0 for col in input_cols}
                    
                    # Map Live Data from ESP32 sensors
                    if 'Heart_Rate_bpm' in input_cols: input_data['Heart_Rate_bpm'] = state["bpm"]
                    if 'Body_Temperature_C' in input_cols: input_data['Body_Temperature_C'] = state["body_temp"]
                    if 'Speech_Noise_dB' in input_cols: input_data['Speech_Noise_dB'] = state["audio_db"]
                    if 'ECG_Variability' in input_cols: input_data['ECG_Variability'] = state["hrv"]
                    if 'Movement_Level' in input_cols: input_data['Movement_Level'] = state["movement_level"]
                    if 'Facial_Stress_Score' in input_cols: input_data['Facial_Stress_Score'] = state["facial_score"]
                    if 'Age' in input_cols: input_data['Age'] = 25
                    
                    # Encodings
                    for col in input_cols:
                        if 'Gender_Female' in col: input_data[col] = 1
                        if 'Province_Western' in col: input_data[col] = 1
                    
                    # Predict
                    df_live = pd.DataFrame([input_data])[input_cols]
                    X_live = scaler.transform(df_live)
                    prob = model.predict(X_live, verbose=0)[0][0]
                    
                    state["prediction_prob"] = float(prob)
                    state["prediction_result"] = "Normal" if prob > 0.5 else "Non-Normal"

                    # Log prediction every 20th cycle (~10 seconds)
                    if broadcast_count % 20 == 0:
                        logger.info(f"🧠 ML Predict: {state['prediction_result']} (prob={prob:.4f}) | Inputs: BPM={state['bpm']} Temp={state['body_temp']} Move={state['movement_level']} Face={state['facial_score']} Audio={state['audio_db']}")
                    
                except Exception as e:
                    logger.error(f"Prediction Error: {e}")
            
            # ALWAYS broadcast state (even if prediction failed)
            broadcast_count += 1
            socketio.emit('mindguard_update', state)
            
            # Log every 10th broadcast - now includes prediction
            if broadcast_count % 10 == 1:
                logger.info(f"📡 Broadcast #{broadcast_count}: BPM={state['bpm']} Temp={state['body_temp']} Move={state['movement_level']} Face={state['facial_score']}/{state['facial_emotion']} Pred={state['prediction_result']}({state['prediction_prob']:.3f}) Serial={state['serial_status']}")
            
            # Timeout Logic: stale sensor data
            now = time.time()
            if now - state.get("last_serial_update", 0) > 10.0:
                if state["serial_status"].startswith("Connected") and "(Stale)" not in state["serial_status"]:
                    state["serial_status"] = state["serial_status"] + " (Stale)"
                
        except Exception as e:
            logger.error(f"❌ Predictor Error: {e}")
            
        time.sleep(0.5) # 2 Hz Broadcast rate

# ==========================================
# 7. MAIN ENTRY
# ==========================================
@app.route('/')
def index():
    return "MindGuard Unified AI Server Running..."

@app.route('/api/state')
def get_state():
    """REST endpoint for guaranteed state polling - bypasses Socket.IO issues"""
    from flask import jsonify, make_response
    response = make_response(jsonify(state))
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET'
    return response

@app.route('/api/predict', methods=['POST', 'OPTIONS'])
def predict_session():
    """
    Run ML prediction on session averages.
    Expects JSON body: {
        body_temp, heart_rate, speech_noise_db, movement_level,
        ecg_variability, facial_stress_score, age, gender, province
    }
    Returns: { prediction: "Normal"|"Non-Normal", probability: float, input_used: {...} }
    """
    from flask import jsonify, make_response
    
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        resp = make_response()
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return resp
    
    try:
        data = request.get_json()
        if not data:
            resp = make_response(jsonify({"error": "No data provided"}), 400)
            resp.headers['Access-Control-Allow-Origin'] = '*'
            return resp
        
        # Load model artifacts (reuse from predictor_thread logic)
        ARTIFACTS_DIR = 'model_artifacts'
        if os.path.exists(ARTIFACTS_DIR):
            dir_files = os.listdir(ARTIFACTS_DIR)
            if len(dir_files) == 1 and os.path.isdir(os.path.join(ARTIFACTS_DIR, dir_files[0])):
                ARTIFACTS_DIR = os.path.join(ARTIFACTS_DIR, dir_files[0])
        
        dir_files = os.listdir(ARTIFACTS_DIR)
        model_file = next((f for f in dir_files if f.endswith('.h5')), None)
        scaler_file = next((f for f in dir_files if f.endswith('_scaler.pkl')), None)
        metadata_file = next((f for f in dir_files if f.endswith('_metadata.json')), None)
        
        if not all([model_file, scaler_file, metadata_file]):
            resp = make_response(jsonify({"error": "Model artifacts not found"}), 500)
            resp.headers['Access-Control-Allow-Origin'] = '*'
            return resp
        
        model = keras.models.load_model(os.path.join(ARTIFACTS_DIR, model_file))
        scaler = joblib.load(os.path.join(ARTIFACTS_DIR, scaler_file))
        with open(os.path.join(ARTIFACTS_DIR, metadata_file), 'r') as f:
            metadata = json.load(f)
        
        input_cols = metadata['columns']
        input_data = {col: 0 for col in input_cols}
        
        # Map session data
        if 'Heart_Rate_bpm' in input_cols:
            input_data['Heart_Rate_bpm'] = float(data.get('heart_rate', 75))
        if 'Body_Temperature_C' in input_cols:
            input_data['Body_Temperature_C'] = float(data.get('body_temp', 36.5))
        if 'Speech_Noise_dB' in input_cols:
            input_data['Speech_Noise_dB'] = float(data.get('speech_noise_db', 40))
        if 'ECG_Variability' in input_cols:
            input_data['ECG_Variability'] = float(data.get('ecg_variability', 50))
        if 'Movement_Level' in input_cols:
            input_data['Movement_Level'] = float(data.get('movement_level', 0))
        if 'Facial_Stress_Score' in input_cols:
            input_data['Facial_Stress_Score'] = float(data.get('facial_stress_score', 0))
        if 'Age' in input_cols:
            input_data['Age'] = int(data.get('age', 12))
        
        # Gender encoding
        gender = data.get('gender', 'Female')
        for col in input_cols:
            if f'Gender_{gender}' in col:
                input_data[col] = 1
        
        # Province encoding
        province = data.get('province', 'Western')
        for col in input_cols:
            if f'Province_{province}' in col:
                input_data[col] = 1
        
        # Run prediction
        df_live = pd.DataFrame([input_data])[input_cols]
        X_live = scaler.transform(df_live)
        prob = float(model.predict(X_live, verbose=0)[0][0])
        
        result = {
            "prediction": "Normal" if prob > 0.5 else "Non-Normal",
            "probability": round(prob, 4),
            "confidence": round(abs(prob - 0.5) * 200, 1),
            "input_used": {
                "heart_rate": input_data.get('Heart_Rate_bpm', 0),
                "body_temp": input_data.get('Body_Temperature_C', 0),
                "speech_noise_db": input_data.get('Speech_Noise_dB', 0),
                "movement_level": input_data.get('Movement_Level', 0),
                "ecg_variability": input_data.get('ECG_Variability', 0),
                "facial_stress_score": input_data.get('Facial_Stress_Score', 0),
                "age": input_data.get('Age', 0),
                "gender": gender,
                "province": province
            }
        }
        
        logger.info(f"🧠 Predict API: {result['prediction']} (prob={result['probability']}, conf={result['confidence']}%)")
        
        resp = make_response(jsonify(result))
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp
        
    except Exception as e:
        logger.error(f"❌ Predict API Error: {e}")
        resp = make_response(jsonify({"error": str(e)}), 500)
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp

if __name__ == '__main__':
    import sys
    import io
    # Force UTF-8 output on Windows
    if sys.platform == 'win32':
        try:
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        except Exception:
            pass
    
    # Check CLI args for --port or --sim (optional shortcut)
    _check_cli_port()
    
    # Start Background Threads
    threading.Thread(target=audio_thread, daemon=True).start()
    _serial_thread_ref = threading.Thread(target=serial_thread, daemon=True)
    _serial_thread_ref.start()
    threading.Thread(target=predictor_thread, daemon=True).start()
    
    if _selected_serial_port:
        print(f"\nMindGuard AI Server starting on http://localhost:5000  (port: {_selected_serial_port})")
    else:
        print(f"\nMindGuard AI Server starting on http://localhost:5000  (no port selected -- use frontend)")
    print("   async_mode = threading (DeepFace won't block event loop)\n")
    socketio.run(app, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)

