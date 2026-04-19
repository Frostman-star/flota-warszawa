/** @typedef {{ key: string, required: boolean }} VehicleAngleDef */

/** @type {readonly VehicleAngleDef[]} */
export const VEHICLE_PHOTO_REQUIRED = Object.freeze([
  { key: 'front_left', required: true },
  { key: 'rear_right', required: true },
  { key: 'interior_front', required: true },
  { key: 'interior_rear', required: true },
])

/** @type {readonly VehicleAngleDef[]} */
export const VEHICLE_PHOTO_OPTIONAL = Object.freeze([
  { key: 'dashboard', required: false },
  { key: 'trunk', required: false },
  { key: 'wheels', required: false },
  { key: 'sunroof', required: false },
  { key: 'detail', required: false },
])

/** Labels stored in DB (PL + UK) for auditing; UI uses i18n. */
export const VEHICLE_PHOTO_LABELS_DB = Object.freeze({
  front_left: { pl: 'Przód lewy', uk: 'Передній лівий кут' },
  rear_right: { pl: 'Tył prawy', uk: 'Задній правий кут' },
  interior_front: { pl: 'Wnętrze przód', uk: 'Салон спереду' },
  interior_rear: { pl: 'Wnętrze tył', uk: 'Салон ззаду' },
  dashboard: { pl: 'Deska rozdzielcza', uk: 'Торпедо/панель' },
  trunk: { pl: 'Bagażnik', uk: 'Багажник' },
  wheels: { pl: 'Felgi / Koła', uk: 'Диски/колеса' },
  sunroof: { pl: 'Szyberdach', uk: 'Люк' },
  detail: { pl: 'Detal / Inne', uk: 'Деталь / Інше' },
})

export const VEHICLE_REQUIRED_KEYS = new Set(VEHICLE_PHOTO_REQUIRED.map((a) => a.key))
