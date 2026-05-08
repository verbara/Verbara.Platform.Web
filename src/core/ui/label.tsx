import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

interface LabelProps extends React.ComponentProps<'label'> {
  readonly required?: boolean;
}

function Label({ className, required, children, ...props }: Readonly<LabelProps>) {
  const { t } = useTranslation();
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control -- Label primitive; consumers wire htmlFor at call-site
    <label
      data-slot="label"
      className={cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
      {required && (
        <>
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
          <span className="sr-only">{t('a11y.required')}</span>
        </>
      )}
    </label>
  );
}

export { Label };
export type { LabelProps };
