import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Keyboard, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useAppContext } from '../../src/context/AppContext';
import { Colors, getBoroughColor } from '../../src/theme/colors';
import { getAllPrecincts, findPrecinctAtLocation, findSectorAtLocation, findNearestPrecinct } from '../../src/db/repositories/precinctRepository';
import { getRecentSearches, addRecentSearch, clearRecentSearches } from '../../src/db/repositories/searchRepository';
import type { Precinct, RecentSearch } from '../../src/models';

const BOROUGH_ICONS: Record<string, string> = {
  Manhattan: 'building',
  Brooklyn: 'bridge',
  Bronx: 'tree',
  Queens: 'plane',
  'Staten Island': 'ship',
};

export default function SearchScreen() {
  const { isDark, setSelectedPrecinct, setSelectedSector, setSearchedAddress, setSearchedLocation } = useAppContext();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [allPrecincts, setAllPrecincts] = useState<Precinct[]>([]);
  const [results, setResults] = useState<Precinct[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await getAllPrecincts();
      setAllPrecincts(data);
      const recent = await getRecentSearches();
      setRecentSearches(recent);
    })();
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const q = query.toLowerCase();
    setResults(allPrecincts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.address.toLowerCase().includes(q) ||
      p.borough.toLowerCase().includes(q) ||
      p.precinctNum.toString().includes(q) ||
      p.phone.includes(q)
    ));
  }, [query, allPrecincts]);

  const handleSelect = useCallback(async (precinct: Precinct) => {
    Keyboard.dismiss();
    await addRecentSearch({
      queryText: precinct.name,
      displayAddress: `${precinct.name} — ${precinct.address}`,
      latitude: precinct.centroidLat,
      longitude: precinct.centroidLng,
      timestamp: Date.now(),
    });
    setSelectedPrecinct(precinct);
    setSelectedSector(null);
    setSearchedAddress(null);
    setSearchedLocation(null);
    const recent = await getRecentSearches();
    setRecentSearches(recent);
    router.navigate('/(tabs)/map');
  }, [setSelectedPrecinct, setSelectedSector, setSearchedAddress, setSearchedLocation]);

  const handleAddressSearch = useCallback(async () => {
    if (!query.trim() || geocoding) return;
    Keyboard.dismiss();
    setGeocoding(true);
    try {
      const searchQuery = query.trim();
      let latitude: number | null = null;
      let longitude: number | null = null;

      // Method 1: Use free Nominatim (OpenStreetMap) geocoding API — most reliable
      try {
        const encoded = encodeURIComponent(searchQuery + ', New York City, NY, USA');
        const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=us`;
        const response = await fetch(url, {
          headers: { 'User-Agent': 'NYCPrecinctApp/1.0' },
        });
        const data = await response.json();
        if (data && data.length > 0) {
          latitude = parseFloat(data[0].lat);
          longitude = parseFloat(data[0].lon);
        }
      } catch {}

      // Method 2: Fallback to native expo-location geocoder
      if (latitude === null || longitude === null) {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const nativeResults = await Location.geocodeAsync(searchQuery + ', New York, NY');
            if (nativeResults && nativeResults.length > 0) {
              latitude = nativeResults[0].latitude;
              longitude = nativeResults[0].longitude;
            }
          }
        } catch {}
      }

      if (latitude === null || longitude === null) {
        Alert.alert('Address Not Found', 'Could not locate that address. Try a more specific NYC address (e.g. "123 Broadway, Manhattan").');
        setGeocoding(false);
        return;
      }

      const point = { latitude, longitude };

      // Try exact point-in-polygon first, then fall back to nearest precinct
      let precinct = await findPrecinctAtLocation(point);
      if (!precinct) {
        precinct = await findNearestPrecinct(point);
      }
      const sector = await findSectorAtLocation(point);

      if (!precinct) {
        Alert.alert('Outside NYC', 'This address does not appear to be within an NYC precinct boundary. Try a more specific address.');
        setGeocoding(false);
        return;
      }

      await addRecentSearch({
        queryText: searchQuery,
        displayAddress: searchQuery,
        latitude,
        longitude,
        timestamp: Date.now(),
      });
      const recent = await getRecentSearches();
      setRecentSearches(recent);

      setSelectedPrecinct(precinct);
      setSelectedSector(sector);
      setSearchedAddress(searchQuery);
      setSearchedLocation(point);
      setGeocoding(false);
      router.navigate('/(tabs)/map');
    } catch (err: any) {
      Alert.alert('Error', 'Failed to search address. Please check your internet connection and try again.');
      setGeocoding(false);
    }
  }, [query, geocoding, setSelectedPrecinct, setSelectedSector, setSearchedAddress, setSearchedLocation]);

  const handleRecentPress = useCallback(async (search: RecentSearch) => {
    const match = allPrecincts.find(p =>
      p.centroidLat === search.latitude && p.centroidLng === search.longitude
    );
    if (match) handleSelect(match);
    else router.navigate('/(tabs)/map');
  }, [allPrecincts, handleSelect]);

  const handleClear = async () => {
    await clearRecentSearches();
    setRecentSearches([]);
  };

  const hasQuery = query.trim().length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ─────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.primary }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <FontAwesome5 name="search-location" size={16} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Search Precincts</Text>
            <Text style={styles.headerSub}>{allPrecincts.length} precincts available</Text>
          </View>
        </View>

        {/* Search Input */}
        <View style={[styles.searchBar, { backgroundColor: isDark ? colors.surfaceVariant : '#fff' }]}>
          <FontAwesome5 name="search" size={14} color={isDark ? colors.textTertiary : '#9EAAB8'} />
          <TextInput
            placeholder="Search by name, address, borough..."
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => results.length > 0 && handleSelect(results[0])}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholderTextColor={isDark ? colors.textTertiary : '#9EAAB8'}
            returnKeyType="search"
            autoCorrect={false}
          />
          {hasQuery && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <View style={[styles.clearBtn, { backgroundColor: isDark ? colors.outline : '#D0D7E0' }]}>
                <FontAwesome5 name="times" size={10} color={isDark ? colors.textPrimary : '#fff'} />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Content ────────────────────────── */}
      {hasQuery ? (
        results.length > 0 ? (
          <View style={{ flex: 1 }}>
            {/* Address search card */}
            <TouchableOpacity
              style={[styles.addressSearchCard, { backgroundColor: isDark ? colors.surfaceVariant : '#EEF4FF', borderColor: isDark ? colors.accent + '30' : colors.accent + '25' }]}
              onPress={handleAddressSearch}
              activeOpacity={0.7}
              disabled={geocoding}
            >
              <View style={[styles.addressSearchIcon, { backgroundColor: isDark ? colors.accent + '20' : colors.accent + '15' }]}>
                {geocoding ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <FontAwesome5 name="map-pin" size={14} color={colors.accent} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.addressSearchTitle, { color: colors.accent }]}>
                  {geocoding ? 'Searching...' : 'Find precinct for this address'}
                </Text>
                <Text style={[styles.addressSearchSub, { color: colors.textTertiary }]} numberOfLines={1}>
                  Search "{query.trim()}" as an NYC address
                </Text>
              </View>
              <FontAwesome5 name="arrow-right" size={12} color={colors.accent} />
            </TouchableOpacity>

            {/* Results count */}
            <View style={[styles.countBar, { backgroundColor: isDark ? colors.surfaceVariant : '#E3EDF5' }]}>
              <FontAwesome5 name="check-circle" size={12} color={colors.accent} />
              <Text style={[styles.countText, { color: colors.accent }]}>
                {'  '}{results.length} precinct{results.length !== 1 ? 's' : ''} found
              </Text>
            </View>
            <FlatList
              data={results}
              keyExtractor={item => item.precinctNum.toString()}
              contentContainerStyle={styles.listPad}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const bc = getBoroughColor(item.borough, colors);
                const bIcon = BOROUGH_ICONS[item.borough] || 'map-marker-alt';
                return (
                  <TouchableOpacity
                    style={[styles.resultCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.65}
                  >
                    <View style={[styles.resultIconBox, { backgroundColor: isDark ? `${bc}25` : `${bc}12` }]}>
                      <FontAwesome5 name="shield-alt" size={18} color={bc} />
                    </View>
                    <View style={styles.resultContent}>
                      <Text style={[styles.resultName, { color: colors.textPrimary }]}>{item.name}</Text>
                      <View style={styles.resultAddrRow}>
                        <FontAwesome5 name="map-marker-alt" size={10} color={colors.textTertiary} />
                        <Text style={[styles.resultAddr, { color: colors.textSecondary }]} numberOfLines={1}>
                          {'  '}{item.address}
                        </Text>
                      </View>
                      <View style={styles.resultMeta}>
                        <View style={[styles.boroughBadge, { backgroundColor: isDark ? `${bc}20` : `${bc}10` }]}>
                          <FontAwesome5 name={bIcon} size={8} color={bc} />
                          <Text style={[styles.boroughText, { color: bc }]}>{'  '}{item.borough}</Text>
                        </View>
                        <View style={styles.phoneBadge}>
                          <FontAwesome5 name="phone-alt" size={8} color={colors.textTertiary} />
                          <Text style={[styles.phoneText, { color: colors.textTertiary }]}>{'  '}{item.phone}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={[styles.goBtn, { backgroundColor: isDark ? colors.surfaceVariant : '#F0F4FA' }]}>
                      <FontAwesome5 name="chevron-right" size={11} color={colors.textTertiary} />
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        ) : (
          <View style={styles.emptyState}>
            {/* Prominent address search for no-match */}
            <TouchableOpacity
              style={[styles.addressSearchCardLarge, { backgroundColor: isDark ? colors.surfaceVariant : '#EEF4FF', borderColor: isDark ? colors.accent + '30' : colors.accent + '25' }]}
              onPress={handleAddressSearch}
              activeOpacity={0.7}
              disabled={geocoding}
            >
              <View style={[styles.addressSearchIconLarge, { backgroundColor: isDark ? colors.accent + '20' : colors.accent + '15' }]}>
                {geocoding ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <FontAwesome5 name="map-pin" size={20} color={colors.accent} />
                )}
              </View>
              <Text style={[styles.addressSearchTitleLarge, { color: colors.accent }]}>
                {geocoding ? 'Searching address...' : 'Search as NYC Address'}
              </Text>
              <Text style={[styles.addressSearchSubLarge, { color: colors.textTertiary }]} numberOfLines={2}>
                Find which precinct & sector covers "{query.trim()}"
              </Text>
            </TouchableOpacity>

            <View style={{ marginTop: 24, alignItems: 'center' }}>
              <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No precincts matched</Text>
              <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
                Try the address search above, or search by borough name or precinct number
              </Text>
            </View>
          </View>
        )
      ) : (
        <FlatList
          data={[]}
          renderItem={() => null}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listPad}
          ListHeaderComponent={
            <>
              {/* ── Quick Search ────────── */}
              <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>BOROUGHS</Text>
              <View style={styles.boroughGrid}>
                {['Manhattan', 'Brooklyn', 'Bronx', 'Queens', 'Staten Island'].map(b => {
                  const bc = getBoroughColor(b, colors);
                  const bIcon = BOROUGH_ICONS[b] || 'map-marker-alt';
                  return (
                    <TouchableOpacity
                      key={b}
                      style={[styles.boroughCard, { backgroundColor: isDark ? `${bc}15` : `${bc}08`, borderColor: `${bc}30` }]}
                      onPress={() => setQuery(b)}
                      activeOpacity={0.7}
                    >
                      <FontAwesome5 name={bIcon} size={14} color={bc} />
                      <Text style={[styles.boroughCardText, { color: bc }]}>{b}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginTop: 20 }]}>POPULAR</Text>
              <View style={styles.chipRow}>
                {['Midtown', '1st Precinct', '60th Precinct', '40th Precinct'].map(term => (
                  <TouchableOpacity
                    key={term}
                    style={[styles.chip, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
                    onPress={() => setQuery(term)}
                    activeOpacity={0.7}
                  >
                    <FontAwesome5 name="star" size={9} color={colors.accent} solid={false} />
                    <Text style={[styles.chipText, { color: colors.textSecondary }]}>{'  '}{term}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── Recent Searches ────── */}
              {recentSearches.length > 0 && (
                <>
                  <View style={[styles.recentHeader, { marginTop: 20 }]}>
                    <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginBottom: 0 }]}>RECENT</Text>
                    <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={[styles.clearText, { color: colors.error }]}>Clear All</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.recentCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                    {recentSearches.map((item, i) => (
                      <React.Fragment key={item.searchId}>
                        <TouchableOpacity
                          style={styles.recentRow}
                          onPress={() => handleRecentPress(item)}
                          activeOpacity={0.6}
                        >
                          <View style={[styles.recentIcon, { backgroundColor: isDark ? colors.surfaceVariant : '#F0F4FA' }]}>
                            <FontAwesome5 name="history" size={12} color={colors.textTertiary} />
                          </View>
                          <Text style={[styles.recentText, { color: colors.textPrimary }]} numberOfLines={1}>
                            {item.displayAddress}
                          </Text>
                          <FontAwesome5 name="arrow-right" size={10} color={colors.textTertiary} />
                        </TouchableOpacity>
                        {i < recentSearches.length - 1 && (
                          <View style={[styles.recentDivider, { backgroundColor: colors.divider }]} />
                        )}
                      </React.Fragment>
                    ))}
                  </View>
                </>
              )}

              {/* ── Empty state ────────── */}
              {recentSearches.length === 0 && (
                <View style={styles.noRecent}>
                  <View style={[styles.noRecentIcon, { backgroundColor: isDark ? colors.surfaceVariant : '#F0F4FA' }]}>
                    <FontAwesome5 name="search" size={24} color={colors.textTertiary} />
                  </View>
                  <Text style={[styles.noRecentText, { color: colors.textTertiary }]}>
                    Search for a precinct to get started
                  </Text>
                </View>
              )}
            </>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Header ──
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  headerIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },

  // ── Search bar ──
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    height: 48, borderRadius: 14,
    paddingHorizontal: 14, gap: 10,
    elevation: 2, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  clearBtn: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Count bar ──
  countBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  countText: { fontSize: 13, fontWeight: '600' },

  // ── List ──
  listPad: { padding: 16, paddingBottom: 30 },

  // ── Result Card ──
  resultCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10,
  },
  resultIconBox: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  resultContent: { flex: 1 },
  resultName: { fontSize: 15, fontWeight: '700' },
  resultAddrRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  resultAddr: { fontSize: 12, flex: 1 },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  boroughBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  boroughText: { fontSize: 10, fontWeight: '700' },
  phoneBadge: { flexDirection: 'row', alignItems: 'center' },
  phoneText: { fontSize: 10 },
  goBtn: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },

  // ── Address Search Card ──
  addressSearchCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    padding: 14, borderRadius: 14, borderWidth: 1,
    gap: 12,
  },
  addressSearchIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  addressSearchTitle: { fontSize: 13, fontWeight: '700' },
  addressSearchSub: { fontSize: 11, marginTop: 2 },
  addressSearchCardLarge: {
    alignItems: 'center',
    padding: 24, borderRadius: 20, borderWidth: 1,
    width: '100%',
  },
  addressSearchIconLarge: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  addressSearchTitleLarge: { fontSize: 16, fontWeight: '800' },
  addressSearchSubLarge: { fontSize: 13, textAlign: 'center', marginTop: 6 },

  // ── Empty state ──
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptySub: { fontSize: 13, textAlign: 'center', marginTop: 6 },

  // ── Section labels ──
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },

  // ── Borough Grid ──
  boroughGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  boroughCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: 12, borderWidth: 1,
  },
  boroughCardText: { fontSize: 13, fontWeight: '700' },

  // ── Popular chips ──
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 12, borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '600' },

  // ── Recent ──
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  clearText: { fontSize: 12, fontWeight: '700' },
  recentCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  recentRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13,
  },
  recentIcon: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  recentText: { flex: 1, fontSize: 13, fontWeight: '500' },
  recentDivider: { height: 1, marginLeft: 58 },

  // ── No recent ──
  noRecent: { alignItems: 'center', paddingVertical: 40, marginTop: 10 },
  noRecentIcon: {
    width: 72, height: 72, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  noRecentText: { fontSize: 13, textAlign: 'center' },
});
