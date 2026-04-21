export const UX_BASELINE_OWNER_SCENARIOS = [
  { id: 'add-car', label: 'add-car', targetSeconds: 90, targetClicks: 14 },
  { id: 'record-service-note', label: 'record-service-note', targetSeconds: 45, targetClicks: 8 },
  { id: 'reply-to-driver-chat', label: 'reply-to-driver-chat', targetSeconds: 30, targetClicks: 6 },
  { id: 'open-critical-alert', label: 'open-critical-alert', targetSeconds: 20, targetClicks: 4 },
  { id: 'assign-driver', label: 'assign-driver', targetSeconds: 60, targetClicks: 10 },
]

export function summarizeUxBaseline(scenarios = UX_BASELINE_OWNER_SCENARIOS) {
  const totalClicks = scenarios.reduce((acc, item) => acc + item.targetClicks, 0)
  const totalSeconds = scenarios.reduce((acc, item) => acc + item.targetSeconds, 0)
  return {
    scenarios: scenarios.length,
    avgTargetClicks: scenarios.length ? Math.round(totalClicks / scenarios.length) : 0,
    avgTargetSeconds: scenarios.length ? Math.round(totalSeconds / scenarios.length) : 0,
  }
}
