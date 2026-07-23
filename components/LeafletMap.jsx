import { createElement, useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";

const TOLEDO_CITY_CENTER = [10.3773, 123.6386];

const escapeHtml = (value = "") =>
  `${value}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const createMapHtml = ({
  title,
  markerLabel,
  pickupLabel,
  destinationLabel,
  pickupCoordinates,
  destinationCoordinates,
}) => `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.3.0/css/all.min.css">
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
      const fallbackCenter = [${TOLEDO_CITY_CENTER[0]}, ${TOLEDO_CITY_CENTER[1]}];
      const pickupLabel = "${escapeHtml(pickupLabel || markerLabel || title)}";
      const destinationLabel = "${escapeHtml(destinationLabel || "")}";
      const directPickupCoordinates = ${JSON.stringify(pickupCoordinates ?? null)};
      const directDestinationCoordinates = ${JSON.stringify(destinationCoordinates ?? null)};
      const map = L.map("map", { zoomControl: true }).setView(fallbackCenter, 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);

      const layers = [];

      const addMarker = (coordinates, label, markerColor) => {
        if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
          return null;
        }

        const icon = L.divIcon({
          className: "custom-map-pin",
          html: '<div style="width: 18px; height: 18px; border-radius: 9px; background:' + markerColor + '; border: 3px solid white; box-shadow: 0 6px 18px rgba(0,0,0,0.24);"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

        const marker = L.marker(coordinates, { icon }).addTo(map).bindPopup(label);
        layers.push(marker);
        return marker;
      };

      const fetchCoordinates = async (label) => {
        if (!label) {
          return null;
        }

        try {
          const response = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(label));
          const result = await response.json();
          const match = result?.[0];

          if (!match?.lat || !match?.lon) {
            return null;
          }

          return [Number(match.lat), Number(match.lon)];
        } catch (error) {
          return null;
        }
      };

      const render = async () => {
        const pickupCoordinates = directPickupCoordinates || await fetchCoordinates(pickupLabel);
        const destinationCoordinates = directDestinationCoordinates || await fetchCoordinates(destinationLabel);

        if (pickupCoordinates) {
          addMarker(pickupCoordinates, pickupLabel + (directPickupCoordinates ? "" : " (approximate geocoded match)"), "#C62828");
        }

        if (destinationCoordinates) {
          addMarker(destinationCoordinates, destinationLabel + (directDestinationCoordinates ? "" : " (approximate geocoded match)"), "#06774B");
        }

        if (layers.length) {
          const bounds = L.featureGroup(layers).getBounds().pad(0.2);
          map.fitBounds(bounds, { maxZoom: layers.length === 1 ? 14 : 13 });
        } else {
          addMarker(fallbackCenter, "${escapeHtml(markerLabel || title)}", "#06774B");
          map.setView(fallbackCenter, 13);
        }

        setTimeout(() => map.invalidateSize(), 250);
      };

      render();
    </script>
  </body>
</html>
`;

export default function LeafletMap({
  title = "Toledo City Map",
  markerLabel = "Toledo City, Cebu",
  pickupLabel = "",
  destinationLabel = "",
  pickupCoordinates = null,
  destinationCoordinates = null,
}) {
  const html = useMemo(
    () =>
      createMapHtml({
        title,
        markerLabel,
        pickupLabel,
        destinationLabel,
        pickupCoordinates,
        destinationCoordinates,
      }),
    [destinationCoordinates, destinationLabel, markerLabel, pickupCoordinates, pickupLabel, title]
  );

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
