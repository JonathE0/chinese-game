# Content map

Generated from `src/content/` by `scripts/content-map.js`; do not edit by hand. Regenerate with
`npm run map` (`npm run check:content` and `npm run verify` also do it). Positions are `x,z`;
the city uses its own coordinates.

## Districts

| id | zh | en | level | gate |
| --- | --- | --- | --- | --- |
| square | 青禾广场 | Qinghe Square | 1 | open |
| market | 商业街 | Shopping Street | 2 | level 1 + words 25 |
| riverside | 河边文化街 | Riverside Quarter | 3 | level 2 + words 30 |
| garden | 莲池公园 | Lotus Pond Park | 1 | open |

## Buildings

| sign | id | district | x,z | interior | build site |
| --- | --- | --- | --- | --- | --- |
| 青禾茶铺 | tea-house | square | -10.5,-8 |  |  |
| 地铁 | metro-station | square | -7.5,14.6 | metro-platform |  |
| 词语馆 | practice-house | square | 0,-22 | hall, reading, studyroom, listening, courtyard |  |
| 小小商店 | souvenir-house | square | 11,-8 |  |  |
| 客栈 | guesthouse | square | -17.5,13 | guesthouse |  |
| 我的家 | home | square | 11,14 | home, study, kitchen |  |
| 青禾超市 | supermarket | market | 28,-9 | supermarket |  |
| 慢慢咖啡 | cafe | market | 28,9 | cafe |  |
| 麦香面包 | bakery | market | 39,-9 | bakery |  |
| 生活馆 | lifestyle | market | 39,9 | lifestyle |  |
| 青禾书馆 | bookshop | market | 48.5,-8 | library |  |
| 服装店 | clothes-shop | market | 49,8 | clothes-shop |  |
| 家常餐厅 | restaurant | riverside | -51,1 | restaurant |  |
| 青禾邮局 | bank | riverside | -29,1 | post-office |  |
| 青禾药店 | pharmacy | riverside | -40,-7 | pharmacy |  |
| 青禾灯具 | lights | market | 58,-8 | lights |  |
| 家居小铺 | homeware | square | -17.5,3 | homeware |  |
| 青禾银行 | bank-branch | square | -18,-6 | bank |  |
| 旧物铺 | resale | square | 15.5,4 | resale |  |
| 青禾茶楼 | teahouse | garden | 12.5,46.5 | teahouse | teahouse |

## Interiors

| id | zh | en | building | stock | opens when | notes |
| --- | --- | --- | --- | --- | --- | --- |
| home | 我的家 | My home | home |  |  | annexes → kitchen, study, decoratable |
| hall | 词语馆 | The word hall | practice-house |  |  | annexes → reading, studyroom, listening, courtyard |
| lifestyle | 生活馆 | Lifestyle store | lifestyle | lifestyle |  | 1 staff |
| cafe | 慢慢咖啡 | Slow coffee | cafe | cafe |  | 1 staff |
| supermarket | 青禾超市 | Qinghe supermarket | supermarket | supermarket |  | 1 staff |
| lights | 青禾灯具 | Qinghe lighting | lights | lights |  | 1 staff |
| restaurant | 家常餐厅 | Home-style restaurant | restaurant | restaurant |  | 2 staff |
| homeware | 家居小铺 | Home goods | homeware | homeware |  | 1 staff |
| resale | 旧物铺 | Second-hand shop | resale |  | purchase:first: Opens once you have bought something in town. | resale panel |
| bank | 青禾银行 | Qinghe bank | bank-branch |  | practice:first: Opens after your first practice session with Xiaomei. | bank panel, 1 staff |
| bakery | 麦香面包 | Wheat-scent bakery | bakery | bakery |  | 1 staff |
| library | 青禾书馆 | Qinghe library | bookshop |  |  | library panel, 1 staff |
| teahouse | 青禾茶楼 | Qinghe tea house | teahouse | teahouse | built:teahouse: Opens once the build site is finished. | 1 staff |
| post-office | 青禾邮局 | Qinghe Post Office | bank |  |  | 1 staff |
| pharmacy | 青禾药店 | Qinghe Pharmacy | pharmacy |  |  | 1 staff |
| guesthouse | 客栈 | Guesthouse | guesthouse |  |  |  |
| clothes-shop | 服装店 | Clothes shop | clothes-shop |  |  | 1 staff |
| study | 书房 | Study | home |  |  | inside only |
| kitchen | 我家的厨房 | Home kitchen | home |  |  | inside only |
| hardware | 星光五金百货 | Starlight hardware & home | city:department |  |  | inside only, 1 staff |
| reading | 阅览室 | Reading room | practice-house |  |  | inside only |
| studyroom | 自习室 | Study room | practice-house |  |  | inside only |
| listening | 听力室 | Listening room | practice-house |  |  | inside only |
| courtyard | 庭院 | Courtyard | practice-house |  |  | inside only |
| metro-platform | 地铁站台 | Metro platform | metro-station |  |  |  |

## Shops and stock

Prices in 学习币; `~` marks a negotiable price. An item sold in several shops is listed under each.

- **chen** (陈叔叔, 小商店): 旅行帽 travel-hat 24~, 明信片 postcard 8~, 草鞋 straw-sandals 9~
- **lifestyle** (生活馆, room lifestyle): 矮桌 low-table 22, 木床 wooden-bed 40, 书架 bookshelf 30, 盆栽 potted-plant 12, 地毯 floor-rug 18, 本子 notebook 6, 笔 pen 4, 亚麻衬衫 linen-shirt 26, 棉裤子 cotton-trousers 22, 草帽 straw-hat 18, 五斗柜 dresser 28, 床头柜 nightstand 12, 书桌 study-desk 26, 椅子 wooden-chair 8, 衣柜 wardrobe 34, 布鞋 cloth-shoes 16, 运动鞋 sport-shoes 34, 茶具 tea-set 14, 屏风 folding-screen 90, 茶几 tea-table 70
- **homeware** (家居小铺, room homeware): 矮桌 low-table 22, 木床 wooden-bed 40, 书架 bookshelf 30, 盆栽 potted-plant 12, 地毯 floor-rug 18, 五斗柜 dresser 28, 床头柜 nightstand 12, 椅子 wooden-chair 8, 竹席 bamboo-mat 10, 圆凳 round-stool 6, 布鞋 cloth-shoes 16, 茶具 tea-set 14, 木料 timber 7, 砖 brick 6, 布匹 cloth-bolt 9, 字画 scroll-painting 45, 山水画 landscape-painting 60, 花瓶 vase 30, 屏风 folding-screen 90, 盆景 bonsai 40, 茶几 tea-table 70, 鸟笼 birdcage 35
- **hardware** (星光五金百货, room hardware): 矮桌 low-table 22, 木床 wooden-bed 40, 书架 bookshelf 30, 纸灯 paper-lamp 14, 盆栽 potted-plant 12, 地毯 floor-rug 18, 五斗柜 dresser 28, 床头柜 nightstand 12, 书桌 study-desk 26, 椅子 wooden-chair 8, 衣柜 wardrobe 34, 吊灯 ceiling-lamp 30, 台灯 desk-lamp 16, 竹席 bamboo-mat 10, 圆凳 round-stool 6, 布鞋 cloth-shoes 16, 茶具 tea-set 14, 木料 timber 7, 砖 brick 6, 布匹 cloth-bolt 9
- **lights** (青禾灯具, room lights): 纸灯 paper-lamp 14, 吊灯 ceiling-lamp 30, 台灯 desk-lamp 16
- **cafe** (慢慢咖啡, room cafe): 咖啡 coffee 9, 蛋糕 cake 11, 面包 bread 7
- **teahouse** (青禾茶楼, room teahouse): 蛋糕 cake 11, 茶 pot-tea 6, 茶具 tea-set 14
- **bakery** (麦香面包, room bakery): 面包 bread 7, 蛋挞 egg-tart 6, 豆沙包 red-bean-bun 5, 草莓甜甜圈 strawberry-donut 8, 菠萝包 pineapple-bun 6
- **supermarket** (青禾超市, room supermarket): 水果 fruit 6, 牛奶 milk 5, 鸡蛋 egg 5, 面条 noodles 4, 蔬菜 vegetable 5, 大米 rice-grain 2, 番茄 tomato 2, 豆腐 tofu 3
- **restaurant** (家常餐厅, room restaurant): 饺子 dumplings 12, 炒饭 fried-rice 14, 汤 hot-soup 8, 青菜 greens 7, 米饭 steamed-rice 4, 茶 pot-tea 6
- **fest-chunjie**: 饺子 dumplings 12
- **fest-yuanxiao**: 汤圆 tangyuan 6
- **fest-duanwu**: 粽子 zongzi 5
- **fest-zhongqiu**: 月饼 mooncake 8
- **nightstall**: 糖葫芦 candied-hawthorn 5, 烤串 lamb-skewer 7, 豆花 tofu-pudding 6
- **kiosk**: 矿泉水 city-water 4, 三明治 city-sandwich 12, 冰红茶 city-tea-can 6, 云海地图 city-map 9
- **noodles**: 小碗牛肉面 city-beef-noodles-small 16, 大碗牛肉面 city-beef-noodles-large 19, 小碗鸡蛋面 city-egg-noodles-small 12, 大碗鸡蛋面 city-egg-noodles-large 15
- **wonton**: 馄饨 wonton 8, 小笼包 xiaolongbao 10
- **noodlestall**: 阳春面 yangchun-noodles 6, 炸酱面 zhajiang-noodles 9
- **breakfast**: 包子 baozi 3, 豆浆 soy-milk 2, 油条 youtiao 2, 煎饼 jianbing 6
- Not sold in any shop: 家常鸡蛋汤面 home-noodle-bowl 9, 家常青菜豆腐饭 home-vegetable-rice 10, 家常番茄豆腐饭 home-tomato-rice 7, 家常番茄鸡蛋面 home-tomato-egg-noodles 11, HSK一级证书 hsk-cert-1 1, HSK二级证书 hsk-cert-2 1, HSK三级证书 hsk-cert-3 1, HSK四级证书 hsk-cert-4 1, HSK五级证书 hsk-cert-5 1, HSK六级证书 hsk-cert-6 1

## NPCs

| id | zh | en | role | lesson | x,z | voice |
| --- | --- | --- | --- | --- | --- | --- |
| lin | 林阿姨 | Auntie Lin | 茶铺 | introductions | -4.8,-9.4 | lin |
| mei | 小美 | Xiaomei | 练习角 |  | -2.9,-6.4 | mei |
| chen | 陈叔叔 | Uncle Chen | 小商店 |  | 4.8,-9.4 | chen |

## Missions (`quests.json`, in order)

| id | zh | done when | where |
| --- | --- | --- | --- |
| greet | 初次见面 | flag introductions | square -4.8,-9.4 茶铺 · 林阿姨 |
| four-words | 认识四个新词 | flag practice:first | square -2.9,-6.4 练习角 · 小美 |
| name-things | 认出十样东西 | discovered ≥ 10 | square 0,5 广场中心 |
| souvenir | 带一份纪念品回家 | flag purchase:first | square 4.8,-9.4 小小商店 · 陈叔叔 |
| furnish | 布置你的房间 | home ≥ 4 | square 11,9.6 我的家 |
| market | 走进商业街 | district (market) | square 19.4,0 商业街的门 |
| order | 用中文点一道菜 | ordered | riverside -51,4.1 家常餐厅 |
| furnish-shop | 去家居小铺看看 | flag homeware:first | square -17.5,-0.6 家居小铺 |
| daily | 完成一件日常小事 | flag daily:first | square 0,9 城里到处都行 |
| metro-first | 坐地铁去云海 | flag metro:first | square -7.5,11.6 青禾地铁站 |
| city-line | 记下城里人说的一句话 | flag city:line |  |
| teahouse-permit | 拿到开店许可证 | flag permit:shop | square -18,-6 青禾银行 |
| teahouse-build | 把茶楼盖起来 | flag built:teahouse | garden 12.5,43.1 茶楼工地 |
| city-directions | 问路找书店 | flag city:found-bookstore |  |
| city-taxi | 用中文打车 | flag city-taxi |  |
| city-noodles | 在海风面馆吃碗面 | flag city-noodles |  |
| home-noodles | 在家做番茄鸡蛋面 | flag cooked:tomato-egg-noodles |  |

## Daily errands (`src/core/daily.js`)

| id | zh | done when | coins |
| --- | --- | --- | --- |
| study | 复习十张词卡 | reviews ≥ 10 | 14 |
| name | 认出五样新东西 | discovered ≥ 5 | 12 |
| grocery | 去买点吃的 | bought-food ≥ 2 | 10 |
| eat | 好好吃一顿 | meals ≥ 1 | 9 |
| visit | 走进两家店 | visits ≥ 2 | 9 |
| chat | 跟人说说话 | talks ≥ 1 | 8 |
| sit | 坐下来歇一会儿 | sits ≥ 1 | 7 |
| tidy | 布置一下房间 | furnished ≥ 1 | 11 |
| cook | 自己做顿饭 | cooked ≥ 1 | 12 |
| order | 用中文点一次餐 | ordered ≥ 1 | 10 |
| hunt | 认出一样带部首的东西 | hunt-found ≥ 1 | 8 |

## City: 云海市中心 (Downtown Yunhai)

- Metro from 青禾地铁站 in the square at -7.5,14.6. Fares: single 6, pass 40 for 7 days. Size 56×68.
- Towers: 云海银行 -17.5,15 · 星光百货 -17.5,0 · 一号书店 -17.5,-16 · 中山医院 17.5,16 · 海风面馆 17.5,1 · 光明电影院 17.5,-15; plus 2 unsigned.
- Props: citylamp ×14, cityplanter ×6, citybench ×6, bin ×2, citycrossing, trafficlight ×2, cityshelter, citykiosk, bigscreen, taxi ×2.
- People: clerk 上班的人 -4.2,11 (3 lines) · student 学生 4.6,-6 (3 lines) · busker 街头艺人 -4.8,-19 (3 lines).
- Door at -10.5,0 leads to interior hardware (进星光五金百货).

## Build sites

| id | zh | district | x,z | permit | needs | unlocks | income |
| --- | --- | --- | --- | --- | --- | --- | --- |
| teahouse | 茶楼工地 | garden | 12.5,46.5 | shop | timber ×8, brick ×6, cloth-bolt ×4 | built:teahouse | 18 |

## Recipes

| id | zh | ingredients | seconds | makes |
| --- | --- | --- | --- | --- |
| noodle-bowl | 鸡蛋汤面 | noodles, egg | 25 | home-noodle-bowl |
| vegetable-rice | 青菜豆腐饭 | rice-grain, vegetable, tofu | 35 | home-vegetable-rice |
| tomato-rice | 番茄豆腐盖饭 | rice-grain, tomato, tofu | 20 | home-tomato-rice |
| tomato-egg-noodles | 番茄鸡蛋面 | noodles, egg, tomato | 25 | home-tomato-egg-noodles |

## Town props and passers-by

- **square**: bench ×3, planter ×3, bin ×2, streetlight ×3, bicycle ×3, bollard, crate ×3, sign, fruitstand; 3 passers-by
- **market**: streetlight ×19, bench ×9, bin ×4, fruitstand ×2, crate ×2, awning ×2, cafetable ×3, chair ×6, parasol, sign ×2, bicycle ×3; 7 passers-by
- **riverside**: bench ×2, streetlight ×2, planter ×4, cafetable, chair; 2 passers-by
- **garden**: ; 0 passers-by

## Words, lessons and reading

- Town words (vocabulary.json): 水 water, 茶 tea, 苹果 apple, 书 book
- Nameable objects (objects.json): 195 (HSK 1 ×18, HSK 3 ×27, HSK 2 ×27, HSK 4 ×24, HSK 5 ×12, HSK 6 ×14, no level ×73)
- Lessons: city-directions 问路 (3 nodes), city-noodles 来一碗面 (5 nodes), city-taxi 打车 (2 nodes), introductions 初次见面 (4 nodes), npc-smalltalk 聊一会儿 (0 nodes)
- Ambient lines: ambient-weather, ambient-walk, ambient-tea, ambient-yes, ambient-bread, ambient-breakfast, ambient-reading, ambient-story, ambient-lunch, ambient-noodles, ambient-river, ambient-later, ambient-park-view, ambient-park-lotus, ambient-park-fish, ambient-park-feed, ambient-snack-wonton, ambient-snack-try, ambient-snack-breakfast, ambient-snack-youtiao, ambient-study-words, ambient-study-count, ambient-study-quiet, ambient-study-like
- Library stories: 早上 morning (level 1, 6 lines), 我的家 my-home (level 1, 6 lines), 买东西 shopping (level 2, 6 lines), 一把伞 umbrella (level 2, 6 lines), 老照片 photographs (level 3, 6 lines), 夜市 night-market (level 4, 6 lines)
- HSK word lists: `public/hsk/words.json` and `src/content/hsk*.json` (large: query them, never read them whole)
