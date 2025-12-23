import React, { forwardRef, useRef, useImperativeHandle, useState, useEffect } from 'react';
import { Animated, Easing } from 'react-native';
import { Spinner, YStack } from 'tamagui';
import FastImage from 'react-native-fast-image';
import { MarkerView } from '@rnmapbox/maps';
import { isObject } from '../utils';
import { SvgCssUri } from 'react-native-svg/css';

interface TrackingMarkerProps {
    coordinate: { latitude: number; longitude: number };
    imageSource: any;
    size?: { width: number; height: number };
    moveDuration?: number;
    initialRotation?: number;
    baseRotation?: number;
    rotationDuration?: number;
    onPress?: () => void;
    children?: React.ReactNode;
}

const TrackingMarker = forwardRef<any, TrackingMarkerProps>(
    ({ coordinate, imageSource, size = { width: 50, height: 50 }, moveDuration = 1000, initialRotation = 0, baseRotation = 0, rotationDuration = 500, onPress, children }, ref) => {
        const [svgLoading, setSvgLoading] = useState(true);
        
        // Current position state for smooth updates
        const [currentCoordinate, setCurrentCoordinate] = useState({
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
        });

        // Animated value for rotation
        const rotation = useRef(new Animated.Value(initialRotation)).current;
        const [rotationDeg, setRotationDeg] = useState(initialRotation);

        // Listen to rotation changes
        useEffect(() => {
            const listener = rotation.addListener(({ value }) => {
                setRotationDeg(value);
            });
            return () => rotation.removeListener(listener);
        }, [rotation]);

        // Update coordinate when prop changes
        useEffect(() => {
            setCurrentCoordinate({
                latitude: coordinate.latitude,
                longitude: coordinate.longitude,
            });
        }, [coordinate.latitude, coordinate.longitude]);

        // Function to smoothly move the marker
        const move = (newLatitude: number, newLongitude: number, duration = moveDuration) => {
            // For Mapbox, we update the coordinate directly
            // Animation is handled by the map's built-in interpolation
            setCurrentCoordinate({
                latitude: newLatitude,
                longitude: newLongitude,
            });
        };

        // Function to rotate the marker
        const rotate = (newHeading: number, duration = rotationDuration) => {
            const currentRotation = rotation._value || 0;
            let delta = newHeading - currentRotation;
            if (Math.abs(delta) > 180) {
                delta = delta - 360 * Math.sign(delta);
            }
            const finalRotation = (currentRotation + delta) % 360;

            Animated.timing(rotation, {
                toValue: finalRotation,
                duration,
                easing: Easing.linear,
                useNativeDriver: false,
            }).start();
        };

        // Expose move and rotate via ref
        useImperativeHandle(ref, () => ({
            move,
            rotate,
        }));

        // Determine if the image source is an SVG
        const isRemoteSvg = isObject(imageSource) && typeof imageSource.uri === 'string' && imageSource.uri.toLowerCase().endsWith('.svg');

        const onSvgLoadingError = () => {
            setSvgLoading(false);
        };

        const onSvgLoaded = () => {
            setSvgLoading(false);
        };

        return (
            <MarkerView
                coordinate={[currentCoordinate.longitude, currentCoordinate.latitude]}
                allowOverlap={true}
            >
                <Animated.View
                    style={{
                        transform: [
                            { rotate: `${baseRotation}deg` },
                            { rotate: `${rotationDeg}deg` },
                        ],
                    }}
                >
                    {isRemoteSvg ? (
                        <YStack
                            style={{
                                position: 'relative',
                                width: size.width,
                                height: size.height,
                            }}
                        >
                            <SvgCssUri uri={imageSource.uri} width={size.width} height={size.height} onError={onSvgLoadingError} onLoad={onSvgLoaded} />
                            {svgLoading && (
                                <YStack
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                    }}
                                >
                                    <Spinner color='$textPrimary' size={size.width} />
                                </YStack>
                            )}
                        </YStack>
                    ) : (
                        <FastImage source={imageSource} style={{ width: size.width, height: size.height }} resizeMode={FastImage.resizeMode.contain} />
                    )}
                </Animated.View>
                {children && <YStack>{children}</YStack>}
            </MarkerView>
        );
    }
);

export default TrackingMarker;
