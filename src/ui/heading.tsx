import { useLayoutEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { groupDisplayName, groupMarker, memberNames } from '../domain/logic';
import { t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';

export function useGroupLabel(): { label: string; emoji: string; color: string } {
  const { snapshot } = useGifteez();
  const group = snapshot.group;
  if (!group) {
    return { label: t('people.title'), emoji: '🎁', color: '#1F6B4A' };
  }
  const marker = groupMarker(group.id);
  return {
    label: groupDisplayName(group.name, memberNames(snapshot.members)),
    emoji: marker.emoji,
    color: marker.color,
  };
}

export function useGroupHeading(): { label: string; emoji: string; color: string } {
  const navigation = useNavigation();
  const heading = useGroupLabel();
  useLayoutEffect(() => {
    navigation.setOptions({ title: `${heading.emoji} ${heading.label}` });
  }, [navigation, heading.emoji, heading.label]);
  return heading;
}
