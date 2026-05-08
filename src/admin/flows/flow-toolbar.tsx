import { useTranslation } from 'react-i18next';
import { Save, Upload } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Badge } from '@/core/ui/badge';

export interface FlowToolbarProps {
  flowName: string;
  version: number;
  isPublished: boolean;
  onNameChange: (name: string) => void;
  onSave?: () => void;
  onPublish?: () => void;
  isSaving?: boolean;
  isPublishing?: boolean;
}

export default function FlowToolbar({
  flowName,
  version,
  isPublished,
  onNameChange,
  onSave,
  onPublish,
  isSaving = false,
  isPublishing = false,
}: FlowToolbarProps) {
  const { t } = useTranslation(['admin']);

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      <Input
        value={flowName}
        onChange={(e) => onNameChange(e.target.value)}
        aria-label={t('admin:flows.toolbar.flow_name_aria', 'Flow name')}
        className="h-8 w-56 text-sm font-medium"
      />

      <Badge variant={isPublished ? 'default' : 'secondary'}>
        v{version} {isPublished ? t('admin:flows.publishedLabel') : t('admin:flows.draft')}
      </Badge>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={isSaving} onClick={onSave}>
          <Save className="mr-1.5 h-4 w-4" />
          {t('admin:flows.saveDraft')}
        </Button>
        <Button size="sm" disabled={isPublishing} onClick={onPublish}>
          <Upload className="mr-1.5 h-4 w-4" />
          {t('admin:flows.publish')}
        </Button>
      </div>
    </div>
  );
}
