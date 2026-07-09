import { createElement, useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";

const TOLEDO_CITY_CENTER = [10.3773, 123.6386];

const createMapHtml = ({ title, markerLabel }) => `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
    <style>
      html, body, #map {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
      }

      body {
        font-family: Arial, sans-serif;
        background: #edf3f0;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const map = L.map("map", { zoomControl: true }).setView([${TOLEDO_CITY_CENTER[0]}, ${TOLEDO_CITY_CENTER[1]}], 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);

      L.marker([${TOLEDO_CITY_CENTER[0]}, ${TOLEDO_CITY_CENTER[1]}])
        .addTo(map)
        .bindPopup("${markerLabel || title}");

      setTimeout(() => map.invalidateSize(), 250);
    </script>
  </body>
</html>
`;

export default function LeafletMap({ title = "Toledo City Map", markerLabel = "Toledo City, Cebu" }) {
  const html = useMemo(() => createMapHtml({ title, markerLabel }), [markerLabel, title]);

  if (Platform.OS === "web") {
    return (
      <View style={styles.frame}>
        {createElement("iframe", {
          title,
          srcDoc: html,
          style: styles.webFrame,
        })}
      </View>
    );
  }

  const { WebView } = require("react-native-webview");

  return (
    <View style={styles.frame}>
      <WebView originWhitelist={["*"]} source={{ html }} style={styles.nativeFrame} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    minHeight: 280,
    overflow: "hidden",
    backgroundColor: "#EDF3F0",
  },
  nativeFrame: {
    flex: 1,
    backgroundColor: "#EDF3F0",
  },
  webFrame: {
    width: "100%",
    height: "100%",
    minHeight: 280,
    borderWidth: 0,
    borderStyle: "none",
  },
});
