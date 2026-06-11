import { useColorScheme } from 'react-native';

export const LIGHT = {
  background: '#F7F5FF',
  surface: '#FFFFFF',
  surfaceSecondary: '#F0EDF9',
  text: '#1A1028',
  textSecondary: '#6B5F82',
  textTertiary: '#A89DC0',
  primary: '#7C4DFF',
  primaryMuted: 'rgba(124,77,255,0.10)',
  accent: '#00C896',
  warning: '#FFB300',
  danger: '#FF4757',
  border: 'rgba(124,77,255,0.10)',
  divider: 'rgba(124,77,255,0.06)',
  card: '#FFFFFF',
};

export const DARK = {
  background: '#110D1E',
  surface: '#1E1830',
  surfaceSecondary: '#2A2240',
  text: '#F0ECFF',
  textSecondary: '#9B8FBB',
  textTertiary: '#5E5478',
  primary: '#9D6FFF',
  primaryMuted: 'rgba(157,111,255,0.15)',
  accent: '#00E5A8',
  warning: '#FFB300',
  danger: '#FF6B7A',
  border: 'rgba(157,111,255,0.12)',
  divider: 'rgba(157,111,255,0.07)',
  card: '#1E1830',
};

export type ColorScheme = typeof LIGHT;

export function useColors(): ColorScheme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? DARK : LIGHT;
}
