import React, { useEffect, useState } from 'react';
import { storeRelationship } from '../domain/relationship';
import { t } from '../i18n';
import { haptic } from '../platform/haptics';
import { useGifteez } from '../state/GifteezContext';
import { CircleField } from '../ui/CircleField';
import { RelationshipField } from '../ui/RelationshipField';
import { Body, Button, Field, Screen, Title } from '../ui/ui';

export function FirstOpenScreen() {
  const { addPerson, openPerson, finishWelcome, completedPersonId, clearCompletedPerson } = useGifteez();
  useEffect(() => {
    if (!completedPersonId) {
      return;
    }
    const personId = completedPersonId;
    clearCompletedPerson();
    openPerson(personId);
    finishWelcome().then(() => haptic('success')).catch(() => undefined);
  }, [clearCompletedPerson, completedPersonId, finishWelcome, openPerson]);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [relationship, setRelationship] = useState('');
  const [relationshipError, setRelationshipError] = useState('');
  const [circleId, setCircleId] = useState('');

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
      <CircleField value={circleId} onChange={setCircleId} />
      <Button
        label={t('firstOpen.start')}
        onPress={async () => {
          const trimmed = name.trim();
          if (!trimmed) {
            setNameError(t('errors.name'));
            return;
          }
          const cleaned = storeRelationship(relationship);
          if (cleaned == null) {
            setRelationshipError(t('relationship.invalid'));
            return;
          }
          const id = await addPerson({
            name: trimmed,
            budget: '',
            tags: [],
            relationship: cleaned,
            ...(circleId ? { circleId } : {}),
          });
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
