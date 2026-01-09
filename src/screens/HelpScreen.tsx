import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Header from '../components/Header';
import { COLORS } from '../constants/colors';
import { SafeAreaView } from 'react-native-safe-area-context';

const faqData = {
  Orders: [
    {
      question: 'How to create a sale?',
      answer: 'Go to Sales → Tap Add Sale → Enter the required details → Save.',
    },

    {
      question: 'How to view all orders?',
      answer: 'Go to Orders → View All Orders.',
    },
  ],
  Printers: [
    {
      question: 'How to connect a printer?',
      answer: 'Go to Settings → Printer → Connect device.',
    },
    {
      question: 'How to troubleshoot printer issues?',
      answer: 'Check printer power, Bluetooth connection, and paper roll.',
    },
  ],
  Inventory: [
    {
      question: 'How to manage inventory?',
      answer: 'Go to Items → Add, Edit, or Delete inventory items.',
    },
    {
      question: 'How to check stock levels?',
      answer: 'Go to Home → tap the alert message → open Item List → select an item to view stock levels.',
    },

  ],
} as const;

type FAQCategory = keyof typeof faqData;

const HelpScreen = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState<string | null>(null);

  const openEmail = () => {
    Linking.openURL('mailto:svjtechnologies01@gmail.com');
  };

  const openWebsite = () => {
    Linking.openURL('https://svjtechnologies.com/');
  };

  const filteredFaQs = (Object.keys(faqData) as FAQCategory[]).reduce((acc: any, category) => {
    const questions = faqData[category];
    const filtered = questions.filter((item: any) =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (filtered.length) acc[category] = filtered;
    return acc;
  }, {});

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header
        title="Help & Support"
        subtitle="We’re here to help you"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} >
        <TextInput
          style={styles.search}
          placeholder="Search help topics..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9CA3AF"
        />

        {Object.keys(filteredFaQs).length ? (
          Object.keys(filteredFaQs).map(category => (
            <View key={category}>
              <Text style={styles.sectionTitle}>{category}</Text>

              {filteredFaQs[category].map((item: any, index: any) => {
                const key = `${category}-${index}`;
                const isOpen = activeIndex === key;

                return (
                  <View key={key} style={styles.card}>
                    <TouchableOpacity
                      style={styles.questionRow}
                      onPress={() => setActiveIndex(isOpen ? null : key)}
                    >
                      <Text style={styles.question}>{item.question}</Text>
                      <Text style={styles.icon}>{isOpen ? '−' : '+'}</Text>
                    </TouchableOpacity>

                    {isOpen && (
                      <View style={styles.answerBox}>
                        <Text style={styles.answer}>{item.answer}</Text>

                        <View style={styles.feedback}>
                          <Text style={styles.feedbackText}>
                            Was this helpful?
                          </Text>

                          <TouchableOpacity style={styles.yesBtn}>
                            <Text style={styles.yesText}>👍 Yes</Text>
                          </TouchableOpacity>

                          <TouchableOpacity style={styles.noBtn}>
                            <Text style={styles.noText}>👎 No</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))
        ) : (
          <Text style={styles.noResult}>No results found</Text>
        )}

        <Text style={styles.sectionTitle}>Contact Support</Text>

        <TouchableOpacity style={styles.contactBtn} onPress={openEmail}>
          <Text style={styles.contactText}>📧 Email Support</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.contactBtn} onPress={openWebsite}>
          <Text style={styles.contactText}>🌐 Visit Support Website</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Legal Information</Text>

        <TouchableOpacity
          style={styles.legalBtn}
          onPress={() => (navigation as any).navigate('LegalScreen', { type: 'privacy' })}
        >
          <Text style={styles.legalText}>📄 Privacy Policy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.legalBtn}
          onPress={() => (navigation as any).navigate('LegalScreen', { type: 'terms' })}
        >
          <Text style={styles.legalText}>⚖️ Terms & Conditions</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default HelpScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7FB',
  },
  content: {
    padding: 16,
    paddingBottom: 60,
  },
  search: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    fontSize: 16,
    color: '#111827',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 20,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  questionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
  },
  question: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600',
    flex: 1,
  },
  icon: {
    fontSize: 20,
    color: COLORS.primary,
    marginLeft: 10,
  },
  answerBox: {
    backgroundColor: '#F1F5F9',
    padding: 14,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  answer: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  feedbackText: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 10,
  },
  yesBtn: {
    marginRight: 12,
  },
  yesText: {
    color: '#16A34A',
    fontWeight: '600',
  },
  noBtn: {},
  noText: {
    color: '#DC2626',
    fontWeight: '600',
  },
  contactBtn: {
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: 10,
    marginTop: 12,
  },
  contactText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  legalBtn: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  legalText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  noResult: {
    marginTop: 20,
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 16,
  },
});
