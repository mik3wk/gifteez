import React, { useState } from 'react';
import { isRealMonthDay } from '../domain/logic';
import {
  nextOccasionDate,
  OCCASION_PRESETS,
  occasionLabel,
  occasionNeedsDate,
  planOccasion,
  presetFor,
  type OccasionPreset,
} from '../domain/occasions';
import type { Occasion } from '../domain/types';
import { formatDate, t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { DateField } from './DateField';
import { Body, Button, Chip, Cluster, Field, Heading, Select, Stack, Toggle } from './ui';

const GROUPS: OccasionPreset['group'][] = ['holiday', 'celebration', 'life'];

export function OccasionPicker({ personId }: { personId: string }) {
  const { addOccasion } = useGifteez();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const [pickedDate, setPickedDate] = useState('');
  const [rememberYear, setRememberYear] = useState(false);
  const [customName, setCustomName] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const [everyYear, setEveryYear] = useState(true);
  const [dateError, setDateError] = useState('');
  const [nameError, setNameError] = useState('');

  const q = query.trim().toLowerCase();
  const picked = selected !== '';
  const preset = presetFor(selected);
  const needsDate = picked && occasionNeedsDate(selected);
  const asksRecurrence = picked && (selected === 'custom' || !preset || preset.rule.kind === 'ask');
  const filtered = OCCASION_PRESETS.filter(item => occasionLabel({ type: item.id }).toLowerCase().includes(q));
  const planned = planOccasion({
    type: selected,
    month: needsDate ? Number(month) || undefined : undefined,
    day: needsDate ? Number(day) || undefined : undefined,
    year: needsDate ? Number(year) || undefined : undefined,
    label: selected === 'custom' ? customName : undefined,
    recurs: asksRecurrence ? everyYear : true,
    today: new Date(),
  });
  const preview = previewLabel(planned, selected, personId);

  function choose(id: string) {
    setSelected(id);
    setDateError('');
    setNameError('');
    const next = presetFor(id);
    setEveryYear(next ? next.yearly : false);
  }

  return (
    <Stack>
      <Heading>{t('person.addOccasionHeading')}</Heading>
      <Field
        label={t('person.searchOccasions')}
        value={query}
        onChangeText={setQuery}
        placeholder={t('person.searchOccasions')}
      />
      {q ? (
        filtered.length === 0 ? <Body>{t('person.noOccasionMatch')}</Body> : (
          <Select
            label={t('person.searchOccasions')}
            value={selected}
            options={filtered.map(item => ({ id: item.id, label: occasionLabel({ type: item.id }) }))}
            onChange={choose}
          />
        )
      ) : (
        <Cluster>
          {OCCASION_PRESETS.filter(item => item.featured).map(item => (
            <Chip key={item.id} label={occasionLabel({ type: item.id })} selected={selected === item.id} onPress={() => choose(item.id)} />
          ))}
        </Cluster>
      )}
      {q ? null : (
        <Button
          label={open ? t('person.fewerOccasions') : t('person.allOccasions')}
          tone="ghost"
          onPress={() => setOpen(value => !value)}
        />
      )}
      {!q && open ? GROUPS.map(group => {
        const items = OCCASION_PRESETS.filter(item => item.group === group && !item.featured);
        if (items.length === 0) {
          return null;
        }
        return (
          <Stack key={group}>
            <Select
              label={t(`occasions.groups.${group}`)}
              value={selected}
              options={items.map(item => ({ id: item.id, label: occasionLabel({ type: item.id }) }))}
              onChange={choose}
            />
          </Stack>
        );
      }) : null}
{!q || filtered.length === 0 || t('occasions.custom').toLowerCase().includes(q) ? (
        <Chip block label={t('occasions.custom')} selected={selected === 'custom'} onPress={() => choose('custom')} />
      ) : null}
      {selected === 'custom' ? (
        <Field
          label={t('person.customName')}
          value={customName}
          error={nameError}
          onChangeText={value => {
            setCustomName(value);
            setNameError('');
          }}
        />
      ) : null}
      {needsDate ? (
        <>
          <DateField
            label={t('person.date')}
            value={pickedDate}
            error={dateError}
            onChange={iso => {
              setPickedDate(iso);
              const [yearText, monthText, dayText] = iso.split('-');
              setYear(yearText ?? '');
              setMonth(String(Number(monthText)));
              setDay(String(Number(dayText)));
              setDateError('');
            }}
          />
          <Toggle label={t('person.year')} value={rememberYear} onValueChange={setRememberYear} />
        </>
      ) : null}
      {asksRecurrence ? (
        <Toggle label={t('person.everyYear')} value={everyYear} onValueChange={setEveryYear} />
      ) : null}
      {preset?.note ? <Body>{t(preset.note)}</Body> : null}
      {!needsDate && preview ? <Body>{preview}</Body> : null}
      <Button
        label={t('person.addOccasion')}
        disabled={!picked}
        onPress={() => {
          if (selected === 'custom' && !customName.trim()) {
            setNameError(t('person.nameNeeded'));
            return;
          }
          const monthNum = Number(month);
          const dayNum = Number(day);
          if (needsDate && !isRealMonthDay(monthNum, dayNum)) {
            setDateError(t('errors.date'));
            return;
          }
          const yearNum = Number(year);
          return addOccasion(
            personId,
            selected,
            needsDate ? monthNum : undefined,
            needsDate ? dayNum : undefined,
            needsDate && rememberYear && yearNum > 0 ? yearNum : undefined,
            {
              label: selected === 'custom' ? customName.trim() : undefined,
              recurs: asksRecurrence ? everyYear : true,
            },
          );
        }}
      />
    </Stack>
  );
}

function previewLabel(
  planned: ReturnType<typeof planOccasion>,
  type: string,
  personId: string,
): string {
  if (planned === 'need-date' || planned === 'need-name') {
    return '';
  }
  const draft: Occasion = {
    id: 'draft',
    personId,
    type,
    month: planned.month,
    day: planned.day,
    ...(planned.year ? { year: planned.year } : {}),
    recurs: planned.recurs,
    ...(planned.label ? { label: planned.label } : {}),
    updatedAt: 0,
  };
  const next = nextOccasionDate(draft, new Date());
  return next ? formatDate(next) : '';
}
