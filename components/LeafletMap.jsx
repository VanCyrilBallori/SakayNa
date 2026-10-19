import { createElement, useCallback, useEffect, useMemo, useRef } from "react";
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
<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#map{width:100%;height:100%;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#edf3f0}.map-hint{position:absolute;z-index:999;left:10px;bottom:10px;background:#fff;padding:8px 10px;border-radius:6px;font-size:12px;box-shadow:0 2px 12px rgba(0,0,0,.15)}.leaflet-bottom{bottom:${Number(bottomSpace) || 0}px}.leaflet-container .leaflet-control-attribution{font-size:10px;background:rgba(255,255,255,.55);padding:0 4px}.custom-map-pin{background:none;border:none}.leaflet-tooltip.destination-tag{padding:2px 8px;font-size:14px;font-weight:700;color:#14211C;border:1px solid #FF8A00}.leaflet-tooltip.driver-tag{padding:2px 8px;font-size:14px;font-weight:700;color:#14211C;border:1px solid #14211C}.leaflet-tooltip.driver-tag-old{font-weight:400;color:#4A5C55;background:#E4E9E7;border:1px dashed #4A5C55}.leaflet-tooltip.line-end-tag{padding:2px 8px;font-size:14px;font-weight:700;color:#14211C}.leaflet-tooltip.line-end-tag-pickup{border:1px solid #0B7A4B}.leaflet-tooltip.line-end-tag-destination{border:1px solid #FF8A00}.leaflet-tooltip.line-end-tag-old{font-weight:400;color:#4A5C55;background:#E4E9E7;border:1px dashed #4A5C55}</style></head><body><div id="map"></div>${selectable ? '<div class="map-hint">Tap to place the pickup pin</div>' : ''}<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
const fallbackCenter=[${TOLEDO_CITY_CENTER[0]},${TOLEDO_CITY_CENTER[1]}]; const selectable=${Boolean(selectable)}; const focusPickup=${Boolean(focusPickup)}; const pickupLabel="${escapeHtml(pickupLabel || markerLabel || title)}"; const destinationLabel="${escapeHtml(destinationLabel || "")}"; const directPickupCoordinates=${JSON.stringify(pickupCoordinates ?? null)}; const directDestinationCoordinates=${JSON.stringify(destinationCoordinates ?? null)}; const startCenter=${JSON.stringify(centerCoordinates ?? null)}; const directDriverCoordinates=${JSON.stringify(driverCoordinates ?? null)}; const driverLabel="${escapeHtml(driverLabel || "Driver")}"; const showStart=()=>map.setView(startCenter||fallbackCenter,startCenter?${PIN_ZOOM}:${CITY_ZOOM}); const map=L.map('map',{zoomControl:false}); showStart(); map.attributionControl.setPrefix(false); L.control.zoom({position:'${zoomPosition === "bottomright" ? "bottomright" : "topleft"}'}).addTo(map); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map); const layers=[]; let selectedMarker=null;
const pinKinds={pickup:{fill:'#0B7A4B',height:44,mark:'<circle cx="12" cy="12" r="4.5" fill="#FFFFFF"/>'},destination:{fill:'#FF8A00',height:44,mark:'<rect x="7.75" y="6" width="1.8" height="12" rx="0.9" fill="#14211C"/><path d="M9.55 6.5L16.25 9.2L9.55 11.9Z" fill="#14211C"/>'},driver:{fill:'#14211C',height:56,mark:'<path d="M5.5 8.3a1 1 0 0 1 1-1h7.6l3.4 3.3c.2.2.3.4.3.7v2.2a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1z" fill="#FFFFFF"/><rect x="7.2" y="8.6" width="5.6" height="2.5" rx="0.5" fill="#14211C"/><path d="M14.6 8.6V11.1H16.9Z" fill="#14211C"/><circle cx="8.6" cy="15" r="1.7" fill="#FFFFFF" stroke="#14211C" stroke-width="0.9"/><circle cx="15" cy="15" r="1.7" fill="#FFFFFF" stroke="#14211C" stroke-width="0.9"/>'}}; pinKinds.oldDriver={...pinKinds.driver,fill:'#8A9590'};
const pinIcon=(kind)=>{const pin=pinKinds[kind];const height=pin.height;const width=Math.round(height*27/37.5);return L.divIcon({className:'custom-map-pin',html:'<svg width="'+width+'" height="'+height+'" viewBox="-1.5 -1.5 27 37.5" preserveAspectRatio="xMidYMax meet" style="display:block"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="'+pin.fill+'" stroke="#FFFFFF" stroke-width="1.5" stroke-linejoin="round"/>'+pin.mark+'</svg>',iconSize:[width,height],iconAnchor:[width/2,height],popupAnchor:[0,7-height]});};
const addMarker=(coordinates,label,kind,draggable=false)=>{if(!coordinates||!Array.isArray(coordinates)||coordinates.length!==2)return null;const marker=L.marker(coordinates,{icon:pinIcon(kind),draggable}).addTo(map).bindPopup(label);layers.push(marker);return marker;};
const sendSelection=(lat,lng)=>{const payload={type:'locationSelected',latitude:lat,longitude:lng};if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify(payload));}else if(window.parent){window.parent.postMessage(payload,'*');}};
const placeSelected=(lat,lng)=>{if(selectedMarker)map.removeLayer(selectedMarker);selectedMarker=addMarker([lat,lng],'Selected pickup','pickup',true);selectedMarker.on('dragend',(event)=>{const point=event.target.getLatLng();sendSelection(point.lat,point.lng);});sendSelection(lat,lng);};
const fetchCoordinates=async(label)=>{if(!label)return null;try{const response=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ph&viewbox=${TOLEDO_SEARCH_BOX}&bounded=1&q='+encodeURIComponent(label));const result=await response.json();const match=result?.[0];return match?.lat&&match?.lon?[Number(match.lat),Number(match.lon)]:null;}catch(error){return null;}};
const render=async()=>{if(!${Boolean(showPins)}){showStart();setTimeout(()=>map.invalidateSize(),250);return;}let driverMarker=null;if(directDriverCoordinates){driverMarker=addMarker(directDriverCoordinates,driverLabel,'driver');driverMarker.setZIndexOffset(1000);map.setView(directDriverCoordinates,${PIN_ZOOM});driverMarker.openPopup();}const pickupCoordinates=directPickupCoordinates||(selectable?null:await fetchCoordinates(pickupLabel));const destinationCoordinates=directDestinationCoordinates||await fetchCoordinates(destinationLabel);if(pickupCoordinates){selectedMarker=addMarker(pickupCoordinates,pickupLabel+(directPickupCoordinates?'':' (approximate geocoded match)'),'pickup',selectable);if(selectable)selectedMarker.on('dragend',(event)=>{const point=event.target.getLatLng();sendSelection(point.lat,point.lng);});}let destinationMarker=null;if(destinationCoordinates){destinationMarker=addMarker(destinationCoordinates,(focusPickup?'Destination: ':'')+destinationLabel+(directDestinationCoordinates?'':' (approximate geocoded match)'),'destination');if(focusPickup)destinationMarker.bindTooltip('Destination',{permanent:true,direction:'right',offset:[16,-28],className:'destination-tag'});}if(driverMarker){/* Stay zoomed on the driver. */}else if(focusPickup&&pickupCoordinates&&destinationMarker){map.fitBounds(L.latLngBounds([pickupCoordinates,destinationCoordinates]),{paddingTopLeft:[50,80],paddingBottomRight:[120,30],maxZoom:${PIN_ZOOM}});if(!directPickupCoordinates)selectedMarker.openPopup();}else if(focusPickup&&pickupCoordinates){map.setView(pickupCoordinates,directPickupCoordinates?${PIN_ZOOM}:${APPROXIMATE_PIN_ZOOM});if(!directPickupCoordinates)selectedMarker.openPopup();}else if(layers.length){const bounds=L.featureGroup(layers).getBounds().pad(.2);map.fitBounds(bounds,{maxZoom:layers.length===1?${PIN_ZOOM}:13});}else{showStart();}if(selectable)map.on('click',(event)=>placeSelected(event.latlng.lat,event.latlng.lng));setTimeout(()=>map.invalidateSize(),250);};render();
const liveDriverMarkers={}; const liveDriverLines={}; const lineColors={pickup:'#0B7A4B',destination:'#FF8A00',old:'#8A9590'};
const removeLiveLine=(id)=>{const entry=liveDriverLines[id];if(!entry)return;map.removeLayer(entry.line);map.removeLayer(entry.dot);delete liveDriverLines[id];};
const showLiveLine=(driver,place)=>{const end=driver.lineTo;if(!Array.isArray(end)||end.length!==2||!Number.isFinite(end[0])||!Number.isFinite(end[1])){removeLiveLine(driver.id);return;}const kind=driver.lineKind==='destination'?'destination':'pickup';const color=driver.old?lineColors.old:lineColors[kind];const opacity=driver.old?0.6:0.9;const tagClass='line-end-tag line-end-tag-'+(driver.old?'old':kind);let entry=liveDriverLines[driver.id];if(!entry){entry={line:L.polyline([place,end],{color,opacity,weight:4,dashArray:'8 8',interactive:false}).addTo(map),dot:L.circleMarker(end,{radius:7,color:'#FFFFFF',weight:2,fillColor:color,fillOpacity:opacity}).addTo(map),tagClass:''};liveDriverLines[driver.id]=entry;}else{entry.line.setLatLngs([place,end]);entry.line.setStyle({color,opacity});entry.dot.setLatLng(end);entry.dot.setStyle({fillColor:color,fillOpacity:opacity});}if(entry.tagClass!==tagClass){entry.dot.unbindTooltip();entry.dot.bindTooltip(textLabel(driver.lineLabel||''),{permanent:true,direction:'right',offset:[10,0],className:tagClass});entry.tagClass=tagClass;}else{entry.dot.setTooltipContent(textLabel(driver.lineLabel||''));}};
const textLabel=(text)=>{const span=document.createElement('span');span.textContent=text;return span;};
const showLiveDrivers=(drivers)=>{const seen={};drivers.forEach((driver)=>{if(!Number.isFinite(driver.latitude)||!Number.isFinite(driver.longitude))return;seen[driver.id]=true;const place=[driver.latitude,driver.longitude];let marker=liveDriverMarkers[driver.id];if(!marker){marker=L.marker(place,{icon:pinIcon(driver.old?'oldDriver':'driver'),zIndexOffset:1000}).addTo(map).bindPopup(textLabel(driver.details));marker.liveOld=driver.old;liveDriverMarkers[driver.id]=marker;}else{marker.setLatLng(place);marker.setPopupContent(textLabel(driver.details));if(marker.liveOld!==driver.old){marker.setIcon(pinIcon(driver.old?'oldDriver':'driver'));marker.unbindTooltip();marker.liveOld=driver.old;}}marker.setOpacity(driver.old?0.65:1);if(marker.getTooltip())marker.setTooltipContent(textLabel(driver.label));else marker.bindTooltip(textLabel(driver.label),{permanent:true,direction:'bottom',offset:[0,4],className:driver.old?'driver-tag driver-tag-old':'driver-tag'});showLiveLine(driver,place);});Object.keys(liveDriverMarkers).forEach((id)=>{if(!seen[id]){map.removeLayer(liveDriverMarkers[id]);delete liveDriverMarkers[id];}});Object.keys(liveDriverLines).forEach((id)=>{if(!seen[id])removeLiveLine(id);});};
const focusLiveDriver=(id)=>{const marker=liveDriverMarkers[id];if(!marker)return;map.once('moveend',()=>marker.openPopup());map.flyTo(marker.getLatLng(),${PIN_ZOOM},{duration:0.8});};
window.addEventListener('message',(event)=>{if(event.source!==window.parent)return;const data=event.data||{};if(data.type==='liveDrivers'&&Array.isArray(data.drivers))showLiveDrivers(data.drivers);if(data.type==='focusLiveDriver')focusLiveDriver(data.id);});
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
// driverCoordinates = [lat, lng] of a driver's last known location (driver-location-plan.md).
//   Draws the bigger dark driver pin with driverLabel open above it, and the map zooms to it instead of the request pins.
//   (The dispatcher's map used this for "Show on map" before Task 3.20 Step B; it now uses liveDrivers instead.)
// liveDrivers = list of { id, latitude, longitude, old, label, details, lineTo, lineKind, lineLabel }
//   (the dispatcher's live map, ROADMAP Task 3.20 Step B and 3.21).
//   One driver pin each, with label always shown under it and details in the pop-up when the pin is tapped.
//   old = true: grey, faded pin and a grey dashed label. Website only (the dispatcher uses the website).
//   lineTo = [lat, lng] (optional, Task 3.21): a straight dashed line from the pin to there, ending in a round dot
//   with lineLabel always shown next to it (a word, not only a color: DESIGN.md). lineKind "pickup" = green,
//   "destination" = orange; old = grey and faded, same label. No lineTo = no line.
//   The list is NOT part of the map page, so a driver moving never rebuilds the map (no blink, the zoom stays):
//   React sends the new list into the map as a message, and the map only moves, adds or removes those pins.
//   These pins and lines don't count when the map fits the pickup and destination pins, so those work exactly as before.
// focusLiveDriver = { id }: slides the map to that live driver's pin and opens its pop-up. A new object each tap,
//   so tapping "Show on map" twice slides there again. The map does not keep following the driver.
// focusPickup = true: center on the pickup instead of fitting every pin (the dispatcher's map, Task 3.5).
//   Exact pin = zoom 16. Address lookup = zoom 15 with its "(approximate geocoded match)" label open, so it isn't mistaken for exact.
//   If the destination is found too, the map fits both pins instead (never closer than zoom 16), with space at the edges
//   (more on top for the pins and popup, more on the right for the tag), and the destination pin gets an always-visible "Destination" tag.
//   The destination is only typed text, so its pin is always an address lookup; vague text finds nothing and shows no pin.
export default function LeafletMap({ title = "Toledo City Map", markerLabel = "Toledo City, Cebu", pickupLabel = "", destinationLabel = "", pickupCoordinates = null, destinationCoordinates = null, centerCoordinates = null, driverCoordinates = null, driverLabel = "", selectable = false, onLocationSelect, showPins = true, zoomPosition = "topleft", bottomSpace = 0, minHeight = 280, focusPickup = false, liveDrivers = null, focusLiveDriver = null }) {
  const html = useMemo(() => createMapHtml({ title, markerLabel, pickupLabel, destinationLabel, pickupCoordinates, destinationCoordinates, centerCoordinates, driverCoordinates, driverLabel, selectable, showPins, zoomPosition, bottomSpace, focusPickup }), [bottomSpace, centerCoordinates, destinationCoordinates, destinationLabel, driverCoordinates, driverLabel, focusPickup, markerLabel, pickupCoordinates, pickupLabel, selectable, showPins, title, zoomPosition]);
  const receiveLocation = useCallback((event) => {
    try {
      const payload = typeof event?.nativeEvent?.data === "string" ? JSON.parse(event.nativeEvent.data) : event?.data;
      if (payload?.type === "locationSelected" && Number.isFinite(payload.latitude) && Number.isFinite(payload.longitude)) onLocationSelect?.(payload);
    } catch { /* Invalid iframe or WebView messages are ignored. */ }
  }, [onLocationSelect]);

  // Live driver pins (Task 3.20 Step B): sent into the map page as messages, never rebuilt into it.
  // The page is our own (srcDoc), so it has the same origin as the website and only accepts messages from it.
  const frameRef = useRef(null);
  const liveDriversRef = useRef(liveDrivers);
  liveDriversRef.current = liveDrivers;
  const sendToMap = useCallback((message) => {
    frameRef.current?.contentWindow?.postMessage(message, window.location.origin);
  }, []);
  // Also called when the map page (re)loads, for example after choosing another request, so the pins come back.
  const sendLiveDrivers = useCallback(() => {
    if (liveDriversRef.current) sendToMap({ type: "liveDrivers", drivers: liveDriversRef.current });
  }, [sendToMap]);
  useEffect(() => {
    if (Platform.OS === "web") sendLiveDrivers();
  }, [liveDrivers, sendLiveDrivers]);
  useEffect(() => {
    if (Platform.OS === "web" && focusLiveDriver) sendToMap({ type: "focusLiveDriver", id: focusLiveDriver.id });
  }, [focusLiveDriver, sendToMap]);

  useEffect(() => {
    if (Platform.OS !== "web" || !selectable) return undefined;
    const handler = (event) => receiveLocation(event);
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [receiveLocation, selectable]);

  if (Platform.OS === "web") return <View style={[styles.frame, { minHeight }]}>{createElement("iframe", { ref: frameRef, onLoad: sendLiveDrivers, title, srcDoc: html, style: { ...styles.webFrame, minHeight } })}</View>;
  const { WebView } = require("react-native-webview");
  return <View style={[styles.frame, { minHeight }]}><WebView originWhitelist={["*"]} source={{ html }} style={styles.nativeFrame} onMessage={receiveLocation} /></View>;
}

const styles = StyleSheet.create({ frame: { flex: 1, overflow: "hidden", backgroundColor: "#EDF3F0" }, nativeFrame: { flex: 1, backgroundColor: "#EDF3F0" }, webFrame: { width: "100%", height: "100%", borderWidth: 0, borderStyle: "none" } });
