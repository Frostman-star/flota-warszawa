/**
 * @param {string} carId
 * @param {boolean} isAdmin
 */
export function carPath(carId, isAdmin) {
  return isAdmin ? `/flota/${carId}` : `/samochod/${carId}`
}
