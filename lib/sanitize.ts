export function sanitizeQuestion(input: string): { clean: string; error?: string } {
  const trimmed = input.trim()

  if (trimmed.length < 5) {
    return { clean: '', error: 'Question is too short.' }
  }

  if (trimmed.length > 2000) {
    return { clean: '', error: 'Question too long. Max 2000 characters.' }
  }

  // Strip HTML tags
  const noHtml = trimmed.replace(/<[^>]*>/g, '')

  // Strip SQL injection attempts
  const noSql = noHtml.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC)\b)/gi, '')

  return { clean: noSql }
}