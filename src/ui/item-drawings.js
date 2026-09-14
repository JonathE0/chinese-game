// Distinct silhouettes matter here: these pictures also teach the item's Chinese name.
const path=(d,fill,stroke)=>`<path d="${d}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`:''}/>`;
const rect=(x,y,w,h,fill,r=3)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
const ellipse=(x,y,rx,ry,fill)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
const shadow=ellipse(80,135,48,7,'#ddd4bf');
const bowl=(food)=>path('M30 80h100l-10 33q-40 26-80 0z','#e5ece6')+ellipse(80,80,50,17,'#b7c9bd')+ellipse(80,79,43,13,food);
const cup=(x,y)=>path(`M${x} ${y}h22l-3 17q-8 8-16 0z`,'#c2d3bd')+ellipse(x+11,y,11,4,'#8e9d7e');
const pot=path('M56 73q-10 8-10 24 0 21 31 21t32-21q0-16-13-24z','#9eb795')+path('M48 88L30 77l5 30 15 2','#9eb795')+path('M105 85q33-10 17 25h-14','none','#799675')+ellipse(77,73,22,5,'#819b78')+rect(72,62,11,10,'#819b78');
const tofuPieces=rect(44,58,46,30,'#f9f1d5')+path('M44 58l17-12h46L90 58z','#fff9e5')+path('M90 58l17-12v30L90 88z','#dfd1ad');
const toppings=(kind)=>kind==='beef'?path('M48 69l15-7 12 12-19 8z M87 64l17 2 8 12-22 2z','#996449'):ellipse(65,73,18,12,'#fff7df')+ellipse(65,73,9,7,'#eac259');

export const itemDrawings={
 'paper-lantern':shadow+rect(76,16,8,19,'#8b7452')+ellipse(80,74,40,45,'#f3da9d')+path('M57 36q-16 39 0 76M80 30v88M103 36q16 39 0 76','none','#d7b97f')+rect(62,29,36,8,'#947953')+rect(62,113,36,8,'#947953')+path('M80 122v15','none','#b57b58'),
 'ceiling-lamp':shadow+path('M80 15v40','none','#85765d')+ellipse(80,17,19,4,'#85765d')+path('M56 54h48l27 43H29z','#b1bcb0')+ellipse(80,97,51,10,'#e5d5a7')+ellipse(80,98,12,6,'#fff4c5'),
 'bamboo-mat':shadow+path('M27 53h107l-8 69H19z','#cfb47d')+Array.from({length:11},(_,i)=>path(`M${29+i*9} 55l-8 65`,'none','#a58b5b')).join('')+path('M26 62h105M22 111h105','none','#8e7651'),
 stool:shadow+path('M48 80l-8 47M110 80l9 47M76 88v37','none','#93704d')+path('M45 105h70','none','#ab8659')+ellipse(80,77,46,15,'#b58f60')+ellipse(80,72,46,15,'#ddba86'),
 'cloth-shoes':shadow+path('M27 66q21-8 27 13l3 20q35 1 40 19H25q-10-14 2-52z','#68808d')+ellipse(40,71,10,8,'#33444d')+path('M66 51q21-8 27 13l3 20q35 1 40 19H64q-10-14 2-52z','#68808d')+ellipse(79,56,10,8,'#33444d')+path('M24 119h72M64 104h72','none','#dbd3bd'),
 sandals:shadow+ellipse(54,88,22,42,'#c6a879')+ellipse(105,80,22,42,'#c6a879')+path('M38 76l16 15 16-15M54 91v-34M89 68l16 15 16-15M105 83V49','none','#826e4d')+path('M37 107h33M88 99h33','none','#e3c694'),
 'egg-tart':shadow+path('M31 76l9 35q39 26 79 0l10-35z','#b87b42')+ellipse(80,76,49,28,'#e0ad68')+ellipse(80,74,39,20,'#f7d879')+ellipse(72,70,22,8,'#fbe493')+path('M46 96l4 19M66 102l2 20M89 103l-1 20M112 96l-5 21','none','#d29b57'),
 'red-bean-bun':shadow+path('M27 109q-9-58 36-64 31 1 31 58z','#f0e4c8')+path('M73 114q-3-54 34-63 32 15 25 63z','#f7ecd1')+path('M85 103q4-32 22-37 18 12 14 39z','#84554e')+path('M53 55l11 8 11-8','none','#d6c6a6'),
 donut:shadow+ellipse(80,89,51,35,'#c38c59')+ellipse(80,81,51,33,'#dc96a5')+ellipse(80,81,16,12,'#ad754b')+ellipse(80,84,11,6,'#f1e8d4')+path('M45 71l5 4M60 99l6-4M108 78l5 4M78 58l5 1M104 97l-3 4','none','#ffe2ba'),
 'pineapple-bun':shadow+path('M27 85q3-44 53-44t53 44q0 40-53 40T27 85z','#cb9452')+ellipse(80,78,51,34,'#e6bd73')+path('M42 60l62 45M62 46l59 43M32 79l44 32M119 63l-61 44M99 47L39 91M129 81l-40 32','none','#ba8747'),
 hawthorn:shadow+path('M80 24v113','none','#ad8856')+[40,67,94].map(y=>ellipse(80,y,16,17,'#b74940')+path(`M72 ${y-8}l-3 7`,'none','#f3c2a0')).join(''),
 skewer:shadow+[0,29].map(x=>`<g transform="translate(${x} 0)">`+path('M50 29v110','none','#b79865')+[45,70,95].map(y=>rect(37,y,26,18,'#a86944')+path(`M41 ${y+5}l16 5`,'none','#754d34')).join('')+'</g>').join(''),
 'tofu-pudding':shadow+bowl('#f5e9cb')+path('M42 74q16-8 28 0t36 0M63 85q12-9 29 0','none','#d3a371')+path('M105 66l21-30','none','#917e60')+ellipse(105,69,10,5,'#b7ad95'),
 teapot:shadow+pot,
 'tea-set':shadow+ellipse(80,117,64,17,'#c7ac7d')+`<g transform="translate(13 -19) scale(.85)">${pot}</g>`+cup(26,107)+cup(65,113)+cup(106,105),
 timber:shadow+[0,20,40].map(y=>path(`M30 ${51+y}h93l12 11-93 0z`,'#d9b780')+rect(30,51+y,12,19,'#b58c58')+path(`M42 ${62+y}h93v9H42z`,'#bb935f')+path(`M53 ${66+y}h67`,'none','#a9804d')).join(''),
 brick:shadow+path('M25 71l87-26 26 27-86 29z','#c7836b')+path('M25 71l27 30v27l-27-29z','#a36350')+path('M52 101l86-29v27l-86 29z','#b8725d')+[0,23,46].map(x=>ellipse(57+x,75-x*.3,8,5,'#8d594a')).join(''),
 'cloth-bolt':shadow+path('M37 48h89v68H37z','#9aadb3')+path('M38 58h79l-12 72H25z','#b0c4c7')+ellipse(126,82,14,34,'#6f8b93')+ellipse(126,82,8,25,'#c3d2d2')+ellipse(126,82,3,12,'#798e91')+path('M37 113h66M39 102h66','none','#8fa8ae'),
 'rice-bag':shadow+path('M51 37q27 10 57 0l10 87q-37 16-77 0z','#d3b58a')+path('M52 37l-5-13 66 0-5 13z','#bc996e')+rect(52,59,54,49,'#eee4c7')+Array.from({length:9},(_,i)=>ellipse(64+(i%3)*15,71+Math.floor(i/3)*12,5,2,'#bfa271')).join(''),
 tomato:shadow+path('M80 58q-29-19-45 7-22 48 23 64 48 15 66-20 20-44-22-52z','#ce6654')+path('M81 60l-23-12 17 0 6-15 6 15 22-3-18 13 9 14-21-9-15 11z','#789454')+path('M46 77l-4 14','none','#edb09c'),
 tofu:shadow+ellipse(80,116,58,16,'#c6d5cb')+`<g transform="translate(9 26)">${tofuPieces}</g>`+tofuPieces,
 sandwich:shadow+path('M31 105l55-67 48 77z','#d1a56f')+path('M33 109l53-61 44 70z','#f4e7c7')+path('M34 115l52-58 43 66z','#9eb773')+path('M35 121l51-55 42 63z','#d28b77')+path('M31 122l55-51 48 66z','#e5c48e'),
 'tea-can':shadow+rect(52,28,56,104,'#bd7954',12)+ellipse(80,31,28,7,'#b9c0b7')+ellipse(80,31,11,3,'#6f7873')+rect(52,65,56,40,'#e6bd81')+path('M70 94q-7-20 21-24-2 22-21 24',' #809064')+ellipse(80,128,26,4,'#aab3ac'),
 map:shadow+path('M22 47l38-15 40 14 38-15v88l-38 15-40-14-38 15z','#e9dfb9')+path('M60 33v87M100 46v88','none','#c9bb90')+path('M28 72l31 13 35-23 37 11M35 124l12-43 21-27 43 49 20 6','none','#b9c7a0')+path('M94 55q-17-25-1-30 20 0 1 30z','#b96350')+ellipse(94,33,4,4,'#f8e9ce'),
 'beef-noodles':shadow+bowl('#d6b477')+path('M45 81q10-8 20 0t20 0 25 0','none','#f0d59d')+toppings('beef'),
 'egg-noodles':shadow+bowl('#d6b477')+path('M75 81q10-8 20 0t22 0','none','#f0d59d')+toppings('egg'),
 'cooked-greens':shadow+ellipse(80,102,57,23,'#e6ece1')+path('M37 97q12-31 26-12 3-32 24-9 30-16 37 20-23 22-40 5-21 20-47-4z','#8da368')+path('M48 96l20 5M77 88l9 11M101 87l9 9','none','#c2d6a2')
};
