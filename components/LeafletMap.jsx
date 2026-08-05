import { createElement, useCallback, useEffect, useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";

const TOLEDO_CITY_CENTER = [10.3773, 123.6386];

const escapeHtml = (value = "") => `${value}`.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");

const createMapHtml = ({ title, markerLabel, pickupLabel, destinationLabel, pickupCoordinates, destinationCoordinates, selectable }) => `
<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#map{width:100%;height:100%;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#edf3f0}.map-hint{position:absolute;z-index:999;left:10px;bottom:10px;background:#fff;padding:8px 10px;border-radius:6px;font-size:12px;box-shadow:0 2px 12px rgba(0,0,0,.15)}</style></head><body><div id="map"></div>${selectable ? '<div class="map-hint">Tap to place the pickup pin</div>' : ''}<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
const fallbackCenter=[${TOLEDO_CITY_CENTER[0]},${TOLEDO_CITY_CENTER[1]}]; const selectable=${Boolean(selectable)}; const pickupLabel="${escapeHtml(pickupLabel || markerLabel || title)}"; const destinationLabel="${escapeHtml(destinationLabel || "")}"; const directPickupCoordinates=${JSON.stringify(pickupCoordinates ?? null)}; const directDestinationCoordinates=${JSON.stringify(destinationCoordinates ?? null)}; const map=L.map('map',{zoomControl:true}).setView(fallbackCenter,13); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map); const layers=[]; let selectedMarker=null;
const addMarker=(coordinates,label,color,draggable=false)=>{if(!coordinates||!Array.isArray(coordinates)||coordinates.length!==2)return null;const icon=L.divIcon({className:'custom-map-pin',html:'<div style="width:18px;height:18px;border-radius:9px;background:'+color+';border:3px solid white;box-shadow:0 6px 18px rgba(0,0,0,.24);"></div>',iconSize:[18,18],iconAnchor:[9,9]});const marker=L.marker(coordinates,{icon,draggable}).addTo(map).bindPopup(label);layers.push(marker);return marker;};
const sendSelection=(lat,lng)=>{const payload={type:'locationSelected',latitude:lat,longitude:lng};if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify(payload));}else if(window.parent){window.parent.postMessage(payload,'*');}};
const placeSelected=(lat,lng)=>{if(selectedMarker)map.removeLayer(selectedMarker);selectedMarker=addMarker([lat,lng],'Selected pickup','#C62828',true);selectedMarker.on('dragend',(event)=>{const point=event.target.getLatLng();sendSelection(point.lat,point.lng);});sendSelection(lat,lng);};
const fetchCoordinates=async(label)=>{if(!label)return null;try{const response=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+encodeURIComponent(label));const result=await response.json();const match=result?.[0];return match?.lat&&match?.lon?[Number(match.lat),Number(match.lon)]:null;}catch(error){return null;}};
const render=async()=>{const pickupCoordinates=directPickupCoordinates||await fetchCoordinates(pickupLabel);const destinationCoordinates=directDestinationCoordinates||await fetchCoordinates(destinationLabel);if(pickupCoordinates){selectedMarker=addMarker(pickupCoordinates,pickupLabel+(directPickupCoordinates?'':' (approximate geocoded match)'),'#C62828',selectable);if(selectable)selectedMarker.on('dragend',(event)=>{const point=event.target.getLatLng();sendSelection(point.lat,point.lng);});}if(destinationCoordinates)addMarker(destinationCoordinates,destinationLabel+(directDestinationCoordinates?'':' (approximate geocoded match)'),'#06774B');if(layers.length){const bounds=L.featureGroup(layers).getBounds().pad(.2);map.fitBounds(bounds,{maxZoom:layers.length===1?14:13});}else{map.setView(fallbackCenter,13);}if(selectable)map.on('click',(event)=>placeSelected(event.latlng.lat,event.latlng.lng));setTimeout(()=>map.invalidateSize(),250);};render();
</script></body></html>`;

export default function LeafletMap({ title = "Toledo City Map", markerLabel = "Toledo City, Cebu", pickupLabel = "", destinationLabel = "", pickupCoordinates = null, destinationCoordinates = null, selectable = false, onLocationSelect }) {
  const html = useMemo(() => createMapHtml({ title, markerLabel, pickupLabel, destinationLabel, pickupCoordinates, destinationCoordinates, selectable }), [destinationCoordinates, destinationLabel, markerLabel, pickupCoordinates, pickupLabel, selectable, title]);
  const receiveLocation = useCallback((event) => {
    try {
      const payload = typeof event?.nativeEvent?.data === "string" ? JSON.parse(event.nativeEvent.data) : event?.data;
      if (payload?.type === "locationSelected" && Number.isFinite(payload.latitude) && Number.isFinite(payload.longitude)) onLocationSelect?.(payload);
    } catch { /* Invalid iframe or WebView messages are ignored. */ }
  }, [onLocationSelect]);

  useEffect(() => {
    if (Platform.OS !== "web" || !selectable) return undefined;
    const handler = (event) => receiveLocation(event);
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [receiveLocation, selectable]);

  if (Platform.OS === "web") return <View style={styles.frame}>{createElement("iframe", { title, srcDoc: html, style: styles.webFrame })}</View>;
  const { WebView } = require("react-native-webview");
  return <View style={styles.frame}><WebView originWhitelist={["*"]} source={{ html }} style={styles.nativeFrame} onMessage={receiveLocation} /></View>;
}

const styles = StyleSheet.create({ frame: { flex: 1, minHeight: 280, overflow: "hidden", backgroundColor: "#EDF3F0" }, nativeFrame: { flex: 1, backgroundColor: "#EDF3F0" }, webFrame: { width: "100%", height: "100%", minHeight: 280, borderWidth: 0, borderStyle: "none" } });
