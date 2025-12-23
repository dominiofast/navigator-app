import React, { useState, useRef, useMemo, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Text, YStack, XStack, useTheme } from 'tamagui';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faBuilding, faTruck } from '@fortawesome/free-solid-svg-icons';
import { Driver, Place } from '@fleetbase/sdk';
import { useLocation } from '../contexts/LocationContext';
import { restoreFleetbasePlace, getCoordinates } from '../utils/location';
import { config, last, first } from '../utils';
import { formattedAddressFromPlace } from '../utils/location';
import Mapbox, { MapView, Camera, PointAnnotation, ShapeSource, LineLayer } from '@rnmapbox/maps';
import LocationMarker from './LocationMarker';
import DriverMarker from './DriverMarker';
import useFleetbase from '../hooks/use-fleetbase';
import Config from 'react-native-config';

// Initialize Mapbox
Mapbox.setAccessToken(Config.MAPBOX_ACCESS_TOKEN || '');

// Utility functions
const calculateZoomLevel = (zoom: number) => 14 - zoom;

const getPlaceCoords = (place: any) => {
    const [latitude, longitude] = getCoordinates(place);
    return { latitude, longitude };
};

// Fetch directions from Mapbox API
const fetchDirections = async (origin: any, destination: any, waypoints: any[] = []) => {
    const coordinates = [
        `${origin.longitude},${origin.latitude}`,
        ...waypoints.map(wp => `${wp.coordinate.longitude},${wp.coordinate.latitude}`),
        `${destination.longitude},${destination.latitude}`
    ].join(';');

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&access_token=${Config.MAPBOX_ACCESS_TOKEN}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
            return data.routes[0].geometry;
        }
    } catch (error) {
        console.error('Error fetching directions:', error);
    }
    return null;
};

// Reusable marker label component
const MarkerLabel = ({ label, theme, icon }: { label: string; theme: any; icon?: any }) => (
    <YStack mb={8} px='$2' py='$2' bg='$gray-900' borderRadius='$4' space='$1' shadowOpacity={0.25} shadowRadius={3} width={180}>
        <XStack space='$2'>
            <YStack justifyContent='center'>
                <FontAwesomeIcon icon={icon ?? faBuilding} color={theme['$gray-200']?.val || '#e5e7eb'} size={14} />
            </YStack>
            <YStack flex={1} space='$1'>
                <Text fontSize='$2' color='$gray-200' numberOfLines={1}>
                    {label}
                </Text>
            </YStack>
        </XStack>
    </YStack>
);

interface LiveOrderRouteProps {
    children?: React.ReactNode;
    order: any;
    zoom?: number;
    width?: string | number;
    height?: string | number;
    mapViewProps?: object;
    markerSize?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg';
    edgePaddingTop?: number;
    edgePaddingBottom?: number;
    edgePaddingLeft?: number;
    edgePaddingRight?: number;
    scrollEnabled?: boolean;
    focusCurrentDestination?: boolean;
}

const LiveOrderRoute: React.FC<LiveOrderRouteProps> = ({
    children,
    order,
    zoom = 1,
    width = '100%',
    height = '100%',
    mapViewProps,
    markerSize = 'sm',
    edgePaddingTop = 50,
    edgePaddingBottom = 50,
    edgePaddingLeft = 50,
    edgePaddingRight = 50,
    scrollEnabled = true,
    focusCurrentDestination = false,
    ...props
}) => {
    const theme = useTheme();
    const cameraRef = useRef<Camera>(null);
    const { getDriverLocationAsPlace } = useLocation();
    const { adapter } = useFleetbase();
    const [routeGeometry, setRouteGeometry] = useState<any>(null);

    // Retrieve attributes from the order
    const pickup = order.getAttribute('payload.pickup');
    const dropoff = order.getAttribute('payload.dropoff');
    const waypoints = order.getAttribute('payload.waypoints', []) ?? [];

    const currentDestination = useMemo(() => {
        const currentWaypoint = order.getAttribute('payload.current_waypoint');
        const locations = [pickup, ...waypoints, dropoff].filter(Boolean);
        const destination = locations.find((place: any) => place?.id === currentWaypoint) ?? locations[0];
        return new Place(destination);
    }, [pickup, dropoff, waypoints, order]);

    // Determine the start waypoint
    const startWaypoint = !pickup && waypoints.length > 0 ? waypoints[0] : pickup;
    let start = focusCurrentDestination ? getDriverLocationAsPlace() : restoreFleetbasePlace(startWaypoint, adapter);

    // Determine the end waypoint
    const endWaypoint = !dropoff && waypoints.length > 0 && last(waypoints) !== first(waypoints) ? last(waypoints) : dropoff;
    let end = focusCurrentDestination ? currentDestination : restoreFleetbasePlace(endWaypoint, adapter);

    // Get the coordinates for start and end places
    const origin = getPlaceCoords(start);
    const destination = getPlaceCoords(end);

    // Get only the "middle" waypoints
    const middleWaypoints = focusCurrentDestination ? [] : waypoints.slice(1, -1).map((waypoint: any) => ({ 
        coordinate: getPlaceCoords(waypoint), 
        ...waypoint 
    }));

    // Adjust marker size if many middle waypoints
    const finalMarkerSize = middleWaypoints.length > 0 ? (middleWaypoints.length > 3 ? 'xxs' : 'xs') : markerSize;

    const driverAssigned = order.getAttribute('driver_assigned') ? new Driver(order.getAttribute('driver_assigned')) : null;

    // Fetch route on mount or when coordinates change
    useEffect(() => {
        if (origin && destination && origin.latitude && destination.latitude) {
            fetchDirections(origin, destination, middleWaypoints).then(geometry => {
                if (geometry) {
                    setRouteGeometry(geometry);
                }
            });
        }
    }, [origin.latitude, origin.longitude, destination.latitude, destination.longitude]);

    // Fit camera to route bounds
    useEffect(() => {
        if (routeGeometry && cameraRef.current) {
            const coordinates = routeGeometry.coordinates;
            if (coordinates && coordinates.length > 0) {
                const lngs = coordinates.map((c: number[]) => c[0]);
                const lats = coordinates.map((c: number[]) => c[1]);
                const bounds = {
                    ne: [Math.max(...lngs), Math.max(...lats)],
                    sw: [Math.min(...lngs), Math.min(...lats)],
                };
                cameraRef.current.fitBounds(bounds.ne, bounds.sw, [edgePaddingTop, edgePaddingRight, edgePaddingBottom, edgePaddingLeft], 1000);
            }
        }
    }, [routeGeometry]);

    const routeGeoJSON = routeGeometry ? {
        type: 'Feature',
        properties: {},
        geometry: routeGeometry,
    } : null;

    return (
        <YStack flex={1} position='relative' overflow='hidden' width={width} height={height} {...props}>
            <MapView
                style={{ ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' }}
                styleURL={Mapbox.StyleURL.Street}
                scrollEnabled={scrollEnabled}
                {...mapViewProps}
            >
                <Camera
                    ref={cameraRef}
                    zoomLevel={calculateZoomLevel(zoom)}
                    centerCoordinate={[origin.longitude || 0, origin.latitude || 0]}
                />

                {/* Route line */}
                {routeGeoJSON && (
                    <ShapeSource id="routeSource" shape={routeGeoJSON as any}>
                        <LineLayer
                            id="routeLine"
                            style={{
                                lineColor: theme['$blue-500']?.val || '#3b82f6',
                                lineWidth: 4,
                                lineCap: 'round',
                                lineJoin: 'round',
                            }}
                        />
                    </ShapeSource>
                )}

                {/* Driver marker */}
                {driverAssigned && <DriverMarker driver={driverAssigned} />}

                {/* Start marker */}
                {start && start?.id !== 'driver' && origin.latitude && (
                    <PointAnnotation
                        id="start-marker"
                        coordinate={[origin.longitude, origin.latitude]}
                    >
                        <YStack>
                            <MarkerLabel 
                                icon={start?.id === 'driver' ? faTruck : undefined} 
                                label={formattedAddressFromPlace(start)} 
                                theme={theme} 
                            />
                            <LocationMarker size={finalMarkerSize} />
                        </YStack>
                    </PointAnnotation>
                )}

                {/* Middle waypoints */}
                {middleWaypoints.map((waypoint: any, idx: number) => (
                    <PointAnnotation
                        key={waypoint.id || `waypoint-${idx}`}
                        id={`waypoint-${waypoint.id || idx}`}
                        coordinate={[waypoint.coordinate.longitude, waypoint.coordinate.latitude]}
                    >
                        <YStack>
                            <MarkerLabel label={waypoint.address} theme={theme} />
                            <LocationMarker size={finalMarkerSize} />
                        </YStack>
                    </PointAnnotation>
                ))}

                {/* Destination marker */}
                {destination.latitude && (
                    <PointAnnotation
                        id="destination-marker"
                        coordinate={[destination.longitude, destination.latitude]}
                    >
                        <YStack>
                            <MarkerLabel label={formattedAddressFromPlace(end)} theme={theme} />
                            <LocationMarker size={finalMarkerSize} />
                        </YStack>
                    </PointAnnotation>
                )}
            </MapView>

            <YStack position='absolute' style={{ ...StyleSheet.absoluteFillObject }}>
                {children}
            </YStack>
        </YStack>
    );
};

export default LiveOrderRoute;
