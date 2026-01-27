import cv2
import threading
import time
import numpy as np
import base64
from collections import deque
from flask import Flask, request
from flask_socketio import SocketIO, emit
from deepface import DeepFace
import logging

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MindGuard")

# Initialize Flask & SocketIO
app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", max_http_buffer_size=10000000)

# =============================================================================
# RESPONSIVE EMOTION DETECTION WITH SMOOTHING
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
        # Very short history for noise reduction only
        self.emotion_history = deque(maxlen=3)
        self.score_history = deque(maxlen=5)
        self.last_emotion = "neutral"
        self.last_score = 2.0
        
    def get_stable_emotion(self, raw_emotions):
        """
        Get the most stable emotion from recent frames.
        If current emotion is strong (>40%), trust it immediately.
        Otherwise, use voting from recent history.
        """
        # Get current dominant
        current_dominant = max(raw_emotions, key=raw_emotions.get)
        current_confidence = raw_emotions[current_dominant]
        
        # HIGH CONFIDENCE: Trust immediately (handles rapid genuine changes)
        if current_confidence > 40:
            self.last_emotion = current_dominant
            return current_dominant, current_confidence
        
        # MEDIUM CONFIDENCE: Check if consistent with recent history
        if current_confidence > 25:
            self.emotion_history.append(current_dominant)
            
            # If same as last 2 frames, accept it
            if len(self.emotion_history) >= 2:
                recent = list(self.emotion_history)[-2:]
                if recent.count(current_dominant) >= 1:
                    self.last_emotion = current_dominant
                    return current_dominant, current_confidence
        
        # LOW CONFIDENCE: Stick with last known emotion
        return self.last_emotion, current_confidence
    
    def get_smoothed_score(self, raw_score):
        """
        Smooth only the stress score, not the emotion.
        Quick response but no jitter.
        """
        self.score_history.append(raw_score)
        
        if len(self.score_history) >= 3:
            # Use median of last 3 for stability without lag
            scores = list(self.score_history)[-3:]
            smoothed = sorted(scores)[1]  # Median
        else:
            smoothed = raw_score
        
        self.last_score = smoothed
        return smoothed


# Global state
emotion_tracker = ResponsiveEmotionTracker()
latest_score = 0
latest_emotion = "Neutral"


def calculate_weighted_stress(emotions):
    """
    Calculate stress score from emotion probabilities.
    """
    w_fear = 0.12
    w_angry = 0.10
    w_disgust = 0.08
    w_sad = 0.06
    w_neutral = 0.01
    w_happy = 0.05
    w_surprise = 0.02

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


@socketio.on('connect')
def handle_connect():
    logger.info(f"Client Connected: {request.sid}")


@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"Client Disconnected: {request.sid}")


# Lock for concurrency control
processing_lock = threading.Lock()


@socketio.on('process_frame')
def handle_frame(base64_string):
    global latest_score, latest_emotion
    
    # Drop frame if already processing
    if processing_lock.locked():
        return

    with processing_lock:
        try:
            # 1. Decode Base64 -> Image
            if "," in base64_string:
                base64_string = base64_string.split(",")[1]
                
            img_data = base64.b64decode(base64_string)
            nparr = np.frombuffer(img_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                return

            # 2. Analyze with DeepFace (enforce_detection=True to detect "No Subject")
            try:
                results = DeepFace.analyze(
                    frame, 
                    actions=['emotion'], 
                    detector_backend='opencv',
                    enforce_detection=True,  # Will raise error if no face
                    silent=True
                )
                
                if results:
                    res = results[0]
                    raw_emotions = res['emotion']
                    
                    # 3. Get responsive emotion (immediate for high confidence)
                    emotion, confidence = emotion_tracker.get_stable_emotion(raw_emotions)
                    
                    # 4. Calculate and smooth stress score only
                    raw_stress = calculate_weighted_stress(raw_emotions)
                    smoothed_stress = emotion_tracker.get_smoothed_score(raw_stress)
                    
                    latest_emotion = emotion.capitalize()
                    latest_score = float(smoothed_stress)
                    
                    logger.info(f"✅ {latest_emotion} ({confidence:.1f}%) | Score: {latest_score}")

                    # 5. Emit result
                    emit('frame_processed', {
                        'region': None, 
                        'score': float(latest_score),
                        'emotion': latest_emotion,
                        'confidence': float(confidence),
                        'is_smooth': True
                    })
                    
            except ValueError:
                latest_emotion = "No Subject"
                latest_score = float(max(0, latest_score - 0.5))
                
                emit('frame_processed', {
                    'region': None,
                    'score': float(latest_score),
                    'emotion': "No Subject",
                    'confidence': 0.0,
                    'is_smooth': True
                })
                
        except Exception as e:
            logger.error(f"Frame Processing Error: {e}")


@app.route('/')
def index():
    return "MindGuard Processing Server (Responsive v3.0)"


def start_server():
    socketio.run(app, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)


if __name__ == '__main__':
    print("🚀 MindGuard Facial Server (Responsive v3.0)")
    print("   - Immediate response to emotions >40% confidence")
    print("   - 3-frame voting for lower confidence")
    print("   - Stress score smoothed with median filter")
    start_server()
