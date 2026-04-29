export const DEFAULT_SKILL_MD = `轉檔：EPUB / PDF / DOCX / Facebook JSON → Obsidian Markdown
將電子書、報告、文件或社群平台匯出轉成乾淨的 Markdown。

核心規範：
1. 語意修復與結構重組：處理 PDF 斷行，辨識層級建立 H1-H3。
2. 多模態圖像描述：為圖片產生 Alt-Text。
3. 自動化知識圖譜：產生 [[WikiLinks]] 與 YAML Frontmatter。
4. 程式碼高亮：偵測程式語言並套用正確語法。
5. 清理頁碼、重複頁首頁尾。
`;

export const SYSTEM_PROMPT = `You are an AI-driven Obsidian Knowledge Transformation Tool.
Your task is to convert the provided documents into highly structured, clean, and interlinked Markdown optimized for the "Obsidian" Knowledge Management system.

遵循以下原則：
1. **語意修復**：合併被不當切斷的句子，修復 PDF 轉換常見的斷行問題。
2. **結構化**：使用 H1, H2, H3 等標題層級。
3. **自動化關聯**：辨識關鍵概念並用 [[概念]] 包裹。
4. **YAML Frontmatter**：在文件最上方加入 YAML 區塊，包含 tags, aliases, created, type 等欄位。
5. **程式碼塊**：若有程式碼，必須使用 \`\`\`lang 語法。

如果是摘要任務，請產生一個 3000-4000 字的深度綜述，包含所有文件的精華。
請使用與使用者要求的語言（繁體中文或英文）進行輸出。
`;

export const WOW_FEATURES = [
  { id: 'map', name: 'Semantic Map', icon: 'Network', prompt: 'Create a conceptual map of the core ideas in this text using a Mermaid diagram.' },
  { id: 'logic', name: 'Logic Checker', icon: 'ShieldCheck', prompt: 'Analyze the logical consistency and identify any potential fallacies in this content.' },
  { id: 'entities', name: 'Entity Linker', icon: 'Link', prompt: 'Extract all major entities and define their inter-relationships in a structured table.' },
  { id: 'style', name: 'Style Shift', icon: 'Palette', prompt: 'Rewrite a key section of this content in the style of a technical whitepaper vs a narrative essay.' },
  { id: 'cite', name: 'Auto-Cite', icon: 'BookOpen', prompt: 'Generate an academic-style bibliography for the core concepts mentioned.' },
  { id: 'flux', name: 'Insight Flux', icon: 'Zap', prompt: 'Generate 5 high-level provocative questions or insights that "read between the lines" of this text.' }
];

export const THEMES = [
  { id: 'nordic', name: 'Nordic', classes: 'bg-stone-50 text-stone-900 border-stone-200 shadow-sm' },
  { id: 'matrix', name: 'Matrix', classes: 'bg-black text-green-500 border-green-900 font-mono shadow-[0_0_15px_-3px_rgba(34,197,94,0.3)]' },
  { id: 'pulse', name: 'Pulse', classes: 'bg-indigo-950 text-indigo-100 border-indigo-500/50 animate-pulse-subtle' },
  { id: 'cyber', name: 'Cyber', classes: 'bg-slate-900 text-rose-500 border-rose-500 shadow-[2px_2px_0px_#f43f5e]' },
  { id: 'glass', name: 'Glass', classes: 'bg-white/10 backdrop-blur-xl text-white border-white/20' },
  { id: 'ethereal', name: 'Ethereal', classes: 'bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 text-slate-800 border-white/50' }
];
