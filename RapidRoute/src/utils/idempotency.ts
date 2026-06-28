import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a UUID v4 idempotency key.
 * Used to ensure safe retry semantics for booking and payment operations.
 */
export function generateIdempotencyKey(): string {
  return uuidv4();
}
