/* Marea: lógica del ciclo, sin nada de interfaz.
   Las fechas se manejan como "número de día" (días desde 1970-01-01 en UTC)
   para que los cambios de hora y las zonas horarias no muevan nada. */
(function (root) {
  'use strict';

  const DAY_MS = 86400000;
  const pad = (n) => String(n).padStart(2, '0');

  function toNum(s) {
    const [y, m, d] = s.split('-').map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
  }
  function toStr(n) {
    const t = new Date(n * DAY_MS);
    return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
  }
  function isDateStr(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && toStr(toNum(s)) === s;
  }
  function todayNum(now) {
    now = now || new Date();
    return Math.round(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
  }
  const numToDate = (n) => new Date(n * DAY_MS); // formatear siempre con timeZone: 'UTC'
  function clampInt(v, lo, hi, def) {
    v = Math.round(Number(v));
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def;
  }

  /* ---------- Catálogo ---------- */
  const FLOW = ['Nada', 'Manchado', 'Ligero', 'Medio', 'Abundante'];
  const SYMPTOMS = [
    ['colicos', 'Dolor menstrual'], ['cabeza', 'Dolor de cabeza'], ['lumbar', 'Dolor lumbar'],
    ['hinchazon', 'Hinchazón'], ['pecho', 'Pecho sensible'], ['granitos', 'Granitos'],
    ['cansancio', 'Cansancio'], ['nauseas', 'Náuseas'], ['digestion', 'Molestias digestivas'],
    ['antojos', 'Antojos'], ['insomnio', 'Duerme mal'], ['analgesico', 'Ha tomado analgésico'],
  ];
  const MOODS = [
    ['bien', 'Bien'], ['contenta', 'Contenta'], ['energia', 'Con energía'], ['carinosa', 'Cariñosa'],
    ['sensible', 'Sensible'], ['irritable', 'Irritable'], ['ansiosa', 'Ansiosa'], ['triste', 'Triste'],
    ['sinenergia', 'Sin energía'],
  ];
  const SEX = ['No', 'Con protección', 'Sin protección'];
  const SYM_IDS = new Set(SYMPTOMS.map((x) => x[0]));
  const MOOD_IDS = new Set(MOODS.map((x) => x[0]));
  const LABELS = Object.fromEntries([...SYMPTOMS, ...MOODS]);

  /* ---------- Datos ---------- */
  const DEFAULTS = {
    name: '', cycleLen: 28, periodLen: 5, luteal: 14,
    showFertile: true, showTips: true, onboarded: false,
    lastBackup: null, ended: null,
  };
  const emptyData = () => ({ v: 1, settings: { ...DEFAULTS }, days: {} });

  function cleanDay(e) {
    if (!e || typeof e !== 'object') return null;
    const o = {};
    const flow = clampInt(e.flow, 0, 4, 0);
    if (flow) o.flow = flow;
    if (Array.isArray(e.sym)) {
      const a = [...new Set(e.sym.filter((x) => SYM_IDS.has(x)))];
      if (a.length) o.sym = a;
    }
    if (Array.isArray(e.mood)) {
      const a = [...new Set(e.mood.filter((x) => MOOD_IDS.has(x)))];
      if (a.length) o.mood = a;
    }
    const sex = clampInt(e.sex, 0, 2, 0);
    if (sex) o.sex = sex;
    if (typeof e.temp === 'number' && e.temp >= 34 && e.temp <= 42) o.temp = Math.round(e.temp * 100) / 100;
    if (typeof e.note === 'string' && e.note.trim()) o.note = e.note.slice(0, 2000);
    return Object.keys(o).length ? o : null;
  }

  function normalize(raw) {
    const d = emptyData();
    if (!raw || typeof raw !== 'object') return d;
    const s = raw.settings || {};
    d.settings.name = typeof s.name === 'string' ? s.name.trim().slice(0, 40) : '';
    d.settings.cycleLen = clampInt(s.cycleLen, 18, 60, 28);
    d.settings.periodLen = clampInt(s.periodLen, 1, 12, 5);
    d.settings.luteal = clampInt(s.luteal, 9, 17, 14);
    d.settings.showFertile = s.showFertile !== false;
    d.settings.showTips = s.showTips !== false;
    d.settings.onboarded = s.onboarded === true;
    d.settings.lastBackup = isDateStr(s.lastBackup) ? s.lastBackup : null;
    d.settings.ended = isDateStr(s.ended) ? s.ended : null;
    const days = raw.days && typeof raw.days === 'object' ? raw.days : {};
    for (const k of Object.keys(days)) {
      if (!isDateStr(k)) continue;
      const e = cleanDay(days[k]);
      if (e) d.days[k] = e;
    }
    return d;
  }

  /* ---------- Cálculos ---------- */

  // Días con regla (flujo ligero o más) agrupados en reglas. Un día suelto sin
  // marcar en medio (p. ej. se le olvidó apuntarlo) no parte la regla en dos.
  function periodRuns(days) {
    const nums = Object.keys(days).filter((k) => days[k].flow >= 2).map(toNum).sort((a, b) => a - b);
    const runs = [];
    for (const n of nums) {
      const last = runs[runs.length - 1];
      if (last && n - last.end <= 2) last.end = n;
      else runs.push({ start: n, end: n });
    }
    runs.forEach((r) => { r.len = r.end - r.start + 1; });
    return runs;
  }

  // Con menos de 3 valores mezcla con el valor que se indicó al empezar,
  // para que un único ciclo raro no descoloque las predicciones.
  function blend(values, prior, k) {
    k = k || 3;
    if (!values.length) return prior;
    const sum = values.reduce((a, b) => a + b, 0);
    const n = values.length;
    return n >= k ? Math.round(sum / n) : Math.round((sum + prior * (k - n)) / k);
  }
  function stdev(a) {
    const m = a.reduce((x, y) => x + y, 0) / a.length;
    return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / a.length);
  }
  const median = (a) => {
    const b = [...a].sort((x, y) => x - y);
    const i = Math.floor(b.length / 2);
    return b.length % 2 ? b[i] : Math.round((b[i - 1] + b[i]) / 2);
  };

  function analyze(data, today) {
    const s = data.settings;
    const runs = periodRuns(data.days);
    const A = { today, runs, hasData: runs.length > 0, cycles: [], cycleCount: 0 };
    if (!A.hasData) return A;

    for (let i = 0; i < runs.length - 1; i++) {
      A.cycles.push({ start: runs[i].start, len: runs[i + 1].start - runs[i].start, periodLen: runs[i].len });
    }
    const valid = A.cycles.filter((c) => c.len >= 15 && c.len <= 60);
    const recent = valid.slice(-6).map((c) => c.len);
    A.cycleCount = valid.length;
    A.avgCycle = blend(recent, s.cycleLen);
    if (recent.length >= 3) {
      A.variation = Math.max(...recent) - Math.min(...recent);
      A.sd = stdev(recent);
    }

    const last = runs[runs.length - 1];
    const endedNum = s.ended ? toNum(s.ended) : null;
    const lastEnded = endedNum !== null && endedNum >= last.end;
    const lastMaybeOpen = !lastEnded && today - last.start <= 9;
    const lens = (lastMaybeOpen ? runs.slice(0, -1) : runs).map((r) => r.len).slice(-6);
    A.avgPeriod = Math.max(1, Math.min(blend(lens, s.periodLen), A.avgCycle - 5));

    A.inPeriodToday = last.end === today;
    // Hay regla apuntada hace poco, menos días de lo normal y nadie ha dicho que terminó:
    // preguntamos si sigue en vez de dar por hecho que duró un solo día.
    A.awaiting = !A.inPeriodToday && lastMaybeOpen && today > last.end &&
      today - last.end <= A.avgPeriod && last.len < A.avgPeriod;
    A.inPeriod = A.inPeriodToday || A.awaiting;
    A.lastRun = last;
    A.lastEnded = lastEnded;

    A.curStart = last.start;
    A.cycleDay = today - last.start + 1;
    A.nextStart = last.start + A.avgCycle;
    A.daysUntil = A.nextStart - today;
    A.late = !A.inPeriod && A.daysUntil < 0 ? -A.daysUntil : 0;
    A.ov = A.nextStart - s.luteal;
    A.fertStart = A.ov - 5;
    A.fertEnd = A.ov + 1;

    // Ciclos futuros (un año). Si va con retraso, se calculan desde hoy.
    const anchor = A.late ? today : A.nextStart;
    A.projections = [];
    for (let k = 0; k < 13; k++) {
      const st = anchor + k * A.avgCycle;
      const ov = st + A.avgCycle - s.luteal;
      A.projections.push({ start: st, end: st + A.avgPeriod - 1, ov, fertStart: ov - 5, fertEnd: ov + 1 });
    }

    A.predicted = new Set();
    A.fertile = new Set();
    A.ovDays = new Set();
    if (A.inPeriod) {
      for (let n = Math.max(today, last.end) + 1; n <= last.start + A.avgPeriod - 1; n++) A.predicted.add(n);
    }
    for (const p of A.projections) {
      for (let n = p.start; n <= p.end; n++) if (n >= today) A.predicted.add(n);
    }
    const windows = [{ ov: A.ov, fertStart: A.fertStart, fertEnd: A.fertEnd }, ...A.projections];
    for (const w of windows) {
      for (let n = w.fertStart; n <= w.fertEnd; n++) A.fertile.add(n);
      A.ovDays.add(w.ov);
    }
    A.phase = phaseOf(A, data, today);
    return A;
  }

  // Fase de un día dentro del ciclo actual.
  function phaseOf(A, data, n) {
    const e = data.days[toStr(n)];
    if (e && e.flow >= 2) return 'regla';
    if (n === A.today && A.awaiting) return 'regla';
    if (A.late && n >= A.nextStart) return 'retraso';
    if (n >= A.fertStart && n <= A.fertEnd) return n === A.ov ? 'ovulacion' : 'fertil';
    if (n < A.fertStart) return 'folicular';
    return A.nextStart - n <= 5 ? 'premenstrual' : 'lutea';
  }

  // Lo que registró en otros ciclos por estas mismas fechas.
  // Al principio del ciclo se compara por día del ciclo; después, por días que faltan para la regla.
  function patternsNow(data, A) {
    if (!A.hasData || A.late || A.runs.length < 3) return [];
    const byCycleDay = A.cycleDay <= 10;
    const curBefore = A.nextStart - A.today;
    const counts = new Map();
    for (let i = 0; i < A.runs.length - 1; i++) {
      const S = A.runs[i].start;
      const N = A.runs[i + 1].start;
      if (N - S > 60) continue;
      const seen = new Set();
      for (let n = S; n < N; n++) {
        const e = data.days[toStr(n)];
        if (!e) continue;
        const near = byCycleDay ? Math.abs(n - S + 1 - A.cycleDay) <= 1 : Math.abs(N - n - curBefore) <= 1;
        if (!near) continue;
        (e.sym || []).forEach((t) => seen.add(t));
        (e.mood || []).forEach((t) => seen.add(t));
      }
      seen.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1));
    }
    return [...counts].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, cycles]) => ({ id, label: LABELS[id], cycles }));
  }

  // Síntomas más frecuentes y en qué momento del ciclo suelen salir.
  function symptomSummary(data, A) {
    if (!A.hasData) return [];
    const agg = new Map();
    for (const k of Object.keys(data.days)) {
      const e = data.days[k];
      if (!e.sym) continue;
      const n = toNum(k);
      let i = -1;
      for (let j = A.runs.length - 1; j >= 0; j--) if (A.runs[j].start <= n) { i = j; break; }
      if (i < 0) continue;
      const S = A.runs[i].start;
      const N = i + 1 < A.runs.length ? A.runs[i + 1].start : null;
      for (const t of e.sym) {
        if (t === 'analgesico') continue;
        const a = agg.get(t) || { id: t, label: LABELS[t], days: 0, cds: [], befores: [] };
        a.days++;
        a.cds.push(n - S + 1);
        if (N !== null) a.befores.push(N - n);
        agg.set(t, a);
      }
    }
    return [...agg.values()].sort((a, b) => b.days - a.days).slice(0, 6).map((a) => {
      const cd = median(a.cds);
      let when;
      if (cd <= 7) when = cd <= 2 ? 'Suele aparecer al empezar la regla' : `Suele aparecer hacia el día ${cd} del ciclo`;
      else if (a.befores.length >= 2 && median(a.befores) <= 10) {
        const b = median(a.befores);
        when = b <= 1 ? 'Suele aparecer justo antes de la regla' : `Suele aparecer unos ${b} días antes de la regla`;
      } else when = `Suele aparecer hacia el día ${cd} del ciclo`;
      return { id: a.id, label: a.label, days: a.days, when };
    });
  }

  /* ---------- Calendario (.ics) ---------- */
  function icsDate(n) { return toStr(n).replace(/-/g, ''); }
  function icsEscape(t) { return String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  function buildICS(data, A, opts) {
    opts = opts || {};
    const count = opts.count || 6;
    const name = data.settings.name;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Marea//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Marea'];
    A.projections.slice(0, count).forEach((p) => {
      L.push('BEGIN:VEVENT', `UID:marea-regla-${icsDate(p.start)}@marea.local`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${icsDate(p.start)}`, `DTEND;VALUE=DATE:${icsDate(p.end + 1)}`,
        'SUMMARY:' + icsEscape(name ? `Regla prevista de ${name}` : 'Regla prevista'),
        'DESCRIPTION:' + icsEscape('Estimación hecha con Marea. Puede adelantarse o retrasarse unos días.'),
        'TRANSP:TRANSPARENT',
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P1DT15H', // a las 9:00, dos días antes
        'DESCRIPTION:' + icsEscape('La regla podría llegar en 2 días'), 'END:VALARM',
        'END:VEVENT');
      if (opts.fertile) {
        L.push('BEGIN:VEVENT', `UID:marea-fertil-${icsDate(p.fertStart)}@marea.local`, `DTSTAMP:${stamp}`,
          `DTSTART;VALUE=DATE:${icsDate(p.fertStart)}`, `DTEND;VALUE=DATE:${icsDate(p.fertEnd + 1)}`,
          'SUMMARY:' + icsEscape('Ventana fértil estimada'),
          'DESCRIPTION:' + icsEscape('Estimación por calendario. No sirve como método anticonceptivo.'),
          'TRANSP:TRANSPARENT', 'END:VEVENT');
      }
    });
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }

  const api = {
    DAY_MS, toNum, toStr, isDateStr, todayNum, numToDate, clampInt,
    FLOW, SYMPTOMS, MOODS, SEX, LABELS, DEFAULTS,
    emptyData, normalize, cleanDay, periodRuns, blend, analyze, phaseOf,
    patternsNow, symptomSummary, buildICS,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Marea = api;
})(typeof self !== 'undefined' ? self : this);
