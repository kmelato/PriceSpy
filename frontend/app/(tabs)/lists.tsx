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

interface ShoppingListItem {
  product_name: string;
  quantity: number;
  checked: boolean;
  best_price?: number;
  best_supermarket?: string;
}

interface ShoppingList {
  id: string;
  name: string;
  items: ShoppingListItem[];
  plz?: string;
  created_at: string;
}

export default function ListsScreen() {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedList, setSelectedList] = useState<ShoppingList | null>(null);
  const [newListName, setNewListName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [showNewListInput, setShowNewListInput] = useState(false);

  const fetchLists = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/lists`);
      setLists(response.data);
    } catch (error) {
      console.error('Error fetching lists:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const createList = async () => {
    if (!newListName.trim()) return;

    try {
      const response = await axios.post(`${API_URL}/api/lists`, {
        name: newListName,
      });
      setLists([response.data, ...lists]);
      setNewListName('');
      setShowNewListInput(false);
      setSelectedList(response.data);
    } catch (error) {
      console.error('Error creating list:', error);
    }
  };

  const deleteList = async (listId: string) => {
    Alert.alert('Liste löschen', 'Möchten Sie diese Liste wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`${API_URL}/api/lists/${listId}`);
            setLists(lists.filter((l) => l.id !== listId));
            if (selectedList?.id === listId) {
              setSelectedList(null);
            }
          } catch (error) {
            console.error('Error deleting list:', error);
          }
        },
      },
    ]);
  };

  const addItem = async () => {
    if (!selectedList || !newItemName.trim()) return;

    try {
      const response = await axios.post(
        `${API_URL}/api/lists/${selectedList.id}/items`,
        { product_name: newItemName, quantity: 1 }
      );

      // Update local state
      const updatedList = {
        ...selectedList,
        items: [...selectedList.items, response.data.item],
      };
      setSelectedList(updatedList);
      setLists(lists.map((l) => (l.id === selectedList.id ? updatedList : l)));
      setNewItemName('');
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const toggleItem = async (itemIndex: number) => {
    if (!selectedList) return;

    try {
      await axios.put(
        `${API_URL}/api/lists/${selectedList.id}/items/${itemIndex}/toggle`
      );

      const updatedItems = [...selectedList.items];
      updatedItems[itemIndex].checked = !updatedItems[itemIndex].checked;
      const updatedList = { ...selectedList, items: updatedItems };
      setSelectedList(updatedList);
      setLists(lists.map((l) => (l.id === selectedList.id ? updatedList : l)));
    } catch (error) {
      console.error('Error toggling item:', error);
    }
  };

  const removeItem = async (itemIndex: number) => {
    if (!selectedList) return;

    try {
      await axios.delete(
        `${API_URL}/api/lists/${selectedList.id}/items/${itemIndex}`
      );

      const updatedItems = selectedList.items.filter((_, i) => i !== itemIndex);
      const updatedList = { ...selectedList, items: updatedItems };
      setSelectedList(updatedList);
      setLists(lists.map((l) => (l.id === selectedList.id ? updatedList : l)));
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };

  const calculateTotalSavings = () => {
    if (!selectedList) return 0;
    return selectedList.items.reduce((total, item) => {
      return total + (item.best_price || 0) * item.quantity;
    }, 0);
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

  if (selectedList) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setSelectedList(null)}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.title} numberOfLines={1}>
                {selectedList.name}
              </Text>
              <Text style={styles.subtitle}>
                {selectedList.items.length} Artikel
              </Text>
            </View>
          </View>

          <View style={styles.addItemContainer}>
            <TextInput
              style={styles.addItemInput}
              placeholder="Artikel hinzufügen..."
              placeholderTextColor="#888"
              value={newItemName}
              onChangeText={setNewItemName}
              onSubmitEditing={addItem}
            />
            <TouchableOpacity style={styles.addItemButton} onPress={addItem}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {selectedList.items.length > 0 && (
            <View style={styles.savingsCard}>
              <Ionicons name="wallet-outline" size={20} color="#4CAF50" />
              <Text style={styles.savingsText}>
                Geschätzter Gesamtpreis: {calculateTotalSavings().toFixed(2)} \u20ac
              </Text>
            </View>
          )}

          <ScrollView style={styles.itemsContainer}>
            {selectedList.items.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="basket-outline" size={64} color="#444" />
                <Text style={styles.emptyText}>Liste ist leer</Text>
                <Text style={styles.emptySubtext}>
                  Fügen Sie Artikel hinzu, um den besten Preis zu finden
                </Text>
              </View>
            ) : (
              selectedList.items.map((item, index) => (
                <View key={index} style={styles.itemCard}>
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => toggleItem(index)}
                  >
                    <Ionicons
                      name={item.checked ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={item.checked ? '#4CAF50' : '#888'}
                    />
                  </TouchableOpacity>
                  <View style={styles.itemInfo}>
                    <Text
                      style={[
                        styles.itemName,
                        item.checked && styles.itemNameChecked,
                      ]}
                    >
                      {item.product_name}
                    </Text>
                    {item.best_supermarket && (
                      <Text style={styles.itemBestPrice}>
                        {item.best_supermarket} - {item.best_price?.toFixed(2)} \u20ac
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => removeItem(index)}
                    style={styles.removeButton}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ff5252" />
                  </TouchableOpacity>
                </View>
              ))
            )}
            <View style={styles.bottomPadding} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Einkaufslisten</Text>
        <TouchableOpacity
          onPress={() => setShowNewListInput(true)}
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      {showNewListInput && (
        <View style={styles.newListContainer}>
          <TextInput
            style={styles.newListInput}
            placeholder="Name der Liste..."
            placeholderTextColor="#888"
            value={newListName}
            onChangeText={setNewListName}
            autoFocus
          />
          <TouchableOpacity style={styles.createButton} onPress={createList}>
            <Text style={styles.createButtonText}>Erstellen</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setShowNewListInput(false);
              setNewListName('');
            }}
            style={styles.cancelButton}
          >
            <Ionicons name="close" size={24} color="#888" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.listsContainer}>
        {lists.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="list-outline" size={64} color="#444" />
            <Text style={styles.emptyText}>Keine Listen</Text>
            <Text style={styles.emptySubtext}>
              Erstellen Sie eine neue Einkaufsliste
            </Text>
            <TouchableOpacity
              style={styles.createFirstButton}
              onPress={() => setShowNewListInput(true)}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.createFirstButtonText}>Neue Liste</Text>
            </TouchableOpacity>
          </View>
        ) : (
          lists.map((list) => (
            <TouchableOpacity
              key={list.id}
              style={styles.listCard}
              onPress={() => setSelectedList(list)}
            >
              <View style={styles.listInfo}>
                <Text style={styles.listName}>{list.name}</Text>
                <Text style={styles.listItemCount}>
                  {list.items.length} Artikel
                </Text>
              </View>
              <View style={styles.listActions}>
                <TouchableOpacity
                  onPress={() => deleteList(list.id)}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash-outline" size={20} color="#ff5252" />
                </TouchableOpacity>
                <Ionicons name="chevron-forward" size={24} color="#888" />
              </View>
            </TouchableOpacity>
          ))
        )}
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
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  addButton: {
    padding: 8,
  },
  newListContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  newListInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    color: '#fff',
    fontSize: 16,
  },
  createButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  cancelButton: {
    padding: 12,
    justifyContent: 'center',
  },
  listsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  listItemCount: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  listActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteButton: {
    padding: 4,
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
  },
  createFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  createFirstButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addItemContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  addItemInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    color: '#fff',
    fontSize: 16,
  },
  addItemButton: {
    backgroundColor: '#4CAF50',
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  savingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a3d1a',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  savingsText: {
    color: '#4CAF50',
    fontSize: 15,
    fontWeight: '500',
  },
  itemsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  checkbox: {
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    color: '#fff',
  },
  itemNameChecked: {
    color: '#888',
    textDecorationLine: 'line-through',
  },
  itemBestPrice: {
    fontSize: 13,
    color: '#4CAF50',
    marginTop: 4,
  },
  removeButton: {
    padding: 4,
  },
  bottomPadding: {
    height: 20,
  },
});
