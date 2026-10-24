import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isRealMonthDay } from '../domain/logic';
import {
  nextOccasionDate,
  OCCASION_PRESETS,
  occasionLabel,
  occasionNeedsDate,
  openingMonthDay,
  planOccasion,
  presetFor,
  type OccasionPreset,
} from '../domain/occasions';
import type { Occasion } from '../domain/types';
import { formatDate, t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { MonthDayField } from './DateField';
import { Body, Button, Caption, Chip, Cluster, Field, Select, Stack, Toggle, useSheetFooter } from './ui';

const GROUPS: OccasionPreset['group'][] = ['holiday', 'celebration', 'life'];

export function OccasionPicker({
  personId,
  onAdded,
  onDirty,
}: {
  personId: string;
  onAdded?: (occasionId?: string) => void;
  onDirty?: (dirty: boolean) => void;
}) {
  const { addOccasion, snapshot } = useGifteez();
  const setFooter = useSheetFooter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const [knowYear, setKnowYear] = useState(false);
  const [customName, setCustomName] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const [everyYear, setEveryYear] = useState(true);
  const [dateError, setDateError] = useState('');
  const [nameError, setNameError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [also, setAlso] = useState<string[]>([]);

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
  const others = snapshot.people.filter(person => !person.deleted && person.id !== personId);
  const holiday = preset?.group === 'holiday';
  const occasionName = selected ? occasionLabel({ type: selected }) : '';
  const submitRef = useRef<() => void>(() => undefined);
  submitRef.current = () => {
    void submit();
  };
  const draftDirty = Boolean(
    query.trim()
    || selected
    || customName.trim()
    || month
    || day
    || year
    || knowYear
    || !everyYear
    || also.length,
  );
  useEffect(() => {
    onDirty?.(draftDirty);
  }, [draftDirty, onDirty]);
  useEffect(() => () => onDirty?.(false), [onDirty]);

  const buttonLabel = also.length > 0 && occasionName
    ? t('person.addForEveryone', { occasion: occasionName })
    : t('person.addOccasion');
  const showHint = attempted && !picked;

  useLayoutEffect(() => {
    if (!setFooter) {
      return undefined;
    }
    setFooter(
      <Stack>
        {showHint ? <Caption tone="danger">{t('person.pickOccasionFirst')}</Caption> : null}
        <Button label={buttonLabel} onPress={() => submitRef.current()} />
      </Stack>,
    );
    return () => setFooter(null);
  }, [buttonLabel, setFooter, showHint]);

  function choose(id: string) {
    setSelected(id);
    setDateError('');
    setNameError('');
    const next = presetFor(id);
    setEveryYear(next ? next.yearly : false);
    const opening = openingMonthDay(id);
    setMonth(String(opening.month));
    setDay(String(opening.day));
    setYear('');
    setKnowYear(false);
    setAlso([]);
    setAttempted(false);
  }

  async function submit() {
    setAttempted(true);
    const nameMissing = selected === 'custom' && !customName.trim();
    const monthNum = Number(month);
    const dayNum = Number(day);
    const dateMissing = needsDate && !isRealMonthDay(monthNum, dayNum);
    const yearNum = Number(year);
    const yearMissing = needsDate && knowYear && !(yearNum > 0);
    setNameError(nameMissing ? t('person.nameNeeded') : '');
    setDateError(dateMissing ? t('errors.date') : yearMissing ? t('person.yearMissing') : '');
    if (!picked || nameMissing || dateMissing || yearMissing) {
      return;
    }
    const id = await addOccasion(
      personId,
      selected,
      needsDate ? monthNum : undefined,
      needsDate ? dayNum : undefined,
      needsDate && knowYear && yearNum > 0 ? yearNum : undefined,
      {
        label: selected === 'custom' ? customName.trim() : undefined,
        recurs: asksRecurrence ? everyYear : true,
      },
    );
    if (holiday) {
      for (const otherId of also) {
        await addOccasion(
          otherId,
          selected,
          needsDate ? monthNum : undefined,
          needsDate ? dayNum : undefined,
          needsDate && knowYear && yearNum > 0 ? yearNum : undefined,
          { recurs: true },
        );
      }
    }
    if (id) {
      onAdded?.(id);
    }
  }

  return (
    <Stack>
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
        <MonthDayField
          label={t('person.date')}
          month={month}
          day={day}
          year={year}
          knowYear={knowYear}
          error={dateError}
          onKnowYear={value => {
            setKnowYear(value);
            if (!value) {
              setYear('');
            }
            setDateError('');
          }}
          onChange={next => {
            setMonth(next.month);
            setDay(next.day);
            setYear(next.year);
            setDateError('');
          }}
        />
      ) : null}
      {asksRecurrence ? (
        <Toggle label={t('person.everyYear')} value={everyYear} onValueChange={setEveryYear} />
      ) : null}
      {preset?.note ? <Body>{t(preset.note)}</Body> : null}
      {!needsDate && preview ? <Body>{preview}</Body> : null}
      {holiday && others.length > 0 ? (
        <Stack>
          <Body>{t('person.addForEveryone', { occasion: occasionName })}</Body>
          <Cluster>
            {others.map(person => {
              const selectedPerson = also.includes(person.id);
              return (
                <Chip
                  key={person.id}
                  label={person.name}
                  selected={selectedPerson}
                  onPress={() => setAlso(current => (
                    selectedPerson ? current.filter(id => id !== person.id) : [...current, person.id]
                  ))}
                />
              );
            })}
          </Cluster>
        </Stack>
      ) : null}
      {setFooter ? null : (
        <Stack>
          {showHint ? <Caption tone="danger">{t('person.pickOccasionFirst')}</Caption> : null}
          <Button label={buttonLabel} onPress={() => submitRef.current()} />
        </Stack>
      )}
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
