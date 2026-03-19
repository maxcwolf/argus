import { readFile } from 'fs/promises'
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
 * Returns the HTML string for non-portable / small reports.
 * For portable reports with many images, use writeReport() which streams to disk.
 */
export async function generateReport(options: ReportOptions): Promise<string> {
  const { results, branch, baseBranch, portable } = options

  const panels: string[] = []
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const baseline = portable ? await toDataUri(r.baselineUrl) : r.baselineUrl ? `file://${r.baselineUrl}` : null
    const current = portable ? await toDataUri(r.currentUrl) : `file://${r.currentUrl}`
    const diff = r.diffUrl ? (portable ? await toDataUri(r.diffUrl) : `file://${r.diffUrl}`) : null
    panels.push(buildPanel(r, i, baseline, current, diff))
  }

  return buildHtmlHeader({ results, branch, baseBranch }) + panels.join('\n') + buildHtmlFooter()
}

/**
 * Stream a portable HTML report directly to a file to avoid V8 string length
 * limits when embedding many large base64 images.
 *
 * Image data is stored once per story in a JS map and only loaded into <img>
 * elements when a story is selected, keeping initial page load fast.
 */
export async function writeReport(outputPath: string, options: ReportOptions): Promise<void> {
  const { results, branch, baseBranch, portable } = options

  const stream = createWriteStream(outputPath, { encoding: 'utf-8' })

  const write = (chunk: string): Promise<void> =>
    new Promise((resolve, reject) => {
      if (!stream.write(chunk)) {
        stream.once('drain', resolve)
      } else {
        resolve()
      }
    })

  await write(buildHtmlHeader({ results, branch, baseBranch }))

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const baseline = portable ? await toDataUri(r.baselineUrl) : r.baselineUrl ? `file://${r.baselineUrl}` : null
    const current = portable ? await toDataUri(r.currentUrl) : `file://${r.currentUrl}`
    const diff = r.diffUrl ? (portable ? await toDataUri(r.diffUrl) : `file://${r.diffUrl}`) : null

    // Write panel HTML (no image data in markup)
    await write(buildPanel(r, i, baseline, current, diff))
  }

  await write(buildHtmlFooter())

  await new Promise<void>((resolve, reject) => {
    stream.end(() => resolve())
    stream.on('error', reject)
  })
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Build the sidebar tree HTML from results */
function buildSidebarTree(results: ComparisonResult[]): string {
  interface TreeNode {
    children: Map<string, TreeNode>
    stories: { index: number; result: ComparisonResult }[]
  }

  const root: TreeNode = { children: new Map(), stories: [] }

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const path = r.kind || r.componentName || 'Other'
    const segments = path.split('/').filter(Boolean)

    let node = root
    for (const seg of segments) {
      if (!node.children.has(seg)) {
        node.children.set(seg, { children: new Map(), stories: [] })
      }
      node = node.children.get(seg)!
    }
    node.stories.push({ index: i, result: r })
  }

  function countChanged(node: TreeNode): number {
    let n = node.stories.filter((s) => s.result.hasDiff).length
    for (const child of node.children.values()) n += countChanged(child)
    return n
  }

  function render(node: TreeNode, depth: number): string {
    let html = ''
    const folders = [...node.children.entries()].sort((a, b) => a[0].localeCompare(b[0]))

    for (const [name, child] of folders) {
      const changed = countChanged(child)
      const badge = changed > 0 ? `<span class="tree-badge">${changed}</span>` : ''

      html += `<div class="tree-folder">
        <div class="tree-folder-header" style="padding-left:${12 + depth * 16}px" onclick="toggleFolder(this)">
          <span class="folder-arrow">&#9656;</span>
          <span class="folder-name">${escapeHtml(name)}</span>
          ${badge}
        </div>
        <div class="tree-folder-content">${render(child, depth + 1)}</div>
      </div>`
    }

    const stories = [...node.stories].sort((a, b) =>
      (a.result.storyName || a.result.storyId).localeCompare(b.result.storyName || b.result.storyId)
    )

    for (const { index, result } of stories) {
      const label = result.storyName || result.storyId
      const searchText = [result.kind, result.componentName, result.storyName, result.storyId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      html += `<div class="tree-item" data-index="${index}" data-has-diff="${result.hasDiff}" data-search="${escapeHtml(searchText)}" style="padding-left:${12 + (depth + 1) * 16}px" onclick="selectStory(${index})">
        <span class="tree-dot ${result.hasDiff ? 'dot-changed' : 'dot-passed'}"></span>
        <span class="tree-label">${escapeHtml(label)}</span>
      </div>`
    }

    return html
  }

  return render(root, 0)
}

function buildHtmlHeader(opts: { results: ComparisonResult[]; branch: string; baseBranch: string }): string {
  const { results, branch, baseBranch } = opts
  const changedCount = results.filter((r) => r.hasDiff).length
  const passedCount = results.filter((r) => !r.hasDiff).length
  const treeHtml = buildSidebarTree(results)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Argus - Visual Regression Report</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<style>
${CSS}
</style>
</head>
<body>
<script>var _IMG={};</script>
<div class="app">
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <div class="brand-group">
        <svg class="brand-logo" width="28" height="28" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="28" stroke="#6366f1" stroke-width="3" fill="none"/><circle cx="32" cy="32" r="18" stroke="#818cf8" stroke-width="2" fill="none"/><circle cx="32" cy="32" r="10" fill="#6366f1"/><circle cx="32" cy="32" r="5" fill="#1e1b4b"/><circle cx="34" cy="30" r="2" fill="white"/></svg>
        <div class="brand-text">
          <span class="brand-name">Argus</span>
          <span class="brand-sub">Visual Regression</span>
        </div>
      </div>
      <button class="icon-btn" onclick="toggleTheme()" title="Toggle dark mode">
        <svg class="icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
        <svg class="icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
      </button>
    </div>
    <div class="sidebar-branch">
      <span>${escapeHtml(branch)}</span>
      <span class="branch-arrow">&rarr;</span>
      <span>${escapeHtml(baseBranch)}</span>
    </div>
    <div class="sidebar-modes">
      <button class="mode-btn active" data-mode="stories" onclick="setMode('stories',this)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        Stories
      </button>
      <button class="mode-btn" data-mode="changes" onclick="setMode('changes',this)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="9"/></svg>
        Changes
        ${changedCount > 0 ? `<span class="mode-count">${changedCount}</span>` : ''}
      </button>
    </div>
    <div class="sidebar-search">
      <input type="text" id="search-input" placeholder="Search stories..." oninput="filterTree(this.value)">
    </div>
    <div class="sidebar-stats">
      <span class="pill pill-passed">${passedCount} passed</span>
      <span class="pill pill-changed">${changedCount} changed</span>
      <span class="pill pill-total">${results.length} total</span>
    </div>
    <nav class="sidebar-tree" id="sidebar-tree">
${treeHtml}
    </nav>
  </aside>

  <main class="content" id="content">
    <button class="mobile-menu-btn" id="mobile-menu-btn" onclick="toggleSidebar()">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
    </button>

    <div class="welcome" id="welcome">
      <div class="welcome-inner">
        <svg class="welcome-logo" width="48" height="48" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="28" stroke="#6366f1" stroke-width="3" fill="none"/><circle cx="32" cy="32" r="18" stroke="#818cf8" stroke-width="2" fill="none"/><circle cx="32" cy="32" r="10" fill="#6366f1"/><circle cx="32" cy="32" r="5" fill="#1e1b4b"/><circle cx="34" cy="30" r="2" fill="white"/></svg>
        <h1>Argus</h1>
        <p class="welcome-sub">Visual Regression Report</p>
        <div class="welcome-stats">
          <div class="welcome-stat">
            <div class="welcome-val">${results.length}</div>
            <div class="welcome-label">Stories</div>
          </div>
          <div class="welcome-stat stat-passed">
            <div class="welcome-val">${passedCount}</div>
            <div class="welcome-label">Passed</div>
          </div>
          <div class="welcome-stat stat-changed">
            <div class="welcome-val">${changedCount}</div>
            <div class="welcome-label">Changed</div>
          </div>
        </div>
        <p class="welcome-hint"><strong>${escapeHtml(branch)}</strong> compared against <strong>${escapeHtml(baseBranch)}</strong></p>
        <p class="welcome-hint welcome-date">${new Date().toLocaleString()}</p>
      </div>
    </div>

    <div id="panels">
`
}

function buildPanel(
  result: ComparisonResult,
  index: number,
  baseline: string | null,
  current: string | null,
  diff: string | null
): string {
  const name = result.componentName || result.storyId
  const story = result.storyName || ''
  const title = story ? `${escapeHtml(name)} / ${escapeHtml(story)}` : escapeHtml(name)
  const kind = result.kind ? escapeHtml(result.kind) : ''
  const diffPct = result.pixelDiff.toFixed(2)
  const ssim = result.ssimScore.toFixed(3)
  const hasDiffImage = !!diff
  const hasBaseline = !!baseline
  const hasCurrent = !!current

  // Image data stored in JS map — only loaded into <img> when panel is selected
  const imgJson = JSON.stringify({ b: baseline || '', c: current || '', d: diff || '' })

  return `
      <div class="panel" id="panel-${index}" data-has-diff="${result.hasDiff}" style="display:none">
        <div class="panel-header">
          <div class="panel-title-section">
            ${kind ? `<div class="panel-kind">${kind}</div>` : ''}
            <h2 class="panel-title">${title}</h2>
          </div>
          <div class="panel-badges">
            ${
              result.hasDiff
                ? `<span class="badge badge-diff">${diffPct}% diff</span><span class="badge badge-ssim">SSIM ${ssim}</span>`
                : '<span class="badge badge-pass">Passed</span>'
            }
            ${result.renderTime ? `<span class="badge badge-meta">${result.renderTime}ms</span>` : ''}
          </div>
        </div>

        <div class="panel-stories-view">
          <div class="story-toggle">
            <button class="story-toggle-btn active" onclick="setStoryImage(this,'current')">Current</button>
            <button class="story-toggle-btn" onclick="setStoryImage(this,'baseline')">Baseline</button>
          </div>
          <div class="story-img-wrap story-img-current active">
            ${hasCurrent ? '<img data-role="story-current" loading="lazy">' : '<div class="no-image">No image</div>'}
          </div>
          <div class="story-img-wrap story-img-baseline">
            ${hasBaseline ? '<img data-role="story-baseline" loading="lazy">' : '<div class="no-image">No baseline</div>'}
          </div>
        </div>

        <div class="panel-changes-view" style="display:none">
          <div class="view-controls">
            <button class="view-btn active" onclick="setView(this,'side-by-side')">Side by Side</button>
            ${hasDiffImage ? '<button class="view-btn" onclick="setView(this,\'diff\')">Diff</button>' : ''}
            ${hasDiffImage ? '<button class="view-btn" onclick="setView(this,\'overlay\')">Overlay</button>' : ''}
            <button class="view-btn" onclick="setView(this,'current')">Current Only</button>
            <div class="overlay-ctrl" style="display:none">
              <label>Opacity:</label>
              <input type="range" min="0" max="100" value="50" oninput="setOpacity(this)">
              <span class="opacity-val">50%</span>
            </div>
          </div>

          <div class="img-views">
            <div class="img-view side-by-side-view active">
              <div class="img-col">
                <div class="img-label">Baseline</div>
                ${hasBaseline ? '<img data-role="sbs-baseline" loading="lazy">' : '<div class="no-image">No baseline (new story)</div>'}
              </div>
              <div class="img-col">
                <div class="img-label">Current</div>
                ${hasCurrent ? '<img data-role="sbs-current" loading="lazy">' : '<div class="no-image">No image</div>'}
              </div>
            </div>

            <div class="img-view diff-view">
              <div class="img-col full">
                <div class="img-label">Difference</div>
                ${hasDiffImage ? '<img data-role="diff-img" loading="lazy">' : '<div class="no-image">No diff</div>'}
              </div>
            </div>

            <div class="img-view overlay-view">
              <div class="img-col full overlay-wrap">
                <div class="img-label">Overlay</div>
                ${hasCurrent ? '<img data-role="overlay-base" class="overlay-base" loading="lazy">' : ''}
                ${hasDiffImage ? '<img data-role="overlay-diff" class="overlay-diff" style="opacity:0.5" loading="lazy">' : ''}
              </div>
            </div>

            <div class="img-view current-view">
              <div class="img-col full">
                <div class="img-label">Current</div>
                ${hasCurrent ? '<img data-role="current-only" loading="lazy">' : '<div class="no-image">No image</div>'}
              </div>
            </div>
          </div>
        </div>
      </div>
      <script>_IMG[${index}]=${imgJson}</script>`
}

function buildHtmlFooter(): string {
  return `
    </div>
  </main>
</div>
<script>
${JS}
</script>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------
const CSS = `
:root {
  --bg: #f8f9fa; --bg-card: #fff; --border: #e2e8f0;
  --text: #1a202c; --text-muted: #64748b; --text-dim: #94a3b8;
  --accent: #4f46e5; --accent-light: #eef2ff; --accent-hover: #4338ca;
  --sidebar-bg: #fff; --sidebar-hover: #f1f5f9;
  --green: #16a34a; --green-bg: #dcfce7; --green-text: #166534;
  --yellow: #ca8a04; --yellow-bg: #fef9c3; --yellow-text: #854d0e;
  --blue-bg: #eff6ff; --blue-text: #1e40af;
  --radius: 8px;
}
.dark {
  --bg: #0f172a; --bg-card: #1e293b; --border: #334155;
  --text: #e2e8f0; --text-muted: #94a3b8; --text-dim: #475569;
  --accent: #818cf8; --accent-light: #1e1b4b; --accent-hover: #6366f1;
  --sidebar-bg: #1e293b; --sidebar-hover: #334155;
  --green-bg: #052e16; --green-text: #86efac;
  --yellow-bg: #422006; --yellow-text: #fde68a;
  --blue-bg: #172554; --blue-text: #93c5fd;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif;
  background: var(--bg); color: var(--text); line-height: 1.5;
  overflow: hidden;
}

/* Layout */
.app { display: flex; height: 100vh; }

/* Sidebar */
.sidebar {
  width: 280px; min-width: 280px; background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column; height: 100vh;
}
.sidebar-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; border-bottom: 1px solid var(--border);
}
.brand-group { display: flex; align-items: center; gap: 10px; }
.brand-logo { flex-shrink: 0; }
.brand-text { display: flex; flex-direction: column; }
.brand-name {
  font-family: 'Space Grotesk', -apple-system, sans-serif;
  font-size: 17px; font-weight: 600; line-height: 1.2;
}
.brand-sub { font-size: 10px; color: var(--text-muted); line-height: 1.2; }
.icon-btn {
  background: none; border: 1px solid var(--border); border-radius: 6px;
  padding: 5px 7px; cursor: pointer; color: var(--text-muted);
  display: flex; align-items: center;
}
.icon-btn:hover { background: var(--sidebar-hover); }
.dark .icon-sun { display: inline; } .dark .icon-moon { display: none; }
.icon-sun { display: none; } .icon-moon { display: inline; }

.sidebar-branch {
  padding: 8px 16px; font-size: 12px; color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  display: flex; gap: 5px; align-items: center;
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
}
.branch-arrow { color: var(--text-dim); }

.sidebar-modes {
  display: flex; gap: 4px; padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}
.mode-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px;
  padding: 7px 8px; font-size: 12px; font-weight: 500;
  border: 1px solid var(--border); border-radius: 6px;
  background: transparent; color: var(--text-muted); cursor: pointer;
}
.mode-btn:hover:not(.active) { border-color: var(--accent); color: var(--accent); }
.mode-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.mode-btn.active svg { stroke: #fff; }
.mode-count {
  font-size: 10px; background: rgba(255,255,255,0.25); color: #fff;
  padding: 0 6px; border-radius: 8px; font-weight: 600;
}

.sidebar-search { padding: 8px 12px; border-bottom: 1px solid var(--border); }
.sidebar-search input {
  width: 100%; padding: 7px 10px; font-size: 12px;
  border: 1px solid var(--border); border-radius: 6px;
  background: var(--bg); color: var(--text);
}
.sidebar-search input:focus { outline: none; border-color: var(--accent); }

.sidebar-stats {
  display: flex; gap: 5px; padding: 8px 12px;
  border-bottom: 1px solid var(--border); flex-wrap: wrap;
}
.pill {
  font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500;
}
.pill-passed { background: var(--green-bg); color: var(--green-text); }
.pill-changed { background: var(--yellow-bg); color: var(--yellow-text); }
.pill-total { background: var(--blue-bg); color: var(--blue-text); }

/* Tree */
.sidebar-tree {
  flex: 1; overflow-y: auto; padding: 6px 0;
}
.sidebar-tree::-webkit-scrollbar { width: 6px; }
.sidebar-tree::-webkit-scrollbar-track { background: transparent; }
.sidebar-tree::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

.tree-folder-content { overflow: hidden; }
.tree-folder-content.collapsed { display: none; }
.tree-folder-header {
  display: flex; align-items: center; gap: 4px;
  padding: 5px 12px; cursor: pointer;
  font-size: 13px; font-weight: 500; color: var(--text);
  user-select: none;
}
.tree-folder-header:hover { background: var(--sidebar-hover); }
.folder-arrow {
  font-size: 10px; color: var(--text-dim);
  transition: transform 0.15s; display: inline-block; width: 14px; text-align: center;
}
.tree-folder-header.open .folder-arrow { transform: rotate(90deg); }
.folder-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tree-badge {
  font-size: 10px; padding: 0 5px; border-radius: 8px; font-weight: 600;
  background: var(--yellow-bg); color: var(--yellow-text);
}

.tree-item {
  display: flex; align-items: center; gap: 7px;
  padding: 5px 12px; cursor: pointer;
  font-size: 13px; color: var(--text-muted); user-select: none;
  border-left: 2px solid transparent;
}
.tree-item:hover { background: var(--sidebar-hover); color: var(--text); }
.tree-item.active {
  background: var(--accent-light); color: var(--accent);
  border-left-color: var(--accent); font-weight: 500;
}
.tree-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.dot-passed { background: var(--green); }
.dot-changed { background: var(--yellow); }
.tree-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.tree-item.filtered-out, .tree-folder.filtered-out { display: none; }

/* Main content */
.content { flex: 1; overflow-y: auto; background: var(--bg); position: relative; }

.mobile-menu-btn {
  display: none; position: fixed; top: 12px; left: 12px; z-index: 100;
  background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px;
  padding: 8px; cursor: pointer; color: var(--text);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

/* Welcome */
.welcome {
  display: flex; justify-content: center; align-items: center; min-height: 100vh;
}
.welcome-inner { text-align: center; max-width: 480px; padding: 32px; }
.welcome-logo { margin-bottom: 12px; }
.welcome-inner h1 { font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 32px; font-weight: 700; letter-spacing: -0.03em; }
.welcome-sub { color: var(--text-muted); font-size: 14px; margin-bottom: 32px; }
.welcome-stats { display: flex; gap: 16px; justify-content: center; margin-bottom: 28px; }
.welcome-stat {
  padding: 16px 24px; border-radius: var(--radius);
  background: var(--bg-card); border: 1px solid var(--border);
}
.welcome-stat.stat-passed { border-color: var(--green); }
.welcome-stat.stat-changed { border-color: var(--yellow); }
.welcome-val { font-size: 28px; font-weight: 700; }
.welcome-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-top: 2px; }
.welcome-hint { color: var(--text-dim); font-size: 13px; margin-top: 8px; }
.welcome-date { margin-top: 4px; }

/* Panels */
.panel { padding: 24px 32px; }
.panel-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 20px; flex-wrap: wrap; gap: 10px;
  padding-bottom: 16px; border-bottom: 1px solid var(--border);
}
.panel-kind { font-size: 12px; color: var(--text-muted); margin-bottom: 2px; }
.panel-title { font-size: 20px; font-weight: 600; }
.panel-badges { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.badge {
  font-size: 11px; padding: 3px 10px; border-radius: 10px; font-weight: 600;
}
.badge-diff { background: var(--yellow-bg); color: var(--yellow-text); }
.badge-ssim { background: var(--blue-bg); color: var(--blue-text); }
.badge-pass { background: var(--green-bg); color: var(--green-text); }
.badge-meta { background: var(--bg); color: var(--text-muted); border: 1px solid var(--border); }

/* Stories view */
.story-toggle { display: flex; gap: 4px; margin-bottom: 12px; }
.story-toggle-btn {
  padding: 5px 14px; font-size: 12px; font-weight: 500;
  border: 1px solid var(--border); border-radius: 6px;
  background: var(--bg-card); color: var(--text-muted); cursor: pointer;
  transition: all 0.15s;
}
.story-toggle-btn:hover { border-color: var(--accent); color: var(--accent); }
.story-toggle-btn.active { background: var(--accent-light); color: var(--accent); border-color: var(--accent); }
.story-img-wrap { text-align: center; display: none; }
.story-img-wrap.active { display: block; }
.story-img-wrap img {
  max-width: 100%; max-height: 80vh;
  border: 1px solid var(--border); border-radius: var(--radius);
  background: repeating-conic-gradient(var(--border) 0% 25%, transparent 0% 50%) 50%/16px 16px;
}

/* Changes view */
.view-controls {
  display: flex; gap: 4px; align-items: center; margin-bottom: 16px; flex-wrap: wrap;
}
.view-btn {
  padding: 6px 14px; font-size: 12px; font-weight: 500;
  border: 1px solid var(--border); border-radius: 6px;
  background: var(--bg-card); color: var(--text-muted); cursor: pointer;
  transition: all 0.15s;
}
.view-btn:hover { border-color: var(--accent); color: var(--accent); }
.view-btn.active { background: var(--accent-light); color: var(--accent); border-color: var(--accent); }
.overlay-ctrl {
  display: flex; align-items: center; gap: 8px; margin-left: 12px;
  padding-left: 12px; border-left: 1px solid var(--border);
  font-size: 12px; color: var(--text-muted);
}
.overlay-ctrl input[type="range"] { width: 80px; }
.opacity-val { width: 32px; text-align: right; }

/* Image views */
.img-view { display: none; }
.side-by-side-view.active { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.diff-view.active, .overlay-view.active, .current-view.active { display: block; }

.img-col { display: flex; flex-direction: column; align-items: center; min-width: 0; }
.img-col.full { width: 100%; }
.img-label {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 8px;
}
.img-col img {
  max-width: 100%; max-height: 70vh; height: auto; object-fit: contain;
  border: 1px solid var(--border); border-radius: 6px;
  background: repeating-conic-gradient(var(--border) 0% 25%, transparent 0% 50%) 50%/16px 16px;
}
.no-image {
  border: 1px dashed var(--border); border-radius: 6px;
  padding: 48px 24px; text-align: center; color: var(--text-dim); font-size: 13px;
}.overlay-wrap { position: relative; }
.overlay-wrap .overlay-base { display: block; max-width: 100%; }
.overlay-wrap .overlay-diff {
  position: absolute; top: 0; left: 0; max-width: 100%;
  pointer-events: none; border: none; background: none;
}

/* Responsive */
@media (max-width: 768px) {
  .sidebar {
    position: fixed; left: -280px; top: 0; z-index: 200;
    transition: left 0.2s ease; box-shadow: none;
  }
  .sidebar.open { left: 0; box-shadow: 4px 0 20px rgba(0,0,0,0.15); }
  .mobile-menu-btn { display: flex; }
  .side-by-side-view.active { grid-template-columns: 1fr; }
  .panel { padding: 16px; }
}
`

// ---------------------------------------------------------------------------
// JS
// ---------------------------------------------------------------------------
const JS = `
var currentMode = 'stories';
var currentStoryIndex = -1;

/** Load image data from the _IMG map into a panel's <img> elements */
function loadPanelImages(index) {
  var data = _IMG[index];
  if (!data || data._loaded) return;
  var panel = document.getElementById('panel-' + index);
  if (!panel) return;

  var roles = {
    'story-current': data.c,
    'story-baseline': data.b,
    'sbs-baseline': data.b,
    'sbs-current': data.c,
    'diff-img': data.d,
    'overlay-base': data.c,
    'overlay-diff': data.d,
    'current-only': data.c
  };

  for (var role in roles) {
    var img = panel.querySelector('[data-role="' + role + '"]');
    if (img && roles[role]) img.src = roles[role];
  }

  data._loaded = true;
}

function setMode(mode, btn) {
  currentMode = mode;

  document.querySelectorAll('.mode-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');

  document.querySelectorAll('.tree-item').forEach(function(item) {
    if (mode === 'changes' && item.dataset.hasDiff === 'false') {
      item.classList.add('filtered-out');
    } else {
      item.classList.remove('filtered-out');
    }
  });
  updateFolderVisibility();

  if (currentStoryIndex >= 0) {
    showPanelMode(currentStoryIndex);
  }

  if (currentStoryIndex >= 0) {
    var currentItem = document.querySelector('.tree-item[data-index="' + currentStoryIndex + '"]');
    if (currentItem && currentItem.classList.contains('filtered-out')) {
      selectFirstVisible();
    }
  } else if (mode === 'changes') {
    selectFirstVisible();
  }
}

function selectStory(index) {
  var welcome = document.getElementById('welcome');
  if (welcome) welcome.style.display = 'none';

  document.querySelectorAll('.tree-item.active').forEach(function(el) { el.classList.remove('active'); });
  document.querySelectorAll('.panel').forEach(function(p) { p.style.display = 'none'; });

  var item = document.querySelector('.tree-item[data-index="' + index + '"]');
  if (item) {
    item.classList.add('active');
    expandParents(item);
    item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  var panel = document.getElementById('panel-' + index);
  if (panel) {
    panel.style.display = 'block';
    loadPanelImages(index);
    showPanelMode(index);
  }

  currentStoryIndex = index;

  document.getElementById('sidebar').classList.remove('open');
}

function showPanelMode(index) {
  var panel = document.getElementById('panel-' + index);
  if (!panel) return;

  var storiesView = panel.querySelector('.panel-stories-view');
  var changesView = panel.querySelector('.panel-changes-view');

  if (currentMode === 'stories') {
    if (storiesView) storiesView.style.display = 'block';
    if (changesView) changesView.style.display = 'none';
  } else {
    if (storiesView) storiesView.style.display = 'none';
    if (changesView) changesView.style.display = 'block';

    if (changesView && !changesView.querySelector('.img-view.active')) {
      var first = changesView.querySelector('.img-view');
      if (first) first.classList.add('active');
    }
  }
}

function expandParents(el) {
  var folder = el.closest('.tree-folder-content');
  while (folder) {
    folder.classList.remove('collapsed');
    var header = folder.previousElementSibling;
    if (header && header.classList.contains('tree-folder-header')) {
      header.classList.add('open');
    }
    var parentFolder = folder.parentElement;
    folder = parentFolder ? parentFolder.closest('.tree-folder-content') : null;
  }
}

function selectFirstVisible() {
  var items = document.querySelectorAll('.tree-item:not(.filtered-out)');
  if (items.length > 0) {
    var idx = parseInt(items[0].dataset.index, 10);
    selectStory(idx);
  }
}

function toggleFolder(header) {
  var content = header.nextElementSibling;
  if (!content) return;
  var isOpen = header.classList.contains('open');
  header.classList.toggle('open', !isOpen);
  content.classList.toggle('collapsed', isOpen);
}

function setView(btn, view) {
  var panel = btn.closest('.panel-changes-view');
  if (!panel) return;
  panel.querySelectorAll('.view-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  panel.querySelectorAll('.img-view').forEach(function(v) { v.classList.remove('active'); });
  var target = panel.querySelector('.' + view + '-view');
  if (target) target.classList.add('active');
  var overlayCtrl = panel.querySelector('.overlay-ctrl');
  if (overlayCtrl) overlayCtrl.style.display = view === 'overlay' ? 'flex' : 'none';
}

function setStoryImage(btn, which) {
  var panel = btn.closest('.panel-stories-view');
  if (!panel) return;
  panel.querySelectorAll('.story-toggle-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  panel.querySelectorAll('.story-img-wrap').forEach(function(w) { w.classList.remove('active'); });
  var target = panel.querySelector('.story-img-' + which);
  if (target) target.classList.add('active');
}

function setOpacity(slider) {
  var panel = slider.closest('.panel-changes-view');
  if (!panel) return;
  var val = slider.value / 100;
  var diffImg = panel.querySelector('.overlay-diff');
  if (diffImg) diffImg.style.opacity = val;
  var label = panel.querySelector('.opacity-val');
  if (label) label.textContent = slider.value + '%';
}

function filterTree(query) {
  var q = query.toLowerCase().trim();
  document.querySelectorAll('.tree-item').forEach(function(item) {
    var search = item.dataset.search || '';
    var matchesSearch = !q || search.indexOf(q) !== -1;
    var matchesMode = currentMode !== 'changes' || item.dataset.hasDiff === 'true';
    item.classList.toggle('filtered-out', !(matchesSearch && matchesMode));
  });
  updateFolderVisibility();
}

function updateFolderVisibility() {
  // Process bottom-up so parent folders see child folder state after it's resolved
  var folders = Array.from(document.querySelectorAll('.tree-folder')).reverse();
  folders.forEach(function(folder) {
    var content = folder.querySelector(':scope > .tree-folder-content');
    if (!content) return;
    // Check for any visible direct-child items or direct-child folders
    var children = content.children;
    var hasVisible = false;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (!child.classList.contains('filtered-out')) {
        hasVisible = true;
        break;
      }
    }
    folder.classList.toggle('filtered-out', !hasVisible);
  });
}

function toggleTheme() {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem('argus-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// Keyboard navigation
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT') return;

  var visibleItems = Array.from(document.querySelectorAll('.tree-item:not(.filtered-out)'));
  if (visibleItems.length === 0) return;

  if (e.key === 'ArrowDown' || e.key === 'j') {
    e.preventDefault();
    var ci = visibleItems.findIndex(function(el) { return el.classList.contains('active'); });
    var ni = ci < visibleItems.length - 1 ? ci + 1 : 0;
    selectStory(parseInt(visibleItems[ni].dataset.index, 10));
  } else if (e.key === 'ArrowUp' || e.key === 'k') {
    e.preventDefault();
    var ci = visibleItems.findIndex(function(el) { return el.classList.contains('active'); });
    var pi = ci > 0 ? ci - 1 : visibleItems.length - 1;
    selectStory(parseInt(visibleItems[pi].dataset.index, 10));
  } else if (e.key === '1') {
    clickViewBtn('side-by-side');
  } else if (e.key === '2') {
    clickViewBtn('diff');
  } else if (e.key === '3') {
    clickViewBtn('overlay');
  } else if (e.key === '4') {
    clickViewBtn('current');
  } else if (e.key === 's' || e.key === 'S') {
    var btn = document.querySelector('.mode-btn[data-mode="stories"]');
    if (btn) setMode('stories', btn);
  } else if (e.key === 'c' || e.key === 'C') {
    var btn = document.querySelector('.mode-btn[data-mode="changes"]');
    if (btn) setMode('changes', btn);
  } else if (e.key === '/') {
    e.preventDefault();
    document.getElementById('search-input').focus();
  }
});

function clickViewBtn(view) {
  if (currentStoryIndex < 0) return;
  var panel = document.getElementById('panel-' + currentStoryIndex);
  if (!panel) return;
  var btns = panel.querySelectorAll('.view-btn');
  for (var i = 0; i < btns.length; i++) {
    if (btns[i].getAttribute('onclick').indexOf(view) !== -1) {
      btns[i].click();
      break;
    }
  }
}

// Init
(function() {
  var saved = localStorage.getItem('argus-theme');
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }

  document.querySelectorAll('.tree-folder-header').forEach(function(h) {
    h.classList.add('open');
  });

  var changedItems = document.querySelectorAll('.tree-item[data-has-diff="true"]');
  if (changedItems.length > 0) {
    var changesBtn = document.querySelector('.mode-btn[data-mode="changes"]');
    if (changesBtn) setMode('changes', changesBtn);
  }
})();
`
