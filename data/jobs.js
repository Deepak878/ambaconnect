const placeholder = require('../assets/icon.png');

const initialJobs = [
  { id: '1', kind: 'job', title: 'Cafe Barista (Part-time)', type: 'Part-time', salary: 12, salaryType: 'hourly', currency: 'USD', location: '2.1 km away', description: 'Looking for friendly baristas for weekends.', contact: '+1234567890', lat: 37.78825, lng: -122.4324, experienceRequired: false, images: [placeholder] },
  { id: '2', kind: 'job', title: 'Warehouse Helper (Full-time)', type: 'Full-time', salary: 450, salaryType: 'weekly', currency: 'USD', location: '0.8 km away', description: 'Physical lifting, flexible shifts.', contact: '+1987654321', lat: 37.78925, lng: -122.4314, experienceRequired: true, images: [placeholder] },
  { id: '3', kind: 'job', title: 'Dog Walker (Part-time)', type: 'Part-time', salary: 10, salaryType: 'hourly', currency: 'USD', location: '3.3 km away', description: 'Walk dogs in the mornings and evenings.', contact: '+1555123456', lat: 37.78725, lng: -122.4334, experienceRequired: false, images: [placeholder] },
  { id: '4', kind: 'accommodation', title: '1BHK sharing near station', accomType: '1BHK', rent: 400, currency: 'GBP', location: 'Bayside, London', description: 'Sharing room, close to transport.', contact: '+447700900123', lat: 51.5074, lng: -0.1278, images: [placeholder] },
  { id: '5', kind: 'accommodation', title: 'Single room available', accomType: 'Single Room', rent: 250, currency: 'JPY', location: 'Shinjuku, Tokyo', description: 'Room in 2BHK apartment, sharing.', contact: '+819012345678', lat: 35.6895, lng: 139.6917, images: [placeholder] },
  { id: '6', kind: 'job', title: 'Retail Assistant (Part-time)', type: 'Part-time', salary: 11, salaryType: 'hourly', currency: 'AUD', location: '4.0 km away', description: 'Stocking and cashier.', contact: '+61234567890', lat: -33.8688, lng: 151.2093, experienceRequired: false, images: [placeholder] },
  { id: '7', kind: 'job', title: 'Babysitter (Part-time)', type: 'Part-time', salary: 13, salaryType: 'hourly', currency: 'BRL', location: '2.0 km away', description: 'Evening babysitting.', contact: '+5511999999999', lat: -23.5505, lng: -46.6333, experienceRequired: true, images: [placeholder] },
  { id: '8', kind: 'job', title: 'Event Staff (Full-time)', type: 'Full-time', salary: 500, salaryType: 'weekly', currency: 'EUR', location: '0.7 km away', description: 'Event setup and coordination.', contact: '+33123456789', lat: 48.8566, lng: 2.3522, experienceRequired: false, images: [placeholder] },
  { id: '9', kind: 'job', title: 'Delivery Rider (Part-time)', type: 'Part-time', salary: 9, salaryType: 'hourly', currency: 'INR', location: '1.6 km away', description: 'Delivery and pickups.', contact: '+918123456789', lat: 28.6139, lng: 77.2090, experienceRequired: false, images: [placeholder] },
  { id: '10', kind: 'job', title: 'Tech Support (Full-time)', type: 'Full-time', salary: 700, salaryType: 'weekly', currency: 'USD', location: '5.0 km away', description: 'Helpdesk support.', contact: '+14151234567', lat: 37.7749, lng: -122.4194, experienceRequired: true, images: [placeholder] }
];

export default initialJobs;
