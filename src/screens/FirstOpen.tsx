import React, { useState } from 'react';
import { cleanRelationship } from '../domain/relationship';
import { t } from '../i18n';
import { haptic } from '../platform/haptics';
import { useGifteez } from '../state/GifteezContext';
import { RelationshipField } from '../ui/RelationshipField';
import { Body, Button, Field, Screen, Title } from '../ui/ui';

export function FirstOpenScreen() {
  const { addPerson, openPerson, finishWelcome } = useGifteez();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [relationship, setRelationship] = useState('');
  const [relationshipError, setRelationshipError] = useState('');

  return (
    <Screen>
      <Title>{t('firstOpen.title')}</Title>
      <Body>{t('firstOpen.lead')}</Body>
      <Field
        label={t('firstOpen.theirName')}
        value={name}
        error={nameError}
        onChangeText={value => {
          setName(value);
          setNameError('');
        }}
      />
      <RelationshipField
        value={relationship}
        error={relationshipError}
        onChange={value => {
          setRelationship(value);
          setRelationshipError('');
        }}
      />
      <Button
        label={t('firstOpen.start')}
        onPress={async () => {
          const trimmed = name.trim();
          if (!trimmed) {
            setNameError(t('errors.name'));
            return;
          }
          const cleaned = cleanRelationship(relationship);
          if (cleaned == null) {
            setRelationshipError(t('relationship.invalid'));
            return;
          }
          const id = await addPerson({ name: trimmed, budget: '', tags: [], relationship: cleaned });
          if (!id) {
            return;
          }
          await finishWelcome();
          openPerson(id);
          haptic('success');
        }}
      />
    </Screen>
  );
}
