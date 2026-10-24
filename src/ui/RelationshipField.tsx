import React, { useState } from 'react';
import { RELATIONSHIP_PRESET_KEYS, type RelationshipPresetKey } from '../domain/relationship';
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
  const presets = RELATIONSHIP_PRESET_KEYS.map(key => ({ key, label: t(`relationshipPresets.${key}`) }));
  const matched = presets.some(preset => preset.label === value);
  const [custom, setCustom] = useState(Boolean(value) && !matched);
  return (
    <>
      <Caption>{t('relationship.label')}</Caption>
      <Caption>{t('relationship.hint')}</Caption>
      <Cluster>
        {presets.map(preset => (
          <Chip
            key={preset.key}
            label={preset.label}
            selected={!custom && value === preset.label}
            onPress={() => {
              setCustom(false);
              onChange(value === preset.label ? '' : preset.label);
            }}
          />
        ))}
        <Chip
          label={t('relationship.custom')}
          selected={custom}
          onPress={() => {
            setCustom(true);
            if (matched) {
              onChange('');
            }
          }}
        />
      </Cluster>
      {custom ? (
        <Field
          label={t('relationship.custom')}
          value={matched ? '' : value}
          error={error}
          onChangeText={onChange}
        />
      ) : error ? <Caption tone="danger">{error}</Caption> : null}
    </>
  );
}

export function presetKey(label: string): RelationshipPresetKey | null {
  return RELATIONSHIP_PRESET_KEYS.find(key => t(`relationshipPresets.${key}`) === label) ?? null;
}
