import React from 'react';
import { Trophy, Skull, RotateCcw, Play, Home } from 'lucide-react';
import { TeamSide } from '../types/game';

interface StatusModalsProps {
  state: 'paused' | 'victory' | 'defeat' | null;
  playerTeam: TeamSide;
  attackersScore: number;
  defendersScore: number;
  kills: number;
  onResume: () => void;
  onRestart: () => void;
  onTitle: () => void;
}

export const StatusModals: React.FC<StatusModalsProps> = ({
  state,
  playerTeam,
  attackersScore,
  defendersScore,
  kills,
  onResume,
  onRestart,
  onTitle,
}) => {
  if (!state) return null;

  const isPlayerAttacker = playerTeam === 'attackers';
  const myScore = isPlayerAttacker ? attackersScore : defendersScore;
  const enemyScore = isPlayerAttacker ? defendersScore : attackersScore;

  if (state === 'paused') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 font-tech select-none">
        <div className="w-full max-w-md bg-slate-900 border border-slate-700 p-6 clip-val-card shadow-2xl text-center">
          <span className="font-valorant text-4xl font-bold tracking-widest text-white">
            MATCH PAUSED
          </span>
          <div className="flex justify-center items-center gap-4 my-6 bg-slate-950/80 p-3 rounded border border-slate-800">
            <div className="flex flex-col items-center">
              <span className="text-xs text-cyan-400 font-bold uppercase">YOUR TEAM</span>
              <span className="font-valorant text-4xl font-bold text-cyan-400 tabular-nums">
                {myScore}
              </span>
            </div>
            <span className="text-2xl text-slate-600 font-bold">-</span>
            <div className="flex flex-col items-center">
              <span className="text-xs text-red-400 font-bold uppercase">ENEMY TEAM</span>
              <span className="font-valorant text-4xl font-bold text-red-400 tabular-nums">
                {enemyScore}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={onResume}
              className="py-3 bg-red-600 hover:bg-red-500 text-white font-valorant text-2xl font-bold tracking-wider rounded cursor-pointer transition-colors shadow-lg"
            >
              RESUME PROTOCOL
            </button>
            <button
              onClick={onRestart}
              className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold uppercase rounded cursor-pointer transition-colors"
            >
              RESTART MATCH
            </button>
            <button
              onClick={onTitle}
              className="py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold uppercase rounded cursor-pointer transition-colors"
            >
              RETURN TO TITLE
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isVictory = state === 'victory';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 font-tech select-none">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 p-8 clip-val-card shadow-2xl text-center flex flex-col items-center">
        {/* Emblem */}
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
            isVictory
              ? 'bg-cyan-500/20 border-2 border-cyan-400 shadow-[0_0_30px_rgba(0,242,254,0.5)]'
              : 'bg-red-600/20 border-2 border-red-500 shadow-[0_0_30px_rgba(255,70,85,0.5)]'
          }`}
        >
          {isVictory ? (
            <Trophy className="w-10 h-10 text-cyan-400" />
          ) : (
            <Skull className="w-10 h-10 text-red-500" />
          )}
        </div>

        {/* Title */}
        <span
          className={`font-valorant text-5xl font-bold tracking-widest ${
            isVictory ? 'text-cyan-400' : 'text-red-500'
          }`}
        >
          {isVictory ? 'VICTORY' : 'DEFEAT'}
        </span>
        <span className="text-xs uppercase text-slate-400 tracking-widest mt-1 font-semibold">
          {isVictory ? 'PROTOCOL SECURED // RADIANT ASCENT' : 'PROTOCOL BREACHED // DEFEATED'}
        </span>

        {/* Final Score Tile */}
        <div className="grid grid-cols-3 gap-3 w-full my-6">
          <div className="bg-slate-950/80 p-3 rounded border border-slate-800">
            <span className="text-[10px] uppercase text-slate-400 font-bold block">
              FINAL SCORE
            </span>
            <span className="font-valorant text-3xl font-bold text-white tabular-nums">
              {myScore} - {enemyScore}
            </span>
          </div>

          <div className="bg-slate-950/80 p-3 rounded border border-slate-800">
            <span className="text-[10px] uppercase text-slate-400 font-bold block">
              YOUR ELIMINATIONS
            </span>
            <span className="font-valorant text-3xl font-bold text-amber-400 tabular-nums">
              {kills}
            </span>
          </div>

          <div className="bg-slate-950/80 p-3 rounded border border-slate-800">
            <span className="text-[10px] uppercase text-slate-400 font-bold block">
              COMBAT RATING
            </span>
            <span className="font-valorant text-3xl font-bold text-cyan-400 tabular-nums">
              {isVictory ? 'MVP' : 'HONORABLE'}
            </span>
          </div>
        </div>

        {/* CTAs with data-start="true" */}
        <div className="flex flex-col gap-3 w-full">
          <button
            data-start="true"
            onClick={onRestart}
            className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-valorant text-3xl font-bold tracking-widest rounded clip-val-corner cursor-pointer transition-colors flex items-center justify-center gap-2 shadow-lg"
          >
            <RotateCcw className="w-6 h-6" />
            <span>PLAY AGAIN</span>
          </button>
          <button
            onClick={onTitle}
            className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold uppercase rounded cursor-pointer transition-colors"
          >
            BACK TO AGENT SELECT
          </button>
        </div>
      </div>
    </div>
  );
};
