/**
 * Creator Quests — Orvexa Studio ke andar ka apna chhota game.
 * Roz 3 naye quests (date-seeded, deterministic), XP, streak flame,
 * creator levels aur 10 achievement badges. State localStorage mein
 * rakhta hai; tests ke liye storage injectable hai aur dates
 * parameters se aati hain (wall-clock par nirbhar nahi).
 */

export const QUEST_STORAGE_KEY = 'orvexa-creator-quests-v1';

export const CREATOR_ACTIONS = Object.freeze([
  'template-launched', 'run-pressed', 'lesson-completed', 'remix-made',
  'scene-built', 'ai-used', 'snapshot-saved', 'block-inserted',
  'project-saved', 'game-played', 'modeler-used', 'audio-exported',
]);

export const DAILY_QUEST_POOL = Object.freeze([
  { id: 'launch-2-templates', icon: '🚀', metric: 'template-launched', target: 2, xp: 40,
    titleEn: 'Launch 2 templates your way', titleHi: '2 template launch karo' },
  { id: 'run-3-times', icon: '▶️', metric: 'run-pressed', target: 3, xp: 25,
    titleEn: 'Press Run 3 times', titleHi: '3 baar Run dabao' },
  { id: 'finish-1-lesson', icon: '🏫', metric: 'lesson-completed', target: 1, xp: 60,
    titleEn: 'Finish 1 Paathshala lesson', titleHi: '1 Paathshala lesson pura karo' },
  { id: 'make-1-remix', icon: '🎨', metric: 'remix-made', target: 1, xp: 45,
    titleEn: 'Make 1 Remix of a template', titleHi: '1 Remix banao apne rangon se' },
  { id: 'build-2-scenes', icon: '🏔️', metric: 'scene-built', target: 2, xp: 50,
    titleEn: 'Build 2 scenes in the Workbench', titleHi: 'Workbench me 2 scene banao' },
  { id: 'ask-ai-2', icon: '🤖', metric: 'ai-used', target: 2, xp: 35,
    titleEn: 'Ask the AI Agent twice', titleHi: 'AI Agent se 2 baar madad lo' },
  { id: 'save-2-snaps', icon: '📸', metric: 'snapshot-saved', target: 2, xp: 40,
    titleEn: 'Save 2 snapshots', titleHi: '2 snapshot bachao' },
  { id: 'insert-1-block', icon: '🧩', metric: 'block-inserted', target: 1, xp: 30,
    titleEn: 'Insert 1 Visual UI block', titleHi: '1 Visual UI block lagao' },
  { id: 'play-1-game', icon: '🎮', metric: 'game-played', target: 1, xp: 30,
    titleEn: 'Play 1 published game', titleHi: '1 game khelo' },
  { id: 'save-2-projects', icon: '💾', metric: 'project-saved', target: 2, xp: 35,
    titleEn: 'Save 2 projects', titleHi: '2 project save karo' },
]);

export const ACHIEVEMENTS = Object.freeze([
  { id: 'first-launch', icon: '🚀', nameEn: 'First Launch', nameHi: 'Pehla Launch', need: { metric: 'template-launched', count: 1 },
    descEn: 'Launch your very first template.', descHi: 'Apna sabse pehla template launch karo.' },
  { id: 'run-machine', icon: '⚡', nameEn: 'Run Machine', nameHi: 'Run Machine', need: { metric: 'run-pressed', count: 10 },
    descEn: 'Press Run 10 times.', descHi: '10 baar Run dabao.' },
  { id: 'remix-artist', icon: '🎨', nameEn: 'Remix Artist', nameHi: 'Remix Artist', need: { metric: 'remix-made', count: 3 },
    descEn: 'Make 3 remixes.', descHi: '3 remix banao.' },
  { id: 'scholar', icon: '🎓', nameEn: 'Scholar', nameHi: 'Vidvaan', need: { metric: 'lesson-completed', count: 3 },
    descEn: 'Finish 3 Paathshala lessons.', descHi: '3 Paathshala lesson pura karo.' },
  { id: 'scene-crafter', icon: '🗺️', nameEn: 'Scene Crafter', nameHi: 'Scene Crafter', need: { metric: 'scene-built', count: 5 },
    descEn: 'Build 5 scenes.', descHi: '5 scene banao.' },
  { id: 'ai-friend', icon: '🤖', nameEn: 'AI Friend', nameHi: 'AI Dost', need: { metric: 'ai-used', count: 5 },
    descEn: 'Take AI help 5 times.', descHi: 'AI se 5 baar madad lo.' },
  { id: 'snap-happy', icon: '📸', nameEn: 'Snap Happy', nameHi: 'Snap Happy', need: { metric: 'snapshot-saved', count: 3 },
    descEn: 'Save 3 snapshots.', descHi: '3 snapshot bachao.' },
  { id: 'explorer', icon: '🧭', nameEn: 'Explorer', nameHi: 'Explorer', need: { metric: 'template-launched', count: 8 },
    descEn: 'Launch 8 different times.', descHi: '8 baar template launch karo.' },
  { id: 'streak-star', icon: '🔥', nameEn: 'Streak Star', nameHi: 'Streak Star', need: { metric: 'streak', count: 3 },
    descEn: 'Create on 3 different days.', descHi: '3 alag din kuch banao.' },
  { id: 'level-hero', icon: '👑', nameEn: 'Level Hero', nameHi: 'Level Hero', need: { metric: 'level', count: 3 },
    descEn: 'Reach Creator Level 3.', descHi: 'Creator Level 3 tak pahuncho.' },
]);

const LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200];

export function creatorLevel(totalXp) {
  const xp = Math.max(0, Math.floor(Number(totalXp) || 0));
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  const currentFloor = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextAt = LEVEL_THRESHOLDS[level] ?? currentFloor + 800;
  const progress = Math.min(100, Math.round(((xp - currentFloor) / Math.max(1, nextAt - currentFloor)) * 100));
  return { level, xp, currentFloor, nextAt, progress, xpToNext: Math.max(0, nextAt - xp) };
}

export function levelTitle(level) {
  const titles = ['Naya Creator', 'Seekhne Wala', 'Banane Wala', 'Scene Master', 'Game Guru',
    'Studio Star', 'World Builder', 'Apex Creator', 'Legend Creator', 'Orvexa Master'];
  return titles[Math.min(titles.length - 1, Math.max(0, level - 1))];
}

export function dayHash(dateText) {
  const text = String(dateText || '2026-01-01');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0);
}

export function createQuestState() {
  return {
    version: 1, totalXp: 0, currentStreak: 0, bestStreak: 0,
    activeDays: [], lifetime: {}, completedQuestIds: [], unlockedAchievements: [],
    questProgress: {}, lastQuestDate: '',
  };
}

export function getDailyQuests(state, dateText) {
  const day = String(dateText || '').slice(0, 10) || '2026-01-01';
  const base = dayHash(day) % DAILY_QUEST_POOL.length;
  const picks = [0, 3, 7].map(offset => DAILY_QUEST_POOL[(base + offset) % DAILY_QUEST_POOL.length]);
  const progress = (state && state.questProgress && state.questProgress[day]) || {};
  return picks.map(quest => {
    const done = Math.min(quest.target, Number(progress[quest.id] || 0));
    return { ...quest, date: day, progress: done, target: quest.target,
      completed: done >= quest.target, progressPercent: Math.round((done / quest.target) * 100) };
  });
}

function dayBefore(dateText) {
  const d = new Date(`${String(dateText).slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Record one creator action. Returns the new state plus what was earned:
 * { state, xpGained, completedQuests: [quest...], newAchievements: [badge...], leveledUp }
 * Pure function — never mutates the input state.
 */
export function recordCreatorAction(state, action, amount = 1, dateText) {
  if (!CREATOR_ACTIONS.includes(action)) throw new Error(`Unknown creator action "${action}".`);
  const day = String(dateText || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const next = JSON.parse(JSON.stringify(state && state.version === 1 ? state : createQuestState()));
  const levelBefore = creatorLevel(next.totalXp).level;
  let xpGained = 0;
  const steps = Math.max(1, Math.floor(Number(amount) || 1));
  next.lifetime[action] = (next.lifetime[action] || 0) + steps;

  // streak bookkeeping (unique active days)
  if (!next.activeDays.includes(day)) {
    next.activeDays.push(day);
    next.activeDays.sort();
    if (next.activeDays.includes(dayBefore(day))) next.currentStreak += 1;
    else next.currentStreak = 1;
    next.bestStreak = Math.max(next.bestStreak, next.currentStreak);
  }
  next.lastQuestDate = day;

  // daily quest progress
  const before = getDailyQuests(next, day);
  next.questProgress[day] = next.questProgress[day] || {};
  for (const quest of before) {
    if (quest.metric === action && !quest.completed) {
      next.questProgress[day][quest.id] = Math.min(quest.target, (next.questProgress[day][quest.id] || 0) + steps);
    }
  }
  const completedQuests = [];
  for (const quest of getDailyQuests(next, day)) {
    const key = `${day}:${quest.id}`;
    if (quest.completed && !next.completedQuestIds.includes(key)) {
      next.completedQuestIds.push(key);
      xpGained += quest.xp;
      completedQuests.push(quest);
    }
  }

  // small base XP for doing anything creative
  xpGained += 2;
  next.totalXp += xpGained;

  // achievements
  const levelNow = creatorLevel(next.totalXp);
  const newAchievements = [];
  for (const badge of ACHIEVEMENTS) {
    if (next.unlockedAchievements.includes(badge.id)) continue;
    const have = badge.need.metric === 'streak' ? next.bestStreak
      : badge.need.metric === 'level' ? levelNow.level
      : (next.lifetime[badge.need.metric] || 0);
    if (have >= badge.need.count) {
      next.unlockedAchievements.push(badge.id);
      newAchievements.push(badge);
      next.totalXp += 25; // badge bonus
    }
  }
  const leveledUp = creatorLevel(next.totalXp).level > levelBefore;
  return { state: next, xpGained, completedQuests, newAchievements, leveledUp, level: creatorLevel(next.totalXp) };
}

export function loadQuestProgress(storage) {
  try {
    const raw = (storage || globalThis.localStorage)?.getItem(QUEST_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && parsed.version === 1 ? { ...createQuestState(), ...parsed } : createQuestState();
  } catch { return createQuestState(); }
}

export function saveQuestProgress(state, storage) {
  try { (storage || globalThis.localStorage)?.setItem(QUEST_STORAGE_KEY, JSON.stringify(state)); } catch { /* private mode */ }
  return state;
}

/** One-line motivational summary for the Home card / topbar badge. */
export function questSummaryLine(state, dateText) {
  const level = creatorLevel(state?.totalXp || 0);
  const quests = getDailyQuests(state || createQuestState(), dateText);
  const done = quests.filter(q => q.completed).length;
  return {
    level, title: levelTitle(level.level),
    questsDone: done, questsTotal: quests.length,
    streak: state?.currentStreak || 0,
    badges: (state?.unlockedAchievements || []).length,
    badgesTotal: ACHIEVEMENTS.length,
    lineHi: `Level ${level.level} ${levelTitle(level.level)} · Aaj ${done}/${quests.length} quest pure · 🔥 ${state?.currentStreak || 0} din streak · 🏅 ${(state?.unlockedAchievements || []).length}/${ACHIEVEMENTS.length} badge`,
  };
}
