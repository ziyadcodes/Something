export const SPIKE_CONSTANTS = {
  PLANT_DURATION: 4.0, // seconds
  DEFUSE_DURATION: 7.0, // seconds
  DEFUSE_HALFWAY_CHECKPOINT: 3.5, // halfway defuse save
  DETONATION_TIME: 45.0, // seconds
  DETONATION_RADIUS: 35.0, // lethal blast radius in world units
};

export type SpikeStatus =
  | 'unplanted'
  | 'planting'
  | 'planted'
  | 'defusing'
  | 'defused'
  | 'detonated';

export interface SpikeState {
  status: SpikeStatus;
  plantProgress: number; // 0.0 to 1.0
  defuseProgress: number; // 0.0 to 1.0
  timeRemaining: number; // seconds until detonation once planted
  hasHalfDefuseCheckpoint: boolean;
  position: { x: number; y: number; z: number } | null;
  site: 'A' | 'B' | null;
  planterName: string | null;
  defuserName: string | null;
}

export function createInitialSpikeState(): SpikeState {
  return {
    status: 'unplanted',
    plantProgress: 0,
    defuseProgress: 0,
    timeRemaining: SPIKE_CONSTANTS.DETONATION_TIME,
    hasHalfDefuseCheckpoint: false,
    position: null,
    site: null,
    planterName: null,
    defuserName: null,
  };
}

/**
 * Progresses plant action. Returns whether planting completed.
 */
export function updatePlantProgress(
  state: SpikeState,
  deltaSeconds: number,
  isHoldingPlantKey: boolean,
  planterName: string,
  site: 'A' | 'B',
  pos: { x: number; y: number; z: number }
): { state: SpikeState; justPlanted: boolean } {
  if (state.status === 'planted' || state.status === 'defused' || state.status === 'detonated') {
    return { state, justPlanted: false };
  }

  if (!isHoldingPlantKey) {
    // Cancelled planting
    return {
      state: {
        ...state,
        status: 'unplanted',
        plantProgress: 0,
      },
      justPlanted: false,
    };
  }

  const added = deltaSeconds / SPIKE_CONSTANTS.PLANT_DURATION;
  const newProgress = Math.min(1.0, state.plantProgress + added);

  if (newProgress >= 1.0) {
    return {
      state: {
        ...state,
        status: 'planted',
        plantProgress: 1.0,
        timeRemaining: SPIKE_CONSTANTS.DETONATION_TIME,
        position: pos,
        site,
        planterName,
      },
      justPlanted: true,
    };
  }

  return {
    state: {
      ...state,
      status: 'planting',
      plantProgress: newProgress,
      planterName,
      site,
      position: pos,
    },
    justPlanted: false,
  };
}

/**
 * Progresses defuse action. Supports half-defuse checkpoint.
 */
export function updateDefuseProgress(
  state: SpikeState,
  deltaSeconds: number,
  isHoldingDefuseKey: boolean,
  defuserName: string
): { state: SpikeState; justDefused: boolean } {
  if (state.status !== 'planted' && state.status !== 'defusing') {
    return { state, justDefused: false };
  }

  if (!isHoldingDefuseKey) {
    // Interrupted defuse - check if half-checkpoint was achieved
    const baseProgress = state.hasHalfDefuseCheckpoint ? 0.5 : 0;
    return {
      state: {
        ...state,
        status: 'planted',
        defuseProgress: baseProgress,
        defuserName: null,
      },
      justDefused: false,
    };
  }

  const added = deltaSeconds / SPIKE_CONSTANTS.DEFUSE_DURATION;
  const newProgress = Math.min(1.0, state.defuseProgress + added);
  const reachedHalf = newProgress >= 0.5 || state.hasHalfDefuseCheckpoint;

  if (newProgress >= 1.0) {
    return {
      state: {
        ...state,
        status: 'defused',
        defuseProgress: 1.0,
        hasHalfDefuseCheckpoint: true,
        defuserName,
      },
      justDefused: true,
    };
  }

  return {
    state: {
      ...state,
      status: 'defusing',
      defuseProgress: newProgress,
      hasHalfDefuseCheckpoint: reachedHalf,
      defuserName,
    },
    justDefused: false,
  };
}

/**
 * Updates detonation countdown for planted spike.
 */
export function tickSpikeTimer(
  state: SpikeState,
  deltaSeconds: number
): { state: SpikeState; justDetonated: boolean } {
  if (state.status !== 'planted' && state.status !== 'defusing') {
    return { state, justDetonated: false };
  }

  const newTimeRemaining = state.timeRemaining - deltaSeconds;
  if (newTimeRemaining <= 0) {
    return {
      state: {
        ...state,
        status: 'detonated',
        timeRemaining: 0,
      },
      justDetonated: true,
    };
  }

  return {
    state: {
      ...state,
      timeRemaining: newTimeRemaining,
    },
    justDetonated: false,
  };
}

/**
 * Computes spike audio beep frequency in Hz or interval between beeps in seconds.
 */
export function getSpikeBeepInterval(timeRemaining: number): number {
  if (timeRemaining > 20) return 1.0;
  if (timeRemaining > 10) return 0.5;
  if (timeRemaining > 5) return 0.25;
  return 0.12;
}
