import React from 'react';
import {View, StyleSheet, ViewStyle, StyleProp} from 'react-native';
import {COLORS, SIZES, SHADOWS} from '../styles/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const Card: React.FC<CardProps> = ({children, style}) => {
  return <View style={[styles.card, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    padding: SIZES.large,
    ...SHADOWS.small,
  },
});

export default Card;
