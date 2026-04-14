

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import fitz
# Add this to your imports at the top!
from art_metrics import calculate_psnr

# Import your scanners
from rve_detector import scan_for_injections
from spectral_scanner import analyze_spectral_density
# UNCOMMENT this line!
from semantic_analyzer import check_semantic_intent

app = FastAPI(title="Arcane AI", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins (perfect for local development)
    allow_credentials=False,
    allow_methods=["*"],  # Allows all methods (POST, GET, etc.)
    allow_headers=["*"],  # Allows all headers
)


def _get_file_ext(filename: str) -> str:
    if not filename or "." not in filename:
        return ""
    return filename.rsplit(".", 1)[-1].lower()


def _is_supported_compare_file(filename: str) -> bool:
    ext = _get_file_ext(filename)
    return ext in {"png", "jpg", "jpeg", "pdf"}


def _prepare_file_for_compare(file_path: str, file_ext: str):
    if file_ext != "pdf":
        return file_path, []

    # Convert first PDF page to PNG so image-based detectors and metrics can run.
    doc = None
    try:
        doc = fitz.open(file_path)
        if len(doc) == 0:
            raise HTTPException(
                status_code=422,
                detail=f"PDF file '{os.path.basename(file_path)}' has no renderable pages.",
            )

        first_page = doc.load_page(0)
        pix = first_page.get_pixmap(alpha=False)
        converted_path = f"{file_path}.page1.png"
        pix.save(converted_path)
        return converted_path, [converted_path]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Could not process PDF file '{os.path.basename(file_path)}': {e}",
        )
    finally:
        if doc is not None:
            doc.close()


def _is_supported_scan_file(filename: str) -> bool:
    ext = _get_file_ext(filename)
    return ext in {"pdf", "png", "jpg", "jpeg"}


def _unsupported_type_detail() -> str:
    return "Unsupported file type. Only pdf, jpg, jpeg, png are allowed."


def _safe_remove(path: str):
    if path and os.path.exists(path):
        os.remove(path)


def _safe_remove_many(paths):
    for path in paths:
        _safe_remove(path)


@app.post("/compare")
async def compare_images(original: UploadFile = File(...), poisoned: UploadFile = File(...)):
    if not _is_supported_compare_file(original.filename) or not _is_supported_compare_file(poisoned.filename):
        raise HTTPException(
            status_code=400,
            detail="Only pdf, jpg, jpeg, png files are supported for /compare.",
        )

    original_ext = _get_file_ext(original.filename)
    poisoned_ext = _get_file_ext(poisoned.filename)

    # 1. Save both files temporarily
    orig_path = f"temp_orig_{original.filename}"
    pois_path = f"temp_pois_{poisoned.filename}"
    
    with open(orig_path, "wb") as buffer:
        shutil.copyfileobj(original.file, buffer)
    with open(pois_path, "wb") as buffer:
        shutil.copyfileobj(poisoned.file, buffer)

    generated_paths = []
    orig_analysis_path = orig_path
    pois_analysis_path = pois_path
        
    try:
        orig_analysis_path, orig_generated = _prepare_file_for_compare(orig_path, original_ext)
        pois_analysis_path, pois_generated = _prepare_file_for_compare(pois_path, poisoned_ext)
        generated_paths.extend(orig_generated)
        generated_paths.extend(pois_generated)

        # 2. Run Spectral Scans on both individually
        orig_spectral = analyze_spectral_density(orig_analysis_path)
        pois_spectral = analyze_spectral_density(pois_analysis_path)

        if not isinstance(orig_spectral, dict) or "verdict" not in orig_spectral:
            raise HTTPException(
                status_code=422,
                detail="Could not analyze original image. Ensure it is a valid PNG/JPG file.",
            )

        if not isinstance(pois_spectral, dict) or "verdict" not in pois_spectral:
            raise HTTPException(
                status_code=422,
                detail="Could not analyze poisoned image. Ensure it is a valid PNG/JPG file.",
            )
        
        # 3. Run the ART comparison math (PSNR / L-infinity)
        stealth_metrics = calculate_psnr(orig_analysis_path, pois_analysis_path)

        if isinstance(stealth_metrics, dict) and "error" in stealth_metrics:
            raise HTTPException(status_code=422, detail=stealth_metrics["error"])
        
        # 4. Return the massive comparison payload for the frontend
        return {
            "status": "success",
            "original_file": original.filename,
            "poisoned_file": poisoned.filename,
            "comparison_results": {
                "original_analysis": orig_spectral,
                "poisoned_analysis": pois_spectral,
                "stealth_metrics": stealth_metrics
            }
        }
    finally:
        # 5. Clean up both temp files
        _safe_remove(orig_path)
        _safe_remove(pois_path)
        _safe_remove_many(generated_paths)





@app.post("/scan")
async def scan_document(file: UploadFile = File(...)):
    # 1. Save the uploaded file temporarily
    temp_file_path = f"temp_{file.filename}"
    with open(temp_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    file_ext = _get_file_ext(file.filename)

    if not _is_supported_scan_file(file.filename):
        raise HTTPException(status_code=400, detail=_unsupported_type_detail())
    
    try:
        # 2. Route to the correct scanner
        if file_ext == "pdf":
            print(f"\n--- API Received PDF: {file.filename} ---")
            scan_results = scan_for_injections(temp_file_path) 

            # --- LLM Guardrail Integration ---
            # Extract the hidden text from the results
            hidden_text = scan_results.get("hidden_text")
            
            # If the RVE scanner found hidden text, send it to Groq!
            if hidden_text:
                print("Semantic analysis initiated with Groq...")
                # We reuse the robust check_semantic_intent function we built
                verdict_from_llm = check_semantic_intent(hidden_text)
                # Add the LLM verdict to the final scan results
                scan_results["semantic_guardrail_verdict"] = verdict_from_llm
            else:
                scan_results["semantic_guardrail_verdict"] = "N/A (No hidden text found)"

            return {
                "status": "success", 
                "file_type": "PDF", 
                "scan_results": scan_results
            }
            
        elif file_ext in ["png", "jpg", "jpeg"]:
            print(f"\n--- API Received Image: {file.filename} ---")
            scan_results = analyze_spectral_density(temp_file_path)
            return {
                "status": "success", 
                "file_type": "Image", 
                "scan_results": scan_results
            }
            
        else:
            raise HTTPException(status_code=400, detail=_unsupported_type_detail())
            
    finally:
        # 3. Clean up the temp file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)