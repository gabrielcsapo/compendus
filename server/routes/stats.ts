import { Hono } from "hono";
import { computeReadingStats } from "../../app/lib/stats";

const app = new Hono();

// GET /api/stats — Aggregated reading statistics for current profile
app.get("/api/stats", (c) => {
  const profileId = c.get("profileId");
  return c.json(computeReadingStats(profileId));
});

export const statsRoutes = app;
