import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import fr from './locales/fr/common.json'
import en from './locales/en/common.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { fr: { common: fr }, en: { common: en } },
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'en'],
    defaultNS: 'common',
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'], lookupLocalStorage: 'lang' },
    interpolation: { escapeValue: false },
  })

if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language
  i18n.on('languageChanged', (lng) => {
    document.documentElement.lang = lng
  })
}

export default i18n
