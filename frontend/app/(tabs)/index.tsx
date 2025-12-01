import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Product {
  id: string;
  name: string;
  price: number;
  original_price?: number;
  category: string;
  supermarket_id: string;
  supermarket_name: string;
  unit?: string;
  price_per_unit?: string;
}

const CATEGORIES = [
  { name: 'Alle', icon: 'apps' },
  { name: 'Obst & Gemüse', icon: 'nutrition' },
  { name: 'Fleisch & Wurst', icon: 'restaurant' },
  { name: 'Milchprodukte', icon: 'water' },
  { name: 'Brot & Backwaren', icon: 'pizza' },
  { name: 'Getränke', icon: 'beer' },
  { name: 'Süßigkeiten & Snacks', icon: 'ice-cream' },
  { name: 'Tiefkühl', icon: 'snow' },
  { name: 'Haushalt', icon: 'home' },
  { name: 'Drogerie', icon: 'medkit' },
];

export default function HomeScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Alle');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchProducts = useCallback(async () => {
    try {
      let url = `${API_URL}/api/products?limit=50`;
      if (selectedCategory !== 'Alle') {
        url += `&category=${encodeURIComponent(selectedCategory)}`;
      }
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }
      const response = await axios.get(url);
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProducts();
  }, [fetchProducts]);

  const triggerScan = async () => {
    try {
      setLoading(true);
      await axios.post(`${API_URL}/api/scan`, { force_refresh: true });
      // Wait a bit for background task to complete
      setTimeout(() => {
        fetchProducts();
      }, 2000);
    } catch (error) {
      console.error('Error triggering scan:', error);
      setLoading(false);
    }
  };

  const renderProduct = (product: Product) => (
    <View key={product.id} style={styles.productCard}>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.supermarketName}>{product.supermarket_name}</Text>
        {product.unit && (
          <Text style={styles.productUnit}>{product.unit}</Text>
        )}
      </View>
      <View style={styles.priceContainer}>
        {product.original_price && (
          <Text style={styles.originalPrice}>
            {product.original_price.toFixed(2)} €
          </Text>
        )}
        <Text style={styles.price}>{product.price.toFixed(2)} €</Text>
        {product.original_price && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>
              -{Math.round((1 - product.price / product.original_price) * 100)}%
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Prospekt Preisvergleich</Text>
        <TouchableOpacity onPress={triggerScan} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Produkt suchen..."
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={fetchProducts}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.name}
            style={[
              styles.categoryChip,
              selectedCategory === cat.name && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(cat.name)}
          >
            <Ionicons
              name={cat.icon as any}
              size={16}
              color={selectedCategory === cat.name ? '#fff' : '#888'}
            />
            <Text
              style={[
                styles.categoryText,
                selectedCategory === cat.name && styles.categoryTextActive,
              ]}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Lade Angebote...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.productsContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4CAF50" />
          }
        >
          {products.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cart-outline" size={64} color="#444" />
              <Text style={styles.emptyText}>Keine Angebote gefunden</Text>
              <Text style={styles.emptySubtext}>
                Tippen Sie auf Aktualisieren, um Prospekte zu laden
              </Text>
              <TouchableOpacity style={styles.scanButton} onPress={triggerScan}>
                <Ionicons name="scan" size={20} color="#fff" />
                <Text style={styles.scanButtonText}>Prospekte laden</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.resultCount}>
                {products.length} Angebote gefunden
              </Text>
              {products.map(renderProduct)}
              <View style={styles.bottomPadding} />
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  refreshButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: '#fff',
    fontSize: 16,
  },
  categoriesContainer: {
    maxHeight: 50,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: '#4CAF50',
  },
  categoryText: {
    color: '#888',
    fontSize: 13,
  },
  categoryTextActive: {
    color: '#fff',
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
  productsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  resultCount: {
    color: '#888',
    fontSize: 14,
    marginBottom: 12,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  supermarketName: {
    fontSize: 13,
    color: '#4CAF50',
    marginBottom: 2,
  },
  productUnit: {
    fontSize: 12,
    color: '#888',
  },
  priceContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  originalPrice: {
    fontSize: 12,
    color: '#888',
    textDecorationLine: 'line-through',
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  discountBadge: {
    backgroundColor: '#ff5252',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  discountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
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
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 20,
  },
});
