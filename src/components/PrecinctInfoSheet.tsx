import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Linking, Platform } from 'react-native';
import { Text, IconButton, Divider, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import type { Precinct } from '../models';
import type { DayHours } from '../services/nycApi';
import { Colors, getBoroughColor } from '../theme/colors';
import { useAppContext } from '../context/AppContext';

interface Props {
  precinct: Precinct;
  reverseAddress?: string | null;
  searchedAddress?: string | null;
  onClose?: () => void;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
}

export function PrecinctInfoSheet({ precinct, reverseAddress, searchedAddress, onClose, isFavorited, onToggleFavorite }: Props) {
  const { isDark } = useAppContext();
  const colors = isDark ? Colors.dark : Colors.light;
  const [copySnack, setCopySnack] = useState(false);
  const [showHours, setShowHours] = useState(false);
  const boroughColor = getBoroughColor(precinct.borough, colors);

  const openingHours: DayHours[] = useMemo(() => {
    try {
      const parsed = JSON.parse(precinct.openingHoursJson || '[]');
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [];
    } catch {
      return [];
    }
  }, [precinct.openingHoursJson]);

  const todayStatus = useMemo(() => {
    if (openingHours.length === 0) return null;
    const dayIndex = new Date().getDay(); // 0=Sun
    return openingHours[dayIndex] || null;
  }, [openingHours]);

  const handleCall = () => {
    const phoneNum = precinct.phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${phoneNum}`);
  };

  const handleNavigate = () => {
    const address = encodeURIComponent(precinct.address + ', New York, NY');
    const url = Platform.select({
      ios: `maps:?daddr=${address}`,
      android: `google.navigation:q=${address}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${address}`,
    });
    if (url) Linking.openURL(url);
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(precinct.address);
    setCopySnack(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Drag handle */}
      <View style={styles.handleBar}>
        <View style={[styles.handle, { backgroundColor: colors.outline }]} />
      </View>

      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.precinctName, { color: colors.textPrimary }]}>
            {precinct.name}
          </Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: `${boroughColor}18` }]}>
              <Text style={[styles.badgeText, { color: boroughColor }]}>{precinct.borough}</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {onToggleFavorite && (
            <IconButton
              icon={isFavorited ? 'star' : 'star-outline'}
              iconColor={isFavorited ? '#2979FF' : colors.textTertiary}
              size={22}
              onPress={onToggleFavorite}
              style={{ margin: 0 }}
            />
          )}
          {onClose && (
            <IconButton icon="close" iconColor={colors.textTertiary} size={20} onPress={onClose} style={{ margin: 0 }} />
          )}
        </View>
      </View>

      {/* Searched address banner */}
      {searchedAddress && (
        <View style={[styles.searchedAddressBox, { backgroundColor: `${colors.accent}10`, borderColor: `${colors.accent}25` }]}>
          <MaterialCommunityIcons name="map-search-outline" size={16} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.searchedAddressLabel, { color: colors.accent }]}>Searched Address</Text>
            <Text style={[styles.searchedAddressText, { color: colors.textPrimary }]} numberOfLines={2}>
              {searchedAddress}
            </Text>
          </View>
        </View>
      )}

      {/* Precinct info card */}
      <View style={styles.labeledInfoSection}>
        <View style={[styles.labeledInfoCard, { backgroundColor: `${colors.accent}14`, borderColor: `${colors.accent}30` }]}>
          <View style={[styles.labeledInfoIconRow]}>
            <MaterialCommunityIcons name="shield-outline" size={16} color={colors.accent} />
            <Text style={[styles.labeledInfoLabel, { color: colors.textTertiary }]}>PRECINCT</Text>
          </View>
          <Text style={[styles.labeledInfoValue, { color: colors.accent }]}>{precinct.precinctNum}</Text>
          <Text style={[styles.labeledInfoName, { color: colors.textSecondary }]} numberOfLines={1}>
            {precinct.name}
          </Text>
        </View>
      </View>

      {/* Reverse geocoded address */}
      {reverseAddress && (
        <View style={[styles.reverseBox, { backgroundColor: `${colors.secondary}12` }]}>
          <MaterialCommunityIcons name="crosshairs-gps" size={14} color={colors.secondary} />
          <Text style={[styles.reverseText, { color: colors.secondary }]}>{reverseAddress}</Text>
        </View>
      )}

      {/* Info rows */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.textTertiary} />
          <Text style={[styles.infoText, { color: colors.textPrimary }]}>{precinct.address}</Text>
        </View>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="phone-outline" size={18} color={colors.textTertiary} />
          <Text style={[styles.infoText, { color: colors.textPrimary }]}>{precinct.phone}</Text>
        </View>
      </View>

      <Divider style={{ backgroundColor: colors.divider, marginVertical: 12 }} />

      {/* Quick Actions */}
      <View style={styles.actions}>
        <ActionButton icon="phone" label="Call" color="#2979FF" bgColor="rgba(41,121,255,0.1)" onPress={handleCall} />
        <ActionButton icon="navigation-variant" label="Navigate" color="#2979FF" bgColor="rgba(41,121,255,0.1)" onPress={handleNavigate} />
        <ActionButton icon="content-copy" label="Copy" color="#2979FF" bgColor="rgba(41,121,255,0.1)" onPress={handleCopy} />
      </View>

      {/* Opening Hours */}
      {openingHours.length > 0 && (
        <>
          <Divider style={{ backgroundColor: colors.divider, marginVertical: 12 }} />
          <View style={styles.hoursHeader}>
            <View style={styles.hoursHeaderLeft}>
              <MaterialCommunityIcons name="clock-outline" size={16} color={colors.textTertiary} />
              <Text style={[styles.hoursTitle, { color: colors.textPrimary }]}>Opening Hours</Text>
              {todayStatus && (
                <View style={[styles.statusBadge, { backgroundColor: todayStatus.isOpen ? 'rgba(76,175,80,0.12)' : 'rgba(211,47,47,0.12)' }]}>
                  <View style={[styles.statusDot, { backgroundColor: todayStatus.isOpen ? '#4CAF50' : '#D32F2F' }]} />
                  <Text style={[styles.statusText, { color: todayStatus.isOpen ? '#4CAF50' : '#D32F2F' }]}>
                    {todayStatus.isOpen ? 'Open' : 'Closed'}
                  </Text>
                </View>
              )}
            </View>
            <IconButton
              icon={showHours ? 'chevron-up' : 'chevron-down'}
              iconColor={colors.textTertiary}
              size={18}
              onPress={() => setShowHours(!showHours)}
              style={{ margin: 0 }}
            />
          </View>
          {showHours && (
            <View style={[styles.hoursCard, { backgroundColor: isDark ? colors.surfaceVariant : '#F8F9FA', borderColor: colors.cardBorder }]}>
              {openingHours.map((dh, i) => {
                const isToday = new Date().getDay() === i;
                return (
                  <View key={i} style={[styles.hoursRow, isToday && styles.hoursRowToday, isToday && { backgroundColor: `${colors.accent}10` }]}>
                    <View style={styles.hoursDayCol}>
                      <View style={[styles.hoursDot, { backgroundColor: dh.isOpen ? '#4CAF50' : '#D32F2F' }]} />
                      <Text style={[styles.hoursDayText, { color: isToday ? colors.accent : colors.textPrimary }, isToday && { fontWeight: '800' }]}>
                        {dh.day.substring(0, 3)}
                      </Text>
                    </View>
                    <Text style={[styles.hoursTimeText, { color: dh.isOpen ? colors.textSecondary : '#D32F2F' }, isToday && { fontWeight: '700', color: isToday ? colors.accent : undefined }]}>
                      {dh.hours}
                    </Text>
                    {isToday && (
                      <View style={[styles.todayIndicator, { backgroundColor: colors.accent }]}>
                        <Text style={styles.todayIndicatorText}>TODAY</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}

      <Snackbar visible={copySnack} onDismiss={() => setCopySnack(false)} duration={1500}>
        Address copied to clipboard
      </Snackbar>
    </View>
  );
}

function ActionButton({ icon, label, color, bgColor, onPress }: {
  icon: string; label: string; color: string; bgColor: string; onPress: () => void;
}) {
  return (
    <View style={styles.actionItem}>
      <View style={[styles.actionCircle, { backgroundColor: bgColor }]}>
        <IconButton icon={icon} iconColor={color} size={22} onPress={onPress} style={{ margin: 0 }} />
      </View>
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  handleBar: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: { flex: 1 },
  precinctName: {
    fontSize: 20,
    fontWeight: '800',
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  searchedAddressBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
  },
  searchedAddressLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  searchedAddressText: {
    fontSize: 14,
    fontWeight: '600',
  },
  labeledInfoSection: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  labeledInfoCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  labeledInfoIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  labeledInfoLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  labeledInfoValue: {
    fontSize: 26,
    fontWeight: '900',
    marginTop: 2,
  },
  labeledInfoName: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  reverseBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  reverseText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  infoSection: {
    marginTop: 12,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    fontSize: 14,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionItem: {
    alignItems: 'center',
    gap: 4,
  },
  actionCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  hoursHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hoursHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hoursTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  hoursCard: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  hoursRowToday: {
    borderRadius: 8,
    marginHorizontal: 2,
    marginVertical: 1,
  },
  hoursDayCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 60,
  },
  hoursDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  hoursDayText: {
    fontSize: 13,
    fontWeight: '600',
  },
  hoursTimeText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  todayIndicator: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  todayIndicatorText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
});
