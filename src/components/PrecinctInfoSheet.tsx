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

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.nameRow}>
            <Text style={[styles.precinctName, { color: colors.textPrimary }]}>
              {precinct.name}
            </Text>
            {onToggleFavorite && (
              <IconButton
                icon={isFavorited ? 'star' : 'star-outline'}
                iconColor={isFavorited ? '#2979FF' : colors.textTertiary}
                size={22}
                onPress={onToggleFavorite}
                style={{ margin: 0 }}
              />
            )}
          </View>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: `${boroughColor}18` }]}>
              <Text style={[styles.badgeText, { color: boroughColor }]}>{precinct.borough}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: `${colors.accent}15` }]}>
              <Text style={[styles.badgeText, { color: colors.accent }]}>#{precinct.precinctNum}</Text>
            </View>
            {sector && (
              <View style={[styles.badge, { backgroundColor: colors.highlightBg }]}>
                <Text style={[styles.badgeText, { color: colors.highlight }]}>Sector {sector.sectorId}</Text>
              </View>
            )}
          </View>
        </View>
        {onClose && (
          <IconButton icon="close" iconColor={colors.textTertiary} size={20} onPress={onClose} style={{ margin: 0 }} />
        )}
      </View>

      {/* Searched address */}
      {searchedAddress && (
        <View style={[styles.searchedAddressBox, { backgroundColor: `${colors.accent}10`, borderColor: `${colors.accent}25` }]}>
          <MaterialCommunityIcons name="map-search-outline" size={16} color={colors.accent} />
          <Text style={[styles.searchedAddressText, { color: colors.textPrimary }]} numberOfLines={2}>
            {searchedAddress}
          </Text>
        </View>
      )}

      {/* Labeled Precinct & Sector */}
      <View style={styles.labeledInfoSection}>
        <View style={[styles.labeledInfoCard, { backgroundColor: `${colors.accent}10`, borderColor: `${colors.accent}20` }]}>
          <Text style={[styles.labeledInfoLabel, { color: colors.textTertiary }]}>Precinct</Text>
          <Text style={[styles.labeledInfoValue, { color: colors.accent }]}>{precinct.precinctNum}</Text>
        </View>
        <View style={[
          styles.labeledInfoCard,
          { backgroundColor: sector ? 'rgba(255,152,0,0.10)' : `${colors.outline}20`, borderColor: sector ? 'rgba(255,152,0,0.25)' : `${colors.outline}30` },
        ]}>
          <Text style={[styles.labeledInfoLabel, { color: colors.textTertiary }]}>Sector</Text>
          <Text style={[styles.labeledInfoValue, { color: sector ? '#FF9800' : colors.textTertiary }]}>
            {sector ? sector.sectorId : '—'}
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
        <ActionButton
          icon="phone"
          label="Call"
          color="#2979FF"
          bgColor="rgba(41,121,255,0.1)"
          onPress={handleCall}
        />
        <ActionButton
          icon="navigation-variant"
          label="Navigate"
          color="#2979FF"
          bgColor="rgba(41,121,255,0.1)"
          onPress={handleNavigate}
        />
        <ActionButton
          icon="content-copy"
          label="Copy"
          color="#2979FF"
          bgColor="rgba(41,121,255,0.1)"
          onPress={handleCopy}
        />
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  precinctName: {
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
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
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
    borderWidth: 1,
  },
  searchedAddressText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  labeledInfoSection: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  labeledInfoCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  labeledInfoLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  labeledInfoValue: {
    fontSize: 22,
    fontWeight: '900',
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
