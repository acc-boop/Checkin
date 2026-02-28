import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";

// ─── Google Fonts (single injection) ────────────────────────
const FONT_URL = "https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700&display=swap";
let fontInjected = false;
function ensureFont() {
  if (fontInjected) return;
  fontInjected = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT_URL;
  document.head.appendChild(link);
}

// ─── Hash Routing ──────────────────────────────────────────
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || "");
  useEffect(() => {
    const handler = () => setHash(window.location.hash.slice(1) || "");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  const navigate = useCallback((path, replace = false) => {
    if (replace) window.history.replaceState(null, "", "#" + path);
    else window.history.pushState(null, "", "#" + path);
    setHash(path);
  }, []);
  return { hash, navigate };
}
function parseRoute(hash) {
  const parts = hash.split("/").filter(Boolean);
  return { view: parts[0] || "", sub: parts[1] || "", param: parts[2] || "" };
}

// ─── Shared Style Constants ─────────────────────────────────
const S = {
  font: "'DM Sans',-apple-system,sans-serif",
  radius: { sm: 6, md: 10, lg: 12, xl: 16 },
  border: "#e5e7eb",
  borderLight: "#f3f4f6",
  textPrimary: "#111",
  textSecondary: "#374151",
  textMuted: "#6b7280",
  textFaint: "#9ca3af",
  bg: "#fafafa",
  bgWhite: "#fff",
  inputStyle: { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" },
  btnPrimary: { borderRadius: 12, border: "none", background: "#111", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" },
  textBlock: { whiteSpace: "pre-line", overflowWrap: "break-word", wordBreak: "break-word" },
};

// ─── Input Limits ──────────────────────────────────────────
const LIMITS = { daily: 2000, challenge: 1000, kpiActual: 200, feedback: 500, stuckReply: 500 };
function CharCount({ value, max }) {
  const len = value?.length || 0;
  if (len < max * 0.8) return null;
  return <div style={{ fontSize: 10, color: len >= max ? "#ef4444" : "#f59e0b", textAlign: "right", marginTop: 2 }}>{len}/{max}</div>;
}

// ─── Dates & Weeks ─────────────────────────────────────────
const GRACE_H = 48;

function getNow() { return new Date(); }
function getToday() { const n = getNow(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }

function useNow(interval = 60000) {
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), interval); return () => clearInterval(id); }, [interval]);
}

function genWeeks() {
  const w = []; const s = new Date(2026, 0, 5);
  const now = getNow();
  const endDate = new Date(now); endDate.setDate(endDate.getDate() + 28);
  let i = 0;
  while (true) {
    const mon = new Date(s); mon.setDate(mon.getDate() + i * 7);
    if (mon > endDate) break;
    const fri = new Date(mon); fri.setDate(fri.getDate() + 4); fri.setHours(23, 59, 59);
    const gr = new Date(fri); gr.setHours(gr.getHours() + GRACE_H);
    const monLbl = mon.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const sameMonth = mon.getMonth() === fri.getMonth();
    const range = sameMonth
      ? `${monLbl} – ${fri.getDate()}`
      : `${monLbl} – ${fri.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    w.push({ id: `w${String(i + 1).padStart(2, "0")}`, label: monLbl, range, short: `${mon.getMonth() + 1}/${mon.getDate()}`, mon, fri, gr });
    i++;
  }
  return w;
}
const WEEKS = genWeeks();
function getCW() { const now = getNow(); for (let i = WEEKS.length - 1; i >= 0; i--) { if (now >= WEEKS[i].mon) return i; } return 0; }
const isLocked = i => { const now = getNow(); return WEEKS[i] && now > WEEKS[i].gr; };
const isOverdue = i => { const now = getNow(); return WEEKS[i] && now > WEEKS[i].fri && now <= WEEKS[i].gr; };
const timeLeft = i => { const now = getNow(); const d = WEEKS[i]?.fri - now; if (!d || d <= 0) return null; const h = Math.floor(d / 36e5); return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`; };
function isWeekend(d) { const day = d.getDay(); return day === 0 || day === 6; }
function ds(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function dayLabel(s) { return new Date(s + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); }
function daysAgo(s) { const today = getToday(); const diff = Math.floor((today - new Date(s + "T12:00:00")) / 864e5); if (diff === 0) return "Today"; if (diff === 1) return "Yesterday"; return `${diff}d ago`; }

function getWeekdaysBack(count, from) {
  const days = []; const d = new Date(from);
  while (days.length < count) { if (!isWeekend(d)) days.push(ds(d)); d.setDate(d.getDate() - 1); }
  return days;
}
function lastCompletedWeekday() {
  const d = new Date(getToday());
  while (isWeekend(d)) d.setDate(d.getDate() - 1);
  return ds(d);
}
function memberSelectableDays() { return getWeekdaysBack(10, getToday()); }
function ceoBrowsableDays() { return getWeekdaysBack(7, getToday()).reverse(); }
function weekdaysInWeek(weekIdx) {
  const wk = WEEKS[weekIdx]; if (!wk) return [];
  const days = [];
  for (let i = 0; i < 5; i++) { const d = new Date(wk.mon); d.setDate(d.getDate() + i); days.push(ds(d)); }
  return days;
}

// ─── Timezone ────────────────────────────────────────────
const BROWSER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
function getTz(member, comp) { return member?.tz || comp?.tz || BROWSER_TZ; }
function fmtTime(iso, tz) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz || BROWSER_TZ, timeZoneName: "short" }); }
  catch { return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
}
function isLate(dateStr, isoAt, tz) {
  if (!dateStr || !isoAt) return false;
  try { return new Date(isoAt).toLocaleDateString("en-CA", { timeZone: tz || BROWSER_TZ }) > dateStr; }
  catch { return false; }
}
function fmtSubmission(dateStr, isoAt, tz) {
  if (!isoAt) return "";
  const time = fmtTime(isoAt, tz);
  if (!isLate(dateStr, isoAt, tz)) return time;
  try { const d = new Date(isoAt).toLocaleDateString("en-US", { weekday: "short", timeZone: tz || BROWSER_TZ }); return `${d} ${time}`; }
  catch { return time; }
}
function getTzList() { try { return Intl.supportedValuesOf("timeZone"); } catch { return [BROWSER_TZ]; } }
function tzLabel(tz) {
  try { const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date()); const s = p.find(x => x.type === "timeZoneName")?.value || ""; return `(${s}) ${tz.replace(/_/g, " ")}`; }
  catch { return tz; }
}

// ─── Utility ──────────────────────────────────────────────
function genId() { return Math.random().toString(36).slice(2, 8); }

// ─── Password Hashing ────────────────────────────────────
async function hashPw(pw) {
  const data = new TextEncoder().encode(pw + ':checkin-v9');
  const buf = await crypto.subtle.digest('SHA-256', data);
  return 'sha256:' + Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function checkPw(input, stored) {
  if (stored && stored.startsWith('sha256:')) return await hashPw(input) === stored;
  return input === stored;
}

// ─── Streak / Status helpers ──────────────────────────────
function getMemberStartWeek(member) {
  if (!member?.addedAt) return 0;
  const added = new Date(member.addedAt);
  for (let i = WEEKS.length - 1; i >= 0; i--) { if (added >= WEEKS[i].mon) return i; }
  return 0;
}
function getWkStreak(uid, wci, member) {
  const cw = getCW(); const sw = getMemberStartWeek(member); let s = 0;
  for (let i = cw; i >= 0; i--) {
    if (i < sw) break; // don't count pre-enrollment weeks
    const r = resolveWeek(uid, i, wci, member);
    if (r === "green") s++;
    else if (r === "red" || (r === "auto-red" && i >= sw)) break;
    else break;
  }
  return s;
}
function resolveWeek(uid, wi, wci, member) {
  const c = wci[`${uid}:${WEEKS[wi]?.id}`];
  if (c?.kpis) {
    const scored = c.kpis.filter(k => k.status);
    if (scored.length === 0) return null;
    return scored.every(k => k.status === "green") ? "green" : "red";
  }
  if (c?.status) return c.status;
  if (isLocked(wi)) {
    const sw = getMemberStartWeek(member);
    if (wi < sw) return "pre-enrollment";
    return "auto-red";
  }
  return null;
}
function weekDailySummary(uid, wi, dci, pto) {
  pto = pto || {};
  const days = weekdaysInWeek(wi); let count = 0, stuck = 0, ptoCount = 0;
  const today = ds(getToday());
  const elapsed = days.filter(d => d <= today).length;
  days.forEach(d => { if (pto[`${uid}:${d}`]) { ptoCount++; return; } const e = dci[`${uid}:${d}`]; if (e) { count++; if (e.stuck) stuck++; } });
  const expected = Math.max(0, elapsed - ptoCount);
  return { count, stuck, days, ptoCount, expected };
}

// ─── Semantic Colors ─────────────────────────────────────
const C = {
  success: "#10b981", successBg: "#d1fae5", successText: "#065f46",
  danger: "#ef4444", dangerBg: "#fee2e2", dangerText: "#991b1b",
  warning: "#f59e0b", warningBg: "#fffbeb", warningText: "#92400e",
  info: "#6366f1", infoBg: "#eef2ff", infoText: "#4338ca",
  neutral: "#6b7280", neutralBg: "#f3f4f6", neutralBorder: "#e5e7eb",
  confirm: "#10b981", confirmBg: "#ecfdf5",
  action: "#111",
};

// ─── Shared UI ────────────────────────────────────────────
const AV_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#f43f5e", "#14b8a6", "#f97316", "#84cc16", "#a855f7", "#3b82f6", "#0891b2", "#e11d48", "#7c3aed", "#059669"];
function avColor(initials) {
  if (!initials) return AV_COLORS[0];
  let hash = 0;
  for (let i = 0; i < initials.length; i++) hash = (hash * 31 + initials.charCodeAt(i)) | 0;
  return AV_COLORS[Math.abs(hash) % AV_COLORS.length];
}
const Av = ({ i, s = 30 }) => <div style={{ width: s, height: s, borderRadius: "50%", background: avColor(i), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: s * 0.37, fontWeight: 600, flexShrink: 0 }}>{i}</div>;
const Spark = ({ data, w = 60, h = 20 }) => {
  const v = data.map(d => d === "green" ? 1 : d === "red" || d === "auto-red" ? 0 : 0.5);
  if (v.length < 2) return null; const step = w / (v.length - 1);
  return <svg width={w} height={h} style={{ display: "block" }}><polyline points={v.map((val, i) => `${i * step},${h - val * h}`).join(" ")} fill="none" stroke="#d1d5db" strokeWidth="1.5" />{v.map((val, i) => <circle key={i} cx={i * step} cy={h - val * h} r="2.5" fill={data[i] === "green" ? "#10b981" : data[i] === "red" || data[i] === "auto-red" ? "#ef4444" : "#d1d5db"} />)}</svg>;
};
const badgeBase = { fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" };
const StuckBadge = () => <span style={{ ...badgeBase, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>{"\ud83d\udea8"} STUCK</span>;
const EditedBadge = () => <span style={{ ...badgeBase, background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}>{"\u270e"} edited</span>;
const LateBadge = () => <span style={{ ...badgeBase, background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }}>{"\u23f0"} LATE</span>;
const SideLabel = ({ children }) => <div style={{ fontSize: 10, color: "#9ca3af", padding: "14px 20px 6px", textTransform: "uppercase", letterSpacing: 1, fontWeight: 500 }}>{children}</div>;
const SideBtn = ({ active, onClick, children }) => <button onClick={onClick} style={{ width: "100%", padding: "7px 20px", border: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", background: active ? "#f3f4f6" : "transparent", color: active ? "#111" : "#6b7280", fontSize: 13, fontWeight: active ? 500 : 400, textAlign: "left" }}>{children}</button>;

// ─── Storage Keys ─────────────────────────────────────────
const CFG_KEY = "acct-v9-cfg";
const SESSION_KEY = "acct-v9-session";
function dataKey(compId) { return `acct-v9-d-${compId}`; }

// ═══════════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════════
export default function App() {
  const [cfg, setCfg] = useState(null); // { ceoEmail, ceoPw, companies: { id: { name, teams: { id: { name, members: [{ id, name, email, pw, role, av, kpis }] } } } }, users: { email: { compId, memberId } } }
  const [session, setSession] = useState(null); // { type:"ceo"|"member", compId, memberId }
  const [compData, setCompData] = useState({}); // { wci, dci, cmt, kpiP, sr, seen, pto }
  const compDataRef = useRef(compData);
  useEffect(() => { compDataRef.current = compData; }, [compData]);
  const [loaded, setLoaded] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [dataLoadErr, setDataLoadErr] = useState(null);
  const [saveErr, setSaveErr] = useState(null);
  const { hash, navigate } = useHashRoute();

  useEffect(ensureFont, []);
  useNow(60000);

  // ─── Load config & session ───
  useEffect(() => {
    (async () => {
      try { const r = await window.storage.get(CFG_KEY); if (r?.value) setCfg(JSON.parse(r.value)); } catch {}
      try { const s = localStorage.getItem(SESSION_KEY); if (s) setSession(JSON.parse(s)); } catch {}
      setLoaded(true);
    })();
  }, []);

  // ─── Load company data when session changes ───
  useEffect(() => {
    if (!session?.compId) { setCompData({}); setDataLoaded(false); setDataLoadErr(null); return; }
    setDataLoaded(false); setDataLoadErr(null);
    (async () => {
      try {
        const r = await window.storage.get(dataKey(session.compId));
        if (r?.value) setCompData(JSON.parse(r.value)); else setCompData({});
      } catch (err) {
        setCompData({});
        setDataLoadErr("Could not load your data. Check your connection and try again.");
      }
      setDataLoaded(true);
    })();
  }, [session?.compId]);

  // ─── Save config ───
  const saveCfg = useCallback(async (newCfg) => {
    setCfg(newCfg);
    setSaveErr(null);
    for (let i = 0; i < 3; i++) {
      try { await window.storage.set(CFG_KEY, JSON.stringify(newCfg)); return; } catch {
        if (i === 2) setSaveErr("Save failed — try again.");
        else await new Promise(r => setTimeout(r, 500 * (i + 1)));
      }
    }
  }, []);

  // ─── Save company operational data ───
  const saveData = useCallback(async (updates = {}) => {
    if (!session?.compId) return;
    const cd = compDataRef.current;
    const newData = {
      wci: updates.wci !== undefined ? updates.wci : cd.wci || {},
      dci: updates.dci !== undefined ? updates.dci : cd.dci || {},
      cmt: updates.cmt !== undefined ? updates.cmt : cd.cmt || {},
      kpiP: updates.kpiP !== undefined ? updates.kpiP : cd.kpiP || {},
      sr: updates.sr !== undefined ? updates.sr : cd.sr || {},
      seen: updates.seen !== undefined ? updates.seen : cd.seen || {},
      pto: updates.pto !== undefined ? updates.pto : cd.pto || {},
    };
    compDataRef.current = newData;
    setCompData(newData);
    setSaveErr(null);
    for (let i = 0; i < 3; i++) {
      try { await window.storage.set(dataKey(session.compId), JSON.stringify(newData)); return; } catch {
        if (i === 2) setSaveErr("Save failed — try again.");
        else await new Promise(r => setTimeout(r, 500 * (i + 1)));
      }
    }
  }, [session?.compId]);

  // ─── Session management ───
  const login = useCallback(async (sess) => {
    setSession(sess);
    try { if (sess) localStorage.setItem(SESSION_KEY, JSON.stringify(sess)); else localStorage.removeItem(SESSION_KEY); } catch {}
    if (!sess) navigate("", true);
    else if (sess.type === "ceo") navigate("daily", true);
    else navigate("daily", true);
  }, [navigate]);

  const logout = useCallback(() => login(null), [login]);

  if (!loaded) return <LoadingScreen />;

  // No config at all → first-time CEO setup
  if (!cfg) return <CeoSetup onComplete={async (newCfg) => { await saveCfg(newCfg); await login({ type: "ceo", compId: Object.keys(newCfg.companies)[0] }); }} />;

  // No session → login
  if (!session) return <LoginScreen cfg={cfg} onLogin={login} />;

  // Resolve current company
  const comp = cfg.companies[session.compId];
  if (!comp) return <SessionErrorScreen message="Your company could not be found. This may happen if the company was removed." onLogout={logout} />;

  const allMembers = Object.values(comp.teams).flatMap(t => t.members);
  const wci = compData.wci || {};
  const dci = compData.dci || {};
  const cmt = compData.cmt || {};
  const kpiP = compData.kpiP || {};
  const stuckRes = compData.sr || {};
  const seen = compData.seen || {};
  const pto = compData.pto || {};

  const getTeam = (uid) => Object.entries(comp.teams).find(([, t]) => t.members.some(m => m.id === uid));

  if (!dataLoaded) return <DataLoadingScreen />;

  if (dataLoadErr) return (
    <div style={{ minHeight: "100vh", fontFamily: S.font, background: S.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{GLOBAL_STYLES}</style>
      <div style={{ textAlign: "center", maxWidth: 400, padding: 20 }}>
        <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.4 }}>{"\u26a0"}</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Connection issue</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>{dataLoadErr}</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={() => { setDataLoaded(false); setDataLoadErr(null); const cid = session.compId; setSession(null); setTimeout(() => setSession({ ...session, compId: cid }), 50); }} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#111", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Retry</button>
          <button onClick={logout} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Sign out</button>
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 16 }}>Your data is safe — this is just a connection issue.</div>
      </div>
    </div>
  );

  if (session.type === "ceo") {
    return <>
      <CeoDash
        comp={comp} compId={session.compId} allCompanies={cfg.companies}
        allMembers={allMembers} getTeam={getTeam}
        wci={wci} dci={dci} cmt={cmt} kpiP={kpiP} stuckRes={stuckRes} seen={seen} pto={pto}
        save={saveData} cfg={cfg} saveCfg={saveCfg}
        switchCompany={(cid) => login({ type: "ceo", compId: cid })}
        logout={logout} hash={hash} navigate={navigate}
      />
      {saveErr && <ErrorToast msg={saveErr} onClose={() => setSaveErr(null)} />}
    </>;
  }

  const member = allMembers.find(m => m.id === session.memberId);
  if (!member) return <SessionErrorScreen message="Your account could not be found. You may have been removed from your team. Please contact your manager." onLogout={logout} />;

  return <>
    <MemberDash
      uid={member.id} m={member} getTeam={getTeam}
      wci={wci} dci={dci} cmt={cmt} kpiP={kpiP} stuckRes={stuckRes} seen={seen} pto={pto}
      save={saveData} logout={logout} cfg={cfg} saveCfg={saveCfg} compId={session.compId}
      hash={hash} navigate={navigate}
    />
    {saveErr && <ErrorToast msg={saveErr} onClose={() => setSaveErr(null)} />}
  </>;
}

const GLOBAL_STYLES = `
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(-12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
input:focus, textarea:focus, select:focus { outline: none; box-shadow: 0 0 0 2px #6366f1 !important; border-color: #6366f1 !important; }
button:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }
textarea { max-height: 400px; }
`;

function LoadingScreen() {
  useEffect(ensureFont, []);
  return <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", fontFamily: S.font, color: S.textFaint }}>
    <style>{GLOBAL_STYLES}</style>
    Loading…
  </div>;
}

function DataLoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", fontFamily: S.font, background: S.bg }}>

      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "10px 20px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>{"\u25ce"}</span><span style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.3 }}>Checkin</span>
      </div>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: "20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
          <div><div style={{ width: 120, height: 16, borderRadius: 4, background: "#e5e7eb", marginBottom: 6 }} /><div style={{ width: 80, height: 12, borderRadius: 4, background: "#f3f4f6" }} /></div>
        </div>
        {[1, 2, 3].map(i => <div key={i} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "20px", marginBottom: 12 }}>
          <div style={{ width: "60%", height: 14, borderRadius: 4, background: "#e5e7eb", marginBottom: 10 }} />
          <div style={{ width: "90%", height: 12, borderRadius: 4, background: "#f3f4f6", marginBottom: 6 }} />
          <div style={{ width: "70%", height: 12, borderRadius: 4, background: "#f3f4f6" }} />
        </div>)}
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#9ca3af" }}>Loading your data...</div>
      </div>
    </div>
  );
}

function SessionErrorScreen({ message, onLogout }) {
  return (
    <div style={{ minHeight: "100vh", fontFamily: S.font, background: S.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{GLOBAL_STYLES}</style>
      <div style={{ textAlign: "center", maxWidth: 400, padding: 20 }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>{"\ud83d\udd12"}</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Session expired</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20, lineHeight: 1.5 }}>{message}</div>
        <button onClick={onLogout} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "#111", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Sign in again</button>
      </div>
    </div>
  );
}

function SaveToast({ show }) {
  if (!show) return null;
  return <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#065f46", color: "#fff", padding: "12px 24px", borderRadius: 12, fontSize: 15, fontFamily: "'DM Sans',sans-serif", fontWeight: 700, zIndex: 9999, boxShadow: "0 8px 24px rgba(0,0,0,.2)", display: "flex", alignItems: "center", gap: 8, animation: "toastIn 0.3s ease-out" }}>
    <span style={{ fontSize: 20 }}>{"\u2713"}</span> Saved successfully
  </div>;
}

function ErrorToast({ msg, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 8000);
    return () => clearTimeout(timer);
  }, [msg, onClose]);
  return <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "#991b1b", color: "#fff", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontFamily: "'DM Sans',sans-serif", fontWeight: 500, zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,.15)", display: "flex", gap: 12, alignItems: "center", maxWidth: "90vw", animation: "toastIn 0.3s ease-out" }}>
    {msg}<button onClick={onClose} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 16, fontWeight: 700 }}>{"\u00d7"}</button>
  </div>;
}

// ═══════════════════════════════════════════════════════════
// CEO FIRST-TIME SETUP
// ═══════════════════════════════════════════════════════════
function CeoSetup({ onComplete }) {
  const [step, setStep] = useState(0);
  const [ceoEmail, setCeoEmail] = useState("");
  const [ceoPw, setCeoPw] = useState("");
  const [compName, setCompName] = useState("");

  const finish = async () => {
    if (!ceoEmail.trim() || !ceoPw.trim() || !compName.trim()) return;
    const compId = genId();
    const cfg = {
      ceoEmail: ceoEmail.trim().toLowerCase(),
      ceoPw: await hashPw(ceoPw.trim()),
      companies: { [compId]: { name: compName.trim(), teams: {} } },
      users: {},
    };
    onComplete(cfg);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: S.font, background: S.bg }}>
      <div style={{ width: "100%", maxWidth: 420, padding: 20 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, marginBottom: 4 }}>{"\u25ce"} Checkin</div>
          <div style={{ fontSize: 14, color: S.textMuted }}>Set up your account</div>
        </div>

        {step === 0 && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "28px 24px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Your CEO login</div>
            <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 5 }}>Email</label>
            <input value={ceoEmail} onChange={e => setCeoEmail(e.target.value)} placeholder="you@company.com" type="email"
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 16 }} />
            <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 5 }}>Password</label>
            <input value={ceoPw} onChange={e => setCeoPw(e.target.value)} placeholder="Choose a password" type="password"
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 20 }} />
            <button onClick={() => ceoEmail.trim() && ceoPw.trim() && setStep(1)} disabled={!ceoEmail.trim() || !ceoPw.trim()} style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: ceoEmail.trim() ? "#111" : "#e5e7eb", color: ceoEmail.trim() ? "#fff" : "#9ca3af", fontSize: 15, fontWeight: 700, cursor: ceoEmail.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
              Next
            </button>
          </div>
        )}

        {step === 1 && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "28px 24px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>First company</div>
            <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 5 }}>Company name</label>
            <input value={compName} onChange={e => setCompName(e.target.value)} placeholder="Acme Corp"
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 20 }}>You can add teams and members after setup.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setStep(0)} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1.5px solid #e5e7eb", background: "#fff", color: "#6b7280", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Back</button>
              <button onClick={finish} disabled={!compName.trim()} style={{ flex: 2, padding: "13px", borderRadius: 12, border: "none", background: compName.trim() ? "#111" : "#e5e7eb", color: compName.trim() ? "#fff" : "#9ca3af", fontSize: 15, fontWeight: 700, cursor: compName.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
                Create & Enter
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LOGIN SCREEN
// ═══════════════════════════════════════════════════════════
function LoginScreen({ cfg, onLogin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  const submit = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !pw.trim()) return;
    // CEO login
    if (e === cfg.ceoEmail && await checkPw(pw, cfg.ceoPw)) {
      const firstComp = Object.keys(cfg.companies)[0];
      onLogin({ type: "ceo", compId: firstComp });
      return;
    }
    // Member login
    const user = cfg.users[e];
    if (user) {
      const comp = cfg.companies[user.compId];
      const member = comp && Object.values(comp.teams).flatMap(t => t.members).find(m => m.id === user.memberId);
      if (member && await checkPw(pw, member.pw)) {
        onLogin({ type: "member", compId: user.compId, memberId: user.memberId });
        return;
      }
    }
    setErr("Wrong email or password.");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: S.font, background: S.bg }}>
      <div style={{ width: "100%", maxWidth: 380, padding: 20 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, marginBottom: 4 }}>{"\u25ce"} Checkin</div>
          <div style={{ fontSize: 14, color: S.textMuted }}>Sign in</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "28px 24px" }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 5 }}>Email</label>
          <input value={email} onChange={e => { setEmail(e.target.value); setErr(""); }} placeholder="you@company.com" type="email"
            style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 14 }}
            onKeyDown={e => e.key === "Enter" && submit()} />
          <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 5 }}>Password</label>
          <input value={pw} onChange={e => { setPw(e.target.value); setErr(""); }} placeholder="Password" type="password"
            style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 6 }}
            onKeyDown={e => e.key === "Enter" && submit()} />
          {err && <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 10 }}>{err}</div>}
          <button onClick={submit} style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: "#111", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 12 }}>
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MEMBER DASHBOARD
// ═══════════════════════════════════════════════════════════
function MemberDash({ uid, m, getTeam, wci, dci, cmt, kpiP, stuckRes, seen, pto, save, logout, cfg, saveCfg, compId, hash, navigate }) {
  const [teamKey] = getTeam(uid) || [];
  const route = parseRoute(hash);
  const tab = route.view === "weekly" ? "weekly" : "daily";
  const setTab = useCallback((t) => navigate(t), [navigate]);
  const [showPwChange, setShowPwChange] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [pwSaved, setPwSaved] = useState(false);
  const [showTzPicker, setShowTzPicker] = useState(false);

  const memberTz = getTz(m, cfg.companies[compId]);

  const changePw = async () => {
    if (!newPw.trim()) return;
    const hashed = await hashPw(newPw.trim());
    const comp = cfg.companies[compId];
    const newTeams = {};
    for (const [tid, team] of Object.entries(comp.teams)) {
      newTeams[tid] = { ...team, members: team.members.map(mem => mem.id === uid ? { ...mem, pw: hashed } : mem) };
    }
    await saveCfg({ ...cfg, companies: { ...cfg.companies, [compId]: { ...comp, teams: newTeams } } });
    setNewPw(""); setPwSaved(true); setTimeout(() => { setPwSaved(false); setShowPwChange(false); }, 1500);
  };

  const changeTz = async (newTz) => {
    const comp = cfg.companies[compId];
    const newTeams = {};
    for (const [tid, team] of Object.entries(comp.teams)) {
      newTeams[tid] = { ...team, members: team.members.map(mem => mem.id === uid ? { ...mem, tz: newTz } : mem) };
    }
    await saveCfg({ ...cfg, companies: { ...cfg.companies, [compId]: { ...comp, teams: newTeams } } });
  };

  const unreadDaily = useMemo(() => Object.keys(cmt).filter(k => k.startsWith(`d:${uid}:`) && !seen[`${uid}:${k}`]).length, [cmt, seen, uid]);
  const unreadWeekly = useMemo(() => Object.keys(cmt).filter(k => k.match(new RegExp(`^${uid}:w`)) && !seen[`${uid}:${k}`]).length, [cmt, seen, uid]);

  const dismissUnread = useCallback(() => {
    const prefix = tab === "daily" ? `d:${uid}:` : `${uid}:w`;
    const unseen = Object.keys(cmt).filter(k => k.startsWith(prefix) && !seen[`${uid}:${k}`]);
    if (unseen.length > 0) {
      const newSeen = { ...seen };
      unseen.forEach(k => { newSeen[`${uid}:${k}`] = true; });
      save({ seen: newSeen });
    }
  }, [tab, cmt, uid, seen, save]);

  return (
    <div style={{ minHeight: "100vh", fontFamily: S.font, background: S.bg, display: "flex", flexDirection: "column" }}>
      <style>{GLOBAL_STYLES}</style>
      <div style={{ background: S.bgWhite, borderBottom: `1px solid ${S.border}`, padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 18 }}>{"\u25ce"}</span><span style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.3 }}>Checkin</span></div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button onClick={() => { setShowTzPicker(!showTzPicker); setShowPwChange(false); }} style={{ background: "none", border: "none", fontSize: 12, color: "#9ca3af", cursor: "pointer", fontFamily: "inherit" }}>{"\ud83c\udf10"} Timezone</button>
          <button onClick={() => { setShowPwChange(!showPwChange); setShowTzPicker(false); }} style={{ background: "none", border: "none", fontSize: 12, color: "#9ca3af", cursor: "pointer", fontFamily: "inherit" }}>{"\u2699"} Password</button>
          <button onClick={logout} style={{ background: "none", border: "none", fontSize: 12, color: "#9ca3af", cursor: "pointer", fontFamily: "inherit" }}>Sign out</button>
        </div>
      </div>
      {showPwChange && (
        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "12px 20px", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>New password:</span>
          <input value={newPw} onChange={e => setNewPw(e.target.value)} type="password" placeholder="Enter new password"
            style={{ flex: 1, maxWidth: 240, padding: "7px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none" }}
            onKeyDown={e => e.key === "Enter" && changePw()} />
          <button onClick={changePw} disabled={!newPw.trim()} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: pwSaved ? "#10b981" : newPw.trim() ? "#111" : "#e5e7eb", color: newPw.trim() || pwSaved ? "#fff" : "#9ca3af", fontSize: 12, fontWeight: 600, cursor: newPw.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
            {pwSaved ? "\u2713 Saved" : "Update"}
          </button>
          <button onClick={() => { setShowPwChange(false); setNewPw(""); }} style={{ background: "none", border: "none", fontSize: 14, color: "#9ca3af", cursor: "pointer" }}>{"\u00d7"}</button>
        </div>
      )}
      {showTzPicker && (
        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "12px 20px", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{"\ud83c\udf10"} Timezone:</span>
          <select value={memberTz} onChange={e => changeTz(e.target.value)}
            style={{ flex: 1, maxWidth: 320, padding: "7px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none" }}>
            {getTzList().map(tz => <option key={tz} value={tz}>{tzLabel(tz)}</option>)}
          </select>
          <button onClick={() => setShowTzPicker(false)} style={{ background: "none", border: "none", fontSize: 14, color: "#9ca3af", cursor: "pointer" }}>{"\u00d7"}</button>
        </div>
      )}
      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "20px 16px 40px" }}>
        <div style={{ width: "100%", maxWidth: 540 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <Av i={m.av} s={44} />
            <div><div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>{m.name}</div><div style={{ fontSize: 13, color: "#6b7280" }}>{m.role}</div></div>
          </div>
          <div style={{ display: "flex", gap: 2, marginBottom: 20, background: "#e5e7eb", borderRadius: 10, padding: 3 }}>
            {[["daily", "Daily Update", unreadDaily], ["weekly", "Weekly KPIs", unreadWeekly]].map(([id, l, unread]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                flex: 1, padding: "9px 0", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit",
                background: tab === id ? "#fff" : unread > 0 ? "rgba(99,102,241,0.08)" : "transparent",
                color: tab === id ? "#111" : unread > 0 ? "#4338ca" : "#6b7280",
                fontSize: 14, fontWeight: tab === id ? 600 : unread > 0 ? 600 : 400,
                boxShadow: tab === id ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>{l}{unread > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: "#6366f1", color: "#fff", fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{unread}</span>}</button>
            ))}
          </div>
          {((unreadDaily > 0 && tab === "daily") || (unreadWeekly > 0 && tab === "weekly")) && (
            <div style={{ background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 10, padding: "10px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#4338ca" }}>{"\ud83d\udcec"} You have new feedback</span>
              <button onClick={dismissUnread} style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "#6366f1", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Mark as read</button>
            </div>
          )}
          {tab === "daily"
            ? <DailyMember uid={uid} m={m} dci={dci} cmt={cmt} stuckRes={stuckRes} pto={pto} save={save} tz={memberTz} />
            : <WeeklyMember uid={uid} m={m} wci={wci} dci={dci} cmt={cmt} kpiP={kpiP} pto={pto} save={save} tz={memberTz} />
          }
        </div>
      </div>
    </div>
  );
}

// ─── Daily prompts rotation ──────────────────────────────
const WORKED_HINTS = ["What was your biggest win?", "Did anything surprise you?", "What moved the needle most?", "What are you proudest of?", "What would you repeat tomorrow?"];
const DIDNT_HINTS = ["What would you do differently?", "Where did you lose time?", "What almost worked but didn't?", "What frustrated you most?"];
const PLAN_HINTS = ["What's your #1 priority?", "What would make tomorrow a great day?", "What's the one thing you must finish?", "Where will you focus first?"];
function getDailyHint(hints, dateStr) { const idx = dateStr.split("-").reduce((a, b) => a + parseInt(b), 0) % hints.length; return hints[idx]; }

// ─── Daily (Member) ───────────────────────────────────────
function DailyMember({ uid, m, dci, cmt, stuckRes, pto, save, tz }) {
  const selDays = useMemo(() => memberSelectableDays(), []);
  const [selDate, setSelDate] = useState(selDays[0]);
  const existing = dci[`${uid}:${selDate}`];
  const [worked, setWorked] = useState("");
  const [didnt, setDidnt] = useState("");
  const [plan, setPlan] = useState("");
  const [stuck, setStuck] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stuckErr, setStuckErr] = useState(false);
  const didntRef = useRef(null);

  const draftKey = `checkin-draft:${uid}:${selDate}`;

  useEffect(() => {
    if (existing) { setWorked(existing.worked || ""); setDidnt(existing.didnt || ""); setPlan(existing.plan || ""); setStuck(existing.stuck || false); }
    else {
      try {
        const draft = JSON.parse(localStorage.getItem(draftKey));
        if (draft) { setWorked(draft.worked || ""); setDidnt(draft.didnt || ""); setPlan(draft.plan || ""); setStuck(draft.stuck || false); }
        else { setWorked(""); setDidnt(""); setPlan(""); setStuck(false); }
      } catch { setWorked(""); setDidnt(""); setPlan(""); setStuck(false); }
    }
    setSaved(false); setStuckErr(false);
  }, [selDate, existing]);

  // Autosave draft
  useEffect(() => {
    if (existing) return;
    if (!worked && !didnt && !plan && !stuck) { try { localStorage.removeItem(draftKey); } catch {} return; }
    const timeout = setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify({ worked, didnt, plan, stuck })); } catch {}
    }, 500);
    return () => clearTimeout(timeout);
  }, [worked, didnt, plan, stuck, draftKey, existing]);

  // Warn before losing unsaved work
  useEffect(() => {
    const handler = (e) => { if (worked.trim() && !existing && !saved) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [worked, existing, saved]);

  // Cmd+Enter / Ctrl+Enter to submit
  useEffect(() => {
    const handler = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const isFutureDate = selDate > ds(getToday());

  const submit = async () => {
    if (!worked.trim() || isFutureDate || submitting) return;
    if (stuck && !didnt.trim()) { setStuckErr(true); didntRef.current?.focus(); return; }
    if (existing && !window.confirm("You already submitted for this day. Overwrite your previous entry?")) return;
    setSubmitting(true);
    try {
      const key = `${uid}:${selDate}`;
      const isEdit = !!existing;
      const entry = { worked, didnt, plan, stuck, at: new Date().toISOString() };
      if (isEdit) { entry.edited = true; entry.originalAt = existing.originalAt || existing.at; }
      else { entry.originalAt = entry.at; }
      await save({ dci: { ...dci, [key]: entry } });
      try { localStorage.removeItem(draftKey); } catch {}
      setSaved(true); setTimeout(() => setSaved(false), 4000);
    } finally { setSubmitting(false); }
  };

  const dailyCmt = cmt[`d:${uid}:${selDate}`];
  const stuckThread = stuckRes[`${uid}:${selDate}`];
  const isPto = !!pto[`${uid}:${selDate}`];
  const today = getToday();
  const canTogglePto = selDate === ds(today);

  const [showAllRecent, setShowAllRecent] = useState(false);
  const recentDays = useMemo(() => {
    const days = []; const all = getWeekdaysBack(20, new Date(getToday().getTime() - 864e5));
    for (const d of all) {
      if (d === selDate) continue;
      const e = dci[`${uid}:${d}`];
      const isPtoDay = !!pto[`${uid}:${d}`];
      if (e) days.push({ date: d, ...e, cmt: cmt[`d:${uid}:${d}`], isPto: isPtoDay });
      else days.push({ date: d, missed: true, isPto: isPtoDay });
    }
    return days;
  }, [uid, dci, cmt, pto, selDate]);
  const visibleRecent = showAllRecent ? recentDays : recentDays.slice(0, 5);

  return (
    <>
      <SaveToast show={saved} />
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "12px 16px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.8 }}>{selDate === ds(getToday()) ? "Today" : dayLabel(selDate)}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: isPto ? C.info : existing ? C.success : C.warning }}>{isPto ? "\u2708 PTO" : existing ? "\u2713 Submitted" : "Pending"}</span>
          {existing && isLate(selDate, existing.at, tz) && <LateBadge />}
        </div>
        {existing?.at && <div style={{ fontSize: 11, color: isLate(selDate, existing.at, tz) ? "#b45309" : "#9ca3af", marginTop: 2 }}>{fmtSubmission(selDate, existing.at, tz)}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, marginBottom: 16 }}>
        {selDays.map(d => {
          const sel = d === selDate; const has = !!dci[`${uid}:${d}`]; const isPtoDay = !!pto[`${uid}:${d}`]; const isFuture = d > ds(getToday());
          const canPto = d === ds(getToday());
          const statusColor = has ? "#10b981" : isPtoDay ? "#6366f1" : null;
          return <button key={d} onClick={() => setSelDate(d)} style={{
            padding: "8px 2px", borderRadius: 10, border: "2px solid", borderColor: sel ? "#111" : isPtoDay ? "#c7d2fe" : "#e5e7eb",
            background: sel ? "#111" : isPtoDay ? "#eef2ff" : "#fff", color: sel ? "#fff" : "#374151", fontSize: 13, fontWeight: sel ? 700 : 500,
            cursor: "pointer", fontFamily: "inherit", textAlign: "center", position: "relative", opacity: isFuture ? 0.4 : 1,
            minWidth: 0,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{dayLabel(d).split(" ")[0]}</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 1 }}>{isPtoDay ? "\u2708" : parseInt(d.split("-")[2])}</div>
            {statusColor && !isPtoDay && <div style={{ width: 6, height: 6, borderRadius: "50%", background: sel ? "#fff" : statusColor, position: "absolute", top: 4, right: 4 }} />}
            {canPto && sel && !has && <div onClick={(e) => { e.stopPropagation(); const k = `${uid}:${d}`; const np = { ...pto }; if (np[k]) delete np[k]; else np[k] = true; save({ pto: np }); }} style={{ position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderRadius: "50%", background: isPtoDay ? "#6366f1" : "#f3f4f6", border: "1.5px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, cursor: "pointer", color: isPtoDay ? "#fff" : "#9ca3af" }}>{"\u2708"}</div>}
          </button>;
        })}
      </div>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "22px 20px 26px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Daily Update</span>
          {existing?.edited && <EditedBadge />}
        </div>
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 18, display: "flex", alignItems: "center", gap: 12 }}>
          {dayLabel(selDate)}
          {canTogglePto ? (
            <button onClick={() => { const k = `${uid}:${selDate}`; const np = { ...pto }; if (np[k]) delete np[k]; else np[k] = true; save({ pto: np }); }} style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 6, border: "1px solid", borderColor: isPto ? "#6366f1" : "#e5e7eb", background: isPto ? "#eef2ff" : "#fff", color: isPto ? "#6366f1" : "#9ca3af", cursor: "pointer", fontFamily: "inherit" }}>
              {isPto ? "\u2708 PTO (click to remove)" : "\u2708 Mark PTO"}
            </button>
          ) : isPto ? (
            <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 6, background: "#eef2ff", color: "#6366f1" }}>{"\u2708"} PTO</span>
          ) : null}
        </div>

        {isPto ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#6366f1" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{"\u2708"}</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>PTO — no update needed</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>This day won't count against your streak.</div>
          </div>
        ) : (<>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 5, color: "#10b981" }}>1. What worked today? <span style={{ color: "#ef4444", fontWeight: 700 }}>*</span> <span style={{ fontWeight: 400, color: S.textFaint, fontSize: 12 }}>{getDailyHint(WORKED_HINTS, selDate)}</span></label>
            <textarea value={worked} onChange={e => setWorked(e.target.value)} rows={3} maxLength={LIMITS.daily} placeholder="e.g. Closed 3 deals worth $12K, finished onboarding deck, 15 cold calls — 4 booked"
              style={{ ...S.inputStyle, resize: "vertical", lineHeight: 1.5 }} />
            <CharCount value={worked} max={LIMITS.daily} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 5, color: "#ef4444" }}>
              2. What didn't work? {stuck ? <span style={{ color: "#ef4444", fontWeight: 700 }}>*</span> : <span style={{ fontWeight: 400, color: S.textFaint, fontSize: 11 }}>(optional)</span>} <span style={{ fontWeight: 400, color: S.textFaint, fontSize: 12 }}>{getDailyHint(DIDNT_HINTS, selDate)}</span>
            </label>
            <textarea ref={didntRef} value={didnt} onChange={e => { setDidnt(e.target.value); if (e.target.value.trim()) setStuckErr(false); }} rows={2} maxLength={LIMITS.daily} placeholder="e.g. Demo fell through — switching to async video pitches next week"
              style={{ ...S.inputStyle, resize: "vertical", lineHeight: 1.5, borderColor: (stuckErr || (stuck && !didnt.trim())) ? "#ef4444" : S.border }} />
            {(stuckErr || (stuck && !didnt.trim())) && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4, fontWeight: 500 }}>{"\u26a0"} Required when stuck — describe what isn't working and what you're changing.</div>}
            <CharCount value={didnt} max={LIMITS.daily} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 5, color: "#6366f1" }}>3. Plan for tomorrow <span style={{ fontWeight: 400, color: S.textFaint, fontSize: 11 }}>(optional)</span> <span style={{ fontWeight: 400, color: S.textFaint, fontSize: 12 }}>{getDailyHint(PLAN_HINTS, selDate)}</span></label>
            <textarea value={plan} onChange={e => setPlan(e.target.value)} rows={2} maxLength={LIMITS.daily} placeholder="e.g. Follow up with 5 warm leads, prep Q2 forecast, need help with pricing approval"
              style={{ ...S.inputStyle, resize: "vertical", lineHeight: 1.5 }} />
            <CharCount value={plan} max={LIMITS.daily} />
          </div>
          <button onClick={() => { const next = !stuck; setStuck(next); if (next && !didnt.trim()) { setStuckErr(true); setTimeout(() => didntRef.current?.focus(), 50); } else { setStuckErr(false); } }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12, border: "2px solid", borderColor: stuck ? "#ef4444" : "#f59e0b", background: stuck ? "#fef2f2" : "#fffbeb", cursor: "pointer", fontFamily: "inherit", width: "100%", marginBottom: 20, transition: "all 0.15s" }}>
            <span style={{ fontSize: 20, width: 32, height: 32, borderRadius: "50%", background: stuck ? "#ef4444" : "#f59e0b", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{stuck ? "\ud83d\udea8" : "?"}</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: stuck ? "#dc2626" : "#92400e" }}>{stuck ? "STUCK — help requested" : "Need help? Tap here"}</div>
              <div style={{ fontSize: 11, color: stuck ? "#ef4444" : "#b45309", fontWeight: 400 }}>{stuck ? "CEO will be notified" : "Flag this if you're blocked on something"}</div>
            </div>
          </button>
          {isFutureDate && <div style={{ textAlign: "center", padding: "10px", fontSize: 13, color: "#9ca3af", fontStyle: "italic" }}>Can't submit for a future date.</div>}
          <div style={{ position: "sticky", bottom: 0, background: "#fff", padding: "12px 0 4px", marginTop: 4, zIndex: 10 }}>
            <button onClick={submit} disabled={!worked.trim() || isFutureDate || submitting} style={{ width: "100%", padding: "15px", borderRadius: 12, border: "none", background: !worked.trim() || isFutureDate || submitting ? "#e5e7eb" : saved ? "#10b981" : "#111", color: !worked.trim() || isFutureDate || submitting ? "#9ca3af" : "#fff", fontSize: 16, fontWeight: 700, cursor: worked.trim() && !isFutureDate && !submitting ? "pointer" : "default", fontFamily: "inherit", transition: "background 0.2s" }}>
              {submitting ? "Saving..." : saved ? "\u2713 Saved!" : existing ? "Update" : selDate !== ds(getToday()) ? `Submit for ${dayLabel(selDate)}` : "Submit daily update"}
            </button>
            {!isFutureDate && worked.trim() && <div style={{ textAlign: "center", fontSize: 10, color: "#9ca3af", marginTop: 4 }}>{navigator.platform?.includes("Mac") ? "\u2318" : "Ctrl"}+Enter</div>}
          </div>
        </>)}

        {stuckThread && stuckThread.length > 0 && (
          <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca" }}>
            <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 600, marginBottom: 10 }}>{"\ud83d\udea8"} Stuck thread</div>
            {stuckThread.map((msg, i) => {
              const isCeo = msg.from === "ceo";
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isCeo ? "flex-start" : "flex-end", marginBottom: 8 }}>
                  <div style={{ maxWidth: "85%", padding: "8px 12px", borderRadius: 10, background: isCeo ? "#ecfdf5" : "#fff", border: `1px solid ${isCeo ? "#a7f3d0" : "#e5e7eb"}` }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: isCeo ? "#065f46" : S.textMuted, marginBottom: 2 }}>{isCeo ? "CEO" : "You"}</div>
                    <div style={{ fontSize: 13, color: S.textSecondary, ...S.textBlock }}>{msg.text}</div>
                  </div>
                  {msg.at && <div style={{ fontSize: 9, color: S.textFaint, marginTop: 2, paddingLeft: 4, paddingRight: 4 }}>{fmtTime(msg.at, tz)}</div>}
                </div>
              );
            })}
            <MemberStuckReply uid={uid} date={selDate} stuckRes={stuckRes} save={save} />
          </div>
        )}

        {dailyCmt && <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}><div style={{ fontSize: 11, color: "#6366f1", fontWeight: 600, marginBottom: 3 }}>{"\ud83d\udcac"} Feedback</div><div style={{ fontSize: 13, color: "#334155" }}>{dailyCmt.text}</div></div>}
      </div>

      {recentDays.length > 0 && <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Recent</span>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>{recentDays.length} days</span>
        </div>
        {visibleRecent.map(d => (
          <div key={d.date} style={{ background: d.missed ? "#fafafa" : "#fff", borderRadius: 12, border: "1px solid", borderColor: d.missed && !d.isPto ? "#fecaca" : "#e5e7eb", padding: "14px 16px", marginBottom: 8, opacity: d.missed ? 0.7 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: d.missed ? 0 : 6 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{dayLabel(d.date)}</span>
                {d.edited && <EditedBadge />}
                {!d.missed && isLate(d.date, d.at, tz) && <LateBadge />}
              </div>
              {d.missed ? (
                <span style={{ fontSize: 11, color: d.isPto ? "#6366f1" : "#ef4444", fontWeight: 500 }}>{d.isPto ? "\u2708 PTO" : "Missed"}</span>
              ) : (
                <span style={{ fontSize: 11, color: isLate(d.date, d.at, tz) ? "#b45309" : "#9ca3af" }}>{fmtSubmission(d.date, d.at, tz)}</span>
              )}
            </div>
            {!d.missed && <>
              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5, whiteSpace: "pre-line", overflowWrap: "break-word", wordBreak: "break-word" }}>{d.worked}</div>
              {d.didnt && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4, whiteSpace: "pre-line", overflowWrap: "break-word", wordBreak: "break-word" }}>{"\u21b3"} {d.didnt}</div>}
              {d.cmt && <div style={{ fontSize: 12, color: "#6366f1", marginTop: 4 }}>{"\ud83d\udcac"} {d.cmt.text}</div>}
            </>}
          </div>
        ))}
        {recentDays.length > 5 && (
          <button onClick={() => setShowAllRecent(!showAllRecent)} style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", color: "#6366f1", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>
            {showAllRecent ? "Show less" : `Show ${recentDays.length - 5} more days`}
          </button>
        )}
      </div>}
    </>
  );
}

// ─── Weekly KPI (Member) ──────────────────────────────────
function WeeklyMember({ uid, m, wci, dci, cmt, kpiP, pto, save, tz }) {
  const CW = getCW();
  const autoWeek = useMemo(() => { for (let i = CW; i >= 0; i--) { if (!wci[`${uid}:${WEEKS[i].id}`] && !isLocked(i)) return i; } return CW; }, [uid, wci, CW]);
  const [wIdx, setWIdx] = useState(autoWeek);
  const [kpiStates, setKpiStates] = useState(m.kpis.map(() => ({ status: null, actual: "" })));
  const [challenge, setChallenge] = useState("");
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);
  const [showAllWeeks, setShowAllWeeks] = useState(false);

  const wk = WEEKS[wIdx], key = `${uid}:${wk?.id}`, existing = wci[key];
  const locked = isLocked(wIdx), overdue = isOverdue(wIdx) && !existing, dl = timeLeft(wIdx);
  const streak = getWkStreak(uid, wci, m), ceoComment = cmt[key];
  const allKpiSet = kpiStates.every(k => k.status);
  const startWeek = getMemberStartWeek(m);
  const hist = useMemo(() => WEEKS.slice(0, CW + 1).map((_, i) => resolveWeek(uid, i, wci, m)), [uid, wci, m]);
  const enrolledHist = hist.filter((h, i) => i >= startWeek && h !== "pre-enrollment");
  const totalGreen = enrolledHist.filter(h => h === "green").length;
  const totalActualRed = enrolledHist.filter(h => h === "red").length;
  const totalAutoRed = enrolledHist.filter(h => h === "auto-red").length;
  const totalScored = enrolledHist.filter(h => h).length;
  const hitRate = totalScored > 0 ? Math.round((totalGreen / totalScored) * 100) : null;
  const dailySumm = weekDailySummary(uid, wIdx, dci, pto);

  const dailyContext = useMemo(() => {
    const days = weekdaysInWeek(wIdx);
    return days.map(d => dci[`${uid}:${d}`]).filter(Boolean).map(e => e.worked).join("\n");
  }, [uid, wIdx, dci]);

  useEffect(() => {
    if (existing?.kpis) { setKpiStates(m.kpis.map((_, i) => existing.kpis[i] || { status: null, actual: "" })); setChallenge(existing.challenge || ""); }
    else { setKpiStates(m.kpis.map(() => ({ status: null, actual: "" }))); setChallenge(""); }
    setSaved(false);
  }, [wIdx, existing]);

  const submit = async () => {
    if (!allKpiSet || locked || submitting) return;
    setSubmitting(true);
    try {
      await save({ wci: { ...wci, [key]: { kpis: kpiStates, challenge, at: new Date().toISOString() } } });
      setSaved(true); setTimeout(() => setSaved(false), 4000);
    } finally { setSubmitting(false); }
  };

  // Cmd+Enter / Ctrl+Enter to submit
  useEffect(() => {
    const handler = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const allWeekCount = CW + 1;
  const vs = showAllWeeks ? Math.max(0, startWeek) : Math.max(0, CW - 11);
  const vw = WEEKS.slice(vs, CW + 1);
  const hasMoreWeeks = allWeekCount > 12 && !showAllWeeks;

  return (
    <>
      <SaveToast show={saved} />
      {overdue && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "10px 16px", marginBottom: 12, fontSize: 13, color: "#991b1b" }}>{"\u26a0"} <strong>Late.</strong> Submit before Sunday or auto-red.</div>}
      {dl && !existing && !overdue && <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "8px 16px", marginBottom: 12, fontSize: 13, color: "#92400e" }}>{"\u23f0"} Due in <strong>{dl}</strong></div>}

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "20px 20px 16px", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 16 }}>
            <div><div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -1, color: "#10b981" }}>{totalGreen}</div><div style={{ fontSize: 11, color: "#6b7280" }}>green</div></div>
            <div title={totalAutoRed > 0 ? `${totalActualRed} missed + ${totalAutoRed} not submitted` : undefined}><div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -1, color: totalActualRed + totalAutoRed > 0 ? "#ef4444" : "#d1d5db" }}>{totalActualRed}{totalAutoRed > 0 && <span style={{ fontSize: 16, color: S.textFaint, fontWeight: 600 }}>+{totalAutoRed}</span>}</div><div style={{ fontSize: 11, color: "#6b7280" }}>{totalAutoRed > 0 ? "red + auto" : "red"}</div></div>
            <div title={`${hitRate != null ? hitRate + "%" : "N/A"} hit rate\n\nGreen: 70%+\nAmber: 50–69%\nRed: below 50%\n\nOnly counts weeks since you were added.`}><div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -1, color: hitRate == null ? "#d1d5db" : hitRate >= 70 ? "#10b981" : hitRate >= 50 ? "#f59e0b" : "#ef4444", cursor: "help" }}>{hitRate != null ? hitRate + "%" : "N/A"}</div><div style={{ fontSize: 11, color: S.textMuted }}>hit rate</div></div>
          </div>
          {streak > 0 && <div style={{ background: streak >= 6 ? "#ecfdf5" : "#f3f4f6", padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700, color: streak >= 6 ? "#065f46" : "#6b7280" }}>{streak >= 6 ? "\ud83d\udd25 " : ""}{streak}w</div>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${vw.length},1fr)`, gap: 4 }}>
          {vw.map((w, vi) => {
            const ri = vs + vi, s = hist[ri], cur = ri === CW, isFutureWk = ri > CW, isPast = ri < CW && !s;
            const isPreEnroll = s === "pre-enrollment";
            const isAutoRed = s === "auto-red";
            const isLockedWk = isLocked(ri);
            const dleft = cur ? timeLeft(ri) : null;
            const lockReason = isLockedWk && w ? `Locked — grace period ended ${w.gr.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}` : "";
            const tooltip = isPreEnroll ? `${w.range} — Not enrolled yet`
              : s === "green" ? `${w.range} — Hit`
              : isAutoRed ? `${w.range} — No submission (auto-red)\n${lockReason}`
              : s === "red" ? `${w.range} — Missed`
              : isFutureWk ? `${w.range} — Upcoming`
              : cur ? `${w.range} — Current${dleft ? ` (${dleft} left)` : ""}`
              : `${w.range} — Not submitted`;
            const bg = s === "green" ? "#10b981" : s === "red" ? "#ef4444" : isAutoRed ? S.borderLight : isPreEnroll ? S.bg : cur ? S.borderLight : isFutureWk ? S.bg : "#f9fafb";
            const bd = ri === wIdx ? "2.5px solid #111" : isAutoRed ? "1.5px dashed #f87171" : isPast && !isPreEnroll ? "1.5px dashed #d1d5db" : "1.5px solid transparent";
            return <div key={w.id}
              onClick={() => { if (isLockedWk && !isPreEnroll) alert(lockReason || "This week is locked."); else if (!isLockedWk) setWIdx(ri); }}
              title={tooltip}
              style={{ aspectRatio: "1", maxWidth: 56, borderRadius: 8, cursor: isPreEnroll || isFutureWk ? "default" : "pointer", background: bg, border: bd, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transition: "all 0.15s", opacity: isPreEnroll ? 0.3 : isFutureWk ? 0.4 : 1 }}>
              {s === "green" && <span style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>{"\u2713"}</span>}
              {s === "red" && <span style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>{"\u2717"}</span>}
              {isAutoRed && <span style={{ color: "#f87171", fontSize: 12, fontWeight: 700 }}>{"\u2014"}</span>}
              {isPreEnroll && <span style={{ fontSize: 10, color: "#d1d5db" }}>{"\u2014"}</span>}
              {!s && cur && <>
                <span style={{ fontSize: 8, color: "#6366f1", fontWeight: 700 }}>NOW</span>
                {dleft && <span style={{ fontSize: 7, color: S.textFaint, fontWeight: 500, marginTop: 1 }}>{dleft}</span>}
              </>}
              {!s && isPast && !isPreEnroll && <span style={{ fontSize: 10, color: "#d1d5db" }}>{"\u2014"}</span>}
            </div>;
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${vw.length},1fr)`, gap: 4, marginTop: 3 }}>
          {vw.map((w, vi) => <div key={w.id} title={w.range} style={{ textAlign: "center", fontSize: 9, color: vs + vi === wIdx ? "#111" : "#9ca3af", fontWeight: vs + vi === wIdx ? 700 : 400, cursor: "default" }}>{w.label}</div>)}
        </div>
        {(hasMoreWeeks || showAllWeeks) && (
          <button onClick={() => setShowAllWeeks(!showAllWeeks)} style={{ background: "none", border: "none", fontSize: 10, color: "#6366f1", cursor: "pointer", fontFamily: "inherit", fontWeight: 500, marginTop: 6, padding: 0, display: "block", width: "100%", textAlign: "center" }}>
            {showAllWeeks ? "Show recent 12 weeks" : `Show all ${allWeekCount} weeks`}
          </button>
        )}
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "#6b7280" }}>Dailies this week</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: dailySumm.count >= dailySumm.expected ? "#10b981" : dailySumm.count >= Math.ceil(dailySumm.expected / 2) ? "#f59e0b" : "#ef4444" }}>{dailySumm.count}/{dailySumm.expected}</span>
      </div>

      {dailyContext && (
        <div style={{ background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", padding: "12px 16px", marginBottom: 16, position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Your daily numbers this week</div>
            <button onClick={() => setContextExpanded(!contextExpanded)} style={{ background: "none", border: "none", fontSize: 11, color: "#6366f1", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, padding: 0 }}>{contextExpanded ? "Collapse" : "Expand"}</button>
          </div>
          <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.5, whiteSpace: "pre-line", overflowWrap: "break-word", wordBreak: "break-word", maxHeight: contextExpanded ? "none" : 80, overflow: "hidden" }}>{dailyContext}</div>
          {!contextExpanded && dailyContext.split("\n").length > 3 && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 32, background: "linear-gradient(transparent, #f8fafc)", borderRadius: "0 0 12px 12px", pointerEvents: "none" }} />}
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "22px 20px 26px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{wk.range}</span>
          {existing && <span style={{ fontSize: 11, color: "#10b981", fontWeight: 500 }}>{"\u2713"} {fmtTime(existing.at, tz)}</span>}
        </div>
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 18 }}>{locked && !existing ? "Auto-red." : "Mark each KPI."}</div>

        {locked && !existing ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}><div style={{ fontSize: 14, color: "#ef4444", fontWeight: 500 }}>{"\u2717"} No check-in — auto-red</div></div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {m.kpis.map((kpi, ki) => (
                <div key={ki} style={{ border: "1.5px solid", borderColor: kpiStates[ki]?.status === "green" ? "#10b981" : kpiStates[ki]?.status === "red" ? "#ef4444" : "#e5e7eb", borderRadius: 12, padding: "14px 16px", background: kpiStates[ki]?.status === "green" ? "#f0fdf4" : kpiStates[ki]?.status === "red" ? "#fef2f2" : "#fff", transition: "all 0.15s" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{kpi}</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    {[{ s: "green", icon: "\u2713", l: "Hit", bd: "#10b981", bg: "#d1fae5", t: "#065f46", shape: "circle" }, { s: "red", icon: "\u2717", l: "Miss", bd: "#ef4444", bg: "#fee2e2", t: "#991b1b", shape: "square" }].map(o => (
                      <button key={o.s} onClick={() => { const n = [...kpiStates]; n[ki] = { ...n[ki], status: o.s }; setKpiStates(n); }} disabled={locked} style={{
                        flex: 1, padding: "10px", borderRadius: 10, border: "2px solid", borderColor: kpiStates[ki]?.status === o.s ? o.bd : "#e5e7eb", background: kpiStates[ki]?.status === o.s ? o.bg : "#fff", cursor: locked ? "default" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6
                      }}>
                        <span style={{ width: 24, height: 24, borderRadius: o.shape === "circle" ? "50%" : 4, background: kpiStates[ki]?.status === o.s ? o.bd : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: kpiStates[ki]?.status === o.s ? "#fff" : "#d1d5db", fontWeight: 800 }}>{o.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: kpiStates[ki]?.status === o.s ? o.t : "#9ca3af" }}>{o.l}</span>
                      </button>
                    ))}
                  </div>
                  <input value={kpiStates[ki]?.actual || ""} onChange={e => { const n = [...kpiStates]; n[ki] = { ...n[ki], actual: e.target.value }; setKpiStates(n); }} disabled={locked} maxLength={LIMITS.kpiActual} placeholder="Actual result (e.g. $32K closed, 2 reviews done)"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${S.border}`, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 5 }}>Challenges? <span style={{ fontWeight: 400, color: S.textFaint }}>(optional)</span></label>
              <textarea value={challenge} onChange={e => setChallenge(e.target.value)} disabled={locked} maxLength={LIMITS.challenge} placeholder="e.g. Pipeline slowed down — need marketing support on lead gen" rows={2} style={{ ...S.inputStyle, resize: "vertical" }} />
              <CharCount value={challenge} max={LIMITS.challenge} />
            </div>
            <button onClick={submit} disabled={!allKpiSet || locked || submitting} style={{ width: "100%", padding: "15px", borderRadius: 12, border: "none", background: !allKpiSet || locked || submitting ? "#e5e7eb" : saved ? "#10b981" : "#111", color: !allKpiSet || locked || submitting ? "#9ca3af" : "#fff", fontSize: 16, fontWeight: 700, cursor: allKpiSet && !locked && !submitting ? "pointer" : "default", fontFamily: "inherit" }}>
              {submitting ? "Saving..." : saved ? "\u2713 Saved!" : existing ? "Update" : "Submit"}
            </button>
          </>
        )}
        {ceoComment && <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}><div style={{ fontSize: 11, color: "#6366f1", fontWeight: 600, marginBottom: 3 }}>{"\ud83d\udcac"} Feedback</div><div style={{ fontSize: 13, color: "#334155" }}>{ceoComment.text}</div></div>}
      </div>

      {/* Past Weeks History */}
      {(() => {
        const pastWeeks = [];
        for (let i = CW - 1; i >= Math.max(0, CW - 8); i--) {
          const entry = wci[`${uid}:${WEEKS[i]?.id}`];
          if (entry?.kpis) pastWeeks.push({ wi: i, entry });
        }
        if (pastWeeks.length === 0) return null;
        return (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Past Weeks</div>
            {pastWeeks.map(({ wi: pwi, entry: pe }) => {
              const pwk = WEEKS[pwi];
              const pCmt = cmt[`${uid}:${pwk.id}`];
              const pStatus = resolveWeek(uid, pwi, wci, m);
              if (pStatus === "pre-enrollment") return null;
              return (
                <div key={pwk.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "14px 16px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{pwk.range}</span>
                    <span style={{ width: 18, height: 18, borderRadius: "50%", background: pStatus === "green" ? "#10b981" : "#ef4444", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700 }}>{pStatus === "green" ? "\u2713" : "\u2717"}</span>
                  </div>
                  {m.kpis.map((kpi, ki) => {
                    const k = pe.kpis[ki];
                    return (
                      <div key={ki} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: ki < m.kpis.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                        <span style={{ fontSize: 12, color: "#374151" }}>{kpi}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {k?.actual && <span style={{ fontSize: 11, color: "#6b7280" }}>{k.actual}</span>}
                          <span style={{ width: 14, height: 14, borderRadius: "50%", background: k?.status === "green" ? "#10b981" : "#ef4444", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#fff", fontWeight: 700 }}>{k?.status === "green" ? "\u2713" : "\u2717"}</span>
                        </div>
                      </div>
                    );
                  })}
                  {pe.challenge && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, fontStyle: "italic" }}>{pe.challenge}</div>}
                  {pCmt && <div style={{ fontSize: 12, color: "#6366f1", marginTop: 4 }}>{"\ud83d\udcac"} {pCmt.text}</div>}
                </div>
              );
            })}
          </div>
        );
      })()}
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// CEO DASHBOARD
// ═══════════════════════════════════════════════════════════
function CeoDash({ comp, compId, allCompanies, allMembers, getTeam, wci, dci, cmt, kpiP, stuckRes, seen, pto, save, cfg, saveCfg, switchCompany, logout, hash, navigate }) {
  const TEAMS = comp.teams;
  const CW = getCW();
  const route = parseRoute(hash);
  const view = ["daily", "weekly", "heatmap"].includes(route.view) ? route.view : "daily";
  const setView = useCallback((v) => { navigate(v); }, [navigate]);
  const [wIdx, setWIdx] = useState(() => getCW());
  const [filter, setFilter] = useState(null);
  const drillPerson = route.sub === "drill" && route.param ? route.param : null;
  const setDrillPerson = useCallback((id) => { if (id) navigate(`${view}/drill/${id}`); else navigate(view); }, [navigate, view]);
  const [copied, setCopied] = useState(null);
  const showAdmin = route.view === "admin";
  const setShowAdmin = useCallback((v) => { if (v) navigate("admin"); else navigate("daily"); }, [navigate]);
  const [viewAsMember, setViewAsMember] = useState(null);
  const [viewAsOpen, setViewAsOpen] = useState(false);

  // Check if company has any members
  const hasMembers = allMembers.length > 0;

  const filteredMembers = useMemo(() => filter ? (TEAMS[filter]?.members || []) : allMembers, [filter, allMembers, TEAMS]);

  const rs = useCallback((uid, wi, member) => resolveWeek(uid, wi, wci, member), [wci]);

  const [feedDate, setFeedDate] = useState(lastCompletedWeekday());
  const browDays = useMemo(() => ceoBrowsableDays(), []);

  const wk = WEEKS[wIdx];

  // Weekly table data
  const weeklyTableData = useMemo(() => {
    return filteredMembers.map(m => {
      const hist = WEEKS.slice(0, CW + 1).map((_, i) => rs(m.id, i, m));
      const dSumm = weekDailySummary(m.id, wIdx, dci, pto);
      return { ...m, hist, dSumm, weekEntry: wci[`${m.id}:${wk?.id}`] };
    });
  }, [filteredMembers, wci, dci, pto, wIdx, wk, rs]);

  // Daily feed
  const dailyEntries = useMemo(() => {
    return filteredMembers.map(m => ({
      ...m, daily: dci[`${m.id}:${feedDate}`] || null,
      dailyCmt: cmt[`d:${m.id}:${feedDate}`] || null,
      stuckThread: stuckRes[`${m.id}:${feedDate}`] || null,
      isPto: !!pto[`${m.id}:${feedDate}`],
    })).sort((a, b) => {
      const aS = a.daily?.stuck && !(a.stuckThread?.some(t => t.from === "ceo")); const bS = b.daily?.stuck && !(b.stuckThread?.some(t => t.from === "ceo"));
      if (aS && !bS) return -1; if (!aS && bS) return 1; if (a.daily && !b.daily) return -1; if (!a.daily && b.daily) return 1; if (a.isPto && !b.isPto) return 1; if (!a.isPto && b.isPto) return -1; return 0;
    });
  }, [dci, cmt, stuckRes, pto, feedDate, filteredMembers]);

  const stuckCount = dailyEntries.filter(e => e.daily?.stuck && !(e.stuckThread?.some(t => t.from === "ceo"))).length;
  const submittedCount = dailyEntries.filter(e => e.daily).length;

  const nudge = m => { navigator.clipboard?.writeText(`Hey ${m.name.split(" ")[0]}, daily update is due — what worked (numbers), what didn't, tomorrow's plan.`); setCopied(m.id); setTimeout(() => setCopied(null), 2000); };

  const saveDailyCmt = async (uid, date, text) => {
    await save({ cmt: { ...cmt, [`d:${uid}:${date}`]: { text, at: new Date().toISOString() } } });
  };
  const addStuckReply = async (uid, date, text) => {
    const key = `${uid}:${date}`;
    const thread = [...(stuckRes[key] || []), { text, from: "ceo", at: new Date().toISOString() }];
    await save({ sr: { ...stuckRes, [key]: thread } });
  };
  const saveWeeklyCmt = async (uid, text) => {
    await save({ cmt: { ...cmt, [`${uid}:${wk.id}`]: { text, at: new Date().toISOString() } } });
  };

  // Drilldown
  const drillWeekIdx = useMemo(() => {
    if (view === "daily") {
      const fd = new Date(feedDate + "T12:00:00");
      for (let i = WEEKS.length - 1; i >= 0; i--) { if (fd >= WEEKS[i].mon) return i; }
      return 0;
    }
    return wIdx;
  }, [view, feedDate, wIdx]);
  const drillWk = WEEKS[drillWeekIdx];

  const drillData = useMemo(() => {
    if (!drillPerson) return null;
    const m = allMembers.find(x => x.id === drillPerson);
    if (!m) return null;
    const days = weekdaysInWeek(drillWeekIdx);
    const dailies = days.map(d => ({ date: d, entry: dci[`${m.id}:${d}`] || null, cmt: cmt[`d:${m.id}:${d}`] || null }));
    const weeklyEntry = wci[`${m.id}:${drillWk?.id}`];
    return { m, dailies, weeklyEntry, weekStatus: rs(m.id, drillWeekIdx, m) };
  }, [drillPerson, drillWeekIdx, dci, cmt, wci, allMembers]);

  const vs = Math.max(0, CW - 11), vw = WEEKS.slice(vs, CW + 1);

  // ─── Admin panel ───
  if (showAdmin) {
    return <AdminPanel
      cfg={cfg} saveCfg={saveCfg} compId={compId} comp={comp}
      onClose={() => setShowAdmin(false)}
    />;
  }

  // ─── View as member ───
  if (viewAsMember) {
    return (
      <div style={{ fontFamily: S.font }}>
        <div style={{ background: "#111", color: "#fff", padding: "8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, background: "rgba(255,255,255,0.15)", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>PREVIEW</span>
            <span>Viewing as <b>{viewAsMember.name}</b></span>
          </div>
          <button onClick={() => setViewAsMember(null)} style={{ background: "#fff", color: "#111", border: "none", padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Exit preview</button>
        </div>
        <MemberDash
          uid={viewAsMember.id} m={viewAsMember} getTeam={getTeam}
          wci={wci} dci={dci} cmt={cmt} kpiP={kpiP} stuckRes={stuckRes} seen={seen} pto={pto}
          save={save} logout={() => setViewAsMember(null)} cfg={cfg} saveCfg={saveCfg} compId={compId}
          hash={hash} navigate={navigate}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: S.font, background: S.bg, color: S.textPrimary }}>

      {/* Sidebar */}
      <div style={{ width: 200, background: "#fff", borderRight: "1px solid #e5e7eb", padding: "20px 0", flexShrink: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "0 20px", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{"\u25ce"}</span><span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>Checkin</span>
        </div>

        {/* Company switcher */}
        {Object.keys(allCompanies).length > 1 && (
          <div style={{ padding: "0 12px", marginBottom: 12 }}>
            <select value={compId} onChange={e => switchCompany(e.target.value)} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #e5e7eb", fontSize: 12, fontFamily: "inherit", background: "#f9fafb", cursor: "pointer" }}>
              {Object.entries(allCompanies).map(([id, c]) => <option key={id} value={id}>{c.name}</option>)}
            </select>
          </div>
        )}
        {Object.keys(allCompanies).length === 1 && (
          <div style={{ padding: "0 20px", marginBottom: 12, fontSize: 12, color: "#9ca3af" }}>{comp.name}</div>
        )}

        <SideLabel>View</SideLabel>
        {[["daily", "\ud83d\udccb Daily Feed"], ["weekly", "\u25ce Weekly KPIs"], ["heatmap", "\u25a6 Heatmap"]].map(([id, l]) => (<SideBtn key={id} active={view === id} onClick={() => navigate(id)}>{l}</SideBtn>))}

        {Object.keys(TEAMS).length > 0 && <>
          <SideLabel>Teams</SideLabel>
          {[{ id: null, l: "All teams" }, ...Object.entries(TEAMS).map(([k, t]) => ({ id: k, l: t.name }))].map(x => (<SideBtn key={x.l} active={filter === x.id} onClick={() => setFilter(x.id)}>{"\u25ce"} {x.l}</SideBtn>))}
        </>}

        <div style={{ flex: 1 }} />
        {stuckCount > 0 && view !== "daily" && <div style={{ padding: "10px 20px", borderTop: "1px solid #f3f4f6", fontSize: 12, color: "#dc2626", fontWeight: 600, cursor: "pointer" }} onClick={() => navigate("daily")}>{"\ud83d\udea8"} {stuckCount} stuck</div>}
        <div style={{ padding: "6px 12px", borderTop: "1px solid #f3f4f6" }}>
          <button onClick={() => setShowAdmin(true)} style={{ width: "100%", padding: "7px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: "#6b7280", marginBottom: 4 }}>{"\u2699"} Manage</button>
          <div style={{ position: "relative", marginBottom: 4 }}>
            <button onClick={() => setViewAsOpen(!viewAsOpen)} style={{ width: "100%", padding: "7px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: "#6b7280" }}>{"\ud83d\udc41"} View as…</button>
            {viewAsOpen && (
              <div style={{ position: "absolute", bottom: "100%", left: 0, right: 0, marginBottom: 4, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", maxHeight: 240, overflowY: "auto", zIndex: 100 }}>
                <div style={{ padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "#9ca3af", borderBottom: "1px solid #f3f4f6" }}>Select team member</div>
                {Object.entries(TEAMS).map(([tid, team]) => (
                  <div key={tid}>
                    <div style={{ padding: "6px 12px", fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 }}>{team.name}</div>
                    {team.members.map(m => (
                      <button key={m.id} onClick={() => { setViewAsMember(m); setViewAsOpen(false); }}
                        style={{ width: "100%", padding: "8px 12px", border: "none", background: "none", textAlign: "left", cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: "#374151", display: "flex", alignItems: "center", gap: 8 }}
                        onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"} onMouseLeave={e => e.currentTarget.style.background = "none"}>
                        <Av i={m.av} s={22} /><div><div style={{ fontWeight: 500 }}>{m.name}</div><div style={{ fontSize: 10, color: "#9ca3af" }}>{m.role}</div></div>
                      </button>
                    ))}
                  </div>
                ))}
                {allMembers.length === 0 && <div style={{ padding: "12px", fontSize: 12, color: "#9ca3af", textAlign: "center" }}>No members yet</div>}
              </div>
            )}
          </div>
          <button onClick={logout} style={{ width: "100%", padding: "7px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: "#6b7280" }}>Sign out</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: "20px 28px", overflow: "auto" }}>

        {/* Empty state: no members yet */}
        {!hasMembers && !showAdmin && (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>{"\ud83d\udc65"}</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No team members yet</div>
            <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>Add teams and members to start tracking accountability.</div>
            <button onClick={() => setShowAdmin(true)} style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: "#111", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {"\u2699"} Set up teams
            </button>
          </div>
        )}

        {hasMembers && <>
          {/* Drilldown */}
          {drillPerson && drillData ? (
            <div>
              <button onClick={() => setDrillPerson(null)} style={{ background: "none", border: "none", fontSize: 13, color: "#6b7280", cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}>{"\u2190"} Back</button>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <Av i={drillData.m.av} s={40} />
                <div><div style={{ fontSize: 18, fontWeight: 700 }}>{drillData.m.name}</div><div style={{ fontSize: 13, color: "#6b7280" }}>{drillData.m.role}</div></div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Week of {drillWk.label} — daily breakdown</div>
                {drillData.dailies.map(d => (
                  <div key={d.date} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: d.entry ? 8 : 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{dayLabel(d.date)}</span>
                        {d.entry?.edited && <EditedBadge />}
                        {d.entry?.stuck && <StuckBadge />}
                      </div>
                      <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {d.entry && isLate(d.date, d.entry.at, getTz(drillData.m, comp)) && <LateBadge />}
                        <span style={{ fontSize: 11, color: d.entry ? (isLate(d.date, d.entry.at, getTz(drillData.m, comp)) ? "#b45309" : "#10b981") : "#d1d5db" }}>{d.entry ? fmtSubmission(d.date, d.entry.at, getTz(drillData.m, comp)) : "\u2014"}</span>
                      </span>
                    </div>
                    {d.entry ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div><div style={{ fontSize: 11, fontWeight: 600, color: "#10b981", marginBottom: 2 }}>WORKED</div><div style={{ fontSize: 13, color: "#374151", whiteSpace: "pre-line", overflowWrap: "break-word", wordBreak: "break-word" }}>{d.entry.worked}</div></div>
                        {d.entry.didnt && <div><div style={{ fontSize: 11, fontWeight: 600, color: "#ef4444", marginBottom: 2 }}>DIDN'T WORK {"\u2192"} CHANGING</div><div style={{ fontSize: 13, color: "#374151", whiteSpace: "pre-line", overflowWrap: "break-word", wordBreak: "break-word" }}>{d.entry.didnt}</div></div>}
                        {d.entry.plan && <div><div style={{ fontSize: 11, fontWeight: 600, color: "#6366f1", marginBottom: 2 }}>PLAN</div><div style={{ fontSize: 13, color: "#374151", whiteSpace: "pre-line", overflowWrap: "break-word", wordBreak: "break-word" }}>{d.entry.plan}</div></div>}
                        {d.cmt && <div style={{ fontSize: 12, color: "#6366f1", marginTop: 4 }}>{"\ud83d\udcac"} {d.cmt.text}</div>}
                        {d.entry && !d.cmt && <DrillCmtInput onSave={(txt) => saveDailyCmt(drillData.m.id, d.date, txt)} />}
                      </div>
                    ) : <div style={{ fontSize: 13, color: "#d1d5db", fontStyle: "italic" }}>No update</div>}
                  </div>
                ))}
              </div>
              {drillData.weeklyEntry?.kpis && <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "14px 16px", marginTop: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Weekly KPIs</div>
                {drillData.m.kpis.map((kpi, ki) => { const k = drillData.weeklyEntry.kpis[ki]; return <div key={ki} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: ki < drillData.m.kpis.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <span style={{ fontSize: 13 }}>{kpi}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{k?.actual && <span style={{ fontSize: 12, color: "#6b7280" }}>{k.actual}</span>}<span style={{ width: 14, height: 14, borderRadius: "50%", background: k?.status === "green" ? "#10b981" : "#ef4444", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 700 }}>{k?.status === "green" ? "\u2713" : "\u2717"}</span></div>
                </div>; })}
                {drillData.weeklyEntry.challenge && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8, fontStyle: "italic" }}>{drillData.weeklyEntry.challenge}</div>}
                <div style={{ marginTop: 8 }}>
                  <InlineCmt existingText={cmt[`${drillData.m.id}:${drillWk.id}`]?.text} onSave={(txt) => saveWeeklyCmt(drillData.m.id, txt)} />
                </div>
              </div>}
              {/* Past weeks feedback history */}
              {(() => {
                const pw = [];
                for (let i = drillWeekIdx - 1; i >= Math.max(0, drillWeekIdx - 4); i--) {
                  const pe = wci[`${drillData.m.id}:${WEEKS[i]?.id}`];
                  const pc = cmt[`${drillData.m.id}:${WEEKS[i]?.id}`];
                  if (pe?.kpis || pc) pw.push({ wi: i, entry: pe, comment: pc });
                }
                if (pw.length === 0) return null;
                return (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", marginBottom: 6 }}>Previous weeks</div>
                    {pw.map(({ wi: pwi, entry: pe, comment: pc }) => (
                      <div key={pwi} style={{ background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb", padding: "10px 14px", marginBottom: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: pe?.kpis ? 6 : 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{WEEKS[pwi].range}</span>
                          <span style={{ fontSize: 11, color: resolveWeek(drillData.m.id, pwi, wci, drillData.m) === "green" ? "#10b981" : "#ef4444", fontWeight: 600 }}>{resolveWeek(drillData.m.id, pwi, wci, drillData.m) === "green" ? "\u2713 Green" : "\u2717 Red"}</span>
                        </div>
                        {pe?.kpis && drillData.m.kpis.map((kpi, ki) => { const k = pe.kpis[ki]; return k ? <div key={ki} style={{ fontSize: 11, color: "#6b7280", display: "flex", justifyContent: "space-between", padding: "2px 0" }}><span>{kpi}</span>{k.actual && <span>{k.actual}</span>}</div> : null; })}
                        {pc && <div style={{ fontSize: 11, color: "#6366f1", marginTop: 4 }}>{"\ud83d\udcac"} {pc.text}</div>}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          ) : (
            <>
              {/* ═══ DAILY ═══ */}
              {view === "daily" && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>Daily Feed</h1>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>{submittedCount}/{filteredMembers.length} submitted</div>
                  </div>
                  <div style={{ display: "flex", gap: 4, marginBottom: 16, marginTop: 8 }}>
                    {browDays.map(d => {
                      const sel = d === feedDate; const ct = filteredMembers.filter(m => dci[`${m.id}:${d}`]).length;
                      return <button key={d} onClick={() => setFeedDate(d)} style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: "1.5px solid", borderColor: sel ? "#111" : "#e5e7eb", background: sel ? "#111" : "#fff", color: sel ? "#fff" : "#6b7280", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
                        <div>{dayLabel(d).split(" ")[0]}</div>
                        <div style={{ fontSize: 10, opacity: 0.7 }}>{ct}/{filteredMembers.length}</div>
                      </button>;
                    })}
                  </div>

                  {stuckCount > 0 && (
                    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", marginBottom: 10 }}>{"\ud83d\udea8"} Needs your attention</div>
                      {dailyEntries.filter(e => e.daily?.stuck && !(e.stuckThread?.some(t => t.from === "ceo"))).map(e => (
                        <StuckCeoItem key={e.id} entry={e} date={feedDate} onReply={addStuckReply} />
                      ))}
                    </div>
                  )}

                  {submittedCount === 0 && (
                    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "32px 20px", textAlign: "center", marginBottom: 16 }}>
                      <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>{"\ud83d\udccb"}</div>
                      <div style={{ fontSize: 14, color: "#6b7280", fontWeight: 500 }}>No updates yet for {dayLabel(feedDate)}</div>
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {dailyEntries.map(e => (
                      <DailyCardCeo key={e.id} entry={e} date={feedDate} tz={getTz(e, comp)} onDrill={() => setDrillPerson(e.id)} saveCmt={saveDailyCmt} nudge={nudge} copied={copied} />
                    ))}
                  </div>
                </>
              )}

              {/* ═══ WEEKLY ═══ */}
              {view === "weekly" && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>{wk.range}</h1>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setWIdx(Math.max(0, wIdx - 1))} disabled={wIdx === 0} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: wIdx > 0 ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#6b7280" }}>{"\u2190"}</button>
                      <button onClick={() => setWIdx(Math.min(CW, wIdx + 1))} disabled={wIdx === CW} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: wIdx < CW ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#6b7280" }}>{"\u2192"}</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16 }}>{isLocked(wIdx) ? "Locked" : isOverdue(wIdx) ? "Grace period" : timeLeft(wIdx) ? `${timeLeft(wIdx)} left` : "Current week"}</div>

                  <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 60px 100px", padding: "10px 16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      <div>Person</div><div style={{ textAlign: "center" }}>KPI Status</div><div style={{ textAlign: "center" }}>Dailies</div><div style={{ textAlign: "right" }}>Action</div>
                    </div>
                    {weeklyTableData.map(m => (
                      <div key={m.id} style={{ display: "grid", gridTemplateColumns: "1fr 100px 60px 100px", padding: "12px 16px", borderBottom: "1px solid #f3f4f6", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setDrillPerson(m.id)}>
                          <Av i={m.av} s={26} />
                          <div><div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div><div style={{ fontSize: 11, color: "#9ca3af" }}>{m.role}</div></div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          {m.weekEntry?.kpis ? (
                            <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                              {m.weekEntry.kpis.map((k, ki) => <span key={ki} style={{ width: 16, height: 16, borderRadius: k.status === "green" ? "50%" : 3, background: k.status === "green" ? "#10b981" : "#ef4444", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 800 }}>{k.status === "green" ? "\u2713" : "\u2717"}</span>)}
                            </div>
                          ) : <span style={{ fontSize: 11, color: isLocked(wIdx) ? "#ef4444" : "#d1d5db" }}>{isLocked(wIdx) ? "Auto-red" : "Pending"}</span>}
                        </div>
                        <div style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: m.dSumm.count >= m.dSumm.expected ? "#10b981" : m.dSumm.count >= Math.ceil(m.dSumm.expected / 2) ? "#f59e0b" : "#ef4444" }}>{m.dSumm.count}/{m.dSumm.expected}</div>
                        <div style={{ textAlign: "right" }}>
                          <InlineCmt existingText={cmt[`${m.id}:${wk.id}`]?.text} onSave={(txt) => saveWeeklyCmt(m.id, txt)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ═══ HEATMAP ═══ */}
              {view === "heatmap" && (
                <>
                  <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 16px", letterSpacing: -0.3 }}>Heatmap</h1>
                  <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 20, overflow: "auto" }}>
                    <div style={{ display: "grid", gridTemplateColumns: `140px repeat(${vw.length},1fr)`, gap: 3, alignItems: "center" }}>
                      <div />
                      {vw.map((w, i) => <div key={w.id} title={w.range} style={{ fontSize: 10, color: vs + i === wIdx ? "#111" : "#9ca3af", fontWeight: vs + i === wIdx ? 700 : 400, textAlign: "center" }}>{w.label}</div>)}
                      {filteredMembers.map(m => (
                        <React.Fragment key={m.id}>
                          <div style={{ fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }} onClick={() => setDrillPerson(m.id)}><Av i={m.av} s={20} />{m.name.split(" ")[0]}</div>
                          {vw.map((w, vi) => { const s = rs(m.id, vs + vi, m); return <div key={w.id} title={`${w.range} — ${s === "green" ? "Hit" : s === "pre-enrollment" ? "Not enrolled" : s ? "Missed" : "Pending"}`} style={{ height: 28, borderRadius: s === "green" ? 14 : 4, display: "flex", alignItems: "center", justifyContent: "center", background: s === "green" ? "#d1fae5" : s === "pre-enrollment" ? "#f9fafb" : s === "red" || s === "auto-red" ? "#fee2e2" : "#f3f4f6", border: vs + vi === wIdx ? "2px solid #111" : s === "green" ? "1.5px solid #10b981" : s === "pre-enrollment" ? "1px solid transparent" : s ? "1.5px solid #ef4444" : "1px solid transparent" }}>{s === "green" ? <span style={{ fontSize: 12, color: "#065f46", fontWeight: 800 }}>{"\u2713"}</span> : s === "pre-enrollment" ? <span style={{ fontSize: 11, color: "#d1d5db" }}>{"\u2014"}</span> : s ? <span style={{ fontSize: 12, color: "#991b1b", fontWeight: 800 }}>{"\u2717"}</span> : <span style={{ fontSize: 11, color: "#d1d5db" }}>{"\u00b7"}</span>}</div>; })}
                          <div style={{ fontSize: 9, color: "#9ca3af", textAlign: "right" }}>daily</div>
                          {vw.map((w, vi) => { const days = weekdaysInWeek(vs + vi); const ptoCt = days.filter(d => pto[`${m.id}:${d}`]).length; const ct = days.filter(d => dci[`${m.id}:${d}`]).length; const tot = days.length - ptoCt; const pct = tot ? ct / tot : 0; return <div key={w.id + "d"} style={{ height: 16, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", background: pct >= 0.8 ? "#dbeafe" : pct >= 0.4 ? "#fef3c7" : "#f3f4f6" }}><span style={{ fontSize: 9, color: pct >= 0.8 ? "#1e40af" : pct >= 0.4 ? "#92400e" : "#d1d5db", fontWeight: 500 }}>{ct}/{tot}</span></div>; })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ADMIN PANEL — Manage teams, members, companies
// ═══════════════════════════════════════════════════════════
function AdminPanel({ cfg, saveCfg, compId, comp, onClose }) {
  const [tab, setTab] = useState("teams");
  const [newTeamName, setNewTeamName] = useState("");
  const [addingMemberTo, setAddingMemberTo] = useState(null); // teamId
  const [newMember, setNewMember] = useState({ name: "", email: "", role: "", pw: "" });
  const [kpiLines, setKpiLines] = useState([""]);
  const [newCompName, setNewCompName] = useState("");
  const [copiedCreds, setCopiedCreds] = useState(null);
  const [editingKpis, setEditingKpis] = useState(null);
  const [editKpiLines, setEditKpiLines] = useState([""]);

  // Reminders tab state
  const [reminderCfg, setReminderCfg] = useState({ enabled: false, dailyEnabled: true, weeklyEnabled: true, pausedMembers: {} });
  const [reminderLog, setReminderLog] = useState([]);
  const [logLoaded, setLogLoaded] = useState(false);
  const [logTypeFilter, setLogTypeFilter] = useState("all"); // "all" | "daily" | "weekly"
  const [logStatusFilter, setLogStatusFilter] = useState("all"); // "all" | "sent" | "failed"
  const [logLimit, setLogLimit] = useState(50);

  const reminderCfgKey = `acct-v9-reminder-cfg-${compId}`;
  const reminderLogKey = `acct-v9-reminder-log-${compId}`;

  useEffect(() => {
    if (tab !== "reminders") return;
    let cancelled = false;
    (async () => {
      try {
        const r = await window.storage.get(reminderCfgKey);
        if (!cancelled && r?.value) setReminderCfg(JSON.parse(r.value));
      } catch {}
      try {
        const r = await window.storage.get(reminderLogKey);
        if (!cancelled && r?.value) setReminderLog(JSON.parse(r.value));
      } catch {}
      if (!cancelled) setLogLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [tab, reminderCfgKey, reminderLogKey]);

  const saveReminderCfg = async (newCfg) => {
    setReminderCfg(newCfg);
    await window.storage.set(reminderCfgKey, JSON.stringify(newCfg));
  };

  const addTeam = async () => {
    if (!newTeamName.trim()) return;
    const tid = genId();
    const newCfg = { ...cfg, companies: { ...cfg.companies, [compId]: { ...comp, teams: { ...comp.teams, [tid]: { name: newTeamName.trim(), members: [] } } } } };
    await saveCfg(newCfg);
    setNewTeamName("");
  };

  const removeTeam = async (tid) => {
    const teams = { ...comp.teams };
    // Remove member user entries
    const newUsers = { ...cfg.users };
    (teams[tid]?.members || []).forEach(m => {
      const email = Object.entries(newUsers).find(([, v]) => v.memberId === m.id)?.[0];
      if (email) delete newUsers[email];
    });
    delete teams[tid];
    const newCfg = { ...cfg, users: newUsers, companies: { ...cfg.companies, [compId]: { ...comp, teams } } };
    await saveCfg(newCfg);
  };

  const addMember = async (teamId) => {
    if (!newMember.name.trim() || !newMember.email.trim()) return;
    const email = newMember.email.trim().toLowerCase();
    if (cfg.users[email] || email === cfg.ceoEmail) { alert("Email already in use."); return; }
    const mid = genId();
    
    const kpis = kpiLines.map(s => s.trim()).filter(Boolean);
    const av = newMember.name.trim().split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    const rawPw = newMember.pw || "change-me";
    const member = { id: mid, name: newMember.name.trim(), email, pw: await hashPw(rawPw), role: newMember.role.trim() || "Team member", av, kpis, addedAt: new Date().toISOString() };
    const team = comp.teams[teamId];
    const newTeam = { ...team, members: [...team.members, member] };
    const newCfg = {
      ...cfg,
      users: { ...cfg.users, [email]: { compId, memberId: mid } },
      companies: { ...cfg.companies, [compId]: { ...comp, teams: { ...comp.teams, [teamId]: newTeam } } },
    };
    await saveCfg(newCfg);
    navigator.clipboard?.writeText(`Checkin Login\nEmail: ${email}\nPassword: ${rawPw}\n\nSign in and submit your daily updates.`);
    setCopiedCreds(mid); setTimeout(() => setCopiedCreds(null), 3000);
    setNewMember({ name: "", email: "", role: "", pw: "" });
    setKpiLines([""]);
    setAddingMemberTo(null);
  };

  const removeMember = async (teamId, memberId) => {
    const team = comp.teams[teamId];
    const member = team.members.find(m => m.id === memberId);
    const newMembers = team.members.filter(m => m.id !== memberId);
    const newUsers = { ...cfg.users };
    if (member?.email) delete newUsers[member.email];
    const newCfg = {
      ...cfg, users: newUsers,
      companies: { ...cfg.companies, [compId]: { ...comp, teams: { ...comp.teams, [teamId]: { ...team, members: newMembers } } } },
    };
    await saveCfg(newCfg);
  };

  const resetPassword = async (teamId, member) => {
    const newPw = Math.random().toString(36).slice(2, 10);
    const hashedPw = await hashPw(newPw);
    const team = comp.teams[teamId];
    const newTeam = { ...team, members: team.members.map(m => m.id === member.id ? { ...m, pw: hashedPw } : m) };
    const newCfg = { ...cfg, companies: { ...cfg.companies, [compId]: { ...comp, teams: { ...comp.teams, [teamId]: newTeam } } } };
    await saveCfg(newCfg);
    navigator.clipboard?.writeText(`Checkin Login\nEmail: ${member.email}\nPassword: ${newPw}\n\nSign in and submit your daily updates.`);
    setCopiedCreds(member.id);
    setTimeout(() => setCopiedCreds(null), 2000);
  };

  const saveKpis = async (teamId, memberId) => {
    const kpis = editKpiLines.map(s => s.trim()).filter(Boolean);
    const team = comp.teams[teamId];
    const newTeam = { ...team, members: team.members.map(m => m.id === memberId ? { ...m, kpis } : m) };
    const newCfg = { ...cfg, companies: { ...cfg.companies, [compId]: { ...comp, teams: { ...comp.teams, [teamId]: newTeam } } } };
    await saveCfg(newCfg);
    setEditingKpis(null);
  };

  const addCompany = async () => {
    if (!newCompName.trim()) return;
    const cid = genId();
    const newCfg = { ...cfg, companies: { ...cfg.companies, [cid]: { name: newCompName.trim(), teams: {} } } };
    await saveCfg(newCfg);
    setNewCompName("");
  };

  return (
    <div style={{ minHeight: "100vh", fontFamily: S.font, background: S.bg }}>
      <div style={{ background: S.bgWhite, borderBottom: `1px solid ${S.border}`, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 14, color: S.textMuted, cursor: "pointer", fontFamily: "inherit" }}>{"\u2190"} Back</button>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{"\u2699"} Manage — {comp.name}</span>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 20px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, marginBottom: 24, background: "#e5e7eb", borderRadius: 10, padding: 3 }}>
          {[["teams", "Teams & Members"], ["companies", "Companies"], ["reminders", "Reminders"]].map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", background: tab === id ? "#fff" : "transparent", color: tab === id ? "#111" : "#6b7280", fontSize: 14, fontWeight: tab === id ? 600 : 400, boxShadow: tab === id ? "0 1px 2px rgba(0,0,0,0.06)" : "none" }}>{l}</button>
          ))}
        </div>

        {/* ─── Teams Tab ─── */}
        {tab === "teams" && (
          <>
            {Object.entries(comp.teams).map(([tid, team]) => (
              <div key={tid} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", marginBottom: 16, overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #f3f4f6" }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{team.name}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setAddingMemberTo(addingMemberTo === tid ? null : tid)} style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", color: "#6366f1", cursor: "pointer", fontFamily: "inherit" }}>+ Member</button>
                    <button onClick={() => removeTeam(tid)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid #fecaca", background: "#fff", color: "#ef4444", cursor: "pointer", fontFamily: "inherit" }}>{"\u2717"}</button>
                  </div>
                </div>

                {team.members.map(m => (
                  <React.Fragment key={m.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #f9fafb" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Av i={m.av} s={28} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af" }}>{m.email} · {m.role}</div>
                          {m.kpis?.length > 0 && <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>KPIs: {m.kpis.join(", ")}</div>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => { setEditingKpis(editingKpis === m.id ? null : m.id); setEditKpiLines(m.kpis?.length > 0 ? [...m.kpis] : [""]); }} style={{ fontSize: 11, fontWeight: 500, padding: "4px 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: editingKpis === m.id ? "#eef2ff" : "#fff", color: editingKpis === m.id ? "#6366f1" : "#6b7280", cursor: "pointer", fontFamily: "inherit" }}>
                          Edit KPIs
                        </button>
                        <button onClick={() => resetPassword(tid, m)} style={{ fontSize: 11, fontWeight: 500, padding: "4px 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: copiedCreds === m.id ? "#10b981" : "#fff", color: copiedCreds === m.id ? "#fff" : "#6b7280", cursor: "pointer", fontFamily: "inherit" }}>
                          {copiedCreds === m.id ? "\u2713 Copied" : "Reset pw"}
                        </button>
                        <button onClick={() => removeMember(tid, m.id)} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid #fecaca", background: "#fff", color: "#ef4444", cursor: "pointer", fontFamily: "inherit" }}>{"\u2717"}</button>
                      </div>
                    </div>
                    {editingKpis === m.id && (
                      <div style={{ padding: "12px 16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Edit KPIs for {m.name}</div>
                        {editKpiLines.map((line, ki) => (
                          <div key={ki} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                            <span style={{ fontSize: 12, color: "#9ca3af", minWidth: 18, textAlign: "right" }}>{ki + 1}.</span>
                            <input value={line} onChange={e => { const n = [...editKpiLines]; n[ki] = e.target.value; setEditKpiLines(n); }}
                              onKeyDown={e => { if (e.key === "Enter" && line.trim()) { e.preventDefault(); setEditKpiLines([...editKpiLines, ""]); } }}
                              placeholder="KPI description..."
                              style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                            {editKpiLines.length > 1 && (
                              <button onClick={() => setEditKpiLines(editKpiLines.filter((_, i) => i !== ki))}
                                style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", color: "#9ca3af", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1 }}>{"\u00d7"}</button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => setEditKpiLines([...editKpiLines, ""])}
                          style={{ fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: "4px 0", fontFamily: "inherit" }}>+ Add another KPI</button>
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button onClick={() => setEditingKpis(null)} style={{ flex: 1, padding: "9px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                          <button onClick={() => saveKpis(tid, m.id)} style={{ flex: 2, padding: "9px", borderRadius: 8, border: "none", background: "#111", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save KPIs</button>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                ))}

                {team.members.length === 0 && <div style={{ padding: "16px", textAlign: "center", fontSize: 12, color: "#9ca3af" }}>No members yet</div>}

                {addingMemberTo === tid && (
                  <div style={{ padding: 16, background: "#f9fafb", borderTop: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Add member</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <input value={newMember.name} onChange={e => setNewMember({ ...newMember, name: e.target.value })} placeholder="Full name"
                        style={{ padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                      <input value={newMember.email} onChange={e => setNewMember({ ...newMember, email: e.target.value })} placeholder="Email" type="email"
                        style={{ padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                      <input value={newMember.role} onChange={e => setNewMember({ ...newMember, role: e.target.value })} placeholder="Role (e.g. Account Executive)"
                        style={{ padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                      <input value={newMember.pw} onChange={e => setNewMember({ ...newMember, pw: e.target.value })} placeholder="Initial password (default: change-me)"
                        style={{ padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Weekly KPIs</div>
                        {kpiLines.map((line, ki) => (
                          <div key={ki} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                            <span style={{ fontSize: 12, color: "#9ca3af", minWidth: 18, textAlign: "right" }}>{ki + 1}.</span>
                            <input value={line} onChange={e => { const n = [...kpiLines]; n[ki] = e.target.value; setKpiLines(n); }}
                              onKeyDown={e => { if (e.key === "Enter" && line.trim()) { e.preventDefault(); setKpiLines([...kpiLines, ""]); } }}
                              placeholder={ki === 0 ? "e.g. Close $45K in new ARR" : ki === 1 ? "e.g. Run 3 pipeline reviews" : "Add KPI…"}
                              style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                            {kpiLines.length > 1 && (
                              <button onClick={() => setKpiLines(kpiLines.filter((_, i) => i !== ki))}
                                style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", color: "#9ca3af", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1 }}>×</button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => setKpiLines([...kpiLines, ""])}
                          style={{ fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: "4px 0", fontFamily: "inherit" }}>+ Add another KPI</button>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setAddingMemberTo(null)} style={{ flex: 1, padding: "9px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                        <button onClick={() => addMember(tid)} disabled={!newMember.name.trim() || !newMember.email.trim()} style={{ flex: 2, padding: "9px", borderRadius: 8, border: "none", background: newMember.name.trim() && newMember.email.trim() ? "#111" : "#e5e7eb", color: newMember.name.trim() && newMember.email.trim() ? "#fff" : "#9ca3af", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                          Add member
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add team */}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="New team name"
                style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none" }}
                onKeyDown={e => e.key === "Enter" && addTeam()} />
              <button onClick={addTeam} disabled={!newTeamName.trim()} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: newTeamName.trim() ? "#111" : "#e5e7eb", color: newTeamName.trim() ? "#fff" : "#9ca3af", fontSize: 13, fontWeight: 600, cursor: newTeamName.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
                + Add team
              </button>
            </div>
          </>
        )}

        {/* ─── Companies Tab ─── */}
        {tab === "companies" && (
          <>
            {Object.entries(cfg.companies).map(([cid, c]) => {
              const memberCount = Object.values(c.teams).reduce((acc, t) => acc + t.members.length, 0);
              return (
                <div key={cid} style={{ background: "#fff", borderRadius: 12, border: "1px solid", borderColor: cid === compId ? "#6366f1" : "#e5e7eb", padding: "14px 16px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{c.name} {cid === compId && <span style={{ fontSize: 11, color: "#6366f1", fontWeight: 500 }}>(current)</span>}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>{Object.keys(c.teams).length} teams · {memberCount} members</div>
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input value={newCompName} onChange={e => setNewCompName(e.target.value)} placeholder="New company name"
                style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none" }}
                onKeyDown={e => e.key === "Enter" && addCompany()} />
              <button onClick={addCompany} disabled={!newCompName.trim()} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: newCompName.trim() ? "#111" : "#e5e7eb", color: newCompName.trim() ? "#fff" : "#9ca3af", fontSize: 13, fontWeight: 600, cursor: newCompName.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
                + Add company
              </button>
            </div>

            <div style={{ marginTop: 24, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Company timezone</div>
              <select value={comp.tz || BROWSER_TZ} onChange={async (e) => {
                await saveCfg({ ...cfg, companies: { ...cfg.companies, [compId]: { ...comp, tz: e.target.value } } });
              }} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                {getTzList().map(tz => <option key={tz} value={tz}>{tzLabel(tz)}</option>)}
              </select>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>Default timezone for all members. Members can override in their own settings.</div>
            </div>

            <div style={{ marginTop: 24, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Your CEO credentials</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Email: <span style={{ color: "#111", fontWeight: 500 }}>{cfg.ceoEmail}</span></div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>Password: <span style={{ color: "#111", fontWeight: 500 }}>••••••</span></div>
              <CeoPasswordChange cfg={cfg} saveCfg={saveCfg} />
            </div>
          </>
        )}

        {/* ─── Reminders Tab ─── */}
        {tab === "reminders" && (
          <>
            {/* Section 1: Global Controls */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Auto-Reminders</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 16 }}>Automatically email team members who miss their daily checkin or weekly KPI submission.</div>

              {/* Master toggle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Auto-Reminders</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>Master switch for all email reminders</div>
                </div>
                <button onClick={() => saveReminderCfg({ ...reminderCfg, enabled: !reminderCfg.enabled })}
                  style={{ width: 44, height: 24, borderRadius: 12, border: "none", background: reminderCfg.enabled ? "#6366f1" : "#d1d5db", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                  <span style={{ position: "absolute", top: 3, left: reminderCfg.enabled ? 23 : 3, width: 18, height: 18, borderRadius: 9, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.15)", transition: "left 0.2s" }} />
                </button>
              </div>

              {/* Daily toggle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f3f4f6", opacity: reminderCfg.enabled ? 1 : 0.4 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Daily reminders</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>Sent at 6 PM member local time</div>
                </div>
                <button onClick={() => { if (reminderCfg.enabled) saveReminderCfg({ ...reminderCfg, dailyEnabled: !reminderCfg.dailyEnabled }); }}
                  style={{ width: 44, height: 24, borderRadius: 12, border: "none", background: reminderCfg.dailyEnabled ? "#6366f1" : "#d1d5db", cursor: reminderCfg.enabled ? "pointer" : "default", position: "relative", transition: "background 0.2s" }}>
                  <span style={{ position: "absolute", top: 3, left: reminderCfg.dailyEnabled ? 23 : 3, width: 18, height: 18, borderRadius: 9, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.15)", transition: "left 0.2s" }} />
                </button>
              </div>

              {/* Weekly toggle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", opacity: reminderCfg.enabled ? 1 : 0.4 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Weekly reminders</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>Sent Saturday 10 AM member local time</div>
                </div>
                <button onClick={() => { if (reminderCfg.enabled) saveReminderCfg({ ...reminderCfg, weeklyEnabled: !reminderCfg.weeklyEnabled }); }}
                  style={{ width: 44, height: 24, borderRadius: 12, border: "none", background: reminderCfg.weeklyEnabled ? "#6366f1" : "#d1d5db", cursor: reminderCfg.enabled ? "pointer" : "default", position: "relative", transition: "background 0.2s" }}>
                  <span style={{ position: "absolute", top: 3, left: reminderCfg.weeklyEnabled ? 23 : 3, width: 18, height: 18, borderRadius: 9, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.15)", transition: "left 0.2s" }} />
                </button>
              </div>
            </div>

            {/* Section 2: Per-Member Pause List */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", marginBottom: 16, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Per-Member Controls</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Pause reminders for individual team members.</div>
              </div>
              {Object.entries(comp.teams).map(([tid, team]) => (
                <div key={tid}>
                  <div style={{ padding: "8px 16px", fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>{team.name}</div>
                  {team.members.map(m => {
                    const isPaused = !!reminderCfg.pausedMembers?.[m.id];
                    return (
                      <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #f9fafb" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Av i={m.av} s={28} />
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                              {isPaused && <span style={{ fontSize: 10, fontWeight: 600, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", padding: "1px 6px", borderRadius: 4 }}>PAUSED</span>}
                            </div>
                            <div style={{ fontSize: 11, color: "#9ca3af" }}>{m.email}</div>
                          </div>
                        </div>
                        <button onClick={async () => {
                          const next = { ...reminderCfg, pausedMembers: { ...reminderCfg.pausedMembers } };
                          if (isPaused) { delete next.pausedMembers[m.id]; }
                          else { next.pausedMembers[m.id] = { pausedAt: new Date().toISOString() }; }
                          await saveReminderCfg(next);
                        }}
                          style={{ fontSize: 11, fontWeight: 600, padding: "5px 14px", borderRadius: 6, border: "1px solid", borderColor: isPaused ? "#6366f1" : "#fde68a", background: isPaused ? "#eef2ff" : "#fffbeb", color: isPaused ? "#6366f1" : "#b45309", cursor: "pointer", fontFamily: "inherit" }}>
                          {isPaused ? "Resume" : "Pause"}
                        </button>
                      </div>
                    );
                  })}
                  {team.members.length === 0 && <div style={{ padding: "12px 16px", fontSize: 12, color: "#9ca3af" }}>No members</div>}
                </div>
              ))}
              {Object.keys(comp.teams).length === 0 && <div style={{ padding: "16px", textAlign: "center", fontSize: 12, color: "#9ca3af" }}>No teams yet</div>}
            </div>

            {/* Section 3: Email Log */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Email Log</div>
              </div>

              {/* Filters */}
              <div style={{ padding: "10px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {[["all", "All"], ["daily", "Daily"], ["weekly", "Weekly"]].map(([v, l]) => (
                    <button key={v} onClick={() => { setLogTypeFilter(v); setLogLimit(50); }}
                      style={{ fontSize: 11, fontWeight: logTypeFilter === v ? 600 : 400, padding: "4px 10px", borderRadius: 6, border: "1px solid", borderColor: logTypeFilter === v ? "#6366f1" : "#e5e7eb", background: logTypeFilter === v ? "#eef2ff" : "#fff", color: logTypeFilter === v ? "#6366f1" : "#6b7280", cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[["all", "All"], ["sent", "Sent"], ["failed", "Failed"]].map(([v, l]) => (
                    <button key={v} onClick={() => { setLogStatusFilter(v); setLogLimit(50); }}
                      style={{ fontSize: 11, fontWeight: logStatusFilter === v ? 600 : 400, padding: "4px 10px", borderRadius: 6, border: "1px solid", borderColor: logStatusFilter === v ? "#6366f1" : "#e5e7eb", background: logStatusFilter === v ? "#eef2ff" : "#fff", color: logStatusFilter === v ? "#6366f1" : "#6b7280", cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
                  ))}
                </div>
              </div>

              {/* Log entries */}
              {(() => {
                const filtered = [...reminderLog]
                  .reverse()
                  .filter(e => logTypeFilter === "all" || e.type === logTypeFilter)
                  .filter(e => logStatusFilter === "all" || e.status === logStatusFilter);
                const visible = filtered.slice(0, logLimit);

                if (!logLoaded) return <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 12, color: "#9ca3af" }}>Loading...</div>;

                if (filtered.length === 0) return (
                  <div style={{ padding: "32px 16px", textAlign: "center" }}>
                    <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 4 }}>No reminder emails sent yet.</div>
                    <div style={{ fontSize: 11, color: "#d1d5db" }}>Emails will appear here once reminders are enabled and a team member misses a checkin.</div>
                  </div>
                );

                return (
                  <>
                    {/* Table header */}
                    <div style={{ display: "flex", padding: "8px 16px", fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #f3f4f6", background: "#f9fafb" }}>
                      <div style={{ flex: 2 }}>Sent At</div>
                      <div style={{ flex: 1 }}>Type</div>
                      <div style={{ flex: 2 }}>Employee</div>
                      <div style={{ flex: 1.5 }}>For Date</div>
                      <div style={{ flex: 1, textAlign: "right" }}>Status</div>
                    </div>

                    {visible.map(entry => (
                      <div key={entry.id} style={{ display: "flex", alignItems: "center", padding: "9px 16px", borderBottom: "1px solid #f9fafb", fontSize: 12 }}>
                        <div style={{ flex: 2, color: "#6b7280" }}>
                          {new Date(entry.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                          {new Date(entry.sentAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: entry.type === "daily" ? "#eef2ff" : "#f0fdf4", color: entry.type === "daily" ? "#6366f1" : "#10b981" }}>
                            {entry.type === "daily" ? "Daily" : "Weekly"}
                          </span>
                        </div>
                        <div style={{ flex: 2, fontWeight: 500, color: "#374151" }}>{entry.memberName}</div>
                        <div style={{ flex: 1.5, color: "#6b7280" }}>
                          {new Date(entry.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                        <div style={{ flex: 1, textAlign: "right" }}>
                          {entry.status === "sent" ? (
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#10b981" }}>{"\u2713"} Sent</span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#ef4444", cursor: entry.error ? "help" : "default" }} title={entry.error || ""}>{"\u2717"} Failed</span>
                          )}
                        </div>
                      </div>
                    ))}

                    {filtered.length > logLimit && (
                      <div style={{ padding: "12px 16px", textAlign: "center" }}>
                        <button onClick={() => setLogLimit(logLimit + 50)}
                          style={{ fontSize: 12, fontWeight: 600, padding: "7px 20px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", cursor: "pointer", fontFamily: "inherit" }}>
                          Load more ({filtered.length - logLimit} remaining)
                        </button>
                      </div>
                    )}

                    <div style={{ padding: "8px 16px", fontSize: 10, color: "#d1d5db", textAlign: "right", background: "#f9fafb" }}>
                      {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
                    </div>
                  </>
                );
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── CEO Password Change ──────────────────────────────────
function CeoPasswordChange({ cfg, saveCfg }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [saved, setSaved] = useState(false);
  const change = async () => {
    if (!pw.trim()) return;
    await saveCfg({ ...cfg, ceoPw: await hashPw(pw.trim()) });
    setPw(""); setSaved(true); setTimeout(() => { setSaved(false); setOpen(false); }, 1500);
  };
  if (!open) return <button onClick={() => setOpen(true)} style={{ fontSize: 12, fontWeight: 500, padding: "5px 14px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", cursor: "pointer", fontFamily: "inherit" }}>Change password</button>;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input value={pw} onChange={e => setPw(e.target.value)} type="password" placeholder="New password"
        style={{ flex: 1, padding: "7px 12px", borderRadius: 6, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none" }}
        onKeyDown={e => e.key === "Enter" && change()} />
      <button onClick={change} disabled={!pw.trim()} style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: saved ? "#10b981" : pw.trim() ? "#111" : "#e5e7eb", color: pw.trim() || saved ? "#fff" : "#9ca3af", fontSize: 12, fontWeight: 600, cursor: pw.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
        {saved ? "\u2713 Saved" : "Update"}
      </button>
      <button onClick={() => { setOpen(false); setPw(""); }} style={{ background: "none", border: "none", fontSize: 14, color: "#9ca3af", cursor: "pointer" }}>{"\u00d7"}</button>
    </div>
  );
}

// ─── CEO Daily Card ───────────────────────────────────────
function DailyCardCeo({ entry: e, date, tz, onDrill, saveCmt, nudge, copied }) {
  const [cmtOpen, setCmtOpen] = useState(false);
  const [cmtText, setCmtText] = useState(e.dailyCmt?.text || "");
  const resolved = e.stuckThread?.some(t => t.from === "ceo");

  if (e.isPto) return (
    <div style={{ background: "#fafafe", borderRadius: 12, border: "1px solid #e5e7eb", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: 0.7 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Av i={e.av} s={28} />
        <div><span style={{ fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "underline", textDecorationColor: "#e5e7eb", textUnderlineOffset: 2 }} onClick={onDrill}>{e.name}</span><span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 6 }}>{e.role}</span></div>
      </div>
      <span style={{ fontSize: 11, color: "#6366f1", fontWeight: 500 }}>{"\u2708"} PTO</span>
    </div>
  );

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid", borderColor: e.daily?.stuck && !resolved ? "#fecaca" : "#e5e7eb", padding: "16px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: e.daily ? 12 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Av i={e.av} s={28} />
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "underline", textDecorationColor: "#e5e7eb", textUnderlineOffset: 2 }} onClick={onDrill}>{e.name}</span>
            <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 6 }}>{e.role}</span>
          </div>
        </div>
        {!e.daily ? (
          <button onClick={() => nudge(e)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, opacity: copied === e.id ? 1 : 0.4 }}>
            {copied === e.id ? "\u2713 Copied" : "\ud83d\udd14 Nudge"}
          </button>
        ) : (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {e.daily.edited && <EditedBadge />}
            {isLate(date, e.daily.at, tz) && <LateBadge />}
            {e.daily.stuck && !resolved && <StuckBadge />}
            {e.daily.stuck && resolved && <span style={{ fontSize: 11, color: "#10b981", fontWeight: 500 }}>{"\u2713"} Responded</span>}
            <span style={{ fontSize: 11, color: isLate(date, e.daily.at, tz) ? "#b45309" : "#9ca3af" }}>{fmtSubmission(date, e.daily.at, tz)}</span>
          </div>
        )}
      </div>

      {e.daily ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div><div style={{ fontSize: 11, fontWeight: 600, color: "#10b981", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>What worked</div><div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5, whiteSpace: "pre-line", overflowWrap: "break-word", wordBreak: "break-word" }}>{e.daily.worked}</div></div>
          {e.daily.didnt && <div><div style={{ fontSize: 11, fontWeight: 600, color: "#ef4444", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>Didn't work {"\u2192"} changing</div><div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5, whiteSpace: "pre-line", overflowWrap: "break-word", wordBreak: "break-word" }}>{e.daily.didnt}</div></div>}
          {e.daily.plan && <div><div style={{ fontSize: 11, fontWeight: 600, color: "#6366f1", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>Tomorrow's plan</div><div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5, whiteSpace: "pre-line", overflowWrap: "break-word", wordBreak: "break-word" }}>{e.daily.plan}</div></div>}
          <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 10 }}>
            {cmtOpen ? (
              <div style={{ display: "flex", gap: 8 }}>
                <input value={cmtText} onChange={ev => setCmtText(ev.target.value)} placeholder="Feedback\u2026" autoFocus maxLength={LIMITS.feedback}
                  style={{ flex: 1, padding: "7px 12px", borderRadius: 8, border: `1.5px solid ${S.border}`, fontSize: 13, fontFamily: "inherit", outline: "none" }}
                  onKeyDown={ev => { if (ev.key === "Enter" && cmtText.trim()) { saveCmt(e.id, date, cmtText.trim()); setCmtOpen(false); } }} />
                <button onClick={() => { if (cmtText.trim()) { saveCmt(e.id, date, cmtText.trim()); setCmtOpen(false); } }} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Send</button>
                <button onClick={() => setCmtOpen(false)} style={{ background: "none", border: "none", fontSize: 14, color: "#9ca3af", cursor: "pointer" }}>{"\u00d7"}</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {e.dailyCmt && <span style={{ fontSize: 12, color: "#6366f1" }}>{"\ud83d\udcac"} {e.dailyCmt.text}</span>}
                <button onClick={() => { setCmtText(e.dailyCmt?.text || ""); setCmtOpen(true); }}
                  style={{ background: "none", border: "none", fontSize: 12, color: "#6366f1", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                  {e.dailyCmt ? "\u00b7 Edit" : "\ud83d\udcac Feedback"}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "#d1d5db", fontStyle: "italic", padding: "8px 0" }}>No update yet</div>
      )}
    </div>
  );
}

// ─── Stuck CEO Item ───────────────────────────────────────
function StuckCeoItem({ entry: e, date, onReply }) {
  const [reply, setReply] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <div style={{ padding: "8px 0", borderBottom: "1px solid #fecaca" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Av i={e.av} s={22} /><span style={{ fontSize: 13, fontWeight: 600 }}>{e.name}</span>
      </div>
      {e.daily?.stuck && e.daily?.plan && <div style={{ fontSize: 12, color: "#374151", marginBottom: 6, paddingLeft: 30 }}>{e.daily.plan}</div>}
      {open ? (
        <div style={{ display: "flex", gap: 6, paddingLeft: 30 }}>
          <input value={reply} onChange={ev => setReply(ev.target.value)} placeholder="Reply\u2026" autoFocus maxLength={LIMITS.stuckReply}
            style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${S.border}`, fontSize: 12, fontFamily: "inherit", outline: "none" }}
            onKeyDown={ev => { if (ev.key === "Enter" && reply.trim()) { onReply(e.id, date, reply.trim()); setReply(""); setOpen(false); } }} />
          <button onClick={() => { if (reply.trim()) { onReply(e.id, date, reply.trim()); setReply(""); setOpen(false); } }} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "#dc2626", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Send</button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} style={{ marginLeft: 30, background: "none", border: "none", fontSize: 12, color: "#dc2626", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>Reply</button>
      )}
    </div>
  );
}

// ─── Member Stuck Reply ───────────────────────────────────
function MemberStuckReply({ uid, date, stuckRes, save }) {
  const [text, setText] = useState("");
  const submit = async () => {
    if (!text.trim()) return;
    const key = `${uid}:${date}`;
    const thread = [...(stuckRes[key] || []), { text: text.trim(), from: uid, at: new Date().toISOString() }];
    await save({ sr: { ...stuckRes, [key]: thread } });
    setText("");
  };
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
      <input value={text} onChange={e => setText(e.target.value)} placeholder="Reply\u2026" maxLength={LIMITS.stuckReply}
        style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${S.border}`, fontSize: 12, fontFamily: "inherit", outline: "none" }}
        onKeyDown={e => { if (e.key === "Enter") submit(); }} />
      <button onClick={submit} disabled={!text.trim()} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: text.trim() ? "#111" : "#e5e7eb", color: text.trim() ? "#fff" : S.textFaint, fontSize: 11, fontWeight: 600, cursor: text.trim() ? "pointer" : "default", fontFamily: "inherit" }}>Send</button>
    </div>
  );
}

// ─── Drilldown Comment Input ──────────────────────────────
function DrillCmtInput({ onSave }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (!open) return <button onClick={() => setOpen(true)} style={{ background: "none", border: "none", fontSize: 11, color: "#6366f1", cursor: "pointer", fontFamily: "inherit", fontWeight: 500, marginTop: 4, padding: 0 }}>{"\ud83d\udcac"} Add feedback</button>;
  return <div style={{ display: "flex", gap: 6, marginTop: 6 }} onClick={e => e.stopPropagation()}>
    <input value={text} onChange={e => setText(e.target.value)} placeholder="Feedback\u2026" autoFocus maxLength={LIMITS.feedback} style={{ flex: 1, padding: "5px 10px", borderRadius: 6, border: `1.5px solid ${S.border}`, fontSize: 12, fontFamily: "inherit", outline: "none" }} onKeyDown={e => { if (e.key === "Enter" && text.trim()) { onSave(text.trim()); setOpen(false); } }} />
    <button onClick={() => { if (text.trim()) { onSave(text.trim()); setOpen(false); } }} style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: "#6366f1", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Send</button>
    <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", fontSize: 13, color: "#9ca3af", cursor: "pointer" }}>{"\u00d7"}</button>
  </div>;
}

// ─── Inline Comment ───────────────────────────────────────
function InlineCmt({ existingText, onSave }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(existingText || "");
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }} onClick={e => e.stopPropagation()}>
      {open ? <>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Feedback\u2026" autoFocus maxLength={LIMITS.feedback}
          style={{ flex: 1, padding: "7px 12px", borderRadius: 8, border: `1.5px solid ${S.border}`, fontSize: 13, fontFamily: "inherit", outline: "none" }}
          onKeyDown={e => { if (e.key === "Enter" && text.trim()) { onSave(text.trim()); setOpen(false); } }} />
        <button onClick={() => { if (text.trim()) { onSave(text.trim()); setOpen(false); } }} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Send</button>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", fontSize: 14, color: S.textFaint, cursor: "pointer" }}>{"\u00d7"}</button>
      </> : (
        <button onClick={() => { setText(existingText || ""); setOpen(true); }} style={{ background: "none", border: "none", fontSize: 12, color: "#6366f1", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
          {existingText ? `\ud83d\udcac "${existingText}" \u00b7 Edit` : "\ud83d\udcac Feedback"}
        </button>
      )}
    </div>
  );
}
