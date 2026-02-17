import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, MapPressEvent, LongPressEvent, Region } from 'react-native-maps';
import { Snackbar, Portal, Dialog, Button, TextInput as PaperInput, FAB, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useAppContext } from '../../src/context/AppContext';
import { reverseGeocode, findNearbyNYPDPrecinct } from '../../src/services/nycApi';
import { PrecinctInfoSheet } from '../../src/components/PrecinctInfoSheet';
import { findPrecinctAtLocation, findSectorAtLocation, getPrecinctByNumber } from '../../src/db/repositories/precinctRepository';
import { isFavorited, upsertFavorite, removeFavorite } from '../../src/db/repositories/favoriteRepository';
import { Colors } from '../../src/theme/colors';
import type { LatLng } from '../../src/models';

const NYC_CENTER: Region = {
  latitude: 40.7128,
  longitude: -74.006,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

export default function MapScreen() {
  const {
    isDark, mapType,
    selectedPrecinct, setSelectedPrecinct,
    selectedSector, setSelectedSector,
    searchedAddress, setSearchedAddress,
    searchedLocation, setSearchedLocation,
  } = useAppContext();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const [isFav, setIsFav] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [reverseAddress, setReverseAddress] = useState<string | null>(null);
  const [tappedLocation, setTappedLocation] = useState<LatLng | null>(null);
  const [favDialogVisible, setFavDialogVisible] = useState(false);
  const [favLabel, setFavLabel] = useState('');

  // Load favorite status when precinct selected
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

  // Animate to searched location or selected precinct
  useEffect(() => {
    if (!mapRef.current) return;
    if (searchedLocation) {
      mapRef.current.animateToRegion({
        latitude: searchedLocation.latitude,
        longitude: searchedLocation.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 600);
    } else if (selectedPrecinct) {
      mapRef.current.animateToRegion({
        latitude: selectedPrecinct.centroidLat,
        longitude: selectedPrecinct.centroidLng,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      }, 600);
    }
  }, [selectedPrecinct, searchedLocation]);

  const handleMapPress = useCallback(async (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    const point: LatLng = { latitude, longitude };

    // Ask Google which precinct covers this point
    let precinct = null;
    const nearbyNum = await findNearbyNYPDPrecinct(latitude, longitude);
    if (nearbyNum) {
      precinct = await getPrecinctByNumber(nearbyNum);
    }
    if (!precinct) {
      precinct = await findPrecinctAtLocation(point);
    }

    setSelectedPrecinct(precinct);
    setSelectedSector(null);
    setTappedLocation(precinct ? point : null);
    setReverseAddress(null);
    setSearchedAddress(null);
    setSearchedLocation(null);
  }, [setSelectedPrecinct, setSelectedSector, setSearchedAddress, setSearchedLocation]);

  const handleMapLongPress = useCallback(async (e: LongPressEvent) => {
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
    setSelectedSector(null);
    setTappedLocation(point);
    try {
      const address = await reverseGeocode(latitude, longitude);
      setReverseAddress(address || 'Address not found');
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
    setTappedLocation(null);
    setReverseAddress(null);
    setSearchedAddress(null);
    setSearchedLocation(null);
  }, [setSelectedPrecinct, setSelectedSector, setSearchedAddress, setSearchedLocation]);

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
        {/* Red pin for searched address */}
        {searchedLocation && (
          <Marker
            coordinate={searchedLocation}
            title={searchedAddress || 'Searched Location'}
            description={selectedPrecinct ? selectedPrecinct.name : undefined}
            pinColor="#D32F2F"
          />
        )}

        {/* Blue pin at tapped/selected location */}
        {selectedPrecinct && !searchedLocation && tappedLocation && (
          <Marker
            coordinate={tappedLocation}
            title={reverseAddress || selectedPrecinct.name}
            description={selectedPrecinct.address}
            pinColor={reverseAddress ? '#D32F2F' : '#2979FF'}
          />
        )}

        {/* Blue pin at precinct building when selected from list */}
        {selectedPrecinct && !searchedLocation && !tappedLocation && (
          <Marker
            coordinate={{
              latitude: selectedPrecinct.centroidLat,
              longitude: selectedPrecinct.centroidLng,
            }}
            title={selectedPrecinct.name}
            description={selectedPrecinct.address}
            pinColor="#2979FF"
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
            sector={selectedSector}
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
