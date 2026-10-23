import { t } from '../i18n';
import type { ReminderSlot } from '../domain/reminders';

type NotifeeLike = {
  requestPermission: () => Promise<{ authorizationStatus?: number }>;
  createChannel: (channel: { id: string; name: string }) => Promise<string>;
  createTriggerNotification: (
    notification: { id: string; title: string; body: string; android?: { channelId: string } },
    trigger: { type: number; timestamp: number },
  ) => Promise<string>;
  getTriggerNotifications: () => Promise<Array<{ notification?: { id?: string } }>>;
  cancelNotification: (id: string) => Promise<void>;
};

async function loadNotifee(): Promise<{ api: NotifeeLike; timestamp: number } | null> {
  try {
    const loaded = require('@notifee/react-native') as { default?: NotifeeLike; TriggerType?: { TIMESTAMP?: number } };
    const api = loaded.default ?? (loaded as unknown as NotifeeLike);
    if (!api?.createTriggerNotification) {
      return null;
    }
    return { api, timestamp: loaded.TriggerType?.TIMESTAMP ?? 0 };
  } catch {
    return null;
  }
}

export async function requestReminderPermission(): Promise<boolean> {
  const loaded = await loadNotifee();
  if (!loaded) {
    return false;
  }
  try {
    const settings = await loaded.api.requestPermission();
    return (settings.authorizationStatus ?? 0) >= 1;
  } catch {
    return false;
  }
}

export async function applyReminderPlan(slots: ReminderSlot[]): Promise<void> {
  const loaded = await loadNotifee();
  if (!loaded) {
    return;
  }
  try {
    await loaded.api.createChannel({ id: 'occasions', name: 'Occasions' });
    const existing = await loaded.api.getTriggerNotifications();
    const nextIds = new Set(slots.map(slot => slot.id));
    for (const item of existing) {
      const id = item.notification?.id;
      if (id?.startsWith('gifteez-') && !nextIds.has(id)) {
        await loaded.api.cancelNotification(id);
      }
    }
    for (const slot of slots) {
      const when = slot.kind === 'week'
        ? t('reminders.week', { name: slot.personName, occasion: slot.occasionName })
        : t('reminders.day', { name: slot.personName, occasion: slot.occasionName });
      await loaded.api.createTriggerNotification(
        {
          id: slot.id,
          title: t('reminders.title'),
          body: when,
          android: { channelId: 'occasions' },
        },
        { type: loaded.timestamp, timestamp: slot.at },
      );
    }
  } catch {
    // The native module is missing until pods or gradle run.
  }
}