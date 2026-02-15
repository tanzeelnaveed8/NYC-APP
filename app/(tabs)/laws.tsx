import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { Text, ActivityIndicator, Chip } from 'react-native-paper';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAppContext } from '../../src/context/AppContext';
import { Colors } from '../../src/theme';
import { getAllCategories, getEntriesByCategory, searchLaws } from '../../src/db/repositories/lawRepository';
import type { LawCategory, LawEntry, LawSearchResult } from '../../src/models';

// ── Category metadata with FontAwesome5 icons & original colors ──────
const CATEGORY_META: Record<string, { icon: string; color: string; bgLight: string }> = {
  penal_law:     { icon: 'balance-scale',  color: '#D32F2F', bgLight: '#FFEBEE' },
  vtl:           { icon: 'car-side',       color: '#2979FF', bgLight: '#E3F2FD' },
  admin_code:    { icon: 'landmark',       color: '#2979FF', bgLight: '#E3F2FD' },
  traffic_rules: { icon: 'traffic-light',  color: '#B71C1C', bgLight: '#FFEBEE' },
};
const DEFAULT_META = { icon: 'book', color: '#2979FF', bgLight: '#E3F2FD' };

// Replace § with "Sec." so it displays correctly on all devices
const fmtSec = (s: string) => s.replace(/\u00A7/g, 'Sec.').replace(/§/g, 'Sec.');

export default function LawLibraryScreen() {
  const { isDark } = useAppContext();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<LawCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<LawCategory | null>(null);
  const [entries, setEntries] = useState<LawEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LawSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    (async () => { setCategories(await getAllCategories()); })();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      (async () => { setEntries(await getEntriesByCategory(selectedCategory.categoryId)); })();
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setIsSearching(false); return; }
    setIsSearching(true);
    const t = setTimeout(async () => {
      setSearchResults(await searchLaws(searchQuery));
      setIsSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const openDetail = (entry: LawEntry) => {
    router.push({ pathname: '/laws/[id]', params: { id: entry.entryId.toString(), highlight: searchQuery } });
  };

  const getMeta = (catId: string) => CATEGORY_META[catId] || DEFAULT_META;

  // ── Category Card ─────────────────────────────────────
  const renderCategoryCard = ({ item }: { item: LawCategory }) => {
    const meta = getMeta(item.categoryId);
    return (
      <TouchableOpacity
        style={[styles.catCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
        onPress={() => setSelectedCategory(item)}
        activeOpacity={0.65}
      >
        <View style={[styles.catIconBox, { backgroundColor: isDark ? `${meta.color}25` : meta.bgLight }]}>
          <FontAwesome5 name={meta.icon} size={22} color={meta.color} />
        </View>
        <View style={styles.catContent}>
          <Text style={[styles.catName, { color: colors.textPrimary }]}>{item.name}</Text>
          <Text style={[styles.catCount, { color: colors.textTertiary }]}>
            {item.entryCount} sections
          </Text>
        </View>
        <View style={[styles.catArrow, { backgroundColor: isDark ? colors.surfaceVariant : '#F0F4FA' }]}>
          <FontAwesome5 name="chevron-right" size={12} color={colors.textTertiary} />
        </View>
      </TouchableOpacity>
    );
  };

  // ── Entry Card ────────────────────────────────────────
  const renderEntryCard = (item: LawEntry, catId?: string) => {
    const meta = getMeta(catId || item.categoryId);
    return (
      <TouchableOpacity
        style={[styles.entryCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
        onPress={() => openDetail(item)}
        activeOpacity={0.65}
      >
        <View style={styles.entryTop}>
          <View style={[styles.sectionBadge, { backgroundColor: isDark ? `${meta.color}25` : meta.bgLight }]}>
            <FontAwesome5 name={meta.icon} size={10} color={meta.color} style={{ marginRight: 5 }} />
            <Text style={[styles.sectionText, { color: meta.color }]}>{fmtSec(item.sectionNumber)}</Text>
          </View>
          <FontAwesome5 name="chevron-right" size={11} color={colors.textTertiary} />
        </View>
        <Text style={[styles.entryTitle, { color: colors.textPrimary }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.entryBody, { color: colors.textTertiary }]} numberOfLines={2}>
          {item.bodyText}
        </Text>
      </TouchableOpacity>
    );
  };

  // ── Search Result Card ────────────────────────────────
  const renderSearchResult = ({ item }: { item: LawSearchResult }) => {
    const meta = getMeta(item.entry.categoryId);
    return (
      <TouchableOpacity
        style={[styles.searchCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
        onPress={() => openDetail(item.entry)}
        activeOpacity={0.65}
      >
        <View style={[styles.searchIconBox, { backgroundColor: isDark ? `${meta.color}25` : meta.bgLight }]}>
          <FontAwesome5 name={meta.icon} size={16} color={meta.color} />
        </View>
        <View style={styles.searchContent}>
          <Text style={[styles.searchSec, { color: meta.color }]}>{fmtSec(item.entry.sectionNumber)}</Text>
          <Text style={[styles.searchTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.entry.title}
          </Text>
          <Text style={[styles.searchBody, { color: colors.textTertiary }]} numberOfLines={1}>
            {item.entry.bodyText}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const totalEntries = categories.reduce((sum, c) => sum + c.entryCount, 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ─────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.primary }]}>
        <View style={styles.headerTop}>
          {selectedCategory ? (
            <TouchableOpacity
              onPress={() => { setSelectedCategory(null); setEntries([]); }}
              style={styles.headerBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <FontAwesome5 name="arrow-left" size={16} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerBtn}>
              <FontAwesome5 name="book-open" size={16} color="#fff" />
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>
              {selectedCategory ? selectedCategory.name : 'Law Library'}
            </Text>
            {!selectedCategory && (
              <Text style={styles.headerSub}>
                {categories.length} categories  {totalEntries} sections
              </Text>
            )}
          </View>
        </View>

        <View style={[styles.searchWrap, { backgroundColor: isDark ? colors.surfaceVariant : '#ffffff' }]}>
          <FontAwesome5 name="search" size={14} color={isDark ? colors.textTertiary : '#9EAAB8'} style={{ marginLeft: 14 }} />
          <TextInput
            placeholder="Search laws, sections, keywords..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: isDark ? colors.textPrimary : colors.textPrimary }]}
            placeholderTextColor={isDark ? colors.textTertiary : '#9EAAB8'}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <View style={[styles.clearIcon, { backgroundColor: isDark ? colors.outline : '#D0D7E0' }]}>
                <FontAwesome5 name="times" size={10} color={isDark ? colors.textPrimary : '#fff'} />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Content ────────────────────────── */}
      {searchQuery.trim() ? (
        isSearching ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textTertiary }]}>Searching...</Text>
          </View>
        ) : searchResults.length > 0 ? (
          <View style={{ flex: 1 }}>
            <View style={[styles.resultsBanner, { backgroundColor: isDark ? colors.surfaceVariant : '#E3EDF5' }]}>
              <FontAwesome5 name="check-circle" size={13} color={colors.accent} />
              <Text style={[styles.resultsText, { color: colors.accent }]}>
                {'  '}{searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
              </Text>
            </View>
            <FlatList
              data={searchResults}
              keyExtractor={item => item.entry.entryId.toString()}
              contentContainerStyle={styles.listPad}
              renderItem={renderSearchResult}
              showsVerticalScrollIndicator={false}
            />
          </View>
        ) : (
          <View style={styles.center}>
            <View style={[styles.emptyWrap, { backgroundColor: isDark ? colors.surfaceVariant : '#F0F4FA' }]}>
              <FontAwesome5 name="search" size={32} color={colors.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No results found</Text>
            <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
              Try different keywords or section numbers
            </Text>
          </View>
        )
      ) : selectedCategory ? (
        <FlatList
          data={entries}
          keyExtractor={item => item.entryId.toString()}
          contentContainerStyle={styles.listPad}
          renderItem={({ item }) => renderEntryCard(item, selectedCategory.categoryId)}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={[styles.infoBanner, { backgroundColor: isDark ? `${getMeta(selectedCategory.categoryId).color}15` : getMeta(selectedCategory.categoryId).bgLight }]}>
              <FontAwesome5 name={getMeta(selectedCategory.categoryId).icon} size={14} color={getMeta(selectedCategory.categoryId).color} />
              <Text style={[styles.infoBannerText, { color: getMeta(selectedCategory.categoryId).color }]}>
                {'  '}{entries.length} sections in {selectedCategory.name}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={item => item.categoryId}
          contentContainerStyle={styles.listPad}
          renderItem={renderCategoryCard}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.quickSearch}>
              <Text style={[styles.quickLabel, { color: colors.textTertiary }]}>QUICK SEARCH</Text>
              <View style={styles.chipRow}>
                {['Assault', 'Larceny', 'DWI', 'Parking', 'Trespass'].map(term => (
                  <Chip
                    key={term}
                    mode="outlined"
                    compact
                    textStyle={{ fontSize: 12, color: colors.accent }}
                    style={[styles.chip, { borderColor: `${colors.accent}40` }]}
                    onPress={() => setSearchQuery(term)}
                  >
                    {term}
                  </Chip>
                ))}
              </View>
            </View>
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
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  headerBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, height: 48,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 3,
  },
  searchInput: { flex: 1, fontSize: 14, marginLeft: 10, marginRight: 8, paddingVertical: 0 },
  clearBtn: { marginRight: 12 },
  clearIcon: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Lists ──
  listPad: { padding: 16, paddingBottom: 30 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  loadingText: { marginTop: 12, fontSize: 14 },

  // ── Category Card ──
  catCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 12,
  },
  catIconBox: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  catContent: { flex: 1 },
  catName: { fontSize: 16, fontWeight: '700' },
  catCount: { fontSize: 12, marginTop: 3 },
  catArrow: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Entry Card ──
  entryCard: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  entryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  sectionText: { fontSize: 12, fontWeight: '800' },
  entryTitle: { fontSize: 15, fontWeight: '700', lineHeight: 22 },
  entryBody: { fontSize: 13, marginTop: 6, lineHeight: 20, opacity: 0.7 },

  // ── Search Result Card ──
  searchCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10,
  },
  searchIconBox: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  searchContent: { flex: 1 },
  searchSec: { fontSize: 11, fontWeight: '800' },
  searchTitle: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  searchBody: { fontSize: 12, marginTop: 2, opacity: 0.6 },

  // ── Banners ──
  resultsBanner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  resultsText: { fontSize: 13, fontWeight: '600' },
  infoBanner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginBottom: 14,
  },
  infoBannerText: { fontSize: 13, fontWeight: '600' },

  // ── Empty state ──
  emptyWrap: {
    width: 88, height: 88, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptySub: { fontSize: 13, textAlign: 'center', marginTop: 6 },

  // ── Quick search ──
  quickSearch: { marginBottom: 16 },
  quickLabel: { fontSize: 11, fontWeight: '700', marginBottom: 8, letterSpacing: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: 'transparent' },
});
