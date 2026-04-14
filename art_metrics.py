import cv2
import numpy as np

def calculate_psnr(clean_img_path, attack_img_path):
    # Use the variables, NOT the hardcoded paths!
    img_clean = cv2.imread(clean_img_path)
    img_attack = cv2.imread(attack_img_path)
    
    if img_clean is None or img_attack is None:
        return {"error": "Could not read one or both images."}

    if img_clean.shape != img_attack.shape:
        return {
            "error": (
                "Images must have the same dimensions for PSNR comparison. "
                f"Got {img_clean.shape} vs {img_attack.shape}."
            )
        }

    mse = np.mean((img_clean.astype(np.float32) - img_attack.astype(np.float32)) ** 2)
    
    if mse == 0:
        return {"mse": 0, "psnr": "Infinity", "l_infinity": 0}

    max_pixel = 255.0
    psnr_score = 10 * np.log10((max_pixel ** 2) / mse)
    l_inf = np.max(np.abs(img_clean.astype(np.float32) - img_attack.astype(np.float32)))

    # Return the math instead of printing it!
    return {
        "mse": round(float(mse), 4),
        "psnr": round(float(psnr_score), 2),
        "l_infinity": round(float(l_inf), 2)
    }