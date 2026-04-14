import { useState, useEffect } from 'react';
import {
  UploadCloud,
  ShieldAlert,
  Activity,
  AlertTriangle,
  RefreshCcw,
  FileImage,
  Zap,
  EyeOff,
  Scale,
  Info,
  FileText,
} from 'lucide-react';

type Mode = 'compare' | 'scan';
type Step = 'upload' | 'scanning' | 'results';

type Analysis = {
  verdict?: string;
  energy_score?: number;
  threat_type?: string;
};

type StealthMetrics = {
  mse?: number | string;
  psnr?: number | string;
  l_infinity?: number | string;
};

type ComparisonResponse = {
  status?: string;
  original_file?: string;
  poisoned_file?: string;
  comparison_results?: {
    original_analysis?: Analysis | null;
    poisoned_analysis?: Analysis | null;
    stealth_metrics?: StealthMetrics | null;
  };
};

type PdfScanResult = {
  master_verdict?: string;
  error?: string;
  semantic_guardrail_verdict?: string;
  text_scan?: {
    verdict?: string;
    hidden_tokens_count?: number;
    hidden_text?: string | null;
  };
  image_scan?: {
    images_analyzed?: number;
    details?: Array<{
      location?: string;
      spectral_analysis?: Analysis;
    }>;
  };
};

type ScanResponse = {
  status?: string;
  file_type?: 'PDF' | 'Image' | string;
  scan_results?: Analysis | PdfScanResult;
};

const COMPARE_MESSAGES = [
  '[Initializing Dual-Channel DPI...]',
  '[Extracting Spatial Domain Matrices...]',
  '[Computing 2D Discrete Cosine Transforms...]',
  '[Calculating L-Infinity & PSNR Stealth Metrics...]',
  '[Isolating Spectral Energy Anomalies...]',
  '[Compiling Comparison Report...]',
];

const SCAN_MESSAGES = [
  '[Ingesting Single Document Stream...]',
  '[Validating MIME and Extension Policy...]',
  '[Running OCR / Spectral Pipeline...]',
  '[Computing Threat Signatures...]',
  '[Assembling Detection Verdict...]',
];

export default function App() {
  const [mode, setMode] = useState<Mode>('compare');
  const [step, setStep] = useState<Step>('upload');
  const [scanMessageIndex, setScanMessageIndex] = useState(0);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResponse | null>(null);
  const [singleScanResults, setSingleScanResults] = useState<ScanResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [poisonedFile, setPoisonedFile] = useState<File | null>(null);
  const [singleFile, setSingleFile] = useState<File | null>(null);

  useEffect(() => {
    let messageInterval: ReturnType<typeof setInterval>;
    const activeMessages = mode === 'compare' ? COMPARE_MESSAGES : SCAN_MESSAGES;

    if (step === 'scanning') {
      messageInterval = setInterval(() => {
        setScanMessageIndex((prev) => (prev + 1) % activeMessages.length);
      }, 1000);
    }
    return () => clearInterval(messageInterval);
  }, [step, mode]);

  const resetWorkflowState = () => {
    setStep('upload');
    setErrorMessage(null);
    setComparisonResults(null);
    setSingleScanResults(null);
    setOriginalFile(null);
    setPoisonedFile(null);
    setSingleFile(null);
    setScanMessageIndex(0);
  };

  const switchMode = (nextMode: Mode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    resetWorkflowState();
  };

  const handleCompareUpload = async () => {
    if (!originalFile || !poisonedFile) return;

    setErrorMessage(null);
    setStep('scanning');
    setScanMessageIndex(0);

    const formData = new FormData();
    formData.append('original', originalFile);
    formData.append('poisoned', poisonedFile);

    try {
      const response = await fetch('http://127.0.0.1:8000/compare', {
        method: 'POST',
        body: formData,
      });

      let data: ComparisonResponse | { detail?: string } = {};
      try {
        data = await response.json();
      } catch {
        // Keep default empty object for non-JSON errors.
      }

      if (!response.ok) {
        const detail = typeof (data as { detail?: string }).detail === 'string'
          ? (data as { detail?: string }).detail
          : 'Backend responded with an error.';
        throw new Error(detail);
      }

      const typedData = data as ComparisonResponse;
      const comparison = typedData.comparison_results;
      if (!comparison?.original_analysis || !comparison?.poisoned_analysis || !comparison?.stealth_metrics) {
        throw new Error('Backend returned incomplete analysis data. Please upload valid PDF/JPG/JPEG/PNG files.');
      }

      setComparisonResults(typedData);
      setStep('results');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Comparison failed. Please try again.';
      console.error('Compare request failed:', message);
      setErrorMessage(message);
      setStep('upload');
    }
  };

  const handleSingleScan = async () => {
    if (!singleFile) return;

    setErrorMessage(null);
    setStep('scanning');
    setScanMessageIndex(0);

    const formData = new FormData();
    formData.append('file', singleFile);

    try {
      const response = await fetch('http://127.0.0.1:8000/scan', {
        method: 'POST',
        body: formData,
      });

      let data: ScanResponse | { detail?: string } = {};
      try {
        data = await response.json();
      } catch {
        // Keep default empty object for non-JSON errors.
      }

      if (!response.ok) {
        const detail = typeof (data as { detail?: string }).detail === 'string'
          ? (data as { detail?: string }).detail
          : 'Backend responded with an error.';
        throw new Error(detail);
      }

      const typedData = data as ScanResponse;
      if (!typedData.scan_results) {
        throw new Error('Backend returned incomplete scan data.');
      }

      setSingleScanResults(typedData);
      setStep('results');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Scan failed. Please try again.';
      console.error('Scan request failed:', message);
      setErrorMessage(message);
      setStep('upload');
    }
  };

  const UploadView = () => {
    if (mode === 'compare') {
      return (
        <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto mt-12 animate-in fade-in zoom-in-95 duration-300">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-3">Side-by-Side Comparison</h2>
            <p className="text-slate-400">Upload clean and attacked files (PDF/JPG/JPEG/PNG) to compare metrics.</p>
          </div>

          {errorMessage && (
            <div className="w-full mb-6 rounded-lg border border-red-900/70 bg-red-950/40 px-4 py-3 text-left text-sm text-red-300">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-8">
            <label className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-all ${originalFile ? 'border-emerald-500 bg-emerald-950/20' : 'border-slate-700 bg-slate-900/50 hover:border-blue-500 hover:bg-slate-800/50'}`}>
              <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                {originalFile ? <FileImage className="w-12 h-12 text-emerald-500 mb-3" /> : <UploadCloud className="w-12 h-12 text-slate-400 mb-3" />}
                <p className="mb-2 text-sm font-semibold text-slate-200">
                  {originalFile ? originalFile.name : 'Click to attach ORIGINAL file'}
                </p>
                {!originalFile && <p className="text-xs text-slate-500">The clean baseline input.</p>}
              </div>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setOriginalFile(e.target.files[0]);
                  }
                }}
              />
            </label>

            <label className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-all ${poisonedFile ? 'border-red-500 bg-red-950/20' : 'border-slate-700 bg-slate-900/50 hover:border-red-500 hover:bg-slate-800/50'}`}>
              <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                {poisonedFile ? <FileImage className="w-12 h-12 text-red-500 mb-3" /> : <ShieldAlert className="w-12 h-12 text-slate-400 mb-3" />}
                <p className="mb-2 text-sm font-semibold text-slate-200">
                  {poisonedFile ? poisonedFile.name : 'Click to attach POISONED file'}
                </p>
                {!poisonedFile && <p className="text-xs text-slate-500">The suspected attacked input.</p>}
              </div>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setPoisonedFile(e.target.files[0]);
                  }
                }}
              />
            </label>
          </div>

          <button
            onClick={handleCompareUpload}
            disabled={!originalFile || !poisonedFile}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-medium py-3 px-12 rounded-lg transition-colors flex items-center gap-2 text-lg"
          >
            <Activity className="w-5 h-5" /> Execute Comparison
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center w-full max-w-3xl mx-auto mt-12 animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-3">Single-File Scan</h2>
          <p className="text-slate-400">Upload one file (PDF/JPG/JPEG/PNG) for direct threat analysis.</p>
        </div>

        {errorMessage && (
          <div className="w-full mb-6 rounded-lg border border-red-900/70 bg-red-950/40 px-4 py-3 text-left text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        <label className={`relative flex flex-col items-center justify-center w-full h-72 border-2 border-dashed rounded-xl cursor-pointer transition-all mb-8 ${singleFile ? 'border-cyan-500 bg-cyan-950/20' : 'border-slate-700 bg-slate-900/50 hover:border-cyan-500 hover:bg-slate-800/50'}`}>
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
            {singleFile ? <FileText className="w-12 h-12 text-cyan-400 mb-3" /> : <UploadCloud className="w-12 h-12 text-slate-400 mb-3" />}
            <p className="mb-2 text-sm font-semibold text-slate-200">
              {singleFile ? singleFile.name : 'Click to attach file for scan'}
            </p>
            {!singleFile && <p className="text-xs text-slate-500">Accepted: PDF, JPG, JPEG, PNG</p>}
          </div>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                setSingleFile(e.target.files[0]);
              }
            }}
          />
        </label>

        <button
          onClick={handleSingleScan}
          disabled={!singleFile}
          className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-medium py-3 px-12 rounded-lg transition-colors flex items-center gap-2 text-lg"
        >
          <Activity className="w-5 h-5" /> Run Scan
        </button>
      </div>
    );
  };

  const ScanningView = () => {
    const activeMessages = mode === 'compare' ? COMPARE_MESSAGES : SCAN_MESSAGES;

    return (
      <div className="flex flex-col items-center justify-center w-full h-[50vh] animate-in fade-in duration-300">
        <div className="relative flex items-center justify-center mb-8">
          <div className="absolute w-32 h-32 border-4 border-blue-500/30 rounded-full animate-ping" />
          <div className="absolute w-20 h-20 border-4 border-blue-500/50 rounded-full animate-pulse" />
          <Zap className="w-10 h-10 text-blue-400 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-white mb-4 tracking-widest uppercase">
          {mode === 'compare' ? 'Computing Comparison Metrics' : 'Running Scan Pipeline'}
        </h2>
        <div className="font-mono text-sm text-blue-400 bg-blue-950/40 px-6 py-3 rounded-md border border-blue-900/50 min-w-[380px] text-center shadow-[0_0_15px_rgba(59,130,246,0.2)]">
          {activeMessages[scanMessageIndex]}
        </div>
      </div>
    );
  };

  const cleanVerdictText = (verdict?: string) => {
    if (!verdict) return 'N/A';
    return verdict
      .replace(/^🚨\s*/u, '')
      .replace(/^✅\s*/u, '')
      .replace(/^🧨\s*/u, '')
      .replace(/^⚠️?\s*/u, '')
      .trim();
  };

  const getVerdictTone = (verdict?: string): 'alert' | 'safe' | 'neutral' => {
    const v = (verdict ?? '').toUpperCase();
    if (v.includes('ATTACK') || v.includes('WARNING') || v.includes('CRITICAL') || v.includes('ERROR')) {
      return 'alert';
    }
    if (v.includes('VERIFIED') || v.includes('CLEAN') || v.includes('SAFE')) {
      return 'safe';
    }
    return 'neutral';
  };

  const getVerdictCardClass = (tone: 'alert' | 'safe' | 'neutral') => {
    if (tone === 'alert') {
      return 'bg-red-950/40 border-red-800 text-red-300';
    }
    if (tone === 'safe') {
      return 'bg-emerald-950/40 border-emerald-800 text-emerald-300';
    }
    return 'bg-slate-950/40 border-slate-700 text-slate-200';
  };

  const CompareResultsView = () => {
    if (!comparisonResults) return null;

    const comparison = comparisonResults.comparison_results;
    if (!comparison) return null;

    const { original_analysis, poisoned_analysis, stealth_metrics } = comparison;
    const safeOriginal: Analysis = original_analysis ?? {};
    const safePoisoned: Analysis = poisoned_analysis ?? {};
    const safeMetrics: StealthMetrics = stealth_metrics ?? {};

    const originalVerdict = typeof safeOriginal.verdict === 'string' ? safeOriginal.verdict.replace('🚨 ', '') : 'Analysis unavailable';
    const poisonedVerdict = typeof safePoisoned.verdict === 'string' ? safePoisoned.verdict.replace('🚨 ', '') : 'Analysis unavailable';
    const originalEnergy = typeof safeOriginal.energy_score === 'number' ? safeOriginal.energy_score.toFixed(2) : 'N/A';
    const poisonedEnergy = typeof safePoisoned.energy_score === 'number' ? safePoisoned.energy_score.toFixed(2) : 'N/A';
    const psnrValue = safeMetrics.psnr ?? 'N/A';
    const linfValue = safeMetrics.l_infinity ?? 'N/A';
    const mseValue = safeMetrics.mse ?? 'N/A';

    return (
      <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-4">
            <EyeOff className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">Adversarial Stealth Metrics</h2>
            <span className="ml-auto text-xs font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded">PROVES INVISIBILITY TO HUMAN EYE</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-6">
              <p className="text-slate-400 text-sm mb-2 font-semibold tracking-wider">PSNR (Decibels)</p>
              <p className="text-5xl font-black text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]">{psnrValue}</p>
              <p className="text-xs text-slate-500 mt-3">&gt; 40dB is completely imperceptible</p>
            </div>
            <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-6">
              <p className="text-slate-400 text-sm mb-2 font-semibold tracking-wider">L-Infinity Norm</p>
              <p className="text-5xl font-black text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.3)]">{linfValue}</p>
              <p className="text-xs text-slate-500 mt-3">Max pixel variation constraint</p>
            </div>
            <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-6">
              <p className="text-slate-400 text-sm mb-2 font-semibold tracking-wider">Mean Squared Error</p>
              <p className="text-5xl font-black text-indigo-400 drop-shadow-[0_0_10px_rgba(129,140,248,0.3)]">{mseValue}</p>
              <p className="text-xs text-slate-500 mt-3">Near-zero spatial deviation</p>
            </div>
          </div>
        </div>

        <div className="bg-amber-950/30 border border-amber-900/50 rounded-xl p-5 flex gap-4 items-start shadow-lg">
          <Info className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-amber-500 font-bold mb-1">Interpretation Note</h4>
            <p className="text-amber-200/70 text-sm">
              These scores compare original and poisoned files. Identical inputs should produce Infinity PSNR, zero MSE, and zero L-infinity.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <span className="font-bold text-slate-300">Baseline Evaluation</span>
              <span className="text-xs font-mono text-slate-500 truncate max-w-[150px]">{comparisonResults.original_file}</span>
            </div>
            <div className="p-6 space-y-5 flex-1">
              <div>
                <p className="text-sm text-slate-400 mb-1">DPI Verdict</p>
                <div className="bg-red-950/30 border border-red-900/50 text-red-400 px-3 py-2 rounded text-sm font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> {originalVerdict}
                </div>
              </div>
              <div className="flex justify-between items-end border-b border-slate-800 pb-4">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Spectral Energy Score</p>
                  <p className="text-3xl font-mono text-white">{originalEnergy}</p>
                </div>
                <Activity className="w-8 h-8 text-slate-600 mb-1" />
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">Threat Signature</p>
                <p className="text-slate-300 text-sm">{safeOriginal.threat_type ?? 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-[0_0_20px_rgba(220,38,38,0.1)]">
            <div className="bg-red-950/20 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <span className="font-bold text-red-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Attacked Target</span>
              <span className="text-xs font-mono text-slate-500 truncate max-w-[150px]">{comparisonResults.poisoned_file}</span>
            </div>
            <div className="p-6 space-y-5 flex-1">
              <div>
                <p className="text-sm text-slate-400 mb-1">DPI Verdict</p>
                <div className="bg-red-950/50 border border-red-800 text-red-400 px-3 py-2 rounded text-sm font-bold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> {poisonedVerdict}
                </div>
              </div>
              <div className="flex justify-between items-end border-b border-slate-800 pb-4">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Spectral Energy Score</p>
                  <p className="text-3xl font-mono text-amber-400">{poisonedEnergy}</p>
                </div>
                <Scale className="w-8 h-8 text-amber-600/50 mb-1" />
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">Threat Signature</p>
                <p className="text-slate-300 text-sm">{safePoisoned.threat_type ?? 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ScanResultsView = () => {
    if (!singleScanResults) return null;

    const scan = singleScanResults.scan_results;
    if (!scan) return null;

    if (singleScanResults.file_type === 'Image') {
      const imageResult = scan as Analysis;
      const imageVerdictRaw = imageResult.verdict;
      const imageVerdict = cleanVerdictText(imageVerdictRaw);
      const imageTone = getVerdictTone(imageVerdictRaw);
      const energy = typeof imageResult.energy_score === 'number' ? imageResult.energy_score.toFixed(2) : 'N/A';

      return (
        <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
            <h2 className="text-xl font-bold text-white">Image Scan Result</h2>
            <div className={`px-3 py-2 rounded text-sm font-semibold flex items-center gap-2 border ${getVerdictCardClass(imageTone)}`}>
              {imageTone === 'alert' ? <AlertTriangle className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
              {imageVerdict}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4">
                <p className="text-slate-400 text-sm mb-1">Spectral Energy Score</p>
                <p className="text-3xl font-mono text-cyan-400">{energy}</p>
              </div>
              <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4">
                <p className="text-slate-400 text-sm mb-1">Threat Signature</p>
                <p className="text-slate-200">{imageResult.threat_type ?? 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const pdfResult = scan as PdfScanResult;
    const detailRows = pdfResult.image_scan?.details ?? [];
    const masterVerdictRaw = pdfResult.master_verdict;
    const masterVerdict = cleanVerdictText(masterVerdictRaw);
    const masterTone = getVerdictTone(masterVerdictRaw);
    const textVerdictRaw = pdfResult.text_scan?.verdict;
    const textVerdict = cleanVerdictText(textVerdictRaw);
    const textTone = getVerdictTone(textVerdictRaw);

    return (
      <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <h2 className="text-xl font-bold text-white">PDF Scan Result</h2>

          {pdfResult.error ? (
            <div className="rounded-lg border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {pdfResult.error}
            </div>
          ) : (
            <>
              <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4">
                <p className="text-slate-400 text-sm mb-1">Master Verdict</p>
                <div className={`px-3 py-2 rounded text-sm font-semibold flex items-center gap-2 border ${getVerdictCardClass(masterTone)}`}>
                  {masterTone === 'alert' ? <AlertTriangle className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                  {masterVerdict}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4">
                  <p className="text-slate-400 text-sm mb-1">Text Pipeline Verdict</p>
                  <div className={`px-3 py-2 rounded text-sm font-semibold flex items-center gap-2 border ${getVerdictCardClass(textTone)}`}>
                    {textTone === 'alert' ? <AlertTriangle className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                    {textVerdict}
                  </div>
                  <p className="text-slate-500 text-xs mt-2">Hidden tokens: {pdfResult.text_scan?.hidden_tokens_count ?? 0}</p>
                </div>
                <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4">
                  <p className="text-slate-400 text-sm mb-1">Embedded Images Analyzed</p>
                  <p className="text-3xl font-mono text-cyan-400">{pdfResult.image_scan?.images_analyzed ?? 0}</p>
                </div>
              </div>

              {detailRows.length > 0 && (
                <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4 space-y-3">
                  <p className="text-slate-300 text-sm font-semibold">Embedded Image Findings</p>
                  <div className="space-y-3">
                    {detailRows.map((detail, idx) => {
                      const s = detail.spectral_analysis ?? {};
                      const verdictRaw = s.verdict;
                      const verdict = cleanVerdictText(verdictRaw);
                      const tone = getVerdictTone(verdictRaw);
                      const energy = typeof s.energy_score === 'number' ? s.energy_score.toFixed(4) : 'N/A';
                      return (
                        <div key={`${detail.location ?? 'image'}-${idx}`} className="rounded-md border border-slate-800 bg-slate-900 px-3 py-3">
                          <p className="text-xs text-slate-500 mb-1">{detail.location ?? `Image ${idx + 1}`}</p>
                          <div className={`px-3 py-2 rounded text-sm font-semibold flex items-center gap-2 border mb-2 ${getVerdictCardClass(tone)}`}>
                            {tone === 'alert' ? <AlertTriangle className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                            {verdict}
                          </div>
                          <p className="text-xs text-slate-400">Energy: {energy}</p>
                          <p className="text-xs text-slate-500">Threat: {s.threat_type ?? 'N/A'}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4">
            <p className="text-slate-400 text-sm mb-1">Semantic Guardrail</p>
            <p className="text-slate-200">{pdfResult.semantic_guardrail_verdict ?? 'N/A'}</p>
          </div>
        </div>
      </div>
    );
  };

  const ResultsView = () => {
    if (mode === 'compare') return <CompareResultsView />;
    return <ScanResultsView />;
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 font-sans p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 border-b border-slate-800/60 pb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <Activity className="text-blue-500 w-7 h-7" />
              Arcane AI
            </h1>
            <p className="text-slate-400 mt-1 text-sm">Multi-Modal Invisible Prompt Injection Diagnostics</p>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-mono text-slate-400">Endpoint: {mode === 'compare' ? '/compare' : '/scan'} LIVE</span>
          </div>
        </header>

        <section className="mb-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => switchMode('compare')}
            className={`px-4 py-2 rounded-lg border transition-colors ${mode === 'compare' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'}`}
          >
            Compare Two Files
          </button>
          <button
            onClick={() => switchMode('scan')}
            className={`px-4 py-2 rounded-lg border transition-colors ${mode === 'scan' ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'}`}
          >
            Scan Single File
          </button>
        </section>

        <main>
          {step === 'upload' && <UploadView />}
          {step === 'scanning' && <ScanningView />}
          {step === 'results' && (
            <>
              <ResultsView />
              <div className="flex justify-center pt-2 pb-8">
                <button
                  onClick={resetWorkflowState}
                  className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors px-6 py-3 border border-slate-800 rounded-lg hover:bg-slate-900"
                >
                  <RefreshCcw className="w-4 h-4" /> Run New {mode === 'compare' ? 'Comparison' : 'Scan'}
                </button>
              </div>
            </>
          )}
        </main>

        <footer className="border-t border-slate-800/60 mt-8 pt-5 pb-2 text-center text-xs text-slate-500">
          &copy; {new Date().getFullYear()} Arcane AI. All rights reserved.
        </footer>
      </div>
    </div>
  );
}