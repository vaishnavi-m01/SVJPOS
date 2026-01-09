import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import Header from '../components/Header';
import { COLORS, SIZES, SHADOWS } from '../styles/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'LegalScreen'>;

const LegalScreen: React.FC<Props> = ({ route, navigation }) => {
    const { type } = route.params;
    const isPrivacy = type === 'privacy';

    const content = isPrivacy ? privacyPolicy : termsOfService;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Header
                title={isPrivacy ? 'Privacy Policy' : 'Terms & Conditions'}
                icon={isPrivacy ? 'shield-account' : 'scale-balance'}
                subtitle={isPrivacy ? 'How we handle your data' : 'Rules and guidelines'}
                onBack={() => navigation.goBack()}
            />
            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <View style={styles.card}>
                    <Text style={styles.lastUpdated}>Last Updated: January 06, 2026</Text>

                    {content.map((section, index) => (
                        <View key={index} style={styles.section}>
                            <Text style={styles.sectionTitle}>{section.title}</Text>
                            <Text style={styles.sectionText}>{section.text}</Text>
                        </View>
                    ))}

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            If you have any questions about this {isPrivacy ? 'Privacy Policy' : 'Terms & Conditions'}, please contact us at:
                        </Text>
                        <Text style={styles.contactEmail}>svjtechnologies01@gmail.com</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const privacyPolicy = [
    {
        title: '1. Information We Collect',
        text: 'We collect information you provide directly to us, such as when you create an account, update your profile, or use our POS services. This includes your name, email address, business details, and transaction data.',
    },
    {
        title: '2. How We Use Information',
        text: 'We use the information we collect to provide, maintain, and improve our services, to process transactions, and to communicate with you about your account and our services.',
    },
    {
        title: '3. Data Security',
        text: 'We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that no security measures are perfect or impenetrable.',
    },
    {
        title: '4. Third-Party Sharing',
        text: 'We do not sell your personal information. We may share information with third-party vendors who perform services for us, or when required by law to comply with legal obligations.',
    },
    {
        title: '5. Your Choices',
        text: 'You may update your account information at any time by logging into your account settings. You can also delete your account, which will permanently remove your data from our active databases.',
    },
];

const termsOfService = [
    {
        title: '1. Acceptance of Terms',
        text: 'By accessing or using SVJ POS, you agree to be bound by these Terms and Conditions. If you do not agree to all of these terms, do not use our services.',
    },
    {
        title: '2. User Accounts',
        text: 'You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use.',
    },
    {
        title: '3. Proper Use',
        text: 'You agree to use our services only for lawful purposes and in accordance with these Terms. You are responsible for ensuring that your use of the service complies with all local laws and regulations.',
    },
    {
        title: '4. Intellectual Property',
        text: 'All content, features, and functionality of SVJ POS are owned by SVJ Technologies and are protected by international copyright, trademark, and other intellectual property laws.',
    },
    {
        title: '5. Limitation of Liability',
        text: 'In no event shall SVJ Technologies be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the services.',
    },
];

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: SIZES.large,
        paddingBottom: 60,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: SIZES.radius,
        padding: 20,
        ...SHADOWS.small,
    },
    lastUpdated: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 20,
        fontStyle: 'italic',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 8,
    },
    sectionText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        lineHeight: 22,
    },
    footer: {
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    footerText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        lineHeight: 20,
    },
    contactEmail: {
        fontSize: 14,
        color: COLORS.primary,
        fontWeight: '600',
        marginTop: 8,
    },
});

export default LegalScreen;
