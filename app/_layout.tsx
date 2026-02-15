import React from 'react';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { AppProvider, useAppContext } from '../src/context/AppContext';
import { LightTheme, DarkTheme } from '../src/theme';

function RootLayoutInner() {
  const { isDark } = useAppContext();
  const theme = isDark ? DarkTheme : LightTheme;

  return (
    <PaperProvider theme={theme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="laws/[id]"
          options={{
            headerShown: true,
            title: 'Law Detail',
            presentation: 'card',
          }}
        />
      </Stack>
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <AppProvider>
        <RootLayoutInner />
      </AppProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
