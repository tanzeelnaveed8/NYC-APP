import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, Circle, Polygon, MapPressEvent, LongPressEvent, Region } from 'react-native-maps';
import { Snackbar, Portal, Dialog, Button, TextInput as PaperInput, FAB, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Location from 'expo-location';
import { useAppContext } from '../../src/context/AppContext';
import { reverseGeocode, findNearbyNYPDPrecinct } from '../../src/services/nycApi';
import { PrecinctInfoSheet } from '../../src/components/PrecinctInfoSheet';
import { getAllPrecincts, findPrecinctAtLocation, getPrecinctByNumber } from '../../src/db/repositories/precinctRepository';
import { isFavorited, upsertFavorite, removeFavorite } from '../../src/db/repositories/favoriteRepository';
import { Colors } from '../../src/theme/colors';
import type { LatLng, Precinct } from '../../src/models';
import PRECINCT_PINS from '../../src/data/precinctLocations.json';
import PRECINCT_BOUNDARIES from '../../src/data/precinctBoundaries.json';

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
    searchedAddress, setSearchedAddress,
    searchedLocation, setSearchedLocation,
  } = useAppContext();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const [dbPrecincts, setDbPrecincts] = useState<Precinct[]>([]);
  const [isFav, setIsFav] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [reverseAddress, setReverseAddress] = useState<string | null>(null);
  const [tappedLocation, setTappedLocation] = useState<LatLng | null>(null);
  const [favDialogVisible, setFavDialogVisible] = useState(false);
  const [favLabel, setFavLabel] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const pcts = await getAllPrecincts();
        setDbPrecincts(pcts);
      } catch {}
    })();
  }, []);

  const mapPins = React.useMemo(() => {
    const dbMap = new Map(dbPrecincts.map(p => [p.precinctNum, p]));
    return PRECINCT_PINS.map(pin => {
      const db = dbMap.get(pin.num);
      return {
        num: pin.num,
        lat: db?.centroidLat || pin.lat,
        lng: db?.centroidLng || pin.lng,
      };
    });
  }, [dbPrecincts]);


  useEffect(() => {
    if (selectedPrecinct) {
      (async () => {
        const fav = await isFavorited(selectedPrecinct.precinctNum);
        setIsFav(fav);
      })();
    } else {
      setReverseAddress(null);
      setTappedLocation(null);
    }
  }, [selectedPrecinct]);

  useEffect(() => {
    if (!mapRef.current || !searchedLocation) return;
    const t = setTimeout(() => {
      mapRef.current?.animateToRegion({
        latitude: searchedLocation.latitude,
        longitude: searchedLocation.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      }, 600);
    }, 300);
    return () => clearTimeout(t);
  }, [searchedLocation]);

  useEffect(() => {
    if (!mapRef.current || !selectedPrecinct || searchedLocation) return;
    mapRef.current.animateToRegion({
      latitude: selectedPrecinct.centroidLat,
      longitude: selectedPrecinct.centroidLng,
      latitudeDelta: 0.025,
      longitudeDelta: 0.025,
    }, 600);
  }, [selectedPrecinct]);

  const handleMapPress = useCallback(async (e: MapPressEvent) => {
    try {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      const point: LatLng = { latitude, longitude };

      let precinct = null;
      const nearbyNum = await findNearbyNYPDPrecinct(latitude, longitude);
      if (nearbyNum) {
        precinct = await getPrecinctByNumber(nearbyNum);
      }
      if (!precinct) {
        precinct = await findPrecinctAtLocation(point);
      }

      setSelectedPrecinct(precinct);
      setTappedLocation(precinct ? point : null);
      setReverseAddress(null);
      setSearchedAddress(null);
      setSearchedLocation(null);
    } catch {}
  }, [setSelectedPrecinct, setSearchedAddress, setSearchedLocation]);

  const handleMapLongPress = useCallback(async (e: LongPressEvent) => {
    try {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      const point: LatLng = { latitude, longitude };

      let precinct = null;
      const nearbyNum = await findNearbyNYPDPrecinct(latitude, longitude);
      if (nearbyNum) {
        precinct = await getPrecinctByNumber(nearbyNum);
      }
      if (!precinct) {
        precinct = await findPrecinctAtLocation(point);
      }

      setSelectedPrecinct(precinct);
      setTappedLocation(point);
      try {
        const address = await reverseGeocode(latitude, longitude);
        setReverseAddress(address || 'Address not found');
      } catch {
        setReverseAddress('Unable to resolve address');
      }
    } catch {}
  }, [setSelectedPrecinct]);

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
    setTappedLocation(null);
    setReverseAddress(null);
    setSearchedAddress(null);
    setSearchedLocation(null);
  }, [setSelectedPrecinct, setSearchedAddress, setSearchedLocation]);

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

  const handleMarkerPress = useCallback(async (num: number) => {
    try {
      const pct = await getPrecinctByNumber(num);
      if (pct) {
        setSelectedPrecinct(pct);
        setTappedLocation(null);
        setReverseAddress(null);
        setSearchedAddress(null);
        setSearchedLocation(null);
      }
    } catch {}
  }, [setSelectedPrecinct, setSearchedAddress, setSearchedLocation]);

  const precinctCoord = selectedPrecinct ? {
    latitude: selectedPrecinct.centroidLat,
    longitude: selectedPrecinct.centroidLng,
  } : null;

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
        {/* ── Precinct boundaries ── */}
        {boundaryVisible && Object.entries(PRECINCT_BOUNDARIES).map(([num, coords]) => {
          const pNum = parseInt(num);
          const isSelected = selectedPrecinct?.precinctNum === pNum;
          return (
            <Polygon
              key={`boundary-${num}`}
              coordinates={coords as {latitude: number; longitude: number}[]}
              fillColor={isSelected ? 'rgba(211, 47, 47, 0.20)' : 'rgba(211, 47, 47, 0.05)'}
              strokeColor={isSelected ? 'rgba(211, 47, 47, 0.9)' : 'rgba(211, 47, 47, 0.4)'}
              strokeWidth={isSelected ? 2.5 : 1}
              tappable
              onPress={() => handleMarkerPress(pNum)}
            />
          );
        })}

        {/* ── Selected precinct highlight ── */}
        {selectedPrecinct && (() => {
          const pin = mapPins.find(p => p.num === selectedPrecinct.precinctNum);
          if (!pin) return null;
          const coord = { latitude: pin.lat, longitude: pin.lng };
          return (
            <>
              <Circle
                center={coord}
                radius={120}
                fillColor="rgba(211, 47, 47, 0.08)"
                strokeColor="rgba(211, 47, 47, 0.20)"
                strokeWidth={1}
              />
              <Circle
                center={coord}
                radius={60}
                fillColor="rgba(211, 47, 47, 0.15)"
                strokeColor="rgba(211, 47, 47, 0.35)"
                strokeWidth={1.5}
              />
              <Marker
                coordinate={coord}
                onPress={() => handleMarkerPress(pin.num)}
                pinColor="red"
                title={`Precinct ${pin.num}`}
              />
            </>
          );
        })()}

        {/* ── Searched address pin ── */}
        {searchedLocation && (
          <Marker
            coordinate={{
              latitude: searchedLocation.latitude,
              longitude: searchedLocation.longitude,
            }}
            title={searchedAddress || 'Searched Location'}
            description={selectedPrecinct ? selectedPrecinct.name : undefined}
            pinColor="violet"
          />
        )}

        {/* ── Tapped location pin ── */}
        {selectedPrecinct && !searchedLocation && tappedLocation &&
          tappedLocation.latitude !== selectedPrecinct.centroidLat && (
          <Marker
            coordinate={tappedLocation}
            title={reverseAddress || 'Tapped Location'}
            pinColor="orange"
          />
        )}
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
            reverseAddress={reverseAddress}
            searchedAddress={searchedAddress}
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
