"""Quick diagnostic: what does DeepFace actually see from the webcam?"""
import cv2
import tensorflow as tf
import keras
try:
    tf.keras = keras
except:
    pass
from deepface import DeepFace
import json
import numpy as np
import urllib.request
import base64

# Since webcam is busy, let's test with a sample image
# Create a test image from a saved file or generate one
# First, let's check what DeepFace returns for different scenarios

# Use a test image - capture from webcam index 1 as fallback
frame = None
for idx in [0, 1, 2]:
    cap = cv2.VideoCapture(idx)
    ret, frame = cap.read()
    cap.release()
    if ret and frame is not None:
        print(f"Got frame from camera {idx}: {frame.shape}")
        break

if frame is None:
    # If no camera available, create a solid image to test DeepFace behavior 
    # when no face is present (enforce_detection=False)
    print("No camera available, creating test image")
    frame = np.zeros((480, 640, 3), dtype=np.uint8) + 128  # Gray image
    # Also download a test face image
    print("Testing with blank image to see enforce_detection=False behavior...")

print(f"Full frame size: {frame.shape}")

# 1. Full resolution with opencv backend (what backend currently uses)
results = DeepFace.analyze(frame, actions=['emotion'], detector_backend='opencv', enforce_detection=False, silent=True)
res = results[0]
emo = res['dominant_emotion']
scores = {k: round(v, 2) for k, v in res['emotion'].items()}
region = res['region']
print(f"\n--- Full frame + opencv backend ---")
print(f"Dominant: {emo}")
print(f"Scores: {json.dumps(scores, indent=2)}")
print(f"Region: {region}")
print(f"Region area: {region['w']}x{region['h']}")

# 2. Simulate what frontend sends: 480px wide, JPEG quality 50
scale = 480 / frame.shape[1]
small = cv2.resize(frame, (480, int(frame.shape[0] * scale)))
_, jpeg_buf = cv2.imencode('.jpg', small, [cv2.IMWRITE_JPEG_QUALITY, 50])
decoded = cv2.imdecode(jpeg_buf, cv2.IMREAD_COLOR)

print(f"\nSmall JPEG (480px, q50) size: {decoded.shape}")

results2 = DeepFace.analyze(decoded, actions=['emotion'], detector_backend='opencv', enforce_detection=False, silent=True)
res2 = results2[0]
emo2 = res2['dominant_emotion']
scores2 = {k: round(v, 2) for k, v in res2['emotion'].items()}
region2 = res2['region']

print(f"\n--- Small JPEG + opencv backend ---")
print(f"Dominant: {emo2}")
print(f"Scores: {json.dumps(scores2, indent=2)}")
print(f"Region: {region2}")

# 3. Check if face region is too small (x=0,y=0 means no face found, used whole image)
if region['x'] == 0 and region['y'] == 0 and region['w'] == frame.shape[1]:
    print("\n⚠️ WARNING: No face detected! Region covers entire image.")
    print("  opencv backend likely fell back to using the whole frame.")
    print("  Try a better detector backend.")

if region2['x'] == 0 and region2['y'] == 0 and region2['w'] == decoded.shape[1]:
    print("\n⚠️ WARNING: No face detected in small JPEG! Region covers entire image.")

# 4. Try retinaface backend (more accurate)
try:
    results3 = DeepFace.analyze(frame, actions=['emotion'], detector_backend='retinaface', enforce_detection=False, silent=True)
    res3 = results3[0]
    print(f"\n--- Full frame + retinaface backend ---")
    print(f"Dominant: {res3['dominant_emotion']}")
    scores3 = {k: round(v, 2) for k, v in res3['emotion'].items()}
    print(f"Scores: {json.dumps(scores3, indent=2)}")
    print(f"Region: {res3['region']}")
except Exception as e:
    print(f"\nretinaface error: {e}")

print("\n✅ Diagnostic complete")
