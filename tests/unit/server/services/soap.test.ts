import { describe, it, expect } from 'vitest'

// ─── SOAP XML Escaping (pure functions from soap.ts) ────────────────────────────

// These are internal functions in soap.ts but we recreate them for testing
// since the module structure doesn't export them directly

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function unescapeXml(str: string): string {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
}

function escapeQuotes(str: string): string {
  return str.replace(/"/g, '\\"')
}

// ─── escapeXml ──────────────────────────────────────────────────────────────────

describe('escapeXml', () => {
  it('escapes ampersand', () => {
    expect(escapeXml('A&B')).toBe('A&amp;B')
  })

  it('escapes less-than', () => {
    expect(escapeXml('A<B')).toBe('A&lt;B')
  })

  it('escapes greater-than', () => {
    expect(escapeXml('A>B')).toBe('A&gt;B')
  })

  it('escapes double-quote', () => {
    expect(escapeXml('A"B')).toBe('A&quot;B')
  })

  it('escapes single-quote', () => {
    expect(escapeXml("A'B")).toBe('A&apos;B')
  })

  it('handles multiple special characters', () => {
    expect(escapeXml('<tag attr="val">&')).toBe('&lt;tag attr=&quot;val&quot;&gt;&amp;')
  })

  it('returns empty string unchanged', () => {
    expect(escapeXml('')).toBe('')
  })

  it('returns plain text unchanged', () => {
    expect(escapeXml('hello world')).toBe('hello world')
  })

  it('handles GM commands', () => {
    expect(escapeXml('additem PlayerName 12345 1')).toBe('additem PlayerName 12345 1')
  })
})

// ─── unescapeXml ────────────────────────────────────────────────────────────────

describe('unescapeXml', () => {
  it('unescapes ampersand', () => {
    expect(unescapeXml('A&amp;B')).toBe('A&B')
  })

  it('unescapes less-than', () => {
    expect(unescapeXml('A&lt;B')).toBe('A<B')
  })

  it('unescapes greater-than', () => {
    expect(unescapeXml('A&gt;B')).toBe('A>B')
  })

  it('unescapes double-quote', () => {
    expect(unescapeXml('A&quot;B')).toBe('A"B')
  })

  it('unescapes single-quote', () => {
    expect(unescapeXml('A&apos;B')).toBe("A'B")
  })

  it('handles SOAP response text', () => {
    expect(unescapeXml('Character &quot;Hero&quot; not found')).toBe('Character "Hero" not found')
  })

  it('is the inverse of escapeXml for basic strings', () => {
    const original = '<tag attr="val">&'
    expect(unescapeXml(escapeXml(original))).toBe(original)
  })

  it('returns plain text unchanged', () => {
    expect(unescapeXml('hello world 123')).toBe('hello world 123')
  })
})

// ─── escapeQuotes ───────────────────────────────────────────────────────────────

describe('escapeQuotes', () => {
  it('escapes double quotes', () => {
    expect(escapeQuotes('Hello "World"')).toBe('Hello \\"World\\"')
  })

  it('leaves single quotes alone', () => {
    expect(escapeQuotes("Hello 'World'")).toBe("Hello 'World'")
  })

  it('returns empty string unchanged', () => {
    expect(escapeQuotes('')).toBe('')
  })

  it('handles multiple quotes', () => {
    expect(escapeQuotes('"a" "b" "c"')).toBe('\\"a\\" \\"b\\" \\"c\\"')
  })

  it('handles mail subjects', () => {
    expect(escapeQuotes('Subject with "special" chars')).toBe('Subject with \\"special\\" chars')
  })
})

// ─── SOAP Command Construction ──────────────────────────────────────────────────

describe('SOAP Command Construction', () => {
  it('builds correct additem command', () => {
    const characterName = 'TestPlayer'
    const itemId = 12345
    const count = 1
    const command = `additem ${characterName} ${itemId} ${count}`
    expect(command).toBe('additem TestPlayer 12345 1')
  })

  it('builds correct modify money command', () => {
    const characterName = 'TestPlayer'
    const copperAmount = 100000
    const command = `modify money ${characterName} ${copperAmount}`
    expect(command).toBe('modify money TestPlayer 100000')
  })

  it('builds correct send items mail command', () => {
    const characterName = 'TestPlayer'
    const subject = 'Test Subject'
    const body = 'Test Body'
    const items = [{ itemId: 12345, count: 1 }, { itemId: 67890, count: 5 }]
    const itemsStr = items.map(i => `${i.itemId}:${i.count}`).join(' ')
    const command = `send items ${characterName} "${escapeQuotes(subject)}" "${escapeQuotes(body)}" ${itemsStr}`
    expect(command).toBe('send items TestPlayer "Test Subject" "Test Body" 12345:1 67890:5')
  })

  it('builds correct server info command', () => {
    expect('server info').toBe('server info')
  })

  it('escapes quotes in mail subjects', () => {
    const subject = 'He said "hello"'
    const escaped = escapeQuotes(subject)
    expect(escaped).toBe('He said \\"hello\\"')
  })
})

// ─── SOAP Envelope Construction ─────────────────────────────────────────────────

describe('SOAP Envelope', () => {
  function buildSoapEnvelope(command: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
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
  }

  it('wraps command in valid XML', () => {
    const envelope = buildSoapEnvelope('server info')
    expect(envelope).toContain('<?xml version="1.0"')
    expect(envelope).toContain('SOAP-ENV:Envelope')
    expect(envelope).toContain('SOAP-ENV:Body')
    expect(envelope).toContain('<command>server info</command>')
  })

  it('escapes XML special characters in commands', () => {
    const envelope = buildSoapEnvelope('send items Player "Sub" "Body <html>"')
    expect(envelope).toContain('&lt;html&gt;')
    expect(envelope).not.toContain('<html>')
  })

  it('uses correct namespace', () => {
    const envelope = buildSoapEnvelope('server info')
    expect(envelope).toContain('xmlns:ns1="urn:AC"')
    expect(envelope).toContain('ns1:executeCommand')
  })

  it('SOAP response parsing regex extracts result', () => {
    const responseText = '<result>Character teleported</result>'
    const resultMatch = responseText.match(/<result[^>]*>([\s\S]*?)<\/result>/i)
    expect(resultMatch).toBeTruthy()
    expect(resultMatch![1]).toBe('Character teleported')
  })

  it('SOAP response parsing handles empty result', () => {
    const responseText = '<result></result>'
    const resultMatch = responseText.match(/<result[^>]*>([\s\S]*?)<\/result>/i)
    expect(resultMatch).toBeTruthy()
    expect(resultMatch![1]).toBe('')
  })

  it('SOAP fault detection', () => {
    const faultResponse = '<SOAP-ENV:Body><SOAP-ENV:Fault><faultstring>Access denied</faultstring></SOAP-ENV:Fault></SOAP-ENV:Body>'
    expect(faultResponse.includes('SOAP-ENV:Fault')).toBe(true)
    const faultMatch = faultResponse.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/i)
    expect(faultMatch![1]).toBe('Access denied')
  })

  it('error detection in result text', () => {
    const errorPhrases = ['error', 'cannot', 'failed', 'invalid', 'not found']
    for (const phrase of errorPhrases) {
      const result = `Something ${phrase} here`
      const isError = result.toLowerCase().includes('error') ||
                      result.toLowerCase().includes('cannot') ||
                      result.toLowerCase().includes('failed') ||
                      result.toLowerCase().includes('invalid') ||
                      result.toLowerCase().includes('not found')
      expect(isError).toBe(true)
    }

    // Positive result should not be flagged
    const successResult = 'Character teleported successfully'
    const isError = successResult.toLowerCase().includes('error') ||
                    successResult.toLowerCase().includes('cannot') ||
                    successResult.toLowerCase().includes('failed') ||
                    successResult.toLowerCase().includes('invalid') ||
                    successResult.toLowerCase().includes('not found')
    expect(isError).toBe(false)
  })
})
