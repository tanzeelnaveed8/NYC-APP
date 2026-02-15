import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import type { DarkMode, MapType, Precinct, Sector } from '../models';
import { getAllPreferences, setPreference } from '../db/repositories/preferenceRepository';
import { isInitialLoadComplete } from '../db/repositories/syncRepository';
import { getLawStats } from '../db/repositories/lawRepository';

interface AppState {
  // Onboarding
  isDataLoaded: boolean;
  setIsDataLoaded: (val: boolean) => void;

  // Preferences
  darkMode: DarkMode;
  setDarkModePreference: (val: DarkMode) => void;
  mapType: MapType;
  setMapTypePreference: (val: MapType) => void;
  boundaryVisible: boolean;
  setBoundaryVisiblePreference: (val: boolean) => void;
  isDark: boolean;

  // Selected precinct state (shared between map & other screens)
  selectedPrecinct: Precinct | null;
  setSelectedPrecinct: (p: Precinct | null) => void;
  selectedSector: Sector | null;
  setSelectedSector: (s: Sector | null) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [darkMode, setDarkMode] = useState<DarkMode>('system');
  const [mapType, setMapType] = useState<MapType>('standard');
  const [boundaryVisible, setBoundaryVisible] = useState(true);
  const [selectedPrecinct, setSelectedPrecinct] = useState<Precinct | null>(null);
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);

  // Determine if we should use dark theme
  const isDark =
    darkMode === 'dark' || (darkMode === 'system' && systemColorScheme === 'dark');

  // Load preferences on mount
  useEffect(() => {
    (async () => {
      try {
        const loaded = await isInitialLoadComplete();
        if (loaded) {
          // Verify data is actually there
          const stats = await getLawStats();
          if (stats.categories > 0 && stats.entries > 0) {
            setIsDataLoaded(true);
            const prefs = await getAllPreferences();
            setDarkMode(prefs.dark_mode as DarkMode);
            setMapType(prefs.map_type as MapType);
            setBoundaryVisible(prefs.boundary_visible === 'true');
          } else {
            // DB is broken, need to reload
            // Data incomplete, forcing reload
            setIsDataLoaded(false);
          }
        } else {
          setIsDataLoaded(false);
        }
      } catch (error) {
        console.error('Failed to load preferences:', error);
        setIsDataLoaded(false);
      }
    })();
  }, []);

  const setDarkModePreference = useCallback(async (val: DarkMode) => {
    setDarkMode(val);
    await setPreference('dark_mode', val);
  }, []);

  const setMapTypePreference = useCallback(async (val: MapType) => {
    setMapType(val);
    await setPreference('map_type', val);
  }, []);

  const setBoundaryVisiblePreference = useCallback(async (val: boolean) => {
    setBoundaryVisible(val);
    await setPreference('boundary_visible', val.toString());
  }, []);

  return (
    <AppContext.Provider
      value={{
        isDataLoaded,
        setIsDataLoaded,
        darkMode,
        setDarkModePreference,
        mapType,
        setMapTypePreference,
        boundaryVisible,
        setBoundaryVisiblePreference,
        isDark,
        selectedPrecinct,
        setSelectedPrecinct,
        selectedSector,
        setSelectedSector,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
