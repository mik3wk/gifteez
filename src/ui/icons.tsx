import React from 'react';
import Svg, { Path } from 'react-native-svg';

const PATHS = {
  check: 'M20 6L9 17l-5-5',
  chevron: 'M9 18l6-6-6-6',
  close: 'M18 6L6 18M6 6l12 12',
  heart: 'M19.5 12.6 12 20l-7.5-7.4C2.4 10.4 2.6 6.5 5.6 5.2 7.6 4.3 9.8 5 12 7c2.2-2 4.4-2.7 6.4-1.8 3 1.3 3.2 5.2 1.1 7.4z',
  gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13a7.8 7.8 0 0 0 .1-2l2-1.2-2-3.4-2.3.6a8 8 0 0 0-1.7-1L15 3h-6l-.5 2.5a8 8 0 0 0-1.7 1L4.5 6.4l-2 3.4L4.5 11a7.8 7.8 0 0 0 .1 2l-2 1.2 2 3.4 2.3-.6a8 8 0 0 0 1.7 1L9 21h6l.5-2.5a8 8 0 0 0 1.7-1l2.3.6 2-3.4-2-1.2z',
  home: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  scale: 'M12 3v18M3 8h18M6 8l-3 6a4 4 0 0 0 6 0L6 8zM18 8l-3 6a4 4 0 0 0 6 0l-3-6z',
  gift: 'M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8M2 7h20v5H2zM12 22V7M12 7c0-3-2-5-4.5-4S6 6 12 7c0-3 2-5 4.5-4S18 6 12 7',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7M13.7 21a2 2 0 0 1-3.4 0',
  plus: 'M12 5v14M5 12h14',
  calendar: 'M8 3v3M16 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  more: 'M6 10a2 2 0 1 0 .01 4A2 2 0 0 0 6 10zM12 10a2 2 0 1 0 .01 4A2 2 0 0 0 12 10zM18 10a2 2 0 1 0 .01 4A2 2 0 0 0 18 10z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  color,
  size = 22,
  filled,
}: {
  name: IconName;
  color: string;
  size?: number;
  filled?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        d={PATHS[name]}
        stroke={color}
        strokeWidth={1.5}
        fill={filled ? color : 'none'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
