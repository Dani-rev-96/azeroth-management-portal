/**
 * AzerothCore Account Service
 * Server-side service for querying and verifying WoW accounts
 */

import type { RowDataPacket } from 'mysql2/promise'
import type { AzerothCoreAccount } from '~/types'
import { getAuthDbPool } from '#server/utils/mysql'
import { verifySrp6Password } from '#server/utils/srp6'

/**
 * Find account by username
 */
export async function findAccountByUsername(username: string): Promise<AzerothCoreAccount | null> {
  const pool = await getAuthDbPool()

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, username, salt, verifier, email, joindate, last_ip, last_login, online, expansion, mutetime, locale FROM account WHERE username = ?',
    [username.toUpperCase()] // AzerothCore stores usernames in uppercase
  )

  if (rows.length === 0) {
    return null
  }

  const row = rows[0]
  return {
    id: row.id,
    username: row.username,
    salt: row.salt,
    verifier: row.verifier,
    email: row.email,
    joindate: row.joindate,
    last_ip: row.last_ip,
    last_login: row.last_login,
    online: row.online,
    expansion: row.expansion,
    mutetime: row.mutetime,
    locale: row.locale,
  }
}

/**
 * Find account by ID
 */
export async function findAccountById(id: number): Promise<AzerothCoreAccount | null> {
  const pool = await getAuthDbPool()

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, username, salt, verifier, email, joindate, last_ip, last_login, online, expansion, mutetime, locale FROM account WHERE id = ?',
    [id]
  )

  if (rows.length === 0) {
    return null
  }

  const row = rows[0]
  return {
    id: row.id,
    username: row.username,
    salt: row.salt,
    verifier: row.verifier,
    email: row.email,
    joindate: row.joindate,
    last_ip: row.last_ip,
    last_login: row.last_login,
    online: row.online,
    expansion: row.expansion,
    mutetime: row.mutetime,
    locale: row.locale,
  }
}

/**
 * Verify account credentials using SRP-6a
 * Returns account data if credentials are valid, null otherwise
 */
export async function verifyAccountCredentials(
  username: string,
  password: string
): Promise<AzerothCoreAccount | null> {
  // Find account by username (stored uppercase in DB)
  const account = await findAccountByUsername(username);

  console.log(`Verifying credentials for account: ${username}`);
  console.log(`Account found: `, account);

  if (!account) {
    // Account doesn't exist
    return null
  }

  // Verify password using SRP-6a
  // IMPORTANT: Use the database username (uppercase) for verification
  // as that's what was used to create the verifier
  const isValid = verifySrp6Password(
    account.username, // Use the username from DB (uppercase)
    password,
    account.salt,
    account.verifier
  )

  if (!isValid) {
    // Password incorrect
    return null
  }

  // Credentials valid - return account (without salt/verifier for security)
  return account
}

/**
 * Check if account is locked or banned
 */
export async function isAccountBanned(accountId: number): Promise<boolean> {
  const pool = await getAuthDbPool()

  // Check account_banned table
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM account_banned WHERE id = ? AND active = 1',
    [accountId]
  )

  return rows.length > 0
}

/**
 * Check if account is currently online
 */
export async function isAccountOnline(accountId: number): Promise<boolean> {
  const account = await findAccountById(accountId)
  return account?.online === 1
}

/**
 * Update account password with new SRP6 credentials
 */
export async function updateAccountPassword(
  accountId: number,
  salt: Buffer,
  verifier: Buffer
): Promise<void> {
  const pool = await getAuthDbPool()

  await pool.query(
    'UPDATE account SET salt = ?, verifier = ? WHERE id = ?',
    [salt, verifier, accountId]
  )
}

/**
 * Create a new WoW account in the auth database
 */
export async function createAccount(
  username: string,
  password: string,
  email: string = ""
): Promise<AzerothCoreAccount> {
  const pool = await getAuthDbPool()

  // Check if account already exists
  const existing = await findAccountByUsername(username)
  if (existing) {
    throw new Error('Account already exists')
  }

  // Generate SRP-6 credentials
  const { generateSrp6Credentials } = await import('#server/utils/srp6')
  const { salt, verifier } = generateSrp6Credentials(username, password)

  // Insert new account with default values
  const [result] = await pool.query(
    `INSERT INTO account
      (username, salt, verifier, email, expansion, joindate)
    VALUES
      (?, ?, ?, ?, ?, NOW())`,
    [
      username.toUpperCase(), // AzerothCore stores usernames in uppercase
      salt,
      verifier,
      email,
      2, // WotLK expansion (0=Classic, 1=TBC, 2=WotLK)
    ]
  )

  // Fetch and return the created account
  const accountId = (result as any).insertId
  const account = await findAccountById(accountId)

  if (!account) {
    throw new Error('Failed to create account')
  }

  return account
}

/**
 * Find all accounts (admin use only)
 */
export async function findAllAccounts(): Promise<AzerothCoreAccount[]> {
  const pool = await getAuthDbPool()

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, username, salt, verifier, email, joindate, last_ip, last_login, online, expansion, mutetime, locale FROM account WHERE username NOT LIKE "RNDBOT%" ORDER BY id ASC'
  )

  return rows.map(row => ({
    id: row.id,
    username: row.username,
    salt: row.salt,
    verifier: row.verifier,
    email: row.email,
    joindate: row.joindate,
    last_ip: row.last_ip,
    last_login: row.last_login,
    online: row.online,
    expansion: row.expansion,
    mutetime: row.mutetime,
    locale: row.locale,
  }))
}
