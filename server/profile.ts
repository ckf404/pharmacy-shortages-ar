export type AchievementStats = {
  added: number;
  received: number;
  orders: number;
  points: number;
  level: number;
  levelName: string;
  nextLevelAt: number | null;
};

export function achievementLevel(added: number, received: number, orders: number): AchievementStats {
  const points = added * 2 + received * 3 + orders * 5;
  const levels = [
    { at: 0, name: "بداية موفقة" },
    { at: 15, name: "متابع نشط" },
    { at: 45, name: "خبير النواقص" },
    { at: 90, name: "قائد التوريد" },
    { at: 160, name: "نجم الصيدلية" },
  ];
  const levelIndex = levels.reduce((current, item, index) => points >= item.at ? index : current, 0);
  const next = levels[levelIndex + 1];
  return { added, received, orders, points, level: levelIndex + 1, levelName: levels[levelIndex].name, nextLevelAt: next?.at ?? null };
}
