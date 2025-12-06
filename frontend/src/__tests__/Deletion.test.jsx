import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { it, expect, vi } from 'vitest'

vi.mock('../api', () => {
  const queue = []
  return {
    api: {
      listConversations: async () => ([
        { id: 'c1', title: 'One', created_at: '', message_count: 1 },
        { id: 'c2', title: 'Two', created_at: '', message_count: 2 },
      ]),
      getConversation: async () => ({ id: 'c1', messages: [] }),
      createConversation: async () => ({ id: 'c3', created_at: '' }),
      sendMessageStream: async () => {},
      deleteConversation: vi.fn(() => new Promise((resolve, reject) => {
        queue.push({ resolve, reject })
      })),
      __resolvers: queue,
    },
  }
})

import App from '../App.jsx'
import { api } from '../api'

it('optimistically removes item then confirms success', async () => {
  const user = userEvent.setup()
  render(<App />)
  // wait for conversations to render
  const itemButtons = await screen.findAllByRole('button', { name: /delete conversation/i })
  expect(itemButtons.length).toBe(2)

  await user.click(itemButtons[0])
  await user.click(screen.getByRole('button', { name: /^Delete$/i }))
  // wait for optimistic removal animation
  await new Promise((r) => setTimeout(r, 200))
  const afterDeleteButtons = screen.getAllByRole('button', { name: /delete conversation/i })
  expect(afterDeleteButtons.length).toBe(1)

  // resolve backend
  api.__resolvers.shift().resolve({ ok: true })
})

it('reverts UI on backend failure', async () => {
  const user = userEvent.setup()
  render(<App />)
  const itemButtons = await screen.findAllByRole('button', { name: /delete conversation/i })
  await user.click(itemButtons[0])
  await user.click(screen.getByRole('button', { name: /^Delete$/i }))

  // wait until delete call is issued
  await new Promise((r) => setTimeout(r, 200))
  api.__resolvers.shift().reject(new Error('Network'))
  // wait for revert
  await new Promise((r) => setTimeout(r, 50))

  const revertedButtons = await screen.findAllByRole('button', { name: /delete conversation/i })
  expect(revertedButtons.length).toBe(2)
})

it('handles rapid consecutive deletions', async () => {
  const user = userEvent.setup()
  render(<App />)
  const itemButtons = await screen.findAllByRole('button', { name: /delete conversation/i })
  await user.click(itemButtons[0])
  await user.click(screen.getByRole('button', { name: /^Delete$/i }))
  // delete second quickly
  await new Promise((r) => setTimeout(r, 200))
  const remainingBtn = screen.getAllByRole('button', { name: /delete conversation/i })
  await user.click(remainingBtn[0])
  await user.click(screen.getByRole('button', { name: /^Delete$/i }))
  await new Promise((r) => setTimeout(r, 200))
  expect(screen.queryAllByRole('button', { name: /delete conversation/i }).length).toBe(0)
})