import { useEffect } from 'react';

const TITLE_SUFFIX = ' · Verbara';

function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title}${TITLE_SUFFIX}`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export { useDocumentTitle };
