/**
 * JWT Constants
 * 
 * Centralized JWT configuration to ensure signing and verification
 * use the EXACT same secret value.
 */

// Get JWT_SECRET from environment, ensuring it's trimmed and consistent
export const JWT_SECRET = (process.env.JWT_SECRET || 'changeme').trim();
