import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, GripVertical, Plus, X } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Badge } from '@/core/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { useVoiceCodecs } from '@/core/api/hooks/use-voice-codecs';
import { CODEC_CATALOG, CODEC_PRESETS, CODEC_TIERS } from './codec-catalog';
import { availableToAdd, computeGuardrails, parseCodecs, serializeCodecs } from './codec-utils';

interface CodecSelectorProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly testId?: string;
  readonly ariaLabelledBy?: string;
  readonly ariaDescribedBy?: string;
}

const CUSTOM_TOKEN_RE = /^[a-z0-9]+$/;

export function CodecSelector({
  value,
  onChange,
  testId = 'codec',
  ariaLabelledBy,
  ariaDescribedBy,
}: Readonly<CodecSelectorProps>) {
  const { t } = useTranslation('common');
  const { data } = useVoiceCodecs();
  const installed = data?.codecs ?? null;
  const isFallback = data?.source === 'fallback';

  const selected = useMemo(() => parseCodecs(value), [value]);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [customToken, setCustomToken] = useState('');
  const [announcement, setAnnouncement] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const presetValue = useMemo(() => {
    const joined = serializeCodecs(selected);
    const match = Object.entries(CODEC_PRESETS).find(
      ([, tokens]) => serializeCodecs(tokens) === joined,
    );
    return match ? match[0] : 'custom';
  }, [selected]);

  const codecName = useCallback(
    (token: string): string => {
      const meta = CODEC_CATALOG[token];
      return meta ? `${t(meta.nameKey, token)} (${token})` : token;
    },
    [t],
  );

  const announceMove = useCallback(
    (token: string, newIndex: number, total: number) => {
      setAnnouncement(
        t(
          'voice.codecs.reordered',
          `${codecName(token)} moved to position ${newIndex + 1} of ${total}`,
          {
            codec: codecName(token),
            position: newIndex + 1,
            total,
          },
        ),
      );
    },
    [codecName, t],
  );

  const setTokens = (tokens: string[]) => onChange(serializeCodecs(tokens));

  const applyPreset = (key: string | null) => {
    if (!key || key === 'custom') return;
    const preset = CODEC_PRESETS[key];
    if (preset) setTokens([...preset]);
  };

  const addToken = (token: string) => {
    if (selected.includes(token)) return;
    setTokens([...selected, token]);
  };

  const removeAt = (index: number) => setTokens(selected.filter((_, i) => i !== index));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= selected.length) return;
    const token = selected[index];
    if (token === undefined) return;
    announceMove(token, target, selected.length);
    setTokens(arrayMove(selected, index, target));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = Number(active.id);
    const newIndex = Number(over.id);
    const token = selected[oldIndex];
    if (token !== undefined) {
      announceMove(token, newIndex, selected.length);
    }
    setTokens(arrayMove(selected, oldIndex, newIndex));
  };

  const addCustom = () => {
    const token = customToken.trim().toLowerCase();
    if (!CUSTOM_TOKEN_RE.test(token) || selected.includes(token)) return;
    setTokens([...selected, token]);
    setCustomToken('');
  };

  const addable = useMemo(
    () => availableToAdd(selected, installed, showAll),
    [selected, installed, showAll],
  );
  const filteredAddable = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return addable;
    return addable.filter(
      (e) => e.token.includes(q) || codecName(e.token).toLowerCase().includes(q),
    );
  }, [addable, search, codecName]);

  const guardrails = useMemo(() => computeGuardrails(selected, installed), [selected, installed]);

  return (
    <fieldset
      className="space-y-3 border-0 p-0 m-0"
      data-testid={testId}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
    >
      {/* Preset */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{t('voice.codecs.preset', 'Preset')}</span>
        <Select value={presetValue} onValueChange={applyPreset}>
          <SelectTrigger size="sm" className="w-56" data-testid={`${testId}-preset`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recommended">
              {t('voice.codecs.presets.recommended', 'Recommended (compatibility)')}
            </SelectItem>
            <SelectItem value="hd">{t('voice.codecs.presets.hd', 'High quality (HD)')}</SelectItem>
            <SelectItem value="lowband">
              {t('voice.codecs.presets.lowband', 'Low bandwidth')}
            </SelectItem>
            <SelectItem value="webrtc">
              {t('voice.codecs.presets.webrtc', 'WebRTC / Browser')}
            </SelectItem>
            <SelectItem value="custom">{t('voice.codecs.presets.custom', 'Custom')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Selected (orderable) */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={selected.map((_, i) => i)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1">
            {selected.map((token, index) => (
              <SelectedCodecRow
                key={`${token}-${index}`}
                id={index}
                index={index}
                total={selected.length}
                label={codecName(token)}
                badges={<CodecBadges token={token} installed={installed} />}
                onRemove={() => removeAt(index)}
                onUp={() => move(index, -1)}
                onDown={() => move(index, 1)}
                testId={`${testId}-${token}`}
                rowTestId={`${testId}-selected-${token}`}
                upTestId={`${testId}-up-${index}`}
                downTestId={`${testId}-down-${index}`}
                removeTestId={`${testId}-remove-${index}`}
                dragLabel={t('voice.codecs.dragHandle', 'Drag to reorder')}
                upLabel={t('voice.codecs.moveUp', 'Move up')}
                downLabel={t('voice.codecs.moveDown', 'Move down')}
                removeLabel={t('voice.codecs.remove', 'Remove codec')}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {/* Add catalog */}
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('voice.codecs.search', 'Search codec…')}
        data-testid={`${testId}-search`}
        aria-label={t('voice.codecs.search', 'Search codec…')}
      />
      <div className="space-y-2">
        {CODEC_TIERS.map((tier) => {
          const items = filteredAddable.filter(
            (e) => e.known && CODEC_CATALOG[e.token]?.tier === tier,
          );
          if (items.length === 0) return null;
          return (
            <CodecAddGroup
              key={tier}
              label={t(`voice.codecs.tiers.${tier}`, tier)}
              items={items}
              testId={testId}
              codecName={codecName}
              installedLabel={t('voice.codecs.badges.notInstalled', 'not installed')}
              onAdd={addToken}
            />
          );
        })}
        {(() => {
          const others = filteredAddable.filter((e) => !e.known);
          if (others.length === 0) return null;
          return (
            <CodecAddGroup
              key="others"
              label={t('voice.codecs.tiers.others', 'Others (installed)')}
              items={others}
              testId={testId}
              codecName={codecName}
              installedLabel={t('voice.codecs.badges.notInstalled', 'not installed')}
              onAdd={addToken}
            />
          );
        })()}
      </div>

      {/* Progressive disclosure */}
      <button
        type="button"
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => setShowAll((v) => !v)}
        data-testid={`${testId}-show-all`}
      >
        {showAll
          ? t('voice.codecs.showLess', 'Show fewer codecs')
          : t('voice.codecs.showAll', 'Show all codecs')}
      </button>

      {showAll && (
        <div className="flex items-center gap-2">
          <Input
            value={customToken}
            onChange={(e) => setCustomToken(e.target.value)}
            placeholder={t('voice.codecs.addCustomPlaceholder', 'e.g. speex')}
            data-testid={`${testId}-custom-input`}
            aria-label={t('voice.codecs.addCustom', 'Add custom codec')}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCustom}
            data-testid={`${testId}-custom-add`}
          >
            {t('voice.codecs.add', 'Add')}
          </Button>
        </div>
      )}

      {/* Guardrails */}
      {guardrails.map((g) => {
        const tokenSuffix = g.token ? `-${g.token}` : '';
        return (
          <p
            key={`${g.kind}-${g.token ?? ''}`}
            className="text-xs text-amber-600 dark:text-amber-500"
            data-testid={`${testId}-guardrail-${g.kind}${tokenSuffix}`}
          >
            {t(`voice.codecs.guardrails.${g.kind}`, g.kind, { token: g.token })}
          </p>
        );
      })}

      {isFallback && (
        <p className="text-xs text-muted-foreground" data-testid={`${testId}-fallback-note`}>
          {t(
            'voice.codecs.fallbackNote',
            "Couldn't verify against the server; showing the standard catalog.",
          )}
        </p>
      )}

      <div role="status" aria-live="polite" className="sr-only" data-testid={`${testId}-announcer`}>
        {announcement}
      </div>
    </fieldset>
  );
}

interface CodecBadgesProps {
  readonly token: string;
  readonly installed: readonly string[] | null;
}

function CodecBadges({ token, installed }: Readonly<CodecBadgesProps>) {
  const { t } = useTranslation('common');
  const meta = CODEC_CATALOG[token];
  const notInstalled = installed !== null && !installed.includes(token);
  return (
    <span className="inline-flex flex-wrap gap-1">
      {!meta && (
        <Badge variant="outline">
          {t('voice.codecs.badges.outsideCatalog', 'outside catalog')}
        </Badge>
      )}
      {meta?.tier === 'hd' && (
        <Badge variant="secondary">{t('voice.codecs.badges.hd', 'HD')}</Badge>
      )}
      {meta?.webrtc && (
        <Badge variant="secondary">{t('voice.codecs.badges.webrtc', 'WebRTC')}</Badge>
      )}
      {meta?.needsLicense && (
        <Badge variant="outline">{t('voice.codecs.badges.license', 'license')}</Badge>
      )}
      {meta?.needsModule && (
        <Badge variant="outline">{t('voice.codecs.badges.module', 'module')}</Badge>
      )}
      {notInstalled && (
        <Badge variant="destructive">
          {t('voice.codecs.badges.notInstalled', 'not installed')}
        </Badge>
      )}
    </span>
  );
}

interface SelectedCodecRowProps {
  readonly id: number;
  readonly index: number;
  readonly total: number;
  readonly label: string;
  readonly badges: ReactNode;
  readonly onRemove: () => void;
  readonly onUp: () => void;
  readonly onDown: () => void;
  readonly testId: string;
  readonly rowTestId: string;
  readonly upTestId: string;
  readonly downTestId: string;
  readonly removeTestId: string;
  readonly dragLabel: string;
  readonly upLabel: string;
  readonly downLabel: string;
  readonly removeLabel: string;
}

function SelectedCodecRow(props: Readonly<SelectedCodecRowProps>) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: props.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid={props.rowTestId}
      className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5"
    >
      <button
        type="button"
        aria-label={props.dragLabel}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-sm text-muted-foreground tabular-nums">{props.index + 1}.</span>
      <span className="flex-1 text-sm">{props.label}</span>
      {props.badges}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={props.upLabel}
        disabled={props.index === 0}
        onClick={props.onUp}
        data-testid={props.upTestId}
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={props.downLabel}
        disabled={props.index === props.total - 1}
        onClick={props.onDown}
        data-testid={props.downTestId}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={props.removeLabel}
        onClick={props.onRemove}
        data-testid={props.removeTestId}
      >
        <X className="h-4 w-4" />
      </Button>
    </li>
  );
}

interface CodecAddGroupProps {
  readonly label: string;
  readonly items: ReadonlyArray<{ token: string; known: boolean; installed: boolean }>;
  readonly testId: string;
  readonly codecName: (token: string) => string;
  readonly installedLabel: string;
  readonly onAdd: (token: string) => void;
}

function CodecAddGroup({
  label,
  items,
  testId,
  codecName,
  installedLabel,
  onAdd,
}: Readonly<CodecAddGroupProps>) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((entry) => (
          <Button
            key={entry.token}
            type="button"
            variant="outline"
            size="sm"
            disabled={!entry.installed}
            onClick={() => onAdd(entry.token)}
            data-testid={`${testId}-add-${entry.token}`}
          >
            <Plus className="mr-1 h-3 w-3" />
            {codecName(entry.token)}
            {!entry.installed && (
              <span className="ml-1 text-xs text-muted-foreground">({installedLabel})</span>
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}
