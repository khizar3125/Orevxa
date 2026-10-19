/**
 * Project Health dialog: score ring, metrics, severity filters and actionable
 * issues with “open file” / “copy fix” actions.
 */
import { auditProject, formatAuditForClipboard, healthSummary } from '../studio/health.js';
import { escapeAttr, escapeHtml, openDialog } from './dialog.js';

const SEVERITY_LABELS = { error: 'Errors', warning: 'Warnings', info: 'Suggestions' };
const FILTERS = ['all', 'error', 'warning', 'info'];

export function openHealthDialog({
  project,
  activeFile = null,
  onOpenIssue = null,
  onCopy = null,
  onRefresh = null,
  documentRef = null,
} = {}) {
  let audit = healthSummary(auditProject(project, { activeFile }));
  let filter = 'all';
  const dialog = openDialog({
    title: 'Project Health',
    subtitle: 'A deterministic audit of structure, imports, syntax hazards, size and accessibility hints.',
    size: 'large',
    className: 'orvexa-health',
    documentRef,
    body: `<div data-health-root></div>`,
    footer: `<span class="settings-footer-note" data-health-footnote></span><button type="button" class="button secondary" data-health-refresh>Re-run audit</button><button type="button" class="button secondary" data-health-copy>Copy report</button><button type="button" class="button primary" data-dialog-close-ok>Done</button>`,
  });
  const root = dialog.body.querySelector('[data-health-root]');

  const render = () => {
    const summary = healthSummary(audit);
    audit = summary;
    const filtered = filter === 'all' ? summary.issues : summary.issues.filter((issue) => issue.severity === filter);
    root.innerHTML = `
      <div class="health-hero">
        ${scoreRing(summary.score, summary.grade)}
        <div class="health-hero-copy">
          <span class="docs-kicker">${escapeHtml(summary.stats.name)}</span>
          <h3>${escapeHtml(summary.grade.label)}</h3>
          <p>${escapeHtml(summary.headline)}</p>
          <div class="health-metrics">
            <span><strong>${summary.stats.files}</strong> files</span>
            <span><strong>${summary.stats.lines.toLocaleString()}</strong> lines</span>
            <span><strong>${formatBytes(summary.stats.bytes)}</strong> stored</span>
            <span><strong>${summary.stats.images}</strong> images</span>
          </div>
        </div>
      </div>
      <div class="health-filters" role="group" aria-label="Filter issues">
        ${FILTERS.map((severity) => {
          const count = severity === 'all' ? summary.issues.length : summary.counts[severity] || 0;
          return `<button type="button" class="health-filter${filter === severity ? ' active' : ''}" data-health-filter="${severity}" aria-pressed="${filter === severity}">${severity === 'all' ? 'All' : SEVERITY_LABELS[severity]} <span>${count}</span></button>`;
        }).join('')}
      </div>
      <div class="health-issues" role="list">
        ${filtered.length ? filtered.map((issue) => `
          <article class="health-issue severity-${escapeAttr(issue.severity)}" role="listitem">
            <span class="health-issue-badge" title="${escapeAttr(issue.severity)}">${issue.severity === 'error' ? '✕' : issue.severity === 'warning' ? '!' : 'i'}</span>
            <div class="health-issue-copy">
              <strong>${escapeHtml(issue.title)}</strong>
              <p>${escapeHtml(issue.detail)}</p>
              <small>${issue.file ? `${escapeHtml(issue.file)}${issue.line ? `:${issue.line}` : ''} · ` : ''}${escapeHtml(issue.fix)}</small>
            </div>
            <div class="health-issue-actions">
              ${issue.file ? `<button type="button" class="button secondary" data-health-open="${escapeAttr(issue.id)}">Open</button>` : ''}
              <button type="button" class="icon-button" data-health-copy-issue="${escapeAttr(issue.id)}" title="Copy fix" aria-label="Copy fix for ${escapeAttr(issue.title)}">⧉</button>
            </div>
          </article>`).join('') : `<div class="health-empty"><span>✓</span><div><strong>${filter === 'all' ? 'No issues — beautiful work.' : `No ${SEVERITY_LABELS[filter].toLowerCase()}.`}</strong><p>${filter === 'all' ? 'Your project passes every structural check.' : 'Switch filters to review the rest of the audit.'}</p></div></div>`}
      </div>
      ${summary.stats.largestFile ? `<p class="health-largest">Largest source: <strong>${escapeHtml(summary.stats.largestFile.path)}</strong> · ${formatBytes(summary.stats.largestFile.bytes)} · ${summary.stats.largestFile.lines} lines</p>` : ''}`;
    root.querySelectorAll('[data-health-filter]').forEach((button) => button.addEventListener('click', () => { filter = button.dataset.healthFilter; render(); }));
    root.querySelectorAll('[data-health-open]').forEach((button) => button.addEventListener('click', () => {
      const issue = summary.issues.find((entry) => entry.id === button.dataset.healthOpen);
      if (issue) onOpenIssue?.(issue);
    }));
    root.querySelectorAll('[data-health-copy-issue]').forEach((button) => button.addEventListener('click', async () => {
      const issue = summary.issues.find((entry) => entry.id === button.dataset.healthCopyIssue);
      if (!issue) return;
      try {
        await navigator.clipboard?.writeText(`${issue.title}\n${issue.detail}\nFix: ${issue.fix}`);
        button.textContent = '✓';
        setTimeout(() => { button.textContent = '⧉'; }, 1200);
      } catch { /* clipboard can be blocked */ }
    }));
    const footnote = dialog.card.querySelector('[data-health-footnote]');
    if (footnote) footnote.textContent = `${summary.counts.error} errors · ${summary.counts.warning} warnings · ${summary.counts.info} suggestions`;
  };

  dialog.card.querySelector('[data-health-refresh]')?.addEventListener('click', () => {
    const fresh = onRefresh ? onRefresh() : project;
    audit = healthSummary(auditProject(fresh || project, { activeFile }));
    render();
  });
  dialog.card.querySelector('[data-health-copy]')?.addEventListener('click', async () => {
    const text = formatAuditForClipboard(audit);
    try { await navigator.clipboard?.writeText(text); onCopy?.(text); }
    catch { onCopy?.(text); }
    const button = dialog.card.querySelector('[data-health-copy]');
    if (button) { button.textContent = 'Copied ✓'; setTimeout(() => { button.textContent = 'Copy report'; }, 1400); }
  });
  dialog.card.querySelector('[data-dialog-close-ok]')?.addEventListener('click', () => dialog.close());
  render();
  return dialog;
}

export function scoreRing(score, grade) {
  const safe = Math.min(100, Math.max(0, Number(score) || 0));
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * safe / 100;
  return `<svg class="health-ring" viewBox="0 0 120 120" role="img" aria-label="Health score ${safe} out of 100, grade ${escapeAttr(grade.grade)}">
    <circle cx="60" cy="60" r="${radius}" class="health-ring-track"></circle>
    <circle cx="60" cy="60" r="${radius}" class="health-ring-value tone-${escapeAttr(grade.tone)}" style="stroke-dasharray:${dash.toFixed(2)} ${circumference.toFixed(2)}" transform="rotate(-90 60 60)"></circle>
    <text x="60" y="57" class="health-ring-score">${safe}</text>
    <text x="60" y="76" class="health-ring-grade">${escapeHtml(grade.grade)} · ${escapeHtml(grade.label)}</text>
  </svg>`;
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function healthBadge(score) {
  const summary = healthSummary({ issues: [], score: Number(score) || 0 });
  return `<span class="health-badge tone-${escapeAttr(summary.grade.tone)}"><strong>${summary.score}</strong><small>${escapeHtml(summary.grade.grade)}</small></span>`;
}
