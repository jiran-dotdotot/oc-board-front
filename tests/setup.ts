// Vitest global setup (referenced by vitest.config.ts -> setupFiles).
// Adds jest-dom matchers (toBeInTheDocument, etc.) to expect().
import '@testing-library/jest-dom/vitest'

// If you use MSW for API mocking, start/stop the server here, e.g.:
// import { server } from './mocks/server'
// beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
// afterEach(() => server.resetHandlers())
// afterAll(() => server.close())
