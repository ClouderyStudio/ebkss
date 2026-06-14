export function extractJson(content) {
  if (typeof content !== 'string' || content.trim() === '') {
    throw new Error('AI response is empty');
  }

  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const objectStart = cleaned.indexOf('{');
    const objectEnd = cleaned.lastIndexOf('}');
    const arrayStart = cleaned.indexOf('[');
    const arrayEnd = cleaned.lastIndexOf(']');

    const objectCandidate =
      objectStart >= 0 && objectEnd > objectStart ? cleaned.slice(objectStart, objectEnd + 1) : null;
    const arrayCandidate =
      arrayStart >= 0 && arrayEnd > arrayStart ? cleaned.slice(arrayStart, arrayEnd + 1) : null;

    const candidate =
      arrayCandidate && (!objectCandidate || arrayStart < objectStart) ? arrayCandidate : objectCandidate;

    if (!candidate) {
      throw new Error('AI response does not contain JSON');
    }

    return JSON.parse(candidate);
  }
}

