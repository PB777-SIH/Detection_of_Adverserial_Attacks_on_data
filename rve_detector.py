import fitz
import pytesseract
from pdf2image import convert_from_path
import os
from dotenv import load_dotenv
from spectral_scanner import analyze_spectral_density

# Load the secrets
load_dotenv()

# Pull the paths securely
pytesseract.pytesseract.tesseract_cmd = os.getenv("TESSERACT_PATH")
POPPLER_PATH = os.getenv("POPPLER_PATH")



def scan_for_injections(pdf_path):
    if not os.path.exists(pdf_path):
        return {"error": "File not found"}

    print(f"\n--- 🔍 Deep Packet Inspection (DPI): {pdf_path} ---")
    doc = fitz.open(pdf_path)
    
    # ==========================================
    # PART 1: The Text Pipeline (RVE)
    # ==========================================
    print("[1/2] Running Text Extraction & OCR...")
    machine_text = ""
    for page in doc:
        machine_text += page.get_text()
    
    try:
        images = convert_from_path(pdf_path, poppler_path=POPPLER_PATH)
        human_text = ""
        for img in images:
            human_text += pytesseract.image_to_string(img)
    except Exception as e:
        return {"error": f"OCR Error: {e}"}

    m_clean = set(machine_text.lower().split())
    h_clean = set(human_text.lower().split())
    hidden_words = m_clean - h_clean
    malicious_finds = [word for word in hidden_words if len(word) > 3]

    if malicious_finds:
        full_hidden_text = " ".join(malicious_finds)
        text_verdict = "🚨 TEXT ATTACK DETECTED!"
    else:
        full_hidden_text = None
        text_verdict = "✅ Text Integrity Verified."

    # ==========================================
    # PART 2: The Image Pipeline (DPI Extraction)
    # ==========================================
    print("[2/2] Extracting and Scanning Embedded Images...")
    embedded_image_results = []
    
    # Loop through every page in the PDF
    for page_index in range(len(doc)):
        page = doc[page_index]
        image_list = page.get_images()
        
        # Loop through every image found on that page
        for img_index, img in enumerate(image_list):
            xref = img[0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            image_ext = base_image["ext"]
            
            # Save the extracted image temporarily
            temp_img_name = f"temp_dpi_img_p{page_index}_{img_index}.{image_ext}"
            with open(temp_img_name, "wb") as f:
                f.write(image_bytes)
            
            # 🚀 SCAN THE EXTRACTED IMAGE!
            print(f"      -> Scanning Image {img_index + 1} on Page {page_index + 1}...")
            img_scan_result = analyze_spectral_density(temp_img_name)
            
            embedded_image_results.append({
                "location": f"Page {page_index + 1}, Image {img_index + 1}",
                "spectral_analysis": img_scan_result
            })
            
            # Clean up the temporary image
            os.remove(temp_img_name)

    # ==========================================
    # PART 3: The Multi-Modal Master Verdict
    # ==========================================
    # Check if ANY of the extracted images failed the spectral test
    image_attack_found = any("ATTACK DETECTED" in res["spectral_analysis"]["verdict"] for res in embedded_image_results)
    text_attack_found = full_hidden_text is not None

    if text_attack_found and image_attack_found:
        master_verdict = "🚨 CRITICAL: Multi-Vector Attack (Text + Image) Detected!"
    elif text_attack_found:
        master_verdict = "🚨 WARNING: Document Text Attack Detected!"
    elif image_attack_found:
        master_verdict = "🚨 WARNING: Steganography found in Embedded Image!"
    else:
        master_verdict = "✅ Document is 100% Clean."

    # Return the massive, beautiful JSON report!
    return {
        "master_verdict": master_verdict,
        "text_scan": {
            "verdict": text_verdict,
            "hidden_tokens_count": len(malicious_finds),
            "hidden_text": full_hidden_text
        },
        "image_scan": {
            "images_analyzed": len(embedded_image_results),
            "details": embedded_image_results
        }
    }