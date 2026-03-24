function normServer(s) {
  const m = String(s || '').trim().toLowerCase();
  const map = {
    'icecrown': 'Icecrown',
    'lordaeron': 'Lordaeron',
    'frostmourne': 'Frostmourne',
    'blackrock': 'Blackrock'
  };
  return map[m] || (m ? m[0].toUpperCase() + m.slice(1) : '');
}
function normName(n) {
  return String(n || '').replace(/\s+/g, '').trim();
}
function titleCaseName(n) {
  const t = normName(n);
  if (!t) return t;
  return t[0].toUpperCase() + t.slice(1).toLowerCase();
}

async function postCharacter(body) {
  const res = await fetch('https://uwu-logs.xyz/character', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'WarmoryBot/1.0 (+uwu-logs)',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    body: JSON.stringify(body)
  });
  return res;
}

export async function scrapeUwULogs({ name, server, spec }) {
  let effectiveSpec = spec ? Number(spec) : undefined;
  const serverCandidates = [server, normServer(server)];
  const nameCandidates = [name, normName(name), titleCaseName(name), titleCaseName(normName(name))].filter(Boolean);

  let res = null;
  let usedName = name;
  let usedServer = server;

  outer:
  for (const srv of serverCandidates) {
    for (const nm of nameCandidates) {
      // try with provided spec or undefined
      const attempts = [
        { name: nm, server: srv, spec: effectiveSpec },
        { name: nm, server: srv, spec: effectiveSpec ? undefined : undefined }, // same as undefined, explicit for clarity
      ];
      for (const body of attempts) {
        res = await postCharacter(body);
        if (res.ok) { usedName = nm; usedServer = srv; break outer; }
      }
    }
  }

  if (!res || !res.ok) {
    // last chance: normalized inputs with spec 1
    effectiveSpec = 1;
    const body = { name: titleCaseName(normName(name)), server: normServer(server), spec: effectiveSpec };
    res = await postCharacter(body);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    usedName = body.name;
    usedServer = body.server;
  }
  const j = await res.json();
  const bosses = [];
  for (const [boss, v] of Object.entries(j.bosses || {})) {
    bosses.push({
      boss,
      rankPlayers: v.rank_players || 0,
      points: typeof v.points === 'number' ? v.points : 0,
      dpsMax: v.dps_max || 0,
      fastestKill: v.fastest_kill_duration || 0,
      raids: v.raids || 0,
      reportId: v.report_id || ''
    });
  }
  return {
    name: j.name || usedName || name,
    server: j.server || usedServer || server,
    overallPoints: typeof j.overall_points === 'number' ? j.overall_points : 0,
    overallRank: j.overall_rank || 0,
    classIndex: typeof j.class_i === 'number' ? j.class_i : null,
    usedSpec: Number.isInteger(effectiveSpec) ? effectiveSpec : null,
    bosses
  };
}

export default scrapeUwULogs;
