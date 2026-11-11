'use strict';
const assert = require('node:assert/strict');
const { toCents, allocate, calculate, parseReceipt } = require('../site/app.js');
assert.equal(toCents('18.00'), 1800);
assert.equal(toCents('0.01'), 1);
assert.equal(toCents('2.'), 200);
assert.ok(Number.isNaN(toCents('-1')));
assert.ok(Number.isNaN(toCents('1.999')));
assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33]);
assert.deepEqual(allocate(3, [0, 1, 0]), [0, 3, 0]);
assert.deepEqual(allocate(0, [0, 0]), [0, 0]);
const people = [{id:'alex'},{id:'maya'},{id:'sam'}];
const items = [{name:'Pasta',cents:1800,members:['alex']},{name:'Salmon',cents:2400,members:['maya']},{name:'Pizza',cents:1600,members:['sam']},{name:'Drinks',cents:1200,members:['alex','maya','sam']}];
const byItem = calculate(items, people, 560, 1400);
assert.equal(byItem.total, 8960);
assert.deepEqual(byItem.shares.map(s=>s.total), [2816,3584,2560]);
const equal = calculate(items, people, 560, 1400, 'equal');
assert.equal(equal.shares.reduce((s,p)=>s+p.total,0),8960);
assert.equal(calculate([{name:'No owner',cents:1,members:[]}],people,0,0).valid,false);
assert.equal(calculate([{name:'Bad amount',cents:NaN,members:['alex']}],people,0,0).valid,false);
assert.equal(calculate([],people,0,0).valid,false);
const parsed = parseReceipt('THE GOOD TABLE\nPasta Primavera 18.00\nGrilled Salmon 24.00\nMargherita Pizza 16.00\nLemonade (3) 12.00\nSubtotal 70.00\nTax 5.60\nTip 14.00\nTotal 89.60');
assert.equal(parsed.items.length,4);
assert.equal(parsed.tax,560);
assert.equal(parsed.tip,1400);
assert.equal(parsed.printedTotal,8960);
assert.equal(parseReceipt('Cake 12,50').items[0].cents,1250);
assert.equal(parseReceipt('Catering 1,234.56').items[0].cents,123456);
let seed=21037; function rand(max){seed=(seed*1664525+1013904223)>>>0;return seed%max;}
for(let test=0;test<2000;test++){
 const count=2+rand(7);const ps=Array.from({length:count},(_,i)=>({id:`p${i}`}));
 const its=Array.from({length:1+rand(20)},(_,i)=>{let members=ps.filter(()=>rand(3)>0).map(p=>p.id);if(!members.length)members=[ps[rand(count)].id];return{name:`Item ${i}`,cents:1+rand(100000),members};});
 for(const mode of ['item','equal']){const result=calculate(its,ps,rand(50000),rand(50000),mode);assert.equal(result.valid,true);assert.equal(result.shares.reduce((s,p)=>s+p.total,0),result.total);assert.ok(result.shares.every(p=>Number.isSafeInteger(p.total)&&p.total>=0));}
}
console.log('PASS: exact sample shares, parser, invalid input, and 4,000 randomized split reconciliations.');
