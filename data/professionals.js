const placeholder = require('../assets/icon.png');

const professionals = [
  {
    id: '1',
    name: 'John Doe',
    profession: 'Plumber',
    rating: 4.5,
    reviews: 23,
    location: '2.1 km away',
    hourlyRate: 25,
    currency: 'USD',
    description: 'Experienced plumber with 10+ years in residential repairs.',
    contact: '+1234567890',
    lat: 37.78825,
    lng: -122.4324,
    images: [placeholder],
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  },
  {
    id: '2',
    name: 'Sarah Smith',
    profession: 'House Cleaner',
    rating: 4.8,
    reviews: 45,
    location: '1.3 km away',
    hourlyRate: 20,
    currency: 'USD',
    description: 'Professional cleaning service with eco-friendly products.',
    contact: '+1987654321',
    lat: 37.78925,
    lng: -122.4314,
    images: [placeholder],
    availableDays: ['Monday', 'Wednesday', 'Friday', 'Saturday']
  }
];

export default professionals;