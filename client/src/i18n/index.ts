import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";

// Only English is populated today; additional languages are added by
// dropping a new locales/<lng>.json (mirroring en.json's key structure)
// and registering it in `resources` below — no other code changes needed.
void i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18next;
