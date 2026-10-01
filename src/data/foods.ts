/**
 * Seed food library (per 100 g, approximate USDA FoodData Central values).
 * NOTE: the spec asks to start from /reference workbook's "Food Database" tab;
 * that file was not present in the repository, so these are USDA-based
 * defaults. Edit in Settings → Food library or re-seed from the workbook.
 *
 * household_unit: the unit the example days are written in; household_g:
 * grams in ONE unit.
 */
export type FoodCategory = "protein" | "carb" | "fat" | "vegetable" | "fruit" | "dairy" | "other";
export type Diet = "meat" | "fish" | "vegetarian" | "vegan";

export interface FoodSeed {
  slug: string;
  name: string;
  category: FoodCategory;
  per_100g_cal: number;
  per_100g_protein: number;
  per_100g_carb: number;
  per_100g_fat: number;
  household_unit: string;
  household_g: number;
  household_portion_text: string;
  allergens: string[];
  dietary_tags: string[];
}

type Row = [string, string, FoodCategory, number, number, number, number, string, number, string[], Diet, boolean];

const rows: Row[] = [
  // ---- Protein -------------------------------------------------------------
  ["chicken_breast", "Chicken breast, skinless, cooked", "protein", 165, 31, 0, 3.6, "oz cooked", 28.35, [], "meat", true],
  ["chicken_thigh", "Chicken thigh, skinless, cooked", "protein", 179, 24.8, 0, 8.2, "oz cooked", 28.35, [], "meat", true],
  ["turkey_breast", "Turkey breast, roasted", "protein", 147, 30, 0, 2, "oz cooked", 28.35, [], "meat", true],
  ["ground_turkey_93", "Ground turkey 93% lean, cooked", "protein", 213, 27, 0, 11.6, "oz cooked", 28.35, [], "meat", true],
  ["ground_beef_93", "Ground beef 93% lean, cooked", "protein", 196, 26, 0, 10, "oz cooked", 28.35, [], "meat", true],
  ["sirloin", "Top sirloin steak, lean, cooked", "protein", 183, 29, 0, 7, "oz cooked", 28.35, [], "meat", true],
  ["pork_tenderloin", "Pork tenderloin, cooked", "protein", 143, 26, 0, 3.5, "oz cooked", 28.35, [], "meat", true],
  ["salmon", "Salmon, cooked", "protein", 206, 22, 0, 12.4, "oz cooked", 28.35, ["fish"], "fish", true],
  ["tuna_canned", "Tuna, canned in water, drained", "protein", 116, 26, 0, 1, "oz drained", 28.35, ["fish"], "fish", true],
  ["cod", "Cod, cooked", "protein", 105, 23, 0, 0.9, "oz cooked", 28.35, ["fish"], "fish", true],
  ["tilapia", "Tilapia, cooked", "protein", 128, 26, 0, 2.7, "oz cooked", 28.35, ["fish"], "fish", true],
  ["shrimp", "Shrimp, cooked", "protein", 99, 24, 0.2, 0.3, "oz cooked", 28.35, ["shellfish"], "fish", true],
  ["sardines", "Sardines, canned in oil, drained", "protein", 208, 24.6, 0, 11.5, "oz drained", 28.35, ["fish"], "fish", true],
  ["eggs", "Eggs, whole", "protein", 143, 12.6, 0.7, 9.5, "large egg", 50, ["egg"], "vegetarian", true],
  ["egg_whites", "Egg whites", "protein", 52, 10.9, 0.7, 0.2, "large egg white", 33, ["egg"], "vegetarian", true],
  ["tofu_firm", "Tofu, firm", "protein", 144, 17.3, 2.8, 8.7, "oz", 28.35, ["soy"], "vegan", true],
  ["tempeh", "Tempeh", "protein", 192, 20.3, 7.6, 10.8, "oz", 28.35, ["soy"], "vegan", true],
  ["edamame", "Edamame, shelled, cooked", "protein", 121, 11.9, 8.9, 5.2, "cup", 155, ["soy"], "vegan", true],
  ["seitan", "Seitan", "protein", 141, 25, 5, 2, "oz", 28.35, ["wheat", "gluten"], "vegan", false],
  ["whey_protein", "Whey protein powder", "protein", 390, 80, 7, 5, "scoop", 30, ["milk"], "vegetarian", true],
  ["pea_protein", "Pea protein powder", "protein", 380, 80, 4, 6, "scoop", 30, [], "vegan", true],

  // ---- Dairy & alternatives ------------------------------------------------
  ["greek_yogurt_nonfat", "Greek yogurt, plain, nonfat", "dairy", 59, 10.2, 3.6, 0.4, "cup", 245, ["milk"], "vegetarian", true],
  ["cottage_cheese_2", "Cottage cheese, 2%", "dairy", 84, 11, 4.3, 2.3, "cup", 226, ["milk"], "vegetarian", true],
  ["mozzarella_part_skim", "Mozzarella, part-skim (string cheese)", "dairy", 254, 24.3, 2.8, 15.9, "oz / stick", 28.35, ["milk"], "vegetarian", true],
  ["cheddar", "Cheddar cheese", "dairy", 403, 22.9, 3.1, 33.1, "oz", 28.35, ["milk"], "vegetarian", true],
  ["milk_1pct", "Milk, 1%", "dairy", 42, 3.4, 5, 1, "cup", 244, ["milk"], "vegetarian", true],
  ["milk_skim", "Milk, skim", "dairy", 34, 3.4, 5, 0.1, "cup", 244, ["milk"], "vegetarian", true],
  ["soy_milk", "Soy milk, unsweetened", "dairy", 33, 2.9, 1.7, 1.6, "cup", 243, ["soy"], "vegan", true],

  // ---- Carbohydrate --------------------------------------------------------
  ["oats", "Rolled oats, dry", "carb", 379, 13.2, 67.7, 6.5, "cup dry", 81, [], "vegan", false],
  ["white_rice", "White rice, cooked", "carb", 130, 2.7, 28.2, 0.3, "cup cooked", 158, [], "vegan", true],
  ["brown_rice", "Brown rice, cooked", "carb", 123, 2.7, 25.6, 1, "cup cooked", 202, [], "vegan", true],
  ["quinoa", "Quinoa, cooked", "carb", 120, 4.4, 21.3, 1.9, "cup cooked", 185, [], "vegan", true],
  ["sweet_potato", "Sweet potato, baked", "carb", 90, 2, 20.7, 0.2, "medium sweet potato", 150, [], "vegan", true],
  ["potato", "Potato, baked with skin", "carb", 93, 2.5, 21, 0.1, "medium potato", 173, [], "vegan", true],
  ["ww_bread", "Whole-wheat bread", "carb", 252, 12.4, 42.7, 3.5, "slice", 32, ["wheat", "gluten"], "vegan", false],
  ["ww_pasta", "Whole-wheat pasta, cooked", "carb", 149, 5.8, 30, 1.7, "cup cooked", 140, ["wheat", "gluten"], "vegan", false],
  ["pasta", "Pasta, cooked", "carb", 158, 5.8, 30.9, 0.9, "cup cooked", 140, ["wheat", "gluten"], "vegan", false],
  ["corn_tortilla", "Corn tortilla (6-inch)", "carb", 218, 5.7, 44.6, 2.9, "tortilla", 26, [], "vegan", true],
  ["flour_tortilla", "Flour tortilla (8-inch)", "carb", 312, 8.3, 51.6, 8, "tortilla", 45, ["wheat", "gluten"], "vegan", false],
  ["english_muffin", "Whole-wheat English muffin", "carb", 203, 8.8, 40, 2.1, "muffin", 66, ["wheat", "gluten"], "vegan", false],
  ["rice_cakes", "Rice cakes, plain", "carb", 387, 8.2, 81.5, 2.8, "cake", 9, [], "vegan", true],
  ["couscous", "Couscous, cooked", "carb", 112, 3.8, 23.2, 0.2, "cup cooked", 157, ["wheat", "gluten"], "vegan", false],
  ["barley", "Pearled barley, cooked", "carb", 123, 2.3, 28.2, 0.4, "cup cooked", 157, ["gluten"], "vegan", false],
  ["lentils", "Lentils, cooked", "carb", 116, 9, 20.1, 0.4, "cup cooked", 198, [], "vegan", true],
  ["black_beans", "Black beans, cooked", "carb", 132, 8.9, 23.7, 0.5, "cup cooked", 172, [], "vegan", true],
  ["chickpeas", "Chickpeas, cooked", "carb", 164, 8.9, 27.4, 2.6, "cup cooked", 164, [], "vegan", true],
  ["corn", "Sweet corn kernels, cooked", "carb", 96, 3.4, 21, 1.5, "cup", 145, [], "vegan", true],
  ["green_peas", "Green peas, cooked", "carb", 84, 5.4, 15.6, 0.2, "cup", 160, [], "vegan", true],

  // ---- Fruit ---------------------------------------------------------------
  ["banana", "Banana", "fruit", 89, 1.1, 22.8, 0.3, "medium banana", 118, [], "vegan", true],
  ["apple", "Apple", "fruit", 52, 0.3, 13.8, 0.2, "medium apple", 182, [], "vegan", true],
  ["blueberries", "Blueberries", "fruit", 57, 0.7, 14.5, 0.3, "cup", 148, [], "vegan", true],
  ["strawberries", "Strawberries", "fruit", 32, 0.7, 7.7, 0.3, "cup", 152, [], "vegan", true],
  ["orange", "Orange", "fruit", 47, 0.9, 11.8, 0.1, "medium orange", 131, [], "vegan", true],
  ["grapes", "Grapes", "fruit", 69, 0.7, 18.1, 0.2, "cup", 151, [], "vegan", true],
  ["pineapple", "Pineapple chunks", "fruit", 50, 0.5, 13.1, 0.1, "cup", 165, [], "vegan", true],
  ["raisins", "Raisins", "fruit", 299, 3.1, 79.2, 0.5, "¼-cup portion", 40, [], "vegan", true],
  ["mango", "Mango", "fruit", 60, 0.8, 15, 0.4, "cup", 165, [], "vegan", true],
  ["pear", "Pear", "fruit", 57, 0.4, 15.2, 0.1, "medium pear", 178, [], "vegan", true],

  // ---- Fat -----------------------------------------------------------------
  ["olive_oil", "Olive oil", "fat", 884, 0, 0, 100, "tbsp", 13.5, [], "vegan", true],
  ["avocado", "Avocado", "fat", 160, 2, 8.5, 14.7, "medium avocado", 136, [], "vegan", true],
  ["almonds", "Almonds", "fat", 579, 21.2, 21.6, 49.9, "oz (about 23)", 28.35, ["tree_nut"], "vegan", true],
  ["walnuts", "Walnuts", "fat", 654, 15.2, 13.7, 65.2, "oz", 28.35, ["tree_nut"], "vegan", true],
  ["cashews", "Cashews", "fat", 553, 18.2, 30.2, 43.9, "oz", 28.35, ["tree_nut"], "vegan", true],
  ["peanut_butter", "Peanut butter", "fat", 588, 25, 20, 50, "tbsp", 16, ["peanut"], "vegan", true],
  ["almond_butter", "Almond butter", "fat", 614, 21, 18.8, 55.5, "tbsp", 16, ["tree_nut"], "vegan", true],
  ["chia_seeds", "Chia seeds", "fat", 486, 16.5, 42.1, 30.7, "tbsp", 12, [], "vegan", true],
  ["flaxseed", "Ground flaxseed", "fat", 534, 18.3, 28.9, 42.2, "tbsp", 7, [], "vegan", true],
  ["pumpkin_seeds", "Pumpkin seeds", "fat", 559, 30.2, 10.7, 49, "oz", 28.35, [], "vegan", true],
  ["sunflower_seeds", "Sunflower seeds", "fat", 584, 20.8, 20, 51.5, "oz", 28.35, [], "vegan", true],
  ["butter", "Butter", "fat", 717, 0.9, 0.1, 81.1, "tbsp", 14.2, ["milk"], "vegetarian", true],
  ["tahini", "Tahini", "fat", 595, 17, 21.2, 53.8, "tbsp", 15, ["sesame"], "vegan", true],
  ["hummus", "Hummus", "fat", 166, 7.9, 14.3, 9.6, "tbsp", 15, ["sesame"], "vegan", true],
  ["olives", "Olives", "fat", 115, 0.8, 6, 10.7, "large olive", 4.4, [], "vegan", true],
  ["dark_chocolate", "Dark chocolate, 70–85%", "fat", 598, 7.8, 45.9, 42.6, "oz", 28.35, ["milk"], "vegetarian", true],

  // ---- Vegetables ----------------------------------------------------------
  ["broccoli", "Broccoli, cooked", "vegetable", 35, 2.4, 7.2, 0.4, "cup", 156, [], "vegan", true],
  ["spinach", "Spinach, raw", "vegetable", 23, 2.9, 3.6, 0.4, "cup", 30, [], "vegan", true],
  ["romaine", "Romaine lettuce", "vegetable", 17, 1.2, 3.3, 0.3, "cup shredded", 47, [], "vegan", true],
  ["green_beans", "Green beans, cooked", "vegetable", 35, 1.9, 7.9, 0.3, "cup", 125, [], "vegan", true],
  ["bell_pepper", "Bell pepper, raw", "vegetable", 26, 1, 6, 0.3, "cup chopped", 149, [], "vegan", true],
  ["carrots", "Carrots, raw", "vegetable", 41, 0.9, 9.6, 0.2, "cup chopped", 128, [], "vegan", true],
  ["cauliflower", "Cauliflower, cooked", "vegetable", 23, 1.8, 4.1, 0.5, "cup", 124, [], "vegan", true],
  ["zucchini", "Zucchini, raw", "vegetable", 17, 1.2, 3.1, 0.3, "cup sliced", 113, [], "vegan", true],
  ["asparagus", "Asparagus, cooked", "vegetable", 22, 2.4, 4.1, 0.2, "cup", 180, [], "vegan", true],
  ["brussels_sprouts", "Brussels sprouts, cooked", "vegetable", 36, 2.6, 7.1, 0.5, "cup", 156, [], "vegan", true],
  ["tomato", "Tomato", "vegetable", 18, 0.9, 3.9, 0.2, "medium tomato", 123, [], "vegan", true],
  ["cucumber", "Cucumber", "vegetable", 16, 0.7, 3.6, 0.1, "cup sliced", 119, [], "vegan", true],
  ["mushrooms", "Mushrooms, raw", "vegetable", 22, 3.1, 3.3, 0.3, "cup sliced", 70, [], "vegan", true],
  ["mixed_vegetables", "Mixed vegetables (frozen), cooked", "vegetable", 65, 2.9, 13.1, 0.2, "cup", 182, [], "vegan", true],
  ["onion", "Onion", "vegetable", 40, 1.1, 9.3, 0.1, "medium onion", 110, [], "vegan", true],

  // ---- Other ---------------------------------------------------------------
  ["salsa", "Salsa", "other", 36, 1.5, 7, 0.2, "tbsp", 16, [], "vegan", true],
  ["honey", "Honey", "other", 304, 0.3, 82.4, 0, "tbsp", 21, [], "vegetarian", true],
];

function dietTags(diet: Diet, glutenFree: boolean, allergens: string[]): string[] {
  const tags: string[] = [];
  if (diet === "vegan") tags.push("vegan", "vegetarian", "pescatarian");
  if (diet === "vegetarian") tags.push("vegetarian", "pescatarian");
  if (diet === "fish") tags.push("pescatarian");
  if (glutenFree) tags.push("gluten_free");
  if (!allergens.includes("milk")) tags.push("dairy_free");
  return tags;
}

export const FOODS: FoodSeed[] = rows.map(([slug, name, category, cal, p, c, f, unit, unitG, allergens, diet, gf]) => ({
  slug,
  name,
  category,
  per_100g_cal: cal,
  per_100g_protein: p,
  per_100g_carb: c,
  per_100g_fat: f,
  household_unit: unit,
  household_g: unitG,
  household_portion_text: `1 ${unit} ≈ ${Math.round(unitG)} g`,
  allergens,
  dietary_tags: dietTags(diet, gf, allergens),
}));

export const DIETARY_PATTERNS = ["omnivore", "vegetarian", "vegan", "pescatarian", "gluten_free", "dairy_free"] as const;
export type DietaryPattern = (typeof DIETARY_PATTERNS)[number];

export const ALLERGENS = ["milk", "egg", "fish", "shellfish", "tree_nut", "peanut", "wheat", "gluten", "soy", "sesame"] as const;
