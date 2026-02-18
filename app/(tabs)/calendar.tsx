import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '../../src/context/AppContext';
import { Colors } from '../../src/theme';
import { getAllPrecincts } from '../../src/db/repositories/precinctRepository';
import { refreshPrecinctData } from '../../src/services/dataLoader';
import type { Precinct } from '../../src/models';
import type { DayHours } from '../../src/services/nycApi';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarScreen() {
  const { isDark } = useAppContext();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [precincts, setPrecincts] = useState<Precinct[]>([]);
  const [selectedPrecinctNum, setSelectedPrecinctNum] = useState<number | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Load precincts from DB
  useEffect(() => {
    (async () => {
      const pcts = await getAllPrecincts();
      setPrecincts(pcts);
      if (pcts.length > 0) {
        setSelectedPrecinctNum(prev => prev ?? pcts[0].precinctNum);
      }

      // Auto-refresh if first precinct has no hours data
      const firstWithHours = pcts.find(p => {
        try {
          const h = JSON.parse(p.openingHoursJson || '[]');
          return Array.isArray(h) && h.length > 0;
        } catch { return false; }
      });
      if (pcts.length > 0 && !firstWithHours && !refreshing) {
        doRefresh();
      }
    })();
  }, []);

  async function doRefresh() {
    setRefreshing(true);
    try {
      await refreshPrecinctData();
      const freshPcts = await getAllPrecincts();
      setPrecincts(freshPcts);
      if (freshPcts.length > 0) {
        setSelectedPrecinctNum(prev => prev ?? freshPcts[0].precinctNum);
      }
    } catch (err) {
      console.warn('[Calendar] Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  }

  // Auto-select today when switching months
  useEffect(() => {
    const t = new Date();
    if (t.getFullYear() === year && t.getMonth() === month) {
      setSelectedDay(t.getDate());
    } else {
      setSelectedDay(1);
    }
  }, [year, month]);

  const selectedPrecinct = useMemo(() => {
    return precincts.find(p => p.precinctNum === selectedPrecinctNum) || null;
  }, [precincts, selectedPrecinctNum]);

  const precinctHours: DayHours[] = useMemo(() => {
    if (!selectedPrecinct) return [];
    try {
      const parsed = JSON.parse(selectedPrecinct.openingHoursJson || '[]');
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [];
    } catch {
      return [];
    }
  }, [selectedPrecinct]);

  const hasHoursData = precinctHours.length > 0;

  const precinctMonthSchedule = useMemo(() => {
    const result: Record<number, { isOpen: boolean; hours: string }> = {};
    if (!hasHoursData) return result;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dayOfWeek = new Date(year, month, day).getDay();
      const dh = precinctHours[dayOfWeek];
      if (dh) {
        result[day] = { isOpen: dh.isOpen, hours: dh.hours };
      }
    }
    return result;
  }, [precinctHours, hasHoursData, year, month]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const stats = useMemo(() => {
    if (!hasHoursData) return { open: 0, closed: 0, total: daysInMonth };
    const entries = Object.values(precinctMonthSchedule);
    const open = entries.filter(e => e.isOpen).length;
    const closed = entries.filter(e => !e.isOpen).length;
    return { open, closed, total: entries.length };
  }, [precinctMonthSchedule, hasHoursData, daysInMonth]);

  // Selected day detail
  const selectedDayInfo = useMemo(() => {
    if (selectedDay === null) return null;
    const dayOfWeek = new Date(year, month, selectedDay).getDay();
    const pInfo = precinctMonthSchedule[selectedDay];
    return {
      dayName: DAY_NAMES[dayOfWeek],
      dayShort: WEEKDAYS[dayOfWeek],
      date: `${MONTHS[month]} ${selectedDay}, ${year}`,
      isOpen: pInfo?.isOpen ?? true,
      hours: pInfo?.hours || (hasHoursData ? 'No data' : 'Hours not loaded yet'),
    };
  }, [selectedDay, precinctMonthSchedule, hasHoursData, year, month]);

  const navigateMonth = useCallback((delta: number) => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + delta);
      return d;
    });
  }, []);

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const rows: (number | null)[][] = [];
    let row: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) row.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      row.push(day);
      if (row.length === 7) { rows.push(row); row = []; }
    }
    while (row.length > 0 && row.length < 7) row.push(null);
    if (row.length > 0) rows.push(row);
    return rows;
  }, [year, month]);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const OPEN_COLOR = '#4CAF50';
  const CLOSED_COLOR = '#D32F2F';
  const TODAY_RING = '#2979FF';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ─────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.primary }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <FontAwesome5 name="calendar-alt" size={16} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Precinct Hours</Text>
            <Text style={styles.headerSub}>
              {selectedPrecinct ? selectedPrecinct.name : 'Select a precinct'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setCurrentDate(new Date())}
            style={styles.todayBtn}
            activeOpacity={0.7}
          >
            <FontAwesome5 name="dot-circle" size={12} color="#fff" />
            <Text style={styles.todayBtnText}>Today</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* ── Precinct Selector ───────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.selectorRow}
        >
          {precincts.map(pct => {
            const active = selectedPrecinctNum === pct.precinctNum;
            return (
              <TouchableOpacity
                key={pct.precinctNum}
                onPress={() => setSelectedPrecinctNum(pct.precinctNum)}
                style={[
                  styles.selectorChip,
                  active
                    ? { backgroundColor: colors.accent, borderColor: colors.accent }
                    : { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
                ]}
                activeOpacity={0.7}
              >
                <FontAwesome5
                  name="building"
                  size={10}
                  color={active ? '#fff' : colors.textTertiary}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.selectorText, { color: active ? '#fff' : colors.textSecondary }]} numberOfLines={1}>
                  {pct.precinctNum}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Month Navigation Card ────────── */}
        <View style={[styles.monthCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <TouchableOpacity onPress={() => navigateMonth(-1)} style={styles.navBtn} activeOpacity={0.6}>
            <FontAwesome5 name="chevron-left" size={16} color={colors.accent} />
          </TouchableOpacity>
          <View style={styles.monthCenter}>
            <Text style={[styles.monthName, { color: colors.textPrimary }]}>{MONTHS[month]}</Text>
            <Text style={[styles.yearText, { color: colors.textTertiary }]}>{year}</Text>
          </View>
          <TouchableOpacity onPress={() => navigateMonth(1)} style={styles.navBtn} activeOpacity={0.6}>
            <FontAwesome5 name="chevron-right" size={16} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {/* ── Stats ────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: hasHoursData ? `${OPEN_COLOR}12` : (isDark ? colors.surfaceVariant : '#F5F5F5'), borderColor: hasHoursData ? `${OPEN_COLOR}30` : colors.cardBorder }]}>
            <View style={[styles.statDot, { backgroundColor: hasHoursData ? OPEN_COLOR : colors.textTertiary }]} />
            <Text style={[styles.statNum, { color: hasHoursData ? OPEN_COLOR : colors.textTertiary }]}>{hasHoursData ? stats.open : '—'}</Text>
            <Text style={[styles.statLabel, { color: hasHoursData ? OPEN_COLOR : colors.textTertiary }]}>Open</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: hasHoursData ? `${CLOSED_COLOR}12` : (isDark ? colors.surfaceVariant : '#F5F5F5'), borderColor: hasHoursData ? `${CLOSED_COLOR}30` : colors.cardBorder }]}>
            <View style={[styles.statDot, { backgroundColor: hasHoursData ? CLOSED_COLOR : colors.textTertiary }]} />
            <Text style={[styles.statNum, { color: hasHoursData ? CLOSED_COLOR : colors.textTertiary }]}>{hasHoursData ? stats.closed : '—'}</Text>
            <Text style={[styles.statLabel, { color: hasHoursData ? CLOSED_COLOR : colors.textTertiary }]}>Closed</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: isDark ? colors.surfaceVariant : '#F5F5F5', borderColor: colors.cardBorder }]}>
            <View style={[styles.statDot, { backgroundColor: colors.textTertiary }]} />
            <Text style={[styles.statNum, { color: colors.textPrimary }]}>{stats.total}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Days</Text>
          </View>
        </View>

        {/* ── Selected Day Detail ──────────── */}
        {selectedDayInfo && (
          <View style={[styles.dayDetailCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={styles.dayDetailLeft}>
              <View style={[
                styles.dayDetailBig,
                { backgroundColor: selectedDayInfo.isOpen ? `${OPEN_COLOR}12` : `${CLOSED_COLOR}12` },
              ]}>
                <Text style={[styles.dayDetailNum, { color: selectedDayInfo.isOpen ? OPEN_COLOR : CLOSED_COLOR }]}>
                  {selectedDay}
                </Text>
                <Text style={[styles.dayDetailDow, { color: selectedDayInfo.isOpen ? OPEN_COLOR : CLOSED_COLOR }]}>
                  {selectedDayInfo.dayShort}
                </Text>
              </View>
            </View>
            <View style={styles.dayDetailRight}>
              <Text style={[styles.dayDetailDate, { color: colors.textPrimary }]}>
                {selectedDayInfo.dayName}
              </Text>
              <Text style={[styles.dayDetailDateSub, { color: colors.textTertiary }]}>
                {selectedDayInfo.date}
              </Text>
              <View style={styles.dayDetailHoursRow}>
                <View style={[
                  styles.dayDetailStatusDot,
                  { backgroundColor: selectedDayInfo.isOpen ? OPEN_COLOR : CLOSED_COLOR },
                ]} />
                <Text style={[
                  styles.dayDetailStatus,
                  { color: selectedDayInfo.isOpen ? OPEN_COLOR : CLOSED_COLOR },
                ]}>
                  {selectedDayInfo.isOpen ? 'Open' : 'Closed'}
                </Text>
              </View>
              <View style={styles.dayDetailTimeRow}>
                <FontAwesome5 name="clock" size={11} color={colors.textTertiary} style={{ marginRight: 6 }} />
                <Text style={[styles.dayDetailTime, { color: colors.textSecondary }]}>
                  {selectedDayInfo.hours}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Calendar Card ────────────────── */}
        <View style={[styles.calCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((d, i) => (
              <View key={i} style={styles.weekCell}>
                <Text style={[
                  styles.weekText,
                  { color: (i === 0 || i === 6) ? colors.error : colors.textTertiary },
                ]}>
                  {d}
                </Text>
              </View>
            ))}
          </View>

          <View style={[styles.weekDivider, { backgroundColor: colors.divider }]} />

          {calendarGrid.map((row, ri) => (
            <View key={ri} style={styles.dayRow}>
              {row.map((day, ci) => {
                if (day === null) return <View key={ci} style={styles.dayCell} />;

                const isToday = isCurrentMonth && today.getDate() === day;
                const isSelected = selectedDay === day;
                const pInfo = precinctMonthSchedule[day];
                const isOpen = pInfo?.isOpen ?? true;
                const cellColor = hasHoursData
                  ? (isOpen ? OPEN_COLOR : CLOSED_COLOR)
                  : colors.textTertiary;

                return (
                  <TouchableOpacity
                    key={ci}
                    style={styles.dayCell}
                    activeOpacity={0.6}
                    onPress={() => setSelectedDay(day)}
                  >
                    <View style={[
                      styles.dayBubble,
                      hasHoursData
                        ? { backgroundColor: isDark ? `${cellColor}30` : `${cellColor}12` }
                        : { backgroundColor: isDark ? colors.surfaceVariant : '#F0F0F0' },
                      isToday && { borderWidth: 2.5, borderColor: TODAY_RING },
                      isSelected && !isToday && { borderWidth: 2, borderColor: colors.accent },
                    ]}>
                      <Text style={[
                        styles.dayNum,
                        { color: hasHoursData ? cellColor : colors.textPrimary },
                        isToday && { fontWeight: '900' },
                      ]}>
                        {day}
                      </Text>
                      <Text style={[
                        styles.dayLabel,
                        { color: hasHoursData ? cellColor : colors.textTertiary, opacity: 0.8 },
                      ]}>
                        {hasHoursData ? (isOpen ? 'OPEN' : 'OFF') : '—'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* ── Weekly Hours Card ────────────── */}
        {hasHoursData && (
          <View style={[styles.hoursListCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <Text style={[styles.hoursListTitle, { color: colors.textTertiary }]}>WEEKLY HOURS</Text>
            {precinctHours.map((dh, i) => {
              const isToday2 = today.getDay() === i;
              return (
                <View key={i} style={[styles.hoursListRow, isToday2 && { backgroundColor: `${colors.accent}10`, borderRadius: 8 }]}>
                  <View style={styles.hoursListDayCol}>
                    <View style={[styles.hoursListDot, { backgroundColor: dh.isOpen ? OPEN_COLOR : CLOSED_COLOR }]} />
                    <Text style={[styles.hoursListDay, { color: isToday2 ? colors.accent : colors.textPrimary }]}>
                      {dh.day}
                    </Text>
                  </View>
                  <Text style={[styles.hoursListTime, { color: dh.isOpen ? colors.textSecondary : CLOSED_COLOR }]}>
                    {dh.hours}
                  </Text>
                  {isToday2 && (
                    <View style={[styles.hoursListBadge, { backgroundColor: colors.accent }]}>
                      <Text style={styles.hoursListBadgeText}>TODAY</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ── Legend ────────────────────────── */}
        <View style={[styles.legendCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.legendTitle, { color: colors.textTertiary }]}>LEGEND</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: `${OPEN_COLOR}15` }]}>
                <Text style={[styles.legendBoxText, { color: OPEN_COLOR }]}>OPEN</Text>
              </View>
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Open Day</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: `${CLOSED_COLOR}15` }]}>
                <Text style={[styles.legendBoxText, { color: CLOSED_COLOR }]}>OFF</Text>
              </View>
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Closed Day</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { borderWidth: 2.5, borderColor: TODAY_RING, backgroundColor: 'transparent' }]}>
                <FontAwesome5 name="circle" size={6} color={TODAY_RING} solid />
              </View>
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Today</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Header ──
  header: { paddingHorizontal: 16, paddingBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  todayBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  todayBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // ── Precinct selector ──
  selectorRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  selectorChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 12, borderWidth: 1,
  },
  selectorText: { fontSize: 13, fontWeight: '700' },

  // ── Month nav ──
  monthCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, borderRadius: 16, borderWidth: 1,
    padding: 4,
  },
  navBtn: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  monthCenter: { flex: 1, alignItems: 'center' },
  monthName: { fontSize: 20, fontWeight: '800' },
  yearText: { fontSize: 12, fontWeight: '600', marginTop: 1 },

  // ── Stats ──
  statsRow: {
    flexDirection: 'row', gap: 10,
    marginHorizontal: 16, marginTop: 12,
  },
  statCard: {
    flex: 1, alignItems: 'center',
    paddingVertical: 12, borderRadius: 14, borderWidth: 1,
  },
  statDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  statNum: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '700', marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Selected day detail ──
  dayDetailCard: {
    flexDirection: 'row',
    marginHorizontal: 16, marginTop: 12,
    borderRadius: 16, borderWidth: 1,
    padding: 14, gap: 14,
  },
  dayDetailLeft: { alignItems: 'center', justifyContent: 'center' },
  dayDetailBig: {
    width: 60, height: 60, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  dayDetailNum: { fontSize: 22, fontWeight: '900' },
  dayDetailDow: { fontSize: 10, fontWeight: '700', marginTop: -2 },
  dayDetailRight: { flex: 1, justifyContent: 'center' },
  dayDetailDate: { fontSize: 16, fontWeight: '800' },
  dayDetailDateSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  dayDetailHoursRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6,
  },
  dayDetailStatusDot: { width: 7, height: 7, borderRadius: 3.5 },
  dayDetailStatus: { fontSize: 12, fontWeight: '700' },
  dayDetailTimeRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 3,
  },
  dayDetailTime: { fontSize: 12, fontWeight: '600' },

  // ── Calendar card ──
  calCard: {
    marginHorizontal: 16, marginTop: 12,
    borderRadius: 18, borderWidth: 1,
    padding: 12,
  },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  weekText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  weekDivider: { height: 1, marginBottom: 6 },
  dayRow: { flexDirection: 'row', marginBottom: 4 },
  dayCell: { flex: 1, aspectRatio: 1, padding: 2 },
  dayBubble: {
    flex: 1, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  dayNum: { fontSize: 15, fontWeight: '700' },
  dayLabel: { fontSize: 7, fontWeight: '800', marginTop: -1, letterSpacing: 0.5 },

  // ── Weekly hours list ──
  hoursListCard: {
    marginHorizontal: 16, marginTop: 12,
    borderRadius: 16, borderWidth: 1,
    padding: 14,
  },
  hoursListTitle: {
    fontSize: 10, fontWeight: '700',
    letterSpacing: 1, marginBottom: 10,
  },
  hoursListRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 8,
  },
  hoursListDayCol: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, width: 110,
  },
  hoursListDot: { width: 8, height: 8, borderRadius: 4 },
  hoursListDay: { fontSize: 13, fontWeight: '600' },
  hoursListTime: { fontSize: 12, fontWeight: '500', flex: 1 },
  hoursListBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
  },
  hoursListBadgeText: {
    fontSize: 8, fontWeight: '800', color: '#fff', letterSpacing: 0.5,
  },

  // ── Legend ──
  legendCard: {
    marginHorizontal: 16, marginTop: 12,
    borderRadius: 14, borderWidth: 1,
    padding: 14,
  },
  legendTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendBox: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  legendBoxText: { fontSize: 8, fontWeight: '800' },
  legendText: { fontSize: 11, fontWeight: '600' },
});
