/**
 * FAW-AI Document Processor & Context Extractor
 * Provides client-safe and server-safe text extraction, chunking,
 * and academic document grounding for faculty course materials.
 */

export interface DocumentChunk {
  chunkIndex: number;
  text: string;
  wordCount: number;
  metadata?: {
    filename?: string;
    courseId?: string;
    section?: string;
  };
}

/**
 * Splits plain text into structured overlapping chunks for AI grounding
 */
export function chunkAcademicText(
  text: string,
  options: {
    maxChunkSize?: number; // Characters per chunk
    overlap?: number;       // Characters of overlap
    metadata?: DocumentChunk["metadata"];
  } = {}
): DocumentChunk[] {
  const maxSize = options.maxChunkSize || 1200;
  const overlap = options.overlap || 200;
  const chunks: DocumentChunk[] = [];

  if (!text || text.trim().length === 0) {
    return chunks;
  }

  const cleanText = text.replace(/\r\n/g, "\n").trim();
  let start = 0;
  let index = 0;

  while (start < cleanText.length) {
    let end = start + maxSize;

    // Prefer splitting at sentence or paragraph boundaries
    if (end < cleanText.length) {
      const paragraphBreak = cleanText.lastIndexOf("\n\n", end);
      const sentenceBreak = cleanText.lastIndexOf(". ", end);
      const lineBreak = cleanText.lastIndexOf("\n", end);

      if (paragraphBreak > start + maxSize / 2) {
        end = paragraphBreak + 2;
      } else if (sentenceBreak > start + maxSize / 2) {
        end = sentenceBreak + 2;
      } else if (lineBreak > start + maxSize / 2) {
        end = lineBreak + 1;
      }
    }

    const chunkText = cleanText.slice(start, end).trim();
    if (chunkText.length > 0) {
      chunks.push({
        chunkIndex: index++,
        text: chunkText,
        wordCount: chunkText.split(/\s+/).length,
        metadata: options.metadata,
      });
    }

    start = end - overlap;
    if (start >= cleanText.length || end >= cleanText.length) {
      break;
    }
  }

  return chunks;
}

/**
 * Formats retrieved document chunks into grounding context for Gemini
 */
export function formatGroundingContext(
  chunks: DocumentChunk[],
  maxChars = 6000
): string {
  if (!chunks || chunks.length === 0) return "";

  let context = "--- INSTITUTIONAL COURSE REFERENCE DOCUMENTS ---\n";
  let currentLength = context.length;

  for (const chunk of chunks) {
    const chunkHeader = `\n[Reference Source: ${chunk.metadata?.filename || "Course Material"} - Section ${chunk.chunkIndex + 1}]\n`;
    const snippet = chunkHeader + chunk.text + "\n";

    if (currentLength + snippet.length > maxChars) {
      break;
    }

    context += snippet;
    currentLength += snippet.length;
  }

  context += "\n--- END OF REFERENCE DOCUMENTS ---\n";
  return context;
}
