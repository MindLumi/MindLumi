import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleCors } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { successResponse, errorResponse } from "../_shared/response.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";

Deno.serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const { user } = await authenticateRequest(req);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "log";

    // ---- LOG mood ----
    if (action === "log") {
      const body = await req.json();
      const {
        mood_score,
        mood_label,
        mood_notes,
        energy_level,
        sleep_quality,
        stress_triggers,
        time_of_day,
        session_id,
      } = body;

      if (typeof mood_score !== "number" || mood_score < 1 || mood_score > 10 || !Number.isInteger(mood_score)) {
        return errorResponse("mood_score must be an integer between 1 and 10");
      }

      const { data, error } = await supabaseAdmin
        .from("mood_journal")
        .insert({
          user_id: user.id,
          session_id: session_id ?? null,
          mood_score,
          mood_label: mood_label ?? null,
          mood_notes: mood_notes ?? null,
          energy_level: energy_level ?? null,
          sleep_quality: sleep_quality ?? null,
          stress_triggers: stress_triggers ?? null,
          time_of_day: time_of_day ?? null,
        })
        .select("*")
        .single();

      if (error) return errorResponse(error.message, 500);
      return successResponse(data, 201);
    }

    // ---- HISTORY ----
    if (action === "history") {
      const days = Math.min(Math.max(parseInt(url.searchParams.get("days") ?? "30"), 1), 365);
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabaseAdmin
        .from("mood_journal")
        .select("*")
        .eq("user_id", user.id)
        .gte("recorded_at", since.toISOString())
        .order("recorded_at", { ascending: false })
        .limit(500);

      if (error) return errorResponse(error.message, 500);
      return successResponse(data);
    }

    // ---- TRENDS ----
    if (action === "trends") {
      const days = Math.min(Math.max(parseInt(url.searchParams.get("days") ?? "30"), 1), 365);
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabaseAdmin
        .from("mood_journal")
        .select("mood_score, mood_label, energy_level, sleep_quality, stress_triggers, recorded_at")
        .eq("user_id", user.id)
        .gte("recorded_at", since.toISOString())
        .order("recorded_at", { ascending: true });

      if (error) return errorResponse(error.message, 500);

      // Compute basic trends
      const scores = (data ?? []).map((d: { mood_score: number }) => d.mood_score);
      const avg =
        scores.length > 0
          ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
          : null;

      // Collect most common triggers
      const triggerCounts: Record<string, number> = {};
      for (const entry of data ?? []) {
        for (const t of (entry as { stress_triggers?: string[] }).stress_triggers ?? []) {
          triggerCounts[t] = (triggerCounts[t] ?? 0) + 1;
        }
      }
      const topTriggers = Object.entries(triggerCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([trigger, count]) => ({ trigger, count }));

      return successResponse({
        period_days: days,
        total_entries: scores.length,
        average_mood: avg ? parseFloat(avg.toFixed(1)) : null,
        min_mood: scores.length > 0 ? Math.min(...scores) : null,
        max_mood: scores.length > 0 ? Math.max(...scores) : null,
        top_triggers: topTriggers,
        entries: data,
      });
    }

    return errorResponse(`Unknown action: ${action}`, 400);
  } catch (err) {
    console.error("Mood function error:", (err as Error).message);
    return errorResponse("Internal error", 500);
  }
});
