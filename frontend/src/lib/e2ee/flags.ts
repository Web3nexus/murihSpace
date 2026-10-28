/**
 * Feature flags for end-to-end encryption. Read here and nowhere else.
 */

/**
 * Encrypt text in 1:1 direct chats. Off unless VITE_E2EE_DIRECT_MESSAGES is "true",
 * so direct text uses the existing plaintext path by default.
 */
export const E2EE_DIRECT_MESSAGES_ENABLED: boolean =
  import.meta.env.VITE_E2EE_DIRECT_MESSAGES === 'true';
