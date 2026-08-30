import { useState } from 'react';
import Head from 'next/head';

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

  // Summarize state
  const [sumText, setSumText] = useState('');
  const [sumLength, setSumLength] = useState('a short paragraph');

  // Generate state
  const [genBrief, setGenBrief] = useState('');
  const [genType, setGenType] = useState('Blog post');
  const [genTone, setGenTone] = useState('Professional');

  // Extract state
  const [extText, setExtText] = useState('');
  const [extFields, setExtFields] = useState('');

  function switchMode(next) {
    setMode(next);
    setOutput(null);
    setStatus({ text: '', error: false });
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
        if (!sumText.trim()) return setStatus({ text: 'Paste some text first.', error: true });
        setBusy(true);
        setStatus({ text: 'Reading it over…', error: false });
        const result = await callApi({ mode: 'summarize', text: sumText, length: sumLength });
        setOutput({ title: 'Summary', kind: 'text', text: result });
      } else if (mode === 'generate') {
        if (!genBrief.trim()) return setStatus({ text: 'Describe what you need first.', error: true });
        setBusy(true);
        setStatus({ text: 'Drafting…', error: false });
        const result = await callApi({ mode: 'generate', brief: genBrief, type: genType, tone: genTone });
        setOutput({ title: genType, kind: 'text', text: result });
      } else if (mode === 'extract') {
        if (!extText.trim()) return setStatus({ text: 'Paste some text first.', error: true });
        const fields = extFields.split(',').map((f) => f.trim()).filter(Boolean);
        if (fields.length === 0) return setStatus({ text: 'List at least one field to extract.', error: true });
        setBusy(true);
        setStatus({ text: 'Sorting into fields…', error: false });
        const raw = await callApi({ mode: 'extract', text: extText, fields });
        let rows;
        try {
          const cleaned = raw.replace(/```json|```/g, '').trim();
          rows = JSON.parse(cleaned);
          if (!Array.isArray(rows)) rows = [rows];
        } catch (e) {
          throw new Error('Could not parse the extracted data.');
        }
        setOutput({ title: 'Extracted fields', kind: 'table', rows });
      }
      setStatus({ text: '', error: false });
    } catch (err) {
      setStatus({ text: err.message || 'Something went wrong.', error: true });
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
              <label htmlFor="sum-text">Paste the text to summarize</label>
              <textarea
                id="sum-text"
                placeholder="Drop an article, report, or transcript here…"
                value={sumText}
                onChange={(e) => setSumText(e.target.value)}
              />
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
                onChange={(e) => setGenBrief(e.target.value)}
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
              <label htmlFor="ext-text">Paste the source text</label>
              <textarea
                id="ext-text"
                placeholder="Drop an invoice, listing, email, or contract here…"
                value={extText}
                onChange={(e) => setExtText(e.target.value)}
              />
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
          <div className="output">
            <div className="output-head">
              <h2>{output.title}</h2>
              <button className="copy" onClick={handleCopy}>
                Copy
              </button>
            </div>
            {output.kind === 'text' ? (
              <div className="result-text">{output.text}</div>
            ) : (
              <ExtractTable rows={output.rows} />
            )}
          </div>
        )}
      </div>
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
