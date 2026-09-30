// Translates a database refusal (Supabase / PostgREST error) into what the app does next — PROJ-2
// tasks.md → Feste Namen; design.md → Datenmodell, Fangzeit-Garantie. Never throws: anything that is
// not one of the known rules becomes `unknown`, which the actions treat like any other failure.

export type DbError =
  /** 23505 on `sessions_one_running_per_user` — a session is already running (AC-9, EC-1). */
  | { kind: 'running-exists' }
  /** 23P01 on `sessions_no_overlap` — the times overlap another own session (AC-16). */
  | { kind: 'overlap' }
  /** Raised `catch_outside_session` — a catch time falls outside its session (AC-18, AC-24, EC-4, EC-9). */
  | { kind: 'catch-outside' }
  /** 23503 on `catches_session_owner_fkey` — the session is gone (or not the user's) (EC-5). */
  | { kind: 'session-gone' }
  /** 23505 on a primary key — this id exists already (repeat of a create, EC-2). */
  | { kind: 'duplicate-id' }
  | { kind: 'unknown' }

export type DbErrorKind = DbError['kind']

/** The fields of a PostgREST error the mapping looks at; everything is optional. */
export interface DbErrorLike {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
}

function text(error: DbErrorLike): string {
  return [error.message, error.details, error.hint].filter((part) => typeof part === 'string').join(' ')
}

function mentions(haystack: string, name: string): boolean {
  return new RegExp(`\\b${name}\\b`).test(haystack)
}

export function mapDbError(error: unknown): DbError {
  if (!error || typeof error !== 'object') return { kind: 'unknown' }
  const e = error as DbErrorLike
  const code = typeof e.code === 'string' ? e.code : ''
  const all = text(e)

  if (mentions(all, 'catch_outside_session')) return { kind: 'catch-outside' }
  if (code === '23505' && mentions(all, 'sessions_one_running_per_user')) return { kind: 'running-exists' }
  if (code === '23P01' && mentions(all, 'sessions_no_overlap')) return { kind: 'overlap' }
  if (code === '23503' && mentions(all, 'catches_session_owner_fkey')) return { kind: 'session-gone' }
  if (code === '23505' && /\b\w+_pkey\b/.test(all)) return { kind: 'duplicate-id' }
  return { kind: 'unknown' }
}
