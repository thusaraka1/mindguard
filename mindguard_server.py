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
from flask import Flask, request
from flask_socketio import SocketIO, emit
# Patch for DeepFace/TF compatibility
import tensorflow as tf
import keras
try:
    tf.keras = keras
except:
    pass
from deepface import DeepFace
import pyaudio
import audioop
import serial
import serial.tools.list_ports
import tensorflow as tf
from tensorflow import keras
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("MindGuard")

app = Flask(__name__)
# Initialize SocketIO with increased buffer size for video frames
socketio = SocketIO(app, cors_allowed_origins="*", max_http_buffer_size=10000000)

# Global State
state = {
    # Inputs
    "bpm": 70.0,              # Default Normal
    "hrv": 50.0,              # Default Normal
    "audio_db": 40.0,         # Quiet
    "facial_score": 0,        # Neutral (0-14 scale)
    "facial_emotion": "Neutral",
    "facial_confidence": 0.0,
    
    # Output
    "prediction_result": "Normal",
    "prediction_prob": 0.0,
    
    # System Status
    "serial_status": "Disconnected",
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
    logger.info(f"Client Connected: {request.sid}")
    emit('mindguard_update', state)

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"Client Disconnected: {request.sid}")

@socketio.on('process_frame')
def handle_frame(base64_string):
    # Drop frame if already processing
    if processing_lock.locked():
        return

    with processing_lock:
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
                    enforce_detection=True, 
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
                    
                    # Emit Immediate Feedback (for Video Overlay)
                    emit('frame_processed', {
                        'region': region, 
                        'score': state["facial_score"],
                        'emotion': state["facial_emotion"],
                        'confidence': state["facial_confidence"],
                        'is_smooth': True
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
                    'is_smooth': True
                })
                
        except Exception as e:
            logger.error(f"Frame Processing Error: {e}")

# ==========================================
# 4. AUDIO ANALYZER THREAD
# ==========================================
def audio_thread():
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
# 5. SERIAL SENSOR THREAD
# ==========================================
def serial_thread():
    ports = list(serial.tools.list_ports.comports())
    selected_port = None
    
    for p in ports:
        if "USB" in p.description or "Arduino" in p.description or "CH340" in p.description:
            selected_port = p.device
            break
            
    if not selected_port:
        logger.warning("⚠️ No Sensor Port Found. Using simulated Heart Rate.")
    else:
        try:
            ser = serial.Serial(selected_port, 9600, timeout=1)
            state["serial_status"] = f"Connected ({selected_port})"
            logger.info(f"🔌 Serial Connected: {selected_port}")
            
            while True:
                if ser.in_waiting > 0:
                    line = ser.readline().decode('utf-8').strip()
                    try:
                        val = 0
                        if "BPM:" in line:
                            val = float(line.split("BPM:")[1])
                        else:
                            val = float(line)
                            
                        if val > 0:
                            state["bpm"] = val
                            state["hrv"] = 120.0 - state["bpm"] # Rough approx
                    except: pass
                time.sleep(0.1)
                
        except Exception as e:
            state["serial_status"] = "Error"
            logger.error(f"Serial Error: {e}")

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
    
    while True:
        if state["model_status"] == "Ready":
            try:
                input_cols = metadata['columns']
                input_data = {col: 0 for col in input_cols}
                
                # Map Live Data
                if 'Heart_Rate_bpm' in input_cols: input_data['Heart_Rate_bpm'] = state["bpm"]
                if 'Body_Temperature_C' in input_cols: input_data['Body_Temperature_C'] = 36.5
                if 'Speech_Noise_dB' in input_cols: input_data['Speech_Noise_dB'] = state["audio_db"]
                if 'ECG_Variability' in input_cols: input_data['ECG_Variability'] = state["hrv"]
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
                
                # Broadcast Full State
                socketio.emit('mindguard_update', state)
                
            except Exception as e:
                logger.error(f"Prediction Error: {e}")
                
        time.sleep(1.0) # 1 Hz Broadcast

# ==========================================
# 7. MAIN ENTRY
# ==========================================
@app.route('/')
def index():
    return "MindGuard Unified AI Server Running..."

if __name__ == '__main__':
    # Start Background Threads
    threading.Thread(target=audio_thread, daemon=True).start()
    threading.Thread(target=serial_thread, daemon=True).start()
    threading.Thread(target=predictor_thread, daemon=True).start()
    
    print("\n🚀 MindGuard Unified AI Server starting on http://localhost:5000\n")
    socketio.run(app, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)
