import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Share } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '../../src/context/AppContext';
import { Colors } from '../../src/theme';
import { getEntryById } from '../../src/db/repositories/lawRepository';
import type { LawEntry } from '../../src/models';

// Same meta as laws list - keep consistent
const CATEGORY_META: Record<string, { icon: string; color: string; bgLight: string; label: string }> = {
  penal_law:     { icon: 'balance-scale', color: '#D32F2F', bgLight: '#FFEBEE', label: 'Penal Law' },
  vtl:           { icon: 'car-side',      color: '#2979FF', bgLight: '#E3F2FD', label: 'Vehicle & Traffic' },
  admin_code:    { icon: 'landmark',      color: '#2979FF', bgLight: '#E3F2FD', label: 'Admin Code' },
  traffic_rules: { icon: 'traffic-light', color: '#B71C1C', bgLight: '#FFEBEE', label: 'Traffic Rules' },
};
const DEFAULT_META = { icon: 'book', color: '#2979FF', bgLight: '#E3F2FD', label: 'Law' };

const fmtSec = (s: string) => s.replace(/\u00A7/g, 'Sec.').replace(/§/g, 'Sec.');

export default function LawDetailScreen() {
  const { id, highlight } = useLocalSearchParams<{ id: string; highlight?: string }>();
  const { isDark } = useAppContext();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const [entry, setEntry] = useState<LawEntry | null>(null);

  useEffect(() => {
    if (id) { (async () => setEntry(await getEntryById(parseInt(id))))(); }
  }, [id]);

  if (!entry) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  const meta = CATEGORY_META[entry.categoryId] || DEFAULT_META;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${fmtSec(entry.sectionNumber)} - ${entry.title}\n\n${entry.bodyText}`,
      });
    } catch {}
  };

  const renderHighlightedText = (text: string) => {
    if (!highlight?.trim()) {
      return <Text style={[styles.bodyText, { color: colors.textPrimary }]}>{text}</Text>;
    }
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
      <Text style={[styles.bodyText, { color: colors.textPrimary }]}>
        {parts.map((part, i) =>
          regex.test(part)
            ? <Text key={i} style={{ backgroundColor: colors.highlightBg, color: colors.highlight, fontWeight: '700' }}>{part}</Text>
            : <Text key={i}>{part}</Text>
        )}
      </Text>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ─────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: meta.color }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <FontAwesome5 name="arrow-left" size={16} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={handleShare} style={styles.headerBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <FontAwesome5 name="share-alt" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <FontAwesome5 name={meta.icon} size={24} color="rgba(255,255,255,0.9)" />
          </View>
          <Text style={styles.heroSection}>{fmtSec(entry.sectionNumber)}</Text>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{meta.label}</Text>
          </View>
        </View>
      </View>

      {/* ── Content ────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Card */}
        <View style={[styles.titleCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.titleText, { color: colors.textPrimary }]}>{entry.title}</Text>
        </View>

        {/* Body Card */}
        <View style={[styles.bodyCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <View style={styles.bodyLabel}>
            <FontAwesome5 name="file-alt" size={13} color={colors.textTertiary} />
            <Text style={[styles.bodyLabelText, { color: colors.textTertiary }]}>  FULL TEXT</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />
          {renderHighlightedText(entry.bodyText)}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: { paddingHorizontal: 16, paddingBottom: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Hero
  hero: { alignItems: 'center' },
  heroIconWrap: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  heroSection: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  heroBadge: {
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
  },
  heroBadgeText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.3 },

  // Content
  scroll: { padding: 16 },

  // Title card
  titleCard: {
    padding: 18, borderRadius: 18, borderWidth: 1,
    marginTop: -12, marginBottom: 14,
  },
  titleText: { fontSize: 20, fontWeight: '800', lineHeight: 28 },

  // Body card
  bodyCard: { padding: 18, borderRadius: 18, borderWidth: 1 },
  bodyLabel: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  bodyLabelText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  divider: { height: 1, marginBottom: 14 },
  bodyText: { fontSize: 16, lineHeight: 28 },
});
