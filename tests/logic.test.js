const assert = require('assert');
const M = require('../logic.js');
const { toNum, toStr } = M;

let passed = 0;
function t(name, fn) { try { fn(); passed++; } catch (e) { console.error('FALLA:', name, '\n ', e.message); process.exitCode = 1; } }

function mk(periods, settings) {
  const d = M.emptyData();
  Object.assign(d.settings, { onboarded: true }, settings || {});
  for (const [start, len] of periods) for (let i = 0; i < len; i++) d.days[toStr(toNum(start) + i)] = { flow: 3 };
  return d;
}

t('fechas ida y vuelta, incluido cambio de hora', () => {
  for (const s of ['2026-03-29', '2026-10-25', '2024-02-29', '2026-12-31']) assert.strictEqual(toStr(toNum(s)), s);
  assert.strictEqual(M.isDateStr('2026-02-31'), false);
  assert.strictEqual(M.todayNum(new Date(2026, 10, 11, 23, 59)), toNum('2026-11-11'));
  assert.strictEqual(M.todayNum(new Date(2026, 10, 11, 0, 1)), toNum('2026-11-11'));
});

t('agrupa reglas y tolera un día sin marcar', () => {
  const d = mk([['2026-10-01', 3]]);
  d.days['2026-10-05'] = { flow: 2 }; // hueco el día 4
  const runs = M.periodRuns(d.days);
  assert.strictEqual(runs.length, 1);
  assert.strictEqual(runs[0].len, 5);
  d.days['2026-10-09'] = { flow: 2 }; // hueco de 3 días: otra regla
  assert.strictEqual(M.periodRuns(d.days).length, 2);
});

t('el manchado no cuenta como regla', () => {
  const d = mk([]);
  d.days['2026-10-01'] = { flow: 1 };
  assert.strictEqual(M.periodRuns(d.days).length, 0);
});

t('media con pocos ciclos se mezcla con el valor inicial', () => {
  assert.strictEqual(M.blend([], 28), 28);
  assert.strictEqual(M.blend([34], 28), 30); // (34+28+28)/3
  assert.strictEqual(M.blend([30, 30, 30], 28), 30);
});

t('predicción con ciclos regulares de 30 días', () => {
  const d = mk([['2026-07-01', 5], ['2026-07-31', 5], ['2026-08-30', 5], ['2026-09-29', 5], ['2026-10-29', 5]]);
  d.settings.ended = '2026-11-02';
  const A = M.analyze(d, toNum('2026-11-11'));
  assert.strictEqual(A.avgCycle, 30);
  assert.strictEqual(A.avgPeriod, 5);
  assert.strictEqual(toStr(A.nextStart), '2026-11-28');
  assert.strictEqual(A.cycleDay, 14);
  assert.strictEqual(toStr(A.ov), '2026-11-14');
  assert.strictEqual(A.phase, 'fertil');
  assert.strictEqual(A.variation, 0);
  assert.strictEqual(A.late, 0);
  assert.ok(A.predicted.has(toNum('2026-11-28')));
  assert.ok(A.predicted.has(toNum('2026-12-02')));
  assert.ok(!A.predicted.has(toNum('2026-12-03')));
  assert.ok(A.ovDays.has(toNum('2026-11-14')));
});

t('ovulación y fases', () => {
  const d = mk([['2026-10-01', 5], ['2026-10-29', 5]]);
  d.settings.ended = '2026-11-02';
  const A = M.analyze(d, toNum('2026-11-11'));
  // 1 ciclo de 28 + valor inicial 28 => 28
  assert.strictEqual(A.avgCycle, 28);
  assert.strictEqual(toStr(A.ov), '2026-11-12');
  assert.strictEqual(M.phaseOf(A, d, toNum('2026-11-12')), 'ovulacion');
  assert.strictEqual(M.phaseOf(A, d, toNum('2026-11-04')), 'folicular');
  assert.strictEqual(M.phaseOf(A, d, toNum('2026-11-20')), 'lutea');
  assert.strictEqual(M.phaseOf(A, d, toNum('2026-11-23')), 'premenstrual');
  assert.strictEqual(M.phaseOf(A, d, toNum('2026-10-30')), 'regla');
});

t('retraso', () => {
  const d = mk([['2026-09-01', 5], ['2026-09-29', 5]]);
  d.settings.ended = '2026-10-03';
  const A = M.analyze(d, toNum('2026-11-01'));
  assert.strictEqual(toStr(A.nextStart), '2026-10-27');
  assert.strictEqual(A.late, 5);
  assert.strictEqual(A.phase, 'retraso');
  assert.strictEqual(toStr(A.projections[0].start), '2026-11-01');
});

t('regla en curso hoy', () => {
  const d = mk([['2026-10-01', 5], ['2026-11-10', 2]]);
  const A = M.analyze(d, toNum('2026-11-11'));
  assert.strictEqual(A.inPeriodToday, true);
  assert.strictEqual(A.awaiting, false);
  assert.strictEqual(A.cycleDay, 2);
  assert.strictEqual(A.phase, 'regla');
  assert.ok(A.predicted.has(toNum('2026-11-12')), 'días que faltan de regla salen como previstos');
  assert.strictEqual(A.avgPeriod, 5, 'la regla en curso no cuenta para la media');
});

t('pregunta si sigue cuando no se ha apuntado hoy', () => {
  const d = mk([['2026-10-01', 5], ['2026-11-08', 1]]);
  const A = M.analyze(d, toNum('2026-11-11'));
  assert.strictEqual(A.awaiting, true);
  assert.strictEqual(A.phase, 'regla');
  d.settings.ended = '2026-11-08';
  const B = M.analyze(d, toNum('2026-11-11'));
  assert.strictEqual(B.awaiting, false);
  assert.strictEqual(B.inPeriod, false);
});

t('no pregunta si la última regla apuntada queda lejos', () => {
  const d = mk([['2026-10-01', 5], ['2026-11-03', 3]]);
  const A = M.analyze(d, toNum('2026-11-11'));
  assert.strictEqual(A.awaiting, false);
  const B = M.analyze(mk([['2026-10-01', 5], ['2026-11-07', 1]]), toNum('2026-11-11'));
  assert.strictEqual(B.awaiting, true, 'apuntó el primer día y no abrió la app en 4 días');
});

t('no pregunta si ya tiene los días de siempre', () => {
  const d = mk([['2026-10-01', 5], ['2026-11-04', 5]]);
  const A = M.analyze(d, toNum('2026-11-11'));
  assert.strictEqual(A.awaiting, false);
});

t('variación e irregularidad', () => {
  const d = mk([['2026-01-01', 4], ['2026-01-26', 4], ['2026-03-05', 4], ['2026-04-01', 4], ['2026-05-10', 4]]);
  d.settings.ended = '2026-05-13';
  const A = M.analyze(d, toNum('2026-05-20'));
  assert.deepStrictEqual(A.cycles.map((c) => c.len), [25, 38, 27, 39]);
  assert.strictEqual(A.variation, 14);
  assert.ok(A.sd > 6);
});

t('ciclos fuera de rango no cuentan para la media', () => {
  const d = mk([['2026-01-01', 4], ['2026-04-15', 4], ['2026-05-13', 4], ['2026-06-10', 4]]);
  const A = M.analyze(d, toNum('2026-06-20'));
  assert.strictEqual(A.cycles[0].len, 104);
  assert.strictEqual(A.avgCycle, 28);
});

t('patrones de síntomas por fechas', () => {
  const d = mk([['2026-07-01', 5], ['2026-07-29', 5], ['2026-08-26', 5], ['2026-09-23', 5], ['2026-10-21', 5]]);
  d.settings.ended = '2026-10-25';
  // 3 días antes de cada regla: hinchazón
  for (const s of ['2026-07-26', '2026-08-23', '2026-09-20']) d.days[s] = { sym: ['hinchazon'], mood: ['irritable'] };
  const A = M.analyze(d, toNum('2026-11-15')); // próxima: 18 nov, faltan 3
  const p = M.patternsNow(d, A);
  assert.ok(p.find((x) => x.id === 'hinchazon' && x.cycles === 3), JSON.stringify(p));
  const sum = M.symptomSummary(d, A);
  assert.strictEqual(sum[0].id, 'hinchazon');
  assert.match(sum[0].when, /3 días antes/);
});

t('normalize limpia basura y respeta datos válidos', () => {
  const d = M.normalize({ settings: { name: '  Laura ', cycleLen: 999, showFertile: false }, days: {
    '2026-11-01': { flow: 3, sym: ['colicos', 'inventado'], note: ' hola ' },
    'no-fecha': { flow: 3 },
    '2026-11-02': { flow: 0 },
  } });
  assert.strictEqual(d.settings.name, 'Laura');
  assert.strictEqual(d.settings.cycleLen, 60);
  assert.strictEqual(d.settings.showFertile, false);
  assert.deepStrictEqual(Object.keys(d.days), ['2026-11-01']);
  assert.deepStrictEqual(d.days['2026-11-01'].sym, ['colicos']);
});

t('ics bien formado', () => {
  const d = mk([['2026-10-01', 5], ['2026-10-29', 5]], { name: 'Laura' });
  d.settings.ended = '2026-11-02';
  const A = M.analyze(d, toNum('2026-11-11'));
  const ics = M.buildICS(d, A, { count: 2, fertile: true });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.strictEqual((ics.match(/BEGIN:VEVENT/g) || []).length, 4);
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261126'));
  assert.ok(ics.includes('DTEND;VALUE=DATE:20261201'));
  assert.ok(ics.includes('SUMMARY:Regla prevista de Laura'));
});

console.log(`${passed} pruebas correctas`);
