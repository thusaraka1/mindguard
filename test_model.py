import os
import json
import joblib
import pandas as pd
import numpy as np
import tensorflow as tf
from tensorflow import keras

# 1. SETUP PATHS
ARTIFACTS_DIR = 'model_artifacts'
# Find the specific files (since they have timestamps)
files = os.listdir(ARTIFACTS_DIR)
# Handle nested directory from zip
if len(files) == 1 and os.path.isdir(os.path.join(ARTIFACTS_DIR, files[0])):
    ARTIFACTS_DIR = os.path.join(ARTIFACTS_DIR, files[0])
    files = os.listdir(ARTIFACTS_DIR)
    print(f"Files found in nested dir {ARTIFACTS_DIR}: {files}")

model_file = next((f for f in files if f.endswith('.h5')), None)
scaler_file = next((f for f in files if f.endswith('_scaler.pkl')), None)
metadata_file = next((f for f in files if f.endswith('_metadata.json')), None)

if not all([model_file, scaler_file, metadata_file]):
    print("Error: Could not find all required files (.h5, .pkl, .json) in model_artifacts/")
    exit(1)

print(f"Loading Model: {model_file}")
print(f"Loading Scaler: {scaler_file}")
print(f"Loading Metadata: {metadata_file}")

# 2. LOAD ARTIFACTS
full_model_path = os.path.join(ARTIFACTS_DIR, model_file)
full_scaler_path = os.path.join(ARTIFACTS_DIR, scaler_file)
full_metadata_path = os.path.join(ARTIFACTS_DIR, metadata_file)

try:
    model = keras.models.load_model(full_model_path)
    scaler = joblib.load(full_scaler_path)
    with open(full_metadata_path, 'r') as f:
        metadata = json.load(f)
except Exception as e:
    print(f"Failed to load artifacts: {e}")
    exit(1)

print("\n--- Model Loaded Successfully ---")
input_columns = metadata['columns']
print(f"Expecting {len(input_columns)} input features.")

# 3. CREATE SAMPLE DATA
# We will create a dummy row with reasonable values
sample_data = {}
for col in input_columns:
    if 'Age' in col: sample_data[col] = 25
    elif 'Heart_Rate' in col: sample_data[col] = 80
    elif 'Body_Temperature' in col: sample_data[col] = 36.5
    elif 'Speech_Noise' in col: sample_data[col] = 40
    elif 'Movement_Level' in col: sample_data[col] = 10
    elif 'ECG_Variability' in col: sample_data[col] = 50
    elif 'Facial_Stress' in col: sample_data[col] = 5
    elif 'Gender' in col: 
        sample_data[col] = 1 if 'Male' in col else 0 # Simple toggle for one-hot
    elif 'Province' in col:
        sample_data[col] = 0 # Default 0
    else:
        sample_data[col] = 0

# Convert to DataFrame to ensure order matches exactly
df_sample = pd.DataFrame([sample_data])

# Ensure columns are in the EXACT order as training
df_sample = df_sample[input_columns]

print("\n--- Sample Input Data ---")
print(df_sample.iloc[0].to_dict())

# 4. PREPROCESS
X_input = scaler.transform(df_sample)

# 5. PREDICT
print("\n--- Running Prediction ---")
prediction_prob = model.predict(X_input)[0][0]
prediction_label = "Normal" if prediction_prob > 0.5 else "Non-Normal"  # Based on typical sigmoid 0/1 split

print(f"\nResult: {prediction_label}")
print(f"Probability: {prediction_prob:.4f}")

if prediction_prob > 0.5:
    print("✅ The model predicts the mental state is NORMAL.")
else:
    print("⚠️ The model predicts the mental state is NON-NORMAL (Stressed/Abnormal).")
