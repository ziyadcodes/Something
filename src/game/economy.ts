import { WeaponId } from '../types/game';
import { WEAPONS } from './weapons';

export const ECONOMY_CONSTANTS = {
  START_CREDITS: 800,
  MAX_CREDITS: 9000,
  KILL_REWARD: 200,
  SPIKE_PLANT_TEAM_REWARD: 300,
  ROUND_WIN_REWARD: 3000,
  ROUND_LOSS_BASE: 1900,
  ROUND_LOSS_STREAK_BONUS: 500,
  ROUND_LOSS_MAX: 2900,
  LIGHT_SHIELD_COST: 400,
  LIGHT_SHIELD_HP: 25,
  HEAVY_SHIELD_COST: 1000,
  HEAVY_SHIELD_HP: 50,
};

export interface PurchaseResult {
  success: boolean;
  newCredits: number;
  reason?: string;
}

export function calculateRoundEndCredits(
  isWinner: boolean,
  currentLossStreak: number
): { reward: number; nextLossStreak: number } {
  if (isWinner) {
    return {
      reward: ECONOMY_CONSTANTS.ROUND_WIN_REWARD,
      nextLossStreak: 0,
    };
  }

  // Loss streak bonus
  const streakBonus = currentLossStreak * ECONOMY_CONSTANTS.ROUND_LOSS_STREAK_BONUS;
  const reward = Math.min(
    ECONOMY_CONSTANTS.ROUND_LOSS_MAX,
    ECONOMY_CONSTANTS.ROUND_LOSS_BASE + streakBonus
  );

  return {
    reward,
    nextLossStreak: Math.min(3, currentLossStreak + 1),
  };
}

export function tryPurchaseWeapon(
  currentCredits: number,
  weaponId: WeaponId
): PurchaseResult {
  const weapon = WEAPONS[weaponId];
  if (!weapon) {
    return { success: false, newCredits: currentCredits, reason: 'Invalid weapon' };
  }

  if (currentCredits < weapon.cost) {
    return {
      success: false,
      newCredits: currentCredits,
      reason: `Insufficient credits. Need $${weapon.cost}`,
    };
  }

  return {
    success: true,
    newCredits: currentCredits - weapon.cost,
  };
}

export function tryPurchaseShield(
  currentCredits: number,
  currentShield: number,
  type: 'light' | 'heavy'
): { success: boolean; newCredits: number; newShield: number; reason?: string } {
  const cost =
    type === 'light'
      ? ECONOMY_CONSTANTS.LIGHT_SHIELD_COST
      : ECONOMY_CONSTANTS.HEAVY_SHIELD_COST;
  const targetShield =
    type === 'light'
      ? ECONOMY_CONSTANTS.LIGHT_SHIELD_HP
      : ECONOMY_CONSTANTS.HEAVY_SHIELD_HP;

  if (currentShield >= targetShield) {
    return {
      success: false,
      newCredits: currentCredits,
      newShield: currentShield,
      reason: 'Current shield is equal or stronger',
    };
  }

  if (currentCredits < cost) {
    return {
      success: false,
      newCredits: currentCredits,
      newShield: currentShield,
      reason: `Insufficient credits ($${cost} required)`,
    };
  }

  return {
    success: true,
    newCredits: currentCredits - cost,
    newShield: targetShield,
  };
}
