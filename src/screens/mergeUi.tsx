import React from 'react';
import { View } from 'react-native';
import type { DuplicateHint } from '../domain/merge';
import { t } from '../i18n';
import { Body, Button, Card, CheckRow, Heading } from '../ui/ui';

export function MergeChecklist({
  gifts,
  checked,
  onToggle,
}: {
  gifts: Array<{ id: string; title: string }>;
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  if (gifts.length === 0) {
    return null;
  }
  return (
    <View>
      <Heading>{t('merge.gifts')}</Heading>
      <Body>{t('merge.giftHint')}</Body>
      {gifts.map(gift => (
        <CheckRow
          key={gift.id}
          label={t('merge.giftLabel', { title: gift.title })}
          checked={checked[gift.id] !== false}
          onPress={() => onToggle(gift.id)}
        />
      ))}
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
      <Heading>{t('merge.offerTitle')}</Heading>
      {offers.map(offer => {
        const list = offer.sourceListName.trim() || t('merge.otherList');
        return (
          <Card key={`${offer.sourceGroupId}:${offer.sourcePersonId}:${offer.targetPersonId}`}>
            <Body>{t('merge.offerBody', { source: offer.sourceName, target: offer.targetName, list })}</Body>
            <Button
              label={t('merge.offerReview')}
              accessibilityLabel={t('merge.offerReviewLabel', { source: offer.sourceName, target: offer.targetName })}
              tone="secondary"
              onPress={() => onReview(offer)}
            />
            <Button
              label={t('merge.offerDismiss')}
              accessibilityLabel={t('merge.offerDismissLabel', { source: offer.sourceName, target: offer.targetName })}
              tone="ghost"
              onPress={() => onDismiss(offer)}
            />
          </Card>
        );
      })}
    </View>
  );
}
