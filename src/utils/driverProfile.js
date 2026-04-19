/**
 * @param {{ full_name?: string | null, phone?: string | null, experience_years?: number | null, bio?: string | null } | null | undefined} profile
 */
export function driverProfileProgressPercent(profile) {
  let p = 0
  if (String(profile?.full_name ?? '').trim()) p += 25
  if (String(profile?.phone ?? '').trim()) p += 25
  if (profile?.experience_years != null && !Number.isNaN(Number(profile.experience_years))) p += 25
  if (String(profile?.bio ?? '').trim()) p += 25
  return p
}

/**
 * @param {{ full_name?: string | null, phone?: string | null, experience_years?: number | null } | null | undefined} profile
 */
export function isDriverProfileCompleteForApply(profile) {
  return (
    String(profile?.full_name ?? '').trim().length > 0 &&
    String(profile?.phone ?? '').trim().length > 0 &&
    profile?.experience_years != null &&
    !Number.isNaN(Number(profile.experience_years))
  )
}
