import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DuplicateHint } from '../domain/merge';
import { t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { Body, Button, Card, Title } from '../ui/ui';

export function MergeChecklist({
  gifts,
  checked,
  onToggle,
}: {
  gifts: Array<{ id: string; title: string }>;
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const { colors } = useGifteez();
  if (gifts.length === 0) {
    return null;
  }
  return (
    <View>
      <Title accessibilityLabel={t('merge.gifts')}>{t('merge.gifts')}</Title>
      <Body>{t('merge.giftHint')}</Body>
      {gifts.map(gift => {
        const on = checked[gift.id] !== false;
        return (
          <Pressable
            key={gift.id}
            accessibilityRole="checkbox"
            accessibilityLabel={t('merge.giftLabel', { title: gift.title })}
            accessibilityState={{ checked: on }}
            onPress={() => onToggle(gift.id)}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
            <View style={[styles.box, { borderColor: colors.border, backgroundColor: on ? colors.accent : colors.surface }]} />
            <Text style={[styles.name, { color: colors.text }]}>{gift.title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DuplicateOffers({
  offers,
  onReview,
  onDismiss,
}: {
  offers: DuplicateHint[];
  onReview: (offer: DuplicateHint) => void;
  onDismiss: (offer: DuplicateHint) => void;
}) {
  if (offers.length === 0) {
    return null;
  }
  return (
    <View>
      <Title accessibilityLabel={t('merge.offerTitle')}>{t('merge.offerTitle')}</Title>
      {offers.map(offer => {
        const list = offer.sourceListName.trim() || t('merge.otherList');
        return (
          <Card key={`${offer.sourceGroupId}:${offer.sourcePersonId}:${offer.targetPersonId}`}>
            <Body>{t('merge.offerBody', { source: offer.sourceName, target: offer.targetName, list })}</Body>
            <Button
              label={t('merge.offerReview')}
              accessibilityLabel={t('merge.offerReviewLabel', { source: offer.sourceName, target: offer.targetName })}
              onPress={() => onReview(offer)}
            />
            <Button
              label={t('merge.offerDismiss')}
              accessibilityLabel={t('merge.offerDismissLabel', { source: offer.sourceName, target: offer.targetName })}
              tone="secondary"
              onPress={() => onDismiss(offer)}
            />
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingVertical: 8 },
  box: { width: 22, height: 22, borderWidth: 1, borderRadius: 4 },
  name: { fontSize: 16, flexShrink: 1 },
});
