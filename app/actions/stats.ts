"use server";

import { resolveProfileId } from "../lib/profile";
import { computeReadingStats } from "../lib/stats";

export type { StatsResponse } from "../lib/stats";

export async function getReadingStats() {
  const profileId = resolveProfileId();
  if (!profileId) return null;
  return computeReadingStats(profileId);
}
