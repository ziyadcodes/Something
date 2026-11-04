import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ValorantEngine, EngineHUDState, BenchmarkResult } from './game/engine';
import {
  AgentId,
  ChatMessage,
  CrosshairConfig,
  GameMode,
  GameSettings,
  KillfeedEntry,
  MapId,
  PlayerProfile,
  TeamSide,
  WeaponId,
} from './types/game';
import {
  loadCrosshairConfig,
  saveCrosshairConfig,
  loadGameSettings,
  saveGameSettings,
  loadPlayerProfile,
  savePlayerProfile,
  recordMatchCompletion,
  detectHardwareProfile,
} from './game/progression';
import {
  loadSavedRigState,
  saveRigState,
  OperatorRigBuild,
  SavedRigWorkshopState,
} from './game/rigSystem';
import { multiplayerClient } from './network/multiplayerClient';
import { HUD } from './components/HUD';
import { BuyMenu } from './components/BuyMenu';
import { TitleScreen } from './components/TitleScreen';
import { CrosshairSettings } from './components/CrosshairSettings';
import { StatusModals } from './components/StatusModals';
import { MobileControls } from './components/MobileControls';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ValorantEngine | null>(null);

  const [rigState, setRigState] = useState<SavedRigWorkshopState>(() => loadSavedRigState());
  const [appState, setAppState] = useState<'title' | 'playing' | 'paused' | 'gameover'>('title');
  const [selectedAgent, setSelectedAgent] = useState<AgentId>(() => rigState.activeBuild.chassisId || 'jett');
  const [selectedMode, setSelectedMode] = useState<GameMode>('standard');
  const [selectedMap, setSelectedMap] = useState<MapId>('industrial');
  const [playerTeam, setPlayerTeam] = useState<TeamSide>('attackers');
  const [isBuyMenuOpen, setIsBuyMenuOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [modalState, setModalState] = useState<'paused' | 'victory' | 'defeat' | null>(null);

  const [settings, setSettings] = useState<GameSettings>(() => loadGameSettings());
  const [profile, setProfile] = useState<PlayerProfile>(() => loadPlayerProfile());
  const [crosshair, setCrosshair] = useState<CrosshairConfig>(() => loadCrosshairConfig());
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);

  const [killfeed, setKillfeed] = useState<KillfeedEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => {
    const hw = detectHardwareProfile();
    return hw.isMobileDevice;
  });

  const [hudState, setHudState] = useState<EngineHUDState>({
    playerAgent: 'jett',
    gameMode: 'standard',
    mapId: 'industrial',
    health: 100,
    shield: 50,
    activeWeaponId: 'vandal',
    activeWeaponName: 'VANDAL',
    ammoInMag: 30,
    reserveAmmo: 75,
    isReloading: false,
    isScoped: false,
    isCrouching: false,
    isSprinting: false,
    isSlowed: false,
    credits: 3900,
    roundPhase: 'buy',
    phaseTimer: 6,
    attackersScore: 0,
    defendersScore: 0,
    playerTeam: 'attackers',
    spikeState: {
      status: 'unplanted',
      plantProgress: 0,
      defuseProgress: 0,
      timeRemaining: 45,
      hasHalfDefuseCheckpoint: false,
      position: null,
      site: null,
      planterName: null,
      defuserName: null,
    },
    isInsidePlantZone: false,
    plantZoneSite: null,
    flashAlpha: 0,
    damageVignette: 0,
    damageDirectionDeg: null,
    lastHitEvent: null,
    activeAbilityBuff: null,
    rangeChallenge: {
      active: false,
      kills: 0,
      targetKills: 30,
      elapsed: 0,
      bestTime: null,
      shotsFired: 0,
      shotsHit: 0,
    },
    killStreak: 0,
    playerKills: 0,
    playerDeaths: 0,
    playerHeadshots: 0,
    recentKillEvent: null,
    aliveAttackers: 5,
    aliveDefenders: 5,
    botRoster: [],
    scoreboard: [],
    playerPos: { x: 0, z: 35, yaw: 0 },
    abilityCharges: { c: 2, q: 2, e: 1, x: 1 },
    abilityCooldowns: { c: 0, q: 0, e: 0, x: 0 },
    ultPoints: 7,
    ultMax: 7,
    statusBanner: null,
    fps: 60,
    frameTimeMs: 16.6,
    renderWidth: 1280,
    renderHeight: 720,
    roomId: 'GLOBAL-1',
    isMultiplayerConnected: false,
    onlinePlayerCount: 1,
  });

  useEffect(() => {
    document.body.dataset.state = appState;
  }, [appState]);

  useEffect(() => {
    if (!canvasMountRef.current) return;

    const engine = new ValorantEngine(canvasMountRef.current, {
      onHUDUpdate: (newState) => {
        setHudState(newState);
      },
      onKillfeedAdd: (entry) => {
        setKillfeed((prev) => [...prev.slice(-6), entry]);
      },
      onMatchEnd: (winnerTeam) => {
        const isPlayerWinner = winnerTeam === engine.playerTeam;
        setModalState(isPlayerWinner ? 'victory' : 'defeat');
        setAppState('gameover');
        document.exitPointerLock?.();

        setProfile((prev) =>
          recordMatchCompletion(prev, {
            mode: engine.gameMode,
            mapId: engine.currentMapId,
            agent: selectedAgent,
            won: isPlayerWinner,
            score: `${engine.attackersScore}-${engine.defendersScore}`,
            kills: engine.playerKills,
            deaths: engine.playerDeaths,
            headshots: engine.playerHeadshots,
          })
        );
      },
      onChatReceive: (msg) => {
        setChatMessages((prev) => [...prev.slice(-24), msg]);
      },
    });

    engine.playerCallsign = profile.callsign;
    engine.applySettings(settings);
    engine.setRigBuild(rigState.activeBuild);
    engineRef.current = engine;

    // Connect to multiplayer room relay
    multiplayerClient.connect({
      roomId: 'GLOBAL-1',
      name: profile.callsign,
      agent: selectedAgent,
      team: playerTeam,
      mode: selectedMode,
      mapId: selectedMap,
      fillWithBots: true,
    });

    const handleResize = () => {
      if (canvasMountRef.current) {
        engine.resize(
          canvasMountRef.current.clientWidth,
          canvasMountRef.current.clientHeight
        );
      }
      setIsMobileViewport(
        'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 860
      );
    };
    window.addEventListener('resize', handleResize);

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.setAgent(selectedAgent);
      engine.gameMode = selectedMode;
      engine.start();
      setAppState('playing');
      document.body.dataset.state = 'playing';
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      multiplayerClient.disconnect();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not intercept keys if user is typing in an input field
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA')
      ) {
        return;
      }

      if (appState === 'title' && !isSettingsOpen && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        startGame();
        return;
      }

      if (appState === 'playing' && (e.key === 'b' || e.key === 'B')) {
        setIsBuyMenuOpen((prev) => {
          if (!prev) document.exitPointerLock?.();
          else engineRef.current?.requestPointerLock();
          return !prev;
        });
      }

      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (appState === 'playing') {
          if (isBuyMenuOpen) {
            setIsBuyMenuOpen(false);
            engineRef.current?.requestPointerLock();
          } else if (isSettingsOpen) {
            setIsSettingsOpen(false);
            engineRef.current?.requestPointerLock();
          } else {
            setAppState('paused');
            setModalState('paused');
            document.exitPointerLock?.();
          }
        } else if (appState === 'paused') {
          resumeGame();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appState, isBuyMenuOpen, isSettingsOpen]);

  const handleUpdateSettings = useCallback((next: GameSettings) => {
    setSettings(next);
    saveGameSettings(next);
    engineRef.current?.applySettings(next);
  }, []);

  const handleUpdateCrosshair = useCallback((next: CrosshairConfig) => {
    setCrosshair(next);
    saveCrosshairConfig(next);
  }, []);

  const handleUpdateProfile = useCallback((next: PlayerProfile) => {
    setProfile(next);
    savePlayerProfile(next);
    if (engineRef.current) {
      engineRef.current.playerCallsign = next.callsign;
    }
  }, []);

  const handleJoinMultiplayerRoom = useCallback(
    (roomId: string, mode: GameMode, mapId: MapId, fillWithBots: boolean) => {
      setSelectedMode(mode);
      setSelectedMap(mapId);
      engineRef.current?.setMap(mapId);
      multiplayerClient.joinRoom({
        roomId,
        name: profile.callsign,
        agent: selectedAgent,
        team: playerTeam,
        mode,
        mapId,
        fillWithBots,
      });
    },
    [profile.callsign, selectedAgent, playerTeam]
  );

  const handleUpdateRigBuild = useCallback((nextBuild: OperatorRigBuild) => {
    setRigState((prev) => {
      const updated = { ...prev, activeBuild: nextBuild };
      saveRigState(updated);
      return updated;
    });
    setSelectedAgent(nextBuild.chassisId);
    engineRef.current?.setRigBuild(nextBuild);
  }, []);

  const handleSaveRigPresets = useCallback((presets: OperatorRigBuild[]) => {
    setRigState((prev) => {
      const updated = { ...prev, savedPresets: presets };
      saveRigState(updated);
      return updated;
    });
  }, []);

  const startGame = useCallback(() => {
    if (!engineRef.current) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    engineRef.current.setMap(selectedMap);
    engineRef.current.setAgent(selectedAgent);
    engineRef.current.setRigBuild(rigState.activeBuild);
    engineRef.current.playerTeam = playerTeam;
    engineRef.current.gameMode = selectedMode;
    engineRef.current.applySettings(settings);
    engineRef.current.start();
    setAppState('playing');
    document.body.dataset.state = 'playing';
    setModalState(null);
    setKillfeed([]);
    engineRef.current.requestPointerLock();
  }, [selectedAgent, selectedMode, selectedMap, playerTeam, settings, rigState.activeBuild]);

  const resumeGame = useCallback(() => {
    setAppState('playing');
    setModalState(null);
    engineRef.current?.requestPointerLock();
  }, []);

  const restartGame = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.stop();
    startGame();
  }, [startGame]);

  const returnToTitle = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.stop();
    setAppState('title');
    setModalState(null);
    document.exitPointerLock?.();
  }, []);

  const handleBuyWeapon = (wId: WeaponId) => {
    engineRef.current?.purchaseWeapon(wId);
  };

  const handleBuyShield = (type: 'light' | 'heavy') => {
    engineRef.current?.purchaseShield(type);
  };

  const handleBuyAbility = (key: 'c' | 'q' | 'e') => {
    engineRef.current?.purchaseAbility(key);
  };

  const handleSendChat = useCallback(
    (text: string) => {
      multiplayerClient.sendChat(text);
      if (!multiplayerClient.isConnected) {
        setChatMessages((prev) => [
          ...prev.slice(-24),
          {
            id: `local_${Date.now()}`,
            senderId: 'local',
            senderName: profile.callsign,
            senderTeam: playerTeam,
            text,
            timestamp: Date.now(),
          },
        ]);
      }
    },
    [profile.callsign, playerTeam]
  );

  const showTouchControls =
    appState === 'playing' &&
    !isBuyMenuOpen &&
    !isSettingsOpen &&
    (settings.controlMode === 'touch' ||
      (settings.controlMode === 'auto' && isMobileViewport));

  const canPlantOrDefuse =
    (hudState.isInsidePlantZone &&
      hudState.playerTeam === 'attackers' &&
      hudState.spikeState.status === 'unplanted') ||
    (hudState.playerTeam === 'defenders' && hudState.spikeState.status === 'planted');

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* 3D WebGL Canvas Mount Container */}
      <div
        ref={canvasMountRef}
        className="w-full h-full cursor-crosshair"
        onClick={() => {
          if (
            appState === 'playing' &&
            !isBuyMenuOpen &&
            !isSettingsOpen &&
            !showTouchControls
          ) {
            engineRef.current?.requestPointerLock();
          }
        }}
      />

      {appState === 'title' && (
        <TitleScreen
          selectedAgent={selectedAgent}
          selectedMode={selectedMode}
          selectedMap={selectedMap}
          playerTeam={playerTeam}
          profile={profile}
          settings={settings}
          isMultiplayerConnected={hudState.isMultiplayerConnected}
          currentRoomId={hudState.roomId}
          activeRigBuild={rigState.activeBuild}
          savedRigPresets={rigState.savedPresets}
          onSelectAgent={(agent) => {
            setSelectedAgent(agent);
            engineRef.current?.setAgent(agent);
          }}
          onSelectMode={setSelectedMode}
          onSelectMap={(mId) => {
            setSelectedMap(mId);
            engineRef.current?.setMap(mId);
          }}
          onSelectTeam={(t) => {
            setPlayerTeam(t);
            if (engineRef.current) engineRef.current.playerTeam = t;
          }}
          onUpdateProfile={handleUpdateProfile}
          onUpdateSettings={handleUpdateSettings}
          onUpdateRigBuild={handleUpdateRigBuild}
          onSaveRigPresets={handleSaveRigPresets}
          onJoinMultiplayerRoom={handleJoinMultiplayerRoom}
          onStartGame={startGame}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {appState === 'playing' && (
        <HUD
          state={hudState}
          killfeed={killfeed}
          crosshair={crosshair}
          showFps={settings.showFps}
          chatMessages={chatMessages}
          onSendChat={handleSendChat}
          onUseAbility={(key) => engineRef.current?.triggerAbility(key)}
          onInspectWeapon={() => engineRef.current?.triggerWeaponInspect()}
          onOpenShop={() => {
            setIsBuyMenuOpen(true);
            document.exitPointerLock?.();
          }}
          onOpenSettings={() => {
            setIsSettingsOpen(true);
            document.exitPointerLock?.();
          }}
          onPauseGame={() => {
            setAppState('paused');
            setModalState('paused');
            document.exitPointerLock?.();
          }}
          onSkipBuyPhase={() => {
            engineRef.current?.skipBuyPhase();
            engineRef.current?.requestPointerLock();
          }}
        />
      )}

      {showTouchControls && (
        <MobileControls
          buttonScale={settings.touchButtonScale}
          joystickSens={settings.touchJoystickSens}
          isCrouching={hudState.isCrouching}
          isSprinting={hudState.isSprinting}
          isScoped={hudState.isScoped}
          canPlantOrDefuse={canPlantOrDefuse}
          activeSlot={
            hudState.activeWeaponId === 'knife'
              ? 'melee'
              : hudState.activeWeaponId === 'classic' ||
                hudState.activeWeaponId === 'ghost' ||
                hudState.activeWeaponId === 'sheriff'
              ? 'secondary'
              : 'primary'
          }
          secondaryWeaponId="classic"
          onMove={(x, y) => engineRef.current?.setMobileMove(x, y)}
          onLook={(dx, dy) => engineRef.current?.addMobileLook(dx, dy)}
          onFireChange={(down) => engineRef.current?.setMobileFire(down)}
          onToggleScope={() => engineRef.current?.toggleScope()}
          onJump={() => engineRef.current?.triggerJump()}
          onToggleCrouch={() => engineRef.current?.toggleCrouch()}
          onToggleSprint={() => engineRef.current?.toggleSprint()}
          onReload={() => engineRef.current?.triggerReload()}
          onInspect={() => engineRef.current?.triggerWeaponInspect()}
          onPlantDefuseChange={(held) => engineRef.current?.setPlantDefuseHeld(held)}
          onSwitchWeapon={(slot) => engineRef.current?.switchWeapon(slot)}
        />
      )}

      <BuyMenu
        isOpen={isBuyMenuOpen}
        credits={hudState.credits}
        currentShield={hudState.shield}
        activeWeaponId={hudState.activeWeaponId}
        selectedAgent={selectedAgent}
        rigBuild={hudState.rigBuild || rigState.activeBuild}
        onClose={() => {
          setIsBuyMenuOpen(false);
          engineRef.current?.requestPointerLock();
        }}
        onBuyWeapon={handleBuyWeapon}
        onBuyShield={handleBuyShield}
        onBuyAbility={handleBuyAbility}
      />

      <CrosshairSettings
        isOpen={isSettingsOpen}
        crosshair={crosshair}
        settings={settings}
        benchmarkResult={benchmarkResult}
        onClose={() => {
          setIsSettingsOpen(false);
          if (appState === 'playing') {
            engineRef.current?.requestPointerLock();
          }
        }}
        onUpdateCrosshair={handleUpdateCrosshair}
        onUpdateSettings={handleUpdateSettings}
        onRunBenchmark={() => {
          engineRef.current?.runBenchmark((res) => {
            setBenchmarkResult(res);
          });
        }}
      />

      <StatusModals
        state={modalState}
        playerTeam={hudState.playerTeam}
        attackersScore={hudState.attackersScore}
        defendersScore={hudState.defendersScore}
        kills={hudState.playerKills}
        onResume={resumeGame}
        onRestart={restartGame}
        onTitle={returnToTitle}
      />
    </div>
  );
}
