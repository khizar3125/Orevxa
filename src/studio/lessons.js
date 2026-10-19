/**
 * Orvexa Interactive Lessons (v8) — play-and-learn inside the Studio.
 * Five tiny hands-on lessons with XP, plus a beginner dictionary that
 * explains pro words in one simple line (English + Hinglish).
 */

export const LESSON_XP_KEY = 'orvexa-lessons-xp-v1';

export const INTERACTIVE_LESSONS = Object.freeze([
  {
    id: 'pehla-run', icon: '▶️', xp: 20,
    title: 'Pehla Run — Code ko zinda karo',
    titleEn: 'First Run — Bring code to life',
    task: 'Editor mein jo code hai, use Run ▶ dabakar chalao aur neeche result dekho.',
    taskEn: 'Press Run ▶ on the code in the editor and watch the result below.',
    actionTab: 'preview', hint: 'Upar right corner mein bada Run button hai.',
  },
  {
    id: 'rang-badlo', icon: '🎨', xp: 30,
    title: 'Rang Badlo — Apna pehla badlav',
    titleEn: 'Change a Colour — Your first edit',
    task: 'Scene tab mein ek cube select karo aur Inspector se uska rang badlo.',
    taskEn: 'In the Scene tab, select a cube and change its colour from the Inspector.',
    actionTab: 'scene', hint: 'Pehle Quick Create se ek game launch kar lo, phir Scene kholo.',
  },
  {
    id: 'ai-ko-bolo', icon: '🤖', xp: 40,
    title: 'AI ko Bolo — Bina code game',
    titleEn: 'Tell the AI — A game without code',
    task: 'AI Agent tab mein likho: "ek racing game banao" aur Run AI Agent dabao.',
    taskEn: 'In the AI Agent tab, type "make a racing game" and press Run AI Agent.',
    actionTab: 'ai', hint: 'Hinglish bhi chalega: "ek dukaan ki website banao".',
  },
  {
    id: 'template-launch', icon: '🚀', xp: 30,
    title: 'Template Launch — 1 click kamaal',
    titleEn: 'Template Launch — 1-click magic',
    task: 'Quick Create mein jaakar koi bhi game Launch & Play karo.',
    taskEn: 'Open Quick Create and Launch & Play any game.',
    actionTab: 'launchpad', hint: 'Kart Racing Cup sabse mazedaar hai pehle try ke liye!',
  },
  {
    id: 'mood-lagao', icon: '🌅', xp: 30,
    title: 'Mood Lagao — Cinematic feel',
    titleEn: 'Add a Mood — Cinematic feel',
    task: 'Scene tab ke Workbench se Golden Hour mood lagao aur farak dekho.',
    taskEn: 'From the Scene Workbench, apply the Golden Hour mood and see the difference.',
    actionTab: 'scene', hint: 'Moods se game raaton-raat film jaisa lagta hai.',
  },
]);

export const BEGINNER_DICTIONARY = Object.freeze({
  mesh: 'Mesh matlab 3D shape ki jaali — cube, sphere sab mesh hote hain.',
  texture: 'Texture matlab shape ke upar chipki hui tasveer/rang ki parat.',
  physics: 'Physics matlab gravity aur takkar ke niyam — cheezein girti aur takrati hain.',
  render: 'Render matlab computer ka final tasveer banana.',
  scene: 'Scene matlab 3D duniya ka ek kamra jisme saari cheezein rakhi hain.',
  state: 'State matlab ek number jo yaad rehta hai — jaise score ya coins.',
  node: 'Node matlab ek chhota box jise jod-jod kar bade effects bante hain.',
  erosion: 'Erosion matlab paani se mitti/pahad ka ghisna — asli terrain aise banta hai.',
  lod: 'LOD matlab door ki cheezon ko halka banana taaki game smooth chale.',
  rig: 'Rig matlab character ki haddiyon ka dhancha jisse woh hilta hai.',
  uv: 'UV matlab 3D shape par tasveer chipkane ka naksha.',
  shader: 'Shader matlab rang-roshni ka chhota program jo cheezon ko sundar banata hai.',
});

export function explainTerm(term) {
  const key = String(term || '').toLowerCase();
  return BEGINNER_DICTIONARY[key] || `“${term}” ka simple matlab lesson mein milega — AI Agent se poochho: "${term} kya hota hai?"`;
}

function readXp(storage) {
  try {
    const store = storage || globalThis.localStorage;
    const parsed = JSON.parse(store?.getItem(LESSON_XP_KEY) || '{}');
    return { total: Number(parsed.total) || 0, done: Array.isArray(parsed.done) ? parsed.done : [] };
  } catch { return { total: 0, done: [] }; }
}

function writeXp(storage, data) {
  try {
    const store = storage || globalThis.localStorage;
    store?.setItem(LESSON_XP_KEY, JSON.stringify(data));
  } catch { /* private mode: XP sirf is session ke liye */ }
  return data;
}

export function getLessonProgress(storage) {
  const xp = readXp(storage);
  return {
    totalXp: xp.total,
    doneIds: xp.done,
    completed: xp.done.length,
    totalLessons: INTERACTIVE_LESSONS.length,
    level: 1 + Math.floor(xp.total / 100),
    nextLevelXp: (1 + Math.floor(xp.total / 100)) * 100,
    lessons: INTERACTIVE_LESSONS.map(l => ({ ...l, done: xp.done.includes(l.id) })),
  };
}

export function completeLesson(lessonId, storage) {
  const lesson = INTERACTIVE_LESSONS.find(l => l.id === lessonId);
  if (!lesson) throw new Error(`Unknown lesson "${lessonId}".`);
  const xp = readXp(storage);
  if (!xp.done.includes(lessonId)) {
    xp.done.push(lessonId);
    xp.total += lesson.xp;
    writeXp(storage, xp);
  }
  return getLessonProgress(storage);
}

export function resetLessonProgress(storage) {
  writeXp(storage, { total: 0, done: [] });
  return getLessonProgress(storage);
}
