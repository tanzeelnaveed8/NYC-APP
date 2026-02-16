import React, { useState } from 'react';
import { View, StyleSheet, Linking, Platform } from 'react-native';
import { Text, IconButton, Divider, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import type { Precinct, Sector } from '../models';
import { Colors, getBoroughColor } from '../theme/colors';
import { useAppContext } from '../context/AppContext';

interface Props {
  precinct: Precinct;
  sector?: Sector | null;
  reverseAddress?: string | null;
  searchedAddress?: string | null;
  onClose?: () => void;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
}

export function PrecinctInfoSheet({ precinct, sector, reverseAddress, searchedAddress, onClose, isFavorited, onToggleFavorite }: Props) {
  const { isDark } = useAppContext();
  const colors = isDark ? Colors.dark : Colors.light;
  const [copySnack, setCopySnack] = useState(false);
  const boroughColor = getBoroughColor(precinct.borough, colors);

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

      {/* Precinct & Sector info cards */}
      <View style={styles.labeledInfoSection}>
        {/* Precinct card */}
        <View style={[styles.labeledInfoCard, { backgroundColor: 'rgba(244,67,54,0.08)', borderColor: 'rgba(244,67,54,0.20)' }]}>
          <View style={[styles.labeledInfoIconRow]}>
            <MaterialCommunityIcons name="shield-outline" size={16} color="#E53935" />
            <Text style={[styles.labeledInfoLabel, { color: colors.textTertiary }]}>PRECINCT</Text>
          </View>
          <Text style={[styles.labeledInfoValue, { color: '#E53935' }]}>{precinct.precinctNum}</Text>
          <Text style={[styles.labeledInfoName, { color: colors.textSecondary }]} numberOfLines={1}>
            {precinct.name}
          </Text>
        </View>

        {/* Sector card */}
        <View style={[
          styles.labeledInfoCard,
          { backgroundColor: sector ? 'rgba(255,152,0,0.08)' : `${colors.outline}15`, borderColor: sector ? 'rgba(255,152,0,0.20)' : `${colors.outline}25` },
        ]}>
          <View style={styles.labeledInfoIconRow}>
            <MaterialCommunityIcons name="vector-square" size={16} color={sector ? '#F57C00' : colors.textTertiary} />
            <Text style={[styles.labeledInfoLabel, { color: colors.textTertiary }]}>SECTOR</Text>
          </View>
          <Text style={[styles.labeledInfoValue, { color: sector ? '#F57C00' : colors.textTertiary }]}>
            {sector ? sector.sectorId : '—'}
          </Text>
          <Text style={[styles.labeledInfoName, { color: colors.textTertiary }]} numberOfLines={1}>
            {sector ? `Precinct ${sector.precinctNum}` : 'Not identified'}
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
});
