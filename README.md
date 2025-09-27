# GenZ - Job & Housing Marketplace

A modern React Native app for job and accommodation listings with real-time updates, advanced filtering, and location-based search.

## Features 🚀

### 📱 **Core Functionality**
- **Job Listings**: Browse and post part-time/full-time jobs
- **Housing**: Find and post accommodation/room sharing
- **Real-time Updates**: Firebase integration for live data
- **Location Services**: GPS-based distance calculation and mapping
- **Advanced Search**: Multi-filter search with categories, salary ranges, experience levels
- **Save & Bookmark**: Save favorite listings for later

### 🎨 **Enhanced UI/UX**
- **Modern Design**: Clean, card-based interface with smooth animations
- **Skeleton Loading**: Professional loading states
- **Pull-to-Refresh**: Native refresh functionality
- **Error Boundaries**: Graceful error handling
- **Responsive Design**: Optimized for all screen sizes

### 🔒 **Security & Privacy**
- **Input Validation**: Comprehensive form validation and sanitization
- **Rate Limiting**: Prevents spam and abuse
- **Content Filtering**: Automatic inappropriate content detection
- **GDPR Compliance**: Privacy settings and data retention policies
- **Secure Storage**: Encrypted local data storage

### 🔍 **Advanced Features**
- **Smart Filtering**: Category-based, salary range, experience level filters
- **Sorting Options**: By date, salary, distance, relevance
- **Location Picker**: Interactive map for precise location selection
- **Tagging System**: Automatic keyword extraction and tagging
- **Duration Settings**: Set start/end dates for temporary positions

## Tech Stack 💻

- **Frontend**: React Native with Expo
- **Backend**: Firebase Firestore
- **Maps**: React Native Maps with OpenStreetMap
- **State Management**: React Hooks
- **Authentication**: Firebase Auth with phone verification
- **Storage**: AsyncStorage + Firebase Cloud Storage
- **Validation**: Custom validation utilities
- **Performance**: Optimized components and lazy loading

## Setup Instructions 📋

### Prerequisites
- Node.js (v16 or later)
- npm or yarn
- Expo CLI
- Firebase project setup

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Deepak878/GenZ.git
   cd GenZ
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Configure Firebase**
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Firestore Database
   - Enable Authentication (Phone)
   - Update `firebaseConfig.js` with your Firebase config

4. **Start the development server**
   ```bash
   npm start
   # or
   expo start
   ```

5. **Run on device/emulator**
   - Scan QR code with Expo Go app (Android/iOS)
   - Or press 'a' for Android emulator
   - Or press 'i' for iOS simulator

## Project Structure 📂

```
GenZ/
├── components/           # React components
│   ├── AuthScreen.js    # Login/Register
│   ├── JobsScreen.js    # Job listings with filters
│   ├── PostScreen.js    # Create new posts
│   ├── MapScreen.js     # Map view
│   ├── JobItem.js       # Individual job cards
│   ├── Theme.js         # Design system
│   └── ...
├── hooks/               # Custom React hooks
├── utils/               # Utility functions
│   └── validation.js    # Input validation & security
├── data/                # Sample data
├── assets/              # Images and static files
├── App.js              # Main app component
└── firebaseConfig.js   # Firebase configuration
```

## Key Components 🧩

### JobsScreen
- Advanced filtering and search
- Infinite scroll with pagination
- Real-time updates from Firebase
- Distance-based sorting

### PostScreen
- Form validation and sanitization
- Interactive location picker
- Content filtering
- Category tagging

### AuthScreen
- Phone number authentication
- Input validation
- Rate limiting protection
- Privacy compliance

## Performance Optimizations ⚡

1. **Lazy Loading**: Components load on demand
2. **Image Optimization**: Cached and optimized images
3. **Pagination**: Load jobs in batches
4. **Debounced Search**: Reduced API calls
5. **Skeleton Loading**: Better perceived performance
6. **Error Boundaries**: Prevent app crashes

## Security Features 🛡️

1. **Input Sanitization**: All user inputs are sanitized
2. **Rate Limiting**: Prevents spam and abuse
3. **Content Filtering**: Inappropriate content detection
4. **Data Validation**: Comprehensive form validation
5. **Privacy Controls**: User privacy settings
6. **Secure Storage**: Encrypted local storage

## Contributing 🤝

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## Future Enhancements 🔮

- [ ] Push notifications for new jobs
- [ ] In-app messaging system
- [ ] User ratings and reviews
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Dark mode theme
- [ ] Social login integration
- [ ] Premium listing features

## Performance Tips 📈

1. **Regular Cleanup**: Clear old data periodically
2. **Image Compression**: Optimize uploaded images
3. **Cache Strategy**: Implement smart caching
4. **Background Updates**: Sync data in background
5. **Memory Management**: Proper component unmounting

## License 📄

This project is licensed under the 0BSD License - see the LICENSE file for details.

## Support 💬

For support and questions, please open an issue on GitHub or contact the development team.

---

**Built with ❤️ by the GenZ Team**