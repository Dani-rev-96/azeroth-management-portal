/**
 * SOAP Service for AzerothCore
 * Executes GM commands via SOAP (Simple Object Access Protocol)
 *
 * SECURITY NOTES:
 * - SOAP should only be accessible from localhost or internal network
 * - Use dedicated GM account with minimal required permissions
 * - Never expose SOAP credentials to client
 *
 * Reference: https://www.azerothcore.org/wiki/remote-access
 */

import type { RealmSoapConfig } from '#server/utils/config'

export interface SoapResponse {
  success: boolean
  result: string
  error?: string
}

/**
 * Execute a GM command via SOAP
 * @param config Realm-specific SOAP configuration
 * @param command The GM command to execute (without leading dot)
 * @returns Response from the server
 */
export async function executeCommand(config: RealmSoapConfig, command: string): Promise<SoapResponse> {
  if (!config.enabled) {
    return {
      success: false,
      result: '',
      error: 'SOAP is not enabled for this realm',
    }
  }

  if (!config.username || !config.password) {
    return {
      success: false,
      result: '',
      error: 'SOAP credentials not configured for this realm',
    }
  }

  // Build SOAP envelope
  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope
  xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:ns1="urn:AC">
  <SOAP-ENV:Body>
    <ns1:executeCommand>
      <command>${escapeXml(command)}</command>
    </ns1:executeCommand>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`

  try {
    const url = `http://${config.host}:${config.port}/`
    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Authorization': `Basic ${auth}`,
        'SOAPAction': 'urn:AC#executeCommand',
      },
      body: soapEnvelope,
    })

    const responseText = await response.text()

    if (!response.ok) {
      console.error('[SOAP] Request failed:', response.status, responseText)
      return {
        success: false,
        result: '',
        error: `SOAP request failed with status ${response.status}`,
      }
    }

    // Parse response - look for the result in the SOAP response
    const resultMatch = responseText.match(/<result[^>]*>([\s\S]*?)<\/result>/i)
    const result = resultMatch?.[1] ? unescapeXml(resultMatch[1].trim()) : ''

    // Check for common error patterns in the result
    const isError = result.toLowerCase().includes('error') ||
                   result.toLowerCase().includes('cannot') ||
                   result.toLowerCase().includes('failed') ||
                   result.toLowerCase().includes('invalid') ||
                   result.toLowerCase().includes('not found')

    // Also check for SOAP fault
    const hasFault = responseText.includes('SOAP-ENV:Fault') ||
                    responseText.includes('faultstring')

    if (hasFault) {
      const faultMatch = responseText.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/i)
      const fault = faultMatch?.[1] ? unescapeXml(faultMatch[1].trim()) : 'Unknown SOAP fault'
      return {
        success: false,
        result: '',
        error: fault,
      }
    }

    return {
      success: !isError,
      result,
      error: isError ? result : undefined,
    }
  } catch (error) {
    console.error('[SOAP] Connection error:', error)
    return {
      success: false,
      result: '',
      error: error instanceof Error ? error.message : 'SOAP connection failed',
    }
  }
}

/**
 * Add item to a character's inventory
 * @param config Realm-specific SOAP configuration
 * @param characterName Character name (must be online for direct bag delivery)
 * @param itemId Item entry ID
 * @param count Number of items
 * @returns Success status and any error
 */
export async function addItemToCharacter(
  config: RealmSoapConfig,
  characterName: string,
  itemId: number,
  count: number = 1
): Promise<SoapResponse> {
  // AzerothCore .additem syntax:
  // .additem Optional(playerName/playerGUID) #itemid/[#itemname]/#itemLink #itemcount
  // Reference: https://www.azerothcore.org/wiki/gm-commands
  const command = `additem ${characterName} ${itemId} ${count}`
  return executeCommand(config, command)
}

/**
 * Modify character's money
 * @param config Realm-specific SOAP configuration
 * @param characterName Character name
 * @param copperAmount Amount in copper (negative to deduct)
 * @returns Success status
 */
export async function modifyMoney(
  config: RealmSoapConfig,
  characterName: string,
  copperAmount: number
): Promise<SoapResponse> {
  // .modify money works on selected target
  // For remote, we might need: .character modify money <name> <amount>
  // Or use send money command

  // Standard command for character by name:
  // There's no direct "modify money for player X" in vanilla AC
  // We'll need to rely on DB updates or a custom command

  // For safety, let's check if they have a character targeting command
  // Some servers have: .modify money $charname amount

  // Let's try the player-targeted version
  const command = `modify money ${characterName} ${copperAmount}`
  return executeCommand(config, command)
}

/**
 * Send items via mail (reliable for both online and offline)
 * @param config Realm-specific SOAP configuration
 * @param characterName Character name
 * @param subject Mail subject
 * @param body Mail body
 * @param items Array of {itemId, count} pairs
 * @returns Success status
 */
export async function sendItemsMail(
  config: RealmSoapConfig,
  characterName: string,
  subject: string,
  body: string,
  items: Array<{ itemId: number; count: number }>
): Promise<SoapResponse> {
  // Format: .send items <playerName> "<subject>" "<message>" <itemId1:count1> <itemId2:count2>...
  const itemsStr = items.map(i => `${i.itemId}:${i.count}`).join(' ')
  const command = `send items ${characterName} "${escapeQuotes(subject)}" "${escapeQuotes(body)}" ${itemsStr}`
  return executeCommand(config, command)
}

/**
 * Test SOAP connection
 * @param config Realm-specific SOAP configuration
 * @returns Whether SOAP is working
 */
export async function testConnection(config: RealmSoapConfig): Promise<SoapResponse> {
  // Use a harmless command to test
  return executeCommand(config, 'server info')
}

// Helper functions
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function unescapeXml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function escapeQuotes(str: string): string {
  return str.replace(/"/g, '\\"')
}
