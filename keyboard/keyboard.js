/* Remote WebView touch keyboard. Original work, MIT licensed.
 * All input stays in the current page; no storage, logging or network calls.
 */
(() => {
  'use strict';
  if (window.top !== window || document.getElementById('rwv-touch-keyboard')) return;
  function start() {
    if (document.getElementById('rwv-touch-keyboard')) return;
    const host = document.createElement('div');
    host.id = 'rwv-touch-keyboard';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none';
    const root = host.attachShadow({mode: 'open'});
    const style = document.createElement('style');
    style.textContent = `
      :host{font-family:Arial,sans-serif;color:#f8fafc;font-size:14px}
      *{box-sizing:border-box}button{font:inherit;touch-action:manipulation;cursor:pointer;
        color:inherit;border:1px solid #45516a;border-radius:7px;background:#293449;
        min-width:0;padding:0;user-select:none;-webkit-user-select:none}
      button:active{background:#526783}button:focus-visible{outline:2px solid #7dd3fc}
      .toggle{position:absolute;right:8px;bottom:8px;width:44px;height:44px;
        background:#155e75;box-shadow:0 2px 8px #0008;pointer-events:auto}
      .toggle svg{width:26px;height:26px;vertical-align:middle}
      .panel{position:absolute;left:4px;right:4px;bottom:4px;padding:8px;
        border:1px solid #526783;border-radius:12px;background:#101827;
        box-shadow:0 4px 18px #0009;pointer-events:auto}
      .panel.above{top:4px;bottom:auto}
      [hidden]{display:none!important}.header{display:flex;align-items:center;
        height:30px;gap:8px;margin-bottom:6px}.label{flex:1;overflow:hidden;
        text-overflow:ellipsis;white-space:nowrap;font-weight:600}
      .close{width:44px;height:30px;background:#1e293b}
      .row{display:flex;gap:4px;margin-top:5px}.key{flex:1;height:42px;font-size:19px}
      .wide{flex:1.6;font-size:15px;background:#37465d}.space{flex:4;font-size:15px}
      .enter{flex:1.8;font-size:15px;background:#155e75}.shift.on{background:#0e7490}
      .hint{font-size:13px;color:#b8c4d7;margin:0 0 6px;line-height:18px}
      @media(max-width:360px){.key{font-size:16px;height:39px}.wide,.space,.enter{font-size:13px}}
    `;
    root.append(style);
    function button(label, action, cls = '') {
      const b = document.createElement('button');
      b.type = 'button'; b.className = cls; b.textContent = label;
      b.addEventListener('pointerdown', e => e.preventDefault());
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', action);
      return b;
    }
    const toggle = button('', () => setOpen(!open), 'toggle');
    toggle.setAttribute('aria-label', 'Open touch keyboard');
    toggle.title = 'Touch keyboard';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 26 20');
    const outline = document.createElementNS(svg.namespaceURI, 'rect');
    for (const [k,v] of Object.entries({x:1,y:1,width:24,height:18,rx:2,fill:'none',stroke:'currentColor','stroke-width':1.5})) outline.setAttribute(k,v);
    svg.append(outline);
    for (let y = 5; y <= 9; y += 4) for (let x = 5; x <= 21; x += 4) {
      const dot = document.createElementNS(svg.namespaceURI, 'rect');
      for (const [k,v] of Object.entries({x:x-1,y:y-1,width:2,height:2,fill:'currentColor'})) dot.setAttribute(k,v);
      svg.append(dot);
    }
    const space = document.createElementNS(svg.namespaceURI, 'rect');
    for (const [k,v] of Object.entries({x:7,y:13,width:12,height:2,rx:1,fill:'currentColor'})) space.setAttribute(k,v);
    svg.append(space); toggle.append(svg);
    const panel = document.createElement('section'); panel.className = 'panel'; panel.hidden = true;
    panel.setAttribute('aria-label', 'Touch keyboard');
    const header = document.createElement('div'); header.className = 'header';
    const label = document.createElement('div'); label.className = 'label';
    header.append(label, button('Close', () => setOpen(false), 'close'));
    const hint = document.createElement('p'); hint.className = 'hint';
    const keys = document.createElement('div');
    panel.append(header, hint, keys); root.append(toggle, panel); document.documentElement.append(host);
    let target = null, open = false, shifted = false, symbols = false, moreSymbols = false;
    const editable = el => el && !el.disabled && !el.readOnly && (
      el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement &&
      ['text','password','email','search','url','tel','number'].includes(el.type));
    function active() {
      let el = document.activeElement;
      while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
      return el;
    }
    function updateLabel() {
      const valid = editable(target) && target.isConnected;
      label.textContent = valid ? (target.type === 'password' ? 'Password' :
        target.getAttribute('aria-label') || target.labels?.[0]?.textContent?.trim() ||
        target.placeholder || 'Text entry') : 'Touch keyboard';
      hint.textContent = valid ? '' : 'Tap a text field, then use the keyboard.';
      hint.hidden = valid;
      if (valid) panel.classList.toggle('above', target.getBoundingClientRect().top > window.innerHeight / 2);
    }
    document.addEventListener('focusin', e => {
      const input = e.composedPath().find(editable) || active();
      if (editable(input)) { target = input; updateLabel(); }
    }, true);
    document.addEventListener('pointerdown', e => {
      if (e.composedPath().includes(host)) return;
      const input = e.composedPath().find(editable);
      if (input) { target = input; updateLabel(); }
    }, true);
    function setOpen(value) {
      if (editable(active())) target = active();
      open = value; panel.hidden = !value; toggle.hidden = value;
      if (!value) { shifted = false; symbols = false; moreSymbols = false; render(); }
      updateLabel();
    }
    function input(text, erase = false) {
      if (!editable(target) || !target.isConnected) { target = null; updateLabel(); return; }
      const el = target; el.focus({preventScroll:true});
      let begin = el.selectionStart ?? el.value.length, end = el.selectionEnd ?? begin;
      if (erase && begin === end && begin > 0) {
        // Remove one complete code point rather than leaving a broken surrogate.
        begin -= Array.from(el.value.slice(0,begin)).at(-1).length;
      }
      const type = erase ? 'deleteContentBackward' : 'insertText';
      if (!el.dispatchEvent(new InputEvent('beforeinput', {bubbles:true,composed:true,cancelable:true,inputType:type,data:erase?null:text}))) return;
      const value = el.value.slice(0,begin) + text + el.value.slice(end);
      if (el.maxLength >= 0 && value.length > el.maxLength) return;
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);
      try { el.setSelectionRange(begin + text.length, begin + text.length); } catch {}
      el.dispatchEvent(new InputEvent('input', {bubbles:true,composed:true,inputType:type,data:erase?null:text}));
      if (shifted && !erase) { shifted = false; render(); }
    }
    function deepFields(node, out = []) {
      for (const el of node.children || []) {
        if (editable(el) && el.getClientRects().length && el.tabIndex >= 0) out.push(el);
        if (el.shadowRoot && el !== host) deepFields(el.shadowRoot,out);
        deepFields(el,out);
      }
      return out;
    }
    function next() {
      const fields = deepFields(document.documentElement);
      if (!fields.length) return;
      const index = fields.indexOf(target);
      target = fields[(index+1) % fields.length]; target.focus({preventScroll:true}); updateLabel();
    }
    function enter() {
      if (!editable(target) || !target.isConnected) return;
      const el = target; el.focus({preventScroll:true});
      const options = {key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,composed:true,cancelable:true};
      const allowed = el.dispatchEvent(new KeyboardEvent('keydown',options));
      const pressed = el.dispatchEvent(new KeyboardEvent('keypress',options));
      el.dispatchEvent(new KeyboardEvent('keyup',options));
      if (!allowed || !pressed) return;
      if (el instanceof HTMLTextAreaElement) input('\n');
      else if (el.form?.requestSubmit) el.form.requestSubmit();
    }
    function render() {
      keys.replaceChildren();
      const rows = symbols ? (moreSymbols ? ['[]{}<>%+=~','^|`:$€£@#','-_/\\:;!?'] :
        ['1234567890','@#$%&*()+','-_/\\:;!?']) : ['qwertyuiop','asdfghjkl','zxcvbnm'];
      rows.forEach((letters,index) => {
        const row = document.createElement('div'); row.className = 'row';
        if (index === 2) row.append(button(symbols ? (moreSymbols ? '123' : '#+=') : 'Shift', () => {
          if (symbols) {moreSymbols = !moreSymbols; render();} else {shifted = !shifted; render();}
        }, 'key wide shift' + (shifted ? ' on' : '')));
        for (const char of letters) {
          const text = shifted && !symbols ? char.toUpperCase() : char;
          row.append(button(text, () => input(text), 'key'));
        }
        if (index === 2) row.append(button('⌫', () => input('',true), 'key wide'));
        keys.append(row);
      });
      const row = document.createElement('div'); row.className = 'row';
      row.append(button(symbols ? 'ABC' : '123', () => {symbols=!symbols;moreSymbols=false;shifted=false;render();}, 'key wide'),
        button('Tab',next,'key wide'), button('Space',()=>input(' '),'key space'),
        button(symbols ? '"' : '.',()=>input(symbols ? '"' : '.'),'key'),
        button(symbols ? "'" : ',',()=>input(symbols ? "'" : ','),'key'),
        button('Enter',enter,'key enter'));
      keys.append(row);
    }
    render(); updateLabel();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
