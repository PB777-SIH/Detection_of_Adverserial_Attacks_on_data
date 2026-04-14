

from fastapi import FastAPI, UploadFile, File, HTTPException
import shutil
import os
# Add this to your imports at the top!
from art_metrics import calculate_psnr

# Import your scanners
from rve_detector import scan_for_injections
from spectral_scanner import analyze_spectral_density
# UNCOMMENT this line!
from semantic_analyzer import check_semantic_intent

app = FastAPI(title="Invisible Prompt Injection Scanner", version="1.0")


@app.post("/compare")
async def compare_images(original: UploadFile = File(...), poisoned: UploadFile = File(...)):
    # 1. Save both files temporarily
    orig_path = f"temp_orig_{original.filename}"
    pois_path = f"temp_pois_{poisoned.filename}"
    
    with open(orig_path, "wb") as buffer:
        shutil.copyfileobj(original.file, buffer)
    with open(pois_path, "wb") as buffer:
        shutil.copyfileobj(poisoned.file, buffer)
        
    try:
        # 2. Run Spectral Scans on both individually
        orig_spectral = analyze_spectral_density(orig_path)
        pois_spectral = analyze_spectral_density(pois_path)
        
        # 3. Run the ART comparison math (PSNR / L-infinity)
        stealth_metrics = calculate_psnr(orig_path, pois_path)
        
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
        if os.path.exists(orig_path): os.remove(orig_path)
        if os.path.exists(pois_path): os.remove(pois_path)





@app.post("/scan")
async def scan_document(file: UploadFile = File(...)):
    # 1. Save the uploaded file temporarily
    temp_file_path = f"temp_{file.filename}"
    with open(temp_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    file_ext = file.filename.split(".")[-1].lower()
    
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
            raise HTTPException(status_code=400, detail="Unsupported file type.")
            
    finally:
        # 3. Clean up the temp file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)