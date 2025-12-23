import React, { useState, useEffect, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Mapbox, { MapView, Camera, PointAnnotation } from '@rnmapbox/maps';
import { YStack } from 'tamagui';
import { restoreFleetbasePlace, getCoordinates } from '../utils/location';
import LocationMarker from './LocationMarker';
import useFleetbase from '../hooks/use-fleetbase';
import Config from 'react-native-config';

// Initialize Mapbox
Mapbox.setAccessToken(Config.MAPBOX_ACCESS_TOKEN || '');

// Utility to calculate zoom from deltas
const calculateZoomLevel = (zoom: number) => {
    // Convert zoom multiplier to Mapbox zoom level (0-22)
    return 15 - zoom;
};

interface PlaceMapViewProps {
    place: any;
    width?: string | number;
    height?: number;
    markerSize?: 'sm' | 'md' | 'lg';
    zoom?: number;
    onPress?: () => void;
    mapViewProps?: object;
}

const PlaceMapView: React.FC<PlaceMapViewProps> = ({ 
    place: _place, 
    width = '100%', 
    height = 200, 
    markerSize = 'md', 
    zoom = 1, 
    onPress, 
    mapViewProps = {}, 
    ...props 
}) => {
    const { adapter } = useFleetbase();
    const place = restoreFleetbasePlace(_place, adapter);
    const [latitude, longitude] = getCoordinates(place);
    const cameraRef = useRef<Camera>(null);
    const zoomLevel = calculateZoomLevel(zoom);

    useEffect(() => {
        if (cameraRef.current) {
            cameraRef.current.setCamera({
                centerCoordinate: [longitude, latitude],
                zoomLevel: 16,
                animationDuration: 500,
            });
        }
    }, [latitude, longitude]);

    return (
        <Pressable onPress={onPress} style={{ flex: 1, width, height }}>
            <YStack position='relative' overflow='hidden' borderRadius='$4' width={width} height={height} {...props}>
                <MapView
                    style={{ ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' }}
                    styleURL={Mapbox.StyleURL.Street}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    pitchEnabled={false}
                    rotateEnabled={false}
                    {...mapViewProps}
                >
                    <Camera
                        ref={cameraRef}
                        zoomLevel={zoomLevel}
                        centerCoordinate={[longitude, latitude]}
                    />
                    <PointAnnotation
                        id="place-marker"
                        coordinate={[longitude, latitude]}
                    >
                        <LocationMarker size={markerSize} />
                    </PointAnnotation>
                </MapView>
            </YStack>
        </Pressable>
    );
};

export default PlaceMapView;
