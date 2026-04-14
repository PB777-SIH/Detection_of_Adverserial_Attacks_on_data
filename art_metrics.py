import cv2
import numpy as np

def calculate_psnr(clean_img_path, attack_img_path):
    # 1. Load the images
    img_clean = cv2.imread(r"D:\MINOR_PROJECT\injection_prompts_detection\profile-pic LN.png")
    img_attack = cv2.imread(r"D:\MINOR_PROJECT\injection_prompts_detection\poisoned_profile.png")
    
    if img_clean is None or img_attack is None:
        print("Error: Could not find one of the images. Check your filenames!")
        return

    # 2. Calculate Mean Squared Error (MSE)
    # The average of the squared differences between pixels
    mse = np.mean((img_clean.astype(np.float32) - img_attack.astype(np.float32)) ** 2)
    
    if mse == 0:
        print("PSNR: Infinity (Images are identical)")
        return

    # 3. Calculate PSNR
    max_pixel = 255.0
    psnr_score = 10 * np.log10((max_pixel ** 2) / mse)
    
    # 4. Calculate L-infinity Norm (Max change)
    # This shows the single largest change made to any pixel
    l_inf = np.max(np.abs(img_clean.astype(np.float32) - img_attack.astype(np.float32)))

    print(f"--- 📏 Adversarial Robustness Metrics ---")
    print(f"MSE (Mean Squared Error): {mse:.4f}")
    print(f"PSNR (Peak Signal-to-Noise Ratio): {psnr_score:.2f} dB")
    print(f"L-infinity Norm (Max Perturbation): {l_inf:.2f}")
    
    if psnr_score > 35:
        print("Verdict: High Stealth. The attack is mathematically imperceptible.")
    else:
        print("Verdict: Low Stealth. Changes might be visible to a human eye.")

# Run the metrics!
# Ensure these filenames match your actual images
calculate_psnr("my_profile_pic.png", "poisoned_photo.png")