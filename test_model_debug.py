"""
Quick diagnostic: test the ML model with various inputs to see why it always predicts Normal.
"""
import os, json, joblib
import numpy as np
import pandas as pd
import tensorflow as tf
import keras

ARTIFACTS_DIR = 'model_artifacts'

# Load artifacts
files = os.listdir(ARTIFACTS_DIR)
model_file = next(f for f in files if f.endswith('.h5'))
scaler_file = next(f for f in files if f.endswith('_scaler.pkl'))
metadata_file = next(f for f in files if f.endswith('_metadata.json'))

model = keras.models.load_model(os.path.join(ARTIFACTS_DIR, model_file))
scaler = joblib.load(os.path.join(ARTIFACTS_DIR, scaler_file))
with open(os.path.join(ARTIFACTS_DIR, metadata_file)) as f:
    metadata = json.load(f)

input_cols = metadata['columns']
classes = metadata['classes']

print(f"Model input columns: {input_cols}")
print(f"Classes: {classes}")
print(f"classes[0]={classes[0]}, classes[1]={classes[1]}")
print(f"Model output shape: {model.output_shape}")
print()

# Print scaler stats
print("=== SCALER (mean / scale) ===")
for i, col in enumerate(input_cols):
    print(f"  {col:30s}  mean={scaler.mean_[i]:.4f}  scale={scaler.scale_[i]:.4f}")
print()

# Test cases
test_cases = [
    {"name": "Normal child",       "Age": 12, "Heart_Rate_bpm": 80,  "Body_Temperature_C": 36.8, "Speech_Noise_dB": 45, "Movement_Level": 1.0, "ECG_Variability": 40, "Facial_Stress_Score": 2.0, "Gender_Female": 1, "Gender_Male": 0, "Province_Western": 1},
    {"name": "High HR (161BPM)",   "Age": 24, "Heart_Rate_bpm": 161, "Body_Temperature_C": 37.2, "Speech_Noise_dB": 47, "Movement_Level": 1.0, "ECG_Variability": 50, "Facial_Stress_Score": 0.9, "Gender_Male": 1, "Gender_Female": 0, "Province_North Western": 1},
    {"name": "Very stressed",      "Age": 10, "Heart_Rate_bpm": 140, "Body_Temperature_C": 38.5, "Speech_Noise_dB": 80, "Movement_Level": 8.0, "ECG_Variability": 90, "Facial_Stress_Score": 12.0, "Gender_Female": 1, "Gender_Male": 0, "Province_Western": 1},
    {"name": "Extreme abnormal",   "Age": 8,  "Heart_Rate_bpm": 200, "Body_Temperature_C": 40.0, "Speech_Noise_dB": 95, "Movement_Level": 10,  "ECG_Variability": 100,"Facial_Stress_Score": 14.0, "Gender_Male": 1, "Gender_Female": 0, "Province_Central": 1},
    {"name": "Calm baseline",      "Age": 30, "Heart_Rate_bpm": 60,  "Body_Temperature_C": 36.5, "Speech_Noise_dB": 35, "Movement_Level": 0.2, "ECG_Variability": 60, "Facial_Stress_Score": 1.0, "Gender_Female": 1, "Gender_Male": 0, "Province_Southern": 1},
    {"name": "All zeros",          "Age": 0,  "Heart_Rate_bpm": 0,   "Body_Temperature_C": 0,    "Speech_Noise_dB": 0,  "Movement_Level": 0,   "ECG_Variability": 0,  "Facial_Stress_Score": 0,   "Gender_Female": 0, "Gender_Male": 0},
]

print("=== PREDICTIONS ===")
for tc in test_cases:
    name = tc.pop("name")
    input_data = {col: 0 for col in input_cols}
    for k, v in tc.items():
        if k in input_data:
            input_data[k] = v
    
    df = pd.DataFrame([input_data])[input_cols]
    X = scaler.transform(df)
    raw_prob = model.predict(X, verbose=0)[0]
    
    if len(raw_prob) == 1:
        prob = float(raw_prob[0])
        pred = classes[1] if prob > 0.5 else classes[0]
        print(f"  {name:25s} -> raw_output={prob:.6f}  pred={pred:12s}  (sigmoid: >0.5={classes[1]}, <0.5={classes[0]})")
    else:
        prob_0 = float(raw_prob[0])
        prob_1 = float(raw_prob[1])
        pred_idx = np.argmax(raw_prob)
        print(f"  {name:25s} -> raw=[{prob_0:.6f}, {prob_1:.6f}]  pred={classes[pred_idx]:12s}  (argmax={pred_idx})")

print()

# Also check model summary
print("=== MODEL SUMMARY ===")
model.summary()
