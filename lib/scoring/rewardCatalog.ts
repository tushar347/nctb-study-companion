import type { PrismaClient } from "@prisma/client";

export type RewardCatalogItem = {
  code: string;
  name: string;
  description: string;
  rewardType: "CONSUMABLE" | "THEME" | "COSMETIC";
  costPoints: number;
  metadata: Record<string, string | number | boolean>;
};

export const REWARD_CATALOG: RewardCatalogItem[] = [
  {
    code: "HINT_TOKEN",
    name: "Practice Hint Token",
    description: "Keep a hint token in your inventory for a future practice helper.",
    rewardType: "CONSUMABLE",
    costPoints: 40,
    metadata: { consumable: true },
  },
  {
    code: "THEME_EMERALD",
    name: "Emerald Profile Theme",
    description: "Unlock the emerald colour theme for your student profile.",
    rewardType: "THEME",
    costPoints: 60,
    metadata: { theme: "emerald", consumable: false },
  },
  {
    code: "THEME_VIOLET",
    name: "Violet Profile Theme",
    description: "Unlock the violet colour theme for your student profile.",
    rewardType: "THEME",
    costPoints: 60,
    metadata: { theme: "violet", consumable: false },
  },
  {
    code: "PROFILE_FRAME_GOLD",
    name: "Gold Profile Frame",
    description: "Add a gold profile-frame unlock to your reward inventory.",
    rewardType: "COSMETIC",
    costPoints: 90,
    metadata: { frame: "gold", consumable: false },
  },
  {
    code: "STREAK_SHIELD",
    name: "Streak Shield",
    description: "Keep one streak-protection reward for the future streak system.",
    rewardType: "CONSUMABLE",
    costPoints: 120,
    metadata: { consumable: true },
  },
  {
    code: "CELEBRATION_PACK",
    name: "Celebration Pack",
    description: "Unlock an achievement celebration cosmetic for your inventory.",
    rewardType: "COSMETIC",
    costPoints: 200,
    metadata: { celebration: "sparkles", consumable: false },
  },
];

export async function ensureRewardCatalog(
  client: Pick<PrismaClient, "rewardItem">,
) {
  await Promise.all(
    REWARD_CATALOG.map((item) =>
      client.rewardItem.upsert({
        where: { code: item.code },
        update: {
          name: item.name,
          description: item.description,
          rewardType: item.rewardType,
          costPoints: item.costPoints,
          active: true,
          metadataJson: JSON.stringify(item.metadata),
        },
        create: {
          code: item.code,
          name: item.name,
          description: item.description,
          rewardType: item.rewardType,
          costPoints: item.costPoints,
          active: true,
          metadataJson: JSON.stringify(item.metadata),
        },
      }),
    ),
  );
}
