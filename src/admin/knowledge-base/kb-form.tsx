import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/core/ui/sheet';
import type { Article } from '@/core/api/hooks/use-knowledge';

const articleSchema = z.object({
  title: z.string().min(1, 'admin:knowledge.validation.titleRequired'),
  content: z.string().min(1, 'admin:knowledge.validation.contentRequired'),
  tags: z.string(),
  language: z.enum(['en', 'es', 'pt-br']),
  published: z.boolean(),
});

export type ArticleFormValues = z.infer<typeof articleSchema>;

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'pt-br', label: 'Português (BR)' },
] as const;

interface KbFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  defaultValues?: Partial<Article>;
  onSubmit?: (values: ArticleFormValues) => void;
}

function articleToFormValues(article?: Partial<Article>): Partial<ArticleFormValues> {
  if (!article) return {};
  return {
    title: article.title,
    content: article.content,
    tags: article.tags?.join(', ') ?? '',
    language: (article.language as ArticleFormValues['language']) ?? 'en',
    published: article.published ?? true,
  };
}

export function KbForm({ open, onOpenChange, mode, defaultValues, onSubmit }: KbFormProps) {
  const { t } = useTranslation(['admin']);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ArticleFormValues>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      title: '',
      content: '',
      tags: '',
      language: 'en',
      published: true,
      ...articleToFormValues(defaultValues),
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        title: '',
        content: '',
        tags: '',
        language: 'en',
        published: true,
        ...articleToFormValues(defaultValues),
      });
    }
  }, [open, defaultValues, reset]);

  const handleFormSubmit = handleSubmit((values) => {
    onSubmit?.(values);
    onOpenChange(false);
  });

  const title =
    mode === 'create'
      ? t('admin:knowledge.createArticle')
      : t('admin:knowledge.editArticle');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? t('admin:knowledge.createDescription')
              : t('admin:knowledge.editDescription')}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleFormSubmit} className="flex flex-1 flex-col gap-4 px-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="kb-title">{t('admin:knowledge.title')}</Label>
            <Input
              id="kb-title"
              data-testid="article-form-title"
              placeholder={t('admin:knowledge.titlePlaceholder')}
              aria-invalid={!!errors.title}
              {...register('title')}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{t(errors.title.message ?? '')}</p>
            )}
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <Label htmlFor="kb-content">{t('admin:knowledge.content')}</Label>
            <textarea
              id="kb-content"
              data-testid="article-form-content"
              rows={8}
              placeholder={t('admin:knowledge.contentPlaceholder')}
              aria-invalid={!!errors.content}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              {...register('content')}
            />
            {errors.content && (
              <p className="text-xs text-destructive">{t(errors.content.message ?? '')}</p>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="kb-tags">{t('admin:knowledge.tags')}</Label>
            <Input
              id="kb-tags"
              data-testid="article-form-tags"
              placeholder={t('admin:knowledge.tagsPlaceholder')}
              {...register('tags')}
            />
            <p className="text-xs text-muted-foreground">
              {t('admin:knowledge.tagsHint')}
            </p>
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <Label>{t('admin:knowledge.language')}</Label>
            <Controller
              name="language"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Published */}
          <div className="flex items-center gap-2">
            <Controller
              name="published"
              control={control}
              render={({ field }) => (
                <input
                  id="kb-published"
                  type="checkbox"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 accent-brand"
                />
              )}
            />
            <Label htmlFor="kb-published">{t('admin:knowledge.published')}</Label>
          </div>

          <SheetFooter className="mt-auto px-0">
            <Button data-testid="article-form-submit" type="submit" disabled={isSubmitting}>
              {mode === 'create' ? t('admin:knowledge.createArticle') : t('admin:knowledge.save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
