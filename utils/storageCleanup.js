// Firebase Storage Cleanup Utilities
// This file contains helper functions for cleaning up orphaned images

import { ref, listAll, deleteObject } from 'firebase/storage';
import { collection, getDocs } from 'firebase/firestore';
import { storage, db } from '../firebaseConfig';

/**
 * Clean up orphaned images in Firebase Storage
 * This function finds images that exist in storage but are not referenced in any Firestore documents
 * WARNING: Use with caution - this will permanently delete files
 */
export const cleanupOrphanedImages = async () => {
  try {
    // Get all image URLs from Firestore documents
    const referencedImages = new Set();
    
    // Check jobs collection
    const jobsSnapshot = await getDocs(collection(db, 'jobs'));
    jobsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.images && Array.isArray(data.images)) {
        data.images.forEach(imageUrl => {
          if (imageUrl && typeof imageUrl === 'string') {
            referencedImages.add(imageUrl);
          }
        });
      }
    });
    
    // Check accommodations collection
    const accomsSnapshot = await getDocs(collection(db, 'accommodations'));
    accomsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.images && Array.isArray(data.images)) {
        data.images.forEach(imageUrl => {
          if (imageUrl && typeof imageUrl === 'string') {
            referencedImages.add(imageUrl);
          }
        });
      }
    });
    
    // Get all files from storage
    const jobsRef = ref(storage, 'jobs');
    const accomsRef = ref(storage, 'accommodations');
    
    let deletedCount = 0;
    
    // Check jobs folder
    try {
      const jobsList = await listAll(jobsRef);
      for (const item of jobsList.items) {
        const downloadURL = await import('firebase/storage').then(({ getDownloadURL }) => getDownloadURL(item));
        
        if (!referencedImages.has(downloadURL)) {
          await deleteObject(item);
          deletedCount++;
        }
      }
    } catch (error) {
      // Jobs folder missing or inaccessible
    }
    
    // Check accommodations folder
    try {
      const accomsList = await listAll(accomsRef);
      for (const item of accomsList.items) {
        const downloadURL = await import('firebase/storage').then(({ getDownloadURL }) => getDownloadURL(item));
        
        if (!referencedImages.has(downloadURL)) {
          await deleteObject(item);
          deletedCount++;
        }
      }
    } catch (error) {
      // Accommodations folder missing or inaccessible
    }
    return { success: true, deletedCount };
    
  } catch (error) {
    console.error('Error during cleanup:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get storage usage statistics
 */
export const getStorageStats = async () => {
  try {
    const stats = {
      jobs: { count: 0, totalSize: 0 },
      accommodations: { count: 0, totalSize: 0 }
    };
    
    // Check jobs folder
    try {
      const jobsRef = ref(storage, 'jobs');
      const jobsList = await listAll(jobsRef);
      stats.jobs.count = jobsList.items.length;
    } catch (error) {
      // Jobs folder missing or inaccessible
    }
    
    // Check accommodations folder
    try {
      const accomsRef = ref(storage, 'accommodations');
      const accomsList = await listAll(accomsRef);
      stats.accommodations.count = accomsList.items.length;
    } catch (error) {
      // Accommodations folder missing or inaccessible
    }
    
    return stats;
  } catch (error) {
    console.error('Error getting storage stats:', error);
    return null;
  }
};