export function formatAddressForGeocoding(
  address: string,
  postcode: string,
) {
  const normalizedAddress = address.trim().replace(/\s+/g, ' ')
  const normalizedPostcode = postcode.trim().replace(/\s+/g, ' ')
  if (!normalizedAddress || !normalizedPostcode) return normalizedAddress

  const parts = normalizedAddress
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (
    parts.some(
      (part) => part.toLocaleLowerCase() === normalizedPostcode.toLocaleLowerCase(),
    )
  ) {
    return parts.join(', ')
  }
  if (parts.length < 2) {
    return `${normalizedAddress}, ${normalizedPostcode}`
  }

  const country = parts.pop()
  return [...parts, normalizedPostcode, country].join(', ')
}
