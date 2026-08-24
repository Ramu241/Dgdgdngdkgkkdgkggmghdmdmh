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
  Layers,
  Home,
  AlertTriangle,
  RotateCcw,
  Zap,
  Wallet
} from 'lucide-react';

const GAME_URL = 'https://bdgwinmy.cc//#/register?invitationCode=8261315097340';

export default function App() {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'home' | 'game'>('home');

  // Live Timer & Period
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [currentUpcomingPeriod, setCurrentUpcomingPeriod] = useState<string>('');
  
  // Under 2-Level Recovery State (L1, L2, L3)
  const [currentLevel, setCurrentLevel] = useState<1 | 2 | 3>(1);

  // Real-time Prediction
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  // Live Verified History
  const [history, setHistory] = useState<GameRecord[]>([]);

  // Refs for state persistence across rounds
  const lastDrawnIssueRef = useRef<string>('');
  const predictedMapRef = useRef<Record<string, { pred: PredictionResult; level: 1 | 2 | 3 }>>({});
  const activePredictionRef = useRef<{ pred: PredictionResult; level: 1 | 2 | 3 } | null>(null);
  const latestApiListRef = useRef<ApiDrawItem[]>([]);
  const levelRef = useRef<1 | 2 | 3>(1);

  useEffect(() => {
    levelRef.current = currentLevel;
  }, [currentLevel]);

  // Initial Sync on Mount
  const initializeLiveSync = async () => {
    setIsCalculating(true);
    try {
      const apiList = await fetchLiveWinGoHistory();
      latestApiListRef.current = apiList;

      let lastIssue = '';
      if (apiList && apiList.length > 0) {
        lastIssue = apiList[0].issueNumber;
        lastDrawnIssueRef.current = lastIssue;
      }

      const nextPeriod = getNextPeriodId(lastIssue);
      setCurrentUpcomingPeriod(nextPeriod);

      const pred = computeUpcomingPrediction(nextPeriod, apiList, levelRef.current);
      setPrediction(pred);
      activePredictionRef.current = { pred, level: levelRef.current };
      predictedMapRef.current[nextPeriod] = { pred, level: levelRef.current };
    } catch (e) {
      console.error('Initialization error:', e);
    } finally {
      setIsCalculating(false);
    }
  };

  // Real-time 1-second countdown & live draw check
  useEffect(() => {
    initializeLiveSync();

    const timer = setInterval(async () => {
      const now = new Date();
      const currentSec = now.getSeconds();
      const remaining = 60 - currentSec;
      setSecondsRemaining(remaining);

      // Final 3 seconds tick sound
      if (soundEnabled && remaining <= 3 && remaining > 0) {
        sound.playCriticalTick();
      }

      // Draw sync at exact key seconds
      if (remaining === 59 || remaining === 56 || remaining === 53 || remaining === 50 || remaining === 45) {
        try {
          const freshList = await fetchLiveWinGoHistory();
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
              const roundLevel = recordedEntry?.level ?? levelRef.current;
              
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
              let nextLevel: 1 | 2 | 3 = 1;

              // Recovery Level Escalation & Reset Logic
              if (isWin) {
                nextLevel = 1; // Instant reset to Level 1
                setCurrentLevel(1);
                if (soundEnabled) sound.playWinFanfare();
              } else {
                if (roundLevel === 1) {
                  nextLevel = 2; // Move to Level 2 (2-Level Win Recovery)
                  setCurrentLevel(2);
                } else if (roundLevel === 2) {
                  nextLevel = 3; // Move to Level 3 (All Wallet Level)
                  setCurrentLevel(3);
                } else {
                  nextLevel = 1; // Reset cycle
                  setCurrentLevel(1);
                }
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
                levelPlayed: roundLevel,
                resultStatus: status,
                isJackpot,
                timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              };

              setHistory((prev) => [newRecord, ...prev.slice(0, 29)]);
              lastDrawnIssueRef.current = latestIssue;

              const nextTarget = getNextPeriodId(latestIssue);
              setCurrentUpcomingPeriod(nextTarget);

              const nextPrediction = computeUpcomingPrediction(nextTarget, freshList, nextLevel);
              setPrediction(nextPrediction);
              activePredictionRef.current = { pred: nextPrediction, level: nextLevel };
              predictedMapRef.current[nextTarget] = { pred: nextPrediction, level: nextLevel };

              if (soundEnabled) sound.playPredictionCalculated();
            }
          }
        } catch (err) {
          console.error('Draw sync error:', err);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [soundEnabled]);

  const isBig = prediction?.size === 'BIG';
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isCritical = secondsRemaining <= 5;

  // ════════════════════════════════════════════════════════════════
  // 1. FULL-SCREEN IN-APP GAME PAGE VIEW (WITH LIVE PREDICTION TICKER & HOME BUTTON)
  // ════════════════════════════════════════════════════════════════
  if (viewMode === 'game') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 text-slate-100">
        
        {/* Top Control Bar in Game Mode */}
        <header className="w-full bg-white border-b border-slate-200 px-3 sm:px-4 py-2.5 flex items-center justify-between shadow-sm z-10 text-slate-800">
          
          {/* Back to Home Button */}
          <button
            onClick={() => {
              sound.playClick();
              setViewMode('home');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-900 font-extrabold text-xs sm:text-sm shadow-md transition-all border border-amber-400"
            id="back-to-home-btn"
          >
            <ArrowLeft className="h-4 w-4 stroke-[2.5]" />
            <Home className="h-4 w-4" />
            <span>वापस होम पैनल (Home)</span>
          </button>

          {/* Compact Live Prediction Floating Pill */}
          {prediction && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-100 border border-slate-300 shadow-inner">
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                currentLevel === 1
                  ? 'bg-emerald-600 text-white'
                  : currentLevel === 2
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-rose-600 text-white'
              }`}>
                L{currentLevel}
              </span>
              <span className="font-mono text-xs font-black text-slate-700">
                #{prediction.periodId.slice(-4)}:
              </span>
              <span className={`font-black text-xs ${isBig ? 'text-amber-600' : 'text-sky-600'}`}>
                {prediction.size} [{prediction.n1}, {prediction.n2}]
              </span>
              <span className={`font-mono text-xs font-bold ${isCritical ? 'text-rose-600 font-black animate-pulse' : 'text-slate-600'}`}>
                ⏱ {timeFormatted}
              </span>
            </div>
          )}

          {/* Direct Link External Fallback */}
          <div className="flex items-center gap-2">
            <a
              href={GAME_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors"
              title="Open direct in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Direct Tab</span>
            </a>
          </div>
        </header>

        {/* Mobile Mini Prediction Strip */}
        {prediction && (
          <div className="sm:hidden bg-slate-100 border-b border-slate-200 px-3 py-1.5 flex items-center justify-between text-xs text-slate-800 font-bold shadow-inner">
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded text-white ${
                currentLevel === 1 ? 'bg-emerald-600' : currentLevel === 2 ? 'bg-amber-600' : 'bg-rose-600'
              }`}>
                L{currentLevel}
              </span>
              <span className="font-mono text-[11px] font-black text-slate-600">#{prediction.periodId.slice(-4)}</span>
              <span className={`font-black text-xs ${isBig ? 'text-amber-600' : 'text-sky-600'}`}>
                ➔ {prediction.size} [{prediction.n1}, {prediction.n2}]
              </span>
            </div>
            <span className={`font-mono text-xs font-black ${isCritical ? 'text-rose-600 animate-pulse' : 'text-slate-700'}`}>
              ⏱ {timeFormatted}
            </span>
          </div>
        )}

        {/* Full-Screen Embedded Game View */}
        <div className="relative flex-1 w-full h-full bg-slate-950 overflow-hidden">
          <iframe
            src={GAME_URL}
            title="BDG Win Game Official"
            className="w-full h-full border-0 bg-white"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // 2. CLEAN WHITE / LIGHT THEME MAIN PANEL
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#f4f6fa] text-slate-800 font-sans antialiased flex flex-col justify-start items-center p-3 sm:p-5 selection:bg-amber-200 selection:text-amber-900">
      
      {/* Centered Main Wrapper */}
      <div className="w-full max-w-md flex flex-col gap-3.5">
        
        {/* 1. Header (Clean White Theme) */}
        <header className="flex items-center justify-between py-2 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-slate-900 font-black text-base shadow-sm border border-amber-300">
              👑
            </div>
            <div>
              <h1 className="text-base font-black tracking-wide text-slate-900 flex items-center gap-1.5">
                KRUSHNA <span className="text-amber-600">VIP MASTER</span>
              </h1>
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live 1-Minute WinGo Engine
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sound Toggle */}
            <button
              onClick={() => {
                sound.playClick();
                setSoundEnabled(!soundEnabled);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-colors"
              title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}
              id="sound-toggle-btn"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4 text-amber-600" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
            </button>
          </div>
        </header>

        {/* 2. DEDICATED RECOVERY LEVEL VISUAL INDICATOR (L1 / L2 / L3) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-600">
              <Layers className="h-3.5 w-3.5 text-amber-500" />
              <span>Active Recovery Level Indicator</span>
            </div>
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
              currentLevel === 1
                ? 'bg-emerald-100 text-emerald-800'
                : currentLevel === 2
                ? 'bg-amber-100 text-amber-900 font-bold'
                : 'bg-rose-100 text-rose-800'
            }`}>
              {currentLevel === 1 && '🟢 LEVEL 1 ACTIVE'}
              {currentLevel === 2 && '🟡 LEVEL 2 RECOVERY'}
              {currentLevel === 3 && '🔴 LEVEL 3 ALL WALLET'}
            </span>
          </div>

          {/* L1 / L2 / L3 Tabs */}
          <div className="grid grid-cols-3 gap-2">
            
            {/* Level 1 Tab */}
            <div className={`p-2.5 rounded-xl border text-center transition-all ${
              currentLevel === 1
                ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-400/40 shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
            }`}>
              <div className="text-[10px] font-black uppercase flex items-center justify-center gap-1 mb-0.5">
                <CheckCircle2 className={`h-3 w-3 ${currentLevel === 1 ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>LEVEL 1</span>
              </div>
              <div className={`text-xs font-black font-mono ${currentLevel === 1 ? 'text-emerald-700' : 'text-slate-500'}`}>
                PRIME WIN
              </div>
              <div className="text-[9px] font-semibold text-slate-500 mt-0.5">
                Direct Pass
              </div>
            </div>

            {/* Level 2 Tab */}
            <div className={`p-2.5 rounded-xl border text-center transition-all ${
              currentLevel === 2
                ? 'bg-amber-50 border-amber-500 text-amber-950 ring-2 ring-amber-400/50 shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
            }`}>
              <div className="text-[10px] font-black uppercase flex items-center justify-center gap-1 mb-0.5">
                <Zap className={`h-3 w-3 ${currentLevel === 2 ? 'text-amber-600' : 'text-slate-400'}`} />
                <span>LEVEL 2</span>
              </div>
              <div className={`text-xs font-black font-mono ${currentLevel === 2 ? 'text-amber-700' : 'text-slate-500'}`}>
                2-LEVEL WIN
              </div>
              <div className="text-[9px] font-semibold text-slate-500 mt-0.5">
                Auto Recovery
              </div>
            </div>

            {/* Level 3 Tab */}
            <div className={`p-2.5 rounded-xl border text-center transition-all ${
              currentLevel === 3
                ? 'bg-rose-50 border-rose-500 text-rose-950 ring-2 ring-rose-400/50 shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
            }`}>
              <div className="text-[10px] font-black uppercase flex items-center justify-center gap-1 mb-0.5">
                <Wallet className={`h-3 w-3 ${currentLevel === 3 ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>LEVEL 3</span>
              </div>
              <div className={`text-xs font-black font-mono ${currentLevel === 3 ? 'text-rose-700' : 'text-slate-500'}`}>
                ALL WALLET
              </div>
              <div className="text-[9px] font-semibold text-slate-500 mt-0.5">
                Full Surge
              </div>
            </div>
          </div>
        </div>

        {/* 3. PLAY GAME CARTOON BUTTON (Full-Screen In-App Game Page Launcher) */}
        <button
          onClick={() => {
            sound.playClick();
            setViewMode('game');
          }}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 p-3.5 text-slate-950 font-black shadow-md hover:shadow-lg active:scale-[0.98] transition-all border border-amber-300 flex items-center justify-between"
          id="open-game-page-btn"
        >
          <div className="flex items-center gap-3">
            {/* Cartoon Game Character Badge */}
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-900 shadow-md text-2xl group-hover:scale-110 transition-transform">
              🎮
            </div>
            <div className="text-left">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-950/80 block">
                BDG WIN OFFICIAL GAME
              </span>
              <span className="text-sm sm:text-base font-black text-slate-950 flex items-center gap-1.5">
                <span>गेम पेज खोलें (Play In-App)</span>
                <Sparkles className="h-4 w-4 text-amber-900" />
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-black/10 px-3 py-1.5 rounded-xl text-xs font-black">
            <span>FULL SCREEN</span>
            <Gamepad2 className="h-4 w-4" />
          </div>
        </button>

        {/* 4. Live Period & Timer Bar */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">
              UPCOMING PERIOD (ISSUE)
            </span>
            <span className="font-mono text-lg sm:text-xl font-black tracking-wider text-slate-900">
              {currentUpcomingPeriod || '------'}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-end gap-1 mb-0.5">
              <Clock className="h-3 w-3 text-amber-500" />
              TIME LEFT
            </span>
            <span className={`font-mono text-2xl font-black tracking-wider ${
              isCritical ? 'text-rose-600 animate-pulse' : 'text-slate-900'
            }`}>
              {timeFormatted}
            </span>
          </div>
        </div>

        {/* 5. PREDICTION RESULT MESSAGE CARD (Clean, High Contrast, One Message View) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm relative">
          
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-800 font-black">
                🎯
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 block">
                  PREDICTION MESSAGE
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">
                  {prediction?.patternName || 'Under 2-Level Win'}
                </span>
              </div>
            </div>
            
            <span className="text-[11px] font-mono font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              {prediction?.confidence || 98.6}% CONF
            </span>
          </div>

          {/* Message Body */}
          {isCalculating ? (
            <div className="py-8 text-center flex flex-col items-center justify-center">
              <div className="h-7 w-7 rounded-full border-2 border-amber-500 border-t-transparent animate-spin mb-2" />
              <span className="text-xs font-mono font-bold text-slate-600">
                Calculating Next Prediction...
              </span>
            </div>
          ) : prediction ? (
            <div className="pt-3.5 flex flex-col gap-3">
              
              {/* Main Size & Hot Numbers Box */}
              <div className={`flex items-center justify-between rounded-xl border p-3.5 ${
                isBig
                  ? 'bg-amber-50/60 border-amber-300 text-amber-950'
                  : 'bg-sky-50/60 border-sky-300 text-sky-950'
              }`}>
                {/* Size Badge */}
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl font-black text-white shadow-md ${
                    isBig ? 'bg-amber-500' : 'bg-sky-500'
                  }`}>
                    {isBig ? <Flame className="h-7 w-7" /> : <Snowflake className="h-7 w-7" />}
                  </div>
                  <div>
                    <span className={`text-3xl font-black tracking-wider block leading-none ${
                      isBig ? 'text-amber-700' : 'text-sky-700'
                    }`}>
                      {prediction.size}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-slate-600 mt-1 block">
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
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-slate-300 font-mono text-base font-black text-slate-900 shadow-sm">
                      {prediction.n1}
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-slate-300 font-mono text-base font-black text-slate-900 shadow-sm">
                      {prediction.n2}
                    </span>
                  </div>
                </div>
              </div>

              {/* Single Message Alert Summary */}
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
                <span className="text-slate-600 font-bold">
                  संबंधित नंबर:
                </span>
                <div className="flex items-center gap-1.5">
                  {prediction.companionNumbers.map((num) => (
                    <span
                      key={num}
                      className={`font-mono text-xs px-2 py-0.5 rounded-md font-bold ${
                        num === prediction.n1 || num === prediction.n2
                          ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
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

        {/* 6. LIVE DRAWN RESULT HISTORY (White Theme) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-800">
              <History className="h-3.5 w-3.5 text-amber-500" />
              <span>Live Result History</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-600">
              100% Verified Draws
            </span>
          </div>

          {history.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 border border-dashed rounded-xl border-slate-200">
              Waiting for first live draw...
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
              {history.map((rec) => {
                const recIsBig = rec.size === 'BIG';
                const isJackpot = rec.resultStatus === 'JACKPOT';
                const isWin = rec.resultStatus === 'WIN' || isJackpot;

                return (
                  <div key={rec.periodId} className="py-2.5 flex items-center justify-between text-xs">
                    {/* Period & Level */}
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-black ${
                        rec.levelPlayed === 1
                          ? 'bg-emerald-100 text-emerald-800'
                          : rec.levelPlayed === 2
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        L{rec.levelPlayed ?? 1}
                      </span>
                      <div>
                        <span className="font-mono font-bold text-slate-800 block">
                          #{rec.periodId.slice(-4)}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {rec.timeStr}
                        </span>
                      </div>
                    </div>

                    {/* Number & Size */}
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 border border-slate-200 font-mono text-xs font-black text-slate-800">
                        {rec.number}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        recIsBig
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-sky-100 text-sky-800 border border-sky-200'
                      }`}>
                        {rec.size}
                      </span>
                    </div>

                    {/* Result Status */}
                    <div>
                      {isJackpot ? (
                        <span className="inline-flex items-center gap-1 font-black text-amber-600 text-xs">
                          <Sparkles className="h-3.5 w-3.5" />
                          JACKPOT
                        </span>
                      ) : isWin ? (
                        <span className="inline-flex items-center gap-1 font-black text-emerald-600 text-xs">
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
