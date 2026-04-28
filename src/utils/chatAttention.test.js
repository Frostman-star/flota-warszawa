import { describe, expect, it } from 'vitest'
import { buildAttentionMap, sumChatAttention } from './chatAttention'

describe('chat attention helpers', () => {
  it('builds default map for all car ids', () => {
    const map = buildAttentionMap(['car-a', 'car-b'], [])
    expect(map['car-a']).toEqual({
      pendingApps: 0,
      pendingEmployment: 0,
      chatAttention: 0,
      chatFirstAppId: null,
    })
    expect(map['car-b']).toEqual({
      pendingApps: 0,
      pendingEmployment: 0,
      chatAttention: 0,
      chatFirstAppId: null,
    })
  })

  it('maps rpc values and keeps chat first app id', () => {
    const map = buildAttentionMap(['car-a'], [
      {
        car_id: 'car-a',
        pending_apps: 2,
        pending_employment: 1,
        chat_attention: 3,
        chat_first_app_id: 'app-1',
      },
    ])
    expect(map['car-a']).toEqual({
      pendingApps: 2,
      pendingEmployment: 1,
      chatAttention: 3,
      chatFirstAppId: 'app-1',
    })
  })

  it('sums chat attention rows safely', () => {
    expect(sumChatAttention([{ chat_attention: 2 }, { chat_attention: '3' }, {}])).toBe(5)
  })
})
