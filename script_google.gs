// Script Google (Apps Script) — cours en direct + historique, via Yahoo Finance
//   ?t=ORA.PA,AI.PA                      -> {"ORA.PA":{"p":cours,"pc":clôture veille}, ...}
//   ?h=ORA.PA,^FCHI&from=2021-10-01      -> {"ORA.PA":{"d":["2021-10-01",...],"c":[9.4,...]}, ...}

const UA = { 'User-Agent': 'Mozilla/5.0' };

function doGet(e) {
  const q = (e && e.parameter) || {};
  const out = q.h ? history_(q.h.split(','), q.from) : quotes_((q.t || '').split(','));
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function fetchAll_(tks, qs) {
  const reqs = tks.map(t => ({
    url: 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(t) + '?' + qs,
    headers: UA,
    muteHttpExceptions: true
  }));
  return UrlFetchApp.fetchAll(reqs).map(r => {
    try { return JSON.parse(r.getContentText()).chart.result[0]; } catch (err) { return null; }
  });
}

function quotes_(tks) {
  tks = tks.filter(String);
  const out = {};
  fetchAll_(tks, 'range=5d&interval=1d').forEach((r, i) => {
    if (!r) return;
    const c = r.indicators.quote[0].close.filter(x => x != null);
    const p = r.meta.regularMarketPrice || c[c.length - 1];
    out[tks[i]] = { p: p, pc: c.length > 1 ? c[c.length - 2] : p };
  });
  return out;
}

function history_(tks, from) {
  tks = tks.filter(String);
  const t1 = Math.floor(new Date((from || '2015-01-01') + 'T00:00:00Z').getTime() / 1000) - 7 * 86400;
  const t2 = Math.floor(Date.now() / 1000) + 86400;
  const cache = CacheService.getScriptCache();
  const out = {}, miss = [];
  tks.forEach(t => {
    const v = cache.get('h|' + t + '|' + (from || ''));
    if (v) out[t] = JSON.parse(v); else miss.push(t);
  });
  fetchAll_(miss, 'period1=' + t1 + '&period2=' + t2 + '&interval=1d').forEach((r, i) => {
    if (!r || !r.timestamp) return;
    const c = r.indicators.quote[0].close, d = [], v = [];
    r.timestamp.forEach((s, j) => {
      if (c[j] != null) {
        d.push(new Date(s * 1000).toISOString().slice(0, 10));
        v.push(Math.round(c[j] * 10000) / 10000);
      }
    });
    out[miss[i]] = { d: d, c: v };
    try { cache.put('h|' + miss[i] + '|' + (from || ''), JSON.stringify(out[miss[i]]), 21600); } catch (err) {}
  });
  return out;
}
