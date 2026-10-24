import React from 'react';
import { useGifteez } from '../state/GifteezContext';
import { t } from '../i18n';
import { Caption, Chip, Cluster } from './ui';

/** Optional circle while adding a person. Hidden until a circle exists. */
export function CircleField({ value, onChange }: { value: string; onChange: (circleId: string) => void }) {
  const { snapshot } = useGifteez();
  const circles = snapshot.circles ?? [];
  if (circles.length === 0) {
    return null;
  }
  return (
    <>
      <Caption>{t('fairness.pickCircle')}</Caption>
      <Cluster>
        <Chip label={t('fairness.noCircle')} selected={value === ''} onPress={() => onChange('')} />
        {circles.map(circle => (
          <Chip
            key={circle.id}
            label={circle.name}
            selected={value === circle.id}
            onPress={() => onChange(value === circle.id ? '' : circle.id)}
          />
        ))}
      </Cluster>
    </>
  );
}
