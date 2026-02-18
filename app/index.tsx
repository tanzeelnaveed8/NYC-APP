import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAppContext } from '../src/context/AppContext';
import { getDatabase } from '../src/db/database';
import { performInitialDataLoad } from '../src/services/dataLoader';

const NAVY  = '#0A1929';
const DBLUE = '#2979FF';

export default function OnboardingScreen() {
  const { setIsDataLoaded } = useAppContext();

  useEffect(() => {
    (async () => {
      try {
        await getDatabase();
      } catch {}

      setTimeout(() => {
        router.replace('/(tabs)/map');
      }, 100);

      performInitialDataLoad().then(() => {
        setIsDataLoaded(true);
      }).catch((err) => {
        console.warn('[DataLoader] Background load failed:', err);
      });
    })();
  }, []);

  return (
    <View style={styles.container}>
      <FontAwesome5 name="shield-alt" size={48} color={DBLUE} />
      <Text style={styles.title}>NYC Precinct</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
  },
});
