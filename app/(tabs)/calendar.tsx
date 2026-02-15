import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '../../src/context/AppContext';
import { Colors } from '../../src/theme';
import { getAllSquads, getScheduleForSquad, computeMonthSchedule } from '../../src/db/repositories/calendarRepository';
import type { Squad, RdoSchedule } from '../../src/models';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarScreen() {
  const { isDark } = useAppContext();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [squads, setSquads] = useState<Squad[]>([]);
  const [selectedSquadId, setSelectedSquadId] = useState(1);
  const [schedule, setSchedule] = useState<RdoSchedule | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    (async () => {
      const data = await getAllSquads();
      setSquads(data);
      if (data.length > 0) {
        const sched = await getScheduleForSquad(data[0].squadId);
        setSchedule(sched);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const sched = await getScheduleForSquad(selectedSquadId);
      if (!cancelled) setSchedule(sched);
    }, 80);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [selectedSquadId]);

  const monthSchedule = useMemo(() => {
    if (!schedule) return {};
    return computeMonthSchedule(year, month, schedule);
  }, [schedule, year, month]);

  const stats = useMemo(() => {
    const days = Object.values(monthSchedule);
    const rdo = days.filter(Boolean).length;
    const duty = days.filter(d => !d).length;
    return { rdo, duty, total: days.length };
  }, [monthSchedule]);

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

  const DUTY_COLOR = '#2979FF';
  const RDO_COLOR = '#D32F2F';
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
            <Text style={styles.headerTitle}>RDO Calendar</Text>
            <Text style={styles.headerSub}>
              {schedule?.patternType === 'steady' ? 'Steady' : '15-Day Rotating'} Schedule
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
        {/* ── Squad Selector ───────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.squadRow}
        >
          {squads.map(squad => {
            const active = selectedSquadId === squad.squadId;
            return (
              <TouchableOpacity
                key={squad.squadId}
                onPress={() => setSelectedSquadId(squad.squadId)}
                style={[
                  styles.squadChip,
                  active
                    ? { backgroundColor: colors.accent, borderColor: colors.accent }
                    : { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
                ]}
                activeOpacity={0.7}
              >
                <FontAwesome5
                  name="users"
                  size={10}
                  color={active ? '#fff' : colors.textTertiary}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.squadText, { color: active ? '#fff' : colors.textSecondary }]}>
                  {squad.squadName}
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
          <View style={[styles.statCard, { backgroundColor: `${DUTY_COLOR}12`, borderColor: `${DUTY_COLOR}30` }]}>
            <View style={[styles.statDot, { backgroundColor: DUTY_COLOR }]} />
            <Text style={[styles.statNum, { color: DUTY_COLOR }]}>{stats.duty}</Text>
            <Text style={[styles.statLabel, { color: DUTY_COLOR }]}>Duty</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: `${RDO_COLOR}12`, borderColor: `${RDO_COLOR}30` }]}>
            <View style={[styles.statDot, { backgroundColor: RDO_COLOR }]} />
            <Text style={[styles.statNum, { color: RDO_COLOR }]}>{stats.rdo}</Text>
            <Text style={[styles.statLabel, { color: RDO_COLOR }]}>RDO</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: isDark ? colors.surfaceVariant : '#F5F5F5', borderColor: colors.cardBorder }]}>
            <View style={[styles.statDot, { backgroundColor: colors.textTertiary }]} />
            <Text style={[styles.statNum, { color: colors.textPrimary }]}>{stats.total}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Total</Text>
          </View>
        </View>

        {/* ── Calendar Card ────────────────── */}
        <View style={[styles.calCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          {/* Weekday headers */}
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

          {/* Day grid */}
          {calendarGrid.map((row, ri) => (
            <View key={ri} style={styles.dayRow}>
              {row.map((day, ci) => {
                if (day === null) return <View key={ci} style={styles.dayCell} />;

                const isRdo = monthSchedule[day] ?? false;
                const isToday = isCurrentMonth && today.getDate() === day;
                const isWeekend = ci === 0 || ci === 6;

                return (
                  <View key={ci} style={styles.dayCell}>
                    <View style={[
                      styles.dayBubble,
                      isRdo
                        ? { backgroundColor: isDark ? `${RDO_COLOR}30` : `${RDO_COLOR}15` }
                        : { backgroundColor: isDark ? `${DUTY_COLOR}30` : `${DUTY_COLOR}10` },
                      isToday && { borderWidth: 2.5, borderColor: TODAY_RING },
                    ]}>
                      <Text style={[
                        styles.dayNum,
                        { color: isRdo ? RDO_COLOR : DUTY_COLOR },
                        isToday && { fontWeight: '900' },
                      ]}>
                        {day}
                      </Text>
                      <Text style={[
                        styles.dayLabel,
                        { color: isRdo ? RDO_COLOR : DUTY_COLOR, opacity: 0.7 },
                      ]}>
                        {isRdo ? 'OFF' : 'ON'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* ── Legend ────────────────────────── */}
        <View style={[styles.legendCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.legendTitle, { color: colors.textTertiary }]}>LEGEND</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: `${DUTY_COLOR}15` }]}>
                <Text style={[styles.legendBoxText, { color: DUTY_COLOR }]}>ON</Text>
              </View>
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Duty Day</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: `${RDO_COLOR}15` }]}>
                <Text style={[styles.legendBoxText, { color: RDO_COLOR }]}>OFF</Text>
              </View>
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Regular Day Off</Text>
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

  // ── Squad selector ──
  squadRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  squadChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 12, borderWidth: 1,
  },
  squadText: { fontSize: 13, fontWeight: '700' },

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
