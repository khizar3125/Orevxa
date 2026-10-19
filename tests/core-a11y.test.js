/**
 * Unit tests for src/core/a11y.js — focus order, visibility, focus trapping,
 * tab semantics, live announcements and skip links.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  FOCUSABLE_SELECTOR, announce, applyTabSemantics, buildSkipLink, createFocusTrap,
  describeShortcut, focusFirst, getFocusable, isVisible, nextFocusIndex,
  prefersHighContrast, prefersReducedMotion,
} from '../src/core/a11y.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeDom(html) {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, { url: 'http://localhost/' });
  return { dom, document: dom.window.document, window: dom.window };
}

test('nextFocusIndex wraps forwards and backwards', () => {
  assert.equal(nextFocusIndex(0, 3), 1);
  assert.equal(nextFocusIndex(2, 3), 0);
  assert.equal(nextFocusIndex(0, 3, { shift: true }), 2);
  assert.equal(nextFocusIndex(2, 3, { shift: true }), 1);
  assert.equal(nextFocusIndex(-1, 3), 0);
  assert.equal(nextFocusIndex(-1, 3, { shift: true }), 2);
  assert.equal(nextFocusIndex(0, 3, { wrap: false }), 1);
  assert.equal(nextFocusIndex(2, 3, { wrap: false }), 2);
  assert.equal(nextFocusIndex(0, 3, { shift: true, wrap: false }), 0);
  assert.equal(nextFocusIndex(0, 0), -1);
});

test('isVisible rejects hidden, aria-hidden and inert ancestors', () => {
  const { document } = makeDom(`
    <button id="a">A</button>
    <button id="b" hidden>B</button>
    <button id="c" aria-hidden="true">C</button>
    <div hidden><button id="d">D</button></div>
    <div inert><button id="e">E</button></div>
  `);
  assert.equal(isVisible(document.getElementById('a')), true);
  assert.equal(isVisible(document.getElementById('b')), false);
  assert.equal(isVisible(document.getElementById('c')), false);
  assert.equal(isVisible(document.getElementById('d')), false);
  assert.equal(isVisible(document.getElementById('e')), false);
  assert.equal(isVisible(null), false);
});

test('getFocusable only returns visible, enabled controls in DOM order', () => {
  const { document } = makeDom(`
    <div id="root">
      <a href="#one">Link</a>
      <button id="one">One</button>
      <button disabled>Disabled</button>
      <input id="two" />
      <input type="hidden" />
      <select id="three"><option>A</option></select>
      <textarea id="four"></textarea>
      <div tabindex="0" id="five">Custom</div>
      <div tabindex="-1" id="six">Skipped</div>
      <button hidden id="hidden">Hidden</button>
    </div>
  `);
  const focusable = getFocusable(document.getElementById('root'));
  assert.deepEqual(focusable.map((element) => element.id || element.tagName), ['A', 'one', 'two', 'three', 'four', 'five']);
  assert.equal(getFocusable(null).length, 0);
  assert.match(FOCUSABLE_SELECTOR, /button:not\(\[disabled\]\)/);
  const first = focusFirst(document.getElementById('root'));
  assert.equal(first.tagName, 'A');
  assert.equal(document.activeElement, first);
});

test('focus trap cycles Tab, handles Shift+Tab and Escape, and restores focus', async () => {
  const { document } = makeDom(`
    <button id="outside">Outside</button>
    <div id="modal" role="dialog">
      <button id="first">First</button>
      <button id="second">Second</button>
      <button id="third">Third</button>
    </div>
  `);
  const outside = document.getElementById('outside');
  outside.focus();
  let escaped = 0;
  const release = createFocusTrap(document.getElementById('modal'), { onEscape: () => { escaped += 1; }, documentRef: document });
  await sleep(10);
  assert.equal(document.activeElement.id, 'first', 'initial focus moves inside');

  const press = (key, shiftKey = false) => {
    const event = new document.defaultView.KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(event);
    return event;
  };
  press('Tab');
  assert.equal(document.activeElement.id, 'second');
  press('Tab');
  assert.equal(document.activeElement.id, 'third');
  press('Tab');
  assert.equal(document.activeElement.id, 'first', 'Tab wraps to the first control');
  press('Tab', true);
  assert.equal(document.activeElement.id, 'third', 'Shift+Tab wraps backwards');

  const escapeEvent = press('Escape');
  assert.equal(escaped, 1);
  assert.equal(escapeEvent.defaultPrevented, true);

  release();
  await sleep(10);
  assert.equal(document.activeElement.id, 'outside', 'focus returns to the trigger');
  const afterRelease = press('Tab');
  assert.equal(afterRelease.defaultPrevented, false, 'listener removed after release');
});

test('focus trap rejects non-DOM roots', () => {
  assert.throws(() => createFocusTrap(null), /needs a DOM root/);
});

test('announce creates a polite live region and updates it', async () => {
  const { document } = makeDom('');
  const region = announce('Saved', { documentRef: document });
  assert.ok(region);
  assert.equal(region.id, 'orvexa-announcer');
  assert.equal(region.getAttribute('role'), 'status');
  assert.equal(region.getAttribute('aria-live'), 'polite');
  assert.equal(region.getAttribute('aria-atomic'), 'true');
  await sleep(60);
  assert.equal(region.textContent, 'Saved');
  announce('Updated', { politeness: 'assertive', documentRef: document });
  await sleep(60);
  assert.equal(region.textContent, 'Updated');
  assert.equal(region.getAttribute('aria-live'), 'assertive');
  assert.equal(document.querySelectorAll('#orvexa-announcer').length, 1, 'region is reused');
  assert.equal(announce('', { documentRef: document }), null);
});

test('skip link is created once and focuses the workspace', () => {
  const { document } = makeDom('<div id="fileTree"><button>Tree</button></div>');
  const link = buildSkipLink(document);
  assert.ok(link);
  assert.equal(link.getAttribute('href'), '#fileTree');
  assert.equal(link.getAttribute('id'), 'orvexaSkipLink');
  assert.equal(document.querySelectorAll('#orvexaSkipLink').length, 1);
  assert.equal(buildSkipLink(document), null, 'link is not duplicated');
  const event = new document.defaultView.MouseEvent('click', { bubbles: true, cancelable: true });
  link.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(document.activeElement.id, 'fileTree');
  assert.equal(document.getElementById('fileTree').getAttribute('tabindex'), '-1');
});

test('applyTabSemantics sets aria-selected and roving tabindex', () => {
  const { document } = makeDom(`
    <div id="tabs" role="tablist">
      <button role="tab" class="active" id="tab-a">A</button>
      <button role="tab" id="tab-b">B</button>
      <button role="tab" data-tab-id="c">C</button>
    </div>
  `);
  const container = document.getElementById('tabs');
  applyTabSemantics(container);
  assert.equal(document.getElementById('tab-a').getAttribute('aria-selected'), 'true');
  assert.equal(document.getElementById('tab-a').tabIndex, 0);
  assert.equal(document.getElementById('tab-b').getAttribute('aria-selected'), 'false');
  assert.equal(document.getElementById('tab-b').tabIndex, -1);

  applyTabSemantics(container, { activeId: 'c' });
  assert.equal(document.getElementById('tab-b').getAttribute('aria-selected'), 'false');
  assert.equal(document.querySelector('[data-tab-id="c"]').getAttribute('aria-selected'), 'true');
  assert.ok(document.querySelector('[data-tab-id="c"]').id, 'tabs without ids receive one');
});

test('prefersReducedMotion / prefersHighContrast are defensive', () => {
  assert.equal(prefersReducedMotion(() => ({ matches: true })), true);
  assert.equal(prefersReducedMotion(() => ({ matches: false })), false);
  assert.equal(prefersReducedMotion(() => { throw new Error('no mql'); }), false);
  assert.equal(prefersHighContrast(() => ({ matches: true })), true);
  assert.equal(prefersHighContrast(undefined), false);
});

test('describeShortcut renders an uppercase label', () => {
  assert.equal(describeShortcut('mod+k'), 'MOD+K');
  assert.equal(describeShortcut(''), '');
});
