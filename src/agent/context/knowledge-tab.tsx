import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { Input } from '@/core/ui/input';
import { Badge } from '@/core/ui/badge';
import { CopyButton } from '@/core/ui/copy-button';
import { useKnowledgeSearch } from '@/core/api/hooks/use-knowledge';
import type { ArticleSearchResult } from '@/core/api/hooks/use-knowledge';

function ArticleCard({ article }: { article: ArticleSearchResult }) {
  const { t } = useTranslation(['agent']);
  const [expanded, setExpanded] = useState(false);

  const scorePercent = Math.round(article.relevanceScore * 100);

  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-700">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left"
      >
        <div className="flex flex-1 flex-col gap-1 min-w-0">
          <span className="truncate text-sm font-semibold text-foreground">{article.title}</span>
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="secondary" className="text-xs">
              {scorePercent}%
            </Badge>
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-slate-200 px-3 pb-3 pt-2 dark:border-slate-700">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            {article.content}
          </p>
          <div className="mt-2 flex justify-end">
            <CopyButton value={article.content} variant="outline" label={t('agent:context.copy')} />
          </div>
        </div>
      )}
    </div>
  );
}

export function KnowledgeTab() {
  const { t } = useTranslation(['agent']);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const { data: results = [], isFetching } = useKnowledgeSearch(debouncedQuery);

  const showEmpty = debouncedQuery.length < 2;
  const showNoResults = !showEmpty && !isFetching && results.length === 0;

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('agent:knowledge.search_placeholder')}
          aria-label={t('agent:knowledge.search_placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      {showEmpty && (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-slate-500">
          <BookOpen className="h-8 w-8 opacity-40" />
          <p>{t('agent:knowledge.empty_state')}</p>
        </div>
      )}

      {showNoResults && (
        <p className="py-4 text-center text-sm text-slate-500">{t('agent:knowledge.no_results')}</p>
      )}

      {!showEmpty && results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}
