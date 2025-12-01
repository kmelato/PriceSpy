import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Supermarket {
  id: string;
  name: string;
  logo_url?: string;
  website_url: string;
  prospekt_url: string;
  is_active: boolean;
}

export default function SupermarketsScreen() {
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSupermarkets = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/supermarkets`);
      setSupermarkets(response.data);
    } catch (error) {
      console.error('Error fetching supermarkets:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSupermarkets();
  }, [fetchSupermarkets]);

  const toggleSupermarket = async (supermarketId: string) => {
    try {
      const response = await axios.put(
        `${API_URL}/api/supermarkets/${supermarketId}/toggle`
      );
      setSupermarkets(
        supermarkets.map((sm) =>
          sm.id === supermarketId ? { ...sm, is_active: response.data.is_active } : sm
        )
      );
    } catch (error) {
      console.error('Error toggling supermarket:', error);
    }
  };

  const activeCount = supermarkets.filter((sm) => sm.is_active).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Supermärkte</Text>
        <Text style={styles.subtitle}>
          Wählen Sie die Märkte für den Preisvergleich
        </Text>
      </View>

      <View style={styles.statsCard}>
        <Ionicons name="storefront" size={24} color="#4CAF50" />
        <Text style={styles.statsText}>
          {activeCount} von {supermarkets.length} Märkten aktiv
        </Text>
      </View>

      <ScrollView style={styles.listContainer}>
        {supermarkets.map((supermarket) => (
          <View key={supermarket.id} style={styles.supermarketCard}>
            <View style={styles.supermarketInfo}>
              <View style={styles.logoContainer}>
                <Ionicons name="storefront" size={24} color="#4CAF50" />
              </View>
              <View style={styles.supermarketDetails}>
                <Text style={styles.supermarketName}>{supermarket.name}</Text>
                <Text style={styles.supermarketUrl} numberOfLines={1}>
                  {supermarket.website_url}
                </Text>
              </View>
            </View>
            <Switch
              value={supermarket.is_active}
              onValueChange={() => toggleSupermarket(supermarket.id)}
              trackColor={{ false: '#333', true: '#1a5d1a' }}
              thumbColor={supermarket.is_active ? '#4CAF50' : '#888'}
            />
          </View>
        ))}

        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={24} color="#888" />
          <Text style={styles.infoText}>
            Aktivieren Sie die Supermärkte, deren Prospekte für den Preisvergleich
            berücksichtigt werden sollen.
          </Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a3d1a',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  statsText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '500',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  supermarketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  supermarketInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoContainer: {
    width: 48,
    height: 48,
    backgroundColor: '#2a2a2a',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  supermarketDetails: {
    flex: 1,
  },
  supermarketName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  supermarketUrl: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    gap: 12,
  },
  infoText: {
    flex: 1,
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
  },
  bottomPadding: {
    height: 20,
  },
});
