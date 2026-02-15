import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { Colors } from './colors';

export const LightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: Colors.light.accent,
    primaryContainer: Colors.light.primaryContainer,
    onPrimary: Colors.light.onPrimary,
    secondary: Colors.light.secondary,
    secondaryContainer: Colors.light.secondaryContainer,
    surface: Colors.light.surface,
    surfaceVariant: Colors.light.surfaceVariant,
    onSurface: Colors.light.onSurface,
    onSurfaceVariant: Colors.light.onSurfaceVariant,
    background: Colors.light.background,
    error: Colors.light.error,
    outline: Colors.light.outline,
  },
};

export const DarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: Colors.dark.accent,
    primaryContainer: Colors.dark.primaryContainer,
    onPrimary: Colors.dark.onPrimary,
    secondary: Colors.dark.secondary,
    secondaryContainer: Colors.dark.secondaryContainer,
    surface: Colors.dark.surface,
    surfaceVariant: Colors.dark.surfaceVariant,
    onSurface: Colors.dark.onSurface,
    onSurfaceVariant: Colors.dark.onSurfaceVariant,
    background: Colors.dark.background,
    error: Colors.dark.error,
    outline: Colors.dark.outline,
  },
};

export { Colors } from './colors';
