import Head from 'next/head';

const TOOLS = [
  {
    num: '01',
    name: 'Summarize',
    tag: 'LONG IN, SHORT OUT',
    desc: 'Condense articles, reports, and chapters into tight summaries that keep the meaning and drop the padding.',
    points: ['Key points in seconds', 'Length you control', 'Meaning stays intact'],
    color: '#E58A2B',
  },
  {
    num: '02',
    name: 'Generate',
    tag: 'FROM BRIEF TO DRAFT',
    desc: 'Turn a one-line brief into blog posts, emails, ad copy, and social media content that sounds like you wrote it.',
    points: ['Blog posts, emails, ads', 'Tone you pick', 'Ready to send'],
    color: '#3B8A3E',
  },
  {
    num: '03',
    name: 'Extract',
    tag: 'MESSY DOCS, CLEAN FIELDS',
    desc: 'Pull structured data - invoices, dates, amounts - out of documents and photos, sorted into fields you can use.',
    points: ['Invoices & receipts', 'Dates & amounts', 'Works from photos'],
    color: '#3B8A3E',
  },
  {
    num: '04',
    name: 'Proofread',
    tag: 'EVERY ERROR, EXPLAINED',
    desc: 'Grammar and spelling corrections with plain-language explanations, so your writing improves with every fix.',
    points: ['Grammar & spelling', 'Explains every fix', 'Learn as you edit'],
    color: '#E58A2B',
  },
];

const AUDIENCES = [
  {
    num: '05',
    title: 'Freelancers',
    desc: 'Turn client briefs into proposals, invoices into clean records, and rough notes into polished emails - before the deadline, not after.',
  },
  {
    num: '06',
    title: 'Students',
    desc: 'Summarize dense readings, draft assignments faster, and proofread with explanations that actually teach you the rule.',
  },
  {
    num: '07',
    title: 'Small business owners',
    desc: 'Extract totals from GST invoices and receipts, reply to customers without a copywriter, and keep paperwork sorted into fields.',
  },
];

const APP_URL = 'https://app.deskworkapp.in';

export default function Landing() {
  return (
    <div style={{ fontFamily: "'Courier New', monospace", background: '#f5f1e8', color: '#1a1a1a', minHeight: '100vh' }}>
      <Head>
        <title>Deskwork - AI Text Tools Made for India</title>
        <meta name="description" content="Summarize, generate, extract, and proofread text with four simple AI tools. Free to start, no card required." />
      </Head>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #ddd6c4' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ background: '#E58A2B', color: '#fff', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', borderRadius: 4 }}>D</span>
          <span style={{ fontWeight: 'bold', fontSize: 18 }}>Deskwork</span>
        </div>
        <a href={APP_URL} style={{ background: '#E58A2B', color: '#fff', padding: '10px 18px', textDecoration: 'none', fontWeight: 'bold', fontSize: 13, letterSpacing: 1, borderRadius: 4 }}>
          TRY DESKWORK FREE
        </a>
      </header>

      <section style={{ padding: '48px 24px 32px' }}>
        <p style={{ fontSize: 12, letterSpacing: 1, marginBottom: 16 }}>
          <span style={{ color: '#E58A2B' }}>-</span> AI TEXT TOOLS &nbsp;
          <span style={{ color: '#3B8A3E' }}>-</span> MADE FOR INDIA
        </p>
        <h1 style={{ fontSize: 34, lineHeight: 1.2, margin: '0 0 20px', fontFamily: 'Georgia, serif' }}>
          Three tools for what a page of text needs: <em style={{ color: '#E58A2B' }}>shorter</em>, <em>more</em>, or <em style={{ color: '#3B8A3E' }}>sorted into fields</em>.
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: '#444', marginBottom: 24 }}>
          Deskwork reads, writes, and tidies text with AI - Summarize, Generate, Extract, and Proofread in one quiet workspace. Free to start, no card required.
        </p>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <a href={APP_URL} style={{ background: '#E58A2B', color: '#fff', padding: '13px 22px', textDecoration: 'none', fontWeight: 'bold', fontSize: 13, letterSpacing: 1, borderRadius: 4 }}>
            TRY DESKWORK FREE â†’
          </a>
          <a href="#tools" style={{ color: '#1a1a1a', textDecoration: 'underline', fontSize: 13, letterSpacing: 1, fontWeight: 'bold' }}>
            SEE THE FOUR TOOLS â†“
          </a>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #ddd6c4', borderBottom: '1px solid #ddd6c4' }}>
        {TOOLS.map((t, i) => (
          <div key={t.num} style={{ padding: '16px 20px', borderRight: i % 2 === 0 ? '1px solid #ddd6c4' : 'none', borderBottom: i < 2 ? '1px solid #ddd6c4' : 'none' }}>
            <span style={{ color: t.color, fontWeight: 'bold', fontSize: 14 }}>{t.num}</span>{' '}
            <span style={{ fontSize: 13, letterSpacing: 1 }}>{t.name.toUpperCase()}</span>
          </div>
        ))}
      </section>

      <section id="tools" style={{ padding: '40px 24px' }}>
        <p style={{ fontSize: 12, letterSpacing: 1, color: '#E58A2B', fontWeight: 'bold', marginBottom: 8 }}>THE TOOLKIT</p>
        <h2 style={{ fontSize: 26, margin: '0 0 8px', fontFamily: 'Georgia, serif' }}>Four tools. One quiet workspace.</h2>
        <p style={{ fontSize: 14, color: '#555', marginBottom: 28, lineHeight: 1.6 }}>
          No clutter, no learning curve. Paste text or drop a document, pick a tool, and get a result you can use immediately.
        </p>
        {TOOLS.map((t) => (
          <div key={t.num} style={{ border: '1px solid #ddd6c4', borderRadius: 6, padding: 20, marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ color: t.color, fontSize: 28, fontWeight: 'bold', fontFamily: 'Georgia, serif' }}>{t.num}</span>
            </div>
            <h3 style={{ fontSize: 20, margin: '4px 0 2px', fontFamily: 'Georgia, serif' }}>{t.name}</h3>
            <p style={{ fontSize: 11, letterSpacing: 1, color: t.color, fontWeight: 'bold', marginBottom: 10 }}>{t.tag}</p>
            <p style={{ fontSize: 14, color: '#444', lineHeight: 1.6, marginBottom: 12 }}>{t.desc}</p>
            <div style={{ borderTop: '1px solid #eee6d5', paddingTop: 10 }}>
              {t.points.map((p) => (
                <p key={p} style={{ fontSize: 12, letterSpacing: 0.5, color: '#555', margin: '4px 0' }}>
                  <span style={{ color: t.color }}>-</span> {p.toUpperCase()}
                </p>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section style={{ padding: '40px 24px', background: '#fff' }}>
        <p style={{ fontSize: 12, letterSpacing: 1, color: '#E58A2B', fontWeight: 'bold', marginBottom: 8 }}>WHO IT'S FOR</p>
        <h2 style={{ fontSize: 26, margin: '0 0 24px', fontFamily: 'Georgia, serif' }}>Built for India's readers and writers.</h2>
        {AUDIENCES.map((a) => (
          <div key={a.num} style={{ borderTop: '1px solid #ddd6c4', padding: '18px 0' }}>
            <span style={{ color: '#999', fontSize: 24, fontFamily: 'Georgia, serif' }}>{a.num}</span>
            <h3 style={{ fontSize: 18, margin: '4px 0 6px', fontFamily: 'Georgia, serif' }}>{a.title}</h3>
            <p style={{ fontSize: 14, color: '#444', lineHeight: 1.6 }}>{a.desc}</p>
          </div>
        ))}
      </section>

      <section style={{ padding: '48px 24px', background: '#1a1a1a', color: '#fff' }}>
        <p style={{ fontSize: 12, letterSpacing: 1, color: '#3B8A3E', fontWeight: 'bold', marginBottom: 8 }}>- FREE TO START</p>
        <h2 style={{ fontSize: 26, margin: '0 0 12px', fontFamily: 'Georgia, serif' }}>
          Your next page of text, <em style={{ color: '#E58A2B' }}>handled</em>.
        </h2>
        <p style={{ fontSize: 14, color: '#ccc', marginBottom: 24, lineHeight: 1.6 }}>
          Open Deskwork in your browser and put the four tools to work - no card, no setup, no clutter.
        </p>
        <a href={APP_URL} style={{ display: 'inline-block', background: '#E58A2B', color: '#fff', padding: '14px 24px', textDecoration: 'none', fontWeight: 'bold', fontSize: 13, letterSpacing: 1, borderRadius: 4 }}>
          TRY DESKWORK FREE â†’
        </a>
      </section>

      <footer style={{ padding: '20px 24px', textAlign: 'center', fontSize: 12, color: '#888' }}>
        Deskwork - No. 3 tools
      </footer>
    </div>
  );
}
