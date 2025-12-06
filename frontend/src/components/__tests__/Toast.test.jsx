import React from 'react'
import { render, screen } from '@testing-library/react'
import { it, expect } from 'vitest'
import Toast from '../Toast'

it('renders toast with message and role status', () => {
  render(<Toast message="Saved" type="success" onDismiss={() => {}} />)
  expect(screen.getByRole('status')).toBeInTheDocument()
  expect(screen.getByText('Saved')).toBeInTheDocument()
})