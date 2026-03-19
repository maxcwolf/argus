import { readFile } from 'fs/promises'
import { createWriteStream, existsSync } from 'fs'
import { ComparisonResult } from '@argus-vrt/shared'

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

interface StoryData {
  id: string
  kind: string
  componentName: string
  storyName: string
  type: 'changed' | 'passed'
  pixelDiff: number
  ssimScore: number
  hasDiff: boolean
  baselineSrc: string
  currentSrc: string
  diffSrc: string
}

export async function generateReport(options: ReportOptions): Promise<string> {
  const stories = await buildStoryData(options)
  return buildFullHtml(stories, options)
}

export async function writeReport(outputPath: string, options: ReportOptions): Promise<void> {
  const stories = await buildStoryData(options)

  const stream = createWriteStream(outputPath, { encoding: 'utf-8' })
  const write = (chunk: string): Promise<void> =>
    new Promise((resolve) => {
      if (!stream.write(chunk)) {
        stream.once('drain', resolve)
      } else {
        resolve()
      }
    })

  await write(buildFullHtml(stories, options))

  await new Promise<void>((resolve, reject) => {
    stream.end(() => resolve())
    stream.on('error', reject)
  })
}

async function buildStoryData(options: ReportOptions): Promise<StoryData[]> {
  const { results, portable } = options
  const stories: StoryData[] = []

  for (const r of results) {
    const baseline = portable ? await toDataUri(r.baselineUrl) : (r.baselineUrl ? `file://${r.baselineUrl}` : null)
    const current = portable ? await toDataUri(r.currentUrl) : `file://${r.currentUrl}`
    const diff = r.diffUrl ? (portable ? await toDataUri(r.diffUrl) : `file://${r.diffUrl}`) : null

    stories.push({
      id: r.storyId,
      kind: r.kind || r.componentName || '',
      componentName: r.componentName || r.storyId,
      storyName: r.storyName || '',
      type: r.hasDiff ? 'changed' : 'passed',
      pixelDiff: r.pixelDiff,
      ssimScore: r.ssimScore,
      hasDiff: r.hasDiff,
      baselineSrc: baseline || '',
      currentSrc: current || '',
      diffSrc: diff || '',
    })
  }

  return stories
}

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function escJs(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

function buildFullHtml(stories: StoryData[], options: ReportOptions): string {
  const { results, branch, baseBranch } = options
  const changedCount = stories.filter(s => s.hasDiff).length
  const passedCount = stories.filter(s => !s.hasDiff).length

  // Build the stories JSON for the JS runtime (without image data to keep it small)
  // Image data is stored in hidden divs and referenced by index
  const storiesJson = JSON.stringify(stories.map((s, i) => ({
    idx: i,
    id: s.id,
    kind: s.kind,
    componentName: s.componentName,
    storyName: s.storyName,
    type: s.type,
    pixelDiff: s.pixelDiff,
    ssimScore: s.ssimScore,
    hasDiff: s.hasDiff,
  })))

  // Build image data divs (hidden, referenced by JS)
  const imageDivs = stories.map((s, i) => `<div id="img-${i}" class="img-data" data-baseline="${esc(s.baselineSrc)}" data-current="${esc(s.currentSrc)}" data-diff="${esc(s.diffSrc)}"></div>`).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Argus - Visual Regression Report</title>
<style>${CSS}</style>
</head>
<body>
<div id="app">
  <nav class="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-brand">
        <h1>Argus</h1>
      </div>
      <div class="sidebar-search">
        <input type="text" id="search" placeholder="Search stories..." oninput="onSearch(this.value)">
      </div>
      <div class="sidebar-modes">
        <button class="mode-btn active" data-mode="storybook" onclick="setMode('storybook', this)">Stories</button>
        <button class="mode-btn" data-mode="chromatic" onclick="setMode('chromatic', this)">Changes</button>
      </div>
      <div class="sidebar-stats">
        <span class="stat-pill stat-pill-total">${results.length}</span>
        <span class="stat-pill stat-pill-passed">${passedCount} passed</span>
        <span class="stat-pill stat-pill-changed">${changedCount} changed</span>
      </div>
    </div>
    <div id="sidebar-tree" class="sidebar-tree"></div>
  </nav>
  <main class="content">
    <div class="content-header">
      <div class="content-meta">
        <span><strong>Branch:</strong> ${esc(branch)}</span>
        <span><strong>Base:</strong> ${esc(baseBranch)}</span>
        <span>${new Date().toLocaleString()}</span>
      </div>
      <button class="theme-toggle" onclick="toggleTheme()" title="Toggle dark mode">
        <svg class="icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
        <svg class="icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
      </button>
    </div>
    <div id="content-body" class="content-body">
      <div class="empty-state">Select a story from the sidebar</div>
    </div>
  </main>
</div>
<div id="image-store" style="display:none">
${imageDivs}
</div>
<script>
var STORIES = ${storiesJson};
${JS}
</script>
</body>
</html>`
}

const CSS = `
:root {
  --bg: #f5f5f5; --bg-sidebar: #fff; --bg-card: #fff; --border: #e2e8f0;
  --text: #1a202c; --text-muted: #718096; --text-dim: #a0aec0;
  --accent: #6f5ce5; --accent-light: #eef2ff; --accent-hover: #5b47d1;
  --green: #16a34a; --green-bg: #dcfce7; --green-text: #166534;
  --yellow: #ca8a04; --yellow-bg: #fef9c3; --yellow-text: #854d0e;
  --red: #dc2626; --red-bg: #fee2e2; --red-text: #991b1b;
  --blue-bg: #eff6ff; --blue-text: #1e40af;
  --sidebar-w: 280px; --radius: 8px;
  --sidebar-active: #f0ecfc; --sidebar-hover: #f7f7f8;
}
.dark {
  --bg: #0f172a; --bg-sidebar: #1e293b; --bg-card: #1e293b; --border: #334155;
  --text: #e2e8f0; --text-muted: #94a3b8; --text-dim: #64748b;
  --accent: #818cf8; --accent-light: #1e1b4b; --accent-hover: #a5b4fc;
  --green-bg: #052e16; --green-text: #86efac;
  --yellow-bg: #422006; --yellow-text: #fde68a;
  --red-bg: #450a0a; --red-text: #fca5a5;
  --blue-bg: #172554; --blue-text: #93c5fd;
  --sidebar-active: #312e81; --sidebar-hover: #1e293b;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; height: 100vh; overflow: hidden; }
#app { display: flex; height: 100vh; }
.img-data { display: none; }

/* Sidebar */
.sidebar { width: var(--sidebar-w); min-width: var(--sidebar-w); background: var(--bg-sidebar); border-right: 1px solid var(--border); display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
.sidebar-header { padding: 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.sidebar-brand h1 { font-size: 18px; font-weight: 700; margin-bottom: 12px; }
.sidebar-search input { width: 100%; padding: 7px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; background: var(--bg); color: var(--text); outline: none; }
.sidebar-search input:focus { border-color: var(--accent); }
.sidebar-modes { display: flex; gap: 2px; margin-top: 10px; background: var(--bg); border-radius: 6px; padding: 2px; }
.mode-btn { flex: 1; padding: 6px 8px; border: none; border-radius: 5px; font-size: 12px; font-weight: 600; cursor: pointer; background: transparent; color: var(--text-muted); transition: all 0.15s; }
.mode-btn.active { background: var(--accent); color: #fff; }
.mode-btn:hover:not(.active) { color: var(--text); }
.sidebar-stats { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
.stat-pill { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
.stat-pill-total { background: var(--blue-bg); color: var(--blue-text); }
.stat-pill-passed { background: var(--green-bg); color: var(--green-text); }
.stat-pill-changed { background: var(--yellow-bg); color: var(--yellow-text); }
.sidebar-tree { flex: 1; overflow-y: auto; padding: 8px 0; }

/* Tree */
.tree-group { margin: 0; }
.tree-group-header { display: flex; align-items: center; gap: 6px; padding: 5px 12px 5px 12px; font-size: 12px; font-weight: 600; color: var(--text-muted); cursor: pointer; user-select: none; text-transform: uppercase; letter-spacing: 0.03em; }
.tree-group-header:hover { color: var(--text); }
.tree-group-header .arrow { font-size: 10px; transition: transform 0.15s; width: 12px; text-align: center; }
.tree-group-header.collapsed .arrow { transform: rotate(-90deg); }
.tree-group-items { padding-left: 0; }
.tree-group-header.collapsed + .tree-group-items { display: none; }
.tree-item { display: flex; align-items: center; gap: 8px; padding: 5px 12px 5px 28px; font-size: 13px; cursor: pointer; user-select: none; color: var(--text); transition: background 0.1s; border-left: 3px solid transparent; }
.tree-item:hover { background: var(--sidebar-hover); }
.tree-item.active { background: var(--sidebar-active); border-left-color: var(--accent); font-weight: 500; }
.tree-item .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.tree-item .dot.passed { background: var(--green); }
.tree-item .dot.changed { background: var(--yellow); }
.tree-item .story-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tree-item .diff-badge { font-size: 10px; padding: 1px 5px; border-radius: 8px; background: var(--yellow-bg); color: var(--yellow-text); font-weight: 600; margin-left: auto; flex-shrink: 0; }

/* Content */
.content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.content-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 24px; border-bottom: 1px solid var(--border); flex-shrink: 0; background: var(--bg-sidebar); }
.content-meta { display: flex; gap: 16px; font-size: 12px; color: var(--text-muted); }
.theme-toggle { background: none; border: 1px solid var(--border); border-radius: 6px; padding: 5px 7px; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; }
.theme-toggle:hover { background: var(--bg); }
.dark .icon-sun { display: inline; } .dark .icon-moon { display: none; }
.icon-sun { display: none; } .icon-moon { display: inline; }
.content-body { flex: 1; overflow-y: auto; padding: 24px; }
.empty-state { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-dim); font-size: 15px; }

/* Storybook mode */
.story-view { display: flex; flex-direction: column; align-items: center; }
.story-view .story-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
.story-view .story-subtitle { font-size: 13px; color: var(--text-muted); margin-bottom: 16px; }
.story-view img { max-width: 100%; max-height: calc(100vh - 160px); width: auto; height: auto; object-fit: contain; border: 1px solid var(--border); border-radius: var(--radius); background: repeating-conic-gradient(var(--border) 0% 25%, transparent 0% 50%) 50%/16px 16px; }

/* Chromatic mode */
.chromatic-view { }
.chromatic-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
.chromatic-subtitle { font-size: 13px; color: var(--text-muted); margin-bottom: 4px; }
.chromatic-badges { display: flex; gap: 6px; margin-bottom: 16px; }
.chromatic-badges .badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
.badge-diff { background: var(--yellow-bg); color: var(--yellow-text); }
.badge-ssim { background: var(--blue-bg); color: var(--blue-text); }
.badge-pass { background: var(--green-bg); color: var(--green-text); }
.view-controls { display: flex; gap: 4px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.view-btn { padding: 6px 14px; font-size: 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-sidebar); color: var(--text-muted); cursor: pointer; font-weight: 500; transition: all 0.15s; }
.view-btn:hover { border-color: var(--accent); color: var(--accent); }
.view-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.overlay-controls { display: flex; align-items: center; gap: 8px; margin-left: 12px; font-size: 12px; color: var(--text-muted); }
.overlay-controls input[type="range"] { width: 100px; }
.comparison-area { }
.side-by-side { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.img-col { display: flex; flex-direction: column; align-items: center; }
.img-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 8px; }
.comparison-area img { max-width: 100%; max-height: 70vh; width: auto; height: auto; object-fit: contain; border: 1px solid var(--border); border-radius: var(--radius); background: repeating-conic-gradient(var(--border) 0% 25%, transparent 0% 50%) 50%/16px 16px; }
.no-image { border: 1px dashed var(--border); border-radius: var(--radius); padding: 48px; text-align: center; color: var(--text-dim); font-size: 13px; }
.overlay-container { position: relative; display: inline-block; }
.overlay-container .overlay-base { display: block; max-width: 100%; max-height: 70vh; object-fit: contain; }
.overlay-container .overlay-diff { position: absolute; top: 0; left: 0; max-width: 100%; max-height: 70vh; object-fit: contain; pointer-events: none; border: none; background: none; }
.single-image { display: flex; justify-content: center; }

/* Keyboard hint */
.kbd-hint { position: fixed; bottom: 12px; right: 16px; font-size: 11px; color: var(--text-dim); background: var(--bg-sidebar); border: 1px solid var(--border); border-radius: 6px; padding: 4px 10px; }
kbd { display: inline-block; padding: 1px 5px; border: 1px solid var(--border); border-radius: 3px; font-size: 10px; font-family: inherit; background: var(--bg); }

@media (max-width: 768px) {
  .sidebar { width: 220px; min-width: 220px; }
  .side-by-side { grid-template-columns: 1fr; }
}
`

const JS = `
var currentMode = 'storybook';
var currentIdx = -1;
var currentView = 'side-by-side';
var flatItems = []; // visible story indices after filtering

function buildTree(stories, filter) {
  var groups = {};
  stories.forEach(function(s) {
    var parts = (s.kind || s.componentName || 'Ungrouped').split('/');
    var groupName = parts.length > 1 ? parts.slice(0, -1).join('/') : parts[0];
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(s);
  });

  var container = document.getElementById('sidebar-tree');
  container.innerHTML = '';
  flatItems = [];

  var filterLower = (filter || '').toLowerCase();

  var sortedGroups = Object.keys(groups).sort();
  sortedGroups.forEach(function(groupName) {
    var items = groups[groupName];
    var filtered = items.filter(function(s) {
      if (!filterLower) return true;
      return (s.kind + ' ' + s.componentName + ' ' + s.storyName + ' ' + s.id).toLowerCase().indexOf(filterLower) >= 0;
    });

    // In chromatic mode, only show changed stories
    if (currentMode === 'chromatic') {
      filtered = filtered.filter(function(s) { return s.hasDiff; });
    }

    if (filtered.length === 0) return;

    var group = document.createElement('div');
    group.className = 'tree-group';

    var header = document.createElement('div');
    header.className = 'tree-group-header';
    header.innerHTML = '<span class="arrow">&#9662;</span>' + escH(groupName);
    header.onclick = function() { this.classList.toggle('collapsed'); };
    group.appendChild(header);

    var itemsDiv = document.createElement('div');
    itemsDiv.className = 'tree-group-items';

    filtered.forEach(function(s) {
      flatItems.push(s.idx);
      var item = document.createElement('div');
      item.className = 'tree-item';
      item.dataset.idx = s.idx;
      if (s.idx === currentIdx) item.classList.add('active');

      var label = s.storyName || s.componentName || s.id;
      var dotClass = s.hasDiff ? 'changed' : 'passed';
      item.innerHTML = '<span class="dot ' + dotClass + '"></span><span class="story-label">' + escH(label) + '</span>' +
        (s.hasDiff ? '<span class="diff-badge">' + s.pixelDiff.toFixed(1) + '%</span>' : '');

      item.onclick = function() { selectStory(s.idx); };
      itemsDiv.appendChild(item);
    });

    group.appendChild(itemsDiv);
    container.appendChild(group);
  });
}

function escH(s) {
  var d = document.createElement('div'); d.textContent = s; return d.innerHTML;
}

function getImageData(idx) {
  var el = document.getElementById('img-' + idx);
  if (!el) return { baseline: '', current: '', diff: '' };
  return {
    baseline: el.dataset.baseline || '',
    current: el.dataset.current || '',
    diff: el.dataset.diff || '',
  };
}

function selectStory(idx) {
  currentIdx = idx;

  // Update sidebar active state
  document.querySelectorAll('.tree-item').forEach(function(el) {
    el.classList.toggle('active', parseInt(el.dataset.idx) === idx);
  });

  var s = STORIES[idx];
  var imgs = getImageData(idx);
  var body = document.getElementById('content-body');

  if (currentMode === 'storybook') {
    renderStorybook(body, s, imgs);
  } else {
    renderChromatic(body, s, imgs);
  }
}

function renderStorybook(body, s, imgs) {
  var kindParts = (s.kind || s.componentName).split('/');
  var title = kindParts[kindParts.length - 1] || s.componentName;

  body.innerHTML =
    '<div class="story-view">' +
      '<div class="story-title">' + escH(title) + (s.storyName ? ' / ' + escH(s.storyName) : '') + '</div>' +
      '<div class="story-subtitle">' + escH(s.kind) + '</div>' +
      (imgs.current ? '<img src="' + imgs.current + '" alt="' + escH(s.id) + '">' : '<div class="no-image">No screenshot</div>') +
    '</div>';
}

function renderChromatic(body, s, imgs) {
  var kindParts = (s.kind || s.componentName).split('/');
  var title = kindParts[kindParts.length - 1] || s.componentName;
  var hasDiffImg = !!imgs.diff;

  var badges = '';
  if (s.hasDiff) {
    badges = '<span class="badge badge-diff">' + s.pixelDiff.toFixed(2) + '% diff</span>' +
             '<span class="badge badge-ssim">SSIM ' + s.ssimScore.toFixed(3) + '</span>';
  } else {
    badges = '<span class="badge badge-pass">Pass</span>';
  }

  var controls = '<div class="view-controls">' +
    '<button class="view-btn' + (currentView === 'side-by-side' ? ' active' : '') + '" onclick="switchView(\'side-by-side\')">Side by Side</button>' +
    (hasDiffImg ? '<button class="view-btn' + (currentView === 'diff' ? ' active' : '') + '" onclick="switchView(\'diff\')">Diff</button>' : '') +
    (hasDiffImg ? '<button class="view-btn' + (currentView === 'overlay' ? ' active' : '') + '" onclick="switchView(\'overlay\')">Overlay</button>' : '') +
    '<button class="view-btn' + (currentView === 'current' ? ' active' : '') + '" onclick="switchView(\'current\')">Current</button>' +
    '<button class="view-btn' + (currentView === 'baseline' ? ' active' : '') + '" onclick="switchView(\'baseline\')">Baseline</button>' +
    (currentView === 'overlay' ? '<div class="overlay-controls"><label>Opacity:</label><input type="range" min="0" max="100" value="50" oninput="setOverlayOpacity(this)"><span id="opacity-val">50%</span></div>' : '') +
    '</div>';

  var comparison = '';
  if (currentView === 'side-by-side') {
    comparison = '<div class="side-by-side">' +
      '<div class="img-col"><div class="img-label">Baseline</div>' + (imgs.baseline ? '<img src="' + imgs.baseline + '" alt="Baseline">' : '<div class="no-image">No baseline</div>') + '</div>' +
      '<div class="img-col"><div class="img-label">Current</div>' + (imgs.current ? '<img src="' + imgs.current + '" alt="Current">' : '<div class="no-image">No screenshot</div>') + '</div>' +
    '</div>';
  } else if (currentView === 'diff') {
    comparison = '<div class="single-image"><div class="img-col"><div class="img-label">Difference</div>' + (imgs.diff ? '<img src="' + imgs.diff + '" alt="Diff">' : '<div class="no-image">No diff</div>') + '</div></div>';
  } else if (currentView === 'overlay') {
    comparison = '<div class="single-image"><div class="overlay-container">' +
      (imgs.current ? '<img src="' + imgs.current + '" alt="Current" class="overlay-base">' : '') +
      (imgs.diff ? '<img src="' + imgs.diff + '" alt="Diff" class="overlay-diff" style="opacity:0.5">' : '') +
    '</div></div>';
  } else if (currentView === 'current') {
    comparison = '<div class="single-image"><div class="img-col"><div class="img-label">Current</div>' + (imgs.current ? '<img src="' + imgs.current + '" alt="Current">' : '<div class="no-image">No screenshot</div>') + '</div></div>';
  } else if (currentView === 'baseline') {
    comparison = '<div class="single-image"><div class="img-col"><div class="img-label">Baseline</div>' + (imgs.baseline ? '<img src="' + imgs.baseline + '" alt="Baseline">' : '<div class="no-image">No baseline</div>') + '</div></div>';
  }

  body.innerHTML =
    '<div class="chromatic-view">' +
      '<div class="chromatic-title">' + escH(title) + (s.storyName ? ' / ' + escH(s.storyName) : '') + '</div>' +
      '<div class="chromatic-subtitle">' + escH(s.kind) + '</div>' +
      '<div class="chromatic-badges">' + badges + '</div>' +
      controls +
      '<div class="comparison-area">' + comparison + '</div>' +
    '</div>';
}

function switchView(view) {
  currentView = view;
  if (currentIdx >= 0) selectStory(currentIdx);
}

function setOverlayOpacity(slider) {
  var val = slider.value / 100;
  var el = document.querySelector('.overlay-diff');
  if (el) el.style.opacity = val;
  var label = document.getElementById('opacity-val');
  if (label) label.textContent = slider.value + '%';
}

function setMode(mode, btn) {
  currentMode = mode;
  currentView = mode === 'storybook' ? 'current' : 'side-by-side';
  document.querySelectorAll('.mode-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');

  var searchVal = document.getElementById('search').value;
  buildTree(STORIES, searchVal);

  // Auto-select first visible story
  if (flatItems.length > 0) {
    selectStory(flatItems[0]);
  } else {
    document.getElementById('content-body').innerHTML = '<div class="empty-state">' +
      (mode === 'chromatic' ? 'No visual changes detected' : 'No stories found') + '</div>';
    currentIdx = -1;
  }
}

function onSearch(val) {
  buildTree(STORIES, val);
}

function toggleTheme() {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem('argus-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
}

// Keyboard navigation
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT') return;

  if (e.key === 'ArrowDown' || e.key === 'j') {
    e.preventDefault();
    navigateStory(1);
  } else if (e.key === 'ArrowUp' || e.key === 'k') {
    e.preventDefault();
    navigateStory(-1);
  } else if (e.key === '1') {
    switchView('side-by-side');
  } else if (e.key === '2') {
    switchView('diff');
  } else if (e.key === '3') {
    switchView('overlay');
  } else if (e.key === '4') {
    switchView('current');
  } else if (e.key === '5') {
    switchView('baseline');
  } else if (e.key === 's') {
    setMode('storybook', document.querySelector('[data-mode="storybook"]'));
  } else if (e.key === 'c') {
    setMode('chromatic', document.querySelector('[data-mode="chromatic"]'));
  }
});

function navigateStory(direction) {
  if (flatItems.length === 0) return;
  var pos = flatItems.indexOf(currentIdx);
  var next = pos + direction;
  if (next < 0) next = flatItems.length - 1;
  if (next >= flatItems.length) next = 0;
  selectStory(flatItems[next]);

  // Scroll sidebar item into view
  var active = document.querySelector('.tree-item.active');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

// Init
(function() {
  var saved = localStorage.getItem('argus-theme');
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }

  buildTree(STORIES, '');

  // Auto-select first changed story if any, otherwise first story
  var firstChanged = STORIES.find(function(s) { return s.hasDiff; });
  if (firstChanged) {
    setMode('chromatic', document.querySelector('[data-mode="chromatic"]'));
  } else if (STORIES.length > 0) {
    selectStory(STORIES[0].idx);
  }
})();
`
