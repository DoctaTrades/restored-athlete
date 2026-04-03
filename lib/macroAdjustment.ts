// ============================================================
// Macro Adjustment Engine
// ============================================================

export interface WeeklyWeightData {
  weekStart: string
  average: number
  readings: number
  phase?: number // cycle phase if tracked
}

export interface AdjustmentResult {
  shouldSuggest: boolean
  reason: string
  direction: 'increase' | 'decrease' | 'none'
  calorieChange: number
  explanation: string
  actualRatePct: number | null
  targetRatePct: number | null
  isRedFlag: boolean
  redFlagMessage?: string
}

// Build weekly averages from weigh-in log
export function buildWeeklyAverages(
  weighIns: { weight_kg: number; logged_at: string }[],
  excludeUnreliablePhases: boolean = false,
  phaseData?: { logged_at: string; phase: number }[]
): WeeklyWeightData[] {
  if (!weighIns.length) return []

  const byWeek: Record<string, number[]> = {}

  weighIns.forEach(w => {
    const date = new Date(w.logged_at + 'T12:00:00')
    // Get Monday of that week
    const day = date.getDay()
    const monday = new Date(date)
    monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
    const weekKey = monday.toISOString().split('T')[0]

    // Skip unreliable phase data if cycle tracking enabled
    if (excludeUnreliablePhases && phaseData) {
      const phaseEntry = phaseData.find(p => p.logged_at === w.logged_at)
      if (phaseEntry && (phaseEntry.phase === 1)) return // Skip W1 (most unreliable)
    }

    if (!byWeek[weekKey]) byWeek[weekKey] = []
    byWeek[weekKey].push(w.weight_kg)
  })

  return Object.entries(byWeek)
    .map(([weekStart, weights]) => ({
      weekStart,
      average: Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 100) / 100,
      readings: weights.length,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .filter(w => w.readings >= 1) // at least 1 reading per week
}

export function analyzeWeightTrend(
  weeklyData: WeeklyWeightData[],
  goal: string,
  targetRatePct: number | null,
  currentCalories: number,
  athleteBodyweight: number
): AdjustmentResult {

  const noSuggestion: AdjustmentResult = {
    shouldSuggest: false, reason: '', direction: 'none',
    calorieChange: 0, explanation: '', actualRatePct: null,
    targetRatePct: null, isRedFlag: false
  }

  // Need at least 3 weeks of data for meaningful analysis
  if (weeklyData.length < 3) return noSuggestion

  // Use last 3 weeks for rolling average (smooths out single-week anomalies)
  const recent = weeklyData.slice(-3)
  const older = weeklyData.slice(-6, -3)
  if (!older.length) return noSuggestion

  const recentAvg = recent.reduce((s, w) => s + w.average, 0) / recent.length
  const olderAvg = older.reduce((s, w) => s + w.average, 0) / older.length

  const weeklyChange = recentAvg - olderAvg // kg change over ~3 weeks
  const weeklyChangePerWeek = weeklyChange / 3 // average per week
  const changePctPerWeek = (weeklyChangePerWeek / olderAvg) * 100
  const actualRatePct = Math.round(changePctPerWeek * 100) / 100

  // Check red flag — losing too fast
  const absChangePct = Math.abs(actualRatePct)
  if (absChangePct > 1.5 && weeklyChange < 0) {
    const safeDate = getSafeCutDate(athleteBodyweight, olderAvg, recentAvg, 1.0)
    return {
      shouldSuggest: true,
      reason: `You're losing weight at ${absChangePct.toFixed(2)}% BW/week — above the 1.5% maximum safe rate.`,
      direction: 'increase',
      calorieChange: 300,
      explanation: `This rate of loss risks muscle mass and performance. We recommend increasing calories by ~300 kcal (primarily carbs) and extending your timeline.${safeDate ? ` A safer goal date would be around ${safeDate}.` : ''}`,
      actualRatePct, targetRatePct,
      isRedFlag: true,
      redFlagMessage: `⚠️ Weight loss rate is too aggressive. This risks muscle loss and will hurt your lifts.`
    }
  }

  if (goal === 'cut' || goal === 'comp_prep') {
    const target = targetRatePct || 0.75
    const tolerance = 0.3 // ±0.3% BW/week tolerance over 3-week average

    if (actualRatePct < -(target + tolerance)) {
      // Losing too fast (but under red flag)
      return {
        shouldSuggest: true,
        reason: `You're losing ${Math.abs(actualRatePct).toFixed(2)}% BW/week vs your target of ${target}%.`,
        direction: 'increase',
        calorieChange: 200,
        explanation: `Your 3-week average shows you're losing faster than planned. Adding ~200 kcal (from carbs) will protect muscle and performance while keeping you on track.`,
        actualRatePct, targetRatePct: target, isRedFlag: false
      }
    }

    if (actualRatePct > -(target - tolerance) && weeklyChange > -0.1) {
      // Not losing enough (2+ weeks stall)
      return {
        shouldSuggest: true,
        reason: `Your 3-week average shows minimal weight loss (${actualRatePct.toFixed(2)}% vs target ${target}%).`,
        direction: 'decrease',
        calorieChange: -200,
        explanation: `Progress has stalled. Reducing by ~200 kcal (from carbs and fat) should restart progress toward your goal.`,
        actualRatePct, targetRatePct: target, isRedFlag: false
      }
    }
  }

  if (goal === 'bulk') {
    const target = targetRatePct || 0.2
    const tolerance = 0.15

    if (actualRatePct > target + tolerance) {
      return {
        shouldSuggest: true,
        reason: `You're gaining ${actualRatePct.toFixed(2)}% BW/week — faster than your target of ${target}%.`,
        direction: 'decrease',
        calorieChange: -150,
        explanation: `Gaining too fast increases excess fat accumulation. Reducing by ~150 kcal will slow the rate to a leaner bulk.`,
        actualRatePct, targetRatePct: target, isRedFlag: false
      }
    }

    if (actualRatePct < target - tolerance && weeklyChange < 0.05) {
      return {
        shouldSuggest: true,
        reason: `You're gaining ${actualRatePct.toFixed(2)}% BW/week — below your target of ${target}%.`,
        direction: 'increase',
        calorieChange: 150,
        explanation: `Progress is slower than planned. Adding ~150 kcal will help drive muscle growth at your target rate.`,
        actualRatePct, targetRatePct: target, isRedFlag: false
      }
    }
  }

  if (goal === 'recomp') {
    // Maintenance window: ±1.5% total BW over 4-week average
    const allWeeks = weeklyData.slice(-4)
    if (allWeeks.length < 4) return noSuggestion
    const fourWeekAvg = allWeeks.reduce((s, w) => s + w.average, 0) / allWeeks.length
    const driftPct = ((fourWeekAvg - athleteBodyweight) / athleteBodyweight) * 100

    if (driftPct > 1.5) {
      return {
        shouldSuggest: true,
        reason: `4-week average weight is ${driftPct.toFixed(1)}% above your baseline — outside the ±1.5% maintenance window.`,
        direction: 'decrease',
        calorieChange: -150,
        explanation: `A slight reduction of ~150 kcal will bring your weight trend back into the maintenance range.`,
        actualRatePct, targetRatePct: 0, isRedFlag: false
      }
    }

    if (driftPct < -1.5) {
      return {
        shouldSuggest: true,
        reason: `4-week average weight is ${Math.abs(driftPct).toFixed(1)}% below your baseline — outside the ±1.5% maintenance window.`,
        direction: 'increase',
        calorieChange: 150,
        explanation: `A slight increase of ~150 kcal will bring your weight trend back into the maintenance range.`,
        actualRatePct, targetRatePct: 0, isRedFlag: false
      }
    }
  }

  return noSuggestion
}

function getSafeCutDate(currentBW: number, startWeight: number, currentWeight: number, safeRatePct: number): string | null {
  const remaining = currentWeight - (startWeight * 0.85) // assume 15% loss as end goal
  if (remaining >= 0) return null
  const weeksNeeded = Math.abs(remaining) / (currentBW * safeRatePct / 100)
  const safeDate = new Date()
  safeDate.setDate(safeDate.getDate() + Math.ceil(weeksNeeded * 7))
  return safeDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function applyCalorieAdjustment(
  currentCalories: number,
  currentProtein: number,
  currentCarbs: number,
  currentFat: number,
  calorieChange: number
): { calories: number; protein_g: number; carbs_g: number; fat_g: number } {
  // Apply change primarily to carbs, keep protein constant
  const newCalories = Math.max(1200, currentCalories + calorieChange)
  const actualChange = newCalories - currentCalories
  const carbChange = Math.round(actualChange * 0.7 / 4) // 70% of change from carbs
  const fatChange = Math.round(actualChange * 0.3 / 9) // 30% from fat

  return {
    calories: newCalories,
    protein_g: currentProtein, // never change protein
    carbs_g: Math.max(50, currentCarbs + carbChange),
    fat_g: Math.max(20, currentFat + fatChange),
  }
}
