import cv2
import numpy as np
from scipy.fftpack import dct

def analyze_spectral_density(image_path):
    # 1. Load image in grayscale
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        print("Image not found!")
        return

    # 2. Apply 2D Discrete Cosine Transform (DCT)
    # This moves the image from spatial (pixels) to frequency (waves)
    float_img = np.float32(img) / 255.0
    dct_coeffs = dct(dct(float_img.T, norm='ortho').T, norm='ortho')

    # 3. Analyze High-Frequency Components
    # Adversarial noise usually sits in the bottom-right of the DCT matrix
    rows, cols = dct_coeffs.shape
    high_freq_area = dct_coeffs[int(rows*0.5):, int(cols*0.5):]
    spectral_energy = np.sum(np.abs(high_freq_area))

    # ... (keep the math and DCT stuff above exactly the same) ...
    
    # 4. Thresholding (The Rulebook)
    THRESHOLD = 50.0  
    
    if spectral_energy > THRESHOLD:
        return {
            "verdict": "🚨 ATTACK DETECTED: High-frequency adversarial artifacts found.",
            # Add float() right here!
            "energy_score": round(float(spectral_energy), 4),
            "threat_type": "LSB Steganography / Spectral Anomaly"
        }
    else:
        return {
            "verdict": "✅ Image Integrity Verified: Natural frequency distribution.",
            # Add float() right here too!
            "energy_score": round(float(spectral_energy), 4)
        }