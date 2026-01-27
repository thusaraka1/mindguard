import cv2
import threading
import time
import json
import logging
import os
import joblib
import numpy as np
import pandas as pd
from flask import Flask
from flask_socketio import SocketIO
from deepface import DeepFace
import pyaudio
import audioop
import serial
import serial.tools.list_ports
import tensorflow as tf
from tensorflow import keras

# ==========================================
# 1. SETUP & CONFIG
# ==========================================
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("MindGuard")

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# Global State
state = {
    # Inputs
    "bpm": 70.0,              # Default Normal
    "hrv": 50.0,              # Default Normal
    "audio_db": 40.0,         # Quiet
    "facial_score": 0,        # Neutral
    "facial_emotion": "Neutral",
    
    # Output
    "prediction_result": "Normal",
    "prediction_prob": 0.0,
    
    # System Status
    "serial_status": "Disconnected",
    "camera_status": "Disconnected",
    "mic_status": "Disconnected", 
    "model_status": "Loading..."
}

# Load Artifacts
ARTIFACTS_DIR = 'model_artifacts'

# Handle nested zip structure if exists
if os.path.exists(ARTIFACTS_DIR):
    files = os.listdir(ARTIFACTS_DIR)
    if len(files) == 1 and os.path.isdir(os.path.join(ARTIFACTS_DIR, files[0])):
        ARTIFACTS_DIR = os.path.join(ARTIFACTS_DIR, files[0])

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

# ==========================================
# 2. AUDIO ANALYZER
# ==========================================
def audio_thread():
    p = pyaudio.PyAudio()
    try:
        # Default input device
        stream = p.open(format=pyaudio.paInt16,
                        channels=1,
                        rate=44100,
                        input=True,
                        frames_per_buffer=1024)
        
        state["mic_status"] = "Listening"
        logger.info("🎤 Microphone Started")

        while True:
            data = stream.read(1024, exception_on_overflow=False)
            rms = audioop.rms(data, 2)  # Calculate RMS
            if rms > 0:
                db = 20 * np.log10(rms)  # Convert to decibels
                state["audio_db"] = round(db, 1)
            time.sleep(0.1)

    except Exception as e:
        state["mic_status"] = "Error"
        logger.error(f"Mic Error: {e}")
    finally:
        p.terminate()

# ==========================================
# 3. SERIAL SENSOR (AD8232)
# ==========================================
def serial_thread():
    # Auto-detect COM port?
    ports = list(serial.tools.list_ports.comports())
    selected_port = None
    
    # Try to find common Arduino/USB Serial ports
    for p in ports:
        if "USB" in p.description or "Arduino" in p.description or "CH340" in p.description:
            selected_port = p.device
            break
            
    if not selected_port:
        # Fallback to fixed if user knows it (e.g., COM3)
        # For now, if no port, we stay disconnected
        logger.warning("⚠️ No Sensor Port Found. Using simulated Heart Rate.")
        pass
    else:
        try:
            ser = serial.Serial(selected_port, 9600, timeout=1)
            state["serial_status"] = f"Connected ({selected_port})"
            logger.info(f"🔌 Serial Connected: {selected_port}")
            
            while True:
                if ser.in_waiting > 0:
                    line = ser.readline().decode('utf-8').strip()
                    # Expected format: "BPM:78" or "78"
                    # We accept raw number or prefixed
                    val = 0
                    if "BPM:" in line:
                        val = float(line.split("BPM:")[1])
                    else:
                        # Try parsing raw number
                        try:
                            val = float(line)
                        except: pass
                        
                    if val > 0:
                        state["bpm"] = val
                        # Estimate HRV based on calmness (Simulated from BPM stability if sensor doesn't give it)
                        # Ideally Arduino sends "BPM:78,HRV:50"
                        
                    # Simulate HRV for now if not provided
                    state["hrv"] = 120.0 - state["bpm"] # Rough inverse approximation
                    
                time.sleep(0.1)
                
        except Exception as e:
            state["serial_status"] = "Error"
            logger.error(f"Serial Error: {e}")

# ==========================================
# 4. FACIAL ANALYZER
# ==========================================
def facial_thread():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        state["camera_status"] = "Error"
        logger.error("❌ Camera Not Found")
        return
        
    state["camera_status"] = "Active"
    logger.info("📷 Camera Started")

    while True:
        ret, frame = cap.read()
        if not ret: continue
        
        try:
            # Analyze every 1 sec
            results = DeepFace.analyze(frame, actions=['emotion'], enforce_detection=False, silent=True)
            if results:
                emotion = results[0]['dominant_emotion']
                state["facial_emotion"] = emotion
                
                # Map Score
                emo = emotion.lower()
                if emo in ['happy', 'neutral']: score = 2
                elif emo in ['surprise']: score = 5
                elif emo in ['sad', 'disgust']: score = 8
                elif emo in ['fear', 'angry']: score = 12
                else: score = 4
                state["facial_score"] = score
        except:
            pass
            
        time.sleep(1.0) # 1 FPS

# ==========================================
# 5. MAIN AI PREDICTION LOOP
# ==========================================
def predictor_thread():
    logger.info("🧠 AI Brain Started")
    
    while True:
        if state["model_status"] != "Ready":
            time.sleep(2)
            continue
            
        try:
            # Prepare Input Vector based on Metadata
            input_cols = metadata['columns']
            input_data = {}
            
            # Fill safe defaults
            for col in input_cols:
                input_data[col] = 0
                
            # Map Real-Time State to Model Inputs
            # Adapt these mappings based on EXACT column names in metadata
            
            # Direct Mappings
            if 'Heart_Rate_bpm' in input_cols: input_data['Heart_Rate_bpm'] = state["bpm"]
            if 'Body_Temperature_C' in input_cols: input_data['Body_Temperature_C'] = 36.5 # Fixed for now
            if 'Speech_Noise_dB' in input_cols: input_data['Speech_Noise_dB'] = state["audio_db"]
            if 'ECG_Variability' in input_cols: input_data['ECG_Variability'] = state["hrv"]
            if 'Facial_Stress_Score' in input_cols: input_data['Facial_Stress_Score'] = state["facial_score"]
            if 'Movement_Level' in input_cols: input_data['Movement_Level'] = 10 # Default
            if 'Age' in input_cols: input_data['Age'] = 25
            
            # Gender/Province Encoding (Use defaults)
            for col in input_cols:
                if 'Gender_Female' in col: input_data[col] = 1 # Default Female
                if 'Province_Western' in col: input_data[col] = 1
            
            # Create DataFrame
            df_live = pd.DataFrame([input_data])
            df_live = df_live[input_cols] # Enforce order
            
            # Scale
            X_live = scaler.transform(df_live)
            
            # Predict
            prob = model.predict(X_live, verbose=0)[0][0]
            
            state["prediction_prob"] = float(prob)
            state["prediction_result"] = "Normal" if prob > 0.5 else "Non-Normal"
            
            # Broadcast to Frontend
            socketio.emit('mindguard_update', state)
            
            # Log periodically
            # logger.info(f"Pred: {state['prediction_result']} ({prob:.2f}) | BPM: {state['bpm']} | Face: {state['facial_score']}")
            
        except Exception as e:
            logger.error(f"Prediction Loop Error: {e}")
            
        time.sleep(1.0) # 1 Hz Update Rate

# ==========================================
# 6. SERVER START
# ==========================================
@app.route('/')
def index():
    return "MindGuard Full AI Server Running..."

if __name__ == '__main__':
    # Start Threads
    threading.Thread(target=audio_thread, daemon=True).start()
    threading.Thread(target=serial_thread, daemon=True).start()
    threading.Thread(target=facial_thread, daemon=True).start()
    threading.Thread(target=predictor_thread, daemon=True).start()
    
    print("\n🚀 MindGuard AI Server starting on http://localhost:5000\n")
    socketio.run(app, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)
