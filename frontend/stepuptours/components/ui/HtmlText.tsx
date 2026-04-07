// components/ui/HtmlText.tsx
import React from 'react';
import { Text, View, Platform, StyleSheet } from 'react-native';

export function stripHtmlText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface HtmlTextProps {
  html: string;
  style?: any;
  numberOfLines?: number;
}

export function HtmlText({ html, style, numberOfLines }: HtmlTextProps) {
  if (!html) return null;

  if (Platform.OS === 'web') {
    // Extraemos los valores del estilo RN para pasarlos como CSS explícito
    const fontSize   = style?.fontSize   ?? 15;
    const color      = style?.color      ?? '#374151';
    const lineHeight = style?.lineHeight ?? 22;

    // CSS line-clamp para simular numberOfLines en web
    const clampStyle: React.CSSProperties = numberOfLines
      ? {
          display: '-webkit-box' as any,
          WebkitLineClamp: numberOfLines,
          WebkitBoxOrient: 'vertical' as any,
          overflow: 'hidden',
        }
      : {};

    return (
      <div
        dangerouslySetInnerHTML={{ __html: html }}
        style={{
          fontSize:   `${fontSize}px`,
          color,
          lineHeight: `${lineHeight}px`,
          margin:     0,
          padding:    0,
          fontFamily: 'inherit',
          ...clampStyle,
        }}
      />
    );
  }

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {stripHtmlText(html)}
    </Text>
  );
}
