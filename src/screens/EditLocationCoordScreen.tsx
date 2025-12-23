import React, { useState, useRef } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import Mapbox, { MapView, Camera } from '@rnmapbox/maps';
import { Spinner, Button, Text, XStack, YStack, useTheme } from 'tamagui';
import { Place, Point } from '@fleetbase/sdk';
import { useNavigation } from '@react-navigation/native';
import { restoreFleetbasePlace, getCoordinates } from '../utils/location';
import LocationMarker from '../components/LocationMarker';
import useSavedLocations from '../hooks/use-saved-locations';
import usePromiseWithLoading from '../hooks/use-promise-with-loading';
import useFleetbase from '../hooks/use-fleetbase';
import { toast } from '../utils/toast';
import Config from 'react-native-config';

// Initialize Mapbox
Mapbox.setAccessToken(Config.MAPBOX_ACCESS_TOKEN || '');

const LOCATION_MARKER_SIZE = { height: 70, width: 40 };
const styles = StyleSheet.create({
    markerFixed: {
        position: 'absolute',
        top: Dimensions.get('window').height / 2 - LOCATION_MARKER_SIZE.height / 2,
        left: Dimensions.get('window').width / 2 - LOCATION_MARKER_SIZE.width / 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

interface EditLocationCoordScreenProps {
    route: any;
}

const EditLocationCoordScreen: React.FC<EditLocationCoordScreenProps> = ({ route }) => {
    const params = route.params || {};
    const navigation = useNavigation();
    const theme = useTheme();
    const { adapter } = useFleetbase();
    const place = restoreFleetbasePlace({ ...params.place }, adapter);
    const { updateLocationState } = useSavedLocations();
    const { runWithLoading, isLoading } = usePromiseWithLoading();
    const [latitude, longitude] = getCoordinates(place);
    const [centerCoordinate, setCenterCoordinate] = useState<[number, number]>([longitude, latitude]);
    const [isPanning, setIsPanning] = useState(false);
    const cameraRef = useRef<Camera>(null);
    const redirectTo = params.redirectTo;

    // Handle panning tracking
    const handleTouchStart = () => setIsPanning(true);
    const handleTouchEnd = () => setIsPanning(false);

    // Function to handle region change and update the center location
    const handleRegionChange = (feature: any) => {
        if (feature.properties?.isUserInteraction) {
            setIsPanning(true);
        }
    };

    const handleRegionChangeComplete = (feature: any) => {
        setIsPanning(false);
        const { geometry } = feature;
        if (geometry && geometry.coordinates) {
            setCenterCoordinate(geometry.coordinates);
        }
    };

    // Handle redirect
    const handleRedirect = () => {
        if (redirectTo === 'AddressBook') {
            navigation.reset({
                index: 2,
                routes: [{ name: 'Profile' as never }, { name: redirectTo as never }, { name: 'EditLocation' as never, params: { place: place.serialize(), redirectTo } }],
            });
        } else {
            navigation.reset({
                index: 1,
                routes: [{ name: redirectTo as never }, { name: 'EditLocation' as never, params: { place: place.serialize(), redirectTo } }],
            });
        }
    };

    // Save place
    const handleSave = async () => {
        const [lng, lat] = centerCoordinate;
        
        if (place.isNew) {
            try {
                place.setAttribute('location', new Point(lat, lng));
                return handleRedirect();
            } catch (error: any) {
                console.log('Error saving address coordinates:', error);
                toast.error(error.message);
            }
        }

        try {
            const updatedPlace = await runWithLoading(place.update({ location: new Point(lat, lng) }));
            updateLocationState(updatedPlace);
            handleRedirect();
        } catch (error: any) {
            console.log('Error saving address coordinates:', error);
            toast.error(error.message);
        }
    };

    // Reset map to original place coordinates
    const handleReset = () => {
        const [lat, lng] = getCoordinates(place);

        setIsPanning(true);

        if (cameraRef.current) {
            cameraRef.current.setCamera({
                centerCoordinate: [lng, lat],
                zoomLevel: 17,
                animationDuration: 500,
            });
        }

        setTimeout(() => {
            setIsPanning(false);
            setCenterCoordinate([lng, lat]);
        }, 500);
    };

    return (
        <YStack flex={1} alignItems='center' justifyContent='center' bg='$surface' width='100%' height='100%'>
            <MapView
                style={{ ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' }}
                styleURL={Mapbox.StyleURL.Street}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onCameraChanged={handleRegionChange}
                onMapIdle={handleRegionChangeComplete}
            >
                <Camera
                    ref={cameraRef}
                    zoomLevel={17}
                    centerCoordinate={centerCoordinate}
                />
            </MapView>
            <YStack style={styles.markerFixed} pointerEvents="none">
                <LocationMarker lifted={isPanning} />
            </YStack>
            <XStack animate='bouncy' position='absolute' bottom={0} left={0} right={0} padding='$5' zIndex={5} space='$3'>
                <Button onPress={handleSave} size='$5' bg='$blue-700' flex={1}>
                    <Button.Icon>{isLoading() && <Spinner color='$blue-100' />}</Button.Icon>
                    <Button.Text color='$blue-100' fontWeight='bold' fontSize='$5'>
                        Salvar Posição
                    </Button.Text>
                </Button>
                <Button onPress={handleReset} size='$5' bg='$secondary' flex={1}>
                    <Button.Text color='$textSecondary' fontWeight='bold' fontSize='$5'>
                        Resetar
                    </Button.Text>
                </Button>
            </XStack>
        </YStack>
    );
};

export default EditLocationCoordScreen;
