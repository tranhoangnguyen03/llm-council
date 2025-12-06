import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, it, expect } from 'vitest'
import userEvent from '@testing-library/user-event'
import Sidebar from '../Sidebar'

const conversations = [
  { id: 'a', title: 'A', created_at: '', message_count: 1 },
  { id: 'b', title: 'B', created_at: '', message_count: 2 },
]

it('renders conversations and allows selection', async () => {
  const user = userEvent.setup()
  const onSelectConversation = vi.fn()
  render(
    <Sidebar
      conversations={conversations}
      currentConversationId={null}
      onSelectConversation={onSelectConversation}
      onNewConversation={() => {}}
    />
  )

  const items = screen.getAllByRole('option')
  await user.click(items[0])
  expect(onSelectConversation).toHaveBeenCalled()
})