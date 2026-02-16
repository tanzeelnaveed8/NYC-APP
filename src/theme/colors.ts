// NYC Precinct App - White / Black / Dark Blue + Red Theme

const NAVY     = '#0A1929';   // deepest navy
const DBLUE    = '#2979FF';   // vibrant blue (main accent)
const MBLUE    = '#1E88E5';   // medium blue
const RED      = '#D32F2F';   // red for OFF / warnings
const DRED     = '#B71C1C';   // darker red

export const Colors = {
  light: {
    // Primary - Navy (headers)
    primary: NAVY,
    primaryLight: DBLUE,
    primaryContainer: '#D6E4F5',
    onPrimary: '#FFFFFF',
    onPrimaryContainer: NAVY,

    // Accent - Dark Blue
    accent: DBLUE,
    accentLight: MBLUE,

    // Secondary
    secondary: MBLUE,
    secondaryContainer: '#DAEAF5',
    onSecondary: '#FFFFFF',

    // Surface & Background - Pure White
    surface: '#FFFFFF',
    surfaceVariant: '#F4F6F9',
    surfaceElevated: '#FFFFFF',
    background: '#FFFFFF',
    onSurface: '#000000',
    onSurfaceVariant: '#4A5568',

    // Status - Red
    error: RED,
    errorContainer: '#FFEBEE',
    success: DBLUE,
    successContainer: '#E3EDF5',
    warning: RED,

    // Calendar
    dutyDay: DBLUE,
    rdoDay: RED,

    // Highlight
    highlight: RED,
    highlightBg: 'rgba(211,47,47,0.10)',

    // Borough colors
    boroughManhattan: '#D32F2F',
    boroughBrooklyn: '#D32F2F',
    boroughBronx: '#D32F2F',
    boroughQueens: '#D32F2F',
    boroughStatenIsland: '#D32F2F',

    // Map — red precincts
    mapOverlayFill: 'rgba(211,47,47,0.18)',
    mapOverlayStroke: '#D32F2F',
    mapSelectedFill: 'rgba(211,47,47,0.40)',
    mapSelectedStroke: '#B71C1C',
    mapSectorFill: 'rgba(255,167,38,0.22)',
    mapSectorStroke: '#FFA726',
    mapSectorSelectedFill: 'rgba(255,111,0,0.38)',
    mapSectorSelectedStroke: '#FF6D00',

    // Tab & Nav
    tabBar: '#FFFFFF',
    tabBarBorder: '#E8ECF0',
    tabBarActive: DBLUE,
    tabBarInactive: '#9AA5B4',

    // Card
    cardBg: '#FFFFFF',
    cardBorder: '#E5E9EF',

    // Text - Black
    textPrimary: '#000000',
    textSecondary: '#4A5568',
    textTertiary: '#8A94A6',
    textLink: DBLUE,

    // Divider
    divider: '#E5E9EF',
    outline: '#CBD2DC',
  },

  dark: {
    // Primary - Navy
    primary: '#060E18',
    primaryLight: MBLUE,
    primaryContainer: '#0D1B2A',
    onPrimary: '#FFFFFF',
    onPrimaryContainer: '#C8D8E8',

    // Accent - Blue for dark bg
    accent: '#82B1FF',
    accentLight: '#448AFF',

    // Secondary
    secondary: '#5C9CE6',
    secondaryContainer: '#0D2A40',
    onSecondary: '#FFFFFF',

    // Surface & Background - True Black
    surface: '#0A0A0A',
    surfaceVariant: '#141414',
    surfaceElevated: '#1A1A1A',
    background: '#000000',
    onSurface: '#FFFFFF',
    onSurfaceVariant: '#A0AAB8',

    // Status - Red
    error: '#EF5350',
    errorContainer: '#2C0A0A',
    success: '#82B1FF',
    successContainer: '#0D2137',
    warning: '#EF5350',

    // Calendar
    dutyDay: '#82B1FF',
    rdoDay: '#EF5350',

    // Highlight
    highlight: '#EF5350',
    highlightBg: 'rgba(239,83,80,0.15)',

    // Borough colors
    boroughManhattan: '#EF5350',
    boroughBrooklyn: '#EF5350',
    boroughBronx: '#EF5350',
    boroughQueens: '#EF5350',
    boroughStatenIsland: '#EF5350',

    // Map — red precincts
    mapOverlayFill: 'rgba(239,83,80,0.18)',
    mapOverlayStroke: '#EF5350',
    mapSelectedFill: 'rgba(239,83,80,0.40)',
    mapSelectedStroke: '#D32F2F',
    mapSectorFill: 'rgba(255,183,77,0.22)',
    mapSectorStroke: '#FFB74D',
    mapSectorSelectedFill: 'rgba(255,167,38,0.42)',
    mapSectorSelectedStroke: '#FFA726',

    // Tab & Nav
    tabBar: '#0A0A0A',
    tabBarBorder: '#1A1A1A',
    tabBarActive: '#82B1FF',
    tabBarInactive: '#4A5568',

    // Card
    cardBg: '#0F0F0F',
    cardBorder: '#1E1E1E',

    // Text - White
    textPrimary: '#FFFFFF',
    textSecondary: '#A0AAB8',
    textTertiary: '#5A6370',
    textLink: '#82B1FF',

    // Divider
    divider: '#1E1E1E',
    outline: '#2A2A2A',
  },
} as const;

export type ColorScheme = typeof Colors.light | typeof Colors.dark;

export function getBoroughColor(borough: string, scheme: ColorScheme): string {
  switch (borough) {
    case 'Manhattan': return scheme.boroughManhattan;
    case 'Brooklyn': return scheme.boroughBrooklyn;
    case 'Bronx': return scheme.boroughBronx;
    case 'Queens': return scheme.boroughQueens;
    case 'Staten Island': return scheme.boroughStatenIsland;
    default: return scheme.accent;
  }
}
