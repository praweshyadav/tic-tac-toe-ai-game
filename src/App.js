import { useState, useEffect, useCallback, useRef, useMemo, useReducer } from "react";

// ════════════════════════════════════════════════════════════════════════════════
// § 1  CONSTANTS
// ════════════════════════════════════════════════════════════════════════════════

const PAGES = Object.freeze({ HOME:"home", SETUP:"setup", GAME:"game", STATS:"stats", AWARDS:"awards" });
const KEY_CELLS = {"1":0,"2":1,"3":2,"4":3,"5":4,"6":5,"7":6,"8":7,"9":8};
const WIN_3 = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const SK = { profile:"ttt_v3_profile", settings:"ttt_v3_settings", page:"ttt_v3_page", game:"ttt_v3_game" };

const RANKS = [
  { min:0,   label:"Rookie",       icon:"🥉", color:"#cd7f32" },
  { min:15,  label:"Player",       icon:"🎮", color:"#aaaaaa" },
  { min:40,  label:"Tactician",    icon:"⚔️",  color:"#4fc3f7" },
  { min:90,  label:"Strategist",   icon:"🧠", color:"#ce93d8" },
  { min:160, label:"Champion",     icon:"🏆", color:"#ffd700" },
  { min:270, label:"Grand Master", icon:"👑", color:"#ff6b35" },
];

const AVATARS = ["🦁","🐉","🔥","👻","🐺","🦊","🤖","🎭","⚡","🌊","🌙","☀️","💀","🎯","🧊","🎪","🦋","🐦"];

const SYMBOL_SETS = [
  { x:"X",  o:"O",  label:"Classic"  },
  { x:"🦊", o:"🐺", label:"Animals"  },
  { x:"⚡", o:"🌊", label:"Elements" },
  { x:"🌙", o:"☀️", label:"Cosmos"   },
  { x:"👾", o:"🤖", label:"Robots"   },
  { x:"🗡️", o:"🛡️", label:"Medieval" },
];

const THEMES = {
  void:   { key:"void",   name:"Void",   bg:"#060608", surface:"#0e0e14", border:"#1c1c28", x:"#ff2d6b", o:"#00e5ff", accent:"#ffd700", muted:"#44445a", grad:"135deg,#ff2d6b,#00e5ff" },
  carbon: { key:"carbon", name:"Carbon", bg:"#07090b", surface:"#0e1215", border:"#1b2028", x:"#7fff00", o:"#ff6b35", accent:"#ffd700", muted:"#445044", grad:"135deg,#7fff00,#ff6b35" },
  royal:  { key:"royal",  name:"Royal",  bg:"#06070f", surface:"#0d0e1c", border:"#1c1d30", x:"#a78bfa", o:"#f472b6", accent:"#fbbf24", muted:"#44445a", grad:"135deg,#a78bfa,#f472b6" },
  frost:  { key:"frost",  name:"Frost",  bg:"#060c12", surface:"#0c1622", border:"#162234", x:"#38bdf8", o:"#fb7185", accent:"#34d399", muted:"#2a4050", grad:"135deg,#38bdf8,#fb7185" },
};

const DIFFICULTIES = {
  easy:   { label:"Easy",   emoji:"🟢", depth:1, thinkMs:350  },
  medium: { label:"Medium", emoji:"🟡", depth:4, thinkMs:650  },
  hard:   { label:"Hard",   emoji:"🔴", depth:9, thinkMs:900  },
};

// Keep as number arrays so comparisons stay numeric
const TURN_TIMERS = [[0,"Off"],[10,"10 s"],[15,"15 s"],[30,"30 s"]];
const BOARD_SIZES = [[3,"3 × 3"],[5,"5 × 5"]];
const HEAT_LABELS = ["TL","TC","TR","ML","C","MR","BL","BC","BR"];

const ACHIEVEMENTS = [
  { id:"first_win",   icon:"🎯", title:"First Blood",   desc:"Win your first game",         xp:5,  check:s=>s.totalWins>=1      },
  { id:"hat_trick",   icon:"🎩", title:"Hat Trick",     desc:"Win 3 games in a row",        xp:15, check:s=>s.maxStreak>=3      },
  { id:"unstoppable", icon:"🔥", title:"Unstoppable",   desc:"Win 5 games in a row",        xp:30, check:s=>s.maxStreak>=5      },
  { id:"speedster",   icon:"⚡", title:"Speedster",     desc:"Win in exactly 5 moves",      xp:20, check:s=>s.fiveMoveWins>=1   },
  { id:"ai_slayer",   icon:"🤖", title:"AI Slayer",     desc:"Beat Hard AI 10 times",       xp:50, check:s=>s.aiHardWins>=10    },
  { id:"veteran",     icon:"🎖️", title:"Veteran",       desc:"Play 50 games",               xp:25, check:s=>s.totalGames>=50    },
  { id:"century",     icon:"💯", title:"Century",       desc:"Play 100 games",              xp:60, check:s=>s.totalGames>=100   },
  { id:"draw_master", icon:"🤝", title:"Draw Master",   desc:"Draw 10 games",               xp:20, check:s=>s.totalDraws>=10    },
  { id:"analyst",     icon:"🎓", title:"Analyst",       desc:"80%+ move accuracy in a game",xp:35, check:s=>s.bestAccuracy>=80  },
  { id:"undefeated",  icon:"🛡️", title:"Undefeated",   desc:"10 games without a loss",     xp:45, check:s=>s.noLossStreak>=10  },
];

// ════════════════════════════════════════════════════════════════════════════════
// § 2  GAME LOGIC — pure, side-effect free
// ════════════════════════════════════════════════════════════════════════════════

function buildWinLines(size) {
  if (size === 3) return WIN_3;
  const L = [];
  for (let r=0;r<size;r++)    for (let c=0;c<=size-3;c++) L.push([r*size+c,r*size+c+1,r*size+c+2]);
  for (let c=0;c<size;c++)    for (let r=0;r<=size-3;r++) L.push([r*size+c,(r+1)*size+c,(r+2)*size+c]);
  for (let r=0;r<=size-3;r++) for (let c=0;c<=size-3;c++) {
    L.push([r*size+c,(r+1)*size+c+1,(r+2)*size+c+2]);
    L.push([r*size+c+2,(r+1)*size+c+1,(r+2)*size+c]);
  }
  return L;
}

function checkWinner(sq, size) {
  for (const [a,b,c] of buildWinLines(size))
    if (sq[a] && sq[a]===sq[b] && sq[a]===sq[c]) return { winner:sq[a], line:[a,b,c] };
  if (sq.every(Boolean)) return { winner:"draw", line:[] };
  return null;
}

function minimax(sq, isMax, depth, α, β, maxD, size) {
  const r = checkWinner(sq, size);
  if (r) { if(r.winner==="O") return 10-(maxD-depth); if(r.winner==="X") return -10+(maxD-depth); return 0; }
  if (depth===0) return 0;
  const moves = sq.reduce((a,v,i)=>v===null?[...a,i]:a,[]);
  if (isMax) {
    let best=-Infinity;
    for (const m of moves){ const n=[...sq];n[m]="O"; best=Math.max(best,minimax(n,false,depth-1,α,β,maxD,size)); α=Math.max(α,best); if(β<=α)break; }
    return best;
  } else {
    let best=Infinity;
    for (const m of moves){ const n=[...sq];n[m]="X"; best=Math.min(best,minimax(n,true,depth-1,α,β,maxD,size)); β=Math.min(β,best); if(β<=α)break; }
    return best;
  }
}

function getBestMove(sq, difficulty, size) {

  const moves = [];
  for (let i = 0; i < sq.length; i++) {
    if (sq[i] === null) moves.push(i);
  }

  if (!moves.length) return null;

  // 🟢 Special AI for 5x5
  if (size === 5) {

    // 1️⃣ Try to WIN
    for (const m of moves) {
      const copy = [...sq];
      copy[m] = "O";
      if (checkWinner(copy, size)?.winner === "O") {
        return m;
      }
    }

    // 2️⃣ Try to BLOCK player
    for (const m of moves) {
      const copy = [...sq];
      copy[m] = "X";
      if (checkWinner(copy, size)?.winner === "X") {
        return m;
      }
    }

    // 3️⃣ Prefer center
    const center = Math.floor((size * size) / 2);
    if (sq[center] === null) return center;

    // 4️⃣ Otherwise random
    return moves[Math.floor(Math.random() * moves.length)];
  }

  // 🔵 Normal minimax for 3x3
  const depth = DIFFICULTIES[difficulty]?.depth ?? 9;

  if (difficulty === "easy" && Math.random() < 0.55) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  let best = -Infinity;
  let mv = moves[0];

  for (const m of moves) {
    const n = [...sq];
    n[m] = "O";
    const s = minimax(n,false,depth,-Infinity,Infinity,depth,size);

    if (s > best) {
      best = s;
      mv = m;
    }
  }

  return mv;
}

function computeAccuracy(moveLog, size) {
  const xs = moveLog.filter(m=>m.player==="X"&&m.boardBefore);
  if (!xs.length) return 0;
  return Math.round(xs.filter(m=>getBestMove(m.boardBefore,"hard",size)===m.cell).length/xs.length*100);
}

// ════════════════════════════════════════════════════════════════════════════════
// § 3  STORAGE
// ════════════════════════════════════════════════════════════════════════════════

const BLANK_PROFILE = Object.freeze({
  xp:0, totalGames:0, totalWins:0, totalLosses:0, totalDraws:0,
  aiHardWins:0, fiveMoveWins:0, maxStreak:0, currentStreak:0,
  noLossStreak:0, bestAccuracy:0,
  unlockedAchievements:[], gameHistory:[], heatmap:Array(9).fill(0),
  sessionWins:0, sessionLosses:0, sessionDraws:0,
});

const BLANK_SETTINGS = Object.freeze({
  theme:"void", soundEnabled:true, showKeyHints:true,
  playerXName:"Player X", playerOName:"Player O",
  playerXAvatar:"🦁", playerOAvatar:"🐉",
  symbolSet:0, boardSize:3, mode:"pvp", difficulty:"hard", turnTimer:0,
});

function ls_get(key, def) {
  try { const v=localStorage.getItem(key); return v ? {...def,...JSON.parse(v)} : def; }
  catch { return {...def}; }
}
function ls_set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
function ls_raw_get(key) { try { return localStorage.getItem(key); } catch { return null; } }
function ls_raw_set(key, val) { try { localStorage.setItem(key, val); } catch {} }

// ════════════════════════════════════════════════════════════════════════════════
// § 4  AUDIO — lazy AudioContext, fully guarded
// ════════════════════════════════════════════════════════════════════════════════

const SFX = (() => {
  let ctx = null;
  const C = () => { if (!ctx) ctx = new (window.AudioContext||window.webkitAudioContext)(); return ctx; };
  const t = (f,tp,d,v=0.12,dl=0) => {
    try {
      const c=C(), o=c.createOscillator(), g=c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type=tp; o.frequency.value=f;
      const s=c.currentTime+dl;
      g.gain.setValueAtTime(v,s); g.gain.exponentialRampToValueAtTime(0.0001,s+d);
      o.start(s); o.stop(s+d);
    } catch {}
  };
  const seq = (notes,on) => on && notes.forEach(([f,tp,d,v,dl])=>t(f,tp,d,v,dl));
  return {
    place:  on => seq([[500,"sine",.09,.11,0],[650,"sine",.07,.09,.04]],on),
    win:    on => seq([[523,"sine",.28,.11,0],[659,"sine",.28,.11,.11],[784,"sine",.28,.11,.22],[1047,"sine",.35,.11,.33]],on),
    draw:   on => on && t(220,"sawtooth",.35,.07),
    undo:   on => seq([[440,"sine",.1,.09,0],[330,"sine",.1,.09,.08]],on),
    hover:  on => on && t(900,"sine",.03,.03),
    click:  on => on && t(460,"sine",.06,.08),
    unlock: on => seq([[784,"triangle",.22,.09,0],[988,"triangle",.22,.09,.09],[1175,"triangle",.22,.09,.18],[1568,"triangle",.28,.09,.28]],on),
    error:  on => on && t(200,"square",.12,.08),
  };
})();

// ════════════════════════════════════════════════════════════════════════════════
// § 5  PROFILE REDUCER
// ════════════════════════════════════════════════════════════════════════════════

function profileReducer(state, action) {
  switch (action.type) {
    case "RECORD_GAME": {
      const { winner, moveCount, mode, difficulty, moveLog, boardSize, accuracy=0 } = action;
      const won=winner==="X", lost=winner==="O", drew=winner==="draw";
      const streak = won ? state.currentStreak+1 : 0;
      const noLoss = !lost ? state.noLossStreak+1 : 0;
      const heat = [...state.heatmap];
      if (boardSize===3) moveLog.forEach(m=>{ if(m.cell>=0&&m.cell<9) heat[m.cell]++; });
      return {
        ...state,
        totalGames:   state.totalGames+1,
        totalWins:    state.totalWins   +(won?1:0),
        totalLosses:  state.totalLosses +(lost?1:0),
        totalDraws:   state.totalDraws  +(drew?1:0),
        xp:           state.xp+(won?10:drew?3:1),
        currentStreak:streak,
        maxStreak:    Math.max(state.maxStreak,streak),
        noLossStreak: noLoss,
        aiHardWins:   state.aiHardWins   +(mode==="ai"&&difficulty==="hard"&&won?1:0),
        fiveMoveWins: state.fiveMoveWins +(won&&moveCount===5?1:0),
        bestAccuracy: Math.max(state.bestAccuracy,accuracy),
        heatmap: heat,
        gameHistory: [{winner,moveCount,mode,difficulty:mode==="ai"?difficulty:null,accuracy,ts:Date.now()},...state.gameHistory].slice(0,80),
        sessionWins:   state.sessionWins  +(won?1:0),
        sessionLosses: state.sessionLosses+(lost?1:0),
        sessionDraws:  state.sessionDraws +(drew?1:0),
      };
    }
    case "UNLOCK":        return { ...state, unlockedAchievements:[...new Set([...state.unlockedAchievements,action.id])] };
    case "RESET_STATS":   return { ...BLANK_PROFILE };
    case "RESET_SESSION": return { ...state, sessionWins:0, sessionLosses:0, sessionDraws:0 };
    default: return state;
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// § 6  HOOKS
// ════════════════════════════════════════════════════════════════════════════════

function useGameEngine({ boardSize, mode, difficulty, symbolSet, soundEnabled }) {
  const size  = boardSize;
  const empty = useCallback(()=>Array(size*size).fill(null),[size]);
  const [squares,  setSquares]  = useState(empty);
  const [xIsNext,  setXIsNext]  = useState(true);
  const [moveLog,  setMoveLog]  = useState([]);
  const [history,  setHistory]  = useState(()=>[empty()]);
  const [histIdx,  setHistIdx]  = useState(0);
  const [thinking, setThinking] = useState(false);
  const aiTimer = useRef(null);
  const snRef   = useRef(soundEnabled);
  snRef.current = soundEnabled;

  const result  = useMemo(()=>checkWinner(squares,size),[squares,size]);
  const isOver  = Boolean(result);
  const current = xIsNext?"X":"O";
  const syms    = SYMBOL_SETS[Math.min(symbolSet,SYMBOL_SETS.length-1)]??SYMBOL_SETS[0];

  const applyMove = useCallback((cell,player,snap)=>{
    setSquares(prev=>{
      const next=prev.map((v,j)=>j===cell?player:v);
      setHistory(h=>{ const nh=[...h.slice(0,histIdx+1),next]; setHistIdx(nh.length-1); return nh; });
      setMoveLog(p=>[...p,{player,cell,move:p.length+1,boardBefore:snap}]);
      SFX.place(snRef.current);
      return next;
    });
    setXIsNext(p=>!p);
  },[histIdx]);

  const makeMove = useCallback((cell)=>{
    if (squares[cell]||isOver||thinking) return false;
    applyMove(cell,current,[...squares]);
    return true;
  },[squares,isOver,thinking,current,applyMove]);

  const undoMove = useCallback(()=>{
    const steps=mode==="ai"?2:1;
    const target=Math.max(0,histIdx-steps);
    if (target===histIdx) return;
   if (aiTimer.current) clearTimeout(aiTimer.current);
    setSquares(history[target]); setXIsNext(target%2===0);
    setHistIdx(target); setMoveLog(p=>p.slice(0,target));
    setThinking(false); SFX.undo(snRef.current);
  },[histIdx,history,mode]);

  const travelTo = useCallback((idx)=>{
    if (idx<0||idx>=history.length) return;
    setSquares(history[idx]); setXIsNext(idx%2===0); setHistIdx(idx);
    SFX.click(snRef.current);
  },[history]);

  const reset = useCallback(()=>{
    if (aiTimer.current) clearTimeout(aiTimer.current);
    const e=empty();
    setSquares(e); setXIsNext(true); setMoveLog([]);
    setHistory([e]); setHistIdx(0); setThinking(false);
  },[empty]);

  // AI trigger
  useEffect(()=>{
    if (mode!=="ai"||xIsNext||isOver) return;
    setThinking(true);
    const delay = DIFFICULTIES[difficulty]?.thinkMs??650;
    aiTimer.current = setTimeout(()=>{
      const cell=getBestMove(squares,difficulty,size);
      if (cell!==null) applyMove(cell,"O",[...squares]);
      setThinking(false);
    },delay);
    return ()=>clearTimeout(aiTimer.current);
  },[mode,xIsNext,isOver,difficulty,size]); // intentionally omit squares/applyMove to avoid re-trigger

  // Hint: best move for the human player (works in both pvp and ai mode)
  const hintCell = useMemo(()=>{
    if (isOver) return null;
    if (mode==="ai" && !xIsNext) return null; // AI's turn, no hint
    return getBestMove(squares,"hard",size);
  },[isOver,mode,xIsNext,squares,size]);

  return {
    squares, xIsNext, current, result, isOver, moveLog,
    history, histIdx, thinking, syms, hintCell,
    canUndo: histIdx > 0 && !thinking,
    makeMove, undoMove, travelTo, reset,
  };
}

// Fix: always update prev ref so fresh works correctly every move
function useNewCells(squares) {
  const prev  = useRef(squares.map(()=>null));
  const [fresh, setFresh] = useState(()=>new Set());
  useEffect(()=>{
    const n=new Set();
    squares.forEach((v,i)=>{ if(v && !prev.current[i]) n.add(i); });
    prev.current = [...squares]; // always update
    if (n.size) {
      setFresh(n);
      const t=setTimeout(()=>setFresh(new Set()),500);
      return ()=>clearTimeout(t);
    }
  },[squares]);
  return fresh;
}

function useConfetti(result, soundEnabled) {
  const [particles, setParticles] = useState([]);
  const last = useRef(null);
  useEffect(()=>{
    if (!result||result.winner==="draw"||result===last.current) return;
    last.current=result;
    SFX.win(soundEnabled);
    setParticles(Array.from({length:72},(_,i)=>({
      id:i, x:2+Math.random()*96,
      color:["#ff2d6b","#00e5ff","#ffd700","#7fff00","#fb923c","#a78bfa","#34d399"][i%7],
      size:4+Math.random()*9, dur:1.3+Math.random()*1.8,
      delay:Math.random()*.9, shape:Math.random()>.5?"50%":"3px",
    })));
    const t=setTimeout(()=>setParticles([]),5000);
    return ()=>clearTimeout(t);
  },[result]);
  return particles;
}

// Fix: no stale closure — use ref for elapsed accumulation
function useGameTimer(active, isOver) {
  const [elapsed, setElapsed] = useState(0);
  const base   = useRef(Date.now());
  const frozen = useRef(0);
  const iv     = useRef(null);
  useEffect(()=>{
    clearInterval(iv.current);
    if (!active||isOver) return;
    base.current = Date.now() - frozen.current*1000;
    iv.current = setInterval(()=>setElapsed(Math.floor((Date.now()-base.current)/1000)),500);
    return ()=>clearInterval(iv.current);
  },[active,isOver]);
  const reset = useCallback(()=>{ setElapsed(0); frozen.current=0; base.current=Date.now(); },[]);
  useEffect(()=>{ frozen.current=elapsed; },[elapsed]);
  return { elapsed, reset };
}

function useTurnTimer(xIsNext, isOver, limit, onExpire) {
  const [left, setLeft] = useState(limit||0);
  const iv   = useRef(null);
  const cbRef = useRef(onExpire);
  cbRef.current = onExpire;
  useEffect(()=>{
    clearInterval(iv.current);
    if (!limit||isOver) { setLeft(limit||0); return; }
    setLeft(limit);
    iv.current = setInterval(()=>{
      setLeft(p=>{ if(p<=1){ clearInterval(iv.current); cbRef.current?.(); return limit; } return p-1; });
    },1000);
    return ()=>clearInterval(iv.current);
  },[xIsNext,isOver,limit]);
  return left;
}

// Fix: always active so R works after game over; handler is a ref so never stale
function useKeyboard(handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(()=>{
    const fn=(e)=>{ if(!e.repeat) ref.current(e.key); };
    window.addEventListener("keydown",fn);
    return ()=>window.removeEventListener("keydown",fn);
  },[]);
}

// ════════════════════════════════════════════════════════════════════════════════
// § 7  HELPERS
// ════════════════════════════════════════════════════════════════════════════════

const getRank = xp => [...RANKS].reverse().find(r=>xp>=r.min)??RANKS[0];
const fmtTime = s  => s<60?`${s}s`:`${Math.floor(s/60)}m ${s%60}s`;
const fmtDate = ts => {
  const d=new Date(ts),now=new Date();
  if(d.toDateString()===now.toDateString()) return "Today";
  if(d.toDateString()===new Date(now-864e5).toDateString()) return "Yesterday";
  return d.toLocaleDateString("en",{month:"short",day:"numeric"});
};
const heatRGB = x =>
  x==="#ff2d6b"?"255,45,107":x==="#7fff00"?"127,255,0":x==="#a78bfa"?"167,139,250":x==="#38bdf8"?"56,189,248":"255,165,0";

// ════════════════════════════════════════════════════════════════════════════════
// § 8  GLOBAL CSS
// ════════════════════════════════════════════════════════════════════════════════

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'DM Mono',monospace;overflow-x:hidden;-webkit-font-smoothing:antialiased}
button{cursor:pointer;font-family:inherit}
input{font-family:inherit}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#252535;border-radius:4px}

@keyframes popIn     {0%{transform:scale(0)rotate(-18deg);opacity:0}72%{transform:scale(1.12)rotate(3deg);opacity:1}100%{transform:scale(1)rotate(0);opacity:1}}
@keyframes fall      {0%{transform:translateY(-10px)rotate(0);opacity:1}100%{transform:translateY(110vh)rotate(720deg);opacity:0}}
@keyframes fadeUp    {from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn    {from{opacity:0}to{opacity:1}}
@keyframes slideInR  {from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
@keyframes slideInL  {from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}
@keyframes slideInD  {from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:translateY(0)}}
@keyframes glow      {0%,100%{opacity:.45}50%{opacity:1}}
@keyframes pulse     {0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
@keyframes bounce    {0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes winCell   {0%,100%{box-shadow:0 0 12px rgba(255,215,0,.3)}50%{box-shadow:0 0 32px rgba(255,215,0,.7)}}
@keyframes float     {0%,100%{transform:translate(0,0)scale(1)}33%{transform:translate(28px,-18px)scale(1.04)}66%{transform:translate(-18px,14px)scale(.97)}}
@keyframes titleIn   {0%{opacity:0;letter-spacing:.8em}100%{opacity:1;letter-spacing:.35em}}
@keyframes toastIn   {0%{transform:translateX(110%);opacity:0}12%{transform:translateX(-6px);opacity:1}88%{transform:translateX(-6px);opacity:1}100%{transform:translateX(110%);opacity:0}}
@keyframes timerWarn {0%,100%{color:#ff2d6b}50%{color:#fff}}
@keyframes barGrow    {from { height: 0 }to { height: 100% }}
@keyframes statusPop {0%{transform:scale(.82);opacity:0}65%{transform:scale(1.04)}100%{transform:scale(1);opacity:1}}
@keyframes resultPop {0%{transform:scale(.7)translateY(10px);opacity:0}60%{transform:scale(1.06)translateY(-3px)}100%{transform:scale(1)translateY(0);opacity:1}}
@keyframes cardFlash {0%{opacity:1}30%{opacity:.4}100%{opacity:1}}
@keyframes orbPulse  {0%,100%{opacity:.05;transform:scale(1)}50%{opacity:.1;transform:scale(1.1)}}
@keyframes shimmer   {0%{background-position:-300% center}100%{background-position:300% center}}
@keyframes spin      {from{transform:rotate(0)}to{transform:rotate(360deg)}}

@media(max-width:680px){
  .game-body{flex-direction:column!important}
  .game-rp{width:100%!important;border-left:none!important;border-top:1px solid rgba(255,255,255,.06)!important;max-height:160px!important}
  .hist-list{flex-direction:row!important;flex-wrap:wrap!important}
  .player-strip{flex-direction:column!important}
  .player-card{width:100%!important}
  .nav-center{display:none!important}
  .nav-tools{display:none!important}
  .mobile-bar{display:flex!important}
}
@media(max-width:480px){
  .top-nav{padding:10px 12px!important}
}
`;

// ════════════════════════════════════════════════════════════════════════════════
// § 9  ATOMS
// ════════════════════════════════════════════════════════════════════════════════

function Btn({ children, onClick, variant="ghost", color, theme, sx={}, disabled, title }) {
  const [hov, setHov] = useState(false);
  const c = color||theme?.x||"#ff2d6b";
  const V = {
    primary: { background:hov?`${c}26`:`${c}12`, border:`1.5px solid ${c}`, color:c, boxShadow:hov?`0 0 20px ${c}40`:`0 0 5px ${c}18` },
    ghost:   { background:hov?"#171722":"transparent", border:`1px solid ${hov?"#2a2a3a":theme?.border||"#1c1c28"}`, color:hov?"#e8e8f0":"#666680" },
    filled:  { background:hov?`${c}ee`:c, border:`1.5px solid ${c}`, color:"#060608", boxShadow:hov?`0 0 28px ${c}80`:`0 0 8px ${c}35` },
    danger:  { background:hov?"#ff2d6b14":"transparent", border:`1px solid ${hov?"#ff2d6b":"#2a2a3a"}`, color:hov?"#ff2d6b":"#555570" },
  };
  return (
    <button title={title} disabled={disabled} onClick={onClick}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ fontFamily:"'DM Mono',monospace", fontSize:".82rem", letterSpacing:".15em",
        textTransform:"uppercase", padding:"10px 20px", borderRadius:10,
        transition:"all .15s ease", opacity: disabled ? 0.4 : 1,
        cursor:disabled?"not-allowed":"pointer",
        ...(V[variant]??V.ghost), ...sx }}>
      {children}
    </button>
  );
}

function Badge({ children, color }) {
  return <span style={{ fontSize:".68rem", letterSpacing:".26em", textTransform:"uppercase",
    padding:"3px 9px", borderRadius:20, border:`1px solid ${color}40`, color,
    background:`${color}0e`, whiteSpace:"nowrap" }}>{children}</span>;
}

function Toggle({ value, onChange, color }) {
  return (
    <button onClick={()=>onChange(!value)} style={{ width:46,height:24,borderRadius:12,border:"none",
      position:"relative", background:value?color:"#181826", transition:"background .2s",
      boxShadow:value?`0 0 10px ${color}44`:"none", flexShrink:0 }}>
      <div style={{ width:18,height:18,borderRadius:"50%",background:"#fff",
        position:"absolute",top:3,left:value?25:3,transition:"left .2s" }} />
    </button>
  );
}

function SectionCard({ title, children, theme }) {
  return (
    <div style={{ background:theme.surface, border:`1px solid ${theme.border}`, borderRadius:16, padding:"20px 22px" }}>
      {title && <div style={{ fontSize:".7rem", letterSpacing:".4em", color:theme.x,
        textTransform:"uppercase", marginBottom:16, opacity:.9 }}>◈ {title}</div>}
      {children}
    </div>
  );
}

// FIX: compare by coerced string so numbers like 3, 0 match string keys "3", "0"
function Tabs({ options, value, onChange }) {
  const sv = String(value);
  return (
    <div style={{ display:"flex", background:"#0a0a12", border:"1px solid #1a1a28",
      borderRadius:10, overflow:"hidden", flexWrap:"wrap" }}>
      {options.map(([k,v])=>{
        const active = String(k)===sv;
        return (
          <button key={k} onClick={()=>onChange(k)} style={{
            border:"none", fontFamily:"'DM Mono',monospace", fontSize:".78rem",
            letterSpacing:".1em", cursor:"pointer", padding:"9px 16px", whiteSpace:"nowrap",
            background: active?"#1e1e2e":"transparent",
            color: active?"#e8e8f0":"#4a4a60",
            transition:"all .15s",
            boxShadow: active?"inset 0 -2px 0 currentColor":"none" }}>
            {v}
          </button>
        );
      })}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      marginBottom:14, gap:12, flexWrap:"wrap" }}>
      <span style={{ fontSize:".82rem", color:"#9999bb", letterSpacing:".1em", flexShrink:0 }}>{label}</span>
      {children}
    </div>
  );
}

function AchievementToast({ ach, theme, onDone }) {
  useEffect(()=>{ const t=setTimeout(onDone,4400); return ()=>clearTimeout(t); },[]);
  return (
    <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999, maxWidth:310,
      background:theme.surface, border:`1.5px solid ${theme.accent}`,
      borderRadius:18, padding:"14px 18px", display:"flex", gap:14, alignItems:"center",
      boxShadow:`0 0 40px ${theme.accent}30`, animation:"toastIn 4.4s ease forwards",
      pointerEvents:"none" }}>
      <div style={{ fontSize:"2rem", flexShrink:0 }}>{ach.icon}</div>
      <div>
        <div style={{ fontSize:".65rem", letterSpacing:".3em", color:theme.accent,
          textTransform:"uppercase", marginBottom:3 }}>Achievement · +{ach.xp} XP</div>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.08rem",
          letterSpacing:".08em" }}>{ach.title}</div>
        <div style={{ fontSize:".72rem", color:theme.muted, marginTop:2 }}>{ach.desc}</div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// § 10  HOME PAGE
// ════════════════════════════════════════════════════════════════════════════════

function HomePage({ theme, profile, onNavigate }) {
  const rank  = getRank(profile.xp);
  const next  = RANKS.find(r=>r.min>profile.xp);
  const wr    = profile.totalGames ? Math.round(profile.totalWins/profile.totalGames*100) : 0;
  const xpPct = next ? Math.min(100,((profile.xp-rank.min)/(next.min-rank.min))*100) : 100;
  const hasSess = (profile.sessionWins+profile.sessionLosses+profile.sessionDraws)>0;

  return (
    <div style={{ minHeight:"100vh", background:theme.bg, color:"#e8e8f0",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:"32px 20px", gap:24, position:"relative", overflow:"hidden" }}>

      {/* Ambient orbs */}
      {[[theme.x,"top:-12%","left:-10%"],[theme.o,"top:−10%","right:−8%"]].map(([c, top, side], i) =>(
        <div key={i} style={{ position:"absolute", width:480, height:480, borderRadius:"50%",
          background:c, filter:"blur(140px)", opacity:.055, pointerEvents:"none",
          top:i===0?"-12%":"-10%", left:i===0?"-10%":"auto", right:i===1?"-8%":"auto",
          animation:`float ${8+i*3}s ease-in-out infinite` }} />
      ))}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none",
        backgroundImage:`linear-gradient(${theme.border}44 1px,transparent 1px),linear-gradient(90deg,${theme.border}44 1px,transparent 1px)`,
        backgroundSize:"52px 52px" }} />

      <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column",
        alignItems:"center", gap:22, width:"100%", maxWidth:400 }}>

        <div style={{ textAlign:"center", animation:"fadeUp .6s ease" }}>
          <div style={{ fontSize:".7rem", letterSpacing:".5em", color:theme.x,
            textTransform:"uppercase", marginBottom:14, opacity:.8 }}>◆ ◆ SMART AI GAME ◆ ◆</div>
          <h1 style={{ fontFamily:"'Bebas Neue',sans-serif",
            fontSize:"clamp(3.8rem,12vw,7.5rem)", letterSpacing:".35em", lineHeight:.9,
            background:`linear-gradient(${theme.grad})`,
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
            backgroundClip:"text", animation:"titleIn 1s ease forwards" }}>
            TIC<br/>TAC<br/>TOE
          </h1>
          <p style={{ fontSize:".72rem", letterSpacing:".42em", color:theme.muted,
            marginTop:14, textTransform:"uppercase" }}>Strategy · Intelligence · Glory</p>
        </div>

        {/* Rank card */}
        <div style={{ width:"100%", background:theme.surface, border:`1px solid ${theme.border}`,
          borderRadius:20, padding:"18px 20px", animation:"fadeUp .6s .1s ease both" }}>
          <div style={{ display:"flex", gap:14, alignItems:"center", marginBottom:12 }}>
            <div style={{ width:50, height:50, borderRadius:14, flexShrink:0,
              background:`linear-gradient(${theme.grad})`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:"1.6rem", boxShadow:`0 0 16px ${theme.x}40`, animation:"pulse 3s ease infinite" }}>
              {rank.icon}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.25rem",
                  color:rank.color, letterSpacing:".08em" }}>{rank.label}</span>
                <Badge color={rank.color}>{profile.xp} XP</Badge>
              </div>
              <div style={{ fontSize:".73rem", color:theme.muted }}>
                {profile.totalGames} games · {wr}% wins · {profile.maxStreak} best streak
              </div>
            </div>
          </div>
          {next && <>
            <div style={{ display:"flex", justifyContent:"space-between",
              fontSize:".67rem", color:theme.muted, marginBottom:5 }}>
              <span>{rank.label}</span><span>{next.min-profile.xp} XP → {next.label}</span>
            </div>
            <div style={{ height:5, background:"#111120", borderRadius:4, overflow:"hidden" }}>
              <div style={{ height:"100%", borderRadius:4, width:`${xpPct}%`,
                background:`linear-gradient(90deg,${theme.x},${theme.o})`,
                transition:"width 1.2s ease", boxShadow:`0 0 8px ${theme.x}55` }} />
            </div>
          </>}
        </div>

        {/* Session */}
        {hasSess && (
          <div style={{ display:"flex", gap:8, width:"100%", animation:"fadeUp .6s .18s ease both" }}>
            {[["W",profile.sessionWins,theme.x],["L",profile.sessionLosses,theme.o],["D",profile.sessionDraws,theme.muted]].map(([l,v,c])=>(
              <div key={l} style={{ flex:1, background:theme.surface, border:`1px solid ${theme.border}`,
                borderRadius:12, padding:"10px 8px", textAlign:"center" }}>
                <div style={{ fontSize:".64rem", color:theme.muted, letterSpacing:".2em",
                  textTransform:"uppercase", marginBottom:3 }}>Session {l}</div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.7rem", color:c, lineHeight:1 }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        {/* CTAs */}
        <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%",
          animation:"fadeUp .6s .25s ease both" }}>
          <Btn onClick={()=>onNavigate(PAGES.SETUP)} variant="filled" color={theme.x} theme={theme}
            sx={{ padding:"15px", fontSize:".9rem", letterSpacing:".28em" }}>▶ Play Now</Btn>
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={()=>onNavigate(PAGES.STATS)}  variant="ghost" theme={theme} sx={{flex:1}}>📊 Stats</Btn>
            <Btn onClick={()=>onNavigate(PAGES.AWARDS)} variant="ghost" theme={theme} sx={{flex:1}}>🏆 Awards</Btn>
          </div>
        </div>

        {/* Recent game dots */}
        {profile.gameHistory.length>0 && (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"center",
            animation:"fadeUp .6s .35s ease both" }}>
            {profile.gameHistory.slice(0,10).map((g,i)=>(
              <div key={i} title={`${g.winner==="draw"?"Draw":`${g.winner} won`} · ${g.moveCount} moves`}
                style={{ width:26, height:26, borderRadius:6,
                  background:g.winner==="X"?`${theme.x}14`:g.winner==="draw"?"#141420":`${theme.o}14`,
                  border:`1px solid ${g.winner==="X"?theme.x:g.winner==="draw"?theme.border:theme.o}`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:".7rem", color:g.winner==="X"?theme.x:g.winner==="draw"?"#333":theme.o,
                  fontFamily:"'Bebas Neue',sans-serif" }}>
                {g.winner==="draw"?"—":g.winner}
              </div>
            ))}
            <span style={{ fontSize:".66rem", color:theme.muted, alignSelf:"center",
              marginLeft:4, letterSpacing:".14em" }}>RECENT</span>
          </div>
        )}

        {/* Feature tags */}
        <div style={{ display:"flex", gap:7, flexWrap:"wrap", justifyContent:"center",
          animation:"fadeUp .6s .42s ease both" }}>
          {["🤖 Smart AI","⌨ Keyboard","↩ Undo","📊 Accuracy","🔥 Heatmap","🏆 Ranks"].map(f=>(
            <span key={f} style={{ fontSize:".7rem", color:theme.muted, letterSpacing:".1em",
              padding:"4px 11px", borderRadius:20, border:`1px solid ${theme.border}` }}>{f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// § 11  SETUP PAGE
// ════════════════════════════════════════════════════════════════════════════════

function SetupPage({ theme, settings, onSave, onStart, onBack }) {
  const [cfg, setCfg] = useState({...BLANK_SETTINGS, ...settings});
  const set = (k,v) => setCfg(p=>({...p,[k]:v}));

  const cycleAvatar = key => {
    const i = AVATARS.indexOf(cfg[key]);
    set(key, AVATARS[(i+1)%AVATARS.length]);
  };

  return (
    <div style={{ minHeight:"100vh", background:theme.bg, color:"#e8e8f0",
      display:"flex", flexDirection:"column", alignItems:"center",
      padding:"28px 16px 40px", gap:14, overflowY:"auto" }}>

      <div style={{ display:"flex", alignItems:"center", gap:14, width:"100%",
        maxWidth:560, animation:"fadeUp .4s ease" }}>
        <Btn onClick={onBack} variant="ghost" theme={theme} sx={{padding:"8px 14px"}}>← Back</Btn>
        <div>
          <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"2rem", letterSpacing:".22em" }}>Game Setup</h2>
          <p style={{ fontSize:".73rem", color:theme.muted, letterSpacing:".2em" }}>Configure your match</p>
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:12, width:"100%",
        maxWidth:560, animation:"fadeUp .4s .07s ease both" }}>

        <SectionCard title="Match Rules" theme={theme}>
          <Row label="Mode">
            <Tabs options={[["pvp","👤 vs 👤"],["ai","👤 vs 🤖"]]} value={cfg.mode} onChange={v=>set("mode",v)} />
          </Row>
          {cfg.mode==="ai" && (
            <Row label="Difficulty">
              <Tabs options={Object.entries(DIFFICULTIES).map(([k,d])=>[k,`${d.emoji} ${d.label}`])}
                value={cfg.difficulty} onChange={v=>set("difficulty",v)} />
            </Row>
          )}
          <Row label="Board Size">
            {/* Pass numeric key, Tabs will coerce to string for comparison */}
            <Tabs options={BOARD_SIZES} value={cfg.boardSize} onChange={v=>set("boardSize",Number(v))} />
          </Row>
          <Row label="Turn Timer">
            <Tabs options={TURN_TIMERS} value={cfg.turnTimer} onChange={v=>set("turnTimer",Number(v))} />
          </Row>
        </SectionCard>

        <SectionCard title="Players" theme={theme}>
          {[["playerXName","playerXAvatar","X",theme.x,cfg.mode==="ai"?"You":"Player X"],
            ["playerOName","playerOAvatar","O",theme.o,cfg.mode==="ai"?"AI Bot":"Player O"]].map(([nk,ak,p,c,ph])=>(
            <div key={p} style={{ marginBottom:p==="X"?16:0 }}>
              <div style={{ fontSize:".7rem", letterSpacing:".2em", color:c,
                textTransform:"uppercase", marginBottom:8 }}>Player {p}</div>
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                <button onClick={()=>cycleAvatar(ak)} title="Click to cycle avatar"
                  style={{ width:42,height:42,borderRadius:12,background:`${c}12`,
                    border:`1.5px solid ${c}40`,display:"flex",alignItems:"center",
                    justifyContent:"center",fontSize:"1.35rem",flexShrink:0,
                    transition:"transform .15s" }}
                  onMouseEnter={e=>e.currentTarget.style.transform="scale(1.1)"}
                  onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                  {cfg[ak]??"🦁"}
                </button>
                <input value={cfg[nk]??""} maxLength={14} placeholder={ph}
                  onChange={e=>set(nk,e.target.value.slice(0,14))}
                  style={{ flex:1,background:"#080810",border:`1px solid ${theme.border}`,
                    borderRadius:9,padding:"9px 14px",color:c,outline:"none",
                    fontSize:".82rem",transition:"border-color .18s" }}
                  onFocus={e=>e.target.style.borderColor=c}
                  onBlur={e=>e.target.style.borderColor=theme.border} />
              </div>
            </div>
          ))}
        </SectionCard>

        <SectionCard title="Symbol Set" theme={theme}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {SYMBOL_SETS.map((s,i)=>(
              <button key={i} onClick={()=>set("symbolSet",i)} style={{
                background:cfg.symbolSet===i?`${theme.x}14`:"transparent",
                border:`1.5px solid ${cfg.symbolSet===i?theme.x:theme.border}`,
                borderRadius:12,padding:"10px 14px",cursor:"pointer",
                transition:"all .16s",textAlign:"center",
                boxShadow:cfg.symbolSet===i?`0 0 10px ${theme.x}28`:"none" }}>
                <div style={{ fontSize:"1.1rem", marginBottom:3 }}>{s.x} {s.o}</div>
                <div style={{ fontSize:".67rem", color:theme.muted, letterSpacing:".1em" }}>{s.label}</div>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Appearance & Sound" theme={theme}>
          <Row label="Theme">
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {Object.values(THEMES).map(t=>(
                <button key={t.key} title={t.name} onClick={()=>set("theme",t.key)} style={{
                  width:34,height:34,borderRadius:9,cursor:"pointer",
                  background:`linear-gradient(${t.grad})`,
                  border:`2.5px solid ${cfg.theme===t.key?"#fff":"transparent"}`,
                  boxShadow:cfg.theme===t.key?"0 0 12px rgba(255,255,255,.22)":"none",
                  transition:"all .17s" }} />
              ))}
            </div>
          </Row>
          <Row label="Sound Effects">
            <Toggle value={cfg.soundEnabled??true} onChange={v=>set("soundEnabled",v)} color={theme.x} />
          </Row>
          <Row label="Keyboard Hints (1–9, Z, R)">
            <Toggle value={cfg.showKeyHints??true} onChange={v=>set("showKeyHints",v)} color={theme.x} />
          </Row>
        </SectionCard>

        <Btn onClick={()=>{ onSave(cfg); onStart(cfg); }} variant="filled"
          color={theme.x} theme={theme}
          sx={{ padding:"15px", fontSize:".9rem", letterSpacing:".28em" }}>
          ⚡ Start Match
        </Btn>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// § 12  GAME CELL
// ════════════════════════════════════════════════════════════════════════════════

function GameCell({ value, isWinning, isNew, isHint, isKeyFocus, current, onClick, theme, syms, disabled, size }) {
  const [hov, setHov] = useState(false);
  const isEmoji   = syms.x !== "X";
  const dispVal   = value==="X"?syms.x : value==="O"?syms.o : null;
  const markColor = value==="X"?theme.x : theme.o;
  const hoverC    = current==="X"?theme.x : theme.o;
  const cellSize  = size===5?"clamp(54px,min(11vw,11vh),82px)":"clamp(80px,min(22vw,20vh),126px)";
  const fontSize  = size===5?"clamp(1.4rem,min(3.6vw,3.4vh),2.3rem)":"clamp(2rem,min(6.5vw,6vh),3.4rem)";

  return (
    <div onClick={onClick}
      onMouseEnter={()=>{ setHov(true); if(!value&&!disabled) SFX.hover(true); }}
      onMouseLeave={()=>setHov(false)}
      style={{
        width:cellSize, height:cellSize,
        background: isWinning?`${theme.accent}12` : hov&&!value&&!disabled?`${hoverC}0d` : theme.surface,
        border:`1.5px solid ${isWinning?theme.accent : isKeyFocus?`${theme.x}bb` : isHint?`${theme.accent}66` : hov&&!value&&!disabled?`${hoverC}99` : theme.border}`,
        borderRadius:size===5?10:14,
        display:"flex", alignItems:"center", justifyContent:"center",
        cursor:value||disabled?"default":"pointer",
        transition:"background .12s ease, border-color .12s ease, transform .12s ease, box-shadow .12s ease",
        transform: isNew?"scale(1.07)" : hov&&!value&&!disabled?"scale(1.04)" : "scale(1)",
        boxShadow: isWinning?`0 0 22px ${theme.accent}50` : isNew?`0 0 16px ${markColor}50` : hov&&!value&&!disabled?`0 0 10px ${hoverC}25` : "none",
        position:"relative", overflow:"hidden", userSelect:"none",
        animation: isWinning?"winCell 1.5s ease infinite":"none",
      }}>
      {isWinning && <div style={{ position:"absolute",inset:0,background:`radial-gradient(circle,${theme.accent}15,transparent 60%)` }} />}
      {isHint && !value && (
        <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
          <div style={{ width:12,height:12,borderRadius:"50%",background:theme.accent,
            opacity:.7,animation:"pulse 1s ease infinite",
            boxShadow:`0 0 12px ${theme.accent}` }} />
          <div style={{ fontSize:".55rem",color:theme.accent,letterSpacing:".15em",opacity:.8 }}>HINT</div>
        </div>
      )}
      {isKeyFocus && !value && !isHint && (
        <div style={{ position:"absolute",inset:3,borderRadius:10,
          border:`1.5px dashed ${theme.x}66`,animation:"pulse .6s ease infinite" }} />
      )}
      {!value && hov && !disabled && !isHint && (
        <span style={{ fontSize,opacity:.16,lineHeight:1,userSelect:"none",
          fontFamily:isEmoji?"inherit":"'Bebas Neue',sans-serif",
          color:isEmoji?"inherit":hoverC }}>
          {current==="X"?syms.x:syms.o}
        </span>
      )}
      {dispVal && (
        <span style={{ fontSize,lineHeight:1,
          fontFamily:isEmoji?"inherit":"'Bebas Neue',sans-serif",
          color:isEmoji?"inherit":markColor,
          textShadow:isEmoji?"none":`0 0 18px ${markColor}cc,0 0 36px ${markColor}44`,
          display:"flex",alignItems:"center",justifyContent:"center",
          animation:isNew?"popIn .38s cubic-bezier(.175,.885,.32,1.275) forwards":"none" }}>
          {dispVal}
        </span>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// § 13  GAME PAGE
// ════════════════════════════════════════════════════════════════════════════════

function GamePage({ theme, settings, onBack, onProfileUpdate, profile }) {
  const {
    mode="pvp", difficulty="hard", boardSize=3, symbolSet=0,
    soundEnabled=true, turnTimer=0, showKeyHints=true,
    playerXName="Player X", playerOName="Player O",
    playerXAvatar="🦁", playerOAvatar="🐉",
  } = settings;

  const game = useGameEngine({ boardSize, mode, difficulty, symbolSet, soundEnabled });
  const { squares, xIsNext, current, result, isOver, moveLog,
          history, histIdx, thinking, syms, hintCell, canUndo,
          makeMove, undoMove, travelTo, reset } = game;

  const newCells  = useNewCells(squares);
  const particles = useConfetti(result, soundEnabled);
  const { elapsed, reset:resetTimer } = useGameTimer(moveLog.length>0, isOver);

  const [showHints,   setShowHints]   = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [recorded,    setRecorded]    = useState(false);
  const [keyFocus,    setKeyFocus]    = useState(null);
  // track status key so animation replays on each change
  const [statusKey,   setStatusKey]   = useState(0);
  const prevStatus = useRef("");

  // Recompute score from session history
  const scoreX = profile.sessionWins;
  const scoreO = profile.sessionLosses;

  // Turn timer — callback is stable via ref inside hook
  const turnLeft = useTurnTimer(xIsNext, isOver, turnTimer,
    ()=>{ if(!isOver&&!thinking){ const f=squares.findIndex(v=>v===null); if(f>=0) makeMove(f); } });

  // Record result once
  useEffect(()=>{
    if (!result||recorded) return;
    setRecorded(true);
    const accuracy = result.winner!=="draw" ? computeAccuracy(moveLog,boardSize) : 0;
    onProfileUpdate({ type:"RECORD_GAME", winner:result.winner,
      moveCount:moveLog.length, mode, difficulty, moveLog, boardSize, accuracy });
    if (result.winner==="draw") SFX.draw(soundEnabled);
  },[result,recorded]);

  const handleReset = useCallback(()=>{
    reset(); setRecorded(false); resetTimer(); setKeyFocus(null);
  },[reset,resetTimer]);

  const pName  = p => p==="X"?playerXName:playerOName;

  const statusMsg = useMemo(()=>{
    if (result?.winner==="draw") return "✦ It's a Draw! ✦";
    if (result?.winner) return `${pName(result.winner)} Wins! 🏆`;
    if (thinking) return `${playerOName} thinking…`;
    return `${pName(current)}'s Turn`;
  },[result,thinking,current,playerXName,playerOName]);

  // Animate status pill every time message changes
  useEffect(()=>{
    if (statusMsg!==prevStatus.current){ prevStatus.current=statusMsg; setStatusKey(k=>k+1); }
  },[statusMsg]);

  const statusColor = result
    ?(result.winner==="draw"?"#8888aa":result.winner==="X"?theme.x:theme.o)
    :current==="X"?theme.x:theme.o;

  const accuracy = useMemo(()=>
    result&&result.winner!=="draw" ? computeAccuracy(moveLog,boardSize) : null
  ,[result,moveLog,boardSize]);

  // FIX: keyboard always registered; handler decides what to do
  useKeyboard(useCallback((key)=>{
    if (key==="r"||key==="R") { handleReset(); return; }
    if (isOver) return;
    if (key==="z"||key==="Z") { undoMove(); return; }
    if (thinking) return;
    if (mode==="ai"&&current==="O") return;
    const cell = KEY_CELLS[key];
    if (cell!==undefined && boardSize===3) {
      setKeyFocus(cell);
      const ok = makeMove(cell);
      if (!ok) SFX.error(soundEnabled);
      setTimeout(()=>setKeyFocus(null),380);
    }
  },[isOver,thinking,mode,current,boardSize,soundEnabled,makeMove,undoMove,handleReset]));

  // Tool list: hint shown in both pvp and ai mode (only on human's turn)
  const toolList = [
    ["💡","Hint",    showHints,   ()=>setShowHints(h=>!h)],
    ["🔄","History", showHistory, ()=>setShowHistory(h=>!h)],
    ...(boardSize===3?[["🔥","Heatmap",showHeatmap,()=>setShowHeatmap(h=>!h)]]:[] ),
  ];

  const ToolBtn = ({icon,label,active,fn}) => (
    <button onClick={fn} style={{ display:"flex",alignItems:"center",gap:5,
      fontSize:".76rem",letterSpacing:".1em",padding:"7px 12px",borderRadius:8,
      cursor:"pointer",whiteSpace:"nowrap",
      background:active?`${theme.x}18`:"transparent",
      border:`1px solid ${active?theme.x:theme.border}`,
      color:active?theme.x:"#666680",transition:"all .15s" }}>
      {icon} {label}
    </button>
  );

  return (
    <div style={{ minHeight:"100vh", background:theme.bg, color:"#e8e8f0",
      display:"flex", flexDirection:"column" }}>

      {/* Confetti */}
      {particles.map(p=>(
        <div key={p.id} style={{ position:"fixed",top:-12,left:`${p.x}vw`,
          width:p.size,height:p.size,borderRadius:p.shape,background:p.color,
          zIndex:9999,pointerEvents:"none",
          animation:`fall ${p.dur}s ${p.delay}s ease-in forwards` }} />
      ))}

      {/* ── TOP NAV ── */}
      <nav className="top-nav" style={{ display:"flex", alignItems:"center",
        justifyContent:"space-between", padding:"12px 20px",
        background:theme.surface, borderBottom:`1px solid ${theme.border}`,
        gap:10, flexWrap:"wrap", flexShrink:0, animation:"slideInD .3s ease" }}>

        {/* <div style={{ display:"flex", gap:8 }}> */}
          {/* <Btn onClick={onBack}     variant="ghost"   theme={theme} sx={{padding:"8px 14px",fontSize:".8rem"}}>← Home</Btn>
          <Btn onClick={handleReset}variant="primary" color={theme.x} theme={theme} sx={{padding:"8px 14px",fontSize:".8rem"}}>↺ New</Btn>
          {canUndo && <Btn onClick={undoMove} variant="ghost" theme={theme} sx={{padding:"8px 14px",fontSize:".8rem"}} title="Undo (Z)">↩ Undo</Btn>} */}
          
        {/* </div> */}
        
        <div style={{ display:"flex", gap:8 }}>

          {/* <Btn onClick={onBack} variant="ghost" theme={theme}
            sx={{padding:"8px 14px",fontSize:".8rem"}}>
            ← Back
          </Btn> */}

          <Btn onClick={onBack} variant="ghost" theme={theme}
            sx={{padding:"8px 14px",fontSize:".8rem"}}>
            🏠 Home
          </Btn>

          <Btn onClick={handleReset} variant="primary" color={theme.x} theme={theme}
            sx={{padding:"8px 14px",fontSize:".8rem"}}>
            ↺ New
          </Btn>

          {canUndo && <Btn onClick={undoMove} variant="ghost" theme={theme}
            sx={{padding:"8px 14px",fontSize:".8rem"}} title="Undo (Z)">
            ↩ Undo
          </Btn>}

        </div>

        <div className="nav-center" style={{ display:"flex", gap:14, alignItems:"center" }}>
          <span style={{ fontSize:".7rem",color:theme.muted,letterSpacing:".16em" }}>{mode==="ai"?`vs AI · ${difficulty}`:"PvP"}</span>
          <span style={{ fontSize:".7rem",color:theme.muted,letterSpacing:".14em" }}>⏱ {fmtTime(elapsed)}</span>
          <span style={{ fontSize:".7rem",color:theme.muted,letterSpacing:".14em" }}>Move {moveLog.length}</span>
        </div>

        {/* Desktop tool buttons */}
        <div className="nav-tools" style={{ display:"flex", gap:6 }}>
          {toolList.map(([icon,label,active,fn])=><ToolBtn key={label} icon={icon} label={label} active={active} fn={fn}/>)}
        </div>
      </nav>

      {/* Mobile tool bar — shown via CSS at ≤680px */}
      <div className="mobile-bar" style={{ display:"none", gap:6, padding:"8px 14px",
        background:theme.surface, borderBottom:`1px solid ${theme.border}`,
        flexWrap:"wrap", flexShrink:0 }}>
        {toolList.map(([icon,label,active,fn])=><ToolBtn key={label} icon={icon} label={label} active={active} fn={fn}/>)}
        
        {/* {canUndo && (
          <button onClick={undoMove} style={{ display:"flex",alignItems:"center",gap:4,
            fontSize:".74rem",padding:"6px 11px",borderRadius:7,
            background:"transparent",border:`1px solid ${theme.border}`,color:"#666680" }}>↩ Undo</button>
        )} */}

      </div>

      {/* ── BODY ── */}
      <div className="game-body" style={{ flex:1, display:"flex", minHeight:0 }}>

        {/* ── CENTER ── */}
        <div style={{ flex:1, display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center",
          padding:"18px 16px", gap:14, minWidth:0, overflowY:"auto" }}>

          {/* Player cards */}
          <div className="player-strip" style={{ display:"flex", gap:10, width:"100%",
            maxWidth:boardSize===5?500:410 }}>
            {[["X",theme.x,playerXName,playerXAvatar,scoreX],
              ["O",theme.o,playerOName,playerOAvatar,scoreO]].map(([p,c,name,av,sc])=>{
              const active=current===p&&!isOver;
              return (
                <div key={p} className="player-card" style={{ flex:1,
                  display:"flex",alignItems:"center",gap:10,
                  background:active?`${c}10`:theme.surface,
                  border:`1.5px solid ${active?c:theme.border}`,
                  borderRadius:14,padding:"10px 13px",
                  transition:"background .3s,border-color .3s,box-shadow .3s",
                  boxShadow:active?`0 0 20px ${c}30`:"none",
                  animation:active?"cardFlash .4s ease":"none" }}>
                  <div style={{ width:38,height:38,borderRadius:11,flexShrink:0,
                    background:`${c}14`,border:`1.5px solid ${c}35`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:"1.3rem",
                    boxShadow:active?`0 0 10px ${c}40`:"none",
                    transition:"box-shadow .3s" }}>{av}</div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:".69rem",color:theme.muted,letterSpacing:".14em",
                      textTransform:"uppercase",marginBottom:1,
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                      {name}{mode==="ai"&&p==="O"?" (AI)":""}
                    </div>
                    <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                      <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:"1.7rem",
                        color:c,lineHeight:1 }}>{sc}</span>
                      {active&&!thinking&&<span style={{ fontSize:".58rem",color:c,
                        animation:"glow 1s ease infinite",letterSpacing:".2em" }}>● TURN</span>}
                      {active&&thinking&&<span style={{ display:"flex",gap:3,marginLeft:4 }}>
                        {[0,1,2].map(i=><div key={i} style={{ width:5,height:5,borderRadius:"50%",
                          background:c,animation:`bounce .55s ${i*.13}s ease infinite` }}/>)}
                      </span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Status pill — key causes re-mount on change = re-animation */}
          <div key={statusKey} style={{ fontFamily:"'DM Mono',monospace",
            fontSize:"clamp(.8rem,2.1vw,.96rem)",letterSpacing:".15em",textTransform:"uppercase",
            color:statusColor,background:`${statusColor}0e`,
            border:`1px solid ${statusColor}30`,borderRadius:30,
            padding:"8px 24px",textAlign:"center",whiteSpace:"nowrap",
            transition:"color .3s,background .3s,border-color .3s",
            animation:"statusPop .35s cubic-bezier(.175,.885,.32,1.275) forwards" }}>
            {statusMsg}
          </div>

          {/* Turn timer bar */}
          {turnTimer>0 && !isOver && (()=>{
            const pct=(turnLeft/turnTimer)*100;
            const tc=turnLeft<=3?"#ff2d6b":turnLeft<=7?theme.accent:theme.x;
            return (
              <div style={{ width:"100%",maxWidth:410 }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}>
                  <span style={{ fontSize:".69rem",color:theme.muted,letterSpacing:".2em" }}>TURN TIMER</span>
                  <span style={{ fontSize:".84rem",color:tc,fontWeight:600,
                    animation:turnLeft<=3?"timerWarn .45s ease infinite":"none" }}>{turnLeft}s</span>
                </div>
                <div style={{ height:5,background:theme.border,borderRadius:4,overflow:"hidden" }}>
                  <div style={{ height:"100%",borderRadius:4,background:tc,
                    width:`${pct}%`,transition:"width 1s linear",
                    boxShadow:`0 0 8px ${tc}77` }} />
                </div>
              </div>
            );
          })()}

          {/* Board — cells stagger in on mount */}
          <div style={{ background:theme.surface,border:`1px solid ${theme.border}`,
            borderRadius:boardSize===5?18:22,padding:boardSize===5?8:12,
            display:"grid",gridTemplateColumns:`repeat(${boardSize},1fr)`,
            gap:boardSize===5?6:10,
            boxShadow:`0 0 0 1px ${theme.border}88,0 28px 80px rgba(0,0,0,.65)`,
            maxWidth:"min(94vw,490px)",width:"100%",
            animation:"fadeUp .4s ease" }}>
            {squares.map((v,i)=>(
              <div key={i} style={{ animation:`fadeIn .25s ${i*0.025}s ease both` }}>
                <GameCell value={v}
                  isWinning={Boolean(result?.line?.includes(i))}
                  isNew={newCells.has(i)}
                  isHint={showHints && hintCell===i}
                  isKeyFocus={keyFocus===i}
                  current={current}
                  onClick={()=>{ if(!isOver&&!thinking&&!(mode==="ai"&&current==="O")) makeMove(i); }}
                  theme={theme} syms={syms}
                  disabled={isOver||thinking||(mode==="ai"&&current==="O")}
                  size={boardSize} />
              </div>
            ))}
          </div>

          {/* Keyboard legend — always visible when enabled */}
          {showKeyHints && (
            <div style={{ display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center" }}>
              {(boardSize===3
                ?[["1–9","Place"],["Z","Undo"],["R","New"]]
                :[["Z","Undo"],["R","New"]]
              ).map(([k,desc])=>(
                <div key={k} style={{ display:"flex",alignItems:"center",gap:5 }}>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:".82rem",
                    color:"#e8e8f0",background:"#1a1a28",border:`1px solid ${theme.border}`,
                    borderRadius:6,padding:"2px 8px",letterSpacing:".08em" }}>{k}</span>
                  <span style={{ fontSize:".68rem",color:theme.muted,letterSpacing:".1em" }}>{desc}</span>
                </div>
              ))}
            </div>
          )}

          {/* Result card */}
          {result && (
            <div style={{ display:"flex",gap:16,alignItems:"center",
              padding:"12px 22px",borderRadius:16,
              background:theme.surface,border:`1px solid ${theme.border}`,
              animation:"resultPop .5s cubic-bezier(.175,.885,.32,1.275) forwards",
              flexWrap:"wrap",justifyContent:"center" }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:".64rem",color:theme.muted,letterSpacing:".3em",
                  textTransform:"uppercase",marginBottom:3 }}>XP Earned</div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:"1.8rem",
                  color:theme.accent,lineHeight:1 }}>
                  +{result.winner==="X"?10:result.winner==="draw"?3:1}
                </div>
              </div>
              {accuracy!==null && (
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:".64rem",color:theme.muted,letterSpacing:".3em",
                    textTransform:"uppercase",marginBottom:3 }}>Accuracy</div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:"1.8rem",lineHeight:1,
                    color:accuracy>=70?theme.x:"#666680" }}>{accuracy}%</div>
                </div>
              )}
              <Btn onClick={handleReset} variant="primary" color={theme.x} theme={theme}
                sx={{padding:"9px 18px",fontSize:".8rem"}}>↺ Play Again</Btn>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        {(showHistory||showHeatmap) && (
          <div className="game-rp" style={{ width:210,flexShrink:0,
            background:theme.surface,borderLeft:`1px solid ${theme.border}`,
            display:"flex",flexDirection:"column",padding:"18px 14px",
            gap:18,overflowY:"auto",animation:"slideInR .3s ease" }}>

            {showHistory && (
              <div>
                <div style={{ fontSize:".7rem",letterSpacing:".28em",color:theme.muted,
                  textTransform:"uppercase",marginBottom:10 }}>⏪ Time Travel</div>
                <div className="hist-list" style={{ display:"flex",flexDirection:"column",gap:5 }}>
                  <button onClick={()=>travelTo(0)} style={{
                    background:histIdx===0?`${theme.accent}16`:"transparent",
                    border:`1px solid ${histIdx===0?theme.accent:theme.border}`,
                    borderRadius:8,padding:"7px 11px",cursor:"pointer",
                    color:histIdx===0?theme.accent:theme.muted,
                    fontFamily:"'DM Mono',monospace",fontSize:".76rem",
                    letterSpacing:".1em",textAlign:"left" }}>◈ Start</button>
                  {moveLog.map((m,i)=>(
                    <button key={i} onClick={()=>travelTo(i+1)} style={{
                      background:histIdx===i+1?(m.player==="X"?`${theme.x}16`:`${theme.o}16`):"transparent",
                      border:`1px solid ${histIdx===i+1?(m.player==="X"?theme.x:theme.o):theme.border}`,
                      borderRadius:8,padding:"7px 11px",cursor:"pointer",
                      color:m.player==="X"?theme.x:theme.o,
                      fontFamily:"'DM Mono',monospace",fontSize:".76rem",
                      letterSpacing:".08em",textAlign:"left",transition:"all .13s" }}>
                      #{m.move} {m.player==="X"?syms.x:syms.o} → {m.cell+1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showHeatmap && boardSize===3 && (
              <div>
                <div style={{ fontSize:".7rem",letterSpacing:".28em",color:theme.muted,
                  textTransform:"uppercase",marginBottom:10 }}>🔥 Cell Heatmap</div>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5 }}>
                  {profile.heatmap.map((count,i)=>{
                    const mx=Math.max(...profile.heatmap,1), pct=count/mx;
                    return (
                      <div key={i} style={{ height:50,borderRadius:8,
                        background:`rgba(${heatRGB(theme.x)},${.06+pct*.6})`,
                        border:`1px solid ${theme.border}`,
                        display:"flex",flexDirection:"column",
                        alignItems:"center",justifyContent:"center",gap:2 }}>
                        <div style={{ fontSize:".54rem",color:theme.muted }}>{HEAT_LABELS[i]}</div>
                        <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:"1.2rem",
                          color:pct>.3?"#e8e8f0":theme.muted,lineHeight:1 }}>{count||0}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop:8,fontSize:".63rem",color:theme.muted,
                  letterSpacing:".1em",textAlign:"center" }}>All-time cell frequency</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// § 14  STATS PAGE
// ════════════════════════════════════════════════════════════════════════════════

function StatsPage({ theme, profile, onBack, onReset }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const rank   = getRank(profile.xp);
  const next   = RANKS.find(r=>r.min>profile.xp);
  const total  = Math.max(profile.totalGames,1);
  const wr     = ((profile.totalWins/total)*100).toFixed(1);
  const lr     = ((profile.totalLosses/total)*100).toFixed(1);
  const dr     = ((profile.totalDraws/total)*100).toFixed(1);
  const xpPct  = next?Math.min(100,((profile.xp-rank.min)/(next.min-rank.min))*100):100;
  const barMax = Math.max(profile.totalWins,profile.totalLosses,profile.totalDraws,1);

  return (
    <div style={{ minHeight:"100vh", background:theme.bg, color:"#e8e8f0",
      display:"flex", flexDirection:"column", alignItems:"center",
      padding:"28px 16px 40px", gap:14, overflowY:"auto" }}>

      <div style={{ display:"flex", alignItems:"center", gap:14, width:"100%",
        maxWidth:640, animation:"fadeUp .4s ease" }}>
        <Btn onClick={onBack} variant="ghost" theme={theme} sx={{padding:"8px 14px"}}>← Back</Btn>
        <div>
          <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"2rem", letterSpacing:".22em" }}>Statistics</h2>
          <p style={{ fontSize:".73rem", color:theme.muted, letterSpacing:".2em" }}>Your performance overview</p>
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:12, width:"100%",
        maxWidth:640, animation:"fadeUp .4s .07s ease both" }}>

        {/* Rank */}
        <SectionCard theme={theme}>
          <div style={{ display:"flex",gap:18,alignItems:"center" }}>
            <div style={{ width:62,height:62,borderRadius:"50%",flexShrink:0,
              background:`linear-gradient(${theme.grad})`,display:"flex",
              alignItems:"center",justifyContent:"center",fontSize:"2rem",
              boxShadow:`0 0 22px ${theme.x}44`,animation:"pulse 3s ease infinite" }}>{rank.icon}</div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:6 }}>
                <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:"1.9rem",
                  color:rank.color,letterSpacing:".08em" }}>{rank.label}</span>
                <Badge color={rank.color}>{profile.xp} XP</Badge>
              </div>
              {next && <>
                <div style={{ fontSize:".73rem",color:theme.muted,marginBottom:6 }}>
                  {next.min-profile.xp} XP to {next.label} {next.icon}
                </div>
                <div style={{ height:5,background:"#0e0e18",borderRadius:4,overflow:"hidden" }}>
                  <div style={{ height:"100%",borderRadius:4,width:`${xpPct}%`,
                    background:`linear-gradient(90deg,${theme.x},${theme.o})`,
                    transition:"width 1.2s ease",boxShadow:`0 0 8px ${theme.x}55` }} />
                </div>
              </>}
            </div>
          </div>
        </SectionCard>

        {/* Key metrics */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:10 }}>
          {[
            ["Games",       profile.totalGames,      "#e8e8f0"    ],
            ["Win Rate",    `${profile.totalGames?wr:0}%`, theme.x],
            ["Best Streak", profile.maxStreak,        theme.accent, "wins in a row"],
            ["Accuracy",    `${profile.bestAccuracy}%`, profile.bestAccuracy>=70?theme.x:theme.muted],
          ].map(([label,value,color,sub])=>(
            <div key={label} style={{ background:theme.surface,border:`1px solid ${theme.border}`,
              borderRadius:14,padding:"16px",textAlign:"center",animation:"fadeUp .5s ease both" }}>
              <div style={{ fontSize:".68rem",color:theme.muted,letterSpacing:".28em",
                textTransform:"uppercase",marginBottom:5 }}>{label}</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:"2.2rem",
                color,lineHeight:1,marginBottom:3 }}>{value}</div>
              {sub && <div style={{ fontSize:".7rem",color:theme.muted }}>{sub}</div>}
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <SectionCard title="Win / Loss / Draw" theme={theme}>
          <div style={{ display:"flex",gap:10,alignItems:"flex-end",height:90,marginBottom:12 }}>
            {[["Wins",profile.totalWins,theme.x],["Losses",profile.totalLosses,theme.o],["Draws",profile.totalDraws,theme.muted]].map(([l,v,c])=>(
              <div key={l} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5 }}>
                <span style={{ fontSize:".72rem",color:c }}>{v}</span>
                <div style={{ width:"100%",borderRadius:"5px 5px 0 0",
                  height:`${Math.max(4,(v/barMax)*68)}px`,background:c,
                  boxShadow:`0 0 8px ${c}55`,animation:"barGrow .9s ease" }} />
                <span style={{ fontSize:".7rem",color:theme.muted,letterSpacing:".1em" }}>{l}</span>
              </div>
            ))}
          </div>
          <div style={{ display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap" }}>
            {[[`${profile.totalGames?wr:0}% W`,theme.x],[`${profile.totalGames?lr:0}% L`,theme.o],[`${profile.totalGames?dr:0}% D`,theme.muted]].map(([lbl,c])=>(
              <div key={lbl} style={{ display:"flex",alignItems:"center",gap:5,fontSize:".72rem",color:theme.muted }}>
                <div style={{ width:8,height:8,borderRadius:2,background:c }}/>{lbl}
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Heatmap */}
        {profile.heatmap.some(v=>v>0) && (
          <SectionCard title="Board Heatmap (All Time)" theme={theme}>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7,maxWidth:260,margin:"0 auto" }}>
              {profile.heatmap.map((count,i)=>{
                const pct=count/Math.max(...profile.heatmap,1);
                return (
                  <div key={i} style={{ height:60,borderRadius:10,
                    background:`rgba(${heatRGB(theme.x)},${.07+pct*.62})`,
                    border:`1px solid ${theme.border}`,display:"flex",flexDirection:"column",
                    alignItems:"center",justifyContent:"center",gap:3 }}>
                    <span style={{ fontSize:".68rem",color:theme.muted }}>{HEAT_LABELS[i]}</span>
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:"1.3rem",
                      color:pct>.35?"#e8e8f0":theme.muted,lineHeight:1 }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* Recent games */}
        {profile.gameHistory.length>0 && (
          <SectionCard title="Recent Games" theme={theme}>
            <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
              {profile.gameHistory.slice(0,15).map((g,i)=>{
                const c=g.winner==="X"?theme.x:g.winner==="draw"?theme.muted:theme.o;
                return (
                  <div key={i} style={{ display:"flex",gap:10,alignItems:"center",
                    padding:"7px 12px",borderRadius:9,background:"#0a0a14",
                    border:`1px solid ${theme.border}`,animation:`fadeIn .3s ${i*.03}s ease both` }}>
                    <div style={{ width:28,height:28,borderRadius:6,flexShrink:0,
                      background:`${c}14`,border:`1px solid ${c}44`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      color:c,fontFamily:"'Bebas Neue',sans-serif",fontSize:".9rem" }}>
                      {g.winner==="draw"?"—":g.winner}
                    </div>
                    <div style={{ flex:1,fontSize:".78rem",color:theme.muted,letterSpacing:".08em" }}>
                      {g.winner==="draw"?"Draw":`${g.winner} won`}
                      {" · "}{g.moveCount} moves
                      {g.mode==="ai"?` · AI ${g.difficulty}`:" · PvP"}
                      {g.accuracy>0?` · ${g.accuracy}% acc`:""}
                    </div>
                    <div style={{ fontSize:".68rem",color:"#333350",flexShrink:0 }}>{fmtDate(g.ts)}</div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* Danger zone */}
        <div style={{ background:theme.surface,border:"1px solid #ff2d6b1a",borderRadius:14,padding:"16px 20px" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap" }}>
            <div>
              <div style={{ fontSize:".8rem",color:"#888",letterSpacing:".1em",marginBottom:3 }}>Reset all statistics</div>
              <div style={{ fontSize:".72rem",color:theme.muted }}>This action cannot be undone</div>
            </div>
            {!confirmReset
              ? <Btn onClick={()=>setConfirmReset(true)} variant="danger" theme={theme} sx={{fontSize:".78rem"}}>Reset Data</Btn>
              : <div style={{ display:"flex",gap:8 }}>
                  <Btn onClick={()=>setConfirmReset(false)} variant="ghost" theme={theme} sx={{fontSize:".78rem"}}>Cancel</Btn>
                  <Btn onClick={()=>{ onReset(); setConfirmReset(false); }} variant="danger" theme={theme} sx={{fontSize:".78rem"}}>Confirm</Btn>
                </div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// § 15  AWARDS PAGE
// ════════════════════════════════════════════════════════════════════════════════

function AwardsPage({ theme, profile, onBack }) {
  const unlocked = new Set(profile.unlockedAchievements);
  const count = ACHIEVEMENTS.filter(a=>unlocked.has(a.id)).length;
  const pct   = Math.round((count/ACHIEVEMENTS.length)*100);

  return (
    <div style={{ minHeight:"100vh", background:theme.bg, color:"#e8e8f0",
      display:"flex", flexDirection:"column", alignItems:"center",
      padding:"28px 16px 40px", gap:14, overflowY:"auto" }}>

      <div style={{ display:"flex", alignItems:"center", gap:14, width:"100%",
        maxWidth:640, animation:"fadeUp .4s ease" }}>
        <Btn onClick={onBack} variant="ghost" theme={theme} sx={{padding:"8px 14px"}}>← Back</Btn>
        <div>
          <h2 style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:"2rem",letterSpacing:".22em" }}>Awards</h2>
          <p style={{ fontSize:".73rem",color:theme.muted,letterSpacing:".2em" }}>
            {count} / {ACHIEVEMENTS.length} unlocked · {pct}% complete
          </p>
        </div>
      </div>

      <div style={{ width:"100%",maxWidth:640,animation:"fadeUp .4s .06s ease both" }}>
        <div style={{ height:5,background:"#0e0e18",borderRadius:4,overflow:"hidden" }}>
          <div style={{ height:"100%",borderRadius:4,width:`${pct}%`,
            background:`linear-gradient(90deg,${theme.x},${theme.o})`,
            transition:"width 1.2s ease",boxShadow:`0 0 8px ${theme.x}44` }} />
        </div>
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",
        gap:11,width:"100%",maxWidth:640 }}>
        {ACHIEVEMENTS.map((ach,i)=>{
          const done=unlocked.has(ach.id);
          return (
            <div key={ach.id} style={{
              background:done?`${theme.accent}0c`:theme.surface,
              border:`1.5px solid ${done?theme.accent:theme.border}`,
              borderRadius:16,padding:"16px 18px",display:"flex",gap:14,alignItems:"center",
              boxShadow:done?`0 0 18px ${theme.accent}22`:"none",
              opacity:done?1:.5,filter:done?"none":"grayscale(.4)",
              transition:"all .25s",animation:`fadeUp .4s ${i*.04}s ease both` }}>
              <div style={{ width:48,height:48,borderRadius:12,flexShrink:0,
                background:done?`${theme.accent}18`:"#121220",
                border:`1.5px solid ${done?theme.accent:theme.border}`,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.7rem" }}>
                {done?ach.icon:"🔒"}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:3 }}>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:"1.05rem",
                    letterSpacing:".08em",color:done?theme.accent:"#444460" }}>{ach.title}</span>
                  {done && <Badge color={theme.accent}>+{ach.xp} XP</Badge>}
                </div>
                <div style={{ fontSize:".74rem",color:theme.muted,lineHeight:1.45 }}>{ach.desc}</div>
              </div>
              {done && <span style={{ color:theme.accent,fontSize:".9rem",flexShrink:0 }}>✓</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// § 16  ROOT APP
// ════════════════════════════════════════════════════════════════════════════════

export default function App() {
  // FIX 1: Restore page from localStorage on refresh
  const [page, setPage] = useState(()=>{
    const p = ls_raw_get(SK.page);
    return (p && Object.values(PAGES).includes(p)) ? p : PAGES.HOME;
  });

  const [settings, setSettings] = useState(()=>ls_get(SK.settings, BLANK_SETTINGS));
  const [profile,  dispatch]    = useReducer(profileReducer, undefined, ()=>ls_get(SK.profile, BLANK_PROFILE));
  const [toast,    setToast]    = useState(null);

  // FIX 2: Restore gameConfig from localStorage so game page works after refresh
  const [gameConfig, setGameConfig] = useState(()=>{
    try { const v=ls_raw_get(SK.game); return v ? {...BLANK_SETTINGS,...JSON.parse(v || "{}")} : null; }
    catch { return null; }
  });

  const theme = THEMES[settings.theme] ?? THEMES.void;

  // Persist everything
  useEffect(()=>ls_set(SK.profile,  profile),  [profile]);
  useEffect(()=>ls_set(SK.settings, settings), [settings]);
  useEffect(()=>ls_raw_set(SK.page, page),     [page]);
  useEffect(()=>{
    if (gameConfig) ls_raw_set(SK.game, JSON.stringify(gameConfig));
  },[gameConfig]);

  // Achievement checker
  const checked = useRef(new Set(profile.unlockedAchievements));
  useEffect(()=>{
    ACHIEVEMENTS.forEach(a=>{
      if (!checked.current.has(a.id) && a.check(profile)){
        checked.current.add(a.id);
        dispatch({ type:"UNLOCK", id:a.id });
        SFX.unlock(settings.soundEnabled);
        setToast(a);
      }
    });
  },[profile]);

  const navigate = useCallback(p=>{ SFX.click(settings.soundEnabled); setPage(p); },[settings.soundEnabled]);

  const handleStart = useCallback(cfg=>{
    const full = { ...BLANK_SETTINGS, ...cfg };
    setGameConfig(full);
    setSettings(prev=>({...prev,...full}));
    setPage(PAGES.GAME);
  },[]);

  // If page is GAME but we have no config, fall back to HOME
  const safePage = (page===PAGES.GAME && !gameConfig) ? PAGES.HOME : page;

  return (
    <>
      <style>{CSS}</style>

      {toast && <AchievementToast ach={toast} theme={theme} onDone={()=>setToast(null)} />}

      {safePage===PAGES.HOME && (
        <HomePage theme={theme} profile={profile} onNavigate={navigate} />
      )}
      {safePage===PAGES.SETUP && (
        <SetupPage theme={theme} settings={settings}
          onSave={cfg=>setSettings(prev=>({...prev,...cfg}))}
          onStart={handleStart}
          onBack={()=>navigate(PAGES.HOME)} />
      )}
      {safePage===PAGES.GAME && gameConfig && (
        <GamePage
          theme={THEMES[gameConfig.theme]??theme}
          settings={gameConfig}
          onBack={()=>{ navigate(PAGES.HOME); setGameConfig(null); ls_raw_set(SK.game,"null"); }}
          onProfileUpdate={action=>dispatch(action)}
          profile={profile} />
      )}
      {safePage===PAGES.STATS && (
        <StatsPage theme={theme} profile={profile}
          onBack={()=>navigate(PAGES.HOME)}
          onReset={()=>{ dispatch({type:"RESET_STATS"}); navigate(PAGES.HOME); }} />
      )}
      {safePage===PAGES.AWARDS && (
        <AwardsPage theme={theme} profile={profile} onBack={()=>navigate(PAGES.HOME)} />
      )}
    </>
  );
}
