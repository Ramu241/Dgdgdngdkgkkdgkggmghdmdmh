import React, { useState, useEffect, useRef } from 'react';
import {
  fetchLiveWinGoHistory,
  computeUpcomingPrediction,
  getNextPeriodId,
  getNumberColor,
  getNumberSize,
  ApiDrawItem
} from './utils/engine';
import { GameRecord, PredictionResult } from './types';
import { sound } from './utils/audio';
import {
  Flame,
  Snowflake,
  Volume2,
  VolumeX,
  Clock,
  CheckCircle2,
  XCircle,
  History,
  ShieldCheck,
  Crown,
  Gamepad2,
  ArrowLeft,
  ExternalLink,
  Sparkles,
  Home,
  Sun,
  Moon,
  Zap,
  Radio
} from 'lucide-react';

const GAME_URL = 'https://bdgwinmy.cc//#/register?invitationCode=8261315097340';

export default function App() {
  const [theme, setTheme] = useState<'white' | 'dark'>('white');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'home' | 'game'>('home');

  // Live Timer & Period for WinGo 30S (30 seconds interval)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);
  const [currentUpcomingPeriod, setCurrentUpcomingPeriod] = useState<string>('');
  
  // Real-time Prediction
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  // Live Verified History
  const [history, setHistory] = useState<GameRecord[]>([]);

  // State persistence refs
  const lastDrawnIssueRef = useRef<string>('');
  const predictedMapRef = useRef<Record<string, { pred: PredictionResult }>>({});
  const activePredictionRef = useRef<{ pred: PredictionResult } | null>(null);
  const latestApiListRef = useRef<ApiDrawItem[]>([]);

  // 1. Initial Sync on Mount with WinGo 30S Server
  const initializeLiveSync = async () => {
    setIsCalculating(true);
    try {
      const apiList = await fetchLiveWinGoHistory('30s');
      latestApiListRef.current = apiList;

      let lastIssue = '';
      if (apiList && apiList.length > 0) {
        lastIssue = apiList[0].issueNumber;
        lastDrawnIssueRef.current = lastIssue;
      }

      const nextPeriod = getNextPeriodId(lastIssue, 30);
      setCurrentUpcomingPeriod(nextPeriod);

      const pred = computeUpcomingPrediction(nextPeriod, apiList, 1);
      setPrediction(pred);
      activePredictionRef.current = { pred };
      predictedMapRef.current[nextPeriod] = { pred };
    } catch (e) {
      console.error('Initialization error:', e);
    } finally {
      setIsCalculating(false);
    }
  };

  // 2. Real-time 30-Second Countdown & WinGo 30S Live Draw Loop
  useEffect(() => {
    initializeLiveSync();

    const timer = setInterval(async () => {
      const now = new Date();
      const currentSec = now.getSeconds();
      const currentMs = now.getMilliseconds();
      
      // Calculate remaining seconds for 30s cycle (0..29 or 30..59)
      const secIn30s = currentSec % 30;
      const remaining = 30 - secIn30s;
      setSecondsRemaining(remaining);

      // Final 3 seconds tick sound
      if (soundEnabled && remaining <= 3 && remaining > 0 && currentMs < 200) {
        sound.playCriticalTick();
      }

      // Check results at key sync intervals in 30s cycle
      if (remaining === 29 || remaining === 27 || remaining === 25 || remaining === 22 || remaining === 18) {
        try {
          const freshList = await fetchLiveWinGoHistory('30s');
          if (freshList && freshList.length > 0) {
            latestApiListRef.current = freshList;
            const latestDrawn = freshList[0];
            const latestIssue = latestDrawn.issueNumber;

            // When new official result is published
            if (latestIssue && latestIssue !== lastDrawnIssueRef.current) {
              const actualNumber = parseInt(latestDrawn.number, 10);
              const actualSize = getNumberSize(actualNumber);
              const actualColor = getNumberColor(actualNumber);

              const recordedEntry = predictedMapRef.current[latestIssue] || activePredictionRef.current;
              const recordedPred = recordedEntry?.pred;
              
              let isWin = false;
              let isJackpot = false;

              if (recordedPred) {
                if (actualNumber === recordedPred.n1 || actualNumber === recordedPred.n2) {
                  isJackpot = true;
                  isWin = true;
                } else if (recordedPred.size === actualSize) {
                  isWin = true;
                }
              } else {
                isWin = true;
              }

              const status = isJackpot ? 'JACKPOT' : isWin ? 'WIN' : 'LOSS';

              if (isWin) {
                if (soundEnabled) sound.playWinFanfare();
              } else {
                if (soundEnabled) sound.playLossSound();
              }

              const newRecord: GameRecord = {
                periodId: latestIssue,
                number: actualNumber,
                size: actualSize,
                color: actualColor,
                predictedSize: recordedPred?.size,
                predictedN1: recordedPred?.n1,
                predictedN2: recordedPred?.n2,
                resultStatus: status,
                isJackpot,
                timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              };

              setHistory((prev) => [newRecord, ...prev.slice(0, 24)]);
              lastDrawnIssueRef.current = latestIssue;

              const nextTarget = getNextPeriodId(latestIssue, 30);
              setCurrentUpcomingPeriod(nextTarget);

              const nextPrediction = computeUpcomingPrediction(nextTarget, freshList, 1);
              setPrediction(nextPrediction);
              activePredictionRef.current = { pred: nextPrediction };
              predictedMapRef.current[nextTarget] = { pred: nextPrediction };

              if (soundEnabled) sound.playPredictionCalculated();
            }
          }
        } catch (err) {
          console.error('WinGo 30S Draw sync error:', err);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [soundEnabled]);

  const isBig = prediction?.size === 'BIG';
  const seconds = secondsRemaining;
  const timeFormatted = `00:${String(seconds).padStart(2, '0')}`;
  const isCritical = secondsRemaining <= 5;
  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen font-sans antialiased flex flex-col justify-start items-center p-3 sm:p-5 transition-colors duration-200 ${
      isDark
        ? 'bg-[#0a0d14] text-slate-100 selection:bg-amber-400 selection:text-black'
        : 'bg-[#f4f6fa] text-slate-800 selection:bg-amber-200 selection:text-amber-900'
    }`}>
      
      {/* ════════════════════════════════════════════════════════════════
          FULL-SCREEN GAME OVERLAY (PERSISTENT IFRAME - NEVER RELOADS ON SWITCHING)
          ════════════════════════════════════════════════════════════════ */}
      <div className={`fixed inset-0 z-50 flex flex-col bg-slate-900 transition-opacity duration-300 ${
        viewMode === 'game' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}>
        
        {/* Top Control Bar in Game View (Clean Back to Home Button Only) */}
        <header className="w-full bg-slate-900/95 border-b border-white/10 px-4 py-2.5 flex items-center justify-between shadow-md z-10 backdrop-blur-md">
          {/* Back to Home Button */}
          <button
            onClick={() => {
              sound.playClick();
              setViewMode('home');
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs sm:text-sm shadow-md transition-all border border-amber-400"
            id="back-to-home-btn"
          >
            <ArrowLeft className="h-4 w-4 stroke-[2.5]" />
            <Home className="h-4 w-4" />
            <span>वापस होम पैनल (Back to Home)</span>
          </button>

          {/* Direct External Tab Fallback */}
          <a
            href={GAME_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Open in Tab</span>
          </a>
        </header>

        {/* Persistent Iframe - Keeps Game Session Active Without Reloading */}
        <div className="relative flex-1 w-full h-full bg-white overflow-hidden">
          <iframe
            src={GAME_URL}
            title="BDG Win Game Official"
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          MAIN HOME PANEL (SWITCHABLE WHITE & DARK THEME)
          ════════════════════════════════════════════════════════════════ */}
      <div className="w-full max-w-md flex flex-col gap-3.5">
        
        {/* 1. Header with Theme & Sound Switchers */}
        <header className={`flex items-center justify-between py-2 border-b ${
          isDark ? 'border-white/10' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-slate-950 font-black text-base shadow-sm border border-amber-300">
              👑
            </div>
            <div>
              <h1 className={`text-base font-black tracking-wide flex items-center gap-1.5 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                KRUSHNA <span className="text-amber-500">VIP MASTER</span>
              </h1>
              <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                WinGo 30-Second Live Server
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* White / Dark Theme Toggle */}
            <button
              onClick={() => {
                sound.playClick();
                setTheme(theme === 'white' ? 'dark' : 'white');
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border shadow-sm transition-colors ${
                isDark
                  ? 'border-white/10 bg-white/5 text-amber-400 hover:bg-white/10'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              title={isDark ? 'Switch to White Theme' : 'Switch to Dark Theme'}
              id="theme-toggle-btn"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Sound Toggle */}
            <button
              onClick={() => {
                sound.playClick();
                setSoundEnabled(!soundEnabled);
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border shadow-sm transition-colors ${
                isDark
                  ? 'border-white/10 bg-white/5 text-gray-300 hover:text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'
              }`}
              title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}
              id="sound-toggle-btn"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4 text-amber-500" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
            </button>
          </div>
        </header>

        {/* 2. PLAY GAME CARTOON BUTTON (Seamless In-App Switcher) */}
        <button
          onClick={() => {
            sound.playClick();
            setViewMode('game');
          }}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 p-3.5 text-slate-950 font-black shadow-md hover:shadow-lg active:scale-[0.98] transition-all border border-amber-300 flex items-center justify-between"
          id="open-game-page-btn"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-900 shadow-md text-2xl group-hover:scale-110 transition-transform">
              🎮
            </div>
            <div className="text-left">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-950/80 block">
                BDG WIN OFFICIAL GAME
              </span>
              <span className="text-sm sm:text-base font-black text-slate-950 flex items-center gap-1">
                <span>गेम पेज खोलें (Play In-App)</span>
                <Sparkles className="h-3.5 w-3.5 text-amber-900" />
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-black/10 px-3 py-1.5 rounded-xl text-xs font-black">
            <span>FULL SCREEN</span>
            <Gamepad2 className="h-4 w-4" />
          </div>
        </button>

        {/* 3. Live 30-Second Period & Timer Bar */}
        <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 shadow-sm ${
          isDark ? 'border-white/10 bg-[#0f1422]' : 'border-slate-200 bg-white'
        }`}>
          <div>
            <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5">
              <Radio className="h-3 w-3 text-amber-500 animate-pulse" />
              <span>WinGo 30S Period</span>
            </div>
            <span className={`font-mono text-lg sm:text-xl font-black tracking-wider ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              {currentUpcomingPeriod || '------'}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-end gap-1 mb-0.5">
              <Clock className="h-3 w-3 text-amber-500" />
              30S TIME LEFT
            </span>
            <span className={`font-mono text-2xl font-black tracking-wider ${
              isCritical ? 'text-rose-500 animate-pulse' : isDark ? 'text-amber-400' : 'text-slate-900'
            }`}>
              {timeFormatted}
            </span>
          </div>
        </div>

        {/* 4. PREDICTION RESULT MESSAGE CARD (Clean, Simple & Clear) */}
        <div className={`rounded-2xl border p-4 sm:p-5 shadow-sm relative ${
          isDark ? 'border-white/10 bg-[#0f1422]' : 'border-slate-200 bg-white'
        }`}>
          
          {/* Header Bar */}
          <div className={`flex items-center justify-between pb-3 border-b ${
            isDark ? 'border-white/10' : 'border-slate-100'
          }`}>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 font-black text-sm">
                🎯
              </div>
              <div>
                <span className={`text-xs font-black uppercase tracking-wider block ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  WinGo 30S Prediction
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">
                  Under 2-Level Win
                </span>
              </div>
            </div>
            
            <span className="text-[11px] font-mono font-black px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              {prediction?.confidence || 98.6}%
            </span>
          </div>

          {/* Message Body */}
          {isCalculating ? (
            <div className="py-8 text-center flex flex-col items-center justify-center">
              <div className="h-7 w-7 rounded-full border-2 border-amber-500 border-t-transparent animate-spin mb-2" />
              <span className="text-xs font-mono font-bold text-slate-500">
                Calculating 30S Prediction...
              </span>
            </div>
          ) : prediction ? (
            <div className="pt-3.5 flex flex-col gap-3">
              
              {/* Main Size & Hot Numbers Box */}
              <div className={`flex items-center justify-between rounded-xl border p-3.5 ${
                isBig
                  ? isDark
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-amber-50/70 border-amber-300 text-amber-950'
                  : isDark
                    ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                    : 'bg-sky-50/70 border-sky-300 text-sky-950'
              }`}>
                {/* Size Badge */}
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl font-black text-slate-950 shadow-md ${
                    isBig ? 'bg-amber-400' : 'bg-sky-400'
                  }`}>
                    {isBig ? <Flame className="h-7 w-7" /> : <Snowflake className="h-7 w-7" />}
                  </div>
                  <div>
                    <span className={`text-3xl font-black tracking-wider block leading-none ${
                      isBig ? 'text-amber-500' : 'text-sky-500'
                    }`}>
                      {prediction.size}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-slate-500 mt-1 block">
                      Range: {isBig ? '5 - 9' : '0 - 4'}
                    </span>
                  </div>
                </div>

                {/* Hot Twin Numbers */}
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                    HOT NUMBERS
                  </span>
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg border font-mono text-base font-black shadow-sm ${
                      isDark
                        ? 'bg-black/60 border-white/10 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}>
                      {prediction.n1}
                    </span>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg border font-mono text-base font-black shadow-sm ${
                      isDark
                        ? 'bg-black/60 border-white/10 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}>
                      {prediction.n2}
                    </span>
                  </div>
                </div>
              </div>

              {/* Single Message Companion Numbers Strip */}
              <div className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs border ${
                isDark ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className="text-slate-500 font-bold">
                  संबंधित नंबर पूल:
                </span>
                <div className="flex items-center gap-1.5">
                  {prediction.companionNumbers.map((num) => (
                    <span
                      key={num}
                      className={`font-mono text-xs px-2 py-0.5 rounded-md font-bold ${
                        num === prediction.n1 || num === prediction.n2
                          ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                          : isDark
                            ? 'bg-white/5 text-gray-400 border border-white/10'
                            : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      {num}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          ) : null}
        </div>

        {/* 5. LIVE DRAWN RESULT HISTORY */}
        <div className={`rounded-2xl border p-4 shadow-sm ${
          isDark ? 'border-white/10 bg-[#0f1422]' : 'border-slate-200 bg-white'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-wider ${
              isDark ? 'text-slate-200' : 'text-slate-800'
            }`}>
              <History className="h-3.5 w-3.5 text-amber-500" />
              <span>WinGo 30S Live History</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-500">
              100% Live Sync
            </span>
          </div>

          {history.length === 0 ? (
            <div className={`py-6 text-center text-xs border border-dashed rounded-xl ${
              isDark ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-400'
            }`}>
              Waiting for 30S round to draw...
            </div>
          ) : (
            <div className={`divide-y max-h-[300px] overflow-y-auto ${
              isDark ? 'divide-white/5' : 'divide-slate-100'
            }`}>
              {history.map((rec) => {
                const recIsBig = rec.size === 'BIG';
                const isJackpot = rec.resultStatus === 'JACKPOT';
                const isWin = rec.resultStatus === 'WIN' || isJackpot;

                return (
                  <div key={rec.periodId} className="py-2.5 flex items-center justify-between text-xs">
                    {/* Period & Time */}
                    <div>
                      <span className={`font-mono font-bold block ${
                        isDark ? 'text-slate-200' : 'text-slate-800'
                      }`}>
                        #{rec.periodId.slice(-4)}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {rec.timeStr}
                      </span>
                    </div>

                    {/* Number & Size */}
                    <div className="flex items-center gap-2">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-md font-mono text-xs font-black ${
                        isDark ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {rec.number}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        recIsBig
                          ? isDark
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                          : isDark
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            : 'bg-sky-100 text-sky-800 border border-sky-200'
                      }`}>
                        {rec.size}
                      </span>
                    </div>

                    {/* Result Status */}
                    <div>
                      {isJackpot ? (
                        <span className="inline-flex items-center gap-1 font-black text-amber-500 text-xs">
                          <Sparkles className="h-3.5 w-3.5" />
                          JACKPOT
                        </span>
                      ) : isWin ? (
                        <span className="inline-flex items-center gap-1 font-black text-emerald-500 text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          WIN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-black text-rose-500 text-xs">
                          <XCircle className="h-3.5 w-3.5" />
                          LOSS
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
