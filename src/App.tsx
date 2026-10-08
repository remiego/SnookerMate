import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  Check,
  CircleHelp,
  Clock3,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sun,
  Trophy,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import {
  isSupabaseConfigured,
  supabase,
} from "./lib/supabase";
import type {
  AccountProfile,
  MatchRecord,
  PlayerProfile,
} from "./lib/supabase";

type Ball = {
  name: string;
  value: number;
  className: string;
};

type FrameState = {
  players: [string, string];
  scores: [number, number];
  highBreaks: [number, number];
  active: 0 | 1;
  breaker: 0 | 1;
  break: number;
  redsRemaining: number;
  phase: "red" | "colour" | "clearance" | "complete";
  nextClearance: number;
};

type Tab = "score" | "players" | "history" | "admin";
type Theme = "dark" | "light";

const colours: Ball[] = [
  { name: "Red", value: 1, className: "red" },
  { name: "Yellow", value: 2, className: "yellow" },
  { name: "Green", value: 3, className: "green" },
  { name: "Brown", value: 4, className: "brown" },
  { name: "Blue", value: 5, className: "blue" },
  { name: "Pink", value: 6, className: "pink" },
  { name: "Black", value: 7, className: "black" },
];

const colourValues: Record<number, string> = {
  2: "Yellow",
  3: "Green",
  4: "Brown",
  5: "Blue",
  6: "Pink",
  7: "Black",
};

function freshFrame(
  players: [string, string] = ["Player One", "Player Two"],
  breaker: 0 | 1 = 0,
): FrameState {
  return {
    players,
    scores: [0, 0],
    highBreaks: [0, 0],
    active: breaker,
    breaker,
    break: 0,
    redsRemaining: 15,
    phase: "red",
    nextClearance: 2,
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function App() {
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem("snookermate-theme") === "light" ? "light" : "dark",
  );
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [profiles, setProfiles] = useState<PlayerProfile[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [tab, setTab] = useState<Tab>("score");
  const [frame, setFrame] = useState<FrameState>(() => freshFrame());
  const [frameNumber, setFrameNumber] = useState(1);
  const [setupOpen, setSetupOpen] = useState(true);
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const [redPotCount, setRedPotCount] = useState(2);
  const [foulPoints, setFoulPoints] = useState(4);
  const [undoFrames, setUndoFrames] = useState<FrameState[]>([]);
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "admin">("signin");
  const [authBusy, setAuthBusy] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [adminMatches, setAdminMatches] = useState<MatchRecord[]>([]);
  const [adminProfiles, setAdminProfiles] = useState<PlayerProfile[]>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isAdmin = account?.role === "admin";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("snookermate-theme", theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      theme === "dark" ? "#101812" : "#f1f4ee",
    );
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => current === "dark" ? "light" : "dark");
  }

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      if (data.session) setWelcomeOpen(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      if (event === "SIGNED_IN") setWelcomeOpen(false);
      if (event === "SIGNED_OUT") setWelcomeOpen(true);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const loadUserData = useCallback(async () => {
    if (!supabase || !session?.user.id) {
      setAccount(null);
      setProfiles([]);
      setMatches([]);
      return;
    }
    const [accountResult, profilesResult, matchesResult] = await Promise.all([
      supabase
        .from("account_profiles")
        .select("id, display_name, role")
        .eq("id", session.user.id)
        .single(),
      supabase
        .from("player_profiles")
        .select("id, user_id, name, created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("matches")
        .select("id, user_id, player1_id, player2_id, player1_name, player2_name, player1_score, player2_score, winner_name, created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false }),
    ]);
    if (accountResult.error) setError(accountResult.error.message);
    else setAccount(accountResult.data as AccountProfile);
    if (profilesResult.error) setError(profilesResult.error.message);
    else setProfiles((profilesResult.data ?? []) as PlayerProfile[]);
    if (matchesResult.error) setError(matchesResult.error.message);
    else setMatches((matchesResult.data ?? []) as MatchRecord[]);
  }, [session]);

  useEffect(() => {
    void loadUserData();
  }, [loadUserData]);

  const loadAdminData = useCallback(async () => {
    if (!supabase || !isAdmin) return;
    const [playersResult, matchesResult] = await Promise.all([
      supabase
        .from("player_profiles")
        .select("id, user_id, name, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("matches")
        .select("id, user_id, player1_id, player2_id, player1_name, player2_name, player1_score, player2_score, winner_name, created_at")
        .order("created_at", { ascending: false }),
    ]);
    if (playersResult.error) setError(playersResult.error.message);
    else setAdminProfiles((playersResult.data ?? []) as PlayerProfile[]);
    if (matchesResult.error) setError(matchesResult.error.message);
    else setAdminMatches((matchesResult.data ?? []) as MatchRecord[]);
  }, [isAdmin]);

  useEffect(() => {
    if (tab === "admin") void loadAdminData();
  }, [tab, loadAdminData]);

  const recordCount = matches.length;
  const winCount = useMemo(
    () => matches.filter((match) => match.winner_name === match.player1_name || match.winner_name === match.player2_name).length,
    [matches],
  );

  function updateFrame(next: FrameState) {
    setUndoFrames((current) => [...current, frame]);
    setFrame(next);
    setSaved(false);
    setMessage("");
  }

  function potBall(ball: Ball) {
    if (frame.phase === "complete") return;
    if (frame.phase === "red" && ball.name !== "Red") {
      setMessage("A red is next. Pot a red to continue.");
      return;
    }
    if (frame.phase === "colour" && ball.name === "Red") {
      setMessage("Choose a colour after the red.");
      return;
    }
    if (frame.phase === "clearance" && ball.value !== frame.nextClearance) {
      setMessage(`${colourValues[frame.nextClearance]} is next in the clearance.`);
      return;
    }

    const next = {
      ...frame,
      scores: [...frame.scores] as [number, number],
      highBreaks: [...frame.highBreaks] as [number, number],
    };
    next.scores[next.active] += ball.value;
    next.break += ball.value;
    next.highBreaks[next.active] = Math.max(next.highBreaks[next.active], next.break);

    if (frame.phase === "red") {
      next.redsRemaining -= 1;
      next.phase = "colour";
    } else if (frame.phase === "colour") {
      next.phase = next.redsRemaining === 0 ? "clearance" : "red";
      next.nextClearance = 2;
    } else {
      next.nextClearance += 1;
      if (next.nextClearance > 7) next.phase = "complete";
    }
    updateFrame(next);
  }

  function potMultipleReds(count: number) {
    if (
      frame.phase !== "red" ||
      !Number.isInteger(count) ||
      count < 2 ||
      count > frame.redsRemaining
    ) return;
    const next = {
      ...frame,
      scores: [...frame.scores] as [number, number],
      highBreaks: [...frame.highBreaks] as [number, number],
    };
    next.scores[next.active] += count;
    next.break += count;
    next.highBreaks[next.active] = Math.max(next.highBreaks[next.active], next.break);
    next.redsRemaining -= count;
    next.phase = "colour";
    updateFrame(next);
  }

  function changeTurn() {
    updateFrame({
      ...frame,
      active: frame.active === 0 ? 1 : 0,
      break: 0,
    });
  }

  function callFoul() {
    const opponent = frame.active === 0 ? 1 : 0;
    const next = { ...frame, scores: [...frame.scores] as [number, number] };
    next.scores[opponent] += foulPoints;
    next.active = opponent;
    next.break = 0;
    updateFrame(next);
  }

  function undo() {
    const previous = undoFrames[undoFrames.length - 1];
    if (!previous) return;
    setFrame(previous);
    setUndoFrames((current) => current.slice(0, -1));
    setSaved(false);
    setMessage("");
  }

  function changePlayerName(index: 0 | 1, name: string) {
    const players: [string, string] = [...frame.players];
    players[index] = name;
    setFrame({ ...frame, players });
    setSaved(false);
  }

  function startNewFrame() {
    setUndoFrames([]);
    const nextBreaker = frame.breaker === 0 ? 1 : 0;
    setFrame(freshFrame(frame.players, nextBreaker));
    setFrameNumber((number) => number + 1);
    setSaved(false);
    setMessage("");
    setSetupOpen(true);
    setRedPotCount(2);
  }

  function beginFrame() {
    if (!frame.players[0].trim() || !frame.players[1].trim()) {
      setError("Enter a name for both players to start the frame.");
      return;
    }
    setFrame({
      ...frame,
      players: [frame.players[0].trim(), frame.players[1].trim()],
    });
    setUndoFrames([]);
    setError("");
    setSetupOpen(false);
  }

  async function saveFrame() {
    if (saveBusy || saved) return;
    if (!session || !supabase) {
      setMessage("Frame ended. Sign in to save this match to your history.");
      setFrame({ ...frame, phase: "complete" });
      return;
    }
    if (!frame.players[0].trim() || !frame.players[1].trim()) {
      setError("Add a name for both players before saving.");
      return;
    }
    const player1Name = frame.players[0].trim();
    const player2Name = frame.players[1].trim();
    const winner = frame.scores[0] === frame.scores[1]
      ? null
      : frame.scores[0] > frame.scores[1] ? player1Name : player2Name;
    const findProfileId = (name: string) =>
      profiles.find((profile) => profile.name === name)?.id ?? null;

    setError("");
    setSaveBusy(true);
    const { error: saveError } = await supabase.from("matches").insert({
      user_id: session.user.id,
      player1_id: findProfileId(player1Name),
      player2_id: findProfileId(player2Name),
      player1_name: player1Name,
      player2_name: player2Name,
      player1_score: frame.scores[0],
      player2_score: frame.scores[1],
      winner_name: winner,
    });
    setSaveBusy(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setFrame({ ...frame, phase: "complete" });
    setSaved(true);
    setMessage("Match saved to your history.");
    await loadUserData();
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setAuthBusy(true);
    setError("");
    const mode = authMode;
    const result = mode === "signup"
      ? await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: { data: { display_name: displayName.trim() } },
        })
      : await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
    if (result.error) {
      setAuthBusy(false);
      setError(result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setAuthBusy(false);
      setMessage("Check your email to confirm your new account, then sign in.");
      setAuthOpen(false);
      return;
    }

    if (mode === "admin") {
      const userId = result.data.user?.id;
      if (!userId) {
        setAuthBusy(false);
        setError("Unable to verify this account. Please try again.");
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("account_profiles")
        .select("id, display_name, role")
        .eq("id", userId)
        .single();
      if (profileError || profile?.role !== "admin") {
        const { error: signOutError } = await supabase.auth.signOut();
        setAuthBusy(false);
        setError(signOutError
          ? `Admin access could not be verified, and sign-out failed: ${signOutError.message}`
          : profileError
            ? `Unable to verify admin access: ${profileError.message}`
            : "This account does not have administrator access.");
        return;
      }
      setAccount(profile as AccountProfile);
      setTab("admin");
    }

    setAuthBusy(false);
    setAuthOpen(false);
    setAuthEmail("");
    setAuthPassword("");
    setAuthMode("signin");
    setWelcomeOpen(false);
  }

  async function signOut() {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
    else {
      setAccount(null);
      setTab("score");
      setWelcomeOpen(true);
      setMessage("Signed out. This frame will remain available until you leave.");
    }
  }

  async function addPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !session) return;
    const name = newPlayerName.trim();
    if (!name) return;
    const { error: insertError } = await supabase.from("player_profiles").insert({
      user_id: session.user.id,
      name,
    });
    if (insertError) setError(insertError.message);
    else {
      setNewPlayerName("");
      setMessage(`${name} added to your players.`);
      await loadUserData();
    }
  }

  async function deletePlayer(id: string) {
    if (!supabase) return;
    const { error: deleteError } = await supabase.from("player_profiles").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else {
      setProfiles((current) => current.filter((player) => player.id !== id));
      setMessage("Player profile deleted.");
    }
  }

  async function updateAdminPlayer(player: PlayerProfile) {
    if (!supabase) return;
    const { error: updateError } = await supabase.from("player_profiles")
      .update({ name: player.name.trim() })
      .eq("id", player.id);
    if (updateError) setError(updateError.message);
    else setMessage("Player profile updated.");
  }

  async function deleteAdminPlayer(id: string) {
    if (!supabase) return;
    const { error: deleteError } = await supabase.from("player_profiles").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else {
      setAdminProfiles((current) => current.filter((player) => player.id !== id));
      setMessage("Player profile deleted.");
    }
  }

  async function updateAdminMatch(match: MatchRecord) {
    if (!supabase) return;
    const player1Name = match.player1_name.trim();
    const player2Name = match.player2_name.trim();
    const winner = match.player1_score === match.player2_score
      ? null
      : match.player1_score > match.player2_score ? player1Name : player2Name;
    const { error: updateError } = await supabase.from("matches").update({
      player1_name: player1Name,
      player2_name: player2Name,
      player1_score: match.player1_score,
      player2_score: match.player2_score,
      winner_name: winner,
    }).eq("id", match.id);
    if (updateError) setError(updateError.message);
    else {
      setAdminMatches((current) => current.map((item) => item.id === match.id ? { ...match, winner_name: winner } : item));
      setMessage("Match record updated.");
    }
  }

  async function deleteAdminMatch(id: string) {
    if (!supabase) return;
    const { error: deleteError } = await supabase.from("matches").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else {
      setAdminMatches((current) => current.filter((match) => match.id !== id));
      setMessage("Match record deleted.");
    }
  }

  function goToTab(next: Tab) {
    setTab(next);
    setMobileNavOpen(false);
    setError("");
    setMessage("");
  }

  const turnHint = frame.phase === "red"
    ? `${frame.redsRemaining} red${frame.redsRemaining === 1 ? "" : "s"} remaining · Pot a red`
    : frame.phase === "colour"
      ? "Red potted · Choose a colour"
      : frame.phase === "clearance"
        ? `Clearance · ${colourValues[frame.nextClearance]} is on`
        : "Frame complete";
  const ballEnabled = (ball: Ball) =>
    frame.phase !== "complete" &&
    ((frame.phase === "red" && ball.name === "Red") ||
      (frame.phase === "colour" && ball.name !== "Red") ||
      (frame.phase === "clearance" && ball.value === frame.nextClearance));

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); goToTab("score"); }}>
          <span className="brand-mark"><span /></span>
          <span>snooker<span className="brand-light">mate</span><small>THE CLUBHOUSE</small></span>
        </a>
        <div className="sidebar-label">MENU</div>
        <nav className="side-nav">
          <button className={tab === "score" ? "nav-item active" : "nav-item"} onClick={() => goToTab("score")}>
            <Activity size={18} /> <span>Live score</span><span className="live-dot" />
          </button>
          <button className={tab === "players" ? "nav-item active" : "nav-item"} onClick={() => goToTab("players")} disabled={!session}>
            <UsersRound size={18} /> <span>My players</span>
          </button>
          <button className={tab === "history" ? "nav-item active" : "nav-item"} onClick={() => goToTab("history")} disabled={!session}>
            <BarChart3 size={18} /> <span>Match history</span>
          </button>
          {isAdmin && (
            <button className={tab === "admin" ? "nav-item active" : "nav-item"} onClick={() => goToTab("admin")}>
              <ShieldCheck size={18} /> <span>Admin workspace</span>
            </button>
          )}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-card">
          <div className="sidebar-card-icon"><CircleHelp size={17} /></div>
          <div><strong>Keep it simple.</strong><p>Tap a ball to add it to the break.</p></div>
          <div className="mini-balls"><i className="ball-red" /><i className="ball-blue" /><i className="ball-black" /></div>
        </div>
        <div className="sidebar-profile">
          <div className="avatar">{session ? (account?.display_name?.[0] ?? session.user.email?.[0] ?? "U").toUpperCase() : <UserRound size={16} />}</div>
          <div className="profile-copy">
            <strong>{session ? account?.display_name || session.user.email : "Guest player"}</strong>
            <small>{session ? isAdmin ? "Administrator" : "Club member" : "Playing locally"}</small>
          </div>
          {session ? (
            <button className="icon-button profile-action" onClick={() => void signOut()} aria-label="Sign out"><LogOut size={17} /></button>
          ) : (
            <button className="icon-button profile-action" onClick={() => { setAuthMode("signin"); setAuthOpen(true); }} aria-label="Sign in"><LogIn size={17} /></button>
          )}
        </div>
      </aside>
      {mobileNavOpen && <button className="mobile-scrim" onClick={() => setMobileNavOpen(false)} aria-label="Close menu" />}

      <main className="main-content">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileNavOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="breadcrumb">CLUBHOUSE <ArrowRight size={13} /> <span>{tab === "score" ? "LIVE SCORE" : tab === "players" ? "MY PLAYERS" : tab === "history" ? "MATCH HISTORY" : "ADMIN WORKSPACE"}</span></div>
          <div className="topbar-right">
            <button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              <span>{theme === "dark" ? "LIGHT" : "DARK"}</span>
            </button>
            <span className="connection-indicator"><i /> {session ? "SYNCED" : "LOCAL GAME"}</span>
            {session ? (
              <button className="top-user" onClick={() => goToTab("history")}><span className="top-avatar">{(account?.display_name?.[0] ?? session.user.email?.[0] ?? "U").toUpperCase()}</span><span>{account?.display_name || session.user.email}</span></button>
            ) : (
              <button className="button button-small button-outline" onClick={() => { setAuthMode("signin"); setAuthOpen(true); }}>Sign in <ArrowRight size={14} /></button>
            )}
          </div>
        </header>

        {error && <div className="notice notice-error"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss"><X size={15} /></button></div>}
        {message && <div className="notice notice-success"><Check size={16} /><span>{message}</span><button onClick={() => setMessage("")} aria-label="Dismiss"><X size={15} /></button></div>}

        {tab === "score" && (
          <div className="page-wrap">
            <section className="page-heading score-heading">
              <div>
                <div className="eyebrow"><span className="eyebrow-line" /> TABLE 01 <span className="eyebrow-divider">/</span> FRAME {frameNumber.toString().padStart(2, "0")}</div>
                <h1>The table is <em>yours.</em></h1>
                <p className="heading-copy">Every point counts. Keep your eyes on the table.</p>
              </div>
              <div className="heading-tools">
                <span className="frame-status"><i /> {frame.phase === "complete" ? "FRAME COMPLETE" : "FRAME IN PROGRESS"}</span>
                <button className="button button-quiet" onClick={startNewFrame}><RotateCcw size={15} /> New frame</button>
              </div>
            </section>

            <section className="scoreboard panel">
              <div className="scoreboard-top">
                <div className="live-tag"><span /> {frame.phase === "complete" ? "FRAME COMPLETE" : "LIVE FRAME"}</div>
                <div className="table-label">FRAME {frameNumber.toString().padStart(2, "0")} <span>·</span> PRACTICE</div>
                <button className="icon-button help-button" title="Score by tapping a legal ball, then pass the turn or call a foul." aria-label="Scoring help"><CircleHelp size={17} /></button>
              </div>
              <div className="scoreboard-players">
                {[0, 1].map((index) => {
                  const playerIndex = index as 0 | 1;
                  const isActive = frame.active === playerIndex && frame.phase !== "complete";
                  const score = frame.scores[playerIndex];
                  const otherScore = frame.scores[playerIndex === 0 ? 1 : 0];
                  return (
                    <div key={playerIndex} className={`player-score ${isActive ? "player-active" : ""}`}>
                      <div className="player-meta">
                        <span className="player-number">0{playerIndex + 1}</span>
                        {isActive ? <span className="at-table"><i /> AT THE TABLE</span> : <span className="waiting-label">IN THE CHAIR</span>}
                      </div>
                      <select
                        className="player-select"
                        aria-label={`Select player ${playerIndex + 1}`}
                        value={profiles.find((profile) => profile.name === frame.players[playerIndex])?.id ?? ""}
                        onChange={(event) => {
                          const profile = profiles.find((item) => item.id === event.target.value);
                          if (profile) changePlayerName(playerIndex, profile.name);
                        }}
                      >
                        <option value="">Choose saved player</option>
                        {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                      </select>
                      <input
                        className="player-name-input"
                        aria-label={`Player ${playerIndex + 1} name`}
                        value={frame.players[playerIndex]}
                        maxLength={60}
                        onChange={(event) => changePlayerName(playerIndex, event.target.value)}
                        placeholder={`Player ${playerIndex + 1}`}
                      />
                      <div className="score-line">
                        <span className="score-value">{score}</span>
                        <span className="score-separator">/</span>
                        <span className="score-remaining">{Math.max(0, 147 - score - otherScore)}<small>REMAINING</small></span>
                      </div>
                      <div className="score-underline"><span style={{ width: `${Math.min(100, (score / Math.max(147, score + otherScore || 1)) * 100)}%` }} /></div>
                      <div className="player-footer">
                        <span>HIGH BREAK <strong>{frame.highBreaks[playerIndex]}</strong></span>
                        {isActive && frame.break > 0 && <span className="break-live">CURRENT BREAK <strong>{frame.break}</strong></span>}
                        {isActive && <span className="active-arrow"><ArrowDownRight size={15} /></span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="scoreboard-bottom">
                <div className="on-table"><span className="on-ball" /> <span><strong>{turnHint}</strong><small>{frame.phase === "complete" ? "Start a new frame to play again" : `${frame.players[frame.active]} is at the table`}</small></span></div>
                <div className="bottom-actions">
                  <button className="button button-quiet undo-button" onClick={undo} disabled={!undoFrames.length}><RotateCcw size={15} /> Undo</button>
                  {frame.phase !== "complete" ? (
                    <>
                      <label className="visually-hidden" htmlFor="foul-points">Foul penalty</label>
                      <select
                        id="foul-points"
                        className="foul-points-select"
                        value={foulPoints}
                        onChange={(event) => setFoulPoints(Number(event.target.value))}
                        aria-label="Foul penalty points"
                      >
                        {[4, 5, 6, 7].map((points) => <option key={points} value={points}>{points} points</option>)}
                      </select>
                      <button className="button button-foul" onClick={callFoul}><span className="foul-icon">!</span> Foul +{foulPoints}</button>
                      {!session && <button className="button button-outline" onClick={() => void saveFrame()}>End frame</button>}
                      <button className="button button-turn" onClick={changeTurn}>Pass turn <ArrowRight size={15} /></button>
                    </>
                  ) : (
                    <button className="button button-turn" onClick={startNewFrame}><RotateCcw size={15} /> Start next frame</button>
                  )}
                </div>
              </div>
            </section>

            <div className="scoring-layout">
              <section className="panel balls-panel">
                <div className="section-topline">
                  <div><div className="eyebrow">SCORING</div><h2>Pot a ball</h2></div>
                  <span className="keyboard-hint">TAP TO ADD POINTS</span>
                </div>
                <div className="ball-grid">
                  {colours.map((ball) => (
                    <button
                      key={ball.name}
                      className={`ball-option ${ballEnabled(ball) ? "" : "ball-disabled"}`}
                      onClick={() => potBall(ball)}
                      disabled={!ballEnabled(ball)}
                      aria-label={`Pot ${ball.name}, ${ball.value} point${ball.value > 1 ? "s" : ""}`}
                    >
                      <span className={`snooker-ball ${ball.className}`}>{ball.value}</span>
                      <span className="ball-option-label">{ball.name}</span>
                      <span className="ball-option-points">+{ball.value}</span>
                    </button>
                  ))}
                </div>
                {frame.phase === "red" && frame.redsRemaining >= 2 && (
                  <div className="multi-red-action">
                    <span className="double-red-balls"><i /><i /></span>
                    <div className="multi-red-copy">
                      <strong>Pot multiple reds</strong>
                      <small>Each red scores 1 point · next shot is a colour</small>
                    </div>
                    <label className="visually-hidden" htmlFor="red-pot-count">Number of reds potted</label>
                    <select
                      id="red-pot-count"
                      className="red-count-select"
                      value={Math.min(redPotCount, frame.redsRemaining)}
                      onChange={(event) => setRedPotCount(Number(event.target.value))}
                    >
                      {Array.from({ length: frame.redsRemaining - 1 }, (_, index) => index + 2).map((count) => (
                        <option key={count} value={count}>{count} reds</option>
                      ))}
                    </select>
                    <button
                      className="button button-outline multi-red-button"
                      onClick={() => potMultipleReds(Math.min(redPotCount, frame.redsRemaining))}
                    >
                      Pot {Math.min(redPotCount, frame.redsRemaining)} <ArrowRight size={14} />
                    </button>
                  </div>
                )}
                <div className="table-rule">
                  <span className="rule-icon"><CircleHelp size={14} /></span>
                  <p>{frame.phase === "red" ? "Pot a red, then choose any colour." : frame.phase === "colour" ? "A colour is on. The next shot is a red." : frame.phase === "clearance" ? "Clear the colours in order, from yellow to black." : "Frame complete. Save your score or start another frame."}</p>
                </div>
              </section>
              <aside className="side-stats">
                <div className="panel stat-card">
                  <div className="stat-top"><span>FRAME SNAPSHOT</span><Activity size={16} /></div>
                  <div className="stat-main">{frame.break}<small>pts</small></div>
                  <div className="stat-caption">CURRENT BREAK <span>{frame.players[frame.active]}</span></div>
                  <div className="stat-divider" />
                  <div className="stat-bottom-row"><span>Reds remaining</span><strong>{frame.redsRemaining}</strong></div>
                  <div className="stat-bottom-row"><span>On the table</span><strong>{frame.phase === "clearance" ? colourValues[frame.nextClearance] ?? "None" : frame.phase === "colour" ? "Colour" : frame.phase === "red" ? "Red" : "—"}</strong></div>
                </div>
                <div className="panel save-card">
                  <div className="save-card-icon"><Trophy size={17} /></div>
                  <div className="save-card-copy"><strong>{session ? saved ? "Match saved" : "Keep your stats" : "Playing for fun?"}</strong><p>{session ? "Save this frame to your match history." : "Create an account to save your match history."}</p></div>
                  {session ? (
                    <button className="button button-save" onClick={() => void saveFrame()} disabled={saved || saveBusy}><Check size={15} /> {saveBusy ? "Saving…" : saved ? "Saved" : "Finish & save"}</button>
                  ) : (
                    <button className="text-action" onClick={() => { setAuthMode("signup"); setAuthOpen(true); }}>Create account <ArrowRight size={14} /></button>
                  )}
                </div>
              </aside>
            </div>
          </div>
        )}

        {tab === "players" && (
          <div className="page-wrap subpage">
            <section className="page-heading">
              <div><div className="eyebrow"><span className="eyebrow-line" /> YOUR CLUBHOUSE</div><h1>My <em>players.</em></h1><p className="heading-copy">Build your roster and get straight to the break.</p></div>
              <div className="heading-tools"><span className="frame-status">{profiles.length} SAVED PLAYER{profiles.length === 1 ? "" : "S"}</span></div>
            </section>
            <section className="panel roster-panel">
              <div className="section-topline"><div><div className="eyebrow">PLAYER PROFILES</div><h2>Your roster</h2></div><span className="keyboard-hint">ONLY VISIBLE TO YOU</span></div>
              <form className="add-player-form" onSubmit={(event) => void addPlayer(event)}>
                <label className="field"><span>PLAYER NAME</span><input value={newPlayerName} onChange={(event) => setNewPlayerName(event.target.value)} placeholder="e.g. Ronnie O'Sullivan" maxLength={60} required /></label>
                <button className="button button-turn" type="submit"><Plus size={16} /> Add player</button>
              </form>
              {profiles.length ? (
                <div className="roster-list">
                  {profiles.map((profile, index) => (
                    <div className="roster-row" key={profile.id}>
                      <span className={`roster-avatar roster-avatar-${index % 4}`}>{profile.name.slice(0, 1).toUpperCase()}</span>
                      <span className="roster-name">{profile.name}</span>
                      <span className="roster-date">Added {formatDate(profile.created_at)}</span>
                      <button className="icon-button delete-button" onClick={() => void deletePlayer(profile.id)} aria-label={`Delete ${profile.name}`}><X size={17} /></button>
                    </div>
                  ))}
                </div>
              ) : <div className="empty-state"><UsersRound size={23} /><strong>Your roster is waiting.</strong><span>Add players here to select them at the table.</span></div>}
            </section>
          </div>
        )}

        {tab === "history" && (
          <div className="page-wrap subpage">
            <section className="page-heading">
              <div><div className="eyebrow"><span className="eyebrow-line" /> YOUR CLUBHOUSE</div><h1>Match <em>history.</em></h1><p className="heading-copy">Every frame tells a story. Here's yours so far.</p></div>
              <div className="heading-tools"><button className="button button-outline" onClick={() => goToTab("score")}>Play a frame <ArrowRight size={15} /></button></div>
            </section>
            <div className="history-stats">
              <div className="panel history-stat"><span>FRAMES PLAYED</span><strong>{recordCount.toString().padStart(2, "0")}</strong><small><Activity size={14} /> Saved to your account</small></div>
              <div className="panel history-stat"><span>DECIDED FRAMES</span><strong>{winCount.toString().padStart(2, "0")}</strong><small><Trophy size={14} /> With a recorded winner</small></div>
              <div className="panel history-stat"><span>PLAYER PROFILES</span><strong>{profiles.length.toString().padStart(2, "0")}</strong><small><UsersRound size={14} /> In your roster</small></div>
            </div>
            <section className="panel history-panel">
              <div className="section-topline"><div><div className="eyebrow">THE SCOREBOOK</div><h2>Recent frames</h2></div><span className="keyboard-hint">{matches.length} TOTAL</span></div>
              {matches.length ? (
                <div className="match-list">
                  {matches.map((match) => {
                    const firstWon = match.winner_name === match.player1_name;
                    const secondWon = match.winner_name === match.player2_name;
                    return (
                      <div className="match-row" key={match.id}>
                        <div className="match-date"><Clock3 size={14} />{formatDate(match.created_at)}</div>
                        <div className="match-side"><span className={firstWon ? "match-winner" : ""}>{match.player1_name}</span><strong className={firstWon ? "match-score winner-score" : "match-score"}>{match.player1_score}</strong></div>
                        <span className="match-vs">VS</span>
                        <div className="match-side match-side-right"><strong className={secondWon ? "match-score winner-score" : "match-score"}>{match.player2_score}</strong><span className={secondWon ? "match-winner" : ""}>{match.player2_name}</span></div>
                        <div className="match-result">{match.winner_name ? <><Trophy size={14} /> {match.winner_name} won</> : "Frame drawn"}</div>
                      </div>
                    );
                  })}
                </div>
              ) : <div className="empty-state"><BarChart3 size={23} /><strong>No frames in the book yet.</strong><span>Finish and save your first frame to start your stats.</span><button className="text-action" onClick={() => goToTab("score")}>Go to the table <ArrowRight size={14} /></button></div>}
            </section>
          </div>
        )}

        {tab === "admin" && isAdmin && (
          <div className="page-wrap subpage">
            <section className="page-heading">
              <div><div className="eyebrow"><span className="eyebrow-line" /> PRIVILEGED ACCESS</div><h1>Admin <em>workspace.</em></h1><p className="heading-copy">Manage every player profile and saved frame.</p></div>
              <div className="heading-tools"><span className="admin-badge"><ShieldCheck size={15} /> ADMINISTRATOR</span></div>
            </section>
            <section className="panel admin-panel">
              <div className="section-topline"><div><div className="eyebrow">ALL ACCOUNTS</div><h2>Player profiles <span className="count-chip">{adminProfiles.length}</span></h2></div></div>
              {adminProfiles.length ? <div className="admin-table">
                <div className="admin-table-head"><span>PROFILE NAME</span><span>OWNER ID</span><span>CREATED</span><span>ACTIONS</span></div>
                {adminProfiles.map((player) => (
                  <div className="admin-player-row" key={player.id}>
                    <input aria-label="Profile name" value={player.name} onChange={(event) => setAdminProfiles((current) => current.map((item) => item.id === player.id ? { ...item, name: event.target.value } : item))} />
                    <code>{player.user_id}</code><span>{formatDate(player.created_at)}</span>
                    <div className="admin-actions"><button className="button button-small button-outline" onClick={() => void updateAdminPlayer(player)}><Check size={14} /> Save</button><button className="icon-button delete-button" onClick={() => void deleteAdminPlayer(player.id)} aria-label={`Delete ${player.name}`}><X size={16} /></button></div>
                  </div>
                ))}
              </div> : <div className="empty-state"><UsersRound size={22} /><strong>No player profiles found.</strong></div>}
            </section>
            <section className="panel admin-panel admin-match-panel">
              <div className="section-topline"><div><div className="eyebrow">ALL SAVED DATA</div><h2>Match records <span className="count-chip">{adminMatches.length}</span></h2></div></div>
              {adminMatches.length ? <div className="admin-table">
                <div className="admin-match-head"><span>PLAYER ONE</span><span>SCORE</span><span>PLAYER TWO</span><span>SCORE</span><span>DATE / ACTIONS</span></div>
                {adminMatches.map((match) => (
                  <div className="admin-match-row" key={match.id}>
                    <input value={match.player1_name} aria-label="Player one name" onChange={(event) => setAdminMatches((current) => current.map((item) => item.id === match.id ? { ...item, player1_name: event.target.value } : item))} />
                    <input type="number" min="0" value={match.player1_score} aria-label="Player one score" onChange={(event) => setAdminMatches((current) => current.map((item) => item.id === match.id ? { ...item, player1_score: Number(event.target.value) } : item))} />
                    <input value={match.player2_name} aria-label="Player two name" onChange={(event) => setAdminMatches((current) => current.map((item) => item.id === match.id ? { ...item, player2_name: event.target.value } : item))} />
                    <input type="number" min="0" value={match.player2_score} aria-label="Player two score" onChange={(event) => setAdminMatches((current) => current.map((item) => item.id === match.id ? { ...item, player2_score: Number(event.target.value) } : item))} />
                    <div className="admin-actions"><span>{formatDate(match.created_at)}</span><button className="button button-small button-outline" onClick={() => void updateAdminMatch(match)}><Check size={14} /> Save</button><button className="icon-button delete-button" onClick={() => void deleteAdminMatch(match.id)} aria-label="Delete match"><X size={16} /></button></div>
                  </div>
                ))}
              </div> : <div className="empty-state"><BarChart3 size={22} /><strong>No match records found.</strong></div>}
            </section>
          </div>
        )}

        <footer className="app-footer"><span>© SNOOKERMATE</span><span>MADE FOR THE LOVE OF THE GAME <span className="footer-dot">·</span> {isSupabaseConfigured ? "SUPABASE CONNECTED" : "LOCAL MODE"}</span></footer>
      </main>

      {setupOpen && (
        <div className="frame-setup">
          <div className="setup-topbar">
            <a className="brand" href="#" onClick={(event) => event.preventDefault()}>
              <span className="brand-mark"><span /></span>
              <span>snooker<span className="brand-light">mate</span><small>THE CLUBHOUSE</small></span>
            </a>
            <span className="setup-step">FRAME {frameNumber.toString().padStart(2, "0")} <span>/</span> SETUP</span>
          </div>
          <div className="setup-content">
            <div className="setup-intro">
              <div className="eyebrow"><span className="eyebrow-line" /> BEFORE THE BREAK</div>
              <h1>Set the table.<br /> <em>Take your shot.</em></h1>
              <p>Choose your players, then see who's breaking off this frame.</p>
            </div>
            <section className="setup-controls">
              <div className="setup-players">
                {[0, 1].map((index) => {
                  const playerIndex = index as 0 | 1;
                  const breaks = frame.breaker === playerIndex;
                  return (
                    <div className={`setup-player ${breaks ? "setup-player-breaker" : ""}`} key={playerIndex}>
                      <div className="setup-player-heading">
                        <span className="setup-player-number">0{playerIndex + 1}</span>
                        <span>{breaks ? <><i className="break-indicator" /> BREAKS OFF</> : "OPENS SECOND"}</span>
                      </div>
                      <select
                        className="setup-profile-select"
                        aria-label={`Choose saved profile for player ${playerIndex + 1}`}
                        value={profiles.find((profile) => profile.name === frame.players[playerIndex])?.id ?? ""}
                        onChange={(event) => {
                          const profile = profiles.find((item) => item.id === event.target.value);
                          if (profile) changePlayerName(playerIndex, profile.name);
                        }}
                      >
                        <option value="">Choose a saved player</option>
                        {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                      </select>
                      <input
                        className="setup-player-name"
                        aria-label={`Name for player ${playerIndex + 1}`}
                        value={frame.players[playerIndex]}
                        maxLength={60}
                        onChange={(event) => changePlayerName(playerIndex, event.target.value)}
                        placeholder={`Player ${playerIndex + 1}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="setup-break-card">
                <div className="setup-break-label"><span className="break-indicator" /> THIS FRAME'S BREAK</div>
                <strong>{frame.players[frame.breaker].trim() || `Player ${frame.breaker + 1}`}</strong>
                <small>{frameNumber === 1 ? "First frame" : "Break alternates each frame"}</small>
              </div>
              <button className="button button-turn setup-start-button" onClick={beginFrame}>Start frame <ArrowRight size={16} /></button>
            </section>
            <div className="setup-footnote"><RotateCcw size={13} /> The opening break switches players every frame.</div>
          </div>
        </div>
      )}

      {welcomeOpen && !session && (
        <div className="welcome-screen">
          <header className="welcome-topbar">
            <a className="brand" href="#" onClick={(event) => event.preventDefault()}>
              <span className="brand-mark"><span /></span>
              <span>snooker<span className="brand-light">mate</span><small>THE CLUBHOUSE</small></span>
            </a>
            <div className="welcome-top-actions">
              <button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
                {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                <span>{theme === "dark" ? "LIGHT" : "DARK"}</span>
              </button>
              <span className="welcome-edition"><i /> YOUR NEXT FRAME STARTS HERE</span>
            </div>
          </header>
          <main className="welcome-content">
            <div className="welcome-copy">
              <div className="eyebrow"><span className="eyebrow-line" /> A BETTER WAY TO KEEP SCORE</div>
              <h1>Settle in.<br /><em>Take your shot.</em></h1>
              <p>Track every frame, every break, every point. Play on your own or keep your whole club's scorebook close.</p>
              <div className="welcome-actions">
                <button
                  className="button button-turn welcome-primary"
                  onClick={() => { setAuthMode("signup"); setAuthOpen(true); setError(""); }}
                >
                  Create your account <ArrowRight size={16} />
                </button>
                <button
                  className="button button-outline welcome-login"
                  onClick={() => { setAuthMode("signin"); setAuthOpen(true); setError(""); }}
                >
                  <LogIn size={15} /> Log in
                </button>
              </div>
              <div className="welcome-divider"><span /> OR JUST GET ON THE TABLE <span /></div>
              <button className="welcome-guest" onClick={() => setWelcomeOpen(false)}>
                <UserRound size={16} /> Continue as guest <ArrowRight size={15} />
              </button>
              <small className="welcome-guest-note">No account needed. Guest games stay on this device while you play.</small>
            </div>
          </main>
          <footer className="welcome-footer">
            <span><i className="welcome-online-dot" /> BUILT FOR THE LOVE OF THE GAME</span>
            <button onClick={() => { setAuthMode("admin"); setAuthOpen(true); setError(""); }}>Administrator sign in <ArrowRight size={13} /></button>
          </footer>
        </div>
      )}

      {authOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false); }}>
          <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="icon-button modal-close" onClick={() => setAuthOpen(false)} aria-label="Close"><X size={18} /></button>
            <div className="auth-brand-mark"><span /></div>
            <div className="eyebrow"><span className="eyebrow-line" /> {authMode === "admin" ? "ADMINISTRATOR ACCESS" : "YOUR CLUBHOUSE"}</div>
            <h2 id="auth-title">{authMode === "admin" ? "Admin sign in." : authMode === "signup" ? "Make yourself at home." : "Welcome back."}</h2>
            <p>{authMode === "admin" ? "Sign in with your administrator account to manage profiles and matches." : authMode === "signup" ? "Create an account to save your players and match history." : "Sign in to pick up where you left off."}</p>
            {!isSupabaseConfigured && <div className="auth-config-note">Supabase isn't configured yet. Add your project keys to <code>.env.local</code> to enable accounts.</div>}
            {error && <div className="auth-error">{error}</div>}
            <form onSubmit={(event) => void submitAuth(event)}>
              {authMode === "signup" && <label className="field"><span>YOUR NAME</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="How should we call you?" maxLength={60} required /></label>}
              <label className="field"><span>EMAIL ADDRESS</span><input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" required /></label>
              <label className="field"><span>PASSWORD</span><input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="At least 6 characters" minLength={6} required /></label>
              <button className="button button-turn auth-submit" disabled={!isSupabaseConfigured || authBusy}>{authBusy ? "One moment…" : authMode === "signup" ? "Create your account" : authMode === "admin" ? "Admin sign in" : "Sign in"} <ArrowRight size={16} /></button>
            </form>
            {authMode === "admin" ? (
              <div className="auth-switch">Not signing in as an admin? <button onClick={() => { setAuthMode("signin"); setError(""); }}>Regular sign in</button></div>
            ) : (
              <>
                <div className="auth-switch">{authMode === "signup" ? "Already a member?" : "New around here?"} <button onClick={() => { setAuthMode(authMode === "signup" ? "signin" : "signup"); setError(""); }}>{authMode === "signup" ? "Sign in" : "Create an account"}</button></div>
                <button className="auth-admin-link" onClick={() => { setAuthMode("admin"); setError(""); }}>Administrator? <span>Admin sign in</span> <ArrowRight size={13} /></button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
