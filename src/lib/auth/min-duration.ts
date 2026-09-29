// Answers no sooner than `ms` after the start (PROJ-1: 500 ms for login, signup and mail requests),
// so an unknown address cannot be told apart by a faster response. Holds for thrown errors and
// Next.js redirects too — they are re-thrown after the wait.
export const MIN_RESPONSE_MS = 500

export async function atLeast<T>(fn: () => Promise<T>, ms: number = MIN_RESPONSE_MS): Promise<T> {
  const started = Date.now()
  try {
    return await fn()
  } finally {
    const rest = ms - (Date.now() - started)
    if (rest > 0) await new Promise((resolve) => setTimeout(resolve, rest))
  }
}
