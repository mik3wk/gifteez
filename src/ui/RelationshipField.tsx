import React, { useState } from 'react';
import {
  DEFAULT_RELATIONSHIP_KEYS,
  RELATIONSHIP_PRESET_KEYS,
  relationshipKey,
  type RelationshipPresetKey,
} from '../domain/relationship';
import { t } from '../i18n';
import { Caption, Chip, Cluster, Field } from './ui';

export function RelationshipField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const selectedKey = relationshipKey(value);
  const [custom, setCustom] = useState(Boolean(value.trim()) && selectedKey == null);
  const [expanded, setExpanded] = useState(false);
  const extra = selectedKey && !(DEFAULT_RELATIONSHIP_KEYS as readonly string[]).includes(selectedKey) ? selectedKey : null;
  const shown: RelationshipPresetKey[] = expanded
    ? [...RELATIONSHIP_PRESET_KEYS]
    : extra
      ? [...DEFAULT_RELATIONSHIP_KEYS, extra]
      : [...DEFAULT_RELATIONSHIP_KEYS];
  return (
    <>
      <Caption>{t('relationship.label')}</Caption>
      <Caption>{t('relationship.hint')}</Caption>
      <Cluster>
        {shown.map(key => (
          <Chip
            key={key}
            label={t(`relationshipPresets.${key}`)}
            selected={!custom && selectedKey === key}
            onPress={() => {
              setCustom(false);
              onChange(selectedKey === key ? '' : key);
            }}
          />
        ))}
        {expanded ? null : (
          <Chip label={t('relationship.more')} selected={false} onPress={() => setExpanded(true)} />
        )}
        <Chip
          label={t('relationship.custom')}
          selected={custom}
          onPress={() => {
            setCustom(true);
            if (selectedKey) {
              onChange('');
            }
          }}
        />
      </Cluster>
      {custom ? (
        <Field
          label={t('relationship.custom')}
          value={selectedKey ? '' : value}
          error={error}
          onChangeText={onChange}
        />
      ) : error ? <Caption tone="danger">{error}</Caption> : null}
    </>
  );
}
