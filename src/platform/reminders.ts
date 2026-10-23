import { t } from '../i18n';
import type { ReminderSlot } from '../domain/reminders';

type NotifeeLike = {
  requestPermission: () => Promise<{ authorizationStatus?: number }>;
  createChannel: (channel: { id: string; name: string }) => Promise<string>;
  createTriggerNotification: (
    notification: {
      id: string;
      title: string;
      body: string;
      data?: Record<string, string>;
      android?: { channelId: string; smallIcon?: string; pressAction?: { id: string } };
    },
    trigger: { type: number; timestamp: number },
  ) => Promise<string>;
  getTriggerNotifications: () => Promise<Array<{ notification?: { id?: string } }>>;
  cancelNotification: (id: string) => Promise<void>;
  onForegroundEvent?: (handler: (event: { type: number; detail?: { notification?: { data?: Record<string, string> } } }) => void) => () => void;
  getInitialNotification?: () => Promise<{ notification?: { data?: Record<string, string> } } | null>;
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
          title: t('reminders.alertTitle', { name: slot.personName, occasion: slot.occasionName }),
          body: when,
          data: { personId: slot.personId },
          android: { channelId: 'occasions', smallIcon: 'ic_stat_gift', pressAction: { id: 'default' } },
        },
        { type: loaded.timestamp, timestamp: slot.at },
      );
    }
  } catch {
    // The native module is missing until pods or gradle run.
  }
}

/** Drops scheduled reminders without asking for permission. */
export async function cancelReminderPlan(): Promise<void> {
  const loaded = await loadNotifee();
  if (!loaded) {
    return;
  }
  try {
    const existing = await loaded.api.getTriggerNotifications();
    for (const item of existing) {
      const id = item.notification?.id;
      if (id?.startsWith('gifteez-')) {
        await loaded.api.cancelNotification(id);
      }
    }
  } catch {
    // Permission was never granted, so there is nothing to cancel.
  }
}

/** Opens the person when a reminder is tapped. Does not ask for permission. */
export function listenForReminderOpens(onPerson: (personId: string) => void): () => void {
  try {
    const loaded = require('@notifee/react-native') as {
      default?: NotifeeLike;
      EventType?: { PRESS?: number };
    };
    const api = loaded.default;
    if (!api?.onForegroundEvent) {
      return () => undefined;
    }
    const press = loaded.EventType?.PRESS ?? 1;
    const open = (data?: Record<string, string>) => {
      const personId = data?.personId;
      if (personId) {
        onPerson(String(personId));
      }
    };
    const stop = api.onForegroundEvent(event => {
      if (event.type === press) {
        open(event.detail?.notification?.data);
      }
    });
    api.getInitialNotification?.().then(initial => open(initial?.notification?.data)).catch(() => undefined);
    return stop;
  } catch {
    return () => undefined;
  }
}