import React from "react";
import { SymbolWeight } from "expo-symbols";
import {
  OpaqueColorValue,
  StyleProp,
  TextStyle,
  ViewStyle,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ICON_MAP, IconKey } from "@/constants/Icons";

export function IconSymbol({
  iconName,
  size = 24,
  color,
  style,
  onPress,
  onClick,
  onMouseOver,
  onMouseLeave,
  testID,
  accessibilityLabel,
}: {
  iconName: IconKey | string;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
  onPress?: any;
  onClick?: any;
  onMouseOver?: any;
  onMouseLeave?: any;
  testID?: any;
  accessibilityLabel?: any;
}) {
  // Map the common key to MaterialIcons name
  const androidIconName = (ICON_MAP[iconName as IconKey]?.android || iconName) as any;

  return (
    <MaterialIcons
      onPress={onPress}
      onClick={onClick}
      onMouseOver={onMouseOver}
      onMouseLeave={onMouseLeave}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      color={color}
      size={size}
      name={androidIconName}
      style={style as StyleProp<TextStyle>}
    />
  );
}
