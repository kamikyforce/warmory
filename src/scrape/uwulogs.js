export async function scrapeUwULogs({ name, server, spec }) {
  const body = { name, server, spec: spec ? Number(spec) : undefined };
  const res = await fetch('https://uwu-logs.xyz/character', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'WarmoryBot/1.0 (+uwu-logs)'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
    classIndex: j.class_i || null,
    bosses
  };
}

export default scrapeUwULogs;
