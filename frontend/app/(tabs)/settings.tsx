import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface PriceAlert {
  id: string;
  product_name: string;
  target_price: number;
  current_price?: number;
  is_active: boolean;
  triggered: boolean;
}

interface Settings {
  selected_supermarkets: string[];
  plz?: string;
}

export default function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [plz, setPlz] = useState('');
  const [showNewAlert, setShowNewAlert] = useState(false);
  const [newAlertProduct, setNewAlertProduct] = useState('');
  const [newAlertPrice, setNewAlertPrice] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [alertsRes, settingsRes] = await Promise.all([
        axios.get(`${API_URL}/api/alerts`),
        axios.get(`${API_URL}/api/settings`),
      ]);
      setAlerts(alertsRes.data);
      setSettings(settingsRes.data);
      setPlz(settingsRes.data.plz || '');
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const savePlz = async () => {
    if (!settings) return;

    try {
      await axios.put(`${API_URL}/api/settings`, {
        ...settings,
        plz,
      });
      Alert.alert('Gespeichert', 'PLZ wurde aktualisiert');
    } catch (error) {
      console.error('Error saving PLZ:', error);
    }
  };

  const createAlert = async () => {
    if (!newAlertProduct.trim() || !newAlertPrice) return;

    try {
      const response = await axios.post(`${API_URL}/api/alerts`, {
        product_name: newAlertProduct,
        target_price: parseFloat(newAlertPrice),
      });
      setAlerts([response.data, ...alerts]);
      setNewAlertProduct('');
      setNewAlertPrice('');
      setShowNewAlert(false);
    } catch (error) {
      console.error('Error creating alert:', error);
    }
  };

  const deleteAlert = async (alertId: string) => {
    Alert.alert('Alarm löschen', 'Möchten Sie diesen Preisalarm löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`${API_URL}/api/alerts/${alertId}`);
            setAlerts(alerts.filter((a) => a.id !== alertId));
          } catch (error) {
            console.error('Error deleting alert:', error);
          }
        },
      },
    ]);
  };

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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Einstellungen</Text>
        </View>

        <ScrollView style={styles.content}>
          {/* PLZ Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Standort</Text>
            <View style={styles.plzContainer}>
              <View style={styles.plzInputContainer}>
                <Ionicons name="location" size={20} color="#4CAF50" />
                <TextInput
                  style={styles.plzInput}
                  placeholder="PLZ eingeben"
                  placeholderTextColor="#888"
                  value={plz}
                  onChangeText={setPlz}
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
              <TouchableOpacity style={styles.saveButton} onPress={savePlz}>
                <Text style={styles.saveButtonText}>Speichern</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionDescription}>
              Geben Sie Ihre PLZ ein, um relevante Angebote in Ihrer Nähe zu finden.
            </Text>
          </View>

          {/* Price Alerts Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Preisalarme</Text>
              <TouchableOpacity
                onPress={() => setShowNewAlert(!showNewAlert)}
                style={styles.addAlertButton}
              >
                <Ionicons
                  name={showNewAlert ? 'close' : 'add'}
                  size={24}
                  color="#4CAF50"
                />
              </TouchableOpacity>
            </View>

            {showNewAlert && (
              <View style={styles.newAlertContainer}>
                <TextInput
                  style={styles.alertInput}
                  placeholder="Produkt (z.B. Butter)"
                  placeholderTextColor="#888"
                  value={newAlertProduct}
                  onChangeText={setNewAlertProduct}
                />
                <View style={styles.priceInputContainer}>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="Zielpreis"
                    placeholderTextColor="#888"
                    value={newAlertPrice}
                    onChangeText={setNewAlertPrice}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.euroSign}>\u20ac</Text>
                </View>
                <TouchableOpacity
                  style={styles.createAlertButton}
                  onPress={createAlert}
                >
                  <Text style={styles.createAlertButtonText}>Alarm erstellen</Text>
                </TouchableOpacity>
              </View>
            )}

            {alerts.length === 0 ? (
              <View style={styles.emptyAlerts}>
                <Ionicons name="notifications-off-outline" size={48} color="#444" />
                <Text style={styles.emptyAlertsText}>Keine Preisalarme</Text>
                <Text style={styles.emptyAlertsSubtext}>
                  Erstellen Sie einen Alarm, um benachrichtigt zu werden
                </Text>
              </View>
            ) : (
              alerts.map((alert) => (
                <View key={alert.id} style={styles.alertCard}>
                  <View style={styles.alertInfo}>
                    <View style={styles.alertHeader}>
                      <Ionicons
                        name={alert.triggered ? 'checkmark-circle' : 'notifications'}
                        size={20}
                        color={alert.triggered ? '#4CAF50' : '#888'}
                      />
                      <Text style={styles.alertProductName}>{alert.product_name}</Text>
                    </View>
                    <View style={styles.alertPrices}>
                      <Text style={styles.alertTargetPrice}>
                        Ziel: {alert.target_price.toFixed(2)} \u20ac
                      </Text>
                      {alert.current_price && (
                        <Text
                          style={[
                            styles.alertCurrentPrice,
                            alert.triggered && styles.alertTriggered,
                          ]}
                        >
                          Aktuell: {alert.current_price.toFixed(2)} \u20ac
                        </Text>
                      )}
                    </View>
                    {alert.triggered && (
                      <View style={styles.triggeredBadge}>
                        <Text style={styles.triggeredText}>Zielpreis erreicht!</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => deleteAlert(alert.id)}
                    style={styles.deleteAlertButton}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ff5252" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Über die App</Text>
            <View style={styles.aboutCard}>
              <Ionicons name="pricetag" size={32} color="#4CAF50" />
              <Text style={styles.appName}>Prospekt Preisvergleich</Text>
              <Text style={styles.appVersion}>Version 1.0.0</Text>
              <Text style={styles.appDescription}>
                Vergleichen Sie Preise aus Supermarkt-Prospekten und finden Sie die
                besten Angebote in Ihrer Nähe.
              </Text>
            </View>
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#888',
    marginTop: 8,
  },
  plzContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  plzInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  plzInput: {
    flex: 1,
    height: 48,
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  addAlertButton: {
    padding: 4,
  },
  newAlertContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  alertInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  priceInput: {
    flex: 1,
    height: 44,
    color: '#fff',
    fontSize: 16,
  },
  euroSign: {
    color: '#888',
    fontSize: 16,
  },
  createAlertButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  createAlertButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  emptyAlerts: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyAlertsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  emptyAlertsSubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  alertCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  alertInfo: {
    flex: 1,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertProductName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  alertPrices: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  alertTargetPrice: {
    fontSize: 14,
    color: '#888',
  },
  alertCurrentPrice: {
    fontSize: 14,
    color: '#888',
  },
  alertTriggered: {
    color: '#4CAF50',
  },
  triggeredBadge: {
    backgroundColor: '#1a5d1a',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  triggeredText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '500',
  },
  deleteAlertButton: {
    padding: 4,
  },
  aboutCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  appName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  appVersion: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  appDescription: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  bottomPadding: {
    height: 20,
  },
});
