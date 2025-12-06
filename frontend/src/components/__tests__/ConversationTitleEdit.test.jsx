import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, it, expect } from 'vitest'
import userEvent from '@testing-library/user-event'
import ConversationTitleEdit from '../ConversationTitleEdit'

vi.mock('../../api', () => ({
  api: {
    updateConversationTitle: async () => ({ title: 'New Title' }),
  },
}))

const conversation = { id: 'c1', title: 'Old Title' }

it('validates and saves title', async () => {
  const user = userEvent.setup()
  const onSaved = vi.fn()
  render(<ConversationTitleEdit conversation={conversation} onSaved={onSaved} onCancel={() => {}} />)

  const input = screen.getByLabelText(/conversation title/i)
  await user.clear(input)
  await user.type(input, 'New Title')
  await user.click(screen.getByRole('button', { name: /save/i }))

  expect(onSaved).toHaveBeenCalled()
})

it('shows validation error for invalid title', async () => {
  const user = userEvent.setup()
  render(<ConversationTitleEdit conversation={conversation} onSaved={() => {}} onCancel={() => {}} />)
  const input = screen.getByLabelText(/conversation title/i)
  await user.clear(input)
  await user.type(input, '!')
  await user.click(screen.getByRole('button', { name: /save/i }))
  expect(screen.getByRole('alert')).toBeInTheDocument()
})