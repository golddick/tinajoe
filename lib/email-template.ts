export type BrandedEmailContent = {
  preheader: string
  title: string
  greeting: string
  paragraphs: string[]
  details?: Array<{ label: string; value: string }>
  highlight?: { label: string; value: string }
  button?: { label: string; url: string }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character]
  })
}

function getButtonUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Email button URLs must use HTTP or HTTPS.')
  }
  return url.toString()
}

export function renderBrandedEmail(content: BrandedEmailContent) {
  const paragraphs = content.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 14px;color:#665950;font-size:14px;line-height:24px;">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`,
    )
    .join('')
  const detailRows = (content.details ?? [])
    .map(
      ({ label, value }) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #eee6dc;color:#75685f;font-size:13px;line-height:20px;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:12px 0;border-bottom:1px solid #eee6dc;color:#49382f;font-size:14px;font-weight:600;line-height:20px;text-align:right;vertical-align:top;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join('')
  const detailsSection = detailRows
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border-collapse:collapse;">${detailRows}</table>`
    : ''
  const highlightSection = content.highlight
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border-collapse:collapse;"><tr><td style="border-left:3px solid #c98675;background:#fbf4ef;padding:16px 18px;"><p style="margin:0 0 6px;color:#8a5a4d;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">${escapeHtml(content.highlight.label)}</p><p style="margin:0;color:#49382f;font-size:14px;line-height:23px;white-space:pre-line;">${escapeHtml(content.highlight.value).replace(/\n/g, '<br>')}</p></td></tr></table>`
    : ''
  const button = content.button
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 8px;"><tr><td align="center" style="border-radius:999px;background:#49382f;"><a href="${escapeHtml(getButtonUrl(content.button.url))}" style="display:inline-block;padding:14px 24px;color:#fffaf4;font-size:14px;font-weight:700;line-height:20px;text-decoration:none;">${escapeHtml(content.button.label)}</a></td></tr></table>`
    : ''
  const text = [
    'crumb.studio',
    content.title,
    '',
    content.greeting,
    '',
    ...content.paragraphs,
    ...(content.details?.length
      ? ['', ...content.details.map(({ label, value }) => `${label}: ${value}`)]
      : []),
    ...(content.highlight
      ? ['', `${content.highlight.label}:`, content.highlight.value]
      : []),
    ...(content.button
      ? ['', `${content.button.label}: ${getButtonUrl(content.button.url)}`]
      : []),
    '',
    'With care,',
    'The Crumb Studio team',
  ].join('\n')

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${escapeHtml(content.title)}</title>
  </head>
  <body style="margin:0;background:#f7f2e9;padding:32px 12px;color:#49382f;font-family:Arial,Helvetica,sans-serif;">
    <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escapeHtml(content.preheader)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border-collapse:separate;border-spacing:0;">
            <tr>
              <td style="padding:8px 24px 22px;text-align:center;">
                <p style="margin:0;color:#49382f;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;letter-spacing:-0.6px;">crumb<span style="color:#c98675;">.</span>studio</p>
                <p style="margin:7px 0 0;color:#81746a;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Thoughtful cakes for life’s sweetest chapters</p>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid #e8dfd3;border-radius:20px;background:#fffdfa;padding:36px 36px 30px;">
                <p style="margin:0 0 12px;color:#a66d5e;font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">Made with care</p>
                <h1 style="margin:0 0 20px;color:#49382f;font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:400;line-height:1.2;">${escapeHtml(content.title)}</h1>
                <p style="margin:0 0 14px;color:#49382f;font-size:15px;line-height:25px;">${escapeHtml(content.greeting)}</p>
                <div>${paragraphs}</div>
                ${detailsSection}
                ${highlightSection}
                ${button}
                <p style="margin:26px 0 0;color:#665950;font-size:14px;line-height:24px;">With care,<br><strong style="color:#49382f;">The Crumb Studio team</strong></p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px 8px;text-align:center;">
                <p style="margin:0;color:#81746a;font-size:11px;line-height:18px;">A little sweetness, made just for your celebration.</p>
                <p style="margin:7px 0 0;color:#a0958b;font-size:10px;line-height:16px;">crumb.studio</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { html, text }
}
