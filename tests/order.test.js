import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../src/content/catalog.json' with {type:'json'};
import market from '../src/content/market.json' with {type:'json'};
import balance from '../src/content/balance.json' with {type:'json'};
import {sayNumber,orderText,matchSpoken,measureChoices,payChoices,orderBonus} from '../src/core/order.js';
import {TASKS} from '../src/core/daily.js';

const item=id=>catalog.find(i=>i.id===id);

test('sayNumber reads 1 to 99 the way a vendor says a price',()=>{
  const cases={1:'一',2:'两',3:'三',10:'十',11:'十一',12:'十二',14:'十四',19:'十九',20:'二十',22:'二十二',40:'四十',44:'四十四',99:'九十九'};
  for(const [n,zh] of Object.entries(cases))assert.equal(sayNumber(+n),zh);
  assert.throws(()=>sayNumber(0));
  assert.throws(()=>sayNumber(100));
});

test('every total clip line is built from sayNumber',()=>{
  for(let n=1;n<=99;n++)assert.equal(market.totals[n],`一共${sayNumber(n)}块。`);
});

test('every food item carries a measure, and orders read naturally',()=>{
  for(const food of catalog.filter(i=>i.nutrition))assert.ok(food.measure,food.id);
  assert.equal(orderText(item('wonton'),2),'我要两碗馄饨。');
  assert.equal(orderText(item('city-beef-noodles-small'),1),'我要一小碗牛肉面。');
});

test('spoken orders need the number, the right measure and the item',()=>{
  const wonton=item('wonton');
  assert.deepEqual(matchSpoken('我要两碗馄饨。',wonton),{ok:true,quantity:2});
  assert.deepEqual(matchSpoken('我要 2 碗馄饨',wonton),{ok:true,quantity:2});
  assert.deepEqual(matchSpoken('三碗馄饨',wonton),{ok:true,quantity:3});
  assert.equal(matchSpoken('我要二碗馄饨',wonton).reason,'er');
  assert.equal(matchSpoken('我要两杯馄饨',wonton).reason,'measure');
  assert.equal(matchSpoken('我要两碗面条',wonton).reason,'again');
  assert.equal(matchSpoken('我要12碗馄饨',wonton).ok,false);
  assert.deepEqual(matchSpoken('两小碗牛肉面',item('city-beef-noodles-small')),{ok:true,quantity:2});
  assert.equal(matchSpoken('两大碗牛肉面',item('city-beef-noodles-small')).ok,false);
});

test('measure tiles offer the right one plus three plainly wrong ones',()=>{
  const tiles=measureChoices(item('wonton'));
  assert.equal(tiles.length,4);
  assert.equal(new Set(tiles).size,4);
  assert.ok(tiles.includes('碗'));
  for(const m of ['盘','份','个','小碗','大碗'])assert.ok(!tiles.includes(m),m);
});

test('pay choices hold the total and two confusions',()=>{
  const fourteen=payChoices(14);
  assert.equal(fourteen.length,3);
  assert.ok(fourteen.includes(14)&&fourteen.includes(40)&&fourteen.includes(41));
  for(let n=1;n<=99;n++){
    const picks=payChoices(n);
    assert.equal(new Set(picks).size,3,String(n));
    assert.ok(picks.includes(n)&&picks.every(m=>m>=1&&m<=99),String(n));
  }
});

test('each bonus is paid once per order and once per game day',()=>{
  const profile={wallet:0,claims:{},dayIndex:3};
  const spoken={via:'spoken'};
  assert.equal(orderBonus(profile,spoken),balance.orderBonus.spoken);
  assert.equal(orderBonus(profile,spoken),0);
  assert.equal(orderBonus(profile,{via:'spoken'}),0,'second spoken order the same day');
  assert.equal(orderBonus(profile,{via:'built',clean:false}),0);
  assert.equal(orderBonus(profile,{via:'built',clean:true}),balance.orderBonus.built);
  assert.equal(orderBonus(profile,{via:'built',clean:true}),0,'second clean build the same day');
  assert.equal(profile.wallet,balance.orderBonus.spoken+balance.orderBonus.built);
  profile.dayIndex=4;
  assert.equal(orderBonus(profile,{via:'spoken'}),balance.orderBonus.spoken,'a new day pays again');
});

test('measures that also fit are never wrong tiles, and are accepted when spoken',()=>{
  for(let run=0;run<50;run++){
    assert.ok(!measureChoices(item('baozi')).includes('笼'));
    assert.ok(!measureChoices(item('soy-milk')).includes('碗'));
    assert.ok(!measureChoices(item('candied-hawthorn')).includes('根'));
  }
  assert.deepEqual(matchSpoken('我要两碗豆浆',item('soy-milk')),{ok:true,quantity:2});
  assert.deepEqual(matchSpoken('我要一笼包子',item('baozi')),{ok:true,quantity:1});
  assert.deepEqual(matchSpoken('我要一壶茶',item('pot-tea')),{ok:true,quantity:1});
  assert.equal(orderText(item('pot-tea'),1),'我要一壶茶。');
});

test('a number outside one to three is not heard as a measure or 二 slip',()=>{
  const wonton=item('wonton');
  assert.equal(matchSpoken('我要四碗馄饨',wonton).reason,'again');
  assert.equal(matchSpoken('我要十二碗馄饨',wonton).reason,'again');
  assert.equal(matchSpoken('我要12碗馄饨',wonton).reason,'again');
});

test('ordering in Chinese is a daily errand',()=>{
  const order=TASKS.find(t=>t.id==='order');
  assert.equal(order.metric,'ordered');
  assert.equal(order.goal,1);
});
