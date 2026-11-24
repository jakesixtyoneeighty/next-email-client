'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function MessageHtmlFrame({
  srcDoc,
  title,
}: {
  srcDoc: string;
  title: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [height, setHeight] = useState(120);

  const attachAndMeasure = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;

    const iframe = iframeRef.current;
    if (!iframe) return;

    let doc: Document | null = null;
    try {
      doc = iframe.contentDocument;
    } catch {
      return;
    }
    if (!doc) return;

    const root = doc.getElementById('mail-root');
    if (!root) return;

    const measure = () => {
      const currentRoot = doc?.getElementById('mail-root');
      if (!currentRoot || !doc) return;
      const hasHorizontalOverflow =
        doc.documentElement.scrollWidth > doc.documentElement.clientWidth + 1;
      const nextHeight = Math.max(
        48,
        Math.ceil(
          Math.max(
            currentRoot.scrollHeight,
            currentRoot.getBoundingClientRect().height,
          ),
        ) + (hasHorizontalOverflow ? 16 : 0),
      );
      setHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    measure();

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(measure)
        : null;
    observer?.observe(root);

    const trackedImages: HTMLImageElement[] = [];
    for (const img of Array.from(doc.images)) {
      if (!img.complete) {
        img.addEventListener('load', measure, { once: true });
        img.addEventListener('error', measure, { once: true });
        trackedImages.push(img);
      }
    }

    window.addEventListener('resize', measure);

    cleanupRef.current = () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      for (const img of trackedImages) {
        img.removeEventListener('load', measure);
        img.removeEventListener('error', measure);
      }
    };
  }, []);

  useEffect(() => {
    attachAndMeasure();
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [srcDoc, attachAndMeasure]);

  return (
    <iframe
      ref={iframeRef}
      className="message-html-frame"
      title={title}
      srcDoc={srcDoc}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      style={{ height }}
      onLoad={attachAndMeasure}
    />
  );
}
