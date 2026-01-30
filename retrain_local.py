import pandas as pd
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
import joblib
import os
import datetime
import json

# Set legacy keras just in case (though we are regenerating so it should be native)
# os.environ["TF_USE_LEGACY_KERAS"] = "1" 

# ==========================================
# 1. SETUP
# ==========================================
print(f"TensorFlow Version: {tf.__version__}")
# Force CPU if needed or allow auto
os.makedirs('model_artifacts', exist_ok=True)

# ==========================================
# 2. LOAD DATA
# ==========================================
file_path = 'mental_health_iot_dataset_2500.csv.xlsx'

if not os.path.exists(file_path):
    print(f"❌ DATASET NOT FOUND: {file_path}")
    exit(1)

print(f"Loading dataset: {file_path}")
try:
    df = pd.read_excel(file_path)
except:
    df = pd.read_csv(file_path)

print(f"Dataset Shape: {df.shape}")

# ==========================================
# 3. PREPROCESSING
# ==========================================
if 'Patient_ID' in df.columns:
    df = df.drop('Patient_ID', axis=1)

# Encode Target
le_target = LabelEncoder()
df['Mental_State_Label'] = le_target.fit_transform(df['Mental_State_Label'])
print(f"Classes: {le_target.classes_}")

# Encode Features
categorical_cols = ['Gender', 'Province']
df = pd.get_dummies(df, columns=categorical_cols, drop_first=False)

# Split
X = df.drop('Mental_State_Label', axis=1).values
y = df['Mental_State_Label'].values

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

# Scale
scaler = StandardScaler()
X_train = scaler.fit_transform(X_train)
X_test = scaler.transform(X_test)

# Model Architecture
def build_model(input_dim):
    model = keras.Sequential([
        layers.Input(shape=(input_dim,)),
        layers.Dense(256, activation='relu'),
        layers.BatchNormalization(),
        layers.Dropout(0.3),
        layers.Dense(128, activation='relu'),
        layers.BatchNormalization(),
        layers.Dropout(0.3),
        layers.Dense(64, activation='relu'),
        layers.BatchNormalization(),
        layers.Dense(1, activation='sigmoid')
    ])
    model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
    return model

model = build_model(X_train.shape[1])

# Train
print("Starting Training...")
model.fit(X_train, y_train, validation_data=(X_test, y_test), epochs=10, batch_size=32, verbose=1)

# Save
timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
base_name = f"mindguard_local_{timestamp}"
save_dir = 'model_artifacts'

# Clear old artifacts first to avoid confusion
import shutil
for f in os.listdir(save_dir):
    fp = os.path.join(save_dir, f)
    try:
        if os.path.isfile(fp):
            os.remove(fp)
        elif os.path.isdir(fp):
            shutil.rmtree(fp)
    except Exception as e:
        print(f"Warning: Could not delete {fp}: {e}")

# Save Model
model_path = os.path.join(save_dir, f"{base_name}.h5")
model.save(model_path) # Saves in h5 format compatible with current env

# Save Scaler
scaler_path = os.path.join(save_dir, f"{base_name}_scaler.pkl")
joblib.dump(scaler, scaler_path)

# Save Metadata
metadata = {
    "columns": list(df.drop('Mental_State_Label', axis=1).columns),
    "classes": list(le_target.classes_),
    "timestamp": timestamp
}
metadata_path = os.path.join(save_dir, f"{base_name}_metadata.json")
with open(metadata_path, 'w') as f:
    json.dump(metadata, f, indent=4)

print("✅ Model Retrained and Saved Successfully!")
