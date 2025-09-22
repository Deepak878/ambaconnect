// import React, { useState, useEffect, useRef } from 'react';
// import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
// import MapView, { Marker, Callout, UrlTile } from 'react-native-maps';
// import * as Location from 'expo-location';
// import { Colors, shared } from './Theme';

// const dummyJobs = [
//   { id: '1', title: 'Cashier at Walmart', type: 'Part-time', salary: 15, salaryType: 'hourly', lat: 39.7651, lng: -84.0660, kind: 'job' },
//   { id: '2', title: 'Software Intern', type: 'Full-time', salary: 700, salaryType: 'weekly', lat: 39.7589, lng: -84.1916, kind: 'job' },
//   { id: '3', title: 'Apartment Room', rent: 500, lat: 39.8209, lng: -84.0194, kind: 'accommodation' },
// ];

// export default function MapScreen({ jobs: propJobs = [], onOpenJob = () => {} }) {
//   const [kindFilter, setKindFilter] = useState('all');
//   const [permission, setPermission] = useState('unknown');
//   const [location, setLocation] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const mapRef = useRef(null);

//   const jobs = (propJobs && propJobs.length) ? propJobs : dummyJobs;

//   const filtered = jobs.filter(j => {
//     if (!j) return false;
//     if (kindFilter === 'job' && j.kind !== 'job') return false;
//     if (kindFilter === 'accommodation' && j.kind !== 'accommodation') return false;
//     return true;
//   });

//   useEffect(() => {
//     (async () => {
//       setLoading(true);
//       try {
//         const res = await Location.requestForegroundPermissionsAsync();
//         if (res.status === 'granted') {
//           setPermission('granted');
//           const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
//           setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
//         } else {
//           setPermission('denied');
//         }
//       } catch (e) {
//         setPermission('unknown');
//       }
//       setLoading(false);
//     })();
//   }, []);

//   const askPermission = async () => {
//     setLoading(true);
//     try {
//       const res = await Location.requestForegroundPermissionsAsync();
//       if (res.status === 'granted') {
//         setPermission('granted');
//         const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
//         setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
//         if (mapRef.current) mapRef.current.animateToRegion({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 });
//       } else {
//         setPermission('denied');
//         Alert.alert('Permission required', 'Location permission is required to show nearby jobs.');
//       }
//     } catch (e) {
//       Alert.alert('Missing package', 'Run `npx expo install expo-location`.');
//     }
//     setLoading(false);
//   };

//   if (loading) return (
//     <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
//       <ActivityIndicator size="large" color={Colors.primary} />
//     </View>
//   );

//   return (
//     <View style={{ flex: 1 }}>
//       <View style={{ flexDirection: 'row', padding: 8, justifyContent: 'center', backgroundColor: Colors.bg }}>
//         <TouchableOpacity onPress={() => setKindFilter('all')} style={[shared.smallButton, { backgroundColor: kindFilter === 'all' ? Colors.primary : Colors.card, marginHorizontal: 6 }]}>
//           <Text style={{ color: kindFilter === 'all' ? Colors.card : undefined }}>All</Text>
//         </TouchableOpacity>
//         <TouchableOpacity onPress={() => setKindFilter('job')} style={[shared.smallButton, { backgroundColor: kindFilter === 'job' ? Colors.primary : Colors.card, marginHorizontal: 6 }]}>
//           <Text style={{ color: kindFilter === 'job' ? Colors.card : undefined }}>Jobs nearby</Text>
//         </TouchableOpacity>
//         <TouchableOpacity onPress={() => setKindFilter('accommodation')} style={[shared.smallButton, { backgroundColor: kindFilter === 'accommodation' ? Colors.primary : Colors.card, marginHorizontal: 6 }]}>
//           <Text style={{ color: kindFilter === 'accommodation' ? Colors.card : undefined }}>Accom nearby</Text>
//         </TouchableOpacity>
//       </View>

//       <View style={{ flex: 1 }}>
//         {permission === 'granted' ? (
//           location ? (
//             <View style={{ flex: 1 }}>
//               <MapView ref={mapRef} style={{ flex: 1 }} initialRegion={{ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }}>
//                 <UrlTile urlTemplate="https://c.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
//                 {filtered.map(j => j.lat && j.lng ? (
//                   <Marker key={j.id} coordinate={{ latitude: j.lat, longitude: j.lng }} title={j.title} description={j.kind === 'accommodation' ? `Rent: ${j.currency ? j.currency + ' ' : ''}${j.rent}` : `${j.type || ''} • ${j.currency ? j.currency + ' ' : ''}${j.salary}` }>
//                     <Callout onPress={() => onOpenJob(j, { showContact: true })}>
//                       <View style={{ width: 200 }}>
//                         <Text style={{ fontWeight: '700' }}>{j.title}</Text>
//                         <Text style={{ color: Colors.muted, marginTop: 4 }}>{j.kind === 'accommodation' ? `Rent: ${j.currency ? j.currency + ' ' : ''}${j.rent}` : `${j.type || ''} • ${j.currency ? j.currency + ' ' : ''}${j.salary}`}</Text>
//                         <TouchableOpacity onPress={() => onOpenJob(j, { showContact: true })} style={[shared.primaryButton, { marginTop: 8 }]}>
//                           <Text style={shared.primaryButtonText}>View</Text>
//                         </TouchableOpacity>
//                       </View>
//                     </Callout>
//                   </Marker>
//                 ) : null)}
//               </MapView>

//               <TouchableOpacity onPress={() => { if (mapRef.current && location) mapRef.current.animateToRegion({ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }); }} style={[shared.primaryButton, { margin: 12, alignSelf: 'flex-end' }]}>
//                 <Text style={shared.primaryButtonText}>Center on me</Text>
//               </TouchableOpacity>
//             </View>
//           ) : (
//             <View style={{ padding: 16 }}>
//               <Text>Unable to obtain your location. Try again.</Text>
//               <TouchableOpacity onPress={askPermission} style={[shared.primaryButton, { marginTop: 12 }]}>
//                 <Text style={shared.primaryButtonText}>Allow location</Text>
//               </TouchableOpacity>
//             </View>
//           )
//         ) : (
//           <View style={{ padding: 16 }}>
//             <Text style={{ marginBottom: 8 }}>We use your location only to show nearby jobs. We do not use it for any other purpose.</Text>
//             <Text style={{ marginBottom: 8 }}>Permission: {permission}</Text>
//             <TouchableOpacity onPress={askPermission} style={[shared.primaryButton, { marginTop: 8 }]}>
//               <Text style={shared.primaryButtonText}>Allow location</Text>
//             </TouchableOpacity>
//           </View>
//         )}
//       </View>
//     </View>
//   );
// }
// // // // import React, { useState, useEffect, useRef } from 'react';
// // // // import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, Platform } from 'react-native';
// // // // import MapView, { Marker, Callout, UrlTile } from 'react-native-maps';
// // // // import * as Location from 'expo-location';
// // // // import { Colors, shared } from './Theme';

// // // // export default function MapScreen({ jobs, onOpenJob }) {
// // // //   const [part, setPart] = useState(false);
// // // //   const [salaryType, setSalaryType] = useState(null);
// // // //   const [experience, setExperience] = useState(null);

// // // //   const [permission, setPermission] = useState('unknown'); // 'unknown', 'granted', 'denied'
// // // //   const [location, setLocation] = useState(null);
// // // //   const [loading, setLoading] = useState(false);
// // // //   const mapRef = useRef(null);

// // // //   const filtered = jobs.filter(j => {
// // // //     if (part && !j.type.toLowerCase().includes('part')) return false;
// // // //     if (salaryType && j.salaryType !== salaryType) return false;
// // // //     if (experience !== null && !!j.experienceRequired !== experience) return false;
// // // //     return true;
// // // //   });

// // // //   useEffect(() => {
// // // //     (async () => {
// // // //       setLoading(true);
// // // //       try {
// // // //         const res = await Location.requestForegroundPermissionsAsync();
// // // //         if (res.status === 'granted') {
// // // //           setPermission('granted');
// // // //           const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
// // // //           setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
// // // //         } else {
// // // //           setPermission('denied');
// // // //         }
// // // //       } catch (e) {
// // // //         setPermission('unknown');
// // // //       }
// // // //       setLoading(false);
// // // //     })();
// import React, { useState, useEffect, useRef } from 'react';
// import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
// import MapView, { Marker, Callout, UrlTile } from 'react-native-maps';
// import * as Location from 'expo-location';
// import { Colors, shared } from './Theme';

// // Minimal sample posts when none are provided
// const dummyJobs = [
//   { id: '1', title: 'Cashier at Walmart', type: 'Part-time', salary: 15, salaryType: 'hourly', lat: 39.7651, lng: -84.0660, kind: 'job' },
//   { id: '2', title: 'Software Intern', type: 'Full-time', salary: 700, salaryType: 'weekly', lat: 39.7589, lng: -84.1916, kind: 'job' },
//   { id: '3', title: 'Apartment Room', rent: 500, lat: 39.8209, lng: -84.0194, kind: 'accommodation' },
// ];

// export default function MapScreen({ jobs: propJobs = [], onOpenJob = () => {} }) {
//   const [kindFilter, setKindFilter] = useState('all');
//   const [permission, setPermission] = useState('unknown');
//   const [location, setLocation] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const mapRef = useRef(null);

//   const jobs = (propJobs && propJobs.length) ? propJobs : dummyJobs;

//   const filtered = jobs.filter(j => {
//     if (!j) return false;
//     if (kindFilter === 'job' && j.kind !== 'job') return false;
//     if (kindFilter === 'accommodation' && j.kind !== 'accommodation') return false;
//     return true;
//   });

//   useEffect(() => {
//     (async () => {
//       setLoading(true);
//       try {
//         const res = await Location.requestForegroundPermissionsAsync();
//         if (res.status === 'granted') {
//           setPermission('granted');
//           const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
//           setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
//         } else {
//           setPermission('denied');
//         }
//       } catch (e) {
//         setPermission('unknown');
//       }
//       setLoading(false);
//     })();
//   }, []);

//   const askPermission = async () => {
//     setLoading(true);
//     try {
//       const res = await Location.requestForegroundPermissionsAsync();
//       if (res.status === 'granted') {
//         setPermission('granted');
//         const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
//         setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
//         if (mapRef.current) {
//           mapRef.current.animateToRegion({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 });
//         }
//       } else {
//         setPermission('denied');
//         Alert.alert('Permission required', 'Location permission is required to show nearby jobs.');
//       }
//     } catch (e) {
//       Alert.alert('Missing package', 'Run `npx expo install expo-location`.');
//     }
//     setLoading(false);
//   };

//   if (loading) return (
//     <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
//       <ActivityIndicator size="large" color={Colors.primary} />
//     </View>
//   );

//   return (
//     <View style={{ flex: 1 }}>
//       {/* Filter bar */}
//       <View style={{ flexDirection: 'row', padding: 8, justifyContent: 'center', backgroundColor: Colors.bg }}>
//         <TouchableOpacity onPress={() => setKindFilter('all')} style={[shared.smallButton, { backgroundColor: kindFilter === 'all' ? Colors.primary : Colors.card, marginHorizontal: 6 }]}>
//           <Text style={{ color: kindFilter === 'all' ? Colors.card : undefined }}>All</Text>
//         </TouchableOpacity>
//         <TouchableOpacity onPress={() => setKindFilter('job')} style={[shared.smallButton, { backgroundColor: kindFilter === 'job' ? Colors.primary : Colors.card, marginHorizontal: 6 }]}>
//           <Text style={{ color: kindFilter === 'job' ? Colors.card : undefined }}>Jobs nearby</Text>
//         </TouchableOpacity>
//         <TouchableOpacity onPress={() => setKindFilter('accommodation')} style={[shared.smallButton, { backgroundColor: kindFilter === 'accommodation' ? Colors.primary : Colors.card, marginHorizontal: 6 }]}>
//           <Text style={{ color: kindFilter === 'accommodation' ? Colors.card : undefined }}>Accom nearby</Text>
//         </TouchableOpacity>
//       </View>

//       {/* Map section */}
//       <View style={{ flex: 1 }}>
//         {permission === 'granted' ? (
//           location ? (
//             <View style={{ flex: 1 }}>
//               <MapView ref={mapRef} style={{ flex: 1 }} initialRegion={{ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }}>
//                 <UrlTile urlTemplate="https://c.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
//                 {filtered.map(j => j.lat && j.lng ? (
//                   <Marker key={j.id} coordinate={{ latitude: j.lat, longitude: j.lng }} title={j.title} description={j.kind === 'accommodation' ? `Rent: ${j.currency ? j.currency + ' ' : ''}${j.rent}` : `${j.type || ''} • ${j.currency ? j.currency + ' ' : ''}${j.salary}` }>
//                     <Callout onPress={() => onOpenJob(j, { showContact: true })}>
//                       <View style={{ width: 200 }}>
//                         <Text style={{ fontWeight: '700' }}>{j.title}</Text>
//                         <Text style={{ color: Colors.muted, marginTop: 4 }}>{j.kind === 'accommodation' ? `Rent: ${j.currency ? j.currency + ' ' : ''}${j.rent}` : `${j.type || ''} • ${j.currency ? j.currency + ' ' : ''}${j.salary}`}</Text>
//                         <TouchableOpacity onPress={() => onOpenJob(j, { showContact: true })} style={[shared.primaryButton, { marginTop: 8 }]}>
//                           <Text style={shared.primaryButtonText}>View</Text>
//                         </TouchableOpacity>
//                       </View>
//                     </Callout>
//                   </Marker>
//                 ) : null)}
//               </MapView>

//               <TouchableOpacity onPress={() => { if (mapRef.current && location) mapRef.current.animateToRegion({ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }); }} style={[shared.primaryButton, { margin: 12, alignSelf: 'flex-end' }]}>
//                 <Text style={shared.primaryButtonText}>Center on me</Text>
//               </TouchableOpacity>
//             </View>
//           ) : (
//             <View style={{ padding: 16 }}>
//               <Text>Unable to obtain your location. Try again.</Text>
//               <TouchableOpacity onPress={askPermission} style={[shared.primaryButton, { marginTop: 12 }]}>
//                 <Text style={shared.primaryButtonText}>Allow location</Text>
//               </TouchableOpacity>
//             </View>
//           )
//         ) : (
//           <View style={{ padding: 16 }}>
//             <Text style={{ marginBottom: 8 }}>We use your location only to show nearby jobs. We do not use it for any other purpose.</Text>
//             <Text style={{ marginBottom: 8 }}>Permission: {permission}</Text>
//             <TouchableOpacity onPress={askPermission} style={[shared.primaryButton, { marginTop: 8 }]}>
//               <Text style={shared.primaryButtonText}>Allow location</Text>
//             </TouchableOpacity>
//           </View>
//         )}
//       </View>
//     </View>
//   );
// }
//                         <Text style={{ color: Colors.muted, marginTop: 4 }}>{j.kind === 'accommodation' ? `Rent: ${j.currency ? j.currency + ' ' : ''}${j.rent}` : `${j.type || ''} • ${j.currency ? j.currency + ' ' : ''}${j.salary}`}</Text>
//                         <TouchableOpacity onPress={() => onOpenJob(j, { showContact: true })} style={[shared.primaryButton, { marginTop: 8 }]}>
//                           <Text style={shared.primaryButtonText}>View</Text>
//                         </TouchableOpacity>
//                       </View>
//                     </Callout>
//                   </Marker>
//                 ) : null)}
//               </MapView>

//               <TouchableOpacity onPress={() => { if (mapRef.current && location) mapRef.current.animateToRegion({ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }); }} style={[shared.primaryButton, { margin: 12, alignSelf: 'flex-end' }]}>
//                 <Text style={shared.primaryButtonText}>Center on me</Text>
//               </TouchableOpacity>
//             </View>
//           ) : (
//             <View style={{ padding: 16 }}>
//               <Text>Unable to obtain your location. Try again.</Text>
//               <TouchableOpacity onPress={askPermission} style={[shared.primaryButton, { marginTop: 12 }]}>
//                 <Text style={shared.primaryButtonText}>Allow location</Text>
//               </TouchableOpacity>
//             </View>
//           )
//         ) : (
//           <View style={{ padding: 16 }}>
//             <Text style={{ marginBottom: 8 }}>We use your location only to show nearby jobs. We do not use it for any other purpose.</Text>
//             <Text style={{ marginBottom: 8 }}>Permission: {permission}</Text>
//             <TouchableOpacity onPress={askPermission} style={[shared.primaryButton, { marginTop: 8 }]}>
//               <Text style={shared.primaryButtonText}>Allow location</Text>
//             </TouchableOpacity>
//           </View>
//         )}
//       </View>
//     </View>
//   );
// }

// legacy commented fragments removed


// // import React, { useState, useEffect, useRef } from 'react';
// // import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
// // import MapView, { Marker, Callout } from 'react-native-maps';
// // import * as Location from 'expo-location';
// // import { Colors, shared } from './Theme';

// // // Minimal sample posts when none are provided
// // const dummyJobs = [
// //   { id: '1', title: 'Cashier at Walmart', type: 'Part-time', salary: 15, salaryType: 'hourly', lat: 39.7651, lng: -84.0660, kind: 'job' },
// //   { id: '2', title: 'Software Intern', type: 'Full-time', salary: 700, salaryType: 'weekly', lat: 39.7589, lng: -84.1916, kind: 'job' },
// //   { id: '3', title: 'Apartment Room', rent: 500, lat: 39.8209, lng: -84.0194, kind: 'accommodation' },
// // ];

// // export default function MapScreen({ jobs: propJobs = [], onOpenJob = () => {} }) {
// //   const [kindFilter, setKindFilter] = useState('all');
// //   const [permission, setPermission] = useState('unknown');
// //   const [location, setLocation] = useState(null);
// //   const [loading, setLoading] = useState(false);
// //   const mapRef = useRef(null);

// //   const jobs = (propJobs && propJobs.length) ? propJobs : dummyJobs;

// //   const filtered = jobs.filter(j => {
// //     if (!j) return false;
// //     if (kindFilter === 'job' && j.kind !== 'job') return false;
// //     if (kindFilter === 'accommodation' && j.kind !== 'accommodation') return false;
// //     return true;
// //   });

// //   useEffect(() => {
// //     (async () => {
// //       setLoading(true);
// //       try {
// //         const res = await Location.requestForegroundPermissionsAsync();
// //         if (res.status === 'granted') {
// //           setPermission('granted');
// //           const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
// //           setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
// //         } else {
// //           setPermission('denied');
// //         }
// //       } catch (e) {
// //         setPermission('unknown');
// //       }
// //       setLoading(false);
// //     })();
// //   }, []);

// //   const askPermission = async () => {
// //     setLoading(true);
// //     try {
// //       const res = await Location.requestForegroundPermissionsAsync();
// //       if (res.status === 'granted') {
// //         setPermission('granted');
// //         const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
// //         setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
// //         if (mapRef.current) {
// //           mapRef.current.animateToRegion({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 });
// //         }
// //       } else {
// //         setPermission('denied');
// //         Alert.alert('Permission required', 'Location permission is required to show nearby jobs.');
// //       }
// //     } catch (e) {
// //       Alert.alert('Missing package', 'Run `npx expo install expo-location`.');
// //     }
// //     setLoading(false);
// //   };

// //   if (loading) return (
// //     <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
// //       <ActivityIndicator size="large" color={Colors.primary} />
// //     </View>
// //   );

// //   return (
// //     <View style={{ flex: 1 }}>
// //       {/* Filter bar */}
// //       <View style={{ flexDirection: 'row', padding: 8, justifyContent: 'center', backgroundColor: Colors.bg }}>
// //         <TouchableOpacity onPress={() => setKindFilter('all')} style={[shared.smallButton, { backgroundColor: kindFilter === 'all' ? Colors.primary : Colors.card, marginHorizontal: 6 }]}>
// //           <Text style={{ color: kindFilter === 'all' ? Colors.card : undefined }}>All</Text>
// //         </TouchableOpacity>
// //         <TouchableOpacity onPress={() => setKindFilter('job')} style={[shared.smallButton, { backgroundColor: kindFilter === 'job' ? Colors.primary : Colors.card, marginHorizontal: 6 }]}>
// //           <Text style={{ color: kindFilter === 'job' ? Colors.card : undefined }}>Jobs nearby</Text>
// //         </TouchableOpacity>
// //         <TouchableOpacity onPress={() => setKindFilter('accommodation')} style={[shared.smallButton, { backgroundColor: kindFilter === 'accommodation' ? Colors.primary : Colors.card, marginHorizontal: 6 }]}>
// //           <Text style={{ color: kindFilter === 'accommodation' ? Colors.card : undefined }}>Accom nearby</Text>
// //         </TouchableOpacity>
// //       </View>

// //       {/* Map section */}
// //       <View style={{ flex: 1 }}>
// //         {permission === 'granted' ? (
// //           location ? (
// //             <View style={{ flex: 1 }}>
// //               <MapView ref={mapRef} style={{ flex: 1 }} initialRegion={{ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }}>
// //                 {filtered.map(j => j.lat && j.lng ? (
// //                   <Marker key={j.id} coordinate={{ latitude: j.lat, longitude: j.lng }} title={j.title} description={j.kind === 'accommodation' ? `Rent: ${j.currency ? j.currency + ' ' : ''}${j.rent}` : `${j.type || ''} • ${j.currency ? j.currency + ' ' : ''}${j.salary}` }>
// //                     <Callout onPress={() => onOpenJob(j, { showContact: true })}>
// //                       <View style={{ width: 200 }}>
// //                         <Text style={{ fontWeight: '700' }}>{j.title}</Text>
// //                         <Text style={{ color: Colors.muted, marginTop: 4 }}>{j.kind === 'accommodation' ? `Rent: ${j.currency ? j.currency + ' ' : ''}${j.rent}` : `${j.type || ''} • ${j.currency ? j.currency + ' ' : ''}${j.salary}`}</Text>
// //                         <TouchableOpacity onPress={() => onOpenJob(j, { showContact: true })} style={[shared.primaryButton, { marginTop: 8 }]}>
// //                           <Text style={shared.primaryButtonText}>View</Text>
// //                         </TouchableOpacity>
// //                       </View>
// //                     </Callout>
// //                   </Marker>
// //                 ) : null)}
// //               </MapView>

// //               <TouchableOpacity onPress={() => { if (mapRef.current && location) mapRef.current.animateToRegion({ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }); }} style={[shared.primaryButton, { margin: 12, alignSelf: 'flex-end' }]}>
// //                 <Text style={shared.primaryButtonText}>Center on me</Text>
// //               </TouchableOpacity>
// //             </View>
// //           ) : (
// //             <View style={{ padding: 16 }}>
// //               <Text>Unable to obtain your location. Try again.</Text>
// //               <TouchableOpacity onPress={askPermission} style={[shared.primaryButton, { marginTop: 12 }]}>
// //                 <Text style={shared.primaryButtonText}>Allow location</Text>
// //               </TouchableOpacity>
// //             </View>
// //           )
// //         ) : (
// //           <View style={{ padding: 16 }}>
// //             <Text style={{ marginBottom: 8 }}>We use your location only to show nearby jobs. We do not use it for any other purpose.</Text>
// //             <Text style={{ marginBottom: 8 }}>Permission: {permission}</Text>
// //             <TouchableOpacity onPress={askPermission} style={[shared.primaryButton, { marginTop: 8 }]}>
// //               <Text style={shared.primaryButtonText}>Allow location</Text>
// //             </TouchableOpacity>
// //           </View>
// //         )}
// //       </View>
// //     </View>
// //   );
// // }





import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { Colors, shared } from './Theme';

// Minimal sample posts when none are provided
const dummyJobs = [
  { id: '1', title: 'Cashier at Walmart', type: 'Part-time', salary: 15, salaryType: 'hourly', lat: 39.7651, lng: -84.0660, kind: 'job' },
  { id: '2', title: 'Software Intern', type: 'Full-time', salary: 700, salaryType: 'weekly', lat: 39.7589, lng: -84.1916, kind: 'job' },
  { id: '3', title: 'Apartment Room', rent: 500, lat: 39.8209, lng: -84.0194, kind: 'accommodation' },
];

export default function MapScreen({ jobs: propJobs = [], onOpenJob = () => {} }) {
  const [kindFilter, setKindFilter] = useState('all');
  const [permission, setPermission] = useState('unknown');
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef(null);

  const jobs = (propJobs && propJobs.length) ? propJobs : dummyJobs;

  const filtered = jobs.filter(j => {
    if (!j) return false;
    if (kindFilter === 'job' && j.kind !== 'job') return false;
    if (kindFilter === 'accommodation' && j.kind !== 'accommodation') return false;
    return true;
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await Location.requestForegroundPermissionsAsync();
        if (res.status === 'granted') {
          setPermission('granted');
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        } else {
          setPermission('denied');
        }
      } catch (e) {
        setPermission('unknown');
      }
      setLoading(false);
    })();
  }, []);

  const askPermission = async () => {
    setLoading(true);
    try {
      const res = await Location.requestForegroundPermissionsAsync();
      if (res.status === 'granted') {
        setPermission('granted');
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          });
        }
      } else {
        setPermission('denied');
        Alert.alert('Permission required', 'Location permission is required to show nearby jobs.');
      }
    } catch (e) {
      Alert.alert('Missing package', 'Run `npx expo install expo-location`.');
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Filter bar */}
      <View
        style={{
          flexDirection: 'row',
          padding: 8,
          justifyContent: 'center',
          backgroundColor: Colors.bg,
        }}
      >
        <TouchableOpacity
          onPress={() => setKindFilter('all')}
          style={[
            shared.smallButton,
            {
              backgroundColor:
                kindFilter === 'all' ? Colors.primary : Colors.card,
              marginHorizontal: 6,
            },
          ]}
        >
          <Text style={{ color: kindFilter === 'all' ? Colors.card : undefined }}>
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setKindFilter('job')}
          style={[
            shared.smallButton,
            {
              backgroundColor:
                kindFilter === 'job' ? Colors.primary : Colors.card,
              marginHorizontal: 6,
            },
          ]}
        >
          <Text style={{ color: kindFilter === 'job' ? Colors.card : undefined }}>
            Jobs nearby
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setKindFilter('accommodation')}
          style={[
            shared.smallButton,
            {
              backgroundColor:
                kindFilter === 'accommodation' ? Colors.primary : Colors.card,
              marginHorizontal: 6,
            },
          ]}
        >
          <Text
            style={{
              color: kindFilter === 'accommodation' ? Colors.card : undefined,
            }}
          >
            Accom nearby
          </Text>
        </TouchableOpacity>
      </View>

      {/* Map section */}
      <View style={{ flex: 1 }}>
        {permission === 'granted' ? (
          location ? (
            <View style={{ flex: 1 }}>
              <MapView
                ref={mapRef}
                style={{ flex: 1 }}
                initialRegion={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
              >
                {filtered.map(j =>
                  j.lat && j.lng ? (
                    <Marker
                      key={j.id}
                      coordinate={{ latitude: j.lat, longitude: j.lng }}
                      title={j.title}
                      description={
                        j.kind === 'accommodation'
                          ? `Rent: ${j.currency ? j.currency + ' ' : ''}${j.rent ?? ''}`
                          : `${j.type || ''} • ${
                              j.currency ? j.currency + ' ' : ''
                            }${j.salary ?? ''}`
                      }
                    >
                      <Callout onPress={() => onOpenJob(j, { showContact: true })}>
                        <View style={{ width: 200 }}>
                          <Text style={{ fontWeight: '700' }}>{j.title}</Text>
                          <Text style={{ color: Colors.muted, marginTop: 4 }}>
                            {j.kind === 'accommodation'
                              ? `Rent: ${j.currency ? j.currency + ' ' : ''}${j.rent ?? ''}`
                              : `${j.type || ''} • ${
                                  j.currency ? j.currency + ' ' : ''
                                }${j.salary ?? ''}`}
                          </Text>
                          <TouchableOpacity
                            onPress={() => onOpenJob(j, { showContact: true })}
                            style={[shared.primaryButton, { marginTop: 8 }]}
                          >
                            <Text style={shared.primaryButtonText}>View</Text>
                          </TouchableOpacity>
                        </View>
                      </Callout>
                    </Marker>
                  ) : null
                )}
              </MapView>

              <TouchableOpacity
                onPress={() => {
                  if (mapRef.current && location) {
                    mapRef.current.animateToRegion({
                      latitude: location.latitude,
                      longitude: location.longitude,
                      latitudeDelta: 0.05,
                      longitudeDelta: 0.05,
                    });
                  }
                }}
                style={[shared.primaryButton, { margin: 12, alignSelf: 'flex-end' }]}
              >
                <Text style={shared.primaryButtonText}>Center on me</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ padding: 16 }}>
              <Text>Unable to obtain your location. Try again.</Text>
              <TouchableOpacity
                onPress={askPermission}
                style={[shared.primaryButton, { marginTop: 12 }]}
              >
                <Text style={shared.primaryButtonText}>Allow location</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          <View style={{ padding: 16 }}>
            <Text style={{ marginBottom: 8 }}>
              We use your location only to show nearby jobs. We do not use it for
              any other purpose.
            </Text>
            <Text style={{ marginBottom: 8 }}>Permission: {permission}</Text>
            <TouchableOpacity
              onPress={askPermission}
              style={[shared.primaryButton, { marginTop: 8 }]}
            >
              <Text style={shared.primaryButtonText}>Allow location</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}
