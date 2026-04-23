// CodeBlock — syntax-highlighted code surface for audit payloads, webhook
// bodies, compliance violations, and any other raw-JSON / raw-text display
// currently rendered via bare <pre> elements.
//
// Library: prism-react-renderer (synchronous, ~30KB gz, no async suspense
// churn vs shiki). Themes resolved from next-themes: `github` for light,
// `vsDark` for dark. Chosen over shiki because the primitive is embedded in
// drawers / tables where a synchronous first-paint beats VS Code-grade theme
// fidelity — see Phase 0 Task D brief.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Highlight, themes as prismThemes } from 'prism-react-renderer';

import { Button } from '@/core/ui/button';
import { CopyButton } from '@/core/ui/copy-button';
import { cn } from '@/lib/utils';

export type CodeBlockLanguage = 'json' | 'xml' | 'plaintext' | 'javascript';

export interface CodeBlockProps {
  readonly code: string;
  readonly language?: CodeBlockLanguage;
  readonly copyable?: boolean;
  readonly collapsible?: boolean;
  readonly maxHeight?: string;
  readonly wrapLines?: boolean;
}

// prism-react-renderer uses "markup" for XML-family grammars, and has no
// first-class "plaintext" — passing an unregistered language renders as
// plain text (tokens with no class-mapped color), which is the correct
// behavior for `plaintext`.
function resolvePrismLanguage(language: CodeBlockLanguage): string {
  if (language === 'xml') return 'markup';
  if (language === 'plaintext') return 'none';
  return language;
}

export function CodeBlock({
  code,
  language = 'plaintext',
  copyable = true,
  collapsible = false,
  maxHeight = '20rem',
  wrapLines = false,
}: CodeBlockProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const prismLanguage = resolvePrismLanguage(language);
  const prismTheme = resolvedTheme === 'dark' ? prismThemes.vsDark : prismThemes.github;

  const isCollapsed = collapsible && !expanded;
  const showMoreLabel = t('code-block.show-more', 'Show more');
  const showLessLabel = t('code-block.show-less', 'Show less');

  return (
    <div className="relative rounded-md border border-border bg-muted/30">
      {copyable && (
        <div className="absolute right-2 top-2 z-10">
          <CopyButton value={code} iconOnly size="sm" variant="ghost" />
        </div>
      )}

      <div
        className="relative overflow-hidden"
        style={isCollapsed ? { maxHeight } : undefined}
      >
        <Highlight code={code} language={prismLanguage} theme={prismTheme}>
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={cn(
                className,
                'p-3 text-xs leading-relaxed',
                wrapLines ? 'whitespace-pre-wrap break-words' : 'overflow-x-auto',
                copyable ? 'pr-10' : undefined,
              )}
              style={style}
            >
              {tokens.map((line, lineIdx) => {
                const lineProps = getLineProps({ line });
                return (
                  <div key={lineIdx} {...lineProps}>
                    {line.map((token, tokenIdx) => {
                      const tokenProps = getTokenProps({ token });
                      return <span key={tokenIdx} {...tokenProps} />;
                    })}
                  </div>
                );
              })}
            </pre>
          )}
        </Highlight>

        {isCollapsed && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent"
          />
        )}
      </div>

      {collapsible && (
        <div className="border-t border-border px-2 py-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((prev) => !prev)}
            className="w-full justify-center gap-1 text-xs"
          >
            {expanded ? (
              <>
                <ChevronUp aria-hidden="true" className="size-3" />
                <span>{showLessLabel}</span>
              </>
            ) : (
              <>
                <ChevronDown aria-hidden="true" className="size-3" />
                <span>{showMoreLabel}</span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default CodeBlock;
