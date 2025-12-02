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
  Modal,
  Linking,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Supermarket {
  id: string;
  name: string;
  logo_url?: string;
  prospekt_url: string;
  is_active: boolean;
}

interface Product {
  id: string;
  name: string;
  manufacturer?: string;
  price: number;
  original_price?: number;
  category: string;
  supermarket_id: string;
  supermarket_name: string;
  supermarket_logo?: string;
  prospekt_url?: string;
  product_url?: string;
  unit?: string;
  price_per_unit?: string;
  valid_from?: string;
  valid_until?: string;
  week_label?: string;
  is_real_data?: boolean;
}

interface ScrapeError {
  id: string;
  supermarket_id: string;
  supermarket_name: string;
  prospekt_url: string;
  error_message: string;
  timestamp: string;
  http_status?: number;
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
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
  const [scrapeErrors, setScrapeErrors] = useState<ScrapeError[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Alle');
  const [selectedSupermarket, setSelectedSupermarket] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showSupermarketPicker, setShowSupermarketPicker] = useState(false);
  const [supermarketOffers, setSupermarketOffers] = useState<any>(null);
  const [showErrorsModal, setShowErrorsModal] = useState(false);

  const fetchSupermarkets = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/supermarkets`);
      setSupermarkets(response.data.filter((sm: Supermarket) => sm.is_active));
    } catch (error) {
      console.error('Error fetching supermarkets:', error);
    }
  };

  const fetchScrapeErrors = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/scrape-errors`);
      setScrapeErrors(response.data);
    } catch (error) {
      console.error('Error fetching scrape errors:', error);
    }
  };

  const fetchProducts = useCallback(async () => {
    try {
      let url = `${API_URL}/api/products?limit=50&include_next_week=true`;
      if (selectedCategory !== 'Alle') {
        url += `&category=${encodeURIComponent(selectedCategory)}`;
      }
      if (selectedSupermarket) {
        url += `&supermarket_id=${selectedSupermarket}`;
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
  }, [selectedCategory, selectedSupermarket, searchQuery]);

  const fetchSupermarketOffers = async (supermarketId: string) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/products/by-supermarket/${supermarketId}?include_next_week=true`);
      setSupermarketOffers(response.data);
      // Also fetch errors for this supermarket
      const errorsResponse = await axios.get(`${API_URL}/api/scrape-errors/${supermarketId}`);
      if (errorsResponse.data.length > 0) {
        setScrapeErrors(errorsResponse.data);
      }
    } catch (error) {
      console.error('Error fetching supermarket offers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupermarkets();
    fetchScrapeErrors();
  }, []);

  useEffect(() => {
    if (selectedSupermarket && !supermarketOffers) {
      fetchSupermarketOffers(selectedSupermarket);
    } else if (!selectedSupermarket) {
      setSupermarketOffers(null);
      fetchProducts();
    }
  }, [selectedSupermarket]);

  useEffect(() => {
    if (!selectedSupermarket) {
      fetchProducts();
    }
  }, [fetchProducts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (selectedSupermarket) {
      fetchSupermarketOffers(selectedSupermarket);
    } else {
      fetchProducts();
    }
    fetchScrapeErrors();
  }, [selectedSupermarket, fetchProducts]);

  const triggerScan = async () => {
    try {
      setScanning(true);
      setLoading(true);
      await axios.post(`${API_URL}/api/scan`, { force_refresh: true });
      // Wait for scraping to complete (it takes time)
      setTimeout(async () => {
        await fetchScrapeErrors();
        if (selectedSupermarket) {
          await fetchSupermarketOffers(selectedSupermarket);
        } else {
          await fetchProducts();
        }
        setScanning(false);
        // Show errors modal if there are errors
        const errorsRes = await axios.get(`${API_URL}/api/scrape-errors`);
        if (errorsRes.data.length > 0) {
          setScrapeErrors(errorsRes.data);
          setShowErrorsModal(true);
        }
      }, 5000); // Give more time for web scraping
    } catch (error) {
      console.error('Error triggering scan:', error);
      setLoading(false);
      setScanning(false);
    }
  };

  const openProspekt = (url: string) => {
    Linking.openURL(url).catch((err) => console.error('Error opening URL:', err));
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('de-DE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSelectedSupermarketName = () => {
    if (!selectedSupermarket) return 'Alle Supermärkte';
    const sm = supermarkets.find(s => s.id === selectedSupermarket);
    return sm?.name || 'Alle Supermärkte';
  };

  const renderProduct = (product: Product) => (
    <TouchableOpacity
      key={product.id}
      style={styles.productCard}
      onPress={() => setSelectedProduct(product)}
      activeOpacity={0.7}
    >
      <View style={styles.productInfo}>
        <View style={styles.productHeader}>
          {/* Full product name with manufacturer */}
          <Text style={styles.productName} numberOfLines={2}>
            {product.manufacturer ? `${product.manufacturer} ` : ''}{product.name}
          </Text>
          {product.week_label && (
            <View style={[
              styles.weekBadge,
              product.week_label === 'Nächste Woche' && styles.weekBadgeNext
            ]}>
              <Text style={styles.weekBadgeText}>{product.week_label}</Text>
            </View>
          )}
        </View>
        {/* Grundpreis / Base price */}
        {product.price_per_unit && (
          <Text style={styles.basePriceText}>{product.price_per_unit}</Text>
        )}
        {/* Link to supermarket offer */}
        <TouchableOpacity 
          style={styles.supermarketRow}
          onPress={() => {
            const url = product.product_url || product.prospekt_url;
            if (url) openProspekt(url);
          }}
        >
          <Ionicons name="storefront" size={14} color="#4CAF50" />
          <Text style={styles.supermarketName}>{product.supermarket_name}</Text>
          <Ionicons name="open-outline" size={12} color="#4CAF50" />
          <Text style={styles.linkText}>Zum Angebot</Text>
        </TouchableOpacity>
        {product.valid_from && product.valid_until && (
          <Text style={styles.validityText}>
            Gültig: {formatDate(product.valid_from)} - {formatDate(product.valid_until)}
          </Text>
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
    </TouchableOpacity>
  );

  // Scrape Errors Modal
  const renderErrorsModal = () => (
    <Modal
      visible={showErrorsModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowErrorsModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.errorsModalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.errorHeaderRow}>
              <Ionicons name="warning" size={24} color="#FF9800" />
              <Text style={styles.errorModalTitle}>Daten konnten nicht gelesen werden</Text>
            </View>
            <TouchableOpacity onPress={() => setShowErrorsModal(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.errorsContainer}>
            <Text style={styles.errorInfoText}>
              Folgende Websites konnten nicht ausgelesen werden. Die meisten Supermärkte verwenden 
              JavaScript-Rendering oder blockieren automatisches Auslesen.
            </Text>
            
            {scrapeErrors.map((error) => (
              <View key={error.id} style={styles.errorCard}>
                <View style={styles.errorCardHeader}>
                  <Ionicons name="storefront" size={20} color="#FF9800" />
                  <Text style={styles.errorSupermarketName}>{error.supermarket_name}</Text>
                </View>
                
                <Text style={styles.errorMessage}>{error.error_message}</Text>
                
                <TouchableOpacity
                  style={styles.errorLinkRow}
                  onPress={() => openProspekt(error.prospekt_url)}
                >
                  <Ionicons name="link" size={16} color="#2196F3" />
                  <Text style={styles.errorLink} numberOfLines={1}>
                    {error.prospekt_url}
                  </Text>
                  <Ionicons name="open-outline" size={14} color="#2196F3" />
                </TouchableOpacity>
                
                <Text style={styles.errorTimestamp}>
                  Zeitpunkt: {formatTimestamp(error.timestamp)}
                </Text>
                
                {error.http_status && (
                  <Text style={styles.errorHttpStatus}>
                    HTTP Status: {error.http_status}
                  </Text>
                )}
              </View>
            ))}
          </ScrollView>
          
          <TouchableOpacity
            style={styles.closeErrorsButton}
            onPress={() => setShowErrorsModal(false)}
          >
            <Text style={styles.closeErrorsButtonText}>Schließen</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Product Detail Modal
  const renderProductModal = () => (
    <Modal
      visible={!!selectedProduct}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setSelectedProduct(null)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Produktdetails</Text>
            <TouchableOpacity onPress={() => setSelectedProduct(null)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {selectedProduct && (
            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalProductName}>{selectedProduct.name}</Text>
              
              <View style={styles.modalPriceRow}>
                {selectedProduct.original_price && (
                  <Text style={styles.modalOriginalPrice}>
                    {selectedProduct.original_price.toFixed(2)} €
                  </Text>
                )}
                <Text style={styles.modalPrice}>
                  {selectedProduct.price.toFixed(2)} €
                </Text>
                {selectedProduct.original_price && (
                  <View style={styles.modalDiscountBadge}>
                    <Text style={styles.modalDiscountText}>
                      -{Math.round((1 - selectedProduct.price / selectedProduct.original_price) * 100)}%
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Quelle</Text>
                <View style={styles.sourceCard}>
                  <Ionicons name="storefront" size={24} color="#4CAF50" />
                  <View style={styles.sourceInfo}>
                    <Text style={styles.sourceName}>{selectedProduct.supermarket_name}</Text>
                    <Text style={styles.sourceCategory}>{selectedProduct.category}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Gültigkeit</Text>
                <View style={styles.validityCard}>
                  <Ionicons name="calendar" size={20} color="#888" />
                  <Text style={styles.validityInfo}>
                    {formatDate(selectedProduct.valid_from)} - {formatDate(selectedProduct.valid_until)}
                  </Text>
                  {selectedProduct.week_label && (
                    <View style={[
                      styles.weekBadgeLarge,
                      selectedProduct.week_label === 'Nächste Woche' && styles.weekBadgeNextLarge
                    ]}>
                      <Text style={styles.weekBadgeTextLarge}>{selectedProduct.week_label}</Text>
                    </View>
                  )}
                </View>
              </View>

              {selectedProduct.prospekt_url && (
                <TouchableOpacity
                  style={styles.prospektButton}
                  onPress={() => openProspekt(selectedProduct.prospekt_url!)}
                >
                  <Ionicons name="document-text" size={20} color="#fff" />
                  <Text style={styles.prospektButtonText}>Original-Prospekt öffnen</Text>
                  <Ionicons name="open-outline" size={18} color="#fff" />
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  // Supermarket Picker Modal
  const renderSupermarketPicker = () => (
    <Modal
      visible={showSupermarketPicker}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowSupermarketPicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.pickerContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Supermarkt wählen</Text>
            <TouchableOpacity onPress={() => setShowSupermarketPicker(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.pickerList}>
            <TouchableOpacity
              style={[
                styles.pickerItem,
                !selectedSupermarket && styles.pickerItemActive
              ]}
              onPress={() => {
                setSelectedSupermarket(null);
                setSupermarketOffers(null);
                setShowSupermarketPicker(false);
              }}
            >
              <Ionicons name="apps" size={24} color={!selectedSupermarket ? "#4CAF50" : "#888"} />
              <Text style={[
                styles.pickerItemText,
                !selectedSupermarket && styles.pickerItemTextActive
              ]}>Alle Supermärkte</Text>
              {!selectedSupermarket && <Ionicons name="checkmark" size={24} color="#4CAF50" />}
            </TouchableOpacity>
            
            {supermarkets.map((sm) => (
              <TouchableOpacity
                key={sm.id}
                style={[
                  styles.pickerItem,
                  selectedSupermarket === sm.id && styles.pickerItemActive
                ]}
                onPress={() => {
                  setSelectedSupermarket(sm.id);
                  setShowSupermarketPicker(false);
                  fetchSupermarketOffers(sm.id);
                }}
              >
                <Ionicons 
                  name="storefront" 
                  size={24} 
                  color={selectedSupermarket === sm.id ? "#4CAF50" : "#888"} 
                />
                <Text style={[
                  styles.pickerItemText,
                  selectedSupermarket === sm.id && styles.pickerItemTextActive
                ]}>{sm.name}</Text>
                {selectedSupermarket === sm.id && <Ionicons name="checkmark" size={24} color="#4CAF50" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Render supermarket-specific view
  const renderSupermarketView = () => {
    if (!supermarketOffers) return null;

    return (
      <ScrollView
        style={styles.productsContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4CAF50" />
        }
      >
        <View style={styles.supermarketHeader}>
          <View style={styles.supermarketInfoCard}>
            <Ionicons name="storefront" size={32} color="#4CAF50" />
            <View style={styles.supermarketHeaderInfo}>
              <Text style={styles.supermarketHeaderName}>{supermarketOffers.supermarket.name}</Text>
              <Text style={styles.supermarketHeaderOffers}>
                {supermarketOffers.total_offers} Angebote verfügbar
              </Text>
            </View>
          </View>
          {supermarketOffers.supermarket.prospekt_url && (
            <TouchableOpacity
              style={styles.viewProspektButton}
              onPress={() => openProspekt(supermarketOffers.supermarket.prospekt_url)}
            >
              <Ionicons name="document-text" size={18} color="#4CAF50" />
              <Text style={styles.viewProspektText}>Prospekt</Text>
            </TouchableOpacity>
          )}
        </View>

        {supermarketOffers.this_week.length > 0 && (
          <>
            <Text style={styles.weekSectionTitle}>Diese Woche ({supermarketOffers.this_week.length})</Text>
            {supermarketOffers.this_week.map((product: Product) => renderProduct(product))}
          </>
        )}

        {supermarketOffers.next_week.length > 0 && (
          <>
            <Text style={[styles.weekSectionTitle, styles.nextWeekTitle]}>
              Nächste Woche ({supermarketOffers.next_week.length})
            </Text>
            {supermarketOffers.next_week.map((product: Product) => renderProduct(product))}
          </>
        )}
        
        <View style={styles.bottomPadding} />
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Prospekt Preisvergleich</Text>
        <TouchableOpacity onPress={triggerScan} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      {/* Supermarket Filter Button */}
      <TouchableOpacity 
        style={styles.supermarketFilter}
        onPress={() => setShowSupermarketPicker(true)}
      >
        <Ionicons name="storefront" size={20} color="#4CAF50" />
        <Text style={styles.supermarketFilterText}>{getSelectedSupermarketName()}</Text>
        <Ionicons name="chevron-down" size={20} color="#888" />
      </TouchableOpacity>

      {!selectedSupermarket && (
        <>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Produkt suchen..."
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => fetchProducts()}
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
        </>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Lade Angebote...</Text>
        </View>
      ) : selectedSupermarket && supermarketOffers ? (
        renderSupermarketView()
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

      {renderProductModal()}
      {renderSupermarketPicker()}
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
  supermarketFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  supermarketFilterText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
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
  productHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flexWrap: 'wrap',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  weekBadge: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  weekBadgeNext: {
    backgroundColor: '#FF9800',
  },
  weekBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  supermarketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  supermarketName: {
    fontSize: 13,
    color: '#4CAF50',
    marginRight: 4,
  },
  validityText: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  pickerContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  modalBody: {
    padding: 20,
  },
  modalProductName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  modalPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  modalOriginalPrice: {
    fontSize: 18,
    color: '#888',
    textDecorationLine: 'line-through',
  },
  modalPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  modalDiscountBadge: {
    backgroundColor: '#ff5252',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modalDiscountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  sourceInfo: {
    flex: 1,
  },
  sourceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  sourceCategory: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  validityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  validityInfo: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
  },
  weekBadgeLarge: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  weekBadgeNextLarge: {
    backgroundColor: '#FF9800',
  },
  weekBadgeTextLarge: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  prospektButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 10,
  },
  prospektButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Picker styles
  pickerList: {
    padding: 16,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#252525',
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  pickerItemActive: {
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  pickerItemText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  pickerItemTextActive: {
    color: '#4CAF50',
  },
  // Supermarket view styles
  supermarketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  supermarketInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  supermarketHeaderInfo: {
    gap: 2,
  },
  supermarketHeaderName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  supermarketHeaderOffers: {
    fontSize: 13,
    color: '#888',
  },
  viewProspektButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a3d1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  viewProspektText: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '500',
  },
  weekSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
    marginBottom: 12,
    marginTop: 8,
  },
  nextWeekTitle: {
    color: '#FF9800',
    marginTop: 24,
  },
});
