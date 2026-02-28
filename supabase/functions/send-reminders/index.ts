// Missed-checkin auto-reminder — Supabase Edge Function
// Runs every 15 min via pg_cron. Checks each member's local time,
// detects missed daily/weekly submissions, and sends a Resend email.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ── Types (mirrors App.jsx data shapes) ─────────────────────

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  av: string;
  pw: string;
  tz?: string;
  kpis?: string[];
  addedAt?: string;
}

interface Team {
  name: string;
  members: Member[];
}

interface Company {
  name: string;
  tz?: string;
  teams: Record<string, Team>;
}

interface AppConfig {
  ceoEmail: string;
  ceoPw: string;
  companies: Record<string, Company>;
  users: Record<string, { compId: string; memberId: string }>;
}

interface CompanyData {
  dci: Record<string, { worked?: string; at?: string }>;
  wci: Record<string, { kpis?: unknown[]; at?: string }>;
  pto: Record<string, boolean>;
  [key: string]: unknown;
}

interface ReminderConfig {
  enabled: boolean;
  dailyEnabled: boolean;
  weeklyEnabled: boolean;
  pausedMembers: Record<string, { pausedAt: string; reason?: string }>;
}

interface LogEntry {
  id: string;
  type: "daily" | "weekly";
  memberId: string;
  memberName: string;
  memberEmail: string;
  companyId: string;
  date: string;
  weekId?: string;
  sentAt: string;
  status: "sent" | "failed";
  error: string | null;
}

// ── Constants ───────────────────────────────────────────────

const CFG_KEY = "acct-v9-cfg";
const DAILY_TRIGGER_HOUR = 18; // 6 PM local
const WEEKLY_TRIGGER_DAY = 6; // Saturday
const WEEKLY_TRIGGER_HOUR = 10; // 10 AM local
const TRIGGER_WINDOW_MIN = 15; // 15-min cron window
const MAX_LOG_ENTRIES = 500;
const WEEK_START_MS = Date.UTC(2026, 0, 5); // Mon Jan 5 2026 — matches App.jsx genWeeks()
const SEND_DELAY_MS = 200; // throttle between emails

// ── Helpers ─────────────────────────────────────────────────

function dataKey(compId: string): string {
  return `acct-v9-d-${compId}`;
}

function reminderCfgKey(compId: string): string {
  return `acct-v9-reminder-cfg-${compId}`;
}

function reminderLogKey(compId: string): string {
  return `acct-v9-reminder-log-${compId}`;
}

function genId(): string {
  return "r_" + Math.random().toString(36).slice(2, 8);
}

function resolveTz(member: Member, company: Company): string {
  return member.tz || company.tz || "UTC";
}

// Get local date/time components for a given timezone
function getLocalParts(utc: Date, tz: string): {
  year: number; month: number; day: number;
  hour: number; minute: number; dayOfWeek: number;
  dateStr: string;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "numeric", minute: "numeric", hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(utc);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";

  const year = parseInt(get("year"));
  const month = parseInt(get("month"));
  const day = parseInt(get("day"));
  const hour = parseInt(get("hour"));
  const minute = parseInt(get("minute"));
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // Intl weekday → JS dayOfWeek (0=Sun)
  const wdMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dayOfWeek = wdMap[get("weekday")] ?? 0;

  return { year, month, day, hour, minute, dayOfWeek, dateStr };
}

// Week ID matching App.jsx genWeeks(): w01, w02, ...
function getWeekId(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const idx = Math.floor((ms - WEEK_START_MS) / (7 * 86400000));
  if (idx < 0) return "w00";
  return `w${String(idx + 1).padStart(2, "0")}`;
}

// Step a dateStr back by N days
function stepDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

// Format a date for the email body: "Thu, Feb 26"
function dayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

// Format a week label from weekId: "W9: Mar 2" style
function weekLabel(weekId: string): string {
  const idx = parseInt(weekId.slice(1)) - 1;
  const monMs = WEEK_START_MS + idx * 7 * 86400000;
  const mon = new Date(monMs);
  const label = mon.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `W${idx + 1}: ${label}`;
}

function isWeekend(dayOfWeek: number): boolean {
  return dayOfWeek === 0 || dayOfWeek === 6;
}

// Check if log already has a successful send for this member+type+date
function alreadySent(
  log: LogEntry[], memberId: string, type: "daily" | "weekly", date: string,
): boolean {
  return log.some(
    (e) => e.memberId === memberId && e.type === type && e.date === date && e.status === "sent",
  );
}

// ── Email ───────────────────────────────────────────────────

async function sendEmail(
  resendKey: string,
  to: string,
  subject: string,
  body: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Checkin <notifications@resend.dev>",
        to: [to],
        subject,
        text: body,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "unknown");
      return { ok: false, error: `HTTP ${res.status}: ${text}` };
    }
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── KV helpers ──────────────────────────────────────────────

async function kvGet(
  supabase: ReturnType<typeof createClient>, key: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("kv_store")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

async function kvSet(
  supabase: ReturnType<typeof createClient>, key: string, value: string,
): Promise<void> {
  const { error } = await supabase
    .from("kv_store")
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw error;
}

// ── Main handler ────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const appUrl = Deno.env.get("APP_URL") || supabaseUrl;

    if (!resendKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "RESEND_API_KEY not set" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Allow debug time override for testing
    let now = new Date();
    try {
      const body = await req.json().catch(() => ({}));
      if (body.debug_utc_override) now = new Date(body.debug_utc_override);
    } catch { /* no body is fine */ }

    // 1. Load app config
    const cfgRaw = await kvGet(supabase, CFG_KEY);
    if (!cfgRaw) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "no config found" }),
        { headers: { "Content-Type": "application/json" } },
      );
    }
    const cfg: AppConfig = JSON.parse(cfgRaw);

    let totalProcessed = 0;
    let totalSent = 0;
    let totalFailed = 0;

    // 2. Process each company
    for (const [compId, company] of Object.entries(cfg.companies)) {
      // 2a. Check reminder config
      const rcRaw = await kvGet(supabase, reminderCfgKey(compId));
      if (!rcRaw) continue;
      const rc: ReminderConfig = JSON.parse(rcRaw);
      if (!rc.enabled) continue;

      // 2b. Load company data
      const cdRaw = await kvGet(supabase, dataKey(compId));
      const cd: CompanyData = cdRaw ? JSON.parse(cdRaw) : { dci: {}, wci: {}, pto: {} };

      // 2c. Load log
      const logRaw = await kvGet(supabase, reminderLogKey(compId));
      const log: LogEntry[] = logRaw ? JSON.parse(logRaw) : [];

      // 2d. Flatten all members
      const members: Member[] = Object.values(company.teams).flatMap((t) => t.members);

      let logDirty = false;

      for (const member of members) {
        if (!member.email) continue;

        // Skip paused members
        if (rc.pausedMembers?.[member.id]) continue;

        const tz = resolveTz(member, company);
        const local = getLocalParts(now, tz);
        const firstName = member.name.split(" ")[0];

        totalProcessed++;

        // ── Daily check ──
        if (
          rc.dailyEnabled &&
          local.hour === DAILY_TRIGGER_HOUR &&
          local.minute < TRIGGER_WINDOW_MIN &&
          !isWeekend(local.dayOfWeek)
        ) {
          const dciKey = `${member.id}:${local.dateStr}`;
          const ptoKey = `${member.id}:${local.dateStr}`;
          const submitted = !!cd.dci[dciKey];
          const onPto = !!cd.pto[ptoKey];
          const sent = alreadySent(log, member.id, "daily", local.dateStr);

          if (!submitted && !onPto && !sent) {
            const subject = `Your daily checkin is waiting \u2014 ${company.name}`;
            const body =
              `Hey ${firstName},\n\n` +
              `Quick heads-up \u2014 your daily checkin for ${dayLabel(local.dateStr)} hasn't come through yet. ` +
              `Takes 2 minutes: what worked, what didn't, tomorrow's plan.\n\n` +
              appUrl;

            const result = await sendEmail(resendKey, member.email, subject, body);

            log.push({
              id: genId(),
              type: "daily",
              memberId: member.id,
              memberName: member.name,
              memberEmail: member.email,
              companyId: compId,
              date: local.dateStr,
              sentAt: now.toISOString(),
              status: result.ok ? "sent" : "failed",
              error: result.error,
            });
            logDirty = true;

            if (result.ok) totalSent++;
            else totalFailed++;

            await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
          }
        }

        // ── Weekly KPI check ──
        if (
          rc.weeklyEnabled &&
          local.dayOfWeek === WEEKLY_TRIGGER_DAY &&
          local.hour === WEEKLY_TRIGGER_HOUR &&
          local.minute < TRIGGER_WINDOW_MIN
        ) {
          // Friday = 1 day before Saturday
          const fridayDate = stepDate(local.dateStr, 1);
          const wId = getWeekId(fridayDate);
          const wciKey = `${member.id}:${wId}`;
          const submitted = !!cd.wci[wciKey];
          const sent = alreadySent(log, member.id, "weekly", fridayDate);

          if (!submitted && !sent) {
            const wLabel = weekLabel(wId);
            const subject = `Weekly KPIs due \u2014 ${wLabel}, ${company.name}`;
            const body =
              `Hey ${firstName},\n\n` +
              `Your weekly KPI checkin for ${wLabel} is still open \u2014 ` +
              `you've got until Sunday night before it auto-locks. ` +
              `Jump in and mark your KPIs green or red.\n\n` +
              appUrl;

            const result = await sendEmail(resendKey, member.email, subject, body);

            log.push({
              id: genId(),
              type: "weekly",
              memberId: member.id,
              memberName: member.name,
              memberEmail: member.email,
              companyId: compId,
              date: fridayDate,
              weekId: wId,
              sentAt: now.toISOString(),
              status: result.ok ? "sent" : "failed",
              error: result.error,
            });
            logDirty = true;

            if (result.ok) totalSent++;
            else totalFailed++;

            await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
          }
        }
      }

      // 2f. Trim and save log
      if (logDirty) {
        const trimmed = log.slice(-MAX_LOG_ENTRIES);
        await kvSet(supabase, reminderLogKey(compId), JSON.stringify(trimmed));
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed: totalProcessed, sent: totalSent, failed: totalFailed }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
