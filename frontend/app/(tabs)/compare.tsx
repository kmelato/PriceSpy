import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface CompareResult {
  name: string;
  price: number;
  original_price?: number;
  supermarket_name: string;
  supermarket_id: string;
}

export default function CompareScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<CompareResult[]>([]);
  const [cheapest, setCheapest] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const response = await axios.get(
        `${API_URL}/api/products/compare?search=${encodeURIComponent(searchQuery)}`
      );
      setResults(response.data.results || []);
      setCheapest(response.data.cheapest);
    } catch (error) {
      console.error('Error comparing products:', error);
      setResults([]);
      setCheapest(null);
    } finally {
      setLoading(false);
    }
  };

  const calculateSavings = (price: number) => {
    if (!cheapest || results.length < 2) return 0;
    const highest = Math.max(...results.map((r) => r.price));
    return highest - price;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Preisvergleich</Text>
          <Text style={styles.subtitle}>
            Vergleichen Sie Preise für das gleiche Produkt
          </Text>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="z.B. Butter, Milch, Äpfel..."
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Suchen</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Suche Angebote...</Text>
          </View>
        ) : (
          <ScrollView style={styles.resultsContainer}>
            {!hasSearched ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="analytics-outline" size={64} color="#444" />
                <Text style={styles.emptyText}>Produkt eingeben</Text>
                <Text style={styles.emptySubtext}>
                  Geben Sie einen Produktnamen ein, um Preise bei verschiedenen
                  Supermärkten zu vergleichen
                </Text>
              </View>
            ) : results.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={64} color="#444" />
                <Text style={styles.emptyText}>Keine Ergebnisse</Text>
                <Text style={styles.emptySubtext}>
                  Versuchen Sie einen anderen Suchbegriff
                </Text>
              </View>
            ) : (
              <>
                {cheapest && (
                  <View style={styles.cheapestCard}>
                    <View style={styles.cheapestBadge}>
                      <Ionicons name="trophy" size={16} color="#fff" />
                      <Text style={styles.cheapestBadgeText}>Günstigster Preis</Text>
                    </View>
                    <Text style={styles.cheapestName}>{cheapest.name}</Text>
                    <Text style={styles.cheapestSupermarket}>
                      {cheapest.supermarket_name}
                    </Text>
                    <Text style={styles.cheapestPrice}>
                      {cheapest.price.toFixed(2)} \u20ac
                    </Text>
                    {results.length > 1 && (
                      <Text style={styles.savingsText}>
                        Sie sparen bis zu{' '}
                        {(Math.max(...results.map((r) => r.price)) - cheapest.price).toFixed(2)} \u20ac
                      </Text>
                    )}
                  </View>
                )}

                <Text style={styles.resultsSectionTitle}>
                  Alle Angebote ({results.length})
                </Text>

                {results.map((result, index) => (
                  <View
                    key={`${result.supermarket_id}-${index}`}
                    style={[
                      styles.resultCard,
                      index === 0 && styles.resultCardBest,
                    ]}
                  >
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultName} numberOfLines={2}>
                        {result.name}
                      </Text>
                      <Text style={styles.resultSupermarket}>
                        {result.supermarket_name}
                      </Text>
                    </View>
                    <View style={styles.resultPriceContainer}>
                      {result.original_price && (
                        <Text style={styles.resultOriginalPrice}>
                          {result.original_price.toFixed(2)} \u20ac
                        </Text>
                      )}
                      <Text
                        style={[
                          styles.resultPrice,
                          index === 0 && styles.resultPriceBest,
                        ]}
                      >
                        {result.price.toFixed(2)} \u20ac
                      </Text>
                      {index === 0 && (
                        <View style={styles.bestBadge}>
                          <Text style={styles.bestBadgeText}>BEST</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
                <View style={styles.bottomPadding} />
              </>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  flex: {
    flex: 1,
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
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: '#fff',
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
    fontSize: 16,
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  cheapestCard: {
    backgroundColor: '#1a3d1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  cheapestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
    gap: 6,
  },
  cheapestBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cheapestName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  cheapestSupermarket: {
    fontSize: 14,
    color: '#4CAF50',
    marginBottom: 8,
  },
  cheapestPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  savingsText: {
    fontSize: 14,
    color: '#8BC34A',
    marginTop: 8,
  },
  resultsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  resultCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  resultCardBest: {
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 4,
  },
  resultSupermarket: {
    fontSize: 13,
    color: '#888',
  },
  resultPriceContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  resultOriginalPrice: {
    fontSize: 12,
    color: '#888',
    textDecorationLine: 'line-through',
  },
  resultPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  resultPriceBest: {
    color: '#4CAF50',
  },
  bestBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  bestBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  bottomPadding: {
    height: 20,
  },
});
