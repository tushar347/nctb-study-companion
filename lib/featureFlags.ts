/**
 * AI credit restrictions are disabled by default
 * during research and development.
 *
 * Set AI_CREDITS_ENABLED=true to restore the
 * previous wallet check and deduction behavior.
 */
export function isAiCreditLimitEnabled() {
  return (
    process.env.AI_CREDITS_ENABLED ===
    "true"
  );
}
