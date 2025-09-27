// Debug script to test Firestore connection and data fetching
import { db } from './firebaseConfig.js';
import { 
  collection, 
  query as fsQuery, 
  orderBy, 
  getDocs,
  where,
  Timestamp,
  limit
} from 'firebase/firestore';

const testFirestoreConnection = async () => {
  console.log('=== TESTING FIRESTORE CONNECTION ===');
  
  try {
    // Test basic connection
    console.log('1. Testing basic jobs collection access...');
    const jobsRef = collection(db, 'jobs');
    console.log('Jobs collection reference:', jobsRef);
    
    // Test simple query first
    console.log('2. Testing simple jobs query (no filters)...');
    const simpleQuery = fsQuery(jobsRef, limit(3));
    const simpleSnapshot = await getDocs(simpleQuery);
    console.log('Simple query results:', simpleSnapshot.size, 'documents');
    
    simpleSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`Job ${index + 1}:`, {
        id: doc.id,
        title: data.title,
        createdAt: data.createdAt,
        createdAtType: typeof data.createdAt
      });
    });
    
    // Test with date filter
    console.log('3. Testing jobs query with date filter...');
    const thirtyDaysAgo = Timestamp.fromDate(new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)));
    console.log('Thirty days ago timestamp:', thirtyDaysAgo);
    
    const dateFilterQuery = fsQuery(
      jobsRef,
      where('createdAt', '>=', thirtyDaysAgo),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    
    const dateSnapshot = await getDocs(dateFilterQuery);
    console.log('Date filtered query results:', dateSnapshot.size, 'documents');
    
    // Test accommodations
    console.log('4. Testing accommodations collection...');
    const accRef = collection(db, 'accommodations');
    const accQuery = fsQuery(accRef, limit(3));
    const accSnapshot = await getDocs(accQuery);
    console.log('Accommodations query results:', accSnapshot.size, 'documents');
    
    // Summary
    console.log('=== FIRESTORE TEST SUMMARY ===');
    console.log('Jobs (simple):', simpleSnapshot.size);
    console.log('Jobs (with date filter):', dateSnapshot.size);
    console.log('Accommodations:', accSnapshot.size);
    
  } catch (error) {
    console.error('Firestore test failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
  }
};

// Run the test
testFirestoreConnection();