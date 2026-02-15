# MindGuard Machine Learning Models Report

**Project**: MindGuard - Real-time Mental Health Monitoring System  
**Version**: 1.0  
**Date**: January 2026  

---

## Executive Summary

MindGuard employs a multimodal machine learning approach to assess mental health status in real-time. The system combines physiological sensors (heart rate, temperature), behavioral analysis (voice patterns, facial expressions), and demographic factors to classify mental states as **Normal** or **Non-Normal**.

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        INPUT LAYER                               │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   📷 Webcam     │   🎤 Microphone │   💓 Heart Rate Sensor      │
│   (Video Feed)  │   (Audio Feed)  │   (Serial/USB Connection)   │
└────────┬────────┴────────┬────────┴────────────┬────────────────┘
         │                 │                      │
         ▼                 ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FEATURE EXTRACTION                           │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   DeepFace      │   PyAudio       │   Serial Reader             │
│   Emotion AI    │   dB Analyzer   │   BPM/HRV Parser            │
└────────┬────────┴────────┬────────┴────────────┬────────────────┘
         │                 │                      │
         ▼                 ▼                      ▼
    Facial_Stress    Speech_Noise_dB      Heart_Rate_bpm
    Score (0-14)        (dB)              ECG_Variability
         │                 │                      │
         └─────────────────┼──────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PREPROCESSING                               │
│                   StandardScaler (Z-Score Normalization)         │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLASSIFICATION MODEL                          │
│              Deep Neural Network (TensorFlow/Keras)              │
│                                                                  │
│    Input(17) → Dense(256) → Dense(128) → Dense(64) → Dense(1)   │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         OUTPUT                                   │
│              Normal / Non-Normal + Confidence Score              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Model Components

### 2.1 Primary Classification Model

| Specification | Value |
|---------------|-------|
| **Model Type** | Deep Neural Network (DNN) |
| **Framework** | TensorFlow 2.x / Keras |
| **File Format** | HDF5 (.h5) |
| **File Size** | ~620 KB |
| **Task** | Binary Classification |
| **Classes** | `Normal`, `Non-Normal` |

#### Network Architecture

```
Layer (type)                Output Shape              Param #
================================================================
Input                       (None, 17)                0
Dense (256 units, ReLU)     (None, 256)               4,608
BatchNormalization          (None, 256)               1,024
Dropout (0.3)               (None, 256)               0
Dense (128 units, ReLU)     (None, 128)               32,896
BatchNormalization          (None, 128)               512
Dropout (0.3)               (None, 128)               0
Dense (64 units, ReLU)      (None, 64)                8,256
BatchNormalization          (None, 64)                256
Dense (1 unit, Sigmoid)     (None, 1)                 65
================================================================
Total params: ~47,617
Trainable params: ~46,721
Non-trainable params: 896
```

#### Regularization Techniques
- **Batch Normalization**: Applied after each hidden layer to stabilize training
- **Dropout (30%)**: Prevents overfitting by randomly deactivating neurons

---

### 2.2 Facial Emotion Analysis (DeepFace)

| Specification | Value |
|---------------|-------|
| **Library** | DeepFace v0.0.79+ |
| **Detection Backend** | OpenCV Haar Cascade |
| **Recognition Model** | VGG-Face (default) |
| **Actions** | Emotion Detection |

#### Detected Emotions
| Emotion | Weight in Stress Score |
|---------|------------------------|
| Fear | +0.12 (High stress indicator) |
| Angry | +0.10 |
| Disgust | +0.08 |
| Sad | +0.06 |
| Neutral | +0.01 |
| Happy | -0.05 (Reduces stress) |
| Surprise | -0.02 |

#### Stress Score Formula
```python
def calculate_weighted_stress(emotions):
    score = (
        (emotions['fear'] * 0.12) +
        (emotions['angry'] * 0.10) +
        (emotions['disgust'] * 0.08) +
        (emotions['sad'] * 0.06) +
        (emotions['neutral'] * 0.01) -
        (emotions['happy'] * 0.05) -
        (emotions['surprise'] * 0.02)
    )
    score += 2.0  # Baseline offset
    return max(0, min(14, round(score, 1)))  # Clamp to 0-14 range
```

#### Smoothing Algorithm
- **Emotion Stability**: 3-frame history buffer with confidence-based switching
- **Score Smoothing**: 5-value median filter to reduce jitter
- **High Confidence Threshold**: >40% → Immediate switch
- **Medium Confidence**: >25% → Consistency check required

---

### 2.3 Feature Scaler

| Specification | Value |
|---------------|-------|
| **Type** | StandardScaler (Z-Score) |
| **Library** | scikit-learn |
| **File Format** | Pickle (.pkl) |
| **File Size** | ~1 KB |

#### Transformation Formula
```
X_scaled = (X - μ) / σ

Where:
  X = Original feature value
  μ = Mean of feature (from training data)
  σ = Standard deviation of feature (from training data)
```

---

## 3. Input Features

### 3.1 Complete Feature Set (17 Features)

| # | Feature Name | Type | Source | Range |
|---|--------------|------|--------|-------|
| 1 | Age | Numeric | User Input | 0-100 |
| 2 | Heart_Rate_bpm | Numeric | Sensor | 40-200 |
| 3 | Body_Temperature_C | Numeric | Sensor | 35-42 |
| 4 | Speech_Noise_dB | Numeric | Microphone | 0-100 |
| 5 | Movement_Level | Numeric | Accelerometer | 0-10 |
| 6 | ECG_Variability | Numeric | Derived | 0-100 |
| 7 | Facial_Stress_Score | Numeric | DeepFace | 0-14 |
| 8 | Gender_Female | Binary | One-Hot | 0/1 |
| 9 | Gender_Male | Binary | One-Hot | 0/1 |
| 10-17 | Province_* | Binary | One-Hot | 0/1 |

### 3.2 Province Categories (Sri Lanka)
- Central
- Eastern
- North Western
- Northern
- Sabaragamuwa
- Southern
- Uva
- Western

---

## 4. Training Details

### 4.1 Dataset

| Specification | Value |
|---------------|-------|
| **Dataset Name** | `mental_health_iot_dataset_2500.csv.xlsx` |
| **Total Samples** | 2,500 |
| **Train/Test Split** | 80% / 20% |
| **Stratification** | Yes (balanced classes) |

### 4.2 Training Configuration

| Parameter | Value |
|-----------|-------|
| **Optimizer** | Adam |
| **Loss Function** | Binary Cross-Entropy |
| **Epochs** | 10 |
| **Batch Size** | 32 |
| **Learning Rate** | Default (0.001) |

### 4.3 Training Script
```bash
# To retrain the model locally:
python retrain_local.py
```

---

## 5. Inference Pipeline

### 5.1 Real-time Processing

```python
# Simplified inference loop
while True:
    # 1. Collect live sensor data
    input_data = {
        'Heart_Rate_bpm': state["bpm"],
        'Body_Temperature_C': 36.5,
        'Speech_Noise_dB': state["audio_db"],
        'ECG_Variability': state["hrv"],
        'Facial_Stress_Score': state["facial_score"],
        'Age': 25,
        # ... one-hot encoded features
    }
    
    # 2. Scale features
    X_scaled = scaler.transform(df_input)
    
    # 3. Predict
    probability = model.predict(X_scaled)[0][0]
    
    # 4. Classify
    result = "Normal" if probability > 0.5 else "Non-Normal"
    
    # 5. Broadcast via WebSocket
    socketio.emit('mindguard_update', state)
    
    time.sleep(1.0)  # 1 Hz update rate
```

### 5.2 Performance Characteristics

| Metric | Value |
|--------|-------|
| **Inference Rate** | 1 Hz (1 prediction/second) |
| **Facial Analysis Rate** | ~5-10 FPS (GPU dependent) |
| **Audio Sampling** | 44.1 kHz |
| **Latency** | <100ms end-to-end |

---

## 6. Model Artifacts

### 6.1 Required Files

| File | Purpose | Required |
|------|---------|----------|
| `*.h5` | TensorFlow model weights | ✅ Yes |
| `*_scaler.pkl` | Feature normalization | ✅ Yes |
| `*_metadata.json` | Column order & classes | ✅ Yes |

### 6.2 Artifact Location
```
model_artifacts/
├── mindguard_local_YYYYMMDD_HHMMSS.h5
├── mindguard_local_YYYYMMDD_HHMMSS_scaler.pkl
└── mindguard_local_YYYYMMDD_HHMMSS_metadata.json
```

---

## 7. Dependencies

### 7.1 Python Requirements

```
tensorflow>=2.10
keras
deepface
opencv-python
numpy
pandas
scikit-learn
joblib
flask
flask-socketio
pyaudio
pyserial
```

### 7.2 System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **RAM** | 4 GB | 8 GB |
| **CPU** | 4 cores | 8 cores |
| **GPU** | Not required | NVIDIA CUDA (faster) |
| **Storage** | 2 GB | 5 GB |

---

## 8. Limitations & Future Work

### 8.1 Current Limitations
1. **Binary Classification Only**: Only Normal/Non-Normal; no severity levels
2. **Demographic Bias**: Trained on Sri Lankan population data
3. **Sensor Dependency**: Requires webcam + microphone for full functionality
4. **No Temporal Modeling**: Each prediction is independent (no LSTM/sequence modeling)

### 8.2 Planned Improvements
- [ ] Multi-class severity levels (Mild, Moderate, Severe)
- [ ] LSTM/Transformer for temporal patterns
- [ ] Federated learning for privacy-preserving updates
- [ ] Edge deployment optimization (TensorFlow Lite)
- [ ] Cross-cultural dataset augmentation

---

## 9. References

1. DeepFace: A Lightweight Face Recognition and Facial Attribute Analysis Library - [GitHub](https://github.com/serengil/deepface)
2. TensorFlow Documentation - [tensorflow.org](https://www.tensorflow.org/)
3. Mental Health IoT Dataset (Custom) - 2,500 samples with Sri Lankan demographic data

---

**Report Generated**: January 2026  
**Author**: MindGuard Development Team
