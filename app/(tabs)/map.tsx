import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import MapView, { Polygon, MapPressEvent, LongPressEvent, Region } from 'react-native-maps';
import { Snackbar, Portal, Dialog, Button, TextInput as PaperInput, FAB } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useAppContext } from '../../src/context/AppContext';
import { PrecinctInfoSheet } from '../../src/components/PrecinctInfoSheet';
import { getAllPrecincts, getSectorsForPrecinct, findPrecinctAtLocation, findSectorAtLocation } from '../../src/db/repositories/precinctRepository';
import { isFavorited, upsertFavorite, removeFavorite } from '../../src/db/repositories/favoriteRepository';
import { Colors, getBoroughColor } from '../../src/theme/colors';
import { getPolygonRings } from '../../src/utils/geo';
import type { Precinct, Sector, LatLng } from '../../src/models';

const NYC_CENTER: Region = {
  latitude: 40.7128,
  longitude: -74.006,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

export default function MapScreen() {
  const {
    isDark, mapType, boundaryVisible,
    selectedPrecinct, setSelectedPrecinct,
    selectedSector, setSelectedSector,
  } = useAppContext();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const [precincts, setPrecincts] = useState<Precinct[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [isFav, setIsFav] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [reverseAddress, setReverseAddress] = useState<string | null>(null);
  const [favDialogVisible, setFavDialogVisible] = useState(false);
  const [favLabel, setFavLabel] = useState('');

  // Load precincts
  useEffect(() => {
    (async () => {
      const data = await getAllPrecincts();
      setPrecincts(data);
    })();
  }, []);

  // Load sectors when precinct selected
  useEffect(() => {
    if (selectedPrecinct) {
      (async () => {
        const sectorData = await getSectorsForPrecinct(selectedPrecinct.precinctNum);
        setSectors(sectorData);
        const fav = await isFavorited(selectedPrecinct.precinctNum);
        setIsFav(fav);
      })();
    } else {
      setSectors([]);
      setReverseAddress(null);
    }
  }, [selectedPrecinct]);

  // Animate to selected precinct
  useEffect(() => {
    if (selectedPrecinct && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: selectedPrecinct.centroidLat,
        longitude: selectedPrecinct.centroidLng,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      }, 600);
    }
  }, [selectedPrecinct]);

  const handleMapPress = useCallback(async (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    const point: LatLng = { latitude, longitude };
    const precinct = await findPrecinctAtLocation(point);
    const sector = await findSectorAtLocation(point);
    setSelectedPrecinct(precinct);
    setSelectedSector(sector);
    setReverseAddress(null);
  }, [setSelectedPrecinct, setSelectedSector]);

  const handleMapLongPress = useCallback(async (e: LongPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    const point: LatLng = { latitude, longitude };
    const precinct = await findPrecinctAtLocation(point);
    const sector = await findSectorAtLocation(point);
    setSelectedPrecinct(precinct);
    setSelectedSector(sector);
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results?.length > 0) {
        const r = results[0];
        const parts = [r.streetNumber, r.street, r.city, r.region, r.postalCode].filter(Boolean);
        setReverseAddress(parts.join(', ') || 'Address not found');
      }
    } catch {
      setReverseAddress('Unable to resolve address');
    }
  }, [setSelectedPrecinct, setSelectedSector]);

  const handleToggleFavorite = useCallback(async () => {
    if (!selectedPrecinct) return;
    if (isFav) {
      await removeFavorite(selectedPrecinct.precinctNum);
      setIsFav(false);
      setSnackMessage('Removed from favorites');
    } else {
      setFavLabel(selectedPrecinct.name);
      setFavDialogVisible(true);
    }
  }, [selectedPrecinct, isFav]);

  const handleSaveFavorite = useCallback(async () => {
    if (!selectedPrecinct) return;
    const label = favLabel.trim() || selectedPrecinct.name;
    await upsertFavorite(selectedPrecinct.precinctNum, label);
    setIsFav(true);
    setFavDialogVisible(false);
    setSnackMessage(`"${label}" saved to favorites`);
  }, [selectedPrecinct, favLabel]);

  const handleClose = useCallback(() => {
    setSelectedPrecinct(null);
    setSelectedSector(null);
    setReverseAddress(null);
  }, [setSelectedPrecinct, setSelectedSector]);

  const handleMyLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 600);
    } catch {}
  }, []);

  const mapTypeValue = mapType === 'satellite' ? 'satellite' : mapType === 'terrain' ? 'terrain' : 'standard';

  // Polygon overlays
  const precinctPolygons = useMemo(() => {
    if (!boundaryVisible) return null;
    return precincts.map((precinct) => {
      try {
        const geometry = JSON.parse(precinct.boundaryJson);
        const rings = getPolygonRings(geometry);
        const isSelected = selectedPrecinct?.precinctNum === precinct.precinctNum;
        const boroughColor = getBoroughColor(precinct.borough, colors);
        return rings.map((ring, i) => (
          <Polygon
            key={`p-${precinct.precinctNum}-${i}`}
            coordinates={ring}
            strokeColor={isSelected ? colors.mapSelectedStroke : boroughColor}
            fillColor={isSelected ? colors.mapSelectedFill : `${boroughColor}20`}
            strokeWidth={isSelected ? 3 : 1.5}
            tappable={false}
          />
        ));
      } catch { return null; }
    });
  }, [precincts, boundaryVisible, selectedPrecinct, colors]);

  const sectorPolygons = useMemo(() => {
    if (!boundaryVisible || !selectedPrecinct) return null;
    return sectors.map((sector) => {
      try {
        const geometry = JSON.parse(sector.boundaryJson);
        const rings = getPolygonRings(geometry);
        const isSelected = selectedSector?.sectorId === sector.sectorId;
        return rings.map((ring, i) => (
          <Polygon
            key={`s-${sector.sectorId}-${i}`}
            coordinates={ring}
            strokeColor={isSelected ? colors.highlight : colors.accent}
            fillColor={isSelected ? 'rgba(255,179,0,0.2)' : 'rgba(41,121,255,0.08)'}
            strokeWidth={isSelected ? 2.5 : 1}
            lineDashPattern={[5, 5]}
            tappable={false}
          />
        ));
      } catch { return null; }
    });
  }, [sectors, boundaryVisible, selectedSector, selectedPrecinct, colors]);

  return (
    <View style={styles.container}>
      <MapView
        key={`map-${mapType}-${isDark}`}
        ref={mapRef}
        style={styles.map}
        initialRegion={NYC_CENTER}
        mapType={mapTypeValue}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
        showsScale
        toolbarEnabled={false}
        onPress={handleMapPress}
        onLongPress={handleMapLongPress}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
      >
        {precinctPolygons}
        {sectorPolygons}
      </MapView>

      {/* My Location FAB */}
      <FAB
        icon="crosshairs-gps"
        size="small"
        style={[styles.locationFab, { top: insets.top + 12, backgroundColor: colors.surface }]}
        color={colors.accent}
        onPress={handleMyLocation}
      />

      {/* Bottom Info Sheet */}
      {selectedPrecinct && (
        <View style={[styles.sheetContainer, { paddingBottom: 0 }]}>
          <PrecinctInfoSheet
            precinct={selectedPrecinct}
            sector={selectedSector}
            reverseAddress={reverseAddress}
            onClose={handleClose}
            isFavorited={isFav}
            onToggleFavorite={handleToggleFavorite}
          />
        </View>
      )}

      {/* Favorite Label Dialog */}
      <Portal>
        <Dialog visible={favDialogVisible} onDismiss={() => setFavDialogVisible(false)} style={{ backgroundColor: colors.surface }}>
          <Dialog.Title style={{ color: colors.textPrimary }}>Save as Favorite</Dialog.Title>
          <Dialog.Content>
            <PaperInput
              label="Label (e.g. Home, Work)"
              value={favLabel}
              onChangeText={setFavLabel}
              mode="outlined"
              autoFocus
              outlineColor={colors.outline}
              activeOutlineColor={colors.accent}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setFavDialogVisible(false)} textColor={colors.textSecondary}>Cancel</Button>
            <Button onPress={handleSaveFavorite} textColor={colors.accent}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={!!snackMessage}
        onDismiss={() => setSnackMessage('')}
        duration={2000}
        style={{ marginBottom: selectedPrecinct ? 260 : 16 }}
      >
        {snackMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  locationFab: {
    position: 'absolute',
    right: 16,
    elevation: 4,
    borderRadius: 28,
  },
});
