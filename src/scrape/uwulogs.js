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
  const initial = {
    name,
    server,
    spec: spec ? Number(spec) : undefined
  };
  let res = await postCharacter(initial);
  if (!res.ok) {
    // fallback: sanitize server/name, try default spec
    const fallback = {
      name: normName(name),
      server: normServer(server),
      spec: spec ? Number(spec) : undefined
    };
    if (!fallback.spec) fallback.spec = undefined;
    res = await postCharacter(fallback);
    if (!res.ok) {
      // last chance: force spec 1 with sanitized inputs
      const f2 = { ...fallback, spec: 1 };
      res = await postCharacter(f2);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }
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
    name: j.name || name,
    server: j.server || server,
    overallPoints: typeof j.overall_points === 'number' ? j.overall_points : 0,
    overallRank: j.overall_rank || 0,
    classIndex: typeof j.class_i === 'number' ? j.class_i : null,
    bosses
  };
}

export default scrapeUwULogs;
