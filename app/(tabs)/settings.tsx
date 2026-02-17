import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useAppContext } from '../../src/context/AppContext';
import { Colors } from '../../src/theme';
import { getAllFavorites, removeFavorite } from '../../src/db/repositories/favoriteRepository';
import { getPrecinctByNumber } from '../../src/db/repositories/precinctRepository';
import type { Favorite } from '../../src/models';

interface FavPlus extends Favorite { precinctName?: string; }

export default function SettingsScreen() {
  const {
    isDark, darkMode, setDarkModePreference,
    mapType, setMapTypePreference,
    setSelectedPrecinct,
  } = useAppContext();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const [favorites, setFavorites] = useState<FavPlus[]>([]);

  const loadFavs = useCallback(async () => {
    const favs = await getAllFavorites();
    const withNames = await Promise.all(
      favs.map(async (f) => {
        const p = await getPrecinctByNumber(f.precinctNum);
        return { ...f, precinctName: p?.name };
      })
    );
    setFavorites(withNames);
  }, []);

  useFocusEffect(useCallback(() => { loadFavs(); }, [loadFavs]));

  const goToFav = async (f: FavPlus) => {
    const p = await getPrecinctByNumber(f.precinctNum);
    if (p) { setSelectedPrecinct(p); router.navigate('/(tabs)/map'); }
  };

  const delFav = (f: FavPlus) => {
    Alert.alert('Remove Favorite', `Remove "${f.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await removeFavorite(f.precinctNum); loadFavs(); } },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.primary }]}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ── Favorites ───────────────────────── */}
        <SectionLabel label="FAVORITES" color={colors.textTertiary} />
        {favorites.length === 0 ? (
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={styles.emptyFav}>
              <MaterialCommunityIcons name="star-outline" size={28} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No favorites yet</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            {favorites.map((fav, i) => (
              <React.Fragment key={fav.favoriteId}>
                <TouchableOpacity style={styles.favRow} onPress={() => goToFav(fav)}>
                  <MaterialCommunityIcons name="star" size={20} color="#2979FF" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.favLabel, { color: colors.textPrimary }]}>{fav.label}</Text>
                    <Text style={[styles.favSub, { color: colors.textTertiary }]}>{fav.precinctName || `Precinct #${fav.precinctNum}`}</Text>
                  </View>
                  <TouchableOpacity onPress={() => delFav(fav)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.error} />
                  </TouchableOpacity>
                </TouchableOpacity>
                {i < favorites.length - 1 && <Divider style={{ backgroundColor: colors.divider }} />}
              </React.Fragment>
            ))}
          </View>
        )}

        {/* ── Map Settings ────────────────────── */}
        <SectionLabel label="MAP TYPE" color={colors.textTertiary} />
        <View style={styles.mapTypeRow}>
          {([
            { val: 'standard' as const, label: 'Standard', icon: 'map-outline' },
            { val: 'satellite' as const, label: 'Satellite', icon: 'satellite-variant' },
            { val: 'terrain' as const, label: 'Terrain', icon: 'terrain' },
          ]).map(({ val, label, icon }) => {
            const isActive = mapType === val;
            return (
              <TouchableOpacity
                key={val}
                style={[
                  styles.mapTypeBtn,
                  { backgroundColor: isActive ? colors.accent : colors.cardBg, borderColor: isActive ? colors.accent : colors.cardBorder },
                ]}
                onPress={() => setMapTypePreference(val)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name={icon as any} size={24} color={isActive ? '#fff' : colors.textSecondary} />
                <Text style={[styles.mapTypeBtnText, { color: isActive ? '#fff' : colors.textSecondary }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>


        {/* ── Appearance ──────────────────────── */}
        <SectionLabel label="APPEARANCE" color={colors.textTertiary} />
        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          {([
            { val: 'system', label: 'System Default', icon: 'cellphone' },
            { val: 'light', label: 'Light', icon: 'white-balance-sunny' },
            { val: 'dark', label: 'Dark', icon: 'moon-waning-crescent' },
          ] as const).map(({ val, label, icon }) => (
            <TouchableOpacity key={val} style={styles.radioRow} onPress={() => setDarkModePreference(val)}>
              <MaterialCommunityIcons name={icon as any} size={20} color={darkMode === val ? colors.accent : colors.textTertiary} style={{ marginRight: 12 }} />
              <Text style={[styles.radioLabel, { color: colors.textPrimary, flex: 1 }]}>{label}</Text>
              <View style={[styles.radio, darkMode === val && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                {darkMode === val && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── About ───────────────────────────── */}
        <SectionLabel label="ABOUT" color={colors.textTertiary} />
        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <InfoRow icon="information-outline" label="Version" value="1.0.0" colors={colors} />
          <Divider style={{ backgroundColor: colors.divider }} />
          <InfoRow icon="database-outline" label="Data Source" value="Google Maps" colors={colors} />
          <Divider style={{ backgroundColor: colors.divider }} />
          <InfoRow icon="shield-check-outline" label="Precincts" value="25 loaded" colors={colors} />
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function SectionLabel({ label, color }: { label: string; color: string }) {
  return <Text style={[styles.sectionLabel, { color }]}>{label}</Text>;
}

function InfoRow({ icon, label, value, colors }: { icon: string; label: string; value: string; colors: any }) {
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon as any} size={20} color={colors.textTertiary} />
      <Text style={[styles.infoLabel, { color: colors.textPrimary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.textTertiary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  content: { padding: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 16, marginBottom: 8, marginLeft: 4 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 4 },
  mapTypeRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  mapTypeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 6,
  },
  mapTypeBtnText: { fontSize: 12, fontWeight: '700' },
  cardTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  emptyFav: { alignItems: 'center', paddingVertical: 16, gap: 6 },
  emptyText: { fontSize: 13 },
  favRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  favLabel: { fontSize: 14, fontWeight: '600' },
  favSub: { fontSize: 12, marginTop: 1 },
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#C4CDD9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  radioLabel: { fontSize: 14, fontWeight: '500' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  switchLabel: { fontSize: 14, fontWeight: '500' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  infoLabel: { fontSize: 14, fontWeight: '500', flex: 1 },
  infoValue: { fontSize: 13 },
});
