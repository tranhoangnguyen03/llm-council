import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, it, expect } from 'vitest'
import userEvent from '@testing-library/user-event'
import ConfirmDialog from '../ConfirmDialog'

it('confirm and cancel actions work and are accessible', async () => {
  const user = userEvent.setup()
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmDialog open={true} title="Delete?" description="Confirm" onConfirm={onConfirm} onCancel={onCancel} />
  )

  expect(screen.getByRole('dialog')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /delete/i }))
  expect(onConfirm).toHaveBeenCalled()
})