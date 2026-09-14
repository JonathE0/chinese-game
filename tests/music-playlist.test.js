import test from 'node:test';
import assert from 'node:assert/strict';
import {Playlist,compileScore} from '../src/core/music-playlist.js';
import music from '../src/content/music.json' with {type:'json'};

test('shuffle visits every song before repeating, including cycle boundaries',()=>{
  const p=new Playlist(music.tracks,()=>0.42),ids=[];
  let now=0;
  for(let i=0;i<15;i++){
    const song=p.update(now);ids.push(song.track.id);
    now=song.end+19;p.update(song.end);p.update(now);
  }
  for(let i=0;i<15;i+=5)assert.equal(new Set(ids.slice(i,i+5)).size,5);
  for(let i=1;i<ids.length;i++)assert.notEqual(ids[i],ids[i-1]);
});
test('songs finish, leave quiet, and resume with a different song',()=>{
  const p=new Playlist(music.tracks,()=>0),first=p.update(10);
  assert.equal(p.update(first.end-.01),first);
  assert.equal(p.update(first.end),null);
  assert.equal(p.update(first.end+7.99),null);
  const second=p.update(first.end+8);
  assert.notEqual(second.track.id,first.track.id);
  assert.equal(second.start,first.end+8);
});
test('skip waits for its fade and audio-time suspension does not advance the playlist',()=>{
  const p=new Playlist(music.tracks,()=>.5),first=p.update(0);
  assert.equal(p.update(0),first);
  p.skip(2);assert.equal(p.update(3.5),null);
  const second=p.update(3.6);assert.notEqual(second.track.id,first.track.id);
  assert.equal(p.update(3.6),second);
});
test('a delayed timer starts one new song, never a backlog of songs',()=>{
  const p=new Playlist(music.tracks,()=>0),first=p.update(0);
  assert.equal(p.update(10000),null);
  const next=p.update(10008);
  assert.equal(next.start,10008);assert.notEqual(next.track.id,first.track.id);
});
test('each composition has a distinct finite score with rests and a safe release tail',()=>{
  assert.equal(music.tracks.length,5);
  const scores=music.tracks.map(compileScore);
  assert.equal(new Set(music.tracks.map(t=>t.instrument)).size,5);
  assert.equal(new Set(scores.map(s=>JSON.stringify(s.events))).size,5);
  for(const s of scores){
    assert.ok(s.duration>=60&&s.duration<=150);
    assert.ok(s.events.length>30);
    assert.ok(s.events.every((e,i)=>Number.isFinite(e.at)&&e.at>=0&&e.at+e.length<=s.duration&&(i===0||e.at>=s.events[i-1].at)));
  }
});
