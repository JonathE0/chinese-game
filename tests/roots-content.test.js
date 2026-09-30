import test from 'node:test';import assert from 'node:assert/strict';import roots from '../src/content/roots.json' with {type:'json'};import {validateRoots} from '../src/core/roots-content.js';
test('chapter content is internally valid',()=>assert.deepEqual(validateRoots(roots),[]));
test('validation catches insufficient independent variants and missing examples',()=>{const r=structuredClone(roots);r.skills[0].variants=[{id:'one',accepted:[]}];assert.ok(validateRoots(r).length>0);});

test('validation rejects fractional film prices and missing translations',()=>{const r=structuredClone(roots);r.film.price=.5;delete r.opening.en;assert.ok(validateRoots(r).length>=2);});
test('validation rejects unsupported model answers and reused variant IDs',()=>{const r=structuredClone(roots);r.skills[0].variants[0].choices=['再见'];r.skills[1].variants[0].id=r.skills[0].variants[0].id;assert.ok(validateRoots(r).length>=2);});

test('malformed authored collections produce validation errors instead of crashing',()=>{const r=structuredClone(roots);r.skills[0].variants={};r.skills[1].variants[0].answerRules.templates={};assert.doesNotThrow(()=>validateRoots(r));assert.ok(validateRoots(r).length>=2);});
