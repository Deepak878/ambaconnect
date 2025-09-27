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

const mapSnapshotDocs = (snapshot) =>
  snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

export const testFirestoreConnection = async () => {
  const report = [];

  try {
    const jobsRef = collection(db, 'jobs');
    report.push({ step: 'jobsCollection', referencePath: jobsRef.path });

    const simpleQuery = fsQuery(jobsRef, limit(3));
    const simpleSnapshot = await getDocs(simpleQuery);
    report.push({
      step: 'jobsSimpleQuery',
      count: simpleSnapshot.size,
      sample: mapSnapshotDocs(simpleSnapshot)
    });

    const thirtyDaysAgo = Timestamp.fromDate(new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)));
    report.push({ step: 'thirtyDaysAgo', value: thirtyDaysAgo.toMillis ? thirtyDaysAgo.toMillis() : thirtyDaysAgo });

    const dateFilterQuery = fsQuery(
      jobsRef,
      where('createdAt', '>=', thirtyDaysAgo),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const dateSnapshot = await getDocs(dateFilterQuery);
    report.push({
      step: 'jobsDateFilteredQuery',
      count: dateSnapshot.size,
      sample: mapSnapshotDocs(dateSnapshot)
    });

    const accRef = collection(db, 'accommodations');
    const accQuery = fsQuery(accRef, limit(3));
    const accSnapshot = await getDocs(accQuery);
    report.push({
      step: 'accommodationsQuery',
      count: accSnapshot.size,
      sample: mapSnapshotDocs(accSnapshot)
    });

    return {
      success: true,
      summary: {
        jobsSimple: simpleSnapshot.size,
        jobsDateFiltered: dateSnapshot.size,
        accommodations: accSnapshot.size
      },
      report
    };
  } catch (error) {
    return {
      success: false,
      report,
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      }
    };
  }
};

export default testFirestoreConnection;