import { createElement, useCallback, useEffect, useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";

// The Poblacion, Toledo City (checked on OpenStreetMap: its Poblacion point is 10.3755, 123.6381, about 200 m away).
// Every map opens here when it has no pin.
const TOLEDO_CITY_CENTER = [10.3773, 123.6386];
// Zoom 15 = a few streets around the Poblacion. Zoom 16 = close enough to see one street and its houses.
const CITY_ZOOM = 15;
const PIN_ZOOM = 16;
// Zoom 15 for a pickup found by looking up its address text (not an exact pin), so the dispatcher sees it's only near there.
const APPROXIMATE_PIN_ZOOM = 15;
// Address searches only look inside this box around Toledo City (west, north, east, south),
// taken from OpenStreetMap's Toledo City entry. Without it, "Bato" was found in Leyte and "Purok 3, Ilihan" in Davao.
const TOLEDO_SEARCH_BOX = "123.4744,10.5349,123.7944,10.2149";

// Map pins (Task 3.3): flat teardrop pins drawn as SVG, each with its own mark so they differ by shape, not only color.
//   pickup = Hall Green with a white dot, destination = Sakay Orange with a dark flag, driver = Ink (bigger) with a white van.
// The tip is at the bottom center of the picture, so iconAnchor [width / 2, height] puts the tip exactly on the spot.
// popupAnchor opens the label just above the pin's head.
const escapeHtml = (value = "") => `${value}`.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");

const createMapHtml = ({ title, markerLabel, pickupLabel, destinationLabel, pickupCoordinates, destinationCoordinates, centerCoordinates, driverCoordinates, driverLabel, selectable, showPins, zoomPosition, bottomSpace, focusPickup }) => `
<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#map{width:100%;height:100%;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#edf3f0}.map-hint{position:absolute;z-index:999;left:10px;bottom:10px;background:#fff;padding:8px 10px;border-radius:6px;font-size:12px;box-shadow:0 2px 12px rgba(0,0,0,.15)}.leaflet-bottom{bottom:${Number(bottomSpace) || 0}px}.leaflet-container .leaflet-control-attribution{font-size:10px;background:rgba(255,255,255,.55);padding:0 4px}.custom-map-pin{background:none;border:none}</style></head><body><div id="map"></div>${selectable ? '<div class="map-hint">Tap to place the pickup pin</div>' : ''}<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
const fallbackCenter=[${TOLEDO_CITY_CENTER[0]},${TOLEDO_CITY_CENTER[1]}]; const selectable=${Boolean(selectable)}; const pickupLabel="${escapeHtml(pickupLabel || markerLabel || title)}"; const destinationLabel="${escapeHtml(destinationLabel || "")}"; const directPickupCoordinates=${JSON.stringify(pickupCoordinates ?? null)}; const directDestinationCoordinates=${JSON.stringify(destinationCoordinates ?? null)}; const startCenter=${JSON.stringify(centerCoordinates ?? null)}; const directDriverCoordinates=${JSON.stringify(driverCoordinates ?? null)}; const driverLabel="${escapeHtml(driverLabel || "Driver")}"; const showStart=()=>map.setView(startCenter||fallbackCenter,startCenter?${PIN_ZOOM}:${CITY_ZOOM}); const map=L.map('map',{zoomControl:false}); showStart(); map.attributionControl.setPrefix(false); L.control.zoom({position:'${zoomPosition === "bottomright" ? "bottomright" : "topleft"}'}).addTo(map); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map); const layers=[]; let selectedMarker=null;
const pinKinds={pickup:{fill:'#0B7A4B',height:44,mark:'<circle cx="12" cy="12" r="4.5" fill="#FFFFFF"/>'},destination:{fill:'#FF8A00',height:44,mark:'<rect x="7.75" y="6" width="1.8" height="12" rx="0.9" fill="#14211C"/><path d="M9.55 6.5L16.25 9.2L9.55 11.9Z" fill="#14211C"/>'},driver:{fill:'#14211C',height:56,mark:'<path d="M5.5 8.3a1 1 0 0 1 1-1h7.6l3.4 3.3c.2.2.3.4.3.7v2.2a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1z" fill="#FFFFFF"/><rect x="7.2" y="8.6" width="5.6" height="2.5" rx="0.5" fill="#14211C"/><path d="M14.6 8.6V11.1H16.9Z" fill="#14211C"/><circle cx="8.6" cy="15" r="1.7" fill="#FFFFFF" stroke="#14211C" stroke-width="0.9"/><circle cx="15" cy="15" r="1.7" fill="#FFFFFF" stroke="#14211C" stroke-width="0.9"/>'}};
const addMarker=(coordinates,label,kind,draggable=false)=>{if(!coordinates||!Array.isArray(coordinates)||coordinates.length!==2)return null;const pin=pinKinds[kind];const height=pin.height;const width=Math.round(height*27/37.5);const icon=L.divIcon({className:'custom-map-pin',html:'<svg width="'+width+'" height="'+height+'" viewBox="-1.5 -1.5 27 37.5" preserveAspectRatio="xMidYMax meet" style="display:block"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="'+pin.fill+'" stroke="#FFFFFF" stroke-width="1.5" stroke-linejoin="round"/>'+pin.mark+'</svg>',iconSize:[width,height],iconAnchor:[width/2,height],popupAnchor:[0,7-height]});const marker=L.marker(coordinates,{icon,draggable}).addTo(map).bindPopup(label);layers.push(marker);return marker;};
const sendSelection=(lat,lng)=>{const payload={type:'locationSelected',latitude:lat,longitude:lng};if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify(payload));}else if(window.parent){window.parent.postMessage(payload,'*');}};
const placeSelected=(lat,lng)=>{if(selectedMarker)map.removeLayer(selectedMarker);selectedMarker=addMarker([lat,lng],'Selected pickup','pickup',true);selectedMarker.on('dragend',(event)=>{const point=event.target.getLatLng();sendSelection(point.lat,point.lng);});sendSelection(lat,lng);};
const fetchCoordinates=async(label)=>{if(!label)return null;try{const response=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ph&viewbox=${TOLEDO_SEARCH_BOX}&bounded=1&q='+encodeURIComponent(label));const result=await response.json();const match=result?.[0];return match?.lat&&match?.lon?[Number(match.lat),Number(match.lon)]:null;}catch(error){return null;}};
const render=async()=>{if(!${Boolean(showPins)}){showStart();setTimeout(()=>map.invalidateSize(),250);return;}let driverMarker=null;if(directDriverCoordinates){driverMarker=addMarker(directDriverCoordinates,driverLabel,'driver');driverMarker.setZIndexOffset(1000);map.setView(directDriverCoordinates,${PIN_ZOOM});driverMarker.openPopup();}const pickupCoordinates=directPickupCoordinates||(selectable?null:await fetchCoordinates(pickupLabel));const destinationCoordinates=directDestinationCoordinates||await fetchCoordinates(destinationLabel);if(pickupCoordinates){selectedMarker=addMarker(pickupCoordinates,pickupLabel+(directPickupCoordinates?'':' (approximate geocoded match)'),'pickup',selectable);if(selectable)selectedMarker.on('dragend',(event)=>{const point=event.target.getLatLng();sendSelection(point.lat,point.lng);});}if(destinationCoordinates)addMarker(destinationCoordinates,destinationLabel+(directDestinationCoordinates?'':' (approximate geocoded match)'),'destination');if(driverMarker){/* Stay zoomed on the driver. */}else if(${Boolean(focusPickup)}&&pickupCoordinates){map.setView(pickupCoordinates,directPickupCoordinates?${PIN_ZOOM}:${APPROXIMATE_PIN_ZOOM});if(!directPickupCoordinates)selectedMarker.openPopup();}else if(layers.length){const bounds=L.featureGroup(layers).getBounds().pad(.2);map.fitBounds(bounds,{maxZoom:layers.length===1?${PIN_ZOOM}:13});}else{showStart();}if(selectable)map.on('click',(event)=>placeSelected(event.latlng.lat,event.latlng.lng));setTimeout(()=>map.invalidateSize(),250);};render();
</script></body></html>`;

// Optional settings (the defaults keep every other map as it was):
// showPins = false: just the Toledo City map, no pins (the resident home screen).
// zoomPosition = "bottomright": the + / - buttons go to the bottom right corner instead of the top left.
// bottomSpace = moves the zoom buttons and the OpenStreetMap credit up by this many points,
//   so something drawn over the bottom of the map (like the home screen's sheet) doesn't hide them.
// The credit only shows "© OpenStreetMap contributors" (required by the OpenStreetMap license):
// setPrefix(false) hides Leaflet's own "Leaflet" name and flag, and the style rule makes the box small and see-through.
// minHeight = the map is never shorter than this (280 by default). The home screen passes 0, so on a small phone
//   the map is exactly the visible space and its credit and zoom buttons never end up under the sheet.
// centerCoordinates = [lat, lng] to start at when there is no pin (the pin picker passes the resident's location).
//   No pin is drawn there. Without it, a map with no pin starts at the Poblacion (TOLEDO_CITY_CENTER).
// When there is no exact pin, the map looks up the address text, but only inside Toledo City (TOLEDO_SEARCH_BOX).
// The pin picker (selectable) never looks up text: it only shows a pin the resident placed.
// driverCoordinates = [lat, lng] of a driver's last known location (the dispatcher's "Show on map", driver-location-plan.md).
//   Draws the bigger dark driver pin with driverLabel open above it, and the map zooms to it instead of the request pins.
// focusPickup = true: center on the pickup instead of fitting every pin (the dispatcher's map, Task 3.5).
//   Exact pin = zoom 16. Address lookup = zoom 15 with its "(approximate geocoded match)" label open, so it isn't mistaken for exact.
export default function LeafletMap({ title = "Toledo City Map", markerLabel = "Toledo City, Cebu", pickupLabel = "", destinationLabel = "", pickupCoordinates = null, destinationCoordinates = null, centerCoordinates = null, driverCoordinates = null, driverLabel = "", selectable = false, onLocationSelect, showPins = true, zoomPosition = "topleft", bottomSpace = 0, minHeight = 280, focusPickup = false }) {
  const html = useMemo(() => createMapHtml({ title, markerLabel, pickupLabel, destinationLabel, pickupCoordinates, destinationCoordinates, centerCoordinates, driverCoordinates, driverLabel, selectable, showPins, zoomPosition, bottomSpace, focusPickup }), [bottomSpace, centerCoordinates, destinationCoordinates, destinationLabel, driverCoordinates, driverLabel, focusPickup, markerLabel, pickupCoordinates, pickupLabel, selectable, showPins, title, zoomPosition]);
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

  if (Platform.OS === "web") return <View style={[styles.frame, { minHeight }]}>{createElement("iframe", { title, srcDoc: html, style: { ...styles.webFrame, minHeight } })}</View>;
  const { WebView } = require("react-native-webview");
  return <View style={[styles.frame, { minHeight }]}><WebView originWhitelist={["*"]} source={{ html }} style={styles.nativeFrame} onMessage={receiveLocation} /></View>;
}

const styles = StyleSheet.create({ frame: { flex: 1, overflow: "hidden", backgroundColor: "#EDF3F0" }, nativeFrame: { flex: 1, backgroundColor: "#EDF3F0" }, webFrame: { width: "100%", height: "100%", borderWidth: 0, borderStyle: "none" } });
