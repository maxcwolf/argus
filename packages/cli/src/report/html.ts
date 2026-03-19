import { readFile, writeFile as fsWriteFile } from 'fs/promises'
import { createWriteStream, existsSync } from 'fs'
import { ComparisonResult } from '@argus-vrt/shared'

/**
 * Convert an image file to a base64 data URI, or return null if not found.
 */
async function toDataUri(filePath: string): Promise<string | null> {
  if (!filePath || !existsSync(filePath)) return null
  const buf = await readFile(filePath)
  return `data:image/png;base64,${buf.toString('base64')}`
}

interface ReportOptions {
  results: ComparisonResult[]
  branch: string
  baseBranch: string
  portable: boolean
}

/**
 * Generate a self-contained HTML report for visual regression test results.
 * When `portable` is true, all images are embedded as base64 data URIs
 * so the file can be shared, uploaded as a CI artifact, etc.
 *
 * Returns the HTML string for non-portable reports. For portable reports
 * with many images, use `writeReport()` which streams to disk to avoid
 * V8 string length limits.
 */
export async function generateReport(options: ReportOptions): Promise<string> {
  const { results, branch, baseBranch, portable } = options
  const changedResults = results.filter((r) => r.hasDiff)
  const passedResults = results.filter((r) => !r.hasDiff)

  // Build result cards with optionally embedded images
  const resultCards: string[] = []
  for (const r of results) {
    const type = r.hasDiff ? 'changed' : 'passed'
    const baseline = portable ? await toDataUri(r.baselineUrl) : (r.baselineUrl ? `file://${r.baselineUrl}` : null)
    const current = portable ? await toDataUri(r.currentUrl) : `file://${r.currentUrl}`
    const diff = r.diffUrl ? (portable ? await toDataUri(r.diffUrl) : `file://${r.diffUrl}`) : null

    resultCards.push(buildResultCard(r, type, baseline, current, diff))
  }

  return buildHtml({ results, changedResults, passedResults, resultCards, branch, baseBranch })
}

/**
 * Stream a portable HTML report directly to a file to avoid V8 string length
 * limits when embedding many large base64 images.
 */
export async function writeReport(outputPath: string, options: ReportOptions): Promise<void> {
  const { results, branch, baseBranch, portable } = options
  const changedResults = results.filter((r) => r.hasDiff)
  const passedResults = results.filter((r) => !r.hasDiff)

  const stream = createWriteStream(outputPath, { encoding: 'utf-8' })

  const write = (chunk: string): Promise<void> =>
    new Promise((resolve, reject) => {
      if (!stream.write(chunk)) {
        stream.once('drain', resolve)
      } else {
        resolve()
      }
    })

  // Write header
  await write(buildHtmlHeader({ results, changedResults, passedResults, branch, baseBranch }))

  // Write each result card individually to avoid building one massive string
  for (const r of results) {
    const type = r.hasDiff ? 'changed' : 'passed'
    const baseline = portable ? await toDataUri(r.baselineUrl) : (r.baselineUrl ? `file://${r.baselineUrl}` : null)
    const current = portable ? await toDataUri(r.currentUrl) : `file://${r.currentUrl}`
    const diff = r.diffUrl ? (portable ? await toDataUri(r.diffUrl) : `file://${r.diffUrl}`) : null

    await write(buildResultCard(r, type, baseline, current, diff))
  }

  // Write footer
  await write(buildHtmlFooter())

  // Close stream
  await new Promise<void>((resolve, reject) => {
    stream.end(() => resolve())
    stream.on('error', reject)
  })
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildHtmlHeader(opts: {
  results: ComparisonResult[]
  changedResults: ComparisonResult[]
  passedResults: ComparisonResult[]
  branch: string
  baseBranch: string
}): string {
  const { results, changedResults, passedResults, branch, baseBranch } = opts

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Argus - Visual Regression Report</title>
<style>
${CSS}
</style>
</head>
<body>
<div class="container">
  <header class="header">
    <div class="header-left">
      <h1>Argus</h1>
      <span class="header-subtitle">Visual Regression Report</span>
    </div>
    <div class="header-right">
      <button class="theme-toggle" onclick="toggleTheme()" title="Toggle dark mode">
        <svg class="icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
        <svg class="icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
      </button>
    </div>
  </header>

  <div class="meta">
    <span><strong>Branch:</strong> ${escapeHtml(branch)}</span>
    <span><strong>Base:</strong> ${escapeHtml(baseBranch)}</span>
    <span><strong>Stories:</strong> ${results.length}</span>
    <span><strong>Generated:</strong> ${new Date().toLocaleString()}</span>
  </div>

  <div class="stats">
    <div class="stat stat-passed">
      <div class="stat-value">${passedResults.length}</div>
      <div class="stat-label">Passed</div>
    </div>
    <div class="stat stat-changed">
      <div class="stat-value">${changedResults.length}</div>
      <div class="stat-label">Changed</div>
    </div>
    <div class="stat stat-total">
      <div class="stat-value">${results.length}</div>
      <div class="stat-label">Total</div>
    </div>
  </div>

  <div class="toolbar">
    <div class="tabs">
      <button class="tab active" onclick="showTab('changed', this)">Changed (${changedResults.length})</button>
      <button class="tab" onclick="showTab('passed', this)">Passed (${passedResults.length})</button>
      <button class="tab" onclick="showTab('all', this)">All (${results.length})</button>
    </div>
    <div class="search-box">
      <input type="text" id="search" placeholder="Filter stories..." oninput="filterStories(this.value)">
    </div>
  </div>

  <div id="results" class="results active">
`
}

function buildHtmlFooter(): string {
  return `
  </div>
</div>
<script>
${JS}
</script>
</body>
</html>`
}

/**
 * Build the full HTML as a single string (for non-portable / small reports).
 */
function buildHtml(opts: {
  results: ComparisonResult[]
  changedResults: ComparisonResult[]
  passedResults: ComparisonResult[]
  resultCards: string[]
  branch: string
  baseBranch: string
}): string {
  const { results, changedResults, passedResults, resultCards, branch, baseBranch } = opts

  const header = buildHtmlHeader({ results, changedResults, passedResults, branch, baseBranch })
  const cards = resultCards.length ? resultCards.join('\n') : '<div class="empty-state">No stories found</div>'
  const footer = buildHtmlFooter()

  return header + cards + footer
}

function buildResultCard(
  result: ComparisonResult,
  type: string,
  baseline: string | null,
  current: string | null,
  diff: string | null
): string {
  const name = result.componentName || result.storyId
  const story = result.storyName || ''
  const title = story ? `${escapeHtml(name)} / ${escapeHtml(story)}` : escapeHtml(name)
  const diffPct = result.pixelDiff.toFixed(2)
  const ssim = result.ssimScore.toFixed(3)

  const hasDiffImage = !!diff
  const baselineSrc = baseline || ''
  const currentSrc = current || ''
  const diffSrc = diff || ''

  return `
    <div class="result ${type}" data-name="${escapeHtml((name + ' ' + story).toLowerCase())}">
      <div class="result-header" onclick="toggleResult(this)">
        <div class="result-info">
          <span class="result-status ${type}"></span>
          <span class="result-title">${title}</span>
        </div>
        <div class="result-meta">
          ${result.hasDiff ? `<span class="badge badge-diff">${diffPct}%</span><span class="badge badge-ssim">SSIM ${ssim}</span>` : '<span class="badge badge-pass">Pass</span>'}
          <span class="chevron">&#9662;</span>
        </div>
      </div>
      <div class="result-body" style="display:none">
        <div class="view-controls">
          <button class="view-btn active" onclick="setView(this, 'side-by-side')">Side by Side</button>
          ${hasDiffImage ? '<button class="view-btn" onclick="setView(this, \'diff\')">Diff</button>' : ''}
          ${hasDiffImage ? '<button class="view-btn" onclick="setView(this, \'overlay\')">Overlay</button>' : ''}
          <button class="view-btn" onclick="setView(this, 'current')">Current</button>
          <div class="overlay-controls" style="display:none">
            <label>Opacity:</label>
            <input type="range" min="0" max="100" value="50" oninput="setOpacity(this)">
            <span class="opacity-value">50%</span>
          </div>
        </div>
        <div class="view-content" data-view="side-by-side">
          <div class="image-panel side-by-side-view">
            <div class="image-col">
              <div class="image-label">Baseline</div>
              ${baselineSrc ? `<img src="${baselineSrc}" alt="Baseline" loading="lazy">` : '<div class="no-image">No baseline (new story)</div>'}
            </div>
            <div class="image-col">
              <div class="image-label">Current</div>
              ${currentSrc ? `<img src="${currentSrc}" alt="Current" loading="lazy">` : '<div class="no-image">No image</div>'}
            </div>
          </div>
          <div class="image-panel diff-view" style="display:none">
            <div class="image-col full">
              <div class="image-label">Difference</div>
              ${diffSrc ? `<img src="${diffSrc}" alt="Diff" loading="lazy">` : '<div class="no-image">No diff</div>'}
            </div>
          </div>
          <div class="image-panel overlay-view" style="display:none">
            <div class="image-col full overlay-container">
              <div class="image-label">Overlay (current + diff)</div>
              ${currentSrc ? `<img src="${currentSrc}" alt="Current" class="overlay-base" loading="lazy">` : ''}
              ${diffSrc ? `<img src="${diffSrc}" alt="Diff" class="overlay-diff" style="opacity:0.5" loading="lazy">` : ''}
            </div>
          </div>
          <div class="image-panel current-view" style="display:none">
            <div class="image-col full">
              <div class="image-label">Current</div>
              ${currentSrc ? `<img src="${currentSrc}" alt="Current" loading="lazy">` : '<div class="no-image">No image</div>'}
            </div>
          </div>
        </div>
      </div>
    </div>`
}

const CSS = `
:root {
  --bg: #f8f9fa; --bg-card: #fff; --bg-header: #fff; --border: #e2e8f0;
  --text: #1a202c; --text-muted: #718096; --text-dim: #a0aec0;
  --accent: #4f46e5; --accent-light: #eef2ff;
  --green: #16a34a; --green-bg: #dcfce7; --green-text: #166534;
  --yellow: #ca8a04; --yellow-bg: #fef9c3; --yellow-text: #854d0e;
  --blue-bg: #eff6ff; --blue-text: #1e40af;
  --radius: 8px;
}
.dark {
  --bg: #0f172a; --bg-card: #1e293b; --bg-header: #1e293b; --border: #334155;
  --text: #e2e8f0; --text-muted: #94a3b8; --text-dim: #64748b;
  --accent: #818cf8; --accent-light: #1e1b4b;
  --green-bg: #052e16; --green-text: #86efac;
  --yellow-bg: #422006; --yellow-text: #fde68a;
  --blue-bg: #172554; --blue-text: #93c5fd;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; }
.container { max-width: 1200px; margin: 0 auto; padding: 24px; }
.header { display: flex; justify-content: space-between; align-items: center; padding: 16px 0; margin-bottom: 16px; border-bottom: 1px solid var(--border); }
.header h1 { font-size: 22px; font-weight: 700; }
.header-subtitle { color: var(--text-muted); font-size: 14px; margin-left: 12px; }
.header-left { display: flex; align-items: baseline; }
.theme-toggle { background: none; border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; }
.theme-toggle:hover { background: var(--bg-card); }
.dark .icon-sun { display: inline; } .dark .icon-moon { display: none; }
.icon-sun { display: none; } .icon-moon { display: inline; }
.meta { display: flex; gap: 20px; flex-wrap: wrap; color: var(--text-muted); font-size: 13px; margin-bottom: 20px; }
.stats { display: flex; gap: 12px; margin-bottom: 24px; }
.stat { flex: 1; padding: 16px; border-radius: var(--radius); text-align: center; }
.stat-value { font-size: 28px; font-weight: 700; }
.stat-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
.stat-passed { background: var(--green-bg); color: var(--green-text); }
.stat-changed { background: var(--yellow-bg); color: var(--yellow-text); }
.stat-total { background: var(--blue-bg); color: var(--blue-text); }
.toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.tabs { display: flex; gap: 4px; }
.tab { padding: 8px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; color: var(--text-muted); transition: all 0.15s; }
.tab:hover { border-color: var(--accent); color: var(--accent); }
.tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.search-box input { padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; background: var(--bg-card); color: var(--text); width: 220px; }
.search-box input:focus { outline: none; border-color: var(--accent); }
.results { display: none; flex-direction: column; gap: 8px; }
.results.active { display: flex; }
.empty-state { text-align: center; padding: 48px; color: var(--text-dim); font-size: 14px; }
.result { border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-card); overflow: hidden; }
.result-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; cursor: pointer; user-select: none; transition: background 0.1s; }
.result-header:hover { background: var(--bg); }
.result-info { display: flex; align-items: center; gap: 10px; min-width: 0; }
.result-status { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.result-status.passed { background: var(--green); }
.result-status.changed { background: var(--yellow); }
.result-title { font-weight: 500; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.result-meta { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
.badge-diff { background: var(--yellow-bg); color: var(--yellow-text); }
.badge-ssim { background: var(--blue-bg); color: var(--blue-text); }
.badge-pass { background: var(--green-bg); color: var(--green-text); }
.chevron { color: var(--text-dim); font-size: 12px; transition: transform 0.2s; margin-left: 4px; }
.result-header.open .chevron { transform: rotate(180deg); }
.result-body { padding: 16px; border-top: 1px solid var(--border); }
.view-controls { display: flex; gap: 4px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
.view-btn { padding: 6px 12px; font-size: 12px; border: 1px solid var(--border); border-radius: 5px; background: var(--bg); color: var(--text-muted); cursor: pointer; transition: all 0.15s; }
.view-btn:hover { border-color: var(--accent); color: var(--accent); }
.view-btn.active { background: var(--accent-light); color: var(--accent); border-color: var(--accent); }
.overlay-controls { display: flex; align-items: center; gap: 8px; margin-left: 12px; padding-left: 12px; border-left: 1px solid var(--border); font-size: 12px; color: var(--text-muted); }
.overlay-controls input[type="range"] { width: 80px; }
.opacity-value { width: 32px; text-align: right; }
.image-panel { display: none; }
.image-panel.active { display: block; }
.side-by-side-view.active { display: grid; }
.side-by-side-view { grid-template-columns: 1fr 1fr; gap: 16px; }
.image-col { display: flex; flex-direction: column; align-items: center; }
.image-col.full { width: 100%; }
.image-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 8px; }
.image-col img { max-width: 100%; max-height: 70vh; width: auto; height: auto; object-fit: contain; border: 1px solid var(--border); border-radius: 6px; background: repeating-conic-gradient(var(--border) 0% 25%, transparent 0% 50%) 50%/16px 16px; }
.no-image { border: 1px dashed var(--border); border-radius: 6px; padding: 48px 24px; text-align: center; color: var(--text-dim); font-size: 13px; }
.overlay-container { position: relative; }
.overlay-container .overlay-base { display: block; max-width: 100%; }
.overlay-container .overlay-diff { position: absolute; top: 0; left: 0; max-width: 100%; pointer-events: none; border: none; background: none; }
@media (max-width: 640px) {
  .side-by-side-view { grid-template-columns: 1fr; }
  .stats { flex-direction: column; }
  .toolbar { flex-direction: column; align-items: stretch; }
  .search-box input { width: 100%; }
}
`

const JS = `
function showTab(tab, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const results = document.getElementById('results');
  const cards = results.querySelectorAll('.result');
  cards.forEach(r => {
    if (tab === 'all') {
      r.style.display = '';
    } else {
      r.style.display = r.classList.contains(tab) ? '' : 'none';
    }
  });
}

function toggleResult(header) {
  const body = header.nextElementSibling;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  header.classList.toggle('open', !isOpen);
  // Auto-activate first view
  if (!isOpen) {
    const firstPanel = body.querySelector('.image-panel');
    if (firstPanel && !body.querySelector('.image-panel.active')) {
      firstPanel.classList.add('active');
    }
  }
}

function setView(btn, view) {
  const body = btn.closest('.result-body');
  body.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  body.querySelectorAll('.image-panel').forEach(p => p.classList.remove('active'));
  body.querySelector('.' + view + '-view').classList.add('active');
  const overlayCtrl = body.querySelector('.overlay-controls');
  if (overlayCtrl) overlayCtrl.style.display = view === 'overlay' ? 'flex' : 'none';
}

function setOpacity(slider) {
  const body = slider.closest('.result-body');
  const val = slider.value / 100;
  const diffImg = body.querySelector('.overlay-diff');
  if (diffImg) diffImg.style.opacity = val;
  body.querySelector('.opacity-value').textContent = slider.value + '%';
}

function filterStories(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('.result').forEach(r => {
    const name = r.dataset.name || '';
    r.style.display = name.includes(q) ? '' : 'none';
  });
}

function toggleTheme() {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem('argus-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
}

// Init theme
(function() {
  const saved = localStorage.getItem('argus-theme');
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
  // Auto-expand changed results if few
  const changed = document.querySelectorAll('#results .result.changed');
  if (changed.length > 0 && changed.length <= 5) {
    changed.forEach(r => {
      const header = r.querySelector('.result-header');
      if (header) toggleResult(header);
    });
  }
})();
`
