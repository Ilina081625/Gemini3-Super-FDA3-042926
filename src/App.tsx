/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileUp, 
  Trash2, 
  Play, 
  Settings2, 
  Terminal, 
  Sparkles, 
  Download, 
  Scissors, 
  Copy, 
  Check, 
  ChevronRight,
  Monitor,
  Cpu,
  Database,
  Search,
  Zap,
  Network,
  ShieldCheck,
  Link as LinkIcon,
  Palette,
  BookOpen,
  Edit3,
  Eye,
  Type
} from 'lucide-react';
import { cn, formatBytes } from '@/src/lib/utils';
import { DEFAULT_SKILL_MD, SYSTEM_PROMPT, WOW_FEATURES, THEMES } from '@/src/constants';
import { ProcessedFile, Language, TelemetryLog } from '@/src/types';
import { streamGemini } from '@/src/lib/gemini';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function App() {
  // --- State ---
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [pastedText, setPastedText] = useState('');
  const [skillMd, setSkillMd] = useState(DEFAULT_SKILL_MD);
  const [language, setLanguage] = useState<Language>('Traditional Chinese');
  const [model, setModel] = useState('gemini-3-flash-preview');
  const [systemPrompt, setSystemPrompt] = useState(SYSTEM_PROMPT);
  const [isGenerating, setIsGenerating] = useState(false);
  const [output, setOutput] = useState('');
  const [logs, setLogs] = useState<TelemetryLog[]>([]);
  const [activeTheme, setActiveTheme] = useState(THEMES[0]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [editMode, setEditMode] = useState<'preview' | 'text'>('preview');
  
  // PDF Trim State
  const [trimmingFile, setTrimmingFile] = useState<ProcessedFile | null>(null);
  const [trimRange, setTrimRange] = useState({ start: 1, end: 5 });

  const logsEndRef = useRef<HTMLDivElement>(null);

  // --- Helpers ---
  const addLog = (message: string, level: TelemetryLog['level'] = 'info') => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message
    }].slice(-50));
  };

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files || []);
    const newFiles: ProcessedFile[] = await Promise.all(rawFiles.map(async (f) => {
      const isPdf = f.type === 'application/pdf';
      let data = '';
      if (isPdf) {
        data = await fileToBase64(f);
      }
      return {
        id: Math.random().toString(36).substring(7),
        name: f.name,
        size: f.size,
        type: f.type,
        status: 'pending',
        data: isPdf ? data : undefined,
        content: !isPdf ? await f.text() : undefined
      };
    }));
    setFiles(prev => [...prev, ...newFiles]);
    addLog(`Uploaded ${newFiles.length} documentation source(s).`, 'success');
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  const handleTrimPdf = async () => {
    if (!trimmingFile || !trimmingFile.data) return;
    addLog(`Initiating PDF trim protocol for ${trimmingFile.name}...`, 'info');
    
    try {
      const resp = await fetch('/api/trim-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startPage: trimRange.start,
          endPage: trimRange.end,
          file: {
            buffer: trimmingFile.data,
            originalname: trimmingFile.name
          }
        })
      });
      
      // Since fetch doesn't handle the multi-part/form-data with base64 easily in this simple way, 
      // i'll use a traditional form approach or just handle it as a blob.
      
      // Let's refine the trim logic for the server side using a real blob
      const binary = atob(trimmingFile.data);
      const array = new Uint8Array(binary.length);
      for(let i=0; i<binary.length; i++) array[i] = binary.charCodeAt(i);
      const blob = new Blob([array], { type: 'application/pdf' });
      
      const formData = new FormData();
      formData.append('file', blob, trimmingFile.name);
      formData.append('startPage', trimRange.start.toString());
      formData.append('endPage', trimRange.end.toString());

      const trimResponse = await fetch('/api/trim-pdf', {
        method: 'POST',
        body: formData
      });

      if (!trimResponse.ok) throw new Error("Trim failed");

      const trimmedBlob = await trimResponse.blob();
      const url = window.URL.createObjectURL(trimmedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trimmed_${trimmingFile.name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      addLog(`PDF trim successful. Download initiated.`, 'success');
      setTrimmingFile(null);
    } catch (e: any) {
      addLog(`PDF Trim Error: ${e.message}`, 'error');
    }
  };

  const executeTransformation = async (customPrompt?: string) => {
    if (files.length === 0 && !pastedText) {
      addLog("Execution failed: No source data loaded.", "error");
      return;
    }

    setIsGenerating(true);
    addLog("Initializing Neural Synthesis Engine...", "info");
    setOutput("");

    let combinedPrompt = customPrompt || `Please process the following documents based on this skill definition:\n\n${skillMd}\n\nLanguage: ${language}\n\nDocuments:\n`;
    
    const fileParts = files.filter(f => f.data).map(f => ({ mimeType: f.type, data: f.data! }));
    const textData = files.filter(f => f.content).map(f => f.content).join('\n\n---\n\n');
    
    const finalPrompt = combinedPrompt + textData + (pastedText ? `\n\n---\n\nPasted Snippet:\n${pastedText}` : '');

    try {
      const stream = streamGemini(finalPrompt, model, systemPrompt, fileParts);
      for await (const chunk of stream) {
        setOutput(prev => prev + chunk);
      }
      addLog("Transformation complete. Secondary Brain synchronization verified.", "success");
    } catch (e: any) {
      addLog(`Gemini Error: ${e.message}`, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const applyWowFeature = (prompt: string) => {
    const fullPrompt = `Apply the following transformation to the existing summary:\n\n${prompt}\n\nExisting Context:\n${output}`;
    executeTransformation(fullPrompt);
  };

  // --- Rendering ---
  return (
    <div className="flex h-screen bg-[#0d0f14] text-slate-300 font-sans overflow-hidden">
      {/* Sidebar: Configuration */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 320 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="flex-shrink-0 bg-[#161b22] border-r border-slate-800 flex flex-col z-20"
      >
        <div className="p-6 flex flex-col gap-8 h-full overflow-y-auto">
          <div className="flex items-center gap-2 text-indigo-400">
            <Sparkles className="w-6 h-6" />
            <h1 className="font-bold text-lg tracking-tight">KNOWLEDGE AGENT <span className="text-white">v3.0</span></h1>
          </div>

          {/* Model & Language */}
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              <Settings2 className="w-3.5 h-3.5" /> Engine Config
            </label>
            <div className="space-y-2">
              <select 
                value={model} 
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-[#0d0f14] border border-slate-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
              </select>
              <select 
                value={language} 
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="w-full bg-[#0d0f14] border border-slate-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="Traditional Chinese">Traditional Chinese (繁體中文)</option>
                <option value="English">English</option>
              </select>
            </div>
          </div>

          {/* System Prompt Customization */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">System Instruction</label>
            <textarea 
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Custom system rules..."
              className="w-full h-32 bg-[#0d0f14] border border-slate-700 rounded-lg p-2.5 text-xs font-mono leading-relaxed resize-none overflow-y-auto outline-none focus:border-indigo-500"
            />
          </div>

          {/* Skill.md override */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Active Skill (skill.md)</label>
            <textarea 
              value={skillMd}
              onChange={(e) => setSkillMd(e.target.value)}
              className="w-full h-48 bg-[#0d0f14] border border-slate-700 rounded-lg p-2.5 text-xs font-mono leading-relaxed resize-none outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative h-full">
        {/* Top Navbar */}
        <header className="h-14 border-b border-slate-800 bg-[#161b22]/50 backdrop-blur-md flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 hover:bg-slate-800 rounded-md transition-colors"
            >
              <ChevronRight className={cn("w-5 h-5 transition-transform", !isSidebarOpen && "rotate-180")} />
            </button>
            <div className="flex items-center gap-6 text-xs font-medium border-l border-slate-800 pl-4">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Monitor className="w-3.5 h-3.5" />
                <span>UPTIME: 12:44:02</span>
              </div>
              <div className="flex items-center gap-1.5 text-indigo-400">
                <Cpu className="w-3.5 h-3.5" />
                <span>CPU: {isGenerating ? '84%' : '12%'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-400">
                <Database className="w-3.5 h-3.5" />
                <span>MEM: {isGenerating ? '1.4GB' : '0.8GB'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="flex border border-slate-700 rounded-lg overflow-hidden bg-[#0d0f14]">
               <button 
                onClick={() => setEditMode('preview')}
                className={cn("px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors", editMode === 'preview' ? "bg-indigo-600 text-white" : "hover:bg-slate-800")}
               >
                 <Eye className="w-3.5 h-3.5" /> Preview
               </button>
               <button 
                onClick={() => setEditMode('text')}
                className={cn("px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors", editMode === 'text' ? "bg-indigo-600 text-white" : "hover:bg-slate-800")}
               >
                 <Edit3 className="w-3.5 h-3.5" /> Raw
               </button>
             </div>
             <button 
              disabled={isGenerating}
              onClick={() => executeTransformation()}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-semibold text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
             >
                {isGenerating ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Play className="w-4 h-4 fill-current" />}
                {isGenerating ? 'GENERATING...' : 'EXECUTE'}
             </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Ingestion & Telemetry */}
          <div className="w-[450px] border-r border-slate-800 flex flex-col bg-[#0d0f14]">
            {/* Upload Section */}
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="relative group">
                  <input 
                    type="file" 
                    multiple 
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                  />
                  <div className="border-2 border-dashed border-slate-700 group-hover:border-indigo-500 bg-slate-800/20 group-hover:bg-indigo-500/5 p-8 rounded-xl flex flex-col items-center gap-3 transition-all">
                    <FileUp className="w-8 h-8 text-slate-500 group-hover:text-indigo-400" />
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white">Upload Documents</p>
                      <p className="text-xs text-slate-500 mt-1">PDF, Markdown, Text, etc.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="bg-slate-800/50 px-4 py-2 flex items-center justify-between border-b border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Queue ({files.length})</span>
                    <button onClick={() => setFiles([])} className="p-1 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                    {files.length === 0 && <p className="text-center py-6 text-slate-600 text-xs italic">No datasets loaded</p>}
                    {files.map(f => (
                      <div key={f.id} className="flex items-center justify-between gap-3 p-2 hover:bg-slate-800/50 rounded-lg group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn("w-2 h-2 rounded-full", f.type.includes('pdf') ? "bg-red-400" : "bg-indigo-400")} />
                          <div className="truncate">
                            <p className="text-xs font-medium text-slate-200 truncate">{f.name}</p>
                            <p className="text-[10px] text-slate-500">{formatBytes(f.size)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {f.type.includes('pdf') && (
                            <button onClick={() => setTrimmingFile(f)} className="p-1 text-slate-400 hover:text-white"><Scissors className="w-3 h-3" /></button>
                          )}
                          <button onClick={() => setFiles(prev => prev.filter(x => x.id !== f.id))} className="p-1 text-slate-400 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Paste Text */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Paste Intelligence</label>
                  {pastedText && <button onClick={() => setPastedText('')} className="text-[10px] text-indigo-400 hover:underline">Clear</button>}
                </div>
                <textarea 
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste raw data or links here..."
                  className="w-full h-32 bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs resize-none focus:border-indigo-500 outline-none transition-all scrollbar-hide"
                />
              </div>
            </div>

            {/* Telemetry Window */}
            <div className="flex-1 border-t border-slate-800 flex flex-col min-h-0 bg-black/40 shadow-inner">
               <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-800/50 bg-[#0d0f14]/80">
                  <Terminal className="w-4 h-4 text-emerald-500" />
                  <span className="text-[11px] font-bold uppercase tracking-[2px] text-emerald-500/80">Neural Telemetry</span>
                  {isGenerating && <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="ml-auto flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    <span className="text-[10px] text-emerald-500/60 font-mono">REC</span>
                  </motion.div>}
               </div>
               <div className="flex-1 overflow-y-auto p-6 font-mono text-[11px] leading-relaxed space-y-1 scrollbar-thin">
                  {logs.length === 0 && <p className="text-slate-700 italic">SYSTEM IDLE // WAITING FOR DIRECTIVE</p>}
                  {logs.map(log => (
                    <div key={log.id} className="flex gap-3">
                      <span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
                      <span className={cn(
                        "break-words",
                        log.level === 'success' && "text-emerald-400",
                        log.level === 'error' && "text-rose-400",
                        log.level === 'warning' && "text-amber-400",
                        log.level === 'info' && "text-slate-400"
                      )}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
               </div>
            </div>
          </div>

          {/* Right Panel: Output & Magic */}
          <div className="flex-1 flex flex-col bg-[#0d0f14] relative">
            {/* Wow Interactive Dashboard */}
            <div className="h-16 border-b border-slate-800 bg-slate-900/30 flex items-center px-6 gap-3 overflow-x-auto no-scrollbar">
               <span className="text-[10px] font-bold text-indigo-400 whitespace-nowrap uppercase tracking-widest mr-2">Magic UI:</span>
               {THEMES.map(t => (
                 <button 
                  key={t.id}
                  onClick={() => setActiveTheme(t)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border shrink-0",
                    activeTheme.id === t.id ? "bg-indigo-600 border-indigo-400 text-white scale-105 shadow-lg shadow-indigo-500/30" : "bg-slate-800/40 border-slate-700 text-slate-500 hover:border-slate-500"
                  )}
                 >
                   {t.name}
                 </button>
               ))}
            </div>

            <div className="flex-1 overflow-y-auto relative p-8">
               <div className={cn("max-w-4xl mx-auto rounded-2xl border p-8 md:p-12 transition-all duration-700 min-h-full flex flex-col", activeTheme.classes)}>
                  <div className="flex items-center justify-between mb-8 border-b border-current/10 pb-4">
                    <div className="flex items-center gap-3">
                       <Sparkles className="w-5 h-5 opacity-50" />
                       <span className="text-xs uppercase tracking-[0.2em] font-bold opacity-60">Synthesized Intelligence</span>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => { navigator.clipboard.writeText(output); addLog("Copied to clipboard.", "info"); }} className="p-2 hover:bg-white/10 rounded-full transition-colors"><Copy className="w-4 h-4" /></button>
                       <button className="p-2 hover:bg-white/10 rounded-full transition-colors"><Download className="w-4 h-4" /></button>
                    </div>
                  </div>

                  {editMode === 'preview' ? (
                    <div className="prose prose-invert prose-sm max-w-none flex-1">
                      {output ? (
                        <Markdown remarkPlugins={[remarkGfm]}>
                          {output}
                        </Markdown>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-32 opacity-20 select-none pointer-events-none">
                           <Type className="w-16 h-16 mb-4" />
                           <p className="text-xl font-bold tracking-tighter">WAITING FOR EXECUTION</p>
                           <p className="text-sm opacity-60 mt-2">Neural patterns will materialize here</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <textarea 
                      value={output}
                      onChange={(e) => setOutput(e.target.value)}
                      className="w-full flex-1 bg-transparent border-none outline-none resize-none font-mono text-sm leading-relaxed"
                      placeholder="Neural output stream..."
                    />
                  )}

                  {/* Wow Visualization Effects Grid */}
                  <div className="mt-12 pt-8 border-t border-current/10">
                     <div className="flex items-center gap-2 mb-4">
                        <Zap className="w-4 h-4 text-amber-500" />
                        <h4 className="text-xs font-bold uppercase tracking-widest opacity-60">AI Magic Protocols</h4>
                     </div>
                     <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {WOW_FEATURES.map(f => {
                          const IconComp = {
                            Network,
                            ShieldCheck,
                            Link: LinkIcon,
                            Palette,
                            BookOpen,
                            Zap
                          }[f.icon] as any;
                          return (
                            <button 
                              key={f.id}
                              disabled={!output || isGenerating}
                              onClick={() => applyWowFeature(f.prompt)}
                              className="flex flex-col items-center gap-2 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all disabled:opacity-30 disabled:pointer-events-none group active:scale-95"
                            >
                               <IconComp className="w-5 h-5 group-hover:scale-110 transition-transform text-indigo-400" />
                               <span className="text-[10px] font-bold uppercase tracking-wider">{f.name}</span>
                            </button>
                          );
                        })}
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Modal: PDF Trimmer */}
        <AnimatePresence>
          {trimmingFile && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-[#161b22] border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
              >
                <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-white">
                    <Scissors className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-bold">PDF Trimmer Protocol</h3>
                  </div>
                  <button onClick={() => setTrimmingFile(null)} className="text-slate-500 hover:text-white transition-colors">
                    <ChevronRight className="w-6 h-6 rotate-90" />
                  </button>
                </div>
                <div className="p-8 space-y-6">
                  <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Source File</p>
                    <p className="text-sm font-semibold text-indigo-400 truncate">{trimmingFile.name}</p>
                    <p className="text-[10px] text-slate-600 mt-1">{formatBytes(trimmingFile.size)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase">Start Page</label>
                       <input 
                        type="number" 
                        value={trimRange.start}
                        onChange={(e) => setTrimRange({ ...trimRange, start: parseInt(e.target.value) || 1 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:border-indigo-500 outline-none" 
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase">End Page</label>
                       <input 
                        type="number" 
                        value={trimRange.end}
                        onChange={(e) => setTrimRange({ ...trimRange, end: parseInt(e.target.value) || 1 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:border-indigo-500 outline-none" 
                       />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      onClick={() => setTrimmingFile(null)}
                      className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-slate-800 hover:bg-slate-700 transition-colors"
                    >
                      ABORT
                    </button>
                    <button 
                      onClick={handleTrimPdf}
                      className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Scissors className="w-4 h-4" />
                      EXECUTE TRIM
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .animate-pulse-subtle { animation: pulse-subtle 4s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse-subtle { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </div>
  );
}
