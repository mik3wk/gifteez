import React, { useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStack } from '../app/navigation';
import { giftsOnList, peopleOnOtherLists } from '../domain/merge';
import { t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { Body, Button, Screen, Title } from '../ui/ui';
import { MergeChecklist } from './mergeUi';

export function MergeScreen() {
  const route = useRoute<RouteProp<RootStack, 'SamePerson'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { snapshot, mergePeople } = useGifteez();
  const target = snapshot.people.find(person => person.id === route.params.personId && !person.deleted);
  const others = peopleOnOtherLists(snapshot);
  const preset = route.params.sourcePersonId && route.params.sourceGroupId
    ? { personId: route.params.sourcePersonId, groupId: route.params.sourceGroupId }
    : null;
  const [picked, setPicked] = useState<{ personId: string; groupId: string } | null>(preset);
  const [checked, setChecked] = useState<Record<string, boolean>>(() => initialChecked(snapshot, preset));
  if (!target) {
    return (
      <Screen>
        <Title>{t('errors.generic')}</Title>
        <Body>{t('errors.generic')}</Body>
        <Button label={t('common.back')} onPress={() => navigation.goBack()} />
      </Screen>
    );
  }
  const gifts = picked ? giftsOnList(snapshot, picked.groupId, picked.personId) : [];
  const source = picked ? others.find(item => item.personId === picked.personId && item.groupId === picked.groupId) : undefined;
  const sourceLabel = source?.name ?? t('merge.otherList');
  return (
    <Screen>
      <Title accessibilityLabel={t('merge.title')}>{t('merge.title')}</Title>
      <Body>{t('merge.privateNote')}</Body>
      {picked ? (
        <>
          <Body>{t('merge.fromList', { name: sourceLabel, list: source?.listName.trim() || t('merge.otherList') })}</Body>
          <Body>{t('merge.confirmBody')}</Body>
          <MergeChecklist
            gifts={gifts.map(gift => ({ id: gift.id, title: gift.title }))}
            checked={checked}
            onToggle={id => setChecked(current => ({ ...current, [id]: current[id] === false }))}
          />
          <Button
            label={t('merge.confirm')}
            accessibilityLabel={t('merge.confirmLabel', { source: sourceLabel, target: target.name })}
            onPress={async () => {
              const sharedGiftIds = gifts.filter(gift => checked[gift.id] !== false).map(gift => gift.id);
              const ok = await mergePeople({
                targetPersonId: target.id,
                sourcePersonId: picked.personId,
                sourceGroupId: picked.groupId,
                sharedGiftIds,
              });
              if (ok) {
                navigation.goBack();
              }
            }}
          />
          <Button
            label={t('merge.cancel')}
            accessibilityLabel={t('merge.cancel')}
            tone="secondary"
            onPress={() => navigation.goBack()}
          />
        </>
      ) : (
        <>
          <Body>{others.length === 0 ? t('merge.empty') : t('merge.pick')}</Body>
          {others.map(person => {
            const list = person.listName.trim() || t('merge.otherList');
            return (
              <Button
                key={`${person.groupId}:${person.personId}`}
                label={t('merge.fromList', { name: person.name, list })}
                accessibilityLabel={t('merge.pickLabel', { name: person.name, list })}
                tone="secondary"
                onPress={() => {
                  const next = { personId: person.personId, groupId: person.groupId };
                  setPicked(next);
                  setChecked(initialChecked(snapshot, next));
                }}
              />
            );
          })}
        </>
      )}
    </Screen>
  );
}

function initialChecked(
  snapshot: Parameters<typeof giftsOnList>[0],
  picked: { personId: string; groupId: string } | null,
): Record<string, boolean> {
  if (!picked) {
    return {};
  }
  const checked: Record<string, boolean> = {};
  giftsOnList(snapshot, picked.groupId, picked.personId).forEach(gift => {
    checked[gift.id] = true;
  });
  return checked;
}
