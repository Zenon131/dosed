import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function HomeLayout() {
  const isIOS = Platform.OS === 'ios';
  return (
    <Stack
      screenOptions={{
        headerShown: isIOS,
        headerTransparent: isIOS,
        headerBlurEffect: isIOS ? 'systemMaterial' : undefined,
        headerLargeTitleShadowVisible: false,
        headerShadowVisible: false,
        headerLargeStyle: { backgroundColor: 'transparent' },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Today',
          headerLargeTitle: isIOS,
          headerShown: isIOS,
        }}
      />
    </Stack>
  );
}
