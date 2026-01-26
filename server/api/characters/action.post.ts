import type { RowDataPacket } from 'mysql2/promise'
import { getCharactersDbPool } from '#server/utils/mysql'

/**
 * POST /api/characters/action
 * Handle character rename and undelete requests
 * 
 * Actions supported:
 * - rename: Request a character rename (sets AT_LOGIN flag)
 * - undelete: Restore a deleted character
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { characterId, action, newName, realmId } = body

    // Validation
    if (!characterId || typeof characterId !== 'number') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Valid character ID (guid) is required',
      })
    }

    if (!action || !['rename', 'undelete'].includes(action)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Action must be either "rename" or "undelete"',
      })
    }

    if (!realmId || typeof realmId !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Realm ID is required',
      })
    }

    if (action === 'rename' && (!newName || typeof newName !== 'string')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'New name is required for rename action',
      })
    }

    // Get character database pool for the realm
    const pool = await getCharactersDbPool(realmId)

    // Verify character exists
    const [chars] = await pool.query<RowDataPacket[]>(
      'SELECT guid, name, account, deleteDate, at_login FROM characters WHERE guid = ?',
      [characterId]
    )

    if (chars.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Character not found',
      })
    }

    const character = chars[0]

    if (action === 'rename') {
      // Validate character is not deleted
      if (character.deleteDate) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Cannot rename a deleted character. Undelete it first.',
        })
      }

      // Validate new name (basic validation - AzerothCore will do full validation)
      if (newName.length < 2 || newName.length > 12) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Character name must be between 2 and 12 characters',
        })
      }

      // Check if name is already taken
      const [existingChars] = await pool.query<RowDataPacket[]>(
        'SELECT guid FROM characters WHERE name = ? AND deleteDate IS NULL',
        [newName]
      )

      if (existingChars.length > 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'This name is already taken',
        })
      }

      // Set AT_LOGIN_RENAME flag (0x01) and update name
      // The AT_LOGIN system in AzerothCore will prompt for rename on next login
      const AT_LOGIN_RENAME = 0x01
      const newAtLogin = character.at_login | AT_LOGIN_RENAME

      await pool.query(
        'UPDATE characters SET at_login = ? WHERE guid = ?',
        [newAtLogin, characterId]
      )

      // Optionally, you can directly rename here instead of using AT_LOGIN flag
      // Uncomment the following if you want immediate rename:
      /*
      await pool.query(
        'UPDATE characters SET name = ? WHERE guid = ?',
        [newName, characterId]
      )
      */

      console.log(`[✓] Character rename requested: ${character.name} -> ${newName} (GUID: ${characterId})`)

      return {
        success: true,
        message: `Rename request submitted. The character will be prompted to rename on next login.`,
        action: 'rename',
      }
    } 
    else if (action === 'undelete') {
      // Validate character is deleted
      if (!character.deleteDate) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Character is not deleted',
        })
      }

      // Restore the character by clearing delete fields
      await pool.query(
        `UPDATE characters 
         SET deleteInfos_Account = NULL, 
             deleteInfos_Name = NULL, 
             deleteDate = NULL 
         WHERE guid = ?`,
        [characterId]
      )

      console.log(`[✓] Character undeleted: ${character.name} (GUID: ${characterId})`)

      return {
        success: true,
        message: 'Character has been successfully restored!',
        action: 'undelete',
      }
    }

    // Should never reach here due to validation, but TypeScript safety
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid action',
    })
  } catch (error) {
    console.error('Error processing character action:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to process character action',
    })
  }
})
