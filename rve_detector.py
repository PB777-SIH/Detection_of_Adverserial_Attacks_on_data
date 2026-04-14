import fitz
import pytesseract
from pdf2image import convert_from_path
import os
import warnings
from PIL import Image
from dotenv import load_dotenv
from spectral_scanner import analyze_spectral_density

# Load the secrets
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(BASE_DIR, ".env"))

def _normalize_windows_env_path(path_value):
    if not path_value:
        return None

    normalized = path_value.strip().strip('"').strip("'")

    # python-dotenv can interpret \t inside quoted paths as a tab character.
    if "\t" in normalized and not os.path.exists(normalized):
        recovered = normalized.replace("\t", r"\t")
        if os.path.exists(recovered):
            normalized = recovered

    return normalized

# Pull the paths securely
tesseract_cmd_path = _normalize_windows_env_path(os.getenv("TESSERACT_CMD_PATH") or os.getenv("TESSERACT_PATH"))
if tesseract_cmd_path and os.path.exists(tesseract_cmd_path):
    pytesseract.pytesseract.tesseract_cmd = tesseract_cmd_path
elif os.name == "nt":
    default_tesseract_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if os.path.exists(default_tesseract_path):
        pytesseract.pytesseract.tesseract_cmd = default_tesseract_path
        warnings.warn(
            "TESSERACT_CMD_PATH is not set. Falling back to default Windows Tesseract path.",
            RuntimeWarning,
        )
    else:
        warnings.warn(
            "TESSERACT_CMD_PATH is missing and default Windows path was not found. OCR may fail.",
            RuntimeWarning,
        )

POPPLER_PATH = os.getenv("POPPLER_PATH") or None

def _render_pdf_pages_for_ocr(pdf_path):
    poppler_error = None
    normalized_poppler_path = None

    if POPPLER_PATH:
        normalized_poppler_path = POPPLER_PATH.strip().strip('"').strip("'")
        if os.path.isdir(normalized_poppler_path):
            try:
                return convert_from_path(pdf_path, poppler_path=normalized_poppler_path)
            except Exception as e:
                poppler_error = e
                warnings.warn(
                    f"Poppler conversion failed with configured path: {e}. Trying fallback rendering.",
                    RuntimeWarning,
                )
        else:
            warnings.warn(
                f"Configured POPPLER_PATH does not exist: {normalized_poppler_path}. Trying fallback rendering.",
                RuntimeWarning,
            )

    if not POPPLER_PATH:
        try:
            return convert_from_path(pdf_path)
        except Exception as e:
            poppler_error = e

    doc = None
    try:
        # Fallback: render each page using PyMuPDF and convert to PIL image for pytesseract.
        doc = fitz.open(pdf_path)
        images = []
        for page in doc:
            pix = page.get_pixmap(alpha=False)
            pil_img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            images.append(pil_img)

        if not images:
            raise RuntimeError("No pages available for OCR rendering.")

        return images
    except Exception as fitz_error:
        poppler_msg = f" Poppler error: {poppler_error}." if poppler_error else ""
        raise RuntimeError(f"OCR rendering failed.{poppler_msg} PyMuPDF fallback error: {fitz_error}")
    finally:
        if doc is not None:
            doc.close()

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
        images = _render_pdf_pages_for_ocr(pdf_path)
        human_text = ""
        for img in images:
            human_text += pytesseract.image_to_string(img)
    except Exception as e:
        return {"error": f"OCR Error: {e}"}

    # Check for discrepancies between Machine Text and Human Visual Text
    m_clean = set(machine_text.lower().split())
    h_clean = set(human_text.lower().split())
    hidden_words = m_clean - h_clean
    
    # We found text that the machine sees but the human doesn't!
    if hidden_words:
        full_hidden_text = " ".join(hidden_words)
        print(f"      -> Hidden text anomaly detected. Consulting Semantic Guardrail (Groq)...")
        
        # Import your upgraded analyzer
        from semantic_analyzer import check_semantic_intent
        
        # Ask Llama-3 to classify the hidden text
        is_attack, llm_reasoning = check_semantic_intent(full_hidden_text)
        
        if is_attack:
            text_verdict = f"🚨 SEMANTIC ATTACK DETECTED: {llm_reasoning}"
            hidden_tokens_count = len(hidden_words)
        else:
            print(f"      -> Groq cleared the text as benign: {llm_reasoning}")
            full_hidden_text = None  # Clear it so it doesn't trigger the red UI
            text_verdict = f"✅ Text Integrity Verified (Cleared by Guardrail)."
            hidden_tokens_count = 0
            
    else:
        full_hidden_text = None
        text_verdict = "✅ Text Integrity Verified."
        hidden_tokens_count = 0


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
            "hidden_tokens_count": hidden_tokens_count,
            "hidden_text": full_hidden_text
        },
        "image_scan": {
            "images_analyzed": len(embedded_image_results),
            "details": embedded_image_results
        }
    }