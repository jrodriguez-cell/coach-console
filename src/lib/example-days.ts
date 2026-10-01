/**
 * Deterministic example-day builder. Assembles days from the seeded food
 * library and solves portions so every day lands inside the tolerance band
 * of each target. Days that don't land inside every band are discarded —
 * nothing outside the band is ever shown.
 */
import type { MacroTargets } from "./nutrition";
import type { ExampleDay, ExampleMeal, FoodPortion, LibFood, SwapRow } from "./plan-types";
import type { DietaryPattern } from "@/data/foods";

export interface FoodPrefs {
  dietaryPattern: DietaryPattern;
  allergies: string[];
  excluded: string[];
}

export function allowedFoods(foods: LibFood[], prefs: FoodPrefs): LibFood[] {
  const allergies = new Set(prefs.allergies.map((a) => a.toLowerCase()));
  if (allergies.has("gluten") || allergies.has("wheat")) {
    allergies.add("gluten");
    allergies.add("wheat");
  }
  const excluded = prefs.excluded.map((e) => e.trim().toLowerCase()).filter((e) => e.length > 1);
  return foods.filter((f) => {
    if (f.allergens.some((a) => allergies.has(a))) return false;
    if (prefs.dietaryPattern !== "omnivore" && !f.dietary_tags.includes(prefs.dietaryPattern)) return false;
    const n = f.name.toLowerCase();
    if (excluded.some((e) => n.includes(e) || (f.slug ?? "").includes(e.replace(/\s+/g, "_")))) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Portion math and household measures
// ---------------------------------------------------------------------------

export function portion(f: LibFood, grams: number): FoodPortion {
  const k = grams / 100;
  return {
    food_id: f.id,
    name: f.name,
    grams,
    household: householdText(f, grams),
    calories: f.per_100g_cal * k,
    protein_g: f.per_100g_protein * k,
    carbs_g: f.per_100g_carb * k,
    fat_g: f.per_100g_fat * k,
  };
}

const FRACTIONS: Record<number, string> = { 0.25: "¼", 0.5: "½", 0.75: "¾" };

export function formatQty(q: number, step = 0.25): string {
  const r = Math.max(step, Math.round(q / step) * step);
  const whole = Math.floor(r + 1e-9);
  const frac = Math.round((r - whole) * 100) / 100;
  const fracText = FRACTIONS[frac] ?? (frac ? String(frac).replace(/^0/, "") : "");
  if (whole === 0) return fracText || "¼";
  return fracText ? `${whole} ${fracText}` : String(whole);
}

function pluralize(unit: string, qty: number): string {
  if (qty <= 1) return unit;
  if (/^(oz|tbsp|tsp|cup)/.test(unit)) return unit.replace(/^cup/, "cups");
  if (/portion$|\(.*\)$/.test(unit)) return unit;
  const [first, ...rest] = unit.split(" ");
  if (rest.length === 0) return first.endsWith("s") ? first : /(potato|tomato)$/.test(first) ? `${first}es` : `${first}s`;
  const last = rest.pop()!;
  const plural = last.endsWith("s") ? last : /(potato|tomato)$/.test(last) ? `${last}es` : `${last}s`;
  return [first, ...rest, plural].join(" ");
}

export function householdText(f: LibFood, grams: number): string {
  const q = grams / f.household_g;
  if (f.household_unit === "tbsp" && q < 1) {
    const tsp = Math.max(0.5, Math.round(q * 3 * 2) / 2);
    return `${formatQty(tsp, 0.5)} tsp`;
  }
  if (f.household_unit.startsWith("oz")) {
    const r = Math.max(0.5, Math.round(q * 2) / 2);
    return `${formatQty(r, 0.5)} ${f.household_unit}`;
  }
  const r = Math.max(0.25, Math.round(q * 4) / 4);
  return `${formatQty(r)} ${pluralize(f.household_unit, r)}`;
}

// ---------------------------------------------------------------------------
// Bounded least-squares portion solver
// ---------------------------------------------------------------------------

interface SolveItem {
  meal?: number;
  food: LibFood;
  grams: number;
  lo: number;
  hi: number;
  fixed: boolean;
  step: number;
}

const MACROS = ["calories", "protein_g", "carbs_g", "fat_g"] as const;

function coeffs(f: LibFood): number[] {
  return [f.per_100g_cal / 100, f.per_100g_protein / 100, f.per_100g_carb / 100, f.per_100g_fat / 100];
}

function totals(items: SolveItem[]): number[] {
  const t = [0, 0, 0, 0];
  for (const it of items) {
    const c = coeffs(it.food);
    for (let k = 0; k < 4; k++) t[k] += c[k] * it.grams;
  }
  return t;
}

/** Soft tolerance (kcal) for spreading calories across meals. */
const MEAL_BALANCE_TOL = 175;

function mealCalories(items: SolveItem[], n: number): number[] {
  const out = new Array(n).fill(0);
  for (const it of items) if (it.meal != null) out[it.meal] += (it.food.per_100g_cal / 100) * it.grams;
  return out;
}

function objective(items: SolveItem[], target: number[], w: number[], shares: number[] | null): number {
  const t = totals(items);
  let s = 0;
  for (let k = 0; k < 4; k++) s += w[k] * (t[k] - target[k]) ** 2;
  if (shares) {
    const mc = mealCalories(items, shares.length);
    const wb = 1 / MEAL_BALANCE_TOL ** 2;
    for (let m = 0; m < shares.length; m++) s += wb * (mc[m] - shares[m]) ** 2;
  }
  return s;
}

/**
 * Bounded least squares on (calories, protein, carbs, fat), weighted by each
 * tolerance, plus a soft term spreading calories across meals (`mealShares`,
 * fractions summing to 1).
 */
export function solvePortions(items: SolveItem[], targets: MacroTargets, mealShares: number[] | null = null): SolveItem[] {
  const target = [targets.calories, targets.protein_g, targets.carbs_g, targets.fat_g];
  const tol = [targets.tolerance.calories, targets.tolerance.protein_g, targets.tolerance.carbs_g, targets.tolerance.fat_g];
  const w = tol.map((t) => 1 / (t * t));
  const shares = mealShares ? mealShares.map((f) => f * targets.calories) : null;
  const wb = 1 / MEAL_BALANCE_TOL ** 2;
  const xs = items.map((i) => ({ ...i }));
  // Projected coordinate descent (continuous).
  for (let iter = 0; iter < 300; iter++) {
    for (const it of xs) {
      if (it.fixed) continue;
      const t = totals(xs);
      const a = coeffs(it.food);
      let num = 0;
      let den = 0;
      for (let k = 0; k < 4; k++) {
        num += w[k] * a[k] * (t[k] - target[k]);
        den += w[k] * a[k] * a[k];
      }
      if (shares && it.meal != null) {
        const mc = mealCalories(xs, shares.length);
        num += wb * a[0] * (mc[it.meal] - shares[it.meal]);
        den += wb * a[0] * a[0];
      }
      if (den === 0) continue;
      it.grams = Math.min(it.hi, Math.max(it.lo, it.grams - num / den));
    }
  }
  // Round to practical steps, then greedy integer polish.
  for (const it of xs) if (!it.fixed) it.grams = Math.min(it.hi, Math.max(it.lo, Math.round(it.grams / it.step) * it.step));
  let best = objective(xs, target, w, shares);
  for (let pass = 0; pass < 200; pass++) {
    let improved = false;
    for (const it of xs) {
      if (it.fixed) continue;
      for (const d of [it.step, -it.step]) {
        const g = it.grams + d;
        if (g < it.lo || g > it.hi) continue;
        it.grams = g;
        const o = objective(xs, target, w, shares);
        if (o < best - 1e-9) {
          best = o;
          improved = true;
        } else {
          it.grams = g - d;
        }
      }
    }
    if (!improved) break;
  }
  return xs;
}

// ---------------------------------------------------------------------------
// Meal templates
// ---------------------------------------------------------------------------

const BREAKFAST_PROTEIN = ["eggs", "greek_yogurt_nonfat", "cottage_cheese_2", "egg_whites", "tofu_firm", "whey_protein", "pea_protein", "soy_milk"];
const BREAKFAST_CARB = ["oats", "ww_bread", "english_muffin", "corn_tortilla", "potato", "sweet_potato"];
const BREAKFAST_FAT = ["peanut_butter", "almond_butter", "chia_seeds", "almonds", "avocado", "flaxseed", "walnuts"];
const SNACK_PROTEIN = ["greek_yogurt_nonfat", "cottage_cheese_2", "whey_protein", "pea_protein", "mozzarella_part_skim", "edamame", "tuna_canned", "turkey_breast"];
const SNACK_SIDE = ["apple", "banana", "blueberries", "strawberries", "orange", "rice_cakes", "grapes", "pear"];
const MAIN_EXCLUDE = new Set(["whey_protein", "pea_protein", "egg_whites", "soy_milk", "oats", "rice_cakes", "raisins", "honey", "salsa", "dark_chocolate", "butter"]);
const MAIN_FAT = ["olive_oil", "avocado", "olives", "tahini", "hummus", "pumpkin_seeds", "sunflower_seeds", "cashews", "cheddar"];

function pick<T>(list: T[], i: number): T | undefined {
  return list.length ? list[((i % list.length) + list.length) % list.length] : undefined;
}

function bySlugs(foods: LibFood[], slugs: string[]): LibFood[] {
  const out: LibFood[] = [];
  for (const s of slugs) {
    const f = foods.find((x) => x.slug === s);
    if (f) out.push(f);
  }
  return out;
}

function bounds(f: LibFood, role: "protein" | "carb" | "fat" | "veg" | "fruit"): { lo: number; hi: number; step: number; fixed: boolean; start: number } {
  const u = f.household_g;
  // Whole units for countable foods (slices, eggs, tortillas…); halves for "medium X".
  const countable = COUNT_UNITS.some((c) => f.household_unit.startsWith(c));
  const step = countable ? u : f.household_unit.startsWith("medium") ? u / 2 : u < 25 ? 1 : 5;
  if (role === "veg") {
    const g = Math.round(Math.min(250, Math.max(75, u * 1.5)) / 5) * 5;
    return { lo: g, hi: g, step, fixed: true, start: g };
  }
  if (role === "fruit") {
    const g = Math.round(u / 5) * 5;
    return { lo: g, hi: g, step, fixed: true, start: g };
  }
  if (role === "fat") return { lo: 0, hi: Math.round(Math.min(u * 3, 60)), step: countable ? u : u < 25 ? 1 : 5, fixed: false, start: countable ? u : Math.min(u, 20) };
  if (role === "protein") {
    if (f.household_unit === "scoop") return { lo: 15, hi: 60, step: 15, fixed: false, start: 30 };
    if (f.household_unit.includes("egg")) return { lo: u, hi: u * 4, step: u, fixed: false, start: u * 2 };
    if (f.category === "dairy") return { lo: 100, hi: 350, step: 5, fixed: false, start: 200 };
    return { lo: 60, hi: 225, step: 5, fixed: false, start: 140 };
  }
  // carb
  if (countable) return { lo: u, hi: u * 3, step, fixed: false, start: u * 2 };
  if (f.household_unit.startsWith("medium")) return { lo: u / 2, hi: u * 2, step, fixed: false, start: u };
  if (f.slug === "oats") return { lo: 20, hi: 120, step: 5, fixed: false, start: 50 };
  return { lo: 40, hi: 350, step: 5, fixed: false, start: 150 };
}

type Role = "protein" | "carb" | "fat" | "veg" | "fruit";

const COUNT_UNITS = ["slice", "tortilla", "muffin", "cake", "large egg", "large olive"];

/** Calorie share per meal, by meal name (normalised to sum to 1). */
function mealShares(names: string[]): number[] {
  const raw = names.map((n) => (n.toLowerCase().includes("snack") ? 0.5 : n === "Breakfast" ? 0.9 : 1.1));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((r) => r / sum);
}

function mealNames(n: number): string[] {
  switch (n) {
    case 2: return ["Meal 1", "Meal 2"];
    case 3: return ["Breakfast", "Lunch", "Dinner"];
    case 4: return ["Breakfast", "Lunch", "Snack", "Dinner"];
    case 5: return ["Breakfast", "Snack", "Lunch", "Snack", "Dinner"];
    default: return ["Breakfast", "Snack", "Lunch", "Snack", "Dinner", "Evening snack"];
  }
}

const LEAN_PROTEIN = ["egg_whites", "cod", "tuna_canned", "shrimp", "chicken_breast", "turkey_breast", "whey_protein", "pea_protein", "greek_yogurt_nonfat", "tofu_firm", "seitan"];
const LEAN_CARB = ["white_rice", "potato", "sweet_potato", "quinoa", "pasta", "banana", "corn_tortilla", "rice_cakes", "oats"];

/**
 * Extra free variables (lo = 0) added to the last main meal when a day can't
 * reach the bands with its base items: a lean protein and a low-fat carb.
 */
function boosters(foods: LibFood[], meal: string, used: Set<string>): { meal: string; role: Role; food: LibFood; booster: true }[] {
  const out: { meal: string; role: Role; food: LibFood; booster: true }[] = [];
  const p = bySlugs(foods, LEAN_PROTEIN).find((f) => !used.has(f.id));
  const c = bySlugs(foods, LEAN_CARB).find((f) => !used.has(f.id));
  if (p) out.push({ meal, role: "protein", food: p, booster: true });
  if (c) out.push({ meal, role: "carb", food: c, booster: true });
  return out;
}

function buildDayItems(foods: LibFood[], mealsPerDay: number, d: number, withFruit: boolean): { meal: string; role: Role; food: LibFood; booster?: true }[][] {
  const bp = bySlugs(foods, BREAKFAST_PROTEIN);
  const bc = bySlugs(foods, BREAKFAST_CARB);
  const bf = bySlugs(foods, BREAKFAST_FAT);
  const sp = bySlugs(foods, SNACK_PROTEIN);
  const ss = bySlugs(foods, SNACK_SIDE);
  const mainProtein = foods.filter((f) => f.category === "protein" && !MAIN_EXCLUDE.has(f.slug ?? ""));
  const legumes = foods.filter((f) => ["lentils", "black_beans", "chickpeas"].includes(f.slug ?? ""));
  const mainCarb = foods.filter((f) => f.category === "carb" && !MAIN_EXCLUDE.has(f.slug ?? "") && !legumes.includes(f));
  const mainFat = bySlugs(foods, MAIN_FAT).length ? bySlugs(foods, MAIN_FAT) : foods.filter((f) => f.category === "fat");
  const veg = foods.filter((f) => f.category === "vegetable");
  const fruit = foods.filter((f) => f.category === "fruit");
  const proteinPool = mainProtein.length ? mainProtein : [...legumes, ...sp];
  const carbPool = mainCarb.length ? mainCarb : legumes;

  const names = mealNames(mealsPerDay);
  let mainIdx = 0;
  return names.map((name, mi) => {
    const items: { meal: string; role: Role; food: LibFood }[] = [];
    const push = (role: Role, f: LibFood | undefined) => f && items.push({ meal: name, role, food: f });
    if (name === "Breakfast" || (name === "Meal 1" && mealsPerDay === 2)) {
      push("protein", pick(bp.length ? bp : proteinPool, d));
      push("carb", pick(bc.length ? bc : carbPool, d * 2 + 1));
      push("fat", pick(bf.length ? bf : mainFat, d));
      if (withFruit) push("fruit", pick(fruit, d));
    } else if (name.toLowerCase().includes("snack")) {
      push("protein", pick(sp.length ? sp : proteinPool, d + mi));
      const side = pick(ss.length ? ss : carbPool, d * 3 + mi);
      push(side?.category === "fruit" ? "fruit" : "carb", side);
    } else {
      const k = d * 2 + mainIdx++;
      push("protein", pick(proteinPool, k * 3 + 1));
      push("carb", pick(carbPool, k * 2 + mi));
      push("veg", pick(veg, k * 2 + mi));
      push("fat", pick(mainFat, k + mi));
    }
    return items;
  });
}

function dedupeWithinMeal<T extends { food: LibFood }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.food.id) ? false : (seen.add(i.food.id), true)));
}

export function withinBands(t: { calories: number; protein_g: number; carbs_g: number; fat_g: number }, targets: MacroTargets) {
  return {
    calories: Math.abs(t.calories - targets.calories) <= targets.tolerance.calories,
    protein_g: Math.abs(t.protein_g - targets.protein_g) <= targets.tolerance.protein_g,
    carbs_g: Math.abs(t.carbs_g - targets.carbs_g) <= targets.tolerance.carbs_g,
    fat_g: Math.abs(t.fat_g - targets.fat_g) <= targets.tolerance.fat_g,
  };
}

export function buildExampleDays(p: { foods: LibFood[]; targets: MacroTargets; mealsPerDay: number; count?: number; prefs: FoodPrefs }): ExampleDay[] {
  const foods = allowedFoods(p.foods, p.prefs);
  const want = Math.min(5, Math.max(3, p.count ?? 4));
  const days: ExampleDay[] = [];
  const seenSignatures = new Set<string>();
  // Scale portion ceilings for high targets spread over few meals.
  const scale = Math.min(1.6, Math.max(1, p.targets.calories / (p.mealsPerDay * 700)));
  const variants = [
    { withFruit: true, boost: false },
    { withFruit: false, boost: false },
    { withFruit: true, boost: true },
    { withFruit: false, boost: true },
  ];
  for (let attempt = 0; attempt < 40 && days.length < want; attempt++) {
    for (const v of variants) {
      let meals = buildDayItems(foods, p.mealsPerDay, attempt, v.withFruit).map(dedupeWithinMeal);
      if (v.boost) {
        const lastMain = [...meals].reverse().find((m) => m.length > 0 && !m[0].meal.toLowerCase().includes("snack"));
        if (lastMain) {
          const used = new Set(meals.flat().map((x) => x.food.id));
          const extra = boosters(foods, lastMain[0].meal, used);
          meals = meals.map((m) => (m === lastMain ? [...m, ...extra] : m));
        }
      }
      const flat = meals.flat();
      if (flat.length === 0) continue;
      const sig = flat.map((x) => x.food.id).join("|");
      if (seenSignatures.has(sig)) continue;
      const mealIndex = new Map<(typeof flat)[number], number>();
      meals.forEach((m, i) => m.forEach((x) => mealIndex.set(x, i)));
      const solveItems: SolveItem[] = flat.map((x) => {
        const b = bounds(x.food, x.role);
        const hi = b.fixed ? b.hi : Math.round((b.hi * scale) / b.step) * b.step;
        const lo = x.booster ? 0 : b.lo;
        return { meal: mealIndex.get(x), food: x.food, grams: x.booster ? 0 : b.start, lo, hi, fixed: b.fixed, step: b.step };
      });
      const solved = solvePortions(solveItems, p.targets, mealShares(meals.map((m) => m[0]?.meal ?? "Meal")));
      const portions = solved.map((s) => portion(s.food, s.grams));
      const t = portions.reduce(
        (a, x) => ({ calories: a.calories + x.calories, protein_g: a.protein_g + x.protein_g, carbs_g: a.carbs_g + x.carbs_g, fat_g: a.fat_g + x.fat_g }),
        { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      );
      const band = withinBands(t, p.targets);
      if (!(band.calories && band.protein_g && band.carbs_g && band.fat_g)) continue;
      seenSignatures.add(sig);
      let idx = 0;
      const outMeals: ExampleMeal[] = meals.map((m) => ({
        name: m[0]?.meal ?? "Meal",
        items: m.map(() => portions[idx++]).filter((x) => x.grams > 0),
      }));
      days.push({
        label: `Example day ${days.length + 1} — example, swap freely`,
        meals: outMeals.filter((m) => m.items.length > 0),
        totals: { calories: Math.round(t.calories), protein_g: Math.round(t.protein_g), carbs_g: Math.round(t.carbs_g), fat_g: Math.round(t.fat_g) },
        within_band: band,
      });
      break;
    }
  }
  return days;
}

// ---------------------------------------------------------------------------
// Swaps, food lists, grocery staples
// ---------------------------------------------------------------------------

export function swapTable(foods: LibFood[]): SwapRow[] {
  const share = (f: LibFood, kcalPerG: number, g: number) => (f.per_100g_cal > 0 ? (g * kcalPerG) / f.per_100g_cal : 0);
  const row = (category: string, basis: SwapRow["basis"], amount: number, filter: (f: LibFood) => boolean, per: (f: LibFood) => number): SwapRow => ({
    category,
    basis,
    options: foods
      .filter(filter)
      .map((f) => {
        const grams = Math.round(amount / (per(f) / 100) / 5) * 5;
        return { name: f.name, grams, household: householdText(f, grams) };
      })
      .slice(0, 12),
  });
  return [
    row("Protein (≈30 g protein)", "protein", 30, (f) => (f.category === "protein" || f.category === "dairy") && share(f, 4, f.per_100g_protein) >= 0.35, (f) => f.per_100g_protein),
    row("Carbohydrate (≈30 g carbs)", "carbs", 30, (f) => (f.category === "carb" || f.category === "fruit") && share(f, 4, f.per_100g_carb) >= 0.5, (f) => f.per_100g_carb),
    row("Fat (≈10 g fat)", "fat", 10, (f) => f.category === "fat" && share(f, 9, f.per_100g_fat) >= 0.6, (f) => f.per_100g_fat),
  ];
}

export function foodLists(foods: LibFood[]): Record<string, { id: string; name: string }[]> {
  const out: Record<string, { id: string; name: string }[]> = {};
  for (const f of foods) (out[f.category] ??= []).push({ id: f.id, name: f.name });
  return out;
}

export function groceryStaples(days: ExampleDay[]): string[] {
  const s = new Set<string>();
  for (const d of days) for (const m of d.meals) for (const i of m.items) s.add(i.name);
  return Array.from(s).sort();
}

export { MACROS };
