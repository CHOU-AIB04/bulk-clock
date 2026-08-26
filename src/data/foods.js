/**
 * Curated offline food database.
 *
 * Format:  id | name | category | kcal | protein | carbs | fat | unit:grams,unit:grams
 * All macro values are PER 100 g (or per 100 ml for liquids).
 *
 * Values come from standard food-composition references (USDA SR / NCCDB style
 * figures) and, for Moroccan dishes, from typical home-cooked recipe averages.
 * Packaged products vary — scan the barcode or check the label when it matters.
 */

const RAW = `
chicken_breast|Chicken breast, skinless, cooked|Meat & poultry|165|31|0|3.6|fillet:120,small fillet:80
chicken_breast_raw|Chicken breast, skinless, raw|Meat & poultry|120|22.5|0|2.6|fillet:150
chicken_thigh|Chicken thigh, skinless, cooked|Meat & poultry|209|26|0|10.9|thigh:95
chicken_leg|Chicken leg with skin, roasted|Meat & poultry|232|24.5|0|14.5|leg:145
chicken_whole|Chicken, whole, roasted, meat only|Meat & poultry|190|28.9|0|7.4|portion:150
chicken_mince|Chicken mince, cooked|Meat & poultry|172|23.8|0|8.1|
turkey_breast|Turkey breast, cooked|Meat & poultry|135|30|0|1|slice:30
turkey_mince|Turkey mince, lean, cooked|Meat & poultry|118|20|0|4|
beef_mince_5|Beef mince 5% fat, cooked|Meat & poultry|170|26|0|7|
beef_mince_10|Beef mince 10% fat, cooked|Meat & poultry|217|26|0|12.5|
beef_mince_20|Beef mince 20% fat, cooked|Meat & poultry|272|24|0|19.4|
beef_steak|Beef steak, lean, grilled|Meat & poultry|217|31|0|10|steak:180
beef_stew|Beef, stewing cut, braised|Meat & poultry|234|29|0|12.7|
veal|Veal, lean, cooked|Meat & poultry|172|31|0|4.6|
lamb_leg|Lamb leg, roasted, lean|Meat & poultry|191|28|0|8.3|slice:60
lamb_chop|Lamb chop, grilled|Meat & poultry|282|25|0|20|chop:85
lamb_mince|Lamb mince, cooked|Meat & poultry|283|25|0|20|
kefta|Kefta, minced beef/lamb skewer, grilled|Moroccan|247|20|2|17.5|skewer:75
merguez|Merguez sausage, grilled|Moroccan|321|18|1.5|27|sausage:60
liver_beef|Beef liver, cooked|Meat & poultry|175|26.5|5.1|4.8|
heart_lamb|Lamb heart, cooked|Meat & poultry|185|26|1.9|7.9|
rabbit|Rabbit, cooked|Meat & poultry|173|33|0|3.5|
egg_whole|Egg, whole, cooked|Eggs & dairy|155|12.6|1.1|10.6|large:50,medium:44
egg_white|Egg white|Eggs & dairy|52|10.9|0.7|0.2|from 1 large:33
egg_yolk|Egg yolk|Eggs & dairy|322|15.9|3.6|26.5|from 1 large:17
egg_fried|Egg, fried in oil|Eggs & dairy|196|13.6|0.8|15.3|egg:46
omelette|Omelette, 2 eggs with oil|Eggs & dairy|205|13|1.1|16.2|serving:120
sardine_fresh|Sardines, fresh, grilled|Fish & seafood|208|24.6|0|11.5|fish:45
sardine_oil|Sardines, canned in oil, drained|Fish & seafood|208|24.6|0|11.5|tin:90
sardine_tomato|Sardines, canned in tomato sauce|Fish & seafood|162|18.5|1.5|9|tin:120
tuna_water|Tuna, canned in water, drained|Fish & seafood|116|26|0|1|tin:112
tuna_oil|Tuna, canned in oil, drained|Fish & seafood|198|29|0|8.2|tin:112
tuna_fresh|Tuna, fresh, grilled|Fish & seafood|184|30|0|6.3|steak:150
cod|Cod, cooked|Fish & seafood|105|23|0|0.9|fillet:150
hake|Hake, cooked|Fish & seafood|112|23.8|0|1.5|fillet:150
whiting|Whiting, cooked|Fish & seafood|116|24|0|1.7|fillet:130
sole|Sole, cooked|Fish & seafood|117|24|0|1.7|fillet:120
salmon|Salmon, cooked|Fish & seafood|206|22.1|0|12.4|fillet:150
mackerel|Mackerel, cooked|Fish & seafood|262|23.9|0|17.8|fillet:120
anchovy|Anchovies, canned, drained|Fish & seafood|210|29|0|9.7|fillet:4
shrimp|Shrimp, cooked|Fish & seafood|99|24|0.2|0.3|
calamari|Squid, cooked|Fish & seafood|175|17.9|7.8|7.5|
mussels|Mussels, cooked|Fish & seafood|172|23.8|7.4|4.5|
milk_whole|Milk, whole|Eggs & dairy|61|3.2|4.8|3.3|glass:200,cup:240
milk_semi|Milk, semi-skimmed|Eggs & dairy|47|3.4|4.8|1.6|glass:200
milk_skim|Milk, skimmed|Eggs & dairy|34|3.4|5|0.1|glass:200
milk_powder|Milk powder, whole|Eggs & dairy|496|26.3|38.4|26.7|tbsp:8
yogurt_plain|Yogurt, plain, whole|Eggs & dairy|61|3.5|4.7|3.3|pot:125
yogurt_greek|Greek yogurt, plain|Eggs & dairy|72|10|3.6|2|pot:125,serving:150
yogurt_greek_0|Greek yogurt, 0% fat|Eggs & dairy|59|10.3|3.6|0.4|pot:125
raib|Raib, Moroccan set yogurt drink|Moroccan|72|3.1|9.2|2.6|pot:110
lben|Lben, fermented buttermilk|Moroccan|40|3.3|4.8|0.9|glass:200
cheese_jben|Jben, fresh Moroccan cheese|Moroccan|98|12.4|3.5|4.3|portion:50
cheese_laughing|Laughing Cow style spread|Eggs & dairy|267|10|7|22|portion:17
cheese_edam|Edam cheese|Eggs & dairy|357|25|1.4|28|slice:20
cheese_gouda|Gouda cheese|Eggs & dairy|356|25|2.2|27.4|slice:20
cheese_mozzarella|Mozzarella|Eggs & dairy|280|22|2.2|20|ball:125
cheese_feta|Feta|Eggs & dairy|264|14.2|4.1|21.3|cube:15
cheese_cottage|Cottage cheese|Eggs & dairy|98|11.1|3.4|4.3|serving:150
cheese_parmesan|Parmesan|Eggs & dairy|392|35.8|3.2|25.8|tbsp:5
cream_fresh|Cream, single|Eggs & dairy|193|2.9|3.9|19|tbsp:15
butter|Butter|Fats & oils|717|0.9|0.1|81|tsp:5,tbsp:14
smen|Smen, preserved Moroccan butter|Moroccan|717|0.5|0.5|81|tsp:5
rice_white_raw|White rice, uncooked|Grains & bread|365|7.1|80|0.7|
rice_white|White rice, cooked|Grains & bread|130|2.7|28.2|0.3|cup:158
rice_brown_raw|Brown rice, uncooked|Grains & bread|368|7.5|76.2|2.9|
rice_brown|Brown rice, cooked|Grains & bread|123|2.7|25.6|1|cup:195
couscous_dry|Couscous, dry|Grains & bread|376|12.8|77.4|0.6|
couscous|Couscous, cooked|Grains & bread|112|3.8|23.2|0.2|cup:157
bulgur|Bulgur, cooked|Grains & bread|83|3.1|18.6|0.2|cup:182
quinoa|Quinoa, cooked|Grains & bread|120|4.4|21.3|1.9|cup:185
oats_dry|Oats, dry|Grains & bread|371|13.2|60|7|tbsp:10,serving:40
oats_cooked|Porridge, cooked with water|Grains & bread|71|2.5|12|1.4|bowl:250
pasta_dry|Pasta, dry|Grains & bread|371|13|74.7|1.5|
pasta|Pasta, cooked|Grains & bread|131|5|25|1.1|cup:140
semolina|Semolina, dry|Grains & bread|360|12.7|72.8|1.1|
khobz|Khobz, Moroccan round bread|Moroccan|266|8.5|52|2.5|loaf:80,quarter:20
batbout|Batbout, Moroccan pan bread|Moroccan|262|8|53|2|piece:60
msemen|Msemen, layered flatbread|Moroccan|338|6.5|45|14.5|piece:70
harcha|Harcha, semolina griddle bread|Moroccan|372|6|48|17|piece:65
baghrir|Baghrir, thousand-hole pancake|Moroccan|207|5.5|40|2.6|piece:50
sfenj|Sfenj, Moroccan doughnut|Moroccan|352|6|44|17|piece:70
pita|Pita bread, white|Grains & bread|275|9.1|55.7|1.2|piece:60
pita_wholewheat|Pita bread, wholewheat|Grains & bread|266|9.8|55.1|2.6|piece:64
baguette|Baguette, white|Grains & bread|274|9|54|2|piece:60
bread_wholewheat|Wholewheat bread|Grains & bread|247|13|41|4.2|slice:32
bread_white|White bread|Grains & bread|265|9|49|3.2|slice:28
cornflakes|Cornflakes|Grains & bread|357|7.5|84|0.4|bowl:30
lentils|Lentils, cooked|Legumes|116|9|20.1|0.4|cup:198,serving:200
lentils_dry|Lentils, dry|Legumes|352|24.6|63.4|1.1|
chickpeas|Chickpeas, cooked|Legumes|164|8.9|27.4|2.6|cup:164
chickpeas_dry|Chickpeas, dry|Legumes|378|20.5|62.9|6|
fava|Fava beans (foul), cooked|Legumes|110|7.6|19.6|0.4|cup:170
bissara|Bissara, split fava soup|Moroccan|118|6.5|16|3.2|bowl:250
white_beans|White beans (loubia), cooked|Legumes|139|9.7|25.1|0.4|cup:179
kidney_beans|Kidney beans, cooked|Legumes|127|8.7|22.8|0.5|cup:177
split_peas|Split peas, cooked|Legumes|118|8.3|21.1|0.4|cup:196
green_peas|Green peas, cooked|Vegetables|84|5.4|15.6|0.2|cup:160
tofu_firm|Tofu, firm|Legumes|144|17.3|2.8|8.7|block:120
hummus|Hummus|Legumes|166|7.9|14.3|9.6|tbsp:15
almonds|Almonds|Nuts & seeds|579|21.2|21.6|49.9|handful:28,10 nuts:12
walnuts|Walnuts|Nuts & seeds|654|15.2|13.7|65.2|handful:28
peanuts|Peanuts, roasted|Nuts & seeds|587|24.4|21.3|49.7|handful:28
cashews|Cashews|Nuts & seeds|553|18.2|30.2|43.9|handful:28
pistachios|Pistachios|Nuts & seeds|560|20.2|27.2|45.3|handful:28
hazelnuts|Hazelnuts|Nuts & seeds|628|15|16.7|60.8|handful:28
pumpkin_seeds|Pumpkin seeds, dried|Nuts & seeds|559|30.2|10.7|49|tbsp:10,handful:28
sunflower_seeds|Sunflower seeds|Nuts & seeds|584|20.8|20|51.5|tbsp:9
sesame_seeds|Sesame seeds|Nuts & seeds|573|17.7|23.4|49.7|tbsp:9
chia_seeds|Chia seeds|Nuts & seeds|486|16.5|42.1|30.7|tbsp:10
flax_seeds|Flaxseed, ground|Nuts & seeds|534|18.3|28.9|42.2|tbsp:7
peanut_butter|Peanut butter|Nuts & seeds|588|25.1|20|50.4|tbsp:16
tahini|Tahini, sesame paste|Nuts & seeds|595|17|21.2|53.8|tbsp:15
amlou|Amlou, argan almond honey spread|Moroccan|600|13|25|50|tbsp:18
olive_oil|Olive oil|Fats & oils|884|0|0|100|tsp:4.5,tbsp:13.5
argan_oil|Argan oil, culinary|Moroccan|884|0|0|100|tsp:4.5,tbsp:13.5
sunflower_oil|Sunflower oil|Fats & oils|884|0|0|100|tsp:4.5,tbsp:13.5
olives_green|Olives, green|Vegetables|145|1|3.8|15.3|10 olives:35
olives_black|Olives, black|Vegetables|115|0.8|6.3|10.9|10 olives:35
avocado|Avocado|Fruit|160|2|8.5|14.7|half:100
tomato|Tomato, raw|Vegetables|18|0.9|3.9|0.2|medium:120
tomato_paste|Tomato paste|Vegetables|82|4.3|18.9|0.5|tbsp:16
cucumber|Cucumber|Vegetables|15|0.7|3.6|0.1|medium:200
onion|Onion, raw|Vegetables|40|1.1|9.3|0.1|medium:110,slice:38
onion_cooked|Onion, cooked|Vegetables|44|1.4|10.2|0.2|
garlic|Garlic|Vegetables|149|6.4|33.1|0.5|clove:3
carrot|Carrot, raw|Vegetables|41|0.9|9.6|0.2|medium:61
carrot_cooked|Carrot, cooked|Vegetables|35|0.8|8.2|0.2|
courgette|Courgette (zucchini), cooked|Vegetables|17|1.2|3.1|0.3|medium:196
aubergine|Aubergine, cooked|Vegetables|35|0.8|8.7|0.2|medium:250
pepper_bell|Bell pepper, raw|Vegetables|26|1|6|0.3|medium:120
pepper_green|Green pepper, raw|Vegetables|20|0.9|4.6|0.2|medium:120
potato|Potato, boiled|Vegetables|87|1.9|20.1|0.1|medium:150
potato_fried|Potato, fried (chips)|Vegetables|312|3.4|41|15|serving:150
sweet_potato|Sweet potato, cooked|Vegetables|90|2|20.7|0.2|medium:150
pumpkin|Pumpkin, cooked|Vegetables|20|0.7|4.9|0.1|cup:245
turnip|Turnip, cooked|Vegetables|22|0.7|5.1|0.1|
cabbage|Cabbage, raw|Vegetables|25|1.3|5.8|0.1|cup:89
cauliflower|Cauliflower, cooked|Vegetables|23|1.8|4.1|0.5|cup:124
broccoli|Broccoli, cooked|Vegetables|35|2.4|7.2|0.4|cup:156
spinach|Spinach, cooked|Vegetables|23|2.9|3.8|0.4|cup:180
spinach_raw|Spinach, raw|Vegetables|23|2.9|3.6|0.4|handful:30
green_beans|Green beans, cooked|Vegetables|35|1.9|7.9|0.3|cup:125
lettuce|Lettuce|Vegetables|15|1.4|2.9|0.2|leaf:10
beetroot|Beetroot, cooked|Vegetables|44|1.7|10|0.2|
mushroom|Mushrooms, cooked|Vegetables|28|2.2|5.3|0.5|cup:156
okra|Okra, cooked|Vegetables|22|1.9|4.5|0.2|
celery|Celery, raw|Vegetables|16|0.7|3|0.2|stalk:40
parsley|Parsley, fresh|Vegetables|36|3|6.3|0.8|tbsp:4
coriander|Coriander, fresh|Vegetables|23|2.1|3.7|0.5|tbsp:4
mixed_veg|Mixed vegetables, cooked|Vegetables|40|2|8|0.3|serving:150
banana|Banana|Fruit|89|1.1|22.8|0.3|small:81,medium:118,large:136
apple|Apple|Fruit|52|0.3|13.8|0.2|medium:182
orange|Orange|Fruit|47|0.9|11.8|0.1|medium:131
clementine|Clementine|Fruit|47|0.9|12|0.2|piece:74
grapes|Grapes|Fruit|69|0.7|18.1|0.2|cup:151
strawberry|Strawberries|Fruit|32|0.7|7.7|0.3|cup:144
watermelon|Watermelon|Fruit|30|0.6|7.6|0.2|slice:280
melon|Melon, cantaloupe|Fruit|34|0.8|8.2|0.2|slice:160
peach|Peach|Fruit|39|0.9|9.5|0.3|medium:150
pear|Pear|Fruit|57|0.4|15.2|0.1|medium:178
apricot|Apricot, fresh|Fruit|48|1.4|11.1|0.4|piece:35
apricot_dried|Apricots, dried|Fruit|241|3.4|62.6|0.5|piece:8
fig_fresh|Figs, fresh|Fruit|74|0.8|19.2|0.3|piece:50
fig_dried|Figs, dried|Fruit|249|3.3|63.9|0.9|piece:20
dates|Dates, dried (deglet nour)|Fruit|282|2.5|75|0.4|date:8,tbsp chopped:9
dates_medjool|Dates, Medjool|Fruit|277|1.8|75|0.2|date:24
raisins|Raisins|Fruit|299|3.1|79.2|0.5|tbsp:10,handful:28
prunes|Prunes, dried|Fruit|240|2.2|63.9|0.4|piece:9.5
pomegranate|Pomegranate seeds|Fruit|83|1.7|18.7|1.2|cup:174
kiwi|Kiwi|Fruit|61|1.1|14.7|0.5|piece:76
mango|Mango|Fruit|60|0.8|15|0.4|medium:200
pineapple|Pineapple|Fruit|50|0.5|13.1|0.1|slice:84
lemon|Lemon|Fruit|29|1.1|9.3|0.3|piece:58
tagine_chicken|Tagine, chicken with vegetables|Moroccan|121|11.5|6.4|5.4|plate:400
tagine_beef_prune|Tagine, beef with prunes|Moroccan|168|12|13|7.6|plate:400
tagine_kefta_egg|Tagine, kefta with egg|Moroccan|168|13.5|4|11|plate:350
tagine_fish|Tagine, fish chermoula|Moroccan|108|13|5.5|4|plate:400
couscous_plate|Couscous with seven vegetables and meat|Moroccan|148|7.5|20|4.4|plate:450
harira|Harira soup|Moroccan|72|3.9|10.2|1.9|bowl:300
chorba|Chorba, vegetable soup|Moroccan|48|1.9|8.2|0.9|bowl:300
zaalouk|Zaalouk, aubergine salad|Moroccan|92|1.3|6.2|7.1|serving:120
taktouka|Taktouka, pepper tomato salad|Moroccan|78|1.4|6.8|5.2|serving:120
salade_marocaine|Moroccan chopped salad|Moroccan|41|1|4.5|2.4|serving:150
briouat_meat|Briouat, meat filled, fried|Moroccan|318|12|26|18|piece:35
pastilla|Pastilla, chicken|Moroccan|285|13|27|14|slice:150
rfissa|Rfissa with chicken and lentils|Moroccan|175|11|20|6.2|plate:400
tanjia|Tanjia, slow-cooked beef|Moroccan|228|24|1.5|14|serving:250
mechoui|Mechoui, roast lamb|Moroccan|258|26|0|17|serving:200
maakouda|Maakouda, potato fritter|Moroccan|246|4.2|26|14|piece:45
chebakia|Chebakia|Moroccan|452|6|58|22|piece:25
kaab_ghzal|Kaab el Ghzal, almond pastry|Moroccan|412|8|50|20|piece:30
ghriba|Ghriba, almond biscuit|Moroccan|455|8.5|48|26|piece:25
honey|Honey|Sweets & snacks|304|0.3|82.4|0|tsp:7,tbsp:21
sugar|Sugar, white|Sweets & snacks|387|0|100|0|tsp:4,cube:4
jam|Jam, fruit|Sweets & snacks|278|0.4|69|0.1|tbsp:20
chocolate_dark|Dark chocolate, 70%|Sweets & snacks|598|7.8|45.9|42.6|square:10
chocolate_milk|Milk chocolate|Sweets & snacks|535|7.6|59.4|29.7|square:10
nutella|Chocolate hazelnut spread|Sweets & snacks|539|6.3|57.5|30.9|tbsp:20
biscuit_petit|Petit beurre biscuit|Sweets & snacks|455|7|72|15|biscuit:8
croissant|Croissant|Sweets & snacks|406|8.2|45.8|21|piece:60
cake_plain|Sponge cake, plain|Sweets & snacks|364|5.5|53|14.5|slice:60
ice_cream|Ice cream, vanilla|Sweets & snacks|207|3.5|23.6|11|scoop:65
crisps|Potato crisps|Sweets & snacks|536|7|53|34.6|bag:30
popcorn|Popcorn, plain|Sweets & snacks|387|12.9|77.9|4.5|bowl:25
water|Water|Drinks|0|0|0|0|glass:250,bottle:500
mint_tea|Mint tea with sugar|Moroccan|38|0|9.7|0|glass:150
tea_plain|Tea, no sugar|Drinks|1|0|0.3|0|cup:240
coffee_black|Coffee, black|Drinks|2|0.3|0|0|cup:240
coffee_milk|Coffee with milk|Drinks|32|1.7|2.6|1.7|cup:240
nous_nous|Nous-nous, half coffee half milk|Moroccan|45|2.2|3.6|2.5|glass:150
orange_juice|Orange juice, fresh|Drinks|45|0.7|10.4|0.2|glass:250
apple_juice|Apple juice|Drinks|46|0.1|11.3|0.1|glass:250
avocado_smoothie|Avocado milk smoothie|Moroccan|118|2.6|13|6.5|glass:300
cola|Cola|Drinks|42|0|10.6|0|can:330
soda_orange|Orange soda|Drinks|48|0|12.4|0|can:330
energy_drink|Energy drink|Drinks|45|0.4|11|0|can:250
whey_protein|Whey protein powder|Supplements|380|76|8|6|scoop:30
casein|Casein protein powder|Supplements|365|72|9|3|scoop:30
mass_gainer|Mass gainer powder|Supplements|380|18|68|4|scoop:75
creatine|Creatine monohydrate|Supplements|0|0|0|0|scoop:5
protein_bar|Protein bar|Supplements|360|30|38|9|bar:60
`.trim();

export const FOODS = RAW.split("\n").map(line => {
  const [id, name, cat, kcal, p, c, f, units] = line.split("|");
  return {
    id,
    name,
    cat,
    kcal: +kcal, p: +p, c: +c, f: +f,
    units: [
      { label: "g", g: 1 },
      ...(units || "").split(",").filter(Boolean).map(u => {
        const [label, g] = u.split(":");
        return { label, g: +g };
      })
    ]
  };
});

export const FOOD_BY_ID = Object.fromEntries(FOODS.map(f => [f.id, f]));

export const CATEGORIES = [...new Set(FOODS.map(f => f.cat))].sort();

/** Fold accents so "creme" matches "crème" and "zaalouk" matches typing without care. */
const fold = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function searchFoods(query, cat) {
  const q = fold(query.trim());
  let list = FOODS;
  if (cat && cat !== "All") list = list.filter(f => f.cat === cat);
  if (!q) return list.slice(0, 80);
  const scored = [];
  for (const f of list) {
    const n = fold(f.name);
    let score = -1;
    if (n.startsWith(q)) score = 0;
    else if (n.includes(" " + q)) score = 1;
    else if (n.includes(q)) score = 2;
    if (score >= 0) scored.push([score, f]);
  }
  scored.sort((a, b) => a[0] - b[0] || a[1].name.length - b[1].name.length);
  return scored.slice(0, 80).map(s => s[1]);
}

/** Macros for `amount` of `unit` of a food. Everything scales off per-100 g values. */
export function macrosFor(food, amount, unitLabel) {
  const unit = food.units.find(u => u.label === unitLabel) || food.units[0];
  const grams = amount * unit.g;
  const k = grams / 100;
  return {
    grams,
    kcal: food.kcal * k,
    p: food.p * k,
    c: food.c * k,
    f: food.f * k
  };
}
