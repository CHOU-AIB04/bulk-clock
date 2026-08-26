/**
 * Nutrients beyond the four macros.
 *
 * Format:  id | fibre | sugar | sodium(mg) | satfat | iron(mg) | calcium(mg)
 *             | potassium(mg) | magnesium(mg) | zinc(mg) | vitaminC(mg) | vitaminD(µg)
 * All values are PER 100 g, from standard food-composition references — the same
 * provenance as the calorie and protein figures in foods.js.
 *
 * An empty field means "not known", NOT "zero". That distinction matters: a day
 * built from foods with no iron figure should say the data is incomplete, not
 * claim you ate no iron. `dayNutrients` reports coverage for exactly this reason.
 *
 * Coverage is deliberately partial. Composition tables are reliable for whole
 * foods and unreliable for composite home-cooked dishes, so the Moroccan dishes
 * and packaged items mostly carry only the values that can be stated honestly.
 */

const RAW = `
chicken_breast|0|0|74|1|1|15|256|29|1|0|0.1
chicken_breast_raw|0|0|65|0.8|0.7|5|334|27|0.7|0|0.1
chicken_thigh|0|0|88|3|1.3|12|240|23|2.1|0|0.1
chicken_leg|0|0|90|4|1.2|12|235|22|2.2|0|0.1
chicken_whole|0|0|86|2.1|1.2|15|250|26|1.9|0|0.1
chicken_mince|0|0|80|2.2|1.1|12|245|25|1.8||
turkey_breast|0|0|60|0.3|1.4|12|300|30|1.7|0|
turkey_mince|0|0|70|1.2|1.3|14|290|28|2.5||
beef_mince_5|0|0|70|3|2.7|12|320|22|6|0|0.1
beef_mince_10|0|0|72|5|2.5|13|300|21|5.7|0|0.1
beef_mince_20|0|0|75|7.6|2.4|14|280|19|5.4|0|0.1
beef_steak|0|0|60|4|2.9|12|330|25|5.9|0|0.1
beef_stew|0|0|55|5|3.1|14|290|20|7|0|
veal|0|0|80|1.8|1|20|340|27|4.4|0|
lamb_leg|0|0|65|3|1.9|8|320|24|4.5|0|
lamb_chop|0|0|72|9|1.8|10|280|22|4|0|
lamb_mince|0|0|75|9.2|1.7|12|270|21|4.2||
liver_beef|0|0|77|1.6|6.5|6|350|21|5.3|1.9|1.2
rabbit|0|0|47|1|2.3|20|340|24|2.3|0|
egg_whole|0|1.1|124|3.3|1.2|50|126|10|1.1|0|2
egg_white|0|0.7|166|0|0.1|7|163|11|0.03|0|0
egg_yolk|0|0.6|48|9.6|2.7|129|109|5|2.3|0|5.4
egg_fried|0|0.8|207|4.3|1.4|56|138|12|1.3|0|2.2
omelette|0|0.9|300|4.5|1.3|50|130|11|1.2|0|1.9
sardine_fresh|0|0|100|1.5|2.9|85|397|39|1.3|0|4.8
sardine_oil|0|0|505|1.5|2.9|382|397|39|1.3|0|4.8
sardine_tomato|0|1|400|2|2.4|240|350|35|1.2|1|4
tuna_water|0|0|320|0.3|1.3|11|237|30|0.7|0|1.7
tuna_oil|0|0|350|1.5|1.3|12|280|31|0.8|0|2
tuna_fresh|0|0|50|1.6|1|10|400|50|0.6|0|5.7
cod|0|0|78|0.2|0.4|18|413|36|0.5|1|1.2
hake|0|0|90|0.3|0.4|20|400|35|0.5|0|1
whiting|0|0|100|0.3|0.4|60|400|30|0.5||
sole|0|0|110|0.4|0.3|20|380|35|0.5||
salmon|0|0|60|2.5|0.3|15|384|30|0.4|0|13.1
mackerel|0|0|83|4.2|1.6|15|401|97|0.9|0|16.1
anchovy|0|0|3670|2.2|3.3|232|544|69|1.7|0|1
shrimp|0|0|700|0.1|0.5|70|259|39|1.6|0|0.1
calamari|0|0|44|1.9|0.7|32|246|33|1.5|4.7|
mussels|0|0|369|0.9|6.7|33|268|37|2.7|13.6|
milk_whole|0|4.8|44|1.9|0.03|113|143|10|0.4|0|0.1
milk_semi|0|4.8|44|1|0.03|120|150|11|0.4|0|0.1
milk_skim|0|5|42|0.1|0.03|125|156|11|0.4|0|0
milk_powder|0|38.4|371|16.7|0.5|912|1330|85|3.3|8|
yogurt_plain|0|4.7|46|2.1|0.05|121|155|12|0.6|0.5|0.1
yogurt_greek|0|3.2|36|2.7|0.04|100|141|11|0.5|0|0.1
yogurt_greek_0|0|3.2|36|0.1|0.07|110|141|11|0.5|0|0
raib|0|5|50|2|0.05|115|150|12|0.5||
lben|0|4.8|105|0.6|0.05|116|151|11|0.4|1|
cheese_edam|0|1.4|965|20|0.4|731|188|30|3.8|0|0.5
cheese_gouda|0|2.2|819|19.5|0.2|700|121|29|3.9|0|0.5
cheese_mozzarella|0|1|627|10.9|0.4|505|76|20|2.9|0|0.4
cheese_feta|0|4.1|1116|14.9|0.7|493|62|19|2.9|0|0.4
cheese_cottage|0|2.7|364|1.7|0.1|83|104|8|0.4|0|0
cheese_parmesan|0|0.9|1529|17.3|0.8|1184|125|38|2.8|0|0.5
cheese_laughing|0|6|900|13|0.2|450|180|25|2||
cream_fresh|0|2.9|38|19.3|0.1|65|97|9|0.3|0.6|1.1
butter|0|0.1|643|51.4|0.02|24|24|2|0.1|0|1.5
smen|0|0|800|55|0.02|20|20|2|0.1|0|1.5
rice_white_raw|1.3|0.1|5|0.2|0.8|28|115|25|1.1|0|0
rice_white|0.4|0.1|1|0.1|0.2|10|35|12|0.5|0|0
rice_brown_raw|3.5|0.9|7|0.6|1.5|33|223|143|2|0|0
rice_brown|1.8|0.4|4|0.3|0.6|10|79|43|0.6|0|0
couscous_dry|5|0.6|10|0.2|1.1|24|166|44|0.8|0|0
couscous|1.4|0.1|5|0.05|0.4|8|58|8|0.3|0|0
bulgur|4.5|0.1|5|0.05|1|10|68|32|0.6|0|0
quinoa|2.8|0.9|7|0.2|1.5|17|172|64|1.1|0|0
oats_dry|10.6|1|2|1.2|4.7|54|429|177|4|0|0
oats_cooked|1.7|0.3|4|0.2|0.9|9|70|27|0.9|0|0
pasta_dry|3.2|2.7|6|0.3|1.3|21|223|53|1.4|0|0
pasta|1.8|0.6|1|0.1|0.5|7|44|18|0.5|0|0
semolina|3.9|0|1|0.1|1.2|17|186|47|1|0|0
khobz|2.7|3.5|490|0.7|3.2|120|120|25|0.8|0|0
batbout|2.5|2|450|0.6|2.8|90|110|24|0.8||
pita|2.4|0.9|536|0.4|2.9|86|120|25|0.8|0|0
pita_wholewheat|7.4|1.6|340|0.5|3|60|170|70|1.7|0|0
baguette|2.7|3|600|0.6|3.4|60|110|25|0.8|0|0
bread_wholewheat|7|4.3|450|0.8|2.5|100|250|82|1.8|0|0
bread_white|2.7|5|490|0.7|3.6|150|115|23|0.8|0|0
cornflakes|3.3|8|730|0.2|8|8|100|12|0.4|0|0
lentils|7.9|1.8|2|0.05|3.3|19|369|36|1.3|1.5|0
lentils_dry|30.5|2|6|0.2|7.5|56|955|122|4.8|4.5|0
chickpeas|7.6|4.8|7|0.3|2.9|49|291|48|1.5|1.3|0
chickpeas_dry|17.4|10.7|24|0.6|6.2|105|875|115|3.4|4|0
fava|5.4|1.8|5|0.1|1.5|36|268|43|1|0.3|0
bissara|4|0.8|300|0.5|1.4|30|250|40|0.9||
white_beans|6.3|0.3|6|0.1|3.7|90|561|63|1.4|0|0
kidney_beans|7.4|0.3|2|0.1|2.9|35|405|45|1.1|1.2|0
split_peas|8.3|2.9|2|0.05|1.3|14|362|36|1|0.4|0
green_peas|5.5|5.7|3|0.1|1.5|25|244|33|1.2|40|0
tofu_firm|2.3|0.6|14|1|2.7|350|121|58|1.6|0.1|0
hummus|6|0.3|379|2|2.4|38|228|71|1.4|0|0
almonds|12.5|4.4|1|3.8|3.7|269|733|270|3.1|0|0
walnuts|6.7|2.6|2|6.1|2.9|98|441|158|3.1|1.3|0
peanuts|8.5|4.7|18|6.3|4.6|92|705|168|3.3|0|0
cashews|3.3|5.9|12|7.8|6.7|37|660|292|5.8|0.5|0
pistachios|10.3|7.7|1|5.9|3.9|105|1025|121|2.2|5.6|0
hazelnuts|9.7|4.3|0|4.5|4.7|114|680|163|2.5|6.3|0
pumpkin_seeds|6|1.4|7|8.7|8.8|46|809|592|7.8|1.9|0
sunflower_seeds|8.6|2.6|9|4.5|5.2|78|645|325|5|1.4|0
sesame_seeds|11.8|0.3|11|7.7|14.6|975|468|351|7.8|0|0
chia_seeds|34.4|0|16|3.3|7.7|631|407|335|4.6|1.6|0
flax_seeds|27.3|1.6|30|3.7|5.7|255|813|392|4.3|0.6|0
peanut_butter|6|9.2|17|6.5|1.9|49|649|168|2.9|0|0
tahini|9.3|0.5|35|8.1|8.9|426|414|95|4.6|0|0
olive_oil|0|0|2|13.8|0.6|1|1|0|0|0|0
argan_oil|0|0|0|16|0|0|0|0|0|0|0
sunflower_oil|0|0|0|10.3|0|0|0|0|0|0|0
olives_green|3.3|0.5|1556|1.4|0.5|52|42|11|0|0|0
olives_black|3.2|0|735|1.4|3.3|88|8|4|0.2|0.9|0
avocado|6.7|0.7|7|2.1|0.6|12|485|29|0.6|10|0
tomato|1.2|2.6|5|0.03|0.3|10|237|11|0.2|14|0
tomato_paste|4.1|12.2|59|0.1|2.9|36|1014|42|0.6|21|0
cucumber|0.5|1.7|2|0.01|0.3|16|147|13|0.2|2.8|0
onion|1.7|4.2|4|0.04|0.2|23|146|10|0.2|7.4|0
onion_cooked|1.6|4.5|3|0.04|0.2|22|132|10|0.2|5.2|0
garlic|2.1|1|17|0.09|1.7|181|401|25|1.2|31|0
carrot|2.8|4.7|69|0.03|0.3|33|320|12|0.2|5.9|0
carrot_cooked|3|3.5|58|0.02|0.3|30|235|10|0.2|3.6|0
courgette|1|2.5|8|0.08|0.4|16|261|18|0.3|17.9|0
aubergine|3|3.5|2|0.03|0.2|9|229|14|0.2|2.2|0
pepper_bell|2.1|4.2|4|0.06|0.4|7|211|12|0.1|128|0
pepper_green|1.7|2.4|3|0.06|0.3|10|175|10|0.1|80|0
potato|2.2|0.8|6|0.03|0.8|12|421|23|0.3|19.7|0
potato_fried|3.8|0.3|210|1.9|0.8|18|579|30|0.5|9.7|0
sweet_potato|3|4.2|55|0.02|0.6|30|337|25|0.3|2.4|0
pumpkin|0.5|2.8|1|0.03|0.8|21|340|12|0.3|9|0
turnip|1.8|3.8|67|0.01|0.3|30|191|11|0.3|21|0
cabbage|2.5|3.2|18|0.03|0.5|40|170|12|0.2|36.6|0
cauliflower|2|1.9|30|0.13|0.4|22|299|15|0.3|48.2|0
broccoli|2.6|1.7|33|0.04|0.7|47|316|21|0.4|89.2|0
spinach|2.4|0.4|70|0.06|3.6|136|466|87|0.8|9.8|0
spinach_raw|2.2|0.4|79|0.06|2.7|99|558|79|0.5|28.1|0
green_beans|3.4|3.3|6|0.05|1|37|211|25|0.2|12.2|0
lettuce|1.3|0.8|28|0.02|0.9|36|194|13|0.2|9.2|0
beetroot|2.8|6.8|78|0.02|0.8|16|325|23|0.4|4.9|0
mushroom|1|1.7|5|0.05|0.5|3|318|9|0.5|2.1|0.2
okra|3.2|1.5|7|0.02|0.6|82|299|57|0.6|23|0
celery|1.6|1.3|80|0.04|0.2|40|260|11|0.1|3.1|0
parsley|3.3|0.9|56|0.13|6.2|138|554|50|1.1|133|0
coriander|2.8|0.9|46|0.01|1.8|67|521|26|0.5|27|0
banana|2.6|12.2|1|0.11|0.3|5|358|27|0.2|8.7|0
apple|2.4|10.4|1|0.03|0.1|6|107|5|0|4.6|0
orange|2.4|9.4|0|0.02|0.1|40|181|10|0.1|53.2|0
clementine|1.7|9.2|1|0.03|0.1|30|177|10|0.1|48.8|0
grapes|0.9|15.5|2|0.05|0.4|10|191|7|0.1|3.2|0
strawberry|2|4.9|1|0.02|0.4|16|153|13|0.1|58.8|0
watermelon|0.4|6.2|1|0.02|0.2|7|112|10|0.1|8.1|0
melon|0.9|7.9|16|0.04|0.2|9|267|12|0.2|36.7|0
peach|1.5|8.4|0|0.02|0.3|6|190|9|0.2|6.6|0
pear|3.1|9.8|1|0.02|0.2|9|116|7|0.1|4.3|0
apricot|2|9.2|1|0.03|0.4|13|259|10|0.2|10|0
apricot_dried|7.3|53.4|10|0.02|2.7|55|1162|32|0.4|1|0
fig_fresh|2.9|16.3|1|0.06|0.4|35|232|17|0.2|2|0
fig_dried|9.8|47.9|10|0.14|2|162|680|68|0.5|1.2|0
dates|8|63.4|2|0.03|1|39|656|43|0.3|0.4|0
dates_medjool|6.7|66.5|1|0.03|0.9|64|696|54|0.4|0|0
raisins|3.7|59.2|11|0.09|1.9|50|749|32|0.2|2.3|0
prunes|7.1|38.1|2|0.09|0.9|43|732|41|0.4|0.6|0
pomegranate|4|13.7|3|0.12|0.3|10|236|12|0.4|10.2|0
kiwi|3|9|3|0.03|0.3|34|312|17|0.1|92.7|0
mango|1.6|13.7|1|0.06|0.2|11|168|10|0.1|36.4|0
pineapple|1.4|9.9|1|0.01|0.3|13|109|12|0.1|47.8|0
lemon|2.8|2.5|2|0.04|0.6|26|138|8|0.1|53|0
honey|0.2|82.1|4|0|0.4|6|52|2|0.2|0.5|0
sugar|0|99.8|1|0|0|1|2|0|0|0|0
jam|1|60|32|0|0.4|20|77|5|0.1|4|0
chocolate_dark|10.9|24|20|24.5|11.9|73|715|228|3.3|0|0
chocolate_milk|3.4|51.5|79|19|2.4|189|372|63|2.3|0|0
nutella|3.4|56.3|41|10.6|3.6|108|407|64|1.1|0|0
biscuit_petit|2.5|22|450|4|2.5|60|150|20|0.5|0|0
croissant|2.6|11.3|477|11.4|2.2|37|118|16|0.6|0.2|0
ice_cream|0.7|21.2|80|8.4|0.1|128|199|14|0.7|0.6|0.2
crisps|4.4|0.3|525|3.2|1.6|24|1275|63|1|31|0
popcorn|14.5|0.5|8|1.4|3.2|7|329|144|3.1|0|0
water|0|0|0|0|0|0|0|0|0|0|0
coffee_black|0|0|2|0|0|2|49|3|0|0|0
orange_juice|0.2|8.4|1|0.01|0.2|11|200|11|0.1|50|0
apple_juice|0.2|9.6|4|0.01|0.1|8|101|5|0|0.9|0
cola|0|10.6|4|0|0.1|2|2|0|0|0|0
soda_orange|0|11.5|12|0|0.1|3|2|0|0|0|0
energy_drink|0|11|100|0|0|4|2|1|0|0|0
whey_protein|0|5|300|1.5|1|500|400|60|2|0|0
casein|0|4|350|1.2|0.5|700|300|30|3|0|0
creatine|0|0|0|0|0|0|0|0|0|0|0
`;

const FIELDS = ["fiber", "sugar", "sodium", "satfat", "iron", "calcium", "potassium", "magnesium", "zinc", "vitC", "vitD"];

export const NUTRIENTS = Object.fromEntries(
  RAW.trim().split("\n").map(line => {
    const parts = line.split("|");
    const id = parts[0];
    const row = {};
    FIELDS.forEach((f, i) => {
      const v = parts[i + 1];
      row[f] = v === "" || v == null ? null : +v;
    });
    return [id, row];
  })
);

/** Everything the app can display, with its unit and how it should be read. */
export const NUTRIENT_META = [
  { key: "fiber", label: "Fibre", unit: "g", goal: 30, kind: "target", note: "Aim high on a bulk — volume of food is the limiting factor, and fibre is what keeps digestion working at 3 000 kcal." },
  { key: "sugar", label: "Sugar", unit: "g", goal: 90, kind: "limit", note: "Total sugars, including the ones naturally in fruit and milk. Only the added kind is worth worrying about." },
  { key: "sodium", label: "Sodium", unit: "mg", goal: 2300, kind: "limit", note: "The upper guideline for adults. Training in heat raises what you lose and therefore what you need." },
  { key: "satfat", label: "Saturated fat", unit: "g", goal: 25, kind: "limit", note: "Roughly 10% of a 2 500 kcal intake, the usual guideline ceiling." },
  { key: "iron", label: "Iron", unit: "mg", goal: 8, goalFemale: 18, kind: "target", note: "Higher for menstruating women. Meat iron absorbs far better than plant iron; vitamin C alongside helps the plant kind." },
  { key: "calcium", label: "Calcium", unit: "mg", goal: 1000, kind: "target", note: "Bone loading from lifting only helps if the raw material is there." },
  { key: "potassium", label: "Potassium", unit: "mg", goal: 3500, kind: "target", note: "Almost everyone is under. Fruit, potatoes, beans and dairy are where it comes from." },
  { key: "magnesium", label: "Magnesium", unit: "mg", goal: 400, goalFemale: 310, kind: "target", note: "Nuts, seeds, wholegrains and dark chocolate. Commonly short in low-variety diets." },
  { key: "zinc", label: "Zinc", unit: "mg", goal: 11, goalFemale: 8, kind: "target", note: "Meat, shellfish, seeds. Relevant to recovery and to testosterone at the low end." },
  { key: "vitC", label: "Vitamin C", unit: "mg", goal: 90, goalFemale: 75, kind: "target", note: "Easy to hit with any fruit or peppers. Also improves iron absorption from plants." },
  { key: "vitD", label: "Vitamin D", unit: "µg", goal: 15, kind: "target", note: "Almost impossible to hit from food alone — oily fish and eggs are the only real sources. Sunlight or a supplement does the rest." }
];

export const NUTRIENT_BY_KEY = Object.fromEntries(NUTRIENT_META.map(n => [n.key, n]));

/** The target for one nutrient, taking sex into account where it differs. */
export function nutrientGoal(key, sex = "male") {
  const meta = NUTRIENT_BY_KEY[key];
  if (!meta) return null;
  return sex === "female" && meta.goalFemale != null ? meta.goalFemale : meta.goal;
}

/** Does the app know anything at all about this food beyond its macros? */
export function hasNutrients(foodId) {
  return !!NUTRIENTS[foodId];
}

/** Scaled nutrient values for a number of grams, or null where unknown. */
export function nutrientsForGrams(foodId, grams) {
  const row = NUTRIENTS[foodId];
  if (!row || !grams) return null;
  const k = grams / 100;
  const out = {};
  for (const f of FIELDS) out[f] = row[f] == null ? null : row[f] * k;
  return out;
}

export const NUTRIENT_FIELDS = FIELDS;
