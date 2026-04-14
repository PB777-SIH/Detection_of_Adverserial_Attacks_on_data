# main.py

from fastapi import FastAPI, UploadFile, File, HTTPException
import shutil
import os

# Import your scanners
from rve_detector import scan_for_injections
from spectral_scanner import analyze_spectral_density
# UNCOMMENT this line!
from semantic_analyzer import check_semantic_intent

app = FastAPI(title="Invisible Prompt Injection Scanner", version="1.0")

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