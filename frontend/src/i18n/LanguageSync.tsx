import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getLanguageFromPathname } from "./language";

function LanguageSync() {
  const location = useLocation();
  const { i18n } = useTranslation();

  useEffect(() => {
    const language = getLanguageFromPathname(location.pathname);

    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [location.pathname, i18n]);

  return null;
}

export default LanguageSync;
