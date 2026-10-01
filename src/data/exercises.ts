/**
 * Seed exercise library. `slug` is the stable key; regression/progression
 * reference other slugs and are resolved to ids by the seed script.
 * Equipment tags: bodyweight, box (step/sturdy chair), band, dumbbell,
 * kettlebell, bench, barbell, cable, machine, pullup_bar, medicine_ball.
 * Contraindication tags: shoulder, knee, low_back, wrist, hip, elbow, ankle, neck.
 */
export type Pattern =
  | "squat" | "hinge" | "lunge" | "horizontal_push" | "vertical_push" | "horizontal_pull" | "vertical_pull"
  | "core_anti_extension" | "core_anti_rotation" | "core_flexion" | "carry"
  | "isolation_arms" | "isolation_shoulders" | "isolation_legs" | "isolation_chest" | "power" | "mobility";

export interface ExerciseSeed {
  slug: string;
  name: string;
  pattern: Pattern;
  primary_muscles: string[];
  equipment: string[];
  contraindications: string[];
  regression: string | null;
  progression: string | null;
  is_compound: boolean;
}

type Row = [string, string, Pattern, string[], string[], string[], string | null, string | null, boolean];

const rows: Row[] = [
  // ---- Squat ---------------------------------------------------------------
  ["wall_sit", "Wall Sit", "squat", ["quads"], ["bodyweight"], [], null, "box_squat_bw", false],
  ["box_squat_bw", "Bodyweight Box Squat", "squat", ["quads", "glutes"], ["box"], [], "wall_sit", "bodyweight_squat", true],
  ["bodyweight_squat", "Bodyweight Squat", "squat", ["quads", "glutes"], ["bodyweight"], [], "box_squat_bw", "tempo_bodyweight_squat", true],
  ["tempo_bodyweight_squat", "Tempo Bodyweight Squat (slow lower)", "squat", ["quads", "glutes"], ["bodyweight"], [], "bodyweight_squat", "single_leg_box_squat", true],
  ["single_leg_box_squat", "Single-Leg Box Squat", "squat", ["quads", "glutes"], ["box"], ["knee"], "tempo_bodyweight_squat", null, true],
  ["goblet_box_squat", "Goblet Box Squat", "squat", ["quads", "glutes"], ["dumbbell", "box"], [], "box_squat_bw", "goblet_squat", true],
  ["goblet_squat", "Goblet Squat", "squat", ["quads", "glutes"], ["dumbbell"], [], "goblet_box_squat", "heels_elevated_goblet_squat", true],
  ["heels_elevated_goblet_squat", "Heels-Elevated Goblet Squat", "squat", ["quads"], ["dumbbell"], ["knee"], "goblet_squat", "db_front_squat", true],
  ["db_front_squat", "Dumbbell Front Squat", "squat", ["quads", "glutes"], ["dumbbell"], [], "goblet_squat", null, true],
  ["barbell_box_squat", "Barbell Box Squat", "squat", ["quads", "glutes"], ["barbell", "box"], ["low_back"], "goblet_squat", "barbell_back_squat", true],
  ["barbell_back_squat", "Barbell Back Squat", "squat", ["quads", "glutes", "adductors"], ["barbell"], ["low_back", "knee"], "barbell_box_squat", "pause_back_squat", true],
  ["pause_back_squat", "Pause Back Squat", "squat", ["quads", "glutes"], ["barbell"], ["low_back", "knee"], "barbell_back_squat", null, true],
  ["barbell_front_squat", "Barbell Front Squat", "squat", ["quads", "glutes"], ["barbell"], ["wrist", "knee"], "goblet_squat", null, true],
  ["leg_press", "Leg Press", "squat", ["quads", "glutes"], ["machine"], [], "goblet_box_squat", "barbell_back_squat", true],
  ["hack_squat", "Hack Squat", "squat", ["quads"], ["machine"], ["knee"], "leg_press", null, true],

  // ---- Hinge ---------------------------------------------------------------
  ["glute_bridge", "Glute Bridge", "hinge", ["glutes", "hamstrings"], ["bodyweight"], [], null, "single_leg_glute_bridge", false],
  ["single_leg_glute_bridge", "Single-Leg Glute Bridge", "hinge", ["glutes", "hamstrings"], ["bodyweight"], [], "glute_bridge", "db_hip_thrust", false],
  ["hip_hinge_drill", "Hip Hinge Drill (dowel/broomstick)", "hinge", ["hamstrings", "glutes"], ["bodyweight"], [], null, "db_romanian_deadlift", true],
  ["single_leg_rdl_bw", "Single-Leg RDL (bodyweight)", "hinge", ["hamstrings", "glutes"], ["bodyweight"], [], "hip_hinge_drill", "db_single_leg_rdl", true],
  ["band_good_morning", "Band Good Morning", "hinge", ["hamstrings", "glutes"], ["band"], [], "hip_hinge_drill", "db_romanian_deadlift", true],
  ["db_romanian_deadlift", "Dumbbell Romanian Deadlift", "hinge", ["hamstrings", "glutes"], ["dumbbell"], ["low_back"], "hip_hinge_drill", "db_single_leg_rdl", true],
  ["db_single_leg_rdl", "Dumbbell Single-Leg RDL", "hinge", ["hamstrings", "glutes"], ["dumbbell"], [], "db_romanian_deadlift", null, true],
  ["db_hip_thrust", "Dumbbell Hip Thrust", "hinge", ["glutes"], ["dumbbell", "bench"], [], "glute_bridge", "barbell_hip_thrust", true],
  ["barbell_hip_thrust", "Barbell Hip Thrust", "hinge", ["glutes"], ["barbell", "bench"], [], "db_hip_thrust", null, true],
  ["kb_deadlift", "Kettlebell Deadlift", "hinge", ["glutes", "hamstrings"], ["kettlebell"], [], "hip_hinge_drill", "kb_swing", true],
  ["kb_swing", "Kettlebell Swing", "hinge", ["glutes", "hamstrings"], ["kettlebell"], ["low_back"], "kb_deadlift", null, true],
  ["cable_pull_through", "Cable Pull-Through", "hinge", ["glutes", "hamstrings"], ["cable"], [], "hip_hinge_drill", "barbell_rdl", true],
  ["barbell_rdl", "Barbell Romanian Deadlift", "hinge", ["hamstrings", "glutes"], ["barbell"], ["low_back"], "db_romanian_deadlift", "conventional_deadlift", true],
  ["trap_bar_deadlift", "Trap-Bar Deadlift", "hinge", ["glutes", "quads", "hamstrings"], ["barbell"], ["low_back"], "kb_deadlift", "conventional_deadlift", true],
  ["conventional_deadlift", "Conventional Deadlift", "hinge", ["glutes", "hamstrings", "back"], ["barbell"], ["low_back"], "trap_bar_deadlift", null, true],
  ["back_extension", "Back Extension (45°)", "hinge", ["glutes", "hamstrings", "erectors"], ["machine"], ["low_back"], "glute_bridge", null, false],

  // ---- Lunge / single leg --------------------------------------------------
  ["supported_split_squat", "Supported Split Squat", "lunge", ["quads", "glutes"], ["bodyweight"], [], null, "split_squat_bw", true],
  ["split_squat_bw", "Split Squat (bodyweight)", "lunge", ["quads", "glutes"], ["bodyweight"], ["knee"], "supported_split_squat", "reverse_lunge_bw", true],
  ["reverse_lunge_bw", "Reverse Lunge (bodyweight)", "lunge", ["quads", "glutes"], ["bodyweight"], ["knee"], "split_squat_bw", "walking_lunge_bw", true],
  ["walking_lunge_bw", "Walking Lunge (bodyweight)", "lunge", ["quads", "glutes"], ["bodyweight"], ["knee"], "reverse_lunge_bw", "bulgarian_split_squat_bw", true],
  ["bulgarian_split_squat_bw", "Rear-Foot-Elevated Split Squat (bodyweight)", "lunge", ["quads", "glutes"], ["box"], ["knee"], "split_squat_bw", "db_bulgarian_split_squat", true],
  ["step_up_bw", "Step-Up (bodyweight)", "lunge", ["quads", "glutes"], ["box"], [], null, "db_step_up", true],
  ["lateral_lunge_bw", "Lateral Lunge (bodyweight)", "lunge", ["adductors", "glutes", "quads"], ["bodyweight"], ["knee"], "supported_split_squat", "db_lateral_lunge", true],
  ["db_split_squat", "Dumbbell Split Squat", "lunge", ["quads", "glutes"], ["dumbbell"], [], "split_squat_bw", "db_bulgarian_split_squat", true],
  ["db_bulgarian_split_squat", "Dumbbell Rear-Foot-Elevated Split Squat", "lunge", ["quads", "glutes"], ["dumbbell", "box"], ["knee"], "db_split_squat", null, true],
  ["db_reverse_lunge", "Dumbbell Reverse Lunge", "lunge", ["quads", "glutes"], ["dumbbell"], ["knee"], "reverse_lunge_bw", "db_walking_lunge", true],
  ["db_walking_lunge", "Dumbbell Walking Lunge", "lunge", ["quads", "glutes"], ["dumbbell"], ["knee"], "db_reverse_lunge", null, true],
  ["db_step_up", "Dumbbell Step-Up", "lunge", ["quads", "glutes"], ["dumbbell", "box"], [], "step_up_bw", null, true],
  ["db_lateral_lunge", "Goblet Lateral Lunge", "lunge", ["adductors", "glutes", "quads"], ["dumbbell"], ["knee"], "lateral_lunge_bw", null, true],
  ["barbell_reverse_lunge", "Barbell Reverse Lunge", "lunge", ["quads", "glutes"], ["barbell"], ["knee"], "db_reverse_lunge", null, true],

  // ---- Horizontal push -----------------------------------------------------
  ["wall_push_up", "Wall Push-Up", "horizontal_push", ["chest", "triceps"], ["bodyweight"], [], null, "incline_push_up", true],
  ["incline_push_up", "Incline Push-Up", "horizontal_push", ["chest", "triceps"], ["box"], ["wrist"], "wall_push_up", "push_up", true],
  ["push_up", "Push-Up", "horizontal_push", ["chest", "triceps", "shoulders"], ["bodyweight"], ["wrist", "shoulder"], "incline_push_up", "decline_push_up", true],
  ["decline_push_up", "Decline Push-Up", "horizontal_push", ["chest", "shoulders"], ["box"], ["wrist", "shoulder"], "push_up", null, true],
  ["band_chest_press", "Band Chest Press", "horizontal_push", ["chest", "triceps"], ["band"], [], "wall_push_up", "push_up", true],
  ["db_floor_press", "Dumbbell Floor Press", "horizontal_push", ["chest", "triceps"], ["dumbbell"], [], "incline_push_up", "db_bench_press", true],
  ["db_bench_press", "Dumbbell Bench Press", "horizontal_push", ["chest", "triceps", "shoulders"], ["dumbbell", "bench"], ["shoulder"], "db_floor_press", "db_incline_press", true],
  ["db_incline_press", "Dumbbell Incline Press", "horizontal_push", ["upper chest", "shoulders"], ["dumbbell", "bench"], ["shoulder"], "db_bench_press", "barbell_bench_press", true],
  ["machine_chest_press", "Machine Chest Press", "horizontal_push", ["chest", "triceps"], ["machine"], [], "incline_push_up", "db_bench_press", true],
  ["barbell_bench_press", "Barbell Bench Press", "horizontal_push", ["chest", "triceps", "shoulders"], ["barbell", "bench"], ["shoulder"], "db_bench_press", "pause_bench_press", true],
  ["pause_bench_press", "Pause Bench Press", "horizontal_push", ["chest", "triceps"], ["barbell", "bench"], ["shoulder"], "barbell_bench_press", null, true],

  // ---- Vertical push -------------------------------------------------------
  ["wall_slide", "Wall Slide", "vertical_push", ["serratus", "lower traps"], ["bodyweight"], [], null, "band_overhead_press", false],
  ["band_overhead_press", "Band Overhead Press", "vertical_push", ["shoulders", "triceps"], ["band"], [], "wall_slide", "half_kneeling_db_press", true],
  ["incline_pike_push_up", "Incline Pike Push-Up", "vertical_push", ["shoulders", "triceps"], ["box"], ["shoulder", "wrist"], "wall_slide", "pike_push_up", true],
  ["pike_push_up", "Pike Push-Up", "vertical_push", ["shoulders", "triceps"], ["bodyweight"], ["shoulder", "wrist"], "incline_pike_push_up", null, true],
  ["half_kneeling_db_press", "Half-Kneeling Single-Arm DB Press", "vertical_push", ["shoulders", "triceps", "core"], ["dumbbell"], ["shoulder"], "band_overhead_press", "seated_db_overhead_press", true],
  ["seated_db_overhead_press", "Seated Dumbbell Overhead Press", "vertical_push", ["shoulders", "triceps"], ["dumbbell", "bench"], ["shoulder"], "half_kneeling_db_press", "standing_db_overhead_press", true],
  ["standing_db_overhead_press", "Standing Dumbbell Overhead Press", "vertical_push", ["shoulders", "triceps"], ["dumbbell"], ["shoulder"], "seated_db_overhead_press", "barbell_overhead_press", true],
  ["landmine_press", "Landmine Press", "vertical_push", ["shoulders", "upper chest"], ["barbell"], [], "half_kneeling_db_press", "barbell_overhead_press", true],
  ["machine_shoulder_press", "Machine Shoulder Press", "vertical_push", ["shoulders", "triceps"], ["machine"], ["shoulder"], "band_overhead_press", "seated_db_overhead_press", true],
  ["barbell_overhead_press", "Barbell Overhead Press", "vertical_push", ["shoulders", "triceps"], ["barbell"], ["shoulder", "low_back"], "standing_db_overhead_press", "push_press", true],

  // ---- Horizontal pull -----------------------------------------------------
  ["door_frame_row", "Door-Frame Row", "horizontal_pull", ["lats", "rhomboids"], ["bodyweight"], [], null, "band_row", true],
  ["band_row", "Band Row", "horizontal_pull", ["lats", "rhomboids"], ["band"], [], "door_frame_row", "chest_supported_db_row", true],
  ["chest_supported_db_row", "Chest-Supported Dumbbell Row", "horizontal_pull", ["lats", "rhomboids", "rear delts"], ["dumbbell", "bench"], [], "band_row", "one_arm_db_row", true],
  ["one_arm_db_row", "One-Arm Dumbbell Row", "horizontal_pull", ["lats", "rhomboids"], ["dumbbell", "bench"], [], "chest_supported_db_row", "db_bent_over_row", true],
  ["db_bent_over_row", "Dumbbell Bent-Over Row", "horizontal_pull", ["lats", "rhomboids"], ["dumbbell"], ["low_back"], "one_arm_db_row", null, true],
  ["machine_row", "Machine Row", "horizontal_pull", ["lats", "rhomboids"], ["machine"], [], "band_row", "seated_cable_row", true],
  ["seated_cable_row", "Seated Cable Row", "horizontal_pull", ["lats", "rhomboids"], ["cable"], [], "machine_row", "barbell_row", true],
  ["inverted_row", "Inverted Row (bar in rack)", "horizontal_pull", ["lats", "rhomboids", "biceps"], ["barbell"], [], "seated_cable_row", null, true],
  ["barbell_row", "Barbell Bent-Over Row", "horizontal_pull", ["lats", "rhomboids", "erectors"], ["barbell"], ["low_back"], "seated_cable_row", null, true],
  ["face_pull", "Cable Face Pull", "horizontal_pull", ["rear delts", "rotator cuff"], ["cable"], [], "band_pull_apart", null, false],
  ["band_pull_apart", "Band Pull-Apart", "horizontal_pull", ["rear delts", "rhomboids"], ["band"], [], null, "face_pull", false],

  // ---- Vertical pull -------------------------------------------------------
  ["prone_ytw", "Prone Y-T-W Raise", "vertical_pull", ["lower traps", "rear delts"], ["bodyweight"], [], null, "band_lat_pulldown", false],
  ["band_lat_pulldown", "Band Lat Pulldown", "vertical_pull", ["lats"], ["band"], [], "prone_ytw", "lat_pulldown", true],
  ["lat_pulldown", "Lat Pulldown", "vertical_pull", ["lats", "biceps"], ["cable"], [], "band_lat_pulldown", "assisted_pull_up", true],
  ["assisted_pull_up", "Assisted Pull-Up (machine)", "vertical_pull", ["lats", "biceps"], ["machine"], [], "lat_pulldown", "pull_up", true],
  ["band_assisted_pull_up", "Band-Assisted Pull-Up", "vertical_pull", ["lats", "biceps"], ["band", "pullup_bar"], [], "band_lat_pulldown", "negative_pull_up", true],
  ["negative_pull_up", "Negative (Eccentric) Pull-Up", "vertical_pull", ["lats", "biceps"], ["pullup_bar"], ["elbow"], "band_assisted_pull_up", "pull_up", true],
  ["pull_up", "Pull-Up", "vertical_pull", ["lats", "biceps"], ["pullup_bar"], ["shoulder", "elbow"], "negative_pull_up", "chin_up", true],
  ["chin_up", "Chin-Up", "vertical_pull", ["lats", "biceps"], ["pullup_bar"], ["elbow"], "negative_pull_up", null, true],
  ["straight_arm_pulldown", "Straight-Arm Cable Pulldown", "vertical_pull", ["lats"], ["cable"], [], "band_lat_pulldown", null, false],
  ["db_pullover", "Dumbbell Pullover", "vertical_pull", ["lats", "chest"], ["dumbbell", "bench"], ["shoulder"], null, null, false],

  // ---- Core ----------------------------------------------------------------
  ["dead_bug", "Dead Bug", "core_anti_extension", ["deep core"], ["bodyweight"], [], null, "incline_plank", false],
  ["incline_plank", "Incline Plank (hands on bench)", "core_anti_extension", ["core"], ["box"], [], "dead_bug", "forearm_plank", false],
  ["forearm_plank", "Forearm Plank", "core_anti_extension", ["core"], ["bodyweight"], [], "incline_plank", "long_lever_plank", false],
  ["long_lever_plank", "Long-Lever Plank", "core_anti_extension", ["core"], ["bodyweight"], ["low_back"], "forearm_plank", "hollow_body_hold", false],
  ["hollow_body_hold", "Hollow Body Hold", "core_anti_extension", ["core"], ["bodyweight"], ["low_back"], "dead_bug", null, false],
  ["bird_dog", "Bird Dog", "core_anti_rotation", ["core", "glutes"], ["bodyweight"], [], null, "plank_shoulder_tap", false],
  ["side_plank_knees", "Side Plank (knees)", "core_anti_rotation", ["obliques"], ["bodyweight"], [], null, "side_plank", false],
  ["side_plank", "Side Plank", "core_anti_rotation", ["obliques"], ["bodyweight"], ["shoulder"], "side_plank_knees", null, false],
  ["plank_shoulder_tap", "Plank Shoulder Tap", "core_anti_rotation", ["core"], ["bodyweight"], ["wrist"], "forearm_plank", null, false],
  ["band_pallof_press", "Band Pallof Press", "core_anti_rotation", ["obliques", "core"], ["band"], [], "bird_dog", "pallof_press", false],
  ["pallof_press", "Cable Pallof Press", "core_anti_rotation", ["obliques", "core"], ["cable"], [], "band_pallof_press", "cable_woodchop", false],
  ["cable_woodchop", "Cable Woodchop", "core_anti_rotation", ["obliques"], ["cable"], ["low_back"], "pallof_press", null, false],
  ["reverse_crunch", "Reverse Crunch", "core_flexion", ["abs"], ["bodyweight"], [], "dead_bug", "hanging_knee_raise", false],
  ["hanging_knee_raise", "Hanging Knee Raise", "core_flexion", ["abs", "hip flexors"], ["pullup_bar"], ["shoulder"], "reverse_crunch", null, false],
  ["farmer_carry", "Farmer Carry", "carry", ["grip", "traps", "core"], ["dumbbell"], [], null, "suitcase_carry", true],
  ["suitcase_carry", "Suitcase Carry", "carry", ["obliques", "grip"], ["dumbbell"], [], "farmer_carry", null, true],
  ["kb_goblet_carry", "Goblet Carry", "carry", ["core", "upper back"], ["kettlebell"], [], null, "farmer_carry", true],

  // ---- Isolation -----------------------------------------------------------
  ["band_curl", "Band Biceps Curl", "isolation_arms", ["biceps"], ["band"], [], null, "db_biceps_curl", false],
  ["db_biceps_curl", "Dumbbell Biceps Curl", "isolation_arms", ["biceps"], ["dumbbell"], [], "band_curl", "barbell_curl", false],
  ["hammer_curl", "Hammer Curl", "isolation_arms", ["biceps", "brachialis"], ["dumbbell"], [], "band_curl", null, false],
  ["cable_curl", "Cable Curl", "isolation_arms", ["biceps"], ["cable"], [], "band_curl", "barbell_curl", false],
  ["barbell_curl", "Barbell Curl", "isolation_arms", ["biceps"], ["barbell"], ["elbow", "wrist"], "db_biceps_curl", null, false],
  ["band_triceps_pushdown", "Band Triceps Pushdown", "isolation_arms", ["triceps"], ["band"], [], null, "cable_triceps_pushdown", false],
  ["cable_triceps_pushdown", "Cable Triceps Pushdown", "isolation_arms", ["triceps"], ["cable"], [], "band_triceps_pushdown", "db_overhead_triceps_extension", false],
  ["db_overhead_triceps_extension", "Dumbbell Overhead Triceps Extension", "isolation_arms", ["triceps"], ["dumbbell"], ["elbow", "shoulder"], "band_triceps_pushdown", "db_skull_crusher", false],
  ["db_skull_crusher", "Dumbbell Skull Crusher", "isolation_arms", ["triceps"], ["dumbbell", "bench"], ["elbow"], "db_overhead_triceps_extension", null, false],
  ["bench_dip", "Bench Dip", "isolation_arms", ["triceps"], ["box"], ["shoulder", "wrist"], null, null, false],
  ["band_lateral_raise", "Band Lateral Raise", "isolation_shoulders", ["side delts"], ["band"], [], null, "db_lateral_raise", false],
  ["db_lateral_raise", "Dumbbell Lateral Raise", "isolation_shoulders", ["side delts"], ["dumbbell"], ["shoulder"], "band_lateral_raise", "cable_lateral_raise", false],
  ["cable_lateral_raise", "Cable Lateral Raise", "isolation_shoulders", ["side delts"], ["cable"], ["shoulder"], "db_lateral_raise", null, false],
  ["db_rear_delt_fly", "Dumbbell Rear-Delt Fly", "isolation_shoulders", ["rear delts"], ["dumbbell"], [], "band_pull_apart", null, false],
  ["db_chest_fly", "Dumbbell Chest Fly", "isolation_chest", ["chest"], ["dumbbell", "bench"], ["shoulder"], null, "cable_chest_fly", false],
  ["cable_chest_fly", "Cable Chest Fly", "isolation_chest", ["chest"], ["cable"], ["shoulder"], "db_chest_fly", null, false],
  ["leg_extension", "Leg Extension", "isolation_legs", ["quads"], ["machine"], ["knee"], null, null, false],
  ["lying_leg_curl", "Lying Leg Curl", "isolation_legs", ["hamstrings"], ["machine"], [], "glute_bridge", null, false],
  ["stability_ball_leg_curl", "Slider/Towel Leg Curl", "isolation_legs", ["hamstrings"], ["bodyweight"], [], "glute_bridge", "lying_leg_curl", false],
  ["calf_raise_bw", "Standing Calf Raise (bodyweight)", "isolation_legs", ["calves"], ["bodyweight"], [], null, "db_calf_raise", false],
  ["db_calf_raise", "Dumbbell Calf Raise", "isolation_legs", ["calves"], ["dumbbell"], [], "calf_raise_bw", "machine_calf_raise", false],
  ["machine_calf_raise", "Machine Calf Raise", "isolation_legs", ["calves"], ["machine"], [], "db_calf_raise", null, false],
  ["band_lateral_walk", "Band Lateral Walk", "isolation_legs", ["glute med"], ["band"], [], null, null, false],

  // ---- Power / plyometric --------------------------------------------------
  ["squat_jump", "Squat Jump", "power", ["quads", "glutes"], ["bodyweight"], ["knee", "ankle"], "bodyweight_squat", "box_jump", true],
  ["box_jump", "Box Jump (step down)", "power", ["quads", "glutes"], ["box"], ["knee", "ankle"], "squat_jump", "broad_jump", true],
  ["broad_jump", "Broad Jump", "power", ["glutes", "quads"], ["bodyweight"], ["knee", "ankle"], "squat_jump", null, true],
  ["lateral_bound", "Lateral Bound", "power", ["glutes", "adductors"], ["bodyweight"], ["knee", "ankle"], "lateral_lunge_bw", null, true],
  ["plyo_push_up", "Plyometric Push-Up", "power", ["chest", "triceps"], ["bodyweight"], ["wrist", "shoulder"], "push_up", null, true],
  ["med_ball_chest_pass", "Medicine Ball Chest Pass", "power", ["chest", "triceps"], ["medicine_ball"], [], "push_up", "plyo_push_up", true],
  ["med_ball_slam", "Medicine Ball Slam", "power", ["lats", "core"], ["medicine_ball"], ["low_back", "shoulder"], null, null, true],
  ["med_ball_rotational_throw", "Medicine Ball Rotational Throw", "power", ["obliques", "hips"], ["medicine_ball"], ["low_back"], "cable_woodchop", null, true],
  ["push_press", "Push Press", "power", ["shoulders", "legs"], ["barbell"], ["shoulder", "low_back"], "barbell_overhead_press", null, true],
  ["hang_power_clean", "Hang Power Clean", "power", ["posterior chain", "traps"], ["barbell"], ["wrist", "low_back", "shoulder"], "kb_swing", null, true],

  // ---- Mobility ------------------------------------------------------------
  ["cat_cow", "Cat-Cow", "mobility", ["spine"], ["bodyweight"], [], null, null, false],
  ["worlds_greatest_stretch", "World's Greatest Stretch", "mobility", ["hips", "t-spine"], ["bodyweight"], [], null, null, false],
  ["hip_90_90", "90/90 Hip Switch", "mobility", ["hips"], ["bodyweight"], ["hip"], null, null, false],
  ["open_book", "Thoracic Open Book", "mobility", ["t-spine"], ["bodyweight"], [], null, null, false],
  ["couch_stretch", "Half-Kneeling Hip Flexor Stretch", "mobility", ["hip flexors", "quads"], ["bodyweight"], ["knee"], null, null, false],
  ["childs_pose", "Child's Pose", "mobility", ["lats", "low back"], ["bodyweight"], ["knee"], null, null, false],
  ["ankle_rocks", "Knee-to-Wall Ankle Rocks", "mobility", ["ankles"], ["bodyweight"], [], null, null, false],
  ["deep_squat_hold", "Supported Deep Squat Hold", "mobility", ["hips", "ankles"], ["bodyweight"], ["knee"], null, null, false],
  ["thread_the_needle", "Thread the Needle", "mobility", ["t-spine", "shoulders"], ["bodyweight"], [], null, null, false],
  ["band_shoulder_pass", "Band Shoulder Pass-Through", "mobility", ["shoulders"], ["band"], ["shoulder"], null, null, false],
  ["doorway_pec_stretch", "Doorway Pec Stretch", "mobility", ["chest"], ["bodyweight"], ["shoulder"], null, null, false],
  ["supine_hamstring_stretch", "Supine Hamstring Stretch", "mobility", ["hamstrings"], ["bodyweight"], [], null, null, false],
  ["figure_four_stretch", "Figure-4 Glute Stretch", "mobility", ["glutes"], ["bodyweight"], ["hip"], null, null, false],
  ["neck_cars", "Neck Controlled Rotations", "mobility", ["neck"], ["bodyweight"], ["neck"], null, null, false],
];

export const EXERCISES: ExerciseSeed[] = rows.map(([slug, name, pattern, primary_muscles, equipment, contraindications, regression, progression, is_compound]) => ({
  slug, name, pattern, primary_muscles, equipment, contraindications, regression, progression, is_compound,
}));

export const EQUIPMENT_ACCESS = {
  commercial_gym: ["bodyweight", "box", "band", "dumbbell", "kettlebell", "bench", "barbell", "cable", "machine", "pullup_bar", "medicine_ball"],
  home_basic: ["bodyweight", "box", "band", "dumbbell", "bench"],
  bodyweight: ["bodyweight", "box"],
} as const;
export type EquipmentAccess = keyof typeof EQUIPMENT_ACCESS;

export const CONTRAINDICATION_TAGS = ["shoulder", "knee", "low_back", "wrist", "hip", "elbow", "ankle", "neck"] as const;
export type BodyArea = (typeof CONTRAINDICATION_TAGS)[number];
