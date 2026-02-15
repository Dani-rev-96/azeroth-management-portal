const data = require('../data/dbcJsons/Spell.json');

function findSpells(pattern) {
  return data.filter(r => {
    const n = r.Name_Lang_frFR || '';
    return pattern.test(n);
  }).map(s => ({
    id: s.ID,
    name: s.Name_Lang_frFR,
    rank: s.NameSubtext_Lang_frFR || '',
  }));
}

console.log('=== Fortitude / Prayer of Fortitude ===');
findSpells(/^(Seelenstärke|Gebet der Seelenstärke)$/).forEach(s =>
  console.log(`ID=${s.id} name=${s.name} rank=${s.rank}`));

console.log('\n=== Arcane Intellect / Arcane Brilliance ===');
findSpells(/^(Arkane Intelligenz|Arkane Brillanz)$/).forEach(s =>
  console.log(`ID=${s.id} name=${s.name} rank=${s.rank}`));

console.log('\n=== Blessing of Kings / Greater ===');
findSpells(/^(Segen der Könige|Großer Segen der Könige)$/).forEach(s =>
  console.log(`ID=${s.id} name=${s.name} rank=${s.rank}`));

console.log('\n=== Blessing of Might / Greater ===');
findSpells(/^(Segen der Macht|Großer Segen der Macht)$/).forEach(s =>
  console.log(`ID=${s.id} name=${s.name} rank=${s.rank}`));

console.log('\n=== Blessing of Wisdom / Greater ===');
findSpells(/^(Segen der Weisheit|Großer Segen der Weisheit)$/).forEach(s =>
  console.log(`ID=${s.id} name=${s.name} rank=${s.rank}`));

console.log('\n=== Divine Spirit / Prayer of Spirit ===');
findSpells(/^(Göttlicher Wille|Gebet des Geistes)$/).forEach(s =>
  console.log(`ID=${s.id} name=${s.name} rank=${s.rank}`));
// also check known IDs
const knownDS = [14752, 14818, 14819, 27841, 25312, 48073, 48074, 32999, 27681];
knownDS.forEach(id => {
  const s = data.find(r => r.ID === id);
  if (s) console.log(`  known ID=${id} name=${s.Name_Lang_frFR} rank=${s.NameSubtext_Lang_frFR || ''}`);
});

console.log('\n=== Fortitude single-target (PW:Fort) ===');
data.filter(r => {
  const n = r.Name_Lang_frFR || '';
  return n === 'Machtwort: Seelenstärke';
}).forEach(s =>
  console.log(`ID=${s.ID} name=${s.Name_Lang_frFR} rank=${s.NameSubtext_Lang_frFR || ''}`));

console.log('\n=== Shadow Protection / Prayer of Shadow Prot ===');
findSpells(/^(Schattenschutz|Gebet des Schattenschutzes)$/).forEach(s =>
  console.log(`ID=${s.id} name=${s.name} rank=${s.rank}`));
