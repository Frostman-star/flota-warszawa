/**
 * @typedef {{ pendingApps: number; pendingEmployment: number; chatAttention: number; chatFirstAppId: string | null }} CarAttention
 */

/**
 * Builds normalized attention map by car id from RPC rows.
 * @param {Array<string>} carIds
 * @param {Array<any>} rows
 * @returns {Record<string, CarAttention>}
 */
export function buildAttentionMap(carIds, rows) {
  /** @type {Record<string, CarAttention>} */
  const map = {}
  for (const id of carIds) {
    map[String(id)] = { pendingApps: 0, pendingEmployment: 0, chatAttention: 0, chatFirstAppId: null }
  }
  for (const row of rows ?? []) {
    const id = String(row.car_id)
    map[id] = {
      pendingApps: Number(row.pending_apps ?? 0),
      pendingEmployment: Number(row.pending_employment ?? 0),
      chatAttention: Number(row.chat_attention ?? 0),
      chatFirstAppId: row.chat_first_app_id != null ? String(row.chat_first_app_id) : null,
    }
  }
  return map
}

/**
 * Sums chat attention count from owner_fleet_car_attention_counts RPC rows.
 * @param {Array<any>} rows
 * @returns {number}
 */
export function sumChatAttention(rows) {
  return (rows ?? []).reduce((acc, row) => acc + Number(row.chat_attention ?? 0), 0)
}
