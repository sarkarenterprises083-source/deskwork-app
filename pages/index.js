import { useState, useEffect } from 'react';
                        onChange={(e) => handleTextChange(e.target.value, setSumText)}
                onPaste={(e) => handlePaste(e, setSumFile)}
              />
              <FileAttach file={sumFile} onPick={(f) => handleFilePicked(f, setSumFile)} onClear={() => setSumFile(null)} idPrefix="sum" />
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="sum-length">Length</label>
                <select id="sum-length" value={sumLength} onChange={(e) => setSumLength(e.target.value)} disabled={sumBriefMode}>
                  <option value="one sentence">One sentence</option>
                  <option value="a short paragraph">Short paragraph</option>
                  <option value="a bulleted list of key points">Bulleted key points</option>
                  <option value="a detailed multi-paragraph summary">Detailed</option>
                </select>
              </div>
            </div>
            <label className="brief-toggle">
              <input
                type="checkbox"
                checked={sumBriefMode}
                onChange={(e) => { clearResultIfPresent(); setSumBriefMode(e.target.checked); }}
              />
              Also pull out action items (executive brief)
            </label>
          </div>
        )}

        {mode === 'generate' && (
          <div>
            <div className="field">
              <label htmlFor="gen-brief">Describe what you need</label>
              <textarea
                id="gen-brief"
                placeholder="e.g. A launch email for a new espresso machine, aimed at home baristas..."
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
                placeholder="Drop an invoice, listing, email, or contract here... (or paste a photo)"
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
            {output.kind === 'text' && (
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
            )}
            {output.kind === 'table' && <ExtractTable rows={output.rows} />}
            {output.kind === 'brief' && <BriefView summary={output.summary} actionItems={output.actionItems} />}
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
              <p className="empty-hint">No activity yet - your recent results will show up here.</p>
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
        </>
      )}
    </div>
  );
}

function FileAttach({ file, onPick, onClear, idPrefix }) {
  return (
    <div className="attach">
      {!file ? (
        <div className="attach-buttons">
          <label className="attach-btn" htmlFor={`${idPrefix}-camera`}>
            ðŸ“· Take photo
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
            ðŸ“Ž Choose photo or PDF
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
          <span className="attach-chip-name">ðŸ“Ž {file.name}</span>
          <button type="button" className="attach-chip-x" onClick={onClear} aria-label="Remove attached file">
            Ã—
          </button>
        </div>
      )}
    </div>
  );
}

function BriefView({ summary, actionItems }) {
  const [checked, setChecked] = useState({});

  function toggle(i) {
    setChecked((prev) => ({ ...prev, [i]: !prev[i] }));
  }

  return (
    <div className="brief-view">
      <div className="brief-section">
        <h3 className="brief-heading">Executive Summary</h3>
        {summary.length === 0 ? (
          <p className="empty-hint">No summary points found.</p>
        ) : (
          <ul className="brief-summary-list">
            {summary.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="brief-section">
        <h3 className="brief-heading">Action Items</h3>
        {actionItems.length === 0 ? (
          <p className="empty-hint">No action items found.</p>
        ) : (
          <ul className="brief-action-list no-print">
            {actionItems.map((item, i) => (
              <li key={i}>
                <label className="brief-checkbox">
                  <input type="checkbox" checked={!!checked[i]} onChange={() => toggle(i)} />
                  <span className={checked[i] ? 'checked-text' : ''}>{item}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {/* Plain list for printing/PDF, since checkboxes don't render well in print */}
        {actionItems.length > 0 && (
          <ul className="brief-action-list print-only">
            {actionItems.map((item, i) => (
              <li key={i}>â˜ {item}</li>
            ))}
          </ul>
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
              <td key={k}>{row[k] === null || row[k] === undefined ? '-' : String(row[k])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
