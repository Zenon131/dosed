export const ICON_MAP = {
  home: {
    ios: "house.fill",
    android: "home",
  },
  medication: {
    ios: "pill.fill",
    android: "medication",
  },
  "bar-chart": {
    ios: "barchart.fill",
    android: "bar-chart",
  },
  user: {
    ios: "person.fill",
    android: "person",
  },
  settings: {
    ios: "gearshape.fill",
    android: "settings",
  },
} as const;

export type IconKey = keyof typeof ICON_MAP;
