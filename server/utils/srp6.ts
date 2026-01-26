import crypto from 'crypto'
import {computeVerifier} from '@azerothcore/ac-nodejs-srp6'

const srp6Params = {
        N_length_bits: 256,
        N: BigInt(`0x894B645E89E1535BBDAD5B8B290650530801B18EBFBF5E8FAB3C82872A3E9BB7`),
        g: BigInt(`0x7`),
        hash: `sha1`
    }

/**
 * Verify a password against stored salt and verifier
 * Returns true if password is correct
 */
export function verifySrp6Password(
  username: string,
  password: string,
  saltHex: string,
  verifierHex: string
): boolean {
  try {
    // Convert hex strings to buffers
    const storedSalt = Buffer.from(saltHex, 'hex')
    const storedVerifier = Buffer.from(verifierHex, 'hex')

    // Calculate what the verifier should be for this password
    const calculatedVerifier = computeVerifier(srp6Params, storedSalt, username.toUpperCase(), password.toUpperCase())

    // Compare verifiers (constant-time comparison to prevent timing attacks)
    return crypto.timingSafeEqual(storedVerifier, calculatedVerifier)
  } catch (error) {
    console.error('SRP-6 verification error:', error)
    return false
  }
}

/**
 * Generate new salt and verifier for account creation
 */
export function generateSrp6Credentials(username: string, password: string): {
  salt: Buffer
  verifier: Buffer
} {
  // Generate random 32-byte salt
  const salt = crypto.randomBytes(32)
  
  // Calculate verifier
  const verifier = computeVerifier(srp6Params, salt, username.toUpperCase(), password.toUpperCase())
  
  return {
    salt: salt,
    verifier: verifier,
  }
}
