/**
 * Shared pure helpers for the application-tracking UI state.
 *
 * Kept free of JSX so both the client component and Vitest can import them.
 */

/**
 * Whether the ApplicationTracker should render in its tracked (badge) state.
 *
 * Derived from BOTH the server-provided status (currentStatus) and a local
 * flag set once a POST succeeds. Tracking to the local flag is what makes a
 * first-time "+ Track" click flip the button to the badge immediately — the
 * currentStatus prop is stale (it was fetched before the POST), so deriving
 * tracked-ness from the prop alone left the button stuck on "+ Track" even
 * though the status was saved to the database.
 */
export function isApplicationTracked(
  currentStatus: string | undefined,
  locallyStarted: boolean
): boolean {
  return Boolean((currentStatus && currentStatus !== "saved") || locallyStarted);
}
