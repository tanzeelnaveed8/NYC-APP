import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, ProgressBar } from 'react-native-paper';
import { FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAppContext } from '../src/context/AppContext';
import { performInitialDataLoad, LoadProgress } from '../src/services/dataLoader';

const NAVY  = '#0A1929';
const DBLUE = '#2979FF';
const RED   = '#D32F2F';

export default function OnboardingScreen() {
  const { isDataLoaded, setIsDataLoaded } = useAppContext();
  const [progress, setProgress] = useState<LoadProgress>({ stage: '', progress: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDataLoaded) router.replace('/(tabs)/map');
  }, [isDataLoaded]);

  const startLoad = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await performInitialDataLoad((p) => setProgress(p));
      setIsDataLoaded(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to load data.');
      setLoading(false);
    }
  }, [setIsDataLoaded]);

  useEffect(() => {
    if (!isDataLoaded && !loading) startLoad();
  }, []);

  if (isDataLoaded) return null;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Icon */}
        <View style={styles.iconCircle}>
          <FontAwesome5 name="shield-alt" size={36} color={DBLUE} />
        </View>

        <Text style={styles.title}>NYC Precinct</Text>
        <Text style={styles.subtitle}>Field Reference App</Text>

        {/* Progress */}
        {loading && !error && (
          <View style={styles.progressBox}>
            <ProgressBar progress={progress.progress} color={DBLUE} style={styles.bar} />
            <Text style={styles.stage}>{progress.stage || 'Preparing...'}</Text>
            <Text style={styles.percent}>{Math.round(progress.progress * 100)}%</Text>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <FontAwesome5 name="exclamation-circle" size={22} color={RED} />
            <Text style={styles.errorText}>{error}</Text>
            <Button mode="contained" onPress={startLoad} buttonColor={DBLUE} textColor="#fff" style={{ marginTop: 12 }}>
              Retry
            </Button>
          </View>
        )}

        {!loading && !error && (
          <Button mode="contained" onPress={startLoad} buttonColor={DBLUE} textColor="#fff" style={{ marginTop: 20 }}>
            Get Started
          </Button>
        )}

        <Text style={styles.footer}>
          Precinct boundaries  ·  RDO calendar  ·  Law library
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 36,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(27,58,92,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#4A5568',
    marginTop: 4,
    marginBottom: 24,
  },
  progressBox: { width: '100%', alignItems: 'center' },
  bar: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E9EF',
  },
  stage: { fontSize: 13, color: '#4A5568', marginTop: 12, textAlign: 'center' },
  percent: { fontSize: 11, color: '#8A94A6', marginTop: 4 },
  errorBox: { alignItems: 'center', width: '100%' },
  errorText: { color: RED, fontSize: 13, textAlign: 'center', marginTop: 8 },
  footer: { fontSize: 11, color: '#8A94A6', marginTop: 24, textAlign: 'center' },
});
