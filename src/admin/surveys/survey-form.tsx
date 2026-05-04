import { useEffect, useCallback } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Switch } from '@/core/ui/switch';
import { Textarea } from '@/core/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/core/ui/sheet';
import {
  useCreateSurvey,
  useUpdateSurvey,
  type Survey,
  type SurveyType,
  type QuestionType,
} from '@/core/api/hooks/use-surveys';

const questionSchema = z.object({
  id: z.string(),
  text: z.string().min(1, 'admin:surveys.validation.questionTextRequired'),
  type: z.enum(['Scale', 'FreeText', 'Choice'] as const),
  options: z.string().optional(),
  order: z.number(),
});

const surveySchema = z.object({
  name: z.string().min(1, 'admin:surveys.validation.nameRequired'),
  type: z.enum(['CSAT', 'NPS', 'Custom'] as const),
  isActive: z.boolean(),
  questions: z.array(questionSchema),
});

type SurveyFormValues = z.infer<typeof surveySchema>;

interface SurveyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  survey?: Survey;
}

let _questionCounter = 0;
function nextQuestionId() {
  _questionCounter += 1;
  return `q-${Date.now()}-${_questionCounter}`;
}

const SURVEY_TYPES: SurveyType[] = ['CSAT', 'NPS', 'Custom'];
const QUESTION_TYPES: QuestionType[] = ['Scale', 'FreeText', 'Choice'];

function mapSurveyToForm(survey: Survey): SurveyFormValues {
  return {
    name: survey.name,
    type: normalizeSurveyType(survey.type),
    isActive: survey.isActive,
    questions: survey.questions.map((q, i) => ({
      id: nextQuestionId(),
      text: q.text,
      type: q.type,
      options: q.options?.join(', '),
      order: i,
    })),
  };
}

function normalizeSurveyType(type: SurveyType): 'CSAT' | 'NPS' | 'Custom' {
  const upper = (type as string).toUpperCase();
  if (upper === 'CSAT') return 'CSAT';
  if (upper === 'NPS') return 'NPS';
  return 'Custom';
}

const DEFAULT_VALUES: SurveyFormValues = {
  name: '',
  type: 'CSAT',
  isActive: true,
  questions: [],
};

export function SurveyForm({ open, onOpenChange, mode, survey }: SurveyFormProps) {
  const { t } = useTranslation(['admin']);
  const createSurvey = useCreateSurvey();
  const updateSurvey = useUpdateSurvey();

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SurveyFormValues>({
    resolver: zodResolver(surveySchema),
    defaultValues: DEFAULT_VALUES,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'questions',
  });

  useEffect(() => {
    if (open) {
      reset(survey ? mapSurveyToForm(survey) : DEFAULT_VALUES);
    }
  }, [open, survey, reset]);

  const addQuestion = useCallback(() => {
    append({
      id: nextQuestionId(),
      text: '',
      type: 'Scale',
      options: '',
      order: fields.length,
    });
  }, [append, fields.length]);

  const handleFormSubmit = handleSubmit((values) => {
    const payload = {
      name: values.name,
      type: values.type,
      isActive: values.isActive,
      questions: values.questions.map((q, idx) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        options:
          q.type === 'Choice' && q.options
            ? q.options
                .split(',')
                .map((o) => o.trim())
                .filter(Boolean)
            : undefined,
        order: idx,
      })),
    };

    if (mode === 'edit' && survey) {
      updateSurvey.mutate({ id: survey.id, ...payload });
    } else {
      createSurvey.mutate(payload);
    }
    onOpenChange(false);
  });

  const title = mode === 'create' ? t('admin:surveys.create') : t('admin:surveys.edit');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? t('admin:surveys.createDescription')
              : t('admin:surveys.editDescription')}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleFormSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="survey-name">{t('admin:surveys.name')}</Label>
            <Input
              id="survey-name"
              placeholder={t('admin:surveys.namePlaceholder')}
              aria-invalid={!!errors.name}
              data-testid="survey-form-name"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{t(errors.name.message ?? '')}</p>
            )}
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>{t('admin:surveys.type')}</Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" data-testid="survey-form-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SURVEY_TYPES.map((st) => (
                      <SelectItem key={st} value={st}>
                        {st}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Active */}
          <div className="flex items-center gap-3">
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <Switch
                  id="survey-isActive"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="survey-isActive">{t('admin:surveys.activeLabel')}</Label>
          </div>

          {/* Questions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('admin:surveys.questionsTitle')}</Label>
              <Button type="button" size="sm" variant="outline" onClick={addQuestion}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                {t('admin:surveys.addQuestion')}
              </Button>
            </div>

            {fields.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('admin:surveys.noQuestions')}</p>
            )}

            {fields.map((field, index) => {
              const qType = watch(`questions.${index}.type`);
              return (
                <div key={field.id} className="rounded-md border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {t('admin:surveys.questionN', { n: index + 1 })}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="ml-auto h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Question text */}
                  <div className="space-y-1">
                    <Textarea
                      rows={2}
                      placeholder={t('admin:surveys.questionTextPlaceholder')}
                      {...register(`questions.${index}.text`)}
                    />
                    {errors.questions?.[index]?.text && (
                      <p className="text-xs text-destructive">
                        {errors.questions[index]?.text?.message}
                      </p>
                    )}
                  </div>

                  {/* Question type */}
                  <Controller
                    name={`questions.${index}.type`}
                    control={control}
                    render={({ field: f }) => (
                      <Select value={f.value} onValueChange={f.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {QUESTION_TYPES.map((qt) => (
                            <SelectItem key={qt} value={qt}>
                              {t(`admin:surveys.questionType_${qt}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />

                  {/* Options (only for Choice) */}
                  {qType === 'Choice' && (
                    <div className="space-y-1">
                      <Label className="text-xs">{t('admin:surveys.optionsLabel')}</Label>
                      <Input
                        placeholder={t('admin:surveys.optionsPlaceholder')}
                        {...register(`questions.${index}.options`)}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('admin:surveys.optionsHint')}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={isSubmitting} data-testid="survey-form-submit">
              {mode === 'create' ? t('admin:surveys.create') : t('admin:surveys.save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
