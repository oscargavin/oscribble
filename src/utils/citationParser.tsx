import React from 'react';

/**
 * Parse citation tags from web search results and render them nicely
 * Converts <cite index="3-2">text</cite> to styled inline citations with clickable links
 */
export function parseCitations(
  text: string,
  citations?: { [index: string]: { url: string; title: string } }
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Match <cite index="...">content</cite> tags
  const citeRegex = /<cite index="([^"]+)">([^<]+)<\/cite>/g;
  let match;

  while ((match = citeRegex.exec(text)) !== null) {
    const [fullMatch, index, citedText] = match;
    const startIndex = match.index;

    // Add text before citation
    if (startIndex > lastIndex) {
      parts.push(text.substring(lastIndex, startIndex));
    }

    // Look up citation details
    const citationInfo = citations?.[index];

    // Add citation with styled marker
    if (citationInfo) {
      parts.push(
        <React.Fragment key={`cite-${startIndex}`}>
          {citedText}
          <sup
            className="text-[#FF4D00] ml-0.5 cursor-pointer hover:underline"
            title="Source"
            onClick={(e) => {
              e.stopPropagation();
              // Open URL in default browser
              window.electronAPI?.openExternal?.(citationInfo.url);
            }}
          >
            [{index}]
          </sup>
        </React.Fragment>
      );
    } else {
      // Fallback if citation not found
      parts.push(
        <React.Fragment key={`cite-${startIndex}`}>
          {citedText}
          <sup className="text-[#FF4D00] ml-0.5 cursor-help" title="Source">
            [{index}]
          </sup>
        </React.Fragment>
      );
    }

    lastIndex = startIndex + fullMatch.length;
  }

  // Add remaining text after last citation
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  // If no citations found, return original text
  return parts.length === 0 ? [text] : parts;
}

/**
 * Component that renders text with parsed citations
 */
export const CitedText: React.FC<{
  text: string;
  citations?: { [index: string]: { url: string; title: string } };
}> = ({ text, citations }) => {
  const parts = parseCitations(text, citations);
  return <>{parts}</>;
};
