import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './en.json';
import hi from './hi.json';
import zh from './zh.json';
import es from './es.json';
import fr from './fr.json';
import ar from './ar.json';
import bn from './bn.json';
import pt from './pt.json';
import ru from './ru.json';
import ur from './ur.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            hi: { translation: hi },
            zh: { translation: zh },
            es: { translation: es },
            fr: { translation: fr },
            ar: { translation: ar },
            bn: { translation: bn },
            pt: { translation: pt },
            ru: { translation: ru },
            ur: { translation: ur },
        },
        fallbackLng: 'en',
        defaultNS: 'translation',
        debug: false,
        detection: {
            order: ['localStorage', 'navigator'],
            lookupLocalStorage: 'sm-lang',
        },
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;
