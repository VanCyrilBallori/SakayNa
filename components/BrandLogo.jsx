import { Image } from "react-native";

const SOURCES = {
  main: require("../Photos_/Logo (main).png"),
  secondary: require("../Photos_/Logo (Secondary).png"),
};

const ASPECT_RATIOS = {
  main: 871 / 286,
  secondary: 324 / 354,
};

export default function BrandLogo({ variant = "main", width, height, style, ...props }) {
  const ratio = ASPECT_RATIOS[variant] ?? ASPECT_RATIOS.main;
  const source = SOURCES[variant] ?? SOURCES.main;

  let resolvedWidth = width;
  let resolvedHeight = height;

  if (resolvedWidth && !resolvedHeight) {
    resolvedHeight = resolvedWidth / ratio;
  } else if (resolvedHeight && !resolvedWidth) {
    resolvedWidth = resolvedHeight * ratio;
  } else if (!resolvedWidth && !resolvedHeight) {
    resolvedWidth = variant === "secondary" ? 48 : 160;
    resolvedHeight = resolvedWidth / ratio;
  }

  return <Image source={source} style={[{ width: resolvedWidth, height: resolvedHeight }, style]} resizeMode="contain" {...props} />;
}
