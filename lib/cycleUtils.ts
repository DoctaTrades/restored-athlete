// ============================================================
// Cycle Phase Utilities
// ============================================================

export type CyclePhase = 1 | 2 | 3 | 4

export interface PhaseInfo {
  phase: CyclePhase
  label: string // W1-W4
  color: string
  dotColor: string
  badge: string
  trainingNote: string
  nutritionNote: string
  weightReliable: boolean
  carbModifier: number // multiplier on carb target e.g. 1.1 = +10%
}

export const PHASE_INFO: Record<CyclePhase, PhaseInfo> = {
  1: {
    phase: 1,
    label: 'W1',
    color: '#DC2626',
    dotColor: 'rgba(220,38,38,0.8)',
    badge: 'W1',
    trainingNote: 'Recovery priority week. Avoid maximal effort or PR attempts. Inflammation and fatigue may be elevated.',
    nutritionNote: 'Weight data this week may be inflated due to water retention. Slight carb increase can help manage prostaglandin-driven discomfort.',
    weightReliable: false,
    carbModifier: 1.05,
  },
  2: {
    phase: 2,
    label: 'W2',
    color: '#16A34A',
    dotColor: 'rgba(22,163,74,0.8)',
    badge: 'W2',
    trainingNote: 'Peak performance week. Estrogen is highest — pain tolerance, muscle recruitment, and motivation are all elevated. Best week for heavy training and PR attempts.',
    nutritionNote: 'Normal targets apply. Weight loss may be more efficient this week. Good time for a slight calorie deficit if cutting.',
    weightReliable: true,
    carbModifier: 1.0,
  },
  3: {
    phase: 3,
    label: 'W3',
    color: '#D97706',
    dotColor: 'rgba(217,119,6,0.8)',
    badge: 'W3',
    trainingNote: 'Progesterone rising. Moderate training week — performance slightly below peak. Monitor energy levels. Not ideal for PRs.',
    nutritionNote: 'Carb cravings may increase due to progesterone. A slight carb increase is appropriate. Core temperature is slightly elevated — stay hydrated.',
    weightReliable: true,
    carbModifier: 1.08,
  },
  4: {
    phase: 4,
    label: 'W4',
    color: '#16A34A',
    dotColor: 'rgba(22,163,74,0.7)',
    badge: 'W4',
    trainingNote: 'Late luteal phase. Strength is still good. Higher carb intake pre-workout helps counteract hormonal fatigue. Avoid interpreting low motivation as weakness — it\'s hormonal.',
    nutritionNote: 'Higher carbs recommended — this significantly helps performance and mood in this phase. Water retention may increase toward end of week.',
    weightReliable: false, // late W4 can show retention
    carbModifier: 1.12,
  },
}

export function getCurrentPhase(lastPeriodStart: Date, cycleLengthDays: number): PhaseInfo {
  const today = new Date()
  const daysSinceStart = Math.floor((today.getTime() - lastPeriodStart.getTime()) / (1000 * 60 * 60 * 24))
  const dayInCycle = ((daysSinceStart % cycleLengthDays) + cycleLengthDays) % cycleLengthDays + 1

  let phase: CyclePhase
  const phaseLength = cycleLengthDays / 4
  if (dayInCycle <= phaseLength) phase = 1
  else if (dayInCycle <= phaseLength * 2) phase = 2
  else if (dayInCycle <= phaseLength * 3) phase = 3
  else phase = 4

  return PHASE_INFO[phase]
}

export function getNextPhaseStart(lastPeriodStart: Date, cycleLengthDays: number): Date {
  const phase = getCurrentPhase(lastPeriodStart, cycleLengthDays)
  const today = new Date()
  const daysSinceStart = Math.floor((today.getTime() - lastPeriodStart.getTime()) / (1000 * 60 * 60 * 24))
  const dayInCycle = ((daysSinceStart % cycleLengthDays) + cycleLengthDays) % cycleLengthDays + 1
  const phaseLength = Math.floor(cycleLengthDays / 4)
  const daysRemaining = (phase.phase * phaseLength) - dayInCycle + 1
  const next = new Date(today)
  next.setDate(next.getDate() + daysRemaining)
  return next
}
