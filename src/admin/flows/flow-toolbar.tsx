import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Badge } from '@/core/ui/badge';

export interface FlowToolbarProps {
  flowName: string;
  version: number;
  isPublished: boolean;
  onNameChange: (name: string) => void;
}

export default function FlowToolbar({
  flowName,
  version,
  isPublished,
  onNameChange,
}: FlowToolbarProps) {
  const { t } = useTranslation(['admin']);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // Mock: PUT /api/admin/flows/{id}
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);
    toast.success(t('admin:flows.savedDraft'));
  };

  const handlePublish = async () => {
    setPublishing(true);
    // Mock: POST /api/admin/flows/{id}/publish
    await new Promise((r) => setTimeout(r, 600));
    setPublishing(false);
    toast.success(t('admin:flows.published'));
  };

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      <Input
        value={flowName}
        onChange={(e) => onNameChange(e.target.value)}
        className="h-8 w-56 text-sm font-medium"
      />

      <Badge variant={isPublished ? 'default' : 'secondary'}>
        v{version} {isPublished ? t('admin:flows.publishedLabel') : t('admin:flows.draft')}
      </Badge>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={saving} onClick={handleSave}>
          <Save className="mr-1.5 h-4 w-4" />
          {t('admin:flows.saveDraft')}
        </Button>
        <Button size="sm" disabled={publishing} onClick={handlePublish}>
          <Upload className="mr-1.5 h-4 w-4" />
          {t('admin:flows.publish')}
        </Button>
      </div>
    </div>
  );
}
