import React, { useState } from 'react';
import { useGifteez } from '../state/GifteezContext';
import { t } from '../i18n';
import { Button, Caption, Chip, Cluster, Field } from './ui';

/** Optional circle. Includes a way to make one when none exist yet. */
export function CircleField({ value, onChange }: { value: string; onChange: (circleId: string) => void }) {
  const { snapshot, createCircle } = useGifteez();
  const circles = snapshot.circles ?? [];
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  async function create() {
    const id = await createCircle(draft);
    if (!id) {
      setError(t('fairness.nameInvalid'));
      return;
    }
    setNaming(false);
    setDraft('');
    setError('');
    onChange(id);
  }

  return (
    <>
      <Caption>{t('fairness.pickCircle')}</Caption>
      <Cluster>
        <Chip label={t('fairness.noCircle')} selected={value === '' && !naming} onPress={() => { setNaming(false); onChange(''); }} />
        {circles.map(circle => (
          <Chip
            key={circle.id}
            label={circle.name}
            selected={value === circle.id && !naming}
            onPress={() => {
              setNaming(false);
              onChange(circle.id);
            }}
          />
        ))}
        <Chip label={t('fairness.newCircleOption')} selected={naming} onPress={() => { setNaming(true); setError(''); }} />
      </Cluster>
      {naming ? (
        <>
          <Field
            label={t('fairness.circleName')}
            value={draft}
            error={error}
            onChangeText={text => {
              setDraft(text);
              setError('');
            }}
          />
          <Button label={t('fairness.create')} onPress={() => { create().catch(() => undefined); }} />
        </>
      ) : null}
    </>
  );
}
