/**
 * @param {string} carId
 * @param {boolean} isAdmin
 */
export function carPath(carId, isAdmin) {
  return isAdmin ? `/pojazd/${carId}` : `/samochod/${carId}`
}
