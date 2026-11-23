import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { renderBrandedEmail } from '../lib/email-template.ts'

describe('Crumb Studio email template', () => {
  it('renders themed HTML and a readable text alternative', () => {
    const email = renderBrandedEmail({
      preheader: 'A payment update',
      title: 'Your payment is confirmed',
      greeting: 'Hello Alex,',
      paragraphs: ['Thanks for placing your order.'],
      details: [{ label: 'Order', value: 'cake-123' }],
      button: { label: 'Review order', url: 'https://crumb.studio/admin' },
    })

    assert.match(email.html, /crumb<span[^>]*>\.<\/span>studio/)
    assert.match(email.html, /background:#f7f2e9/)
    assert.match(email.html, /https:\/\/crumb\.studio\/admin/)
    assert.match(email.html, /Thanks for placing your order\./)
    assert.match(email.text, /Your payment is confirmed/)
    assert.match(email.text, /Order: cake-123/)
    assert.match(email.text, /Review order: https:\/\/crumb\.studio\/admin/)
  })

  it('escapes customer content before adding it to HTML', () => {
    const email = renderBrandedEmail({
      preheader: '<paid>',
      title: '<script>unsafe</script>',
      greeting: 'Hello <b>Alex</b>',
      paragraphs: ['A & B'],
      highlight: { label: 'Studio note', value: '<img src=x onerror=alert(1)>' },
    })

    assert.match(email.html, /&lt;script&gt;unsafe&lt;\/script&gt;/)
    assert.match(email.html, /Hello &lt;b&gt;Alex&lt;\/b&gt;/)
    assert.match(email.html, /&lt;img src=x onerror=alert\(1\)&gt;/)
    assert.doesNotMatch(email.html, /<script>|<img src=x/)
    assert.match(email.text, /A & B/)
  })

  it('rejects unsupported button URL schemes', () => {
    assert.throws(
      () =>
        renderBrandedEmail({
          preheader: 'A payment update',
          title: 'Your payment is confirmed',
          greeting: 'Hello Alex,',
          paragraphs: ['Thanks for placing your order.'],
          button: { label: 'Open link', url: 'javascript:alert(1)' },
        }),
      /must use HTTP or HTTPS/,
    )
  })
})
