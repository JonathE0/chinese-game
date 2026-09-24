import test from 'node:test';
import assert from 'node:assert/strict';
import rooms from '../src/content/rooms.json' with { type: 'json' };
import { freshProfile, decodeProfile, loadProfile, upgradeSave, isNewerSave, SAVE_KEY, SAVE_VERSION } from '../src/core/profile.js';
import { reviewWord } from '../src/core/review.js';
import { grant } from '../src/core/economy.js';
import { claimPeriod } from '../src/core/calendar.js';
import { learnedAtLevel } from '../src/core/progress.js';
import { rotateBackups, logRow, csvLine, addLogRow, parseLog, moreProgress, realDay, BACKUP_LIMIT, LOG_HEADER } from '../src/core/backup.js';

const memory = (entries = {}, { full = false } = {}) => {
  const data = new Map(Object.entries(entries));
  return {
    data, getItem: k => data.get(k) ?? null, removeItem: k => data.delete(k),
    setItem: (k, v) => { if (full) throw new DOMException('full', 'QuotaExceededError'); data.set(k, String(v)); },
    get length() { return data.size; }, key: i => [...data.keys()][i] ?? null,
  };
};

test('a copy that cannot be kept is reported, not claimed, and old copies are pruned', () => {
  const p = freshProfile(); p.claims['bad claim!'] = true;
  const raw = JSON.stringify(p);
  const full = loadProfile(memory({ [SAVE_KEY]: raw }, { full: true }), 5);
  assert.equal(full.unkept, raw);                          // main.js keeps it in IndexedDB instead
  assert.doesNotMatch(full.warning, /另存了一份|copy of the original was kept/);
  const store = memory({ [SAVE_KEY]: raw, [`${SAVE_KEY}.unreadable-1`]: 'a', [`${SAVE_KEY}.unreadable-2`]: 'b', [`${SAVE_KEY}.unreadable-3`]: 'c' });
  const kept = loadProfile(store, 10);
  assert.equal(kept.unkept, undefined);
  assert.match(kept.warning, /另存了一份/);
  assert.deepEqual([...store.data.keys()].filter(k => k.includes('unreadable')).sort(), [`${SAVE_KEY}.unreadable-10`, `${SAVE_KEY}.unreadable-3`]);
});

test('a save from a newer version of the game opens read-only and is left untouched', () => {
  const raw = JSON.stringify({ ...freshProfile(), version: SAVE_VERSION + 1, wallet: 500 });
  const store = memory({ [SAVE_KEY]: raw });
  const result = loadProfile(store, 7);
  assert.equal(result.readOnly, true);
  assert.equal(result.profile.wallet, 0);
  assert.ok(result.warning);
  assert.deepEqual([...store.data.keys()], [SAVE_KEY]);    // no copy, nothing written
  assert.equal(isNewerSave(raw), true);
  assert.equal(isNewerSave(JSON.stringify(freshProfile())), false);
  assert.equal(isNewerSave('nonsense'), false);
});
const furnishing = { uid: 'a1', item: 'wooden-bed', kind: 'bed', color: '#aa8866', footprint: [2, 1], x: 1, z: 1, rot: 0 };

test('a damaged save keeps its good parts and lists what was repaired', () => {
  const p = freshProfile(); p.wallet = 55;
  grant(p, 'lesson:intro', 0);
  p.claims['bad claim!'] = true; p.claims['order:tea'] = 'yes';
  p.words.water = { recognition: { stage: 2, due: 1, last: 1, reviews: 2, learned: true } };
  p.words.tea = { recognition: { stage: 9, due: 1, last: 1, reviews: 1 } };
  p.home = [furnishing, { ...furnishing, uid: 'b2', rot: 45 }];
  const repairs = [];
  const back = decodeProfile(JSON.stringify(p), repairs);
  assert.equal(back.wallet, 55);
  assert.deepEqual(Object.keys(back.claims), ['lesson:intro']);
  assert.deepEqual(Object.keys(back.words), ['water']);
  assert.deepEqual(back.home.map(r => r.uid), ['a1']);
  assert.ok(repairs.length >= 3, repairs.join());
  // A clean save repairs nothing.
  const clean = [];
  decodeProfile(JSON.stringify(freshProfile()), clean);
  assert.deepEqual(clean, []);
});

test('a save with more than 10,000 claims loads, keeping what it can', () => {
  const p = freshProfile(); p.wallet = 20; grant(p, 'lesson:intro', 0);
  for (let i = 0; i < 12000; i++) p.claims[`review:w${i}:recognition:${i}`] = true;
  const repairs = [];
  const back = decodeProfile(JSON.stringify(p), repairs);
  assert.deepEqual(Object.keys(back.claims), ['lesson:intro']);
  assert.deepEqual(repairs, []);               // spent review claims are simply dropped
  assert.equal(grant(back, 'lesson:intro', 20), 0);
  const flood = freshProfile();
  for (let i = 0; i < 10001; i++) flood.claims[`lesson:l${i}`] = true;
  const floodRepairs = [];
  const loaded = decodeProfile(JSON.stringify(flood), floodRepairs);
  assert.equal(Object.keys(loaded.claims).length, 10000);
  assert.ok(floodRepairs.length);
});

test('a due card pays once and leaves no claim behind, even across a reload', () => {
  const p = freshProfile();
  assert.ok(reviewWord(p, 'water', 'recognition', { correct: true, hinted: false, now: 1000 }).coins > 0);
  assert.deepEqual(p.claims, {});
  const loaded = decodeProfile(JSON.stringify(p));
  const wallet = loaded.wallet;
  assert.equal(reviewWord(loaded, 'water', 'recognition', { correct: true, hinted: false, now: 2000 }).coins, 0);
  assert.equal(loaded.wallet, wallet);
});

test('a long-played save keeps today\'s daily claims and drops earlier days\'', () => {
  const p = freshProfile(); p.dayIndex = 3000;
  grant(p, 'lesson:intro', 20);
  for (let day = 0; day <= p.dayIndex; day++) { claimPeriod(p, 'interest', day); claimPeriod(p, 'income:teahouse', day); grant(p, `game:match:${day}`, 0); }
  claimPeriod(p, 'rent', 3);
  const loaded = decodeProfile(JSON.stringify(p));
  assert.deepEqual(Object.keys(loaded.claims).sort(), ['game:match:3000', 'income:teahouse:3000', 'interest:3000', 'lesson:intro', 'rent:3']);
  assert.equal(claimPeriod(loaded, 'interest', 3000), false);
  assert.equal(claimPeriod(loaded, 'interest', 3001), true);
});

test('unparseable JSON falls back to a fresh profile and keeps the raw text', () => {
  const store = memory({ [SAVE_KEY]: '{"version":1,"wallet":' });
  const { profile, warning } = loadProfile(store, 1234);
  assert.equal(profile.wallet, 0);
  assert.ok(warning);
  assert.equal(store.getItem(`${SAVE_KEY}.unreadable-1234`), '{"version":1,"wallet":');
  // A repaired save also keeps a copy of the original and says so.
  const p = freshProfile(); p.claims['bad claim!'] = true;
  const raw = JSON.stringify(p), repaired = memory({ [SAVE_KEY]: raw });
  const result = loadProfile(repaired, 99);
  assert.ok(result.repairs.length);
  assert.match(result.warning, /已经修好了/);
  assert.equal(repaired.getItem(`${SAVE_KEY}.unreadable-99`), raw);
  const fine = loadProfile(memory({ [SAVE_KEY]: JSON.stringify(freshProfile()) }));
  assert.equal(fine.warning, null);
  assert.deepEqual(fine.repairs, []);
});

test('format upgrade steps run in order and saves carry the current version', () => {
  const steps = [p => ({ ...p, trail: [...p.trail, 'one'] }), p => ({ ...p, trail: [...p.trail, 'two'] })];
  const up = upgradeSave({ version: 1, trail: [] }, steps);
  assert.deepEqual(up, { version: 3, trail: ['one', 'two'] });
  assert.deepEqual(upgradeSave({ version: 2, trail: [] }, steps).trail, ['two']);
  assert.equal(decodeProfile(JSON.stringify(freshProfile())).version, SAVE_VERSION);
  assert.throws(() => decodeProfile(JSON.stringify({ ...freshProfile(), version: SAVE_VERSION + 1 })));
});

test('backups keep one snapshot a day and the last 14 days', () => {
  const day = 86400000, start = Date.UTC(2026, 0, 1, 12);
  let list = [];
  const p = freshProfile();
  for (let i = 0; i < 20; i++) {
    p.wallet = i;
    list = rotateBackups(list, p, start + i * day);
    const again = rotateBackups(list, p, start + i * day + 1000);
    assert.equal(again, list);                 // a second save the same day adds nothing
  }
  assert.equal(list.length, BACKUP_LIMIT);
  assert.equal(list[0].day, realDay(start + 6 * day));
  assert.equal(JSON.parse(list.at(-1).raw).wallet, 19);
});

test('a log row counts known words exactly as the district gates do', () => {
  const words = [{ id: 'a', level: 1 }, { id: 'b', level: 1 }, { id: 'c', level: 2 }, { id: 'd', level: 6 }];
  const p = freshProfile(); p.wallet = 42;
  p.words.a = { recognition: { stage: 1, due: 0, last: 0, reviews: 1 } };
  p.words.b = { recognition: { stage: 0, due: 0, last: 0, reviews: 1 } };
  p.words.d = { recognition: { stage: 3, due: 0, last: 0, reviews: 3 } };
  p.discovered = ['x', 'y'];
  const now = Date.UTC(2026, 8, 21, 12);
  const row = logRow(p, words, now);
  assert.deepEqual(row.hsk, [1, 2, 3, 4, 5, 6].map(level => learnedAtLevel(p, words, level)));
  assert.equal(row.hsk[0], 1); assert.equal(row.hsk[5], 1);
  assert.equal(row.objects, 2); assert.equal(row.coins, 42);
  assert.equal(csvLine(row), [row.date, ...row.hsk, 2, 42].join(','));
  assert.equal(LOG_HEADER, 'date,hsk1,hsk2,hsk3,hsk4,hsk5,hsk6,objects,coins');
  const log = addLogRow([], row);
  assert.equal(addLogRow(log, { ...row, coins: 99 }), log);   // once per real day
  assert.deepEqual(parseLog(JSON.stringify([...log, { date: 'x' }, null])), log);
  assert.deepEqual(parseLog('not json'), []);
});

test('the fuller save is the one with more known words, then objects; coins alone never decide', () => {
  const a = freshProfile(), b = freshProfile();
  b.wallet = 10;
  // Coins move both ways (a purchase lowers them), so a richer save may simply be staler.
  assert.equal(moreProgress(b, a), false);
  b.discovered = ['y'];
  assert.equal(moreProgress(b, a), true);
  a.discovered = ['x', 'z'];
  assert.equal(moreProgress(b, a), false);
  b.words.w = { recognition: { stage: 1, due: 0, last: 0, reviews: 1 } };
  assert.equal(moreProgress(b, a), true);
  assert.equal(moreProgress(a, a), false);
});

test('furnishings remember their room: none means home, and an unknown room is repaired', () => {
  const p = freshProfile();
  p.home = [furnishing, { ...furnishing, uid: 'b2', room: 'home', y: 2.9 }, { ...furnishing, uid: 'c3', room: 'kitchen' }, { ...furnishing, uid: 'd4', room: 'nowhere!' }];
  const repairs = [];
  const back = decodeProfile(JSON.stringify(p), repairs);
  // An old save's bed stays exactly where it was, with no room written in.
  assert.deepEqual(back.home[0], furnishing);
  assert.deepEqual([back.home[1].room, back.home[1].y], ['home', 2.9]);
  // The kitchen cannot be decorated, and a garbled room is no room at all.
  assert.deepEqual(back.home.map(r => r.uid), ['a1', 'b2']);
  assert.ok(repairs.includes('home'), repairs.join());
});

test("a version 1 save: the bedroom's furniture moves upstairs and nothing owned is lost", () => {
  const piece = (uid, item, kind, footprint, x, z, extra = {}) => ({ uid, item, kind, color: '#aa8866', footprint, x, z, rot: 0, ...extra });
  const old = { ...freshProfile(), version: 1, inventory: { 'wooden-bed': 1, nightstand: 1, 'potted-plant': 1, 'tea-set': 1, bookshelf: 1, 'wooden-chair': 1, 'low-table': 1 },
    home: [
      piece('bed', 'wooden-bed', 'bed', [2.1, 1.4], 1.8, -1.6, { room: 'bedroom', slot: 'bed' }),
      piece('ns', 'nightstand', 'nightstand', [0.65, 0.5], 0.3, -2.05, { room: 'bedroom', slot: 'nightstand' }),
      piece('plant', 'potted-plant', 'plant', [0.7, 0.7], -3.1, 2.1, { room: 'bedroom' }),
      piece('tea', 'tea-set', 'teaset', [0.65, 0.45], 0.3, -2.05, { room: 'bedroom', on: 'ns' }),
      // Downstairs where the staircase now stands: a shelf in its slot, and a chair and table put there by hand.
      piece('shelf', 'bookshelf', 'shelf', [1.4, 0.55], -4.3, 1.9, { rot: 90, slot: 'shelf' }),
      piece('chair', 'wooden-chair', 'chair', [0.55, 0.55], -4.4, 1.0),
      piece('rug', 'low-table', 'table', [1.5, 1], 2, 1),
    ] };
  const notes = [];
  const up = upgradeSave(structuredClone(old), undefined, notes);
  const byUid = Object.fromEntries(up.home.map(r => [r.uid, r]));
  const [wx0, wz0, wx1, wz1] = rooms.home.upper.well;
  // Every bedroom piece is now on the home's upper floor, inside it and clear of the stairwell.
  for (const uid of ['bed', 'ns', 'plant', 'tea']) {
    const r = byUid[uid];
    assert.equal(r.room, 'home', uid); assert.equal(r.y, rooms.home.upper.y, uid);
    const [hw, hd] = [r.footprint[0] / 2, r.footprint[1] / 2];
    assert.ok(Math.abs(r.x) + hw <= 5 && Math.abs(r.z) + hd <= 4.5, uid + ' inside the floor');
    assert.ok(r.x - hw >= wx1 || r.x + hw <= wx0 || r.z - hd >= wz1 || r.z + hd <= wz0, uid + ' off the stairwell');
  }
  // Slotted pieces sit in the matching upstairs slots, and the tea set is still on its nightstand.
  for (const uid of ['bed', 'ns']) {
    const slot = rooms.home.slots['up-' + old.home.find(r => r.uid === uid).slot];
    assert.equal(byUid[uid].slot, 'up-' + old.home.find(r => r.uid === uid).slot);
    assert.deepEqual([byUid[uid].x, byUid[uid].z, byUid[uid].y], [slot.x, slot.z, slot.y]);
  }
  assert.deepEqual([byUid.tea.on, byUid.tea.x, byUid.tea.z], ['ns', byUid.ns.x, byUid.ns.z]);
  // The shelf follows its slot; the chair has nowhere to go and goes back into storage, with a note.
  assert.deepEqual([byUid.shelf.x, byUid.shelf.z, byUid.shelf.rot], [rooms.home.slots.shelf.x, rooms.home.slots.shelf.z, rooms.home.slots.shelf.rot]);
  assert.equal(byUid.chair, undefined);
  assert.deepEqual(byUid.rug, old.home[6]);
  assert.deepEqual(up.inventory, old.inventory);
  assert.deepEqual(notes, ['moved', 'returned']);
  // Loading the same save keeps every item it owned, and says what happened.
  const loaded = loadProfile(memory({ [SAVE_KEY]: JSON.stringify(old) }));
  assert.equal(loaded.profile.version, SAVE_VERSION);
  assert.deepEqual(loaded.profile.inventory, old.inventory);
  assert.deepEqual(loaded.profile.home.map(r => r.uid).sort(), ['bed', 'ns', 'plant', 'rug', 'shelf', 'tea']);
  assert.match(loaded.notice, /卧室的家具搬到二楼了。/);
  assert.match(loaded.notice, /有的家具放不下，放回背包里了。/);
  // A save with nothing in the bedroom or the stairwell upgrades silently.
  const quiet = loadProfile(memory({ [SAVE_KEY]: JSON.stringify({ ...old, home: [old.home[6]] }) }));
  assert.equal(quiet.notice, null);
});

test('a version 1 save: a moved piece that would land on another goes back to the bag, and slotted pieces take the slot\'s turn', () => {
  const piece = (uid, item, kind, footprint, x, z, extra = {}) => ({ uid, item, kind, color: '#aa8866', footprint, x, z, rot: 0, ...extra });
  const old = { ...freshProfile(), version: 1, inventory: { nightstand: 1, dresser: 1, wardrobe: 1, bookshelf: 1, 'wooden-chair': 1 },
    home: [
      piece('ns', 'nightstand', 'nightstand', [0.65, 0.5], 0.3, -2.05, { room: 'bedroom', slot: 'nightstand' }),
      // Against the bedroom's back wall: kept off the house's back wall upstairs, it would stand on the nightstand.
      piece('dresser', 'dresser', 'dresser', [1.5, 0.6], 0.2, -2.1, { room: 'bedroom' }),
      piece('wardrobe', 'wardrobe', 'wardrobe', [1.3, 0.65], -3, -0.9, { room: 'bedroom', slot: 'wardrobe' }),
      // Downstairs, the shelf leaves the stairwell for its slot, but a chair was put down by hand right there.
      piece('chair', 'wooden-chair', 'chair', [0.55, 0.55], rooms.home.slots.shelf.x, rooms.home.slots.shelf.z),
      piece('shelf', 'bookshelf', 'shelf', [1.4, 0.55], -4.3, 1.9, { rot: 90, slot: 'shelf' }),
    ] };
  const notes = [];
  const up = upgradeSave(structuredClone(old), undefined, notes);
  const byUid = Object.fromEntries(up.home.map(r => [r.uid, r]));
  assert.deepEqual(Object.keys(byUid).sort(), ['chair', 'ns', 'wardrobe']);
  assert.deepEqual([byUid.chair.x, byUid.chair.z], [old.home[3].x, old.home[3].z]);
  assert.equal(byUid.wardrobe.rot, rooms.home.slots['up-wardrobe'].rot);
  assert.deepEqual(notes, ['moved', 'returned']);
  assert.deepEqual(up.inventory, old.inventory);
});
