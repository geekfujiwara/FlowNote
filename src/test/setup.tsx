import '@testing-library/jest-dom'
import React from 'react'
import { vi } from 'vitest'

// Mock @xyflow/react (canvas components not needed in unit tests)
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children }: { children: React.ReactNode }) => children,
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => children,
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useReactFlow: () => ({
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitView: vi.fn(),
  }),
  addEdge: (edge: unknown, edges: unknown[]) => [...edges, edge],
  BackgroundVariant: { Dots: 'dots' },
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  Handle: () => null,
}))

// Mock @uiw/react-codemirror
vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (v: string) => void }) => (
    <textarea
      data-testid="codemirror"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}))

// Mock @codemirror/* extensions
vi.mock('@codemirror/lang-markdown', () => ({ markdown: () => ({}) }))
vi.mock('@codemirror/theme-one-dark', () => ({ oneDark: {} }))

// Mock @azure/msal-react
vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({ instance: {}, accounts: [] }),
  useIsAuthenticated: () => true,
  MsalProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock @microsoft/signalr
vi.mock('@microsoft/signalr', () => ({
  HubConnectionBuilder: vi.fn().mockReturnValue({
    withUrl: vi.fn().mockReturnThis(),
    withAutomaticReconnect: vi.fn().mockReturnThis(),
    configureLogging: vi.fn().mockReturnThis(),
    build: vi.fn().mockReturnValue({
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      onreconnecting: vi.fn(),
      onreconnected: vi.fn(),
      onclose: vi.fn(),
    }),
  }),
  LogLevel: { Warning: 1 },
}))

// Stub environment variables
vi.stubEnv('VITE_USE_MOCK_API', 'true')
vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:7071')
vi.stubEnv('VITE_MSAL_CLIENT_ID', 'test-client-id')
vi.stubEnv('VITE_MSAL_TENANT_ID', 'test-tenant-id')
vi.stubEnv('VITE_MSAL_REDIRECT_URI', 'http://localhost:3000')

// jsdom does not implement scrollIntoView – stub it globally
window.HTMLElement.prototype.scrollIntoView = vi.fn()

// Reset localStorage before each test
beforeEach(() => {
  localStorage.clear()
})
