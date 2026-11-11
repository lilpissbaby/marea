(function () {
  'use strict';
  const M = window.Marea;
  const { toNum, toStr, todayNum } = M;
  const KEY = 'marea:v1';

  /* ---------- Guardado ---------- */
  let storageOk = true;
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? M.normalize(JSON.parse(raw)) : M.emptyData();
    } catch (e) {
      storageOk = false;
      return M.emptyData();
    }
  }
  let persistAsked = false;
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      storageOk = true;
    } catch (e) {
      storageOk = false;
      toast('No se ha podido guardar. Revisa el espacio libre del iPhone.');
      return;
    }
    if (!persistAsked && navigator.storage && navigator.storage.persist) {
      persistAsked = true;
      navigator.storage.persisted().then((p) => (p ? true : navigator.storage.persist())).catch(() => {});
    }
  }

  let data = load();
  let A = null;
  const ui = { tab: 'hoy', month: null, editMode: false, introDone: false, onb: null };

  /* ---------- Utilidades ---------- */
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const fmt = (o) => new Intl.DateTimeFormat('es-ES', Object.assign({ timeZone: 'UTC' }, o));
  const F = {
    dm: fmt({ day: 'numeric', month: 'short' }),
    wdm: fmt({ weekday: 'short', day: 'numeric', month: 'short' }),
    long: fmt({ weekday: 'long', day: 'numeric', month: 'long' }),
    dmy: fmt({ day: 'numeric', month: 'short', year: 'numeric' }),
    my: fmt({ month: 'long', year: 'numeric' }),
    m: fmt({ month: 'short' }),
  };
  const clean = (s) => s.replace(/\./g, '').replace(',', '');
  const dDM = (n) => clean(F.dm.format(M.numToDate(n)));
  const dWDM = (n) => clean(F.wdm.format(M.numToDate(n)));
  const dLong = (n) => clean(F.long.format(M.numToDate(n)));
  const dDMY = (n) => clean(F.dmy.format(M.numToDate(n)));
  function inDays(k) {
    if (k === 0) return 'hoy';
    if (k === 1) return 'mañana';
    if (k === -1) return 'ayer';
    return k > 0 ? `en ${k} días` : `hace ${-k} días`;
  }
  function range(a, b) {
    const da = M.numToDate(a), db = M.numToDate(b);
    if (da.getUTCMonth() === db.getUTCMonth()) return `del ${da.getUTCDate()} al ${dDM(b)}`;
    return `del ${dDM(a)} al ${dDM(b)}`;
  }
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2800);
  }

  function refresh() {
    A = M.analyze(data, todayNum());
    render();
  }

  /* ---------- Fases y textos ---------- */
  const PHASES = {
    regla: ['Regla', 'var(--sangre)'],
    folicular: ['Fase folicular', 'var(--rubor-2)'],
    fertil: ['Ventana fértil', 'var(--mar)'],
    ovulacion: ['Ovulación estimada', 'var(--luna)'],
    lutea: ['Fase lútea', 'var(--rubor-2)'],
    premenstrual: ['Antes de la regla', 'var(--rubor)'],
    retraso: ['Retraso', 'var(--luna)'],
    medio: ['Mitad del ciclo', 'var(--rubor-2)'],
  };
  const TIPS = {
    regla: 'Está con la regla. Ayuda tener a mano lo que ella suela usar: analgésicos, bolsa de agua caliente, compresas, tampones o copa. Mejor preguntarle qué le apetece que suponerlo.',
    folicular: 'Ya pasó la regla. Mucha gente nota más energía en esta fase, aunque cada persona es distinta: fíate más de lo que ella te cuente que de la fase.',
    fertil: 'Ventana fértil estimada. Si no buscáis embarazo, recuerda que este cálculo es aproximado y no sustituye a ningún método anticonceptivo.',
    ovulacion: 'Día de ovulación estimado por calendario. En la realidad puede adelantarse o retrasarse varios días.',
    lutea: 'Segunda mitad del ciclo. Si en otros ciclos apuntaste síntomas por estas fechas, salen más arriba.',
    medio: 'Mitad del ciclo. Si en otros ciclos apuntaste síntomas por estas fechas, salen más arriba.',
    premenstrual: 'La regla llega en pocos días. Buen momento para comprobar que en casa hay lo que suele necesitar.',
    retraso: 'Un retraso de unos días es frecuente: estrés, viajes, cambios de rutina o estar enferma pueden moverla. Si se alarga o hay posibilidad de embarazo, un test o una consulta lo aclaran.',
  };
  function shownPhase(p) {
    if (!data.settings.showFertile && (p === 'fertil' || p === 'ovulacion')) return 'medio';
    return p;
  }

  /* ---------- Iconos ---------- */
  const DROP = 'M12 2.5c-3.1 4.3-6.2 7.9-6.2 11.4a6.2 6.2 0 0 0 12.4 0c0-3.5-3.1-7.1-6.2-11.4z';
  const FLOW_ICONS = [
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${DROP}" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
    `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="14" r="2.6" fill="currentColor"/></svg>`,
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${DROP}" fill="currentColor" transform="translate(12 15) scale(.62) translate(-12 -14)"/></svg>`,
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${DROP}" fill="currentColor"/></svg>`,
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${DROP}" fill="currentColor" transform="translate(-3.6 1.5) scale(.8)"/><path d="${DROP}" fill="currentColor" transform="translate(8.6 3.8) scale(.68)"/></svg>`,
  ];
  const ICON = {
    hoy: (() => {
      let c = '';
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 10;
        c += `<circle ${i === 0 ? 'class="tab-dot"' : ''} cx="${(12 + 8.5 * Math.cos(a)).toFixed(2)}" cy="${(12 + 8.5 * Math.sin(a)).toFixed(2)}" r="${i === 0 ? 2.3 : 1.5}" fill="currentColor"/>`;
      }
      return `<svg viewBox="0 0 24 24" aria-hidden="true">${c}</svg>`;
    })(),
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.5" y="5" width="17" height="15" rx="3.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><circle cx="8.5" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="14" r="1" fill="currentColor" stroke="none"/></svg>',
    hist: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><rect x="3" y="5" width="14" height="3" rx="1.5"/><rect x="3" y="10.5" width="18" height="3" rx="1.5"/><rect x="3" y="16" width="11" height="3" rx="1.5"/></svg>',
    ajustes: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.4" style="fill:var(--vino)"/><circle cx="15" cy="17" r="2.4" style="fill:var(--vino)"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  };

  /* ---------- Pestañas ---------- */
  const TABS = [['hoy', 'Hoy', ICON.hoy], ['cal', 'Calendario', ICON.cal], ['hist', 'Historial', ICON.hist], ['ajustes', 'Ajustes', ICON.ajustes]];
  function renderTabs() {
    $('#tabs').innerHTML = TABS.map(([id, label, icon]) =>
      `<button class="tab" data-action="tab" data-tab="${id}" ${ui.tab === id ? 'aria-current="page"' : ''}>${icon}<span>${label}</span></button>`).join('');
  }

  function render() {
    renderTabs();
    const screen = $('#screen');
    const views = { hoy: viewHoy, cal: viewCal, hist: viewHist, ajustes: viewAjustes };
    screen.innerHTML = `<div class="screen-inner">${views[ui.tab]()}</div>`;
    if (ui.tab === 'cal') bindSwipe();
    if (ui.tab === 'ajustes') fillStorageStatus();
    renderOnboarding();
  }

  /* ---------- Hoy ---------- */
  function dial() {
    const s = data.settings;
    const N = Math.min(60, Math.max(A.avgCycle, A.cycleDay));
    const C = 170, R = 150;
    const r = Math.min(7, ((2 * Math.PI * R) / N) * 0.3);
    const intro = !ui.introDone;
    let dots = '';
    let todayXY = null;
    for (let i = 0; i < N; i++) {
      const n = A.curStart + i;
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
      const x = (C + R * Math.cos(a)).toFixed(2), y = (C + R * Math.sin(a)).toFixed(2);
      const e = data.days[toStr(n)];
      let fill = 'var(--vino-3)', stroke = 'none', rr = r;
      if (e && e.flow >= 2) fill = 'var(--sangre)';
      else if (A.inPeriod && n > A.lastRun.end && i < A.avgPeriod) { fill = 'none'; stroke = 'var(--sangre)'; rr = r - 0.8; }
      else if (s.showFertile && n === A.ov) { fill = 'var(--luna)'; rr = r * 1.35; }
      else if (s.showFertile && n >= A.fertStart && n <= A.fertEnd) fill = 'var(--mar)';
      else if (A.late && n >= A.nextStart) { fill = 'none'; stroke = 'var(--luna)'; rr = r - 0.8; }
      const future = n > A.today;
      dots += `<circle class="dot${future ? ' is-future' : ''}" style="--i:${i};fill:${fill};stroke:${stroke}" cx="${x}" cy="${y}" r="${rr.toFixed(2)}" stroke-width="1.6"/>`;
      if (n === A.today) todayXY = [x, y];
    }
    const ring = todayXY ? `<circle cx="${todayXY[0]}" cy="${todayXY[1]}" r="${(r + 6).toFixed(2)}" style="fill:none;stroke:var(--rubor)" stroke-width="2"/>` : '';

    const p = shownPhase(A.phase);
    const [label, color] = PHASES[p];
    let phaseText = label, sub = '';
    if (A.phase === 'regla') {
      sub = A.awaiting ? 'Confirma abajo si sigue' : `Suele durarle ${plural(A.avgPeriod, 'día', 'días')}`;
    } else if (A.phase === 'retraso') {
      phaseText = `Retraso de ${plural(A.late, 'día', 'días')}`;
      sub = `Se esperaba el ${dDM(A.nextStart)}`;
    } else if (p === 'folicular') {
      sub = s.showFertile ? `Ventana fértil ${inDays(A.fertStart - A.today)}` : `Regla prevista ${inDays(A.daysUntil)}`;
    } else if (p === 'fertil') {
      sub = A.ov >= A.today ? `Ovulación estimada ${inDays(A.ov - A.today)}` : `Termina ${inDays(A.fertEnd - A.today)}`;
    } else if (p === 'ovulacion') {
      sub = 'Día más fértil estimado';
    } else {
      sub = `Regla prevista ${inDays(A.daysUntil)}`;
    }
    ui.introDone = true;
    return `<div class="dial${intro ? ' is-intro' : ''}" role="img" aria-label="Día ${A.cycleDay} del ciclo. ${esc(phaseText)}. ${esc(sub)}.">
      <svg viewBox="0 0 340 340" aria-hidden="true">${dots}${ring}</svg>
      <div class="dial-center" aria-hidden="true">
        <p class="dial-kicker">Día del ciclo</p>
        <p class="dial-num">${A.cycleDay}</p>
        <p class="dial-phase" style="color:${color}">${esc(phaseText)}</p>
        <p class="dial-sub">${esc(sub)}</p>
      </div>
    </div>`;
  }

  function facts() {
    const s = data.settings;
    let rows = '';
    const spread = A.sd && A.sd >= 2 ? ` (±${Math.round(A.sd)} días)` : '';
    if (A.late) {
      rows += `<div><dt>Próxima regla</dt><dd><strong>Retraso de ${plural(A.late, 'día', 'días')}</strong><span>Prevista el ${dWDM(A.nextStart)}</span></dd></div>`;
    } else {
      rows += `<div><dt>Próxima regla</dt><dd><strong>${cap(inDays(A.daysUntil))}</strong><span>${dWDM(A.nextStart)}${spread}</span></dd></div>`;
    }
    if (s.showFertile && !A.late) {
      const w = A.today <= A.fertEnd ? { a: A.fertStart, b: A.fertEnd } : { a: A.projections[0].fertStart, b: A.projections[0].fertEnd };
      const now = A.today >= w.a && A.today <= w.b;
      rows += `<div><dt>Ventana fértil</dt><dd><strong>${now ? `Ahora, hasta el ${dDM(w.b)}` : cap(inDays(w.a - A.today))}</strong><span>${range(w.a, w.b)}, estimada</span></dd></div>`;
    }
    return `<dl class="facts">${rows}</dl>`;
  }

  function periodActions() {
    if (A.awaiting) {
      return `<div class="actions"><p class="ask">¿Sigue con la regla hoy?</p>
        <div class="btn-row"><button class="btn btn-primary" data-action="continue-period">Sí, sigue</button>
        <button class="btn btn-secondary" data-action="end-period">No, terminó</button></div></div>`;
    }
    if (A.inPeriodToday) {
      if (A.lastEnded) {
        return `<div class="actions"><p class="ask">Hoy es su último día de regla.</p>
          <button class="btn btn-quiet" data-action="undo-end">Deshacer</button></div>`;
      }
      return `<div class="actions"><button class="btn btn-secondary" data-action="end-period">Ya le ha terminado la regla</button></div>`;
    }
    return `<div class="actions"><button class="btn btn-primary" data-action="open-start">Le ha venido la regla</button></div>`;
  }

  function todayBlock() {
    const n = A ? A.today : todayNum();
    const e = data.days[toStr(n)];
    let chips = '';
    if (e) {
      if (e.flow) chips += `<li class="is-flow">${e.flow === 1 ? 'Manchado' : `Flujo ${M.FLOW[e.flow].toLowerCase()}`}</li>`;
      (e.sym || []).forEach((t) => (chips += `<li>${esc(M.LABELS[t])}</li>`));
      (e.mood || []).forEach((t) => (chips += `<li>${esc(M.LABELS[t])}</li>`));
      if (e.sex) chips += `<li>Relaciones</li>`;
      if (e.temp) chips += `<li>${String(e.temp).replace('.', ',')} °C</li>`;
    }
    const note = e && e.note ? `<p class="note-preview">${esc(e.note.length > 140 ? e.note.slice(0, 140) + '…' : e.note)}</p>` : '';
    return `<section class="block"><h2 class="section-title">Hoy</h2>
      ${chips ? `<ul class="logged">${chips}</ul>` : '<p class="muted small">Aún no has apuntado nada hoy.</p>'}
      ${note}
      <button class="btn btn-secondary" data-action="open-day" data-n="${n}">${e ? 'Editar lo de hoy' : 'Apuntar cómo está hoy'}</button>
    </section>`;
  }

  function installNotice() {
    let out = '';
    if (isIOS() && !isStandalone()) {
      out += `<div class="notice notice-warn"><p><strong>Estás dentro de Safari.</strong> Para que los datos no se borren solos, pulsa Compartir y luego «Añadir a pantalla de inicio», y usa Marea desde ese icono.</p>
        <p class="tiny">Lo que apuntes aquí no pasa a la app instalada. Si ya tienes datos, guarda una copia y recupérala allí.</p></div>`;
    }
    return out;
  }
  function backupNotice() {
    let out = '';
    const count = Object.keys(data.days).length;
    const last = data.settings.lastBackup ? toNum(data.settings.lastBackup) : null;
    const today = todayNum();
    if (count >= 3 && (last === null || today - last >= 30)) {
      out += `<div class="notice"><p>${last === null ? 'Aún no has guardado ninguna copia de seguridad.' : `Tu última copia es de hace ${today - last} días.`} Si cambias de iPhone o se borra la app, solo podrás recuperar los datos con una copia.</p>
        <button class="btn btn-secondary" data-action="export">Guardar copia</button></div>`;
    }
    return out;
  }

  function viewHoy() {
    const s = data.settings;
    const head = `<header class="today-head"><p class="who">${s.name ? `Ciclo de ${esc(s.name)}` : 'Su ciclo'}</p><p class="date">${cap(dLong(todayNum()))}</p></header>`;
    if (!A.hasData) {
      return `${head}${installNotice()}
        <section class="block"><p class="title">Todavía no hay ninguna regla apuntada.</p>
        <p class="muted">Cuando le venga, pulsa el botón y Marea empezará a calcular. Si recuerdas cuándo fue la última, márcala en el calendario.</p></section>
        <div class="actions"><button class="btn btn-primary" data-action="open-start">Le ha venido la regla</button></div>
        ${todayBlock()}${backupNotice()}`;
    }
    const pats = M.patternsNow(data, A);
    const insight = pats.length ? `<section class="block"><h2 class="section-title">Por estas fechas, en otros ciclos</h2>
      <ul class="insight-list">${pats.map((x) => `<li><span>${esc(x.label)}</span><span>${plural(x.cycles, 'ciclo', 'ciclos')}</span></li>`).join('')}</ul></section>` : '';
    const p = shownPhase(A.phase);
    const tip = s.showTips ? `<section class="block tip" style="--phase-color:${PHASES[p][1]}"><h2 class="section-title">Para ti</h2><p>${esc(TIPS[p])}</p></section>` : '';
    return `${head}${installNotice()}${dial()}${facts()}${periodActions()}${todayBlock()}${insight}${tip}${backupNotice()}`;
  }

  /* ---------- Calendario ---------- */
  function dayState(n) {
    const s = data.settings;
    const e = data.days[toStr(n)];
    const st = { e, period: !!(e && e.flow >= 2), spot: !!(e && e.flow === 1), log: !!(e && (e.sym || e.mood || e.note || e.sex || e.temp)) };
    if (!A || !A.hasData) return st;
    st.pred = !st.period && (A.predicted.has(n) || (A.inPeriod && n > A.lastRun.end && n < A.curStart + A.avgPeriod));
    st.fert = s.showFertile && !st.period && A.fertile.has(n);
    st.ov = s.showFertile && !st.period && A.ovDays.has(n);
    return st;
  }

  function viewCal() {
    const today = todayNum();
    if (!ui.month) { const d = M.numToDate(today); ui.month = [d.getUTCFullYear(), d.getUTCMonth()]; }
    const [y, m] = ui.month;
    const first = Math.round(Date.UTC(y, m, 1) / M.DAY_MS);
    const daysIn = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const lead = (M.numToDate(first).getUTCDay() + 6) % 7;
    const states = {};
    for (let n = first - 1; n <= first + daysIn; n++) states[n] = dayState(n);
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span class="day is-blank" aria-hidden="true"></span>';
    for (let d = 1; d <= daysIn; d++) {
      const n = first + d - 1;
      const st = states[n];
      const col = (lead + d - 1) % 7;
      const cls = ['day'];
      const bandOf = (k) => (k === 'period' ? states[n - 1].period : states[n - 1].fert && !states[n - 1].period);
      const bandNext = (k) => (k === 'period' ? states[n + 1].period : states[n + 1].fert && !states[n + 1].period);
      let band = null;
      if (st.period) { cls.push('is-period'); band = 'period'; }
      else if (st.fert) { cls.push('is-fert'); band = 'fert'; }
      if (band) {
        if (col === 0 || d === 1 || !bandOf(band)) cls.push('band-start');
        if (col === 6 || d === daysIn || !bandNext(band)) cls.push('band-end');
      }
      if (st.pred) cls.push('is-pred');
      if (st.ov) cls.push('is-ov');
      if (n === today) cls.push('is-today');
      if (n > today) cls.push('is-future');
      const desc = [dLong(n)];
      if (n === today) desc.push('hoy');
      if (st.period) desc.push('regla');
      if (st.spot) desc.push('manchado');
      if (st.pred) desc.push('regla prevista');
      if (st.ov) desc.push('ovulación estimada');
      else if (st.fert) desc.push('ventana fértil estimada');
      if (st.log) desc.push('con registro');
      cells += `<button class="${cls.join(' ')}" data-action="day" data-n="${n}" aria-label="${esc(desc.join(', '))}">
        <span class="n">${d}</span>${st.spot ? '<i class="spot"></i>' : ''}${st.log ? '<i class="mark"></i>' : ''}</button>`;
    }
    const monthLabel = cap(new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', month: 'long' }).format(M.numToDate(first)));
    const fewRuns = !A.hasData || A.runs.length < 3;
    const legend = [
      '<li><i class="lg-period"></i>Regla</li>', '<li><i class="lg-pred"></i>Prevista</li>',
      data.settings.showFertile ? '<li><i class="lg-fert"></i>Fértil</li><li><i class="lg-ov"></i>Ovulación</li>' : '',
      '<li><i class="lg-spot"></i>Manchado</li>', '<li><i class="lg-log"></i>Con registro</li>',
    ].join('');
    return `<header class="cal-head"><h1 class="title cal-title">${esc(monthLabel)} <span class="yr">${y}</span></h1>
        <div class="cal-nav"><button class="icon-btn" data-action="month" data-d="-1" aria-label="Mes anterior">${ICON.prev}</button>
        <button class="icon-btn" data-action="month" data-d="1" aria-label="Mes siguiente">${ICON.next}</button></div></header>
      <div class="cal-tools"><button class="chip-btn" data-action="month-today">Hoy</button>
        <button class="chip-btn ${ui.editMode ? 'is-on' : ''}" data-action="edit-mode" aria-pressed="${ui.editMode}">${ui.editMode ? 'Listo' : 'Editar días de regla'}</button></div>
      ${ui.editMode ? '<p class="edit-hint">Toca los días en que tuvo la regla para marcarlos o quitarlos.</p>' : ''}
      <div class="weekdays" aria-hidden="true"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
      <div class="grid ${ui.editMode ? 'is-editing' : ''}" id="grid">${cells}</div>
      <ul class="legend">${legend}</ul>
      ${fewRuns && !ui.editMode ? '<p class="help">Si recuerdas reglas anteriores, márcalas con «Editar días de regla»: con tres o más, las predicciones se basan solo en sus ciclos.</p>' : ''}`;
  }

  function bindSwipe() {
    const g = $('#grid');
    if (!g) return;
    let x0 = null, y0 = null;
    g.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    g.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dy) < 45) shiftMonth(dx < 0 ? 1 : -1);
    }, { passive: true });
  }
  function shiftMonth(d) {
    let [y, m] = ui.month;
    m += d;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    ui.month = [y, m];
    render();
  }

  function togglePeriodDay(n) {
    if (n > todayNum()) return;
    const k = toStr(n);
    const e = Object.assign({}, data.days[k]);
    e.flow = e.flow >= 2 ? 0 : 3;
    setDay(k, e);
    save();
    refresh();
  }

  /* ---------- Historial ---------- */
  function viewHist() {
    if (!A.hasData) {
      return `<h1 class="title">Historial</h1><p class="empty">Aquí verás la duración de cada ciclo y de cada regla en cuanto haya alguna apuntada.</p>`;
    }
    const s = data.settings;
    const n = A.cycleCount;
    const stat = (v, u, k) => `<div class="stat"><span class="v">${v}</span><span class="u">${u}</span><span class="k">${k}</span></div>`;
    let note;
    if (n < 3) {
      note = `Con ${plural(n, 'ciclo completo', 'ciclos completos')} las medias también tienen en cuenta lo que indicaste al empezar (${s.cycleLen} y ${s.periodLen} días). A partir de tres ciclos se basan solo en los suyos.`;
    } else if (A.variation === 0) {
      note = 'Sus ciclos son muy regulares: los últimos han durado exactamente lo mismo.';
    } else if (A.variation <= 7) {
      note = `Sus ciclos son regulares: entre el más corto y el más largo hay ${plural(A.variation, 'día', 'días')}.`;
    } else if (A.variation <= 9) {
      note = `Entre su ciclo más corto y el más largo hay ${A.variation} días. Según la edad, eso todavía se considera regular.`;
    } else {
      note = `Sus ciclos varían bastante (${A.variation} días entre el más corto y el más largo), así que las predicciones serán menos precisas. Si es algo nuevo o le preocupa, puede comentarlo en su próxima revisión.`;
    }
    let extra = '';
    if (n >= 3 && (A.avgCycle < 24 || A.avgCycle > 38)) {
      extra += '<p class="help">La duración media queda fuera de lo más habitual (de 24 a 38 días). No tiene por qué significar nada, pero es un dato útil para una consulta ginecológica.</p>';
    }
    if (A.runs.length >= 3 && A.avgPeriod > 8) {
      extra += '<p class="help">Las reglas le duran más de 8 días de media. Es un dato útil para comentarlo en una consulta ginecológica.</p>';
    }

    const maxLen = Math.max(45, A.cycleDay, ...A.cycles.map((c) => c.len));
    const pct = (v) => ((v / maxLen) * 100).toFixed(2) + '%';
    const rows = [];
    rows.push(`<li><div class="c-meta"><span class="d">Ciclo actual, desde el ${dDM(A.curStart)}</span><span class="l">día ${A.cycleDay}</span></div>
      <div class="c-track"><div class="c-bar is-open" style="--w:${pct(Math.max(A.cycleDay, A.avgCycle))};--p:${((A.lastRun.len / Math.max(A.cycleDay, A.avgCycle)) * 100).toFixed(2)}%"></div><span class="c-avg" style="--a:${pct(A.avgCycle)}"></span></div></li>`);
    A.cycles.slice().reverse().forEach((c) => {
      const odd = c.len < 15 || c.len > 60;
      rows.push(`<li><div class="c-meta"><span class="d">${dDMY(c.start)}</span><span class="l">${plural(c.len, 'día', 'días')}, ${c.periodLen} de regla${odd ? ' (no cuenta en la media)' : ''}</span></div>
        <div class="c-track"><div class="c-bar" style="--w:${pct(Math.min(c.len, maxLen))};--p:${((c.periodLen / c.len) * 100).toFixed(2)}%"></div><span class="c-avg" style="--a:${pct(A.avgCycle)}"></span></div></li>`);
    });
    const syms = M.symptomSummary(data, A);
    const symBlock = syms.length ? `<section class="block"><h2 class="section-title">Síntomas que más apuntas</h2><ul class="sym-list">${syms.map((x) =>
      `<li><div class="row"><span>${esc(x.label)}</span><span>${plural(x.days, 'día', 'días')}</span></div><div class="when">${esc(x.when)}</div></li>`).join('')}</ul></section>` : '';
    return `<h1 class="title">Historial</h1>
      <div class="stats">${stat(A.avgCycle, 'días', 'Ciclo medio')}${stat(A.avgPeriod, 'días', 'Regla media')}${stat(A.variation === undefined ? '–' : A.variation, A.variation === undefined ? 'faltan datos' : 'días', 'Variación')}</div>
      <p class="small muted">${note}</p>${extra}
      <section class="block"><h2 class="section-title">Ciclos</h2>
      <p class="tiny">En rojo, los días de regla. La raya amarilla marca su ciclo medio.</p>
      <ol class="cycles">${rows.join('')}</ol></section>
      ${symBlock}`;
  }

  /* ---------- Ajustes ---------- */
  const LIMITS = { cycleLen: [20, 45], periodLen: [2, 10], luteal: [10, 16] };
  const stepper = (key, val, action) => `<div class="stepper">
      <button data-action="${action}" data-key="${key}" data-d="-1" aria-label="Menos">−</button>
      <output id="out-${key}" aria-live="polite">${val}</output>
      <button data-action="${action}" data-key="${key}" data-d="1" aria-label="Más">+</button></div>`;
  const switchRow = (key, label, sub) => `<div class="set-row"><label class="lbl" for="sw-${key}">${label}${sub ? `<small>${sub}</small>` : ''}</label>
      <span class="switch"><input type="checkbox" id="sw-${key}" data-setting="${key}" ${data.settings[key] ? 'checked' : ''}><span></span></span></div>`;

  function viewAjustes() {
    const s = data.settings;
    const last = s.lastBackup ? toNum(s.lastBackup) : null;
    const lastTxt = last === null ? '<span class="status-warn">Nunca</span>' : (todayNum() - last === 0 ? 'Hoy' : `Hace ${plural(todayNum() - last, 'día', 'días')}`);
    return `<h1 class="title">Ajustes</h1>
      <section><label class="field"><span>Cómo se llama</span><input class="input" id="set-name" type="text" autocomplete="off" maxlength="40" value="${esc(s.name)}" placeholder="Opcional"></label></section>
      <section class="block"><h2 class="section-title">Su ciclo</h2>
        <div class="row-set">
          <div class="set-row"><span class="lbl">Duración habitual del ciclo<small>Días de una regla a la siguiente</small></span>${stepper('cycleLen', s.cycleLen, 'step')}</div>
          <div class="set-row"><span class="lbl">Duración habitual de la regla</span>${stepper('periodLen', s.periodLen, 'step')}</div>
          <div class="set-row"><span class="lbl">Fase lútea<small>Días entre ovulación y regla. Si no lo sabes, déjalo en 14</small></span>${stepper('luteal', s.luteal, 'step')}</div>
        </div>
        <p class="help">Los dos primeros valores solo se usan mientras haya pocos ciclos apuntados. Después manda lo que se registra.</p></section>
      <section class="block"><h2 class="section-title">Qué mostrar</h2><div class="row-set">
        ${switchRow('showFertile', 'Ventana fértil y ovulación')}
        ${switchRow('showTips', 'Consejos para ti', 'Un apunte según la fase en la pantalla Hoy')}</div></section>
      <section class="block"><h2 class="section-title">Tus datos</h2>
        <div class="row-set">
          <div class="set-row"><span class="lbl">Dónde se guardan</span><span class="val">Solo en este dispositivo</span></div>
          <div class="set-row"><span class="lbl">Instalada en pantalla de inicio</span><span class="val">${isStandalone() ? '<span class="status-ok">Sí</span>' : '<span class="status-warn">No</span>'}</span></div>
          <div class="set-row"><span class="lbl">Protegida contra borrado automático</span><span class="val" id="persist-status">Comprobando…</span></div>
          <div class="set-row"><span class="lbl">Última copia de seguridad</span><span class="val">${lastTxt}</span></div>
        </div>
        <div class="stack" style="margin-top:16px">
          <button class="btn btn-primary" data-action="export">Guardar copia</button>
          <button class="btn btn-secondary" data-action="import">Recuperar copia</button>
          <button class="btn btn-secondary" data-action="ics">Añadir predicciones al Calendario</button>
        </div>
        <p class="help">Marea no envía nada a ningún servidor. Instalada en la pantalla de inicio, el iPhone no borra sus datos por falta de uso, pero se pierden si borras el icono o cambias de móvil. Por eso conviene guardar una copia cada mes.</p>
        <div style="margin-top:22px"><button class="btn btn-danger" data-action="wipe">Borrar todos los datos</button></div>
      </section>
      <section class="about"><p>Marea calcula con el método del calendario: ovulación unos ${s.luteal} días antes de la regla prevista y ventana fértil de seis días. Son estimaciones; no sirve como anticonceptivo ni para diagnosticar nada.</p><p>Versión 1.0</p></section>`;
  }

  function fillStorageStatus() {
    const el = $('#persist-status');
    if (!el) return;
    if (!navigator.storage || !navigator.storage.persisted) { el.textContent = 'No disponible'; return; }
    navigator.storage.persisted().then((p) => {
      el.innerHTML = p ? '<span class="status-ok">Sí</span>' : (isStandalone() ? 'No confirmada' : '<span class="status-warn">No</span>');
    }).catch(() => { el.textContent = 'No disponible'; });
  }

  /* ---------- Hoja inferior ---------- */
  let sheetOnClose = null;
  function openSheet(html, onClose) {
    closeSheet(true);
    sheetOnClose = onClose || null;
    const root = $('#sheet-root');
    root.innerHTML = `<div class="backdrop" data-action="close-sheet"></div>
      <div class="sheet" role="dialog" aria-modal="true" tabindex="-1"><div class="grabber" aria-hidden="true"></div>${html}</div>`;
    const sheet = $('.sheet', root);
    requestAnimationFrame(() => {
      $('.backdrop', root).classList.add('is-open');
      sheet.classList.add('is-open');
      sheet.focus({ preventScroll: true });
    });
    // Arrastrar hacia abajo para cerrar
    let y0 = null;
    sheet.addEventListener('touchstart', (e) => { y0 = sheet.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
    sheet.addEventListener('touchmove', (e) => {
      if (y0 === null) return;
      const dy = e.touches[0].clientY - y0;
      if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    sheet.addEventListener('touchend', (e) => {
      if (y0 === null) return;
      const dy = e.changedTouches[0].clientY - y0;
      y0 = null;
      sheet.style.transform = '';
      if (dy > 110) closeSheet();
    }, { passive: true });
    return sheet;
  }
  function closeSheet(immediate) {
    const root = $('#sheet-root');
    const sheet = $('.sheet', root);
    if (!sheet) return;
    const cb = sheetOnClose;
    sheetOnClose = null;
    if (immediate) { root.innerHTML = ''; }
    else {
      sheet.classList.remove('is-open');
      $('.backdrop', root).classList.remove('is-open');
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(() => { if (!$('.sheet.is-open', root)) root.innerHTML = ''; }, reduce ? 0 : 280);
    }
    if (cb) cb();
  }

  /* ---------- Registro de un día ---------- */
  function setDay(k, e) {
    const c = M.cleanDay(e);
    if (c) data.days[k] = c; else delete data.days[k];
  }

  function daySub(n) {
    if (!A || !A.hasData) return '';
    let start = null;
    for (let i = A.runs.length - 1; i >= 0; i--) if (A.runs[i].start <= n) { start = A.runs[i].start; break; }
    if (start === null) return '';
    const cd = n - start + 1;
    let txt = `Día ${cd} del ciclo`;
    if (start === A.curStart) txt += `. ${PHASES[shownPhase(M.phaseOf(A, data, n))][0]}`;
    return txt;
  }

  function openDay(n) {
    const today = todayNum();
    if (n > today) {
      const st = dayState(n);
      const what = [];
      if (st.pred) what.push('Regla prevista');
      if (st.ov) what.push('Ovulación estimada');
      else if (st.fert) what.push('Ventana fértil estimada');
      openSheet(`<h2>${esc(dLong(n))}</h2><p class="sub">${what.length ? what.join('. ') + '.' : 'Sin nada previsto.'} Los días futuros no se pueden apuntar todavía.</p>
        <button class="btn btn-secondary" data-action="close-sheet">Cerrar</button>`);
      return;
    }
    const k = toStr(n);
    const e = data.days[k] || {};
    const flowSeg = M.FLOW.map((l, i) => `<button data-action="d-flow" data-v="${i}" aria-pressed="${(e.flow || 0) === i}">${FLOW_ICONS[i]}<span>${l}</span></button>`).join('');
    const chips = (list, sel, act) => list.map(([id, l]) => `<button class="chip" data-action="${act}" data-id="${id}" aria-pressed="${(sel || []).includes(id)}">${esc(l)}</button>`).join('');
    const sexSeg = M.SEX.map((l, i) => `<button data-action="d-sex" data-v="${i}" aria-pressed="${(e.sex || 0) === i}">${l}</button>`).join('');
    const sheet = openSheet(`<h2>${esc(n === today ? 'Hoy, ' + dLong(n) : dLong(n))}</h2><p class="sub">${esc(daySub(n))}</p>
      <fieldset><legend>Regla</legend><div class="seg" id="seg-flow">${flowSeg}</div></fieldset>
      <fieldset><legend>Síntomas</legend><div class="chips">${chips(M.SYMPTOMS, e.sym, 'd-sym')}</div></fieldset>
      <fieldset><legend>Ánimo</legend><div class="chips is-mood">${chips(M.MOODS, e.mood, 'd-mood')}</div></fieldset>
      <fieldset><legend>Relaciones</legend><div class="seg is-plain" id="seg-sex">${sexSeg}</div></fieldset>
      <label class="field"><span>Temperatura basal (°C, opcional)</span><input class="input" id="d-temp" type="text" inputmode="decimal" placeholder="36,5" value="${e.temp ? String(e.temp).replace('.', ',') : ''}"></label>
      <label class="field"><span>Notas</span><textarea class="input" id="d-note" rows="3" placeholder="Lo que quieras recordar de este día">${esc(e.note || '')}</textarea></label>
      <button class="btn btn-primary" data-action="close-sheet">Listo</button>`, () => refresh());
    sheet.dataset.day = k;
    const temp = $('#d-temp', sheet);
    temp.addEventListener('change', () => {
      const v = parseFloat(temp.value.replace(',', '.'));
      const cur = Object.assign({}, data.days[k]);
      if (temp.value.trim() === '') delete cur.temp;
      else if (v >= 34 && v <= 42) cur.temp = v;
      else { toast('Escribe una temperatura entre 34 y 42 °C'); return; }
      setDay(k, cur); save();
    });
    let noteTimer = null;
    const note = $('#d-note', sheet);
    note.addEventListener('input', () => {
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => { const cur = Object.assign({}, data.days[k]); cur.note = note.value; setDay(k, cur); save(); }, 350);
    });
    note.addEventListener('blur', () => { const cur = Object.assign({}, data.days[k]); cur.note = note.value; setDay(k, cur); save(); });
  }

  function editDayFromSheet(btn, fn) {
    const sheet = btn.closest('.sheet');
    const k = sheet.dataset.day;
    const cur = Object.assign({}, data.days[k]);
    fn(cur);
    setDay(k, cur);
    save();
  }

  /* ---------- Regla: empezar, seguir, terminar ---------- */
  function openStart() {
    const t = todayNum();
    openSheet(`<h2>¿Cuándo le ha venido?</h2><p class="sub">Marca el primer día de sangrado, sin contar el manchado previo.</p>
      <div class="choice-list">
        <button class="btn btn-primary" data-action="start-on" data-n="${t}">Hoy</button>
        <button class="btn btn-secondary" data-action="start-on" data-n="${t - 1}">Ayer</button>
        <label class="field" style="margin:8px 0 0"><span>Otro día</span><input class="input" type="date" id="start-date" max="${toStr(t)}" min="${toStr(t - 120)}"></label>
        <button class="btn btn-secondary" data-action="start-on-date">Apuntar ese día</button>
      </div>`);
  }
  function startOn(n) {
    const t = todayNum();
    if (!(n <= t)) { toast('Elige un día de hoy hacia atrás'); return; }
    const k = toStr(n);
    const e = Object.assign({}, data.days[k]);
    if (!(e.flow >= 2)) e.flow = 3;
    setDay(k, e);
    if (data.settings.ended && toNum(data.settings.ended) >= n) data.settings.ended = null;
    save();
    closeSheet(true);
    refresh();
    toast(n === t ? 'Apuntado: le ha venido hoy' : `Apuntado: le vino el ${dDM(n)}`);
  }
  function continuePeriod() {
    const t = todayNum();
    const last = A.lastRun;
    const flow = Math.max(2, (data.days[toStr(last.end)] || {}).flow || 3);
    for (let n = last.end + 1; n <= t; n++) {
      const k = toStr(n);
      const e = Object.assign({}, data.days[k]);
      if (!(e.flow >= 2)) e.flow = flow;
      setDay(k, e);
    }
    save();
    refresh();
    toast(`Día ${t - last.start + 1} de regla apuntado`);
  }
  function endPeriod() {
    data.settings.ended = toStr(A.lastRun.end);
    save();
    refresh();
    toast(`Apuntada una regla de ${plural(A.lastRun.len, 'día', 'días')}`);
  }

  /* ---------- Copias de seguridad ---------- */
  function backupJSON() {
    return JSON.stringify({ app: 'marea', version: 1, exportedAt: new Date().toISOString(), data });
  }
  function markBackup() {
    data.settings.lastBackup = toStr(todayNum());
    save();
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  async function shareOrDownload(text, name, type) {
    const blob = new Blob([text], { type });
    let file = null;
    try { file = new File([blob], name, { type }); } catch (e) { /* Safari antiguo */ }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return 'shared'; }
      catch (err) { if (err && err.name === 'AbortError') return 'aborted'; }
    }
    download(blob, name);
    return 'downloaded';
  }

  function openExport() {
    openSheet(`<h2>Guardar una copia</h2>
      <p class="sub">Es un archivo pequeño con todo lo apuntado. Guárdalo en Archivos (iCloud Drive) o mándatelo por un chat o por email. Con él lo recuperas todo si cambias de iPhone o se borra la app.</p>
      <div class="stack"><button class="btn btn-primary" data-action="export-share">Guardar o compartir el archivo</button>
      <button class="btn btn-secondary" data-action="export-copy">Copiar como texto</button></div>
      <p class="help">«Copiar como texto» sirve para pegar la copia en una nota si no puedes guardar el archivo.</p>`);
  }
  async function exportShare() {
    const r = await shareOrDownload(backupJSON(), `marea-copia-${toStr(todayNum())}.json`, 'application/json');
    if (r === 'aborted') return;
    markBackup();
    closeSheet();
    toast(r === 'shared' ? 'Copia guardada' : 'Copia descargada');
  }
  async function exportCopy() {
    const txt = backupJSON();
    try {
      await navigator.clipboard.writeText(txt);
      markBackup();
      closeSheet();
      toast('Copia copiada. Pégala en una nota');
    } catch (e) {
      openSheet(`<h2>Copia como texto</h2><p class="sub">Selecciona todo el texto y cópialo.</p>
        <textarea class="input" readonly rows="8" id="copy-area">${esc(txt)}</textarea>
        <div class="stack"><button class="btn btn-secondary" data-action="close-sheet">Hecho</button></div>`, markBackup);
      const ta = $('#copy-area'); ta.focus(); ta.select();
    }
  }

  function openImport() {
    openSheet(`<h2>Recuperar una copia</h2>
      <p class="sub">Elige el archivo de la copia o pega su texto. Sustituirá lo que hay ahora en la app.</p>
      <label class="btn btn-primary" for="import-file">Elegir archivo</label>
      <input type="file" id="import-file" class="sr-only" accept="application/json,.json,text/plain">
      <label class="field" style="margin-top:18px"><span>O pega aquí el texto de la copia</span><textarea class="input" id="import-text" rows="4"></textarea></label>
      <button class="btn btn-secondary" data-action="import-text">Revisar la copia</button>`);
    $('#import-file').addEventListener('change', (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => reviewImport(String(r.result));
      r.onerror = () => toast('No se ha podido leer el archivo');
      r.readAsText(f);
    });
  }
  let pendingImport = null;
  function reviewImport(text) {
    let obj;
    try { obj = JSON.parse(text.trim()); } catch (e) { toast('Ese texto no es una copia de Marea'); return; }
    const raw = obj && obj.app === 'marea' ? obj.data : obj;
    if (!raw || typeof raw !== 'object' || !raw.days) { toast('Ese archivo no es una copia de Marea'); return; }
    const d = M.normalize(raw);
    d.settings.onboarded = true;
    const keys = Object.keys(d.days).sort();
    const runs = M.periodRuns(d.days);
    pendingImport = d;
    const span = keys.length ? ` (del ${dDMY(toNum(keys[0]))} al ${dDMY(toNum(keys[keys.length - 1]))})` : '';
    openSheet(`<h2>¿Sustituir los datos?</h2>
      <p class="sub">La copia tiene ${plural(runs.length, 'regla', 'reglas')} y ${plural(keys.length, 'día apuntado', 'días apuntados')}${span}. Lo que hay ahora en la app se sustituirá por la copia.</p>
      <div class="stack"><button class="btn btn-primary" data-action="import-confirm">Sustituir los datos</button>
      <button class="btn btn-quiet" data-action="close-sheet">Cancelar</button></div>`);
  }
  function confirmImport() {
    if (!pendingImport) return;
    try { localStorage.setItem(KEY + ':antes-de-recuperar', JSON.stringify(data)); } catch (e) { /* sin espacio: seguimos */ }
    data = pendingImport;
    pendingImport = null;
    ui.onb = null;
    save();
    closeSheet(true);
    refresh();
    toast('Copia recuperada');
  }

  function openICS() {
    if (!A || !A.hasData) { toast('Apunta al menos una regla para poder predecir'); return; }
    openSheet(`<h2>Añadir al Calendario</h2>
      <p class="sub">Crea un evento por cada una de las próximas 6 reglas previstas, con un aviso a las 9:00 dos días antes.</p>
      <label class="check"><input type="checkbox" id="ics-fert" ${data.settings.showFertile ? 'checked' : ''}> Incluir la ventana fértil</label>
      <div class="stack"><button class="btn btn-primary" data-action="ics-go">Crear archivo de calendario</button></div>
      <p class="help">Si en el menú no aparece Calendario, elige «Guardar en Archivos» y abre el archivo desde la app Archivos para añadir los eventos. Las predicciones cambian con cada regla, así que conviene repetirlo de vez en cuando. Truco: crea en Calendario un calendario llamado Marea y añádelos ahí; así los borras de golpe antes de importar los nuevos.</p>`);
  }
  async function icsGo() {
    const fert = $('#ics-fert') && $('#ics-fert').checked;
    const ics = M.buildICS(data, A, { count: 6, fertile: fert });
    const r = await shareOrDownload(ics, 'marea-reglas-previstas.ics', 'text/calendar');
    if (r !== 'aborted') { closeSheet(); toast('Archivo de calendario creado'); }
  }

  function openWipe() {
    openSheet(`<h2>Borrar todos los datos</h2>
      <p class="sub">Se borrarán todas las reglas, síntomas y notas de esta app. No se puede deshacer.</p>
      <div class="stack"><button class="btn btn-secondary" data-action="export">Guardar antes una copia</button>
      <button class="btn btn-danger" data-action="wipe-confirm">Borrar todo</button></div>`);
  }
  function wipe() {
    try { localStorage.removeItem(KEY); } catch (e) { /* nada */ }
    data = M.emptyData();
    ui.tab = 'hoy';
    ui.onb = null;
    closeSheet(true);
    refresh();
    toast('Datos borrados');
  }

  /* ---------- Bienvenida ---------- */
  function onbMark() {
    let c = '';
    for (let i = 0; i < 28; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 28;
      const fill = i < 5 ? 'var(--sangre)' : i >= 9 && i <= 14 ? (i === 13 ? 'var(--luna)' : 'var(--mar)') : 'var(--vino-3)';
      c += `<circle cx="${(46 + 40 * Math.cos(a)).toFixed(2)}" cy="${(46 + 40 * Math.sin(a)).toFixed(2)}" r="${i === 13 ? 3.6 : 2.7}" style="fill:${fill}"/>`;
    }
    return `<svg class="onb-mark" viewBox="0 0 92 92" aria-hidden="true">${c}</svg>`;
  }
  function renderOnboarding() {
    const root = $('#onb-root');
    if (data.settings.onboarded) { root.innerHTML = ''; return; }
    if (!ui.onb) ui.onb = { name: '', start: '', unknown: false, periodLen: 5, cycleLen: 28 };
    if ($('.onb', root)) return; // ya pintada; se actualiza en sitio
    const o = ui.onb;
    const t = todayNum();
    const install = isIOS() && !isStandalone()
      ? `<div class="notice notice-warn" style="margin-bottom:24px"><p><strong>Antes de empezar, instálala.</strong> Pulsa Compartir y luego «Añadir a pantalla de inicio». Después abre Marea desde ese icono y empieza allí: lo que apuntes en Safari no pasa a la app instalada y Safari puede borrarlo si no entras en una semana.</p></div>`
      : '';
    root.innerHTML = `<div class="onb"><div class="onb-inner">
      ${onbMark()}<h1>Marea</h1>
      <p class="lead">Para llevar la cuenta del ciclo de tu novia. Todo se guarda en este iPhone: sin cuentas ni servidores.</p>
      ${install}
      <label class="field"><span>Cómo se llama</span><input class="input" id="onb-name" type="text" maxlength="40" autocomplete="off" placeholder="Opcional" value="${esc(o.name)}"></label>
      <label class="field"><span>Cuándo empezó su última regla</span><input class="input" id="onb-start" type="date" max="${toStr(t)}" min="${toStr(t - 120)}" value="${o.start}"></label>
      <label class="check"><input type="checkbox" id="onb-unknown" ${o.unknown ? 'checked' : ''}> No lo sé, lo apuntaré cuando le venga</label>
      <div class="row-set" style="margin-top:14px">
        <div class="set-row"><span class="lbl">Cuántos días le suele durar</span>${stepper('periodLen', o.periodLen, 'onb-step')}</div>
        <div class="set-row"><span class="lbl">Cada cuántos días le viene<small>Si no lo sabes, deja 28</small></span>${stepper('cycleLen', o.cycleLen, 'onb-step')}</div>
      </div>
      <div class="stack" style="margin-top:26px"><button class="btn btn-primary" data-action="onb-go">Empezar</button>
      <button class="btn btn-quiet" data-action="import">Tengo una copia de seguridad</button></div>
    </div></div>`;
    $('#onb-name').addEventListener('input', (e) => { o.name = e.target.value; });
    $('#onb-start').addEventListener('change', (e) => { o.start = e.target.value; if (o.start) { o.unknown = false; $('#onb-unknown').checked = false; } });
    $('#onb-unknown').addEventListener('change', (e) => { o.unknown = e.target.checked; if (o.unknown) { o.start = ''; $('#onb-start').value = ''; } });
  }
  function onbGo() {
    const o = ui.onb;
    const t = todayNum();
    if (!o.unknown && !M.isDateStr(o.start)) { toast('Indica cuándo empezó o marca «No lo sé»'); return; }
    const s = data.settings;
    s.name = o.name.trim().slice(0, 40);
    s.periodLen = o.periodLen;
    s.cycleLen = o.cycleLen;
    if (!o.unknown) {
      const st = toNum(o.start);
      if (st > t || st < t - 120) { toast('Elige una fecha de los últimos cuatro meses'); return; }
      const end = Math.min(t, st + o.periodLen - 1);
      for (let n = st; n <= end; n++) setDay(toStr(n), Object.assign({}, data.days[toStr(n)], { flow: 3 }));
      if (t - st >= o.periodLen) s.ended = toStr(end);
    }
    s.onboarded = true;
    ui.onb = null;
    save();
    refresh();
    if (!o.unknown && t - toNum(o.start) >= o.periodLen) toast(`Marcados ${o.periodLen} días de regla. Puedes corregirlos en el calendario`);
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    const n = el.dataset.n !== undefined ? Number(el.dataset.n) : null;
    switch (a) {
      case 'tab':
        ui.tab = el.dataset.tab; ui.editMode = false;
        $('#screen').scrollTop = 0;
        render(); break;
      case 'open-start': openStart(); break;
      case 'start-on': startOn(n); break;
      case 'start-on-date': {
        const v = $('#start-date').value;
        if (!M.isDateStr(v)) { toast('Elige una fecha'); return; }
        startOn(toNum(v)); break;
      }
      case 'continue-period': continuePeriod(); break;
      case 'end-period': endPeriod(); break;
      case 'undo-end': data.settings.ended = null; save(); refresh(); break;
      case 'open-day': openDay(n); break;
      case 'day': if (ui.editMode) togglePeriodDay(n); else openDay(n); break;
      case 'month': shiftMonth(Number(el.dataset.d)); break;
      case 'month-today': ui.month = null; render(); break;
      case 'edit-mode': ui.editMode = !ui.editMode; render(); break;
      case 'close-sheet': closeSheet(); break;
      case 'd-flow':
        editDayFromSheet(el, (c) => { c.flow = Number(el.dataset.v); });
        el.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
        break;
      case 'd-sex':
        editDayFromSheet(el, (c) => { c.sex = Number(el.dataset.v); });
        el.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
        break;
      case 'd-sym': case 'd-mood': {
        const field = a === 'd-sym' ? 'sym' : 'mood';
        const on = el.getAttribute('aria-pressed') !== 'true';
        editDayFromSheet(el, (c) => {
          const set = new Set(c[field] || []);
          if (on) set.add(el.dataset.id); else set.delete(el.dataset.id);
          c[field] = [...set];
        });
        el.setAttribute('aria-pressed', String(on));
        break;
      }
      case 'step': {
        const key = el.dataset.key;
        const [lo, hi] = LIMITS[key];
        data.settings[key] = Math.min(hi, Math.max(lo, data.settings[key] + Number(el.dataset.d)));
        $('#out-' + key).textContent = data.settings[key];
        save(); A = M.analyze(data, todayNum());
        break;
      }
      case 'onb-step': {
        const key = el.dataset.key;
        const [lo, hi] = LIMITS[key];
        ui.onb[key] = Math.min(hi, Math.max(lo, ui.onb[key] + Number(el.dataset.d)));
        $('#out-' + key).textContent = ui.onb[key];
        break;
      }
      case 'onb-go': onbGo(); break;
      case 'export': openExport(); break;
      case 'export-share': exportShare(); break;
      case 'export-copy': exportCopy(); break;
      case 'import': openImport(); break;
      case 'import-text': reviewImport($('#import-text').value); break;
      case 'import-confirm': confirmImport(); break;
      case 'ics': openICS(); break;
      case 'ics-go': icsGo(); break;
      case 'wipe': openWipe(); break;
      case 'wipe-confirm': wipe(); break;
    }
  });

  document.addEventListener('change', (ev) => {
    const key = ev.target.dataset && ev.target.dataset.setting;
    if (!key) return;
    data.settings[key] = ev.target.checked;
    save();
    A = M.analyze(data, todayNum());
  });
  let nameTimer = null;
  document.addEventListener('input', (ev) => {
    if (ev.target.id !== 'set-name') return;
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => { data.settings.name = ev.target.value.trim().slice(0, 40); save(); }, 300);
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeSheet(); });

  // Si la app se queda abierta y cambia el día, o vuelve del segundo plano
  let lastDay = todayNum();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (todayNum() !== lastDay) { lastDay = todayNum(); if (!$('.sheet')) refresh(); }
  });

  /* ---------- Arranque ---------- */
  if (!storageOk) {
    setTimeout(() => toast('Este navegador no deja guardar datos. Sal del modo privado.'), 600);
  }
  refresh();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
