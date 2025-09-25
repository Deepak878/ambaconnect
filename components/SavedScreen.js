import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { shared, Colors } from './Theme';
import { db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
const placeholder = require('../assets/icon.png');

const SavedScreen = React.memo(({ user, onOpen, onSave }) => {
  const [savedItems, setSavedItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleItemPress = useCallback((item) => {
    if (onOpen) {
      onOpen(item);
    }
  }, [onOpen]);

  const handleSavePress = useCallback((item) => {
    if (onSave) {
      onSave(item);
    }
  }, [onSave]);

  useEffect(() => {
    let unsubscribe = null;
    
    if (!user || !user.id) {
      setSavedItems([]);
      setLoading(false);
      return;
    }

    const fetchSavedItems = () => {
      setLoading(true);
      const userPhone = user.phone ? ('' + user.phone).replace(/[^0-9]/g, '') : user.id;
      const q = query(collection(db, 'saved'), where('userPhone', '==', userPhone));
      
      unsubscribe = onSnapshot(q, async (snapshot) => {
        try {
          const savedDocs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          // Fetch the complete job/accommodation data for each saved item
          const completeItems = await Promise.all(
            savedDocs.map(async (savedDoc) => {
              try {
                const { jobId, kind } = savedDoc;
                const collectionName = kind === 'accommodation' ? 'accommodations' : 'jobs';
                
                // Try to get the complete document from the appropriate collection
                const docRef = doc(db, collectionName, jobId);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                  return {
                    id: jobId,
                    ...docSnap.data(),
                    savedAt: savedDoc.createdAt
                  };
                } else {
                  // If document doesn't exist in Firestore, return basic info from saved doc
                  return {
                    id: jobId,
                    title: savedDoc.title || 'Saved Item',
                    kind: kind,
                    type: kind === 'accommodation' ? 'Accommodation' : 'Job',
                    location: 'Location not available',
                    savedAt: savedDoc.createdAt
                  };
                }
              } catch (error) {
                console.warn('Error fetching saved item details:', error);
                return null;
              }
            })
          );

          // Filter out any null items and set the state
          setSavedItems(completeItems.filter(Boolean));
        } catch (error) {
          console.error('Error processing saved items:', error);
        } finally {
          setLoading(false);
        }
      }, (error) => {
        console.error('Error listening to saved items:', error);
        setLoading(false);
      });
    };

    fetchSavedItems();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.id, user?.phone]); // Only depend on user.id and user.phone

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ color: Colors.muted, marginTop: 10 }}>Loading saved items...</Text>
      </View>
    );
  }

  if (!user || !user.id) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.muted }}>Please sign in to view saved items.</Text>
      </View>
    );
  }

  if (!savedItems || savedItems.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.muted }}>No saved items yet.</Text>
        <Text style={{ color: Colors.muted, marginTop: 5 }}>Save jobs and accommodations to see them here.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={savedItems}
      keyExtractor={item => item.id}
      contentContainerStyle={{ padding: 12 }}
      renderItem={({ item }) => (
        <TouchableOpacity 
          key={item.id} 
          style={[shared.card, { flexDirection: 'row', alignItems: 'center', marginBottom: 10 }]} 
          onPress={() => handleItemPress(item)}
        >
          <Image 
            source={(item.images && item.images[0]) ? 
              (typeof item.images[0] === 'string' ? { uri: item.images[0] } : item.images[0]) : 
              placeholder
            } 
            style={{ width: 56, height: 56, borderRadius: 28, marginRight: 12 }} 
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700' }}>{item.title}</Text>
            <Text style={{ color: Colors.muted, marginTop: 4 }}>
              {item.kind === 'accommodation' ? (item.accomType || 'Accommodation') : (item.type || 'Job')} • {item.location}
            </Text>
            {item.price && (
              <Text style={{ color: Colors.primary, marginTop: 2, fontWeight: '600' }}>
                {item.currency || '$'}{item.price}
                {item.kind === 'accommodation' && item.duration ? `/${item.duration}` : ''}
              </Text>
            )}
          </View>
          {onSave && (
            <TouchableOpacity 
              onPress={() => handleSavePress(item)} 
              style={{ 
                padding: 8, 
                borderRadius: 8, 
                backgroundColor: Colors.card, 
                borderWidth: 1, 
                borderColor: Colors.primary 
              }}
            >
              <Text style={{ color: Colors.primary, fontWeight: '700' }}>Unsave</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      )}
    />
  );
});

export default SavedScreen;
