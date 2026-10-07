/* Remote WebView touch keyboard. Original work, MIT licensed.
 * All input stays in the current page; no storage, logging or network calls.
 */
((config) => {
  'use strict';
  if (window.top !== window || document.getElementById('rwv-touch-keyboard')) return;
  function start() {
    if (document.getElementById('rwv-touch-keyboard')) return;
    const host = document.createElement('div');
    host.id = 'rwv-touch-keyboard';
    host.dataset.position = config.position;
    const colorScheme = matchMedia('(prefers-color-scheme: dark)');
    function updateTheme() {host.dataset.theme = config.theme === 'auto' ? (colorScheme.matches ? 'dark' : 'light') : config.theme;}
    updateTheme(); if (config.theme === 'auto') colorScheme.addEventListener('change', updateTheme);
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none';
    const root = host.attachShadow({mode: 'open'});
    const style = document.createElement('style');
    style.textContent = `
      :host{font-family:Arial,sans-serif;color:var(--text);font-size:14px;
        --text:#f8fafc;--muted:#b8c4d7;--border:#526783;--panel:#101827;
        --key:#293449;--special:#37465d;--active:#526783;--accent:#155e75}
      :host([data-theme="light"]){--text:#111827;--muted:#475569;--border:#94a3b8;
        --panel:#f8fafc;--key:#e2e8f0;--special:#cbd5e1;--active:#94a3b8;--accent:#0e7490}
      *{box-sizing:border-box}button{font:inherit;touch-action:manipulation;cursor:pointer;
        color:inherit;border:1px solid var(--border);border-radius:7px;background:var(--key);
        min-width:0;padding:0;user-select:none;-webkit-user-select:none}
      button:active{background:var(--active)}button:focus-visible{outline:2px solid #7dd3fc}
      .toggle{position:absolute;right:8px;bottom:8px;width:44px;height:44px;
        background:var(--accent);color:white;box-shadow:0 2px 8px #0008;pointer-events:auto}
      .toggle svg{width:26px;height:26px;vertical-align:middle}
      :host([data-position="bottom-left"]) .toggle{left:8px;right:auto}
      .panel{position:absolute;right:4px;width:calc(100% - 8px);max-width:720px;
        max-height:calc(100dvh - 8px);overflow-y:auto;bottom:4px;padding:8px;
        border:1px solid var(--border);border-radius:12px;background:var(--panel);
        box-shadow:0 4px 18px #0009;pointer-events:auto}
      :host([data-position="bottom-left"]) .panel{left:4px;right:auto}
      .panel.above{top:4px;bottom:auto}
      [hidden]{display:none!important}.header{display:flex;align-items:center;
        height:30px;gap:8px;margin-bottom:6px}.label{flex:1;overflow:hidden;
        text-overflow:ellipsis;white-space:nowrap;font-weight:600}
      .close{width:44px;height:30px;background:var(--special)}
      .row{display:flex;gap:4px;margin-top:5px}.key{flex:1;height:clamp(28px,calc((100dvh - 76px)/4),42px);font-size:19px}
      .wide{flex:1.6;font-size:15px;background:var(--special)}.space{flex:4;font-size:15px}
      .enter{flex:1.8;font-size:15px;background:var(--accent);color:white}.shift.on{background:#0e7490;color:white}
      .hint{font-size:13px;color:var(--muted);margin:0 0 6px;line-height:18px}
      @media(max-width:360px){.key{font-size:16px;height:clamp(28px,calc((100dvh - 76px)/4),39px)}.wide,.space,.enter{font-size:13px}}
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
    panel.id = 'keyboard-panel'; panel.setAttribute('aria-label', 'Touch keyboard');
    toggle.setAttribute('aria-controls', panel.id); toggle.setAttribute('aria-expanded', 'false');
    const header = document.createElement('div'); header.className = 'header';
    const label = document.createElement('div'); label.className = 'label';
    header.append(label, button('Close', () => setOpen(false), 'close'));
    const hint = document.createElement('p'); hint.className = 'hint';
    const keys = document.createElement('div');
    panel.append(header, hint, keys); root.append(toggle, panel); document.documentElement.append(host);
    let target = null, open = false, shifted = false, symbols = false, moreSymbols = false;
    const editable = el => el && !el.disabled && !el.readOnly && (
      el.isContentEditable || el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement &&
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
      if (editable(input)) { target = input; updateLabel(); if (config.autoOpen) setOpen(true); }
      else if (!e.composedPath().includes(host)) {target = null; updateLabel();}
    }, true);
    document.addEventListener('pointerdown', e => {
      if (e.composedPath().includes(host)) return;
      const input = e.composedPath().find(editable);
      if (input) { target = input; updateLabel(); }
    }, true);
    function setOpen(value) {
      if (editable(active())) target = active();
      open = value; panel.hidden = !value; toggle.hidden = value;
      toggle.setAttribute('aria-expanded', String(value));
      if (!value) { shifted = false; symbols = false; moreSymbols = false; render(); }
      updateLabel();
    }
    // The binding is installed by the server for this page's CDP session.
    // Chromium handles editing, selection, validation and native form actions.
    // No input values are read or retained by the keyboard.
    function send(message) {
      if (typeof window.__rwvTouchKeyboardInput === 'function') {
        window.__rwvTouchKeyboardInput(JSON.stringify(message));
      }
    }
    function input(text) {
      send({type:'text',text});
      if (shifted) {shifted=false;render();}
    }
    function key(name) {send({type:'key',key:name});}
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && open) {setOpen(false);e.preventDefault();}
    }, true);
    window.addEventListener('resize', updateLabel);
    function render() {
      keys.replaceChildren();
      const rows = symbols ? (moreSymbols ? ['[]{}<>%+=~','^|`:$€£@#',config.layout === 'azerty' ? 'éèàçù!?;' : '-_/\\:;!?ß'] :
        ['1234567890','@#$%&*()+','-_/\\:;!?']) : config.layout === 'qwertz' ? ['qwertzuiopü','asdfghjklöä','yxcvbnm'] :
        config.layout === 'azerty' ? ['azertyuiop','qsdfghjklm','wxcvbn'] : ['qwertyuiop','asdfghjkl','zxcvbnm'];
      rows.forEach((letters,index) => {
        const row = document.createElement('div'); row.className = 'row';
        if (index === 2) row.append(button(symbols ? (moreSymbols ? '123' : '#+=') : 'Shift', () => {
          if (symbols) {moreSymbols = !moreSymbols; render();} else {shifted = !shifted; render();}
        }, 'key wide shift' + (shifted ? ' on' : '')));
        for (const char of letters) {
          const text = shifted && !symbols ? char.toUpperCase() : char;
          row.append(button(text, () => input(text), 'key'));
        }
        if (index === 2) row.append(button('⌫', () => key('Backspace'), 'key wide'));
        keys.append(row);
      });
      const row = document.createElement('div'); row.className = 'row';
      row.append(button(symbols ? 'ABC' : '123', () => {symbols=!symbols;moreSymbols=false;shifted=false;render();}, 'key wide'),
        button('Tab',()=>key('Tab'),'key wide'), button('Space',()=>input(' '),'key space'),
        button(symbols ? '"' : '.',()=>input(symbols ? '"' : '.'),'key'),
        button(symbols ? "'" : ',',()=>input(symbols ? "'" : ','),'key'),
        button('Enter',()=>key('Enter'),'key enter'));
      keys.append(row);
    }
    render(); updateLabel();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})
