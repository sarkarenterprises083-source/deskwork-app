import { useState, useEffect } from 'react';
import Head from 'next/head';

const HISTORY_KEY = 'deskwork_history';
const HISTORY_LIMIT = 20;

function loadHistory() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToHistory(entry) {
  if (typeof window === 'undefined') return;
  const existing = loadHistory();
  const next = [
    { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, timestamp: Date.now(), ...entry },
    ...existing,
  ].slice(0, HISTORY_LIMIT);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

const TABS = [
  { id: 'summarize', label: 'Summarize' },
  { id: 'generate', label: 'Generate' },
  { id: 'extract', label: 'Extract' },
];

export default function Home() {
  const [mode, setMode] = useState('summarize');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ text: '', error: false });
  const [output, setOutput] = useState(null); // { title, kind: 'text'|'table', text?, rows? }
  const [translateLang, setTranslateLang] = useState('Hindi');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const INDIAN_LANGUAGES = [
    'Hindi', 'Bengali', 'Tamil', 'Telugu', 'Marathi', 'Gujarati',
    'Kannada', 'Malayalam', 'Punjabi', 'Odia', 'Assamese', 'English',
  ];

  // Summarize state
  const [sumText, setSumText] = useState('');
  const [sumLength, setSumLength] = useState('a short paragraph');
  const [sumFile, setSumFile] = useState(null); // { name, mimeType, data }

  // Generate state
  const [genBrief, setGenBrief] = useState('');
  const [genType, setGenType] = useState('Blog post');
  const [genTone, setGenTone] = useState('Professional');

  // Extract state
  const [extText, setExtText] = useState('');
  const [extFields, setExtFields] = useState('');
  const [extFile, setExtFile] = useState(null); // { name, mimeType, data }

  const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB, must match the server limit

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error('Could not read the file.'));
      reader.readAsDataURL(file);
    });
  }

  async function handleFilePicked(file, setter) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setStatus({ text: 'File is too large. Please use a file under 4MB.', error: true });
      return;
    }
    clearResultIfPresent();
    try {
      const data = await fileToBase64(file);
      setter({ name: file.name || 'attachment', mimeType: file.type, data });
      setStatus({ text: '', error: false });
    } catch (err) {
      setStatus({ text: err.message || 'Could not read that file.', error: true });
    }
  }

  function handlePaste(e, setter) {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.type && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          handleFilePicked(file, setter);
          e.preventDefault();
        }
        break;
      }
    }
  }

  function switchMode(next) {
    setMode(next);
    setOutput(null);
    setStatus({ text: '', error: false });
  }

  // Auto-clear: whenever the user starts fresh input (typing, pasting text,
  // or attaching a new file) on top of an existing result, clear that result
  // so they're never reading stale output. Triggers on real input changes
  // only — never on bare focus — so tapping back into a field to re-read it
  // doesn't wipe anything.
  function clearResultIfPresent() {
    if (output) setOutput(null);
    if (status.text) setStatus({ text: '', error: false });
  }

  function handleTextChange(value, setter) {
    clearResultIfPresent();
    setter(value);
  }

  async function callApi(body) {
    const res = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 429) throw new Error(data.error || 'Too many requests — please slow down.');
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data.result;
  }

  async function handleRun() {
    setStatus({ text: '', error: false });
    setOutput(null);

    try {
      if (mode === 'summarize') {
        if (!sumText.trim() && !sumFile) {
          return setStatus({ text: 'Paste some text or attach a photo/document first.', error: true });
        }
        setBusy(true);
        setStatus({ text: 'Reading it over…', error: false });
        const result = await callApi({
          mode: 'summarize',
          text: sumText,
          length: sumLength,
          file: sumFile ? { mimeType: sumFile.mimeType, data: sumFile.data } : undefined,
        });
        setOutput({ title: 'Summary', kind: 'text', text: result });
        setHistory(saveToHistory({
          mode: 'summarize',
          sourceText: sumText,
          sourceFile: sumFile ? sumFile.name : null,
          output: { title: 'Summary', kind: 'text', text: result },
        }));
      } else if (mode === 'generate') {
        if (!genBrief.trim()) return setStatus({ text: 'Describe what you need first.', error: true });
        setBusy(true);
        setStatus({ text: 'Drafting…', error: false });
        const result = await callApi({ mode: 'generate', brief: genBrief, type: genType, tone: genTone });
        setOutput({ title: genType, kind: 'text', text: result });
        setHistory(saveToHistory({
          mode: 'generate',
          sourceText: genBrief,
          sourceFile: null,
          output: { title: genType, kind: 'text', text: result },
        }));
      } else if (mode === 'extract') {
        if (!extText.trim() && !extFile) {
          return setStatus({ text: 'Paste some text or attach a photo/document first.', error: true });
        }
        const fields = extFields.split(',').map((f) => f.trim()).filter(Boolean);
        if (fields.length === 0) return setStatus({ text: 'List at least one field to extract.', error: true });
        setBusy(true);
        setStatus({ text: 'Sorting into fields…', error: false });
        const raw = await callApi({
          mode: 'extract',
          text: extText,
          fields,
          file: extFile ? { mimeType: extFile.mimeType, data: extFile.data } : undefined,
        });
        let rows;
        try {
          const cleaned = raw.replace(/```json|```/g, '').trim();
          rows = JSON.parse(cleaned);
          if (!Array.isArray(rows)) rows = [rows];
        } catch (e) {
          throw new Error('Could not parse the extracted data.');
        }
        setOutput({ title: 'Extracted fields', kind: 'table', rows });
        setHistory(saveToHistory({
          mode: 'extract',
          sourceText: extText,
          sourceFile: extFile ? extFile.name : null,
          output: { title: 'Extracted fields', kind: 'table', rows },
        }));
      }
      setStatus({ text: '', error: false });
    } catch (err) {
      setStatus({ text: err.message || 'Something went wrong.', error: true });
    } finally {
      setBusy(false);
    }
  }

  async function handleRefine(action, extra) {
    if (!output || output.kind !== 'text') return;
    setStatus({ text: 'Refining…', error: false });
    setBusy(true);
    try {
      const sourceText = mode === 'summarize' ? sumText : mode === 'extract' ? extText : genBrief;
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, sourceText, previousOutput: output.text, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setOutput({ ...output, text: data.result });
      setStatus({ text: '', error: false });
    } catch (err) {
      setStatus({ text: err.message || 'Could not refine.', error: true });
    } finally {
      setBusy(false);
    }
  }

  function plainTextForCopy() {
    if (!output) return '';
    if (output.kind === 'text') return output.text;
    return JSON.stringify(output.rows, null, 2);
  }

  function handleCopy() {
    navigator.clipboard.writeText(plainTextForCopy());
  }

  function handleDownloadPdf() {
    if (!output) return;
    const previousTitle = document.title;
    document.title = `Deskwork - ${output.title}`;
    window.print();
    document.title = previousTitle;
  }

  function handleSelectHistory(item) {
    setMode(item.mode);
    setOutput(item.output);
    setStatus({ text: '', error: false });
    if (item.mode === 'summarize') setSumText(item.sourceText || '');
    if (item.mode === 'extract') setExtText(item.sourceText || '');
    if (item.mode === 'generate') setGenBrief(item.sourceText || '');
  }

  function handleClearHistory() {
    window.localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  }

  return (
    <div className="wrap">
      <Head>
        <title>Deskwork — Text Tools</title>
        <meta name="description" content="Summarize, generate, and extract text with three simple tools." />
      </Head>

      <div className="masthead">
        <p className="eyebrow">Deskwork · No. 3 tools</p>
        <h1>Deskwork</h1>
        <p>Three tools for what a page of text needs: shorter, more, or sorted into fields.</p>
      </div>

      <div className="layout">
        <div className="main-col">
        <div className="tabs" role="tablist" aria-label="Choose a tool">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab${mode === t.id ? ' active' : ''}`}
            role="tab"
            aria-selected={mode === t.id}
            onClick={() => switchMode(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="sheet">
        {mode === 'summarize' && (
          <div>
            <div className="field">
              <label htmlFor="sum-text">Paste text, or attach a photo/document</label>
              <textarea
                id="sum-text"
                placeholder="Drop an article, report, or transcript here… (or paste a photo)"
                value={sumText}
                onChange={(e) => handleTextChange(e.target.value, setSumText)}
                onPaste={(e) => handlePaste(e, setSumFile)}
              />
              <FileAttach file={sumFile} onPick={(f) => handleFilePicked(f, setSumFile)} onClear={() => setSumFile(null)} idPrefix="sum" />
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="sum-length">Length</label>
                <select id="sum-length" value={sumLength} onChange={(e) => setSumLength(e.target.value)}>
                  <option value="one sentence">One sentence</option>
                  <option value="a short paragraph">Short paragraph</option>
                  <option value="a bulleted list of key points">Bulleted key points</option>
                  <option value="a detailed multi-paragraph summary">Detailed</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {mode === 'generate' && (
          <div>
            <div className="field">
              <label htmlFor="gen-brief">Describe what you need</label>
              <textarea
                id="gen-brief"
                placeholder="e.g. A launch email for a new espresso machine, aimed at home baristas…"
                value={genBrief}
                onChange={(e) => handleTextChange(e.target.value, setGenBrief)}
              />
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="gen-type">Format</label>
                <select id="gen-type" value={genType} onChange={(e) => setGenType(e.target.value)}>
                  <option>Blog post</option>
                  <option>Email</option>
                  <option>Social media post</option>
                  <option>Product description</option>
                  <option>Ad copy</option>
                  <option>Press release</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="gen-tone">Tone</label>
                <select id="gen-tone" value={genTone} onChange={(e) => setGenTone(e.target.value)}>
                  <option>Professional</option>
                  <option>Casual</option>
                  <option>Persuasive</option>
                  <option>Playful</option>
                  <option>Formal</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {mode === 'extract' && (
          <div>
            <div className="field">
              <label htmlFor="ext-text">Paste source text, or attach a photo/document</label>
              <textarea
                id="ext-text"
                placeholder="Drop an invoice, listing, email, or contract here… (or paste a photo)"
                value={extText}
                onChange={(e) => handleTextChange(e.target.value, setExtText)}
                onPaste={(e) => handlePaste(e, setExtFile)}
              />
              <FileAttach file={extFile} onPick={(f) => handleFilePicked(f, setExtFile)} onClear={() => setExtFile(null)} idPrefix="ext" />
            </div>
            <div className="field">
              <label htmlFor="ext-fields">Fields to pull out (comma separated)</label>
              <input
                type="text"
                id="ext-fields"
                placeholder="e.g. name, date, amount, company"
                value={extFields}
                onChange={(e) => setExtFields(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="actions">
          <button className="stamp" onClick={handleRun} disabled={busy}>
            Process
          </button>
          <span className={`status${status.error ? ' error' : ''}`}>{status.text}</span>
        </div>

        {output && (
          <div className="output printable">
            <div className="output-head">
              <h2>{output.title}</h2>
              <div className="output-actions no-print">
                <button className="copy" onClick={handleCopy}>
                  Copy
                </button>
                <button className="copy" onClick={handleDownloadPdf}>
                  Download PDF
                </button>
              </div>
            </div>
            {output.kind === 'text' ? (
              <div>
                <div className="result-text">{output.text}</div>
                <div className="refine-row no-print">
                  <button className="refine-btn" onClick={() => handleRefine('shorten')} disabled={busy}>Shorten</button>
                  <button className="refine-btn" onClick={() => handleRefine('lengthen')} disabled={busy}>Lengthen</button>
                  <button className="refine-btn" onClick={() => handleRefine('formalize')} disabled={busy}>Formalize</button>
                  <button className="refine-btn" onClick={() => handleRefine('simplify')} disabled={busy}>Simplify</button>
                  <select
                    className="refine-lang"
                    value={translateLang}
                    onChange={(e) => setTranslateLang(e.target.value)}
                  >
                    {INDIAN_LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                  <button
                    className="refine-btn"
                    onClick={() => handleRefine('translate', { targetLanguage: translateLang })}
                    disabled={busy}
                  >
                    Translate
                  </button>
                </div>
              </div>
            ) : (
              <ExtractTable rows={output.rows} />
            )}
          </div>
        )}
      </div>
        </div>

        <div className="sidebar-col">
          <div className="history-list">
            <div className="history-head">
              <span>Recent Activity</span>
              {history.length > 0 && (
                <button className="copy" onClick={handleClearHistory}>Clear</button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="empty-hint">No activity yet — your recent results will show up here.</p>
            ) : (
              history.map((item) => (
                <button key={item.id} className="history-item" onClick={() => handleSelectHistory(item)}>
                  <span className="history-item-mode">{item.mode}</span>
                  <span className="history-item-text">
                    {(item.sourceText || item.sourceFile || 'attachment').slice(0, 60)}
                  </span>
                  <span className="history-item-time">
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FileAttach({ file, onPick, onClear, idPrefix }) {
  return (
    <div className="attach">
      {!file ? (
        <div className="attach-buttons">
          <label className="attach-btn" htmlFor={`${idPrefix}-camera`}>
            📷 Take photo
          </label>
          <input
            id={`${idPrefix}-camera`}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => onPick(e.target.files && e.target.files[0])}
          />
          <label className="attach-btn" htmlFor={`${idPrefix}-file`}>
            📎 Choose photo or PDF
          </label>
          <input
            id={`${idPrefix}-file`}
            type="file"
            accept="image/*,application/pdf"
            hidden
            onChange={(e) => onPick(e.target.files && e.target.files[0])}
          />
          <span className="attach-hint">or paste an image above</span>
        </div>
      ) : (
        <div className="attach-chip">
          <span className="attach-chip-name">📎 {file.name}</span>
          <button type="button" className="attach-chip-x" onClick={onClear} aria-label="Remove attached file">
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function ExtractTable({ rows }) {
  if (!rows || rows.length === 0) {
    return <p className="empty-hint">No matching fields were found in the text.</p>;
  }
  const keys = Object.keys(rows[0]);
  return (
    <table className="extract">
      <thead>
        <tr>
          {keys.map((k) => (
            <th key={k}>{k}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {keys.map((k) => (
              <td key={k}>{row[k] === null || row[k] === undefined ? '—' : String(row[k])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
