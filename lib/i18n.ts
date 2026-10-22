"use client";
import { useEffect, useState } from "react";

export type Lang = "en" | "hi" | "ta";
export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "ta", label: "தமிழ்" },
];

// Keyed by the English text so any missing translation falls back to English.
const hi: Record<string, string> = {
  "My orders": "मेरे ऑर्डर",
  "My placed orders": "मेरे दिए गए ऑर्डर",
  Share: "शेयर",
  Dark: "डार्क",
  Light: "लाइट",
  "Find something delicious": "कुछ स्वादिष्ट खोजें",
  "A menu made for a little discovery.": "थोड़ी खोज के लिए बना मेन्यू।",
  Menu: "मेन्यू",
  Secret: "राज़",
  "Taste quiz": "स्वाद क्विज़",
  "Table games": "टेबल गेम्स",
  Reviews: "रिव्यू",
  "SOMETHING SPECIAL": "कुछ ख़ास",
  "Your table has a delicious secret.": "आपकी टेबल के पास एक स्वादिष्ट राज़ है।",
  "A little something you won’t find on the regular menu.": "कुछ ऐसा जो आपको आम मेन्यू में नहीं मिलेगा।",
  "Unlock the secret": "राज़ खोलें",
  "Hide the secret": "राज़ छुपाएँ",
  "FRESH PICKS FOR YOUR TABLE": "आपकी टेबल के लिए ताज़ा पसंद",
  "Find your favourite.": "अपनी पसंदीदा डिश खोजें।",
  "Veg only": "सिर्फ़ शाकाहारी",
  "Find a dish": "डिश खोजें",
  "Sort by": "क्रमबद्ध करें",
  Recommended: "सुझाया गया",
  "Top rated": "टॉप रेटेड",
  "Price: low to high": "कीमत: कम से ज़्यादा",
  "Price: high to low": "कीमत: ज़्यादा से कम",
  Spice: "मसाला",
  Any: "कोई भी",
  Mild: "हल्का",
  Medium: "मध्यम",
  Hot: "तीखा",
  "Surprise me": "मुझे चौंकाओ",
  Favourites: "पसंदीदा",
  "Avoid:": "इनसे बचें:",
  "Prices in ₹": "कीमतें ₹ में",
  VEG: "शाकाहारी",
  "NON-VEG": "मांसाहारी",
  "Not rated yet": "अभी रेटिंग नहीं",
  "Guest favourite": "मेहमानों की पसंद",
  Popular: "लोकप्रिय",
  "Dish details": "डिश की जानकारी",
  "Add to order": "ऑर्डर में जोड़ें",
  "Sold out": "ख़त्म",
  "Clear filters": "फ़िल्टर हटाएँ",
  "How did we do?": "हमारी सेवा कैसी रही?",
  "Leave a review": "रिव्यू दें",
  "Add to cart": "कार्ट में जोड़ें",
  "Save to my favourites": "पसंदीदा में सहेजें",
  "Need something at your table?": "टेबल पर कुछ चाहिए?",
  "Call waiter": "वेटर को बुलाएँ",
  "Ask for the bill": "बिल माँगें",
  "Table number": "टेबल नंबर",
  "Your server has been notified.": "आपके वेटर को सूचना भेज दी गई है।",
  Language: "भाषा",
  "Save menu offline": "मेन्यू ऑफ़लाइन सहेजें",
  "Text size": "अक्षर का आकार",
  "Your order": "आपका ऑर्डर",
  "Menu total": "मेन्यू का कुल",
  "Review & order": "देखें और ऑर्डर करें",
  "Tip guide": "टिप गाइड",
  None: "कोई नहीं",
  "Split between": "बाँटें",
  "Placed orders": "दिए गए ऑर्डर",
  "Completed & cancelled": "पूरे और रद्द",
  "Your orders": "आपके ऑर्डर",
  "Order again": "फिर से ऑर्डर करें",
  "Order placed · awaiting acceptance": "ऑर्डर दिया गया · स्वीकृति का इंतज़ार",
  Accepted: "स्वीकार किया गया",
  "Being prepared": "तैयार हो रहा है",
  "Delivered to your table": "आपकी टेबल पर पहुँचा दिया गया",
  Cancelled: "रद्द",
  "Order alerts on": "ऑर्डर अलर्ट चालू",
  "Order alerts off": "ऑर्डर अलर्ट बंद",
  "Contains an allergen you chose to avoid:": "इसमें वह एलर्जन है जिससे आप बचना चाहते हैं:",
};

const ta: Record<string, string> = {
  "My orders": "என் ஆர்டர்கள்",
  "My placed orders": "நான் கொடுத்த ஆர்டர்கள்",
  Share: "பகிர்",
  Dark: "இருள்",
  Light: "ஒளி",
  "Find something delicious": "சுவையானதைத் தேடுங்கள்",
  "A menu made for a little discovery.": "சிறு கண்டுபிடிப்புக்காக உருவான மெனு.",
  Menu: "மெனு",
  Secret: "ரகசியம்",
  "Taste quiz": "சுவை வினா",
  "Table games": "டேபிள் விளையாட்டுகள்",
  Reviews: "மதிப்புரைகள்",
  "SOMETHING SPECIAL": "சிறப்பான ஒன்று",
  "Your table has a delicious secret.": "உங்கள் மேசையில் ஒரு சுவையான ரகசியம் உள்ளது.",
  "A little something you won’t find on the regular menu.": "வழக்கமான மெனுவில் கிடைக்காத ஒன்று.",
  "Unlock the secret": "ரகசியத்தைத் திற",
  "Hide the secret": "ரகசியத்தை மறை",
  "FRESH PICKS FOR YOUR TABLE": "உங்கள் மேசைக்கான புதிய தேர்வுகள்",
  "Find your favourite.": "உங்களுக்குப் பிடித்ததைக் கண்டுபிடியுங்கள்.",
  "Veg only": "சைவம் மட்டும்",
  "Find a dish": "உணவைத் தேடுங்கள்",
  "Sort by": "வரிசைப்படுத்து",
  Recommended: "பரிந்துரைக்கப்பட்டது",
  "Top rated": "அதிக மதிப்பீடு",
  "Price: low to high": "விலை: குறைவு முதல் அதிகம்",
  "Price: high to low": "விலை: அதிகம் முதல் குறைவு",
  Spice: "காரம்",
  Any: "எதுவும்",
  Mild: "மிதமான",
  Medium: "நடுத்தரம்",
  Hot: "அதிக காரம்",
  "Surprise me": "எனக்கு ஆச்சரியம் தாருங்கள்",
  Favourites: "பிடித்தவை",
  "Avoid:": "தவிர்க்க:",
  "Prices in ₹": "விலைகள் ₹ இல்",
  VEG: "சைவம்",
  "NON-VEG": "அசைவம்",
  "Not rated yet": "இன்னும் மதிப்பீடு இல்லை",
  "Guest favourite": "விருந்தினர் விருப்பம்",
  Popular: "பிரபலம்",
  "Dish details": "உணவு விவரங்கள்",
  "Add to order": "ஆர்டரில் சேர்",
  "Sold out": "தீர்ந்துவிட்டது",
  "Clear filters": "வடிகட்டிகளை நீக்கு",
  "How did we do?": "எங்கள் சேவை எப்படி?",
  "Leave a review": "மதிப்புரை எழுதுங்கள்",
  "Add to cart": "கார்ட்டில் சேர்",
  "Save to my favourites": "பிடித்தவையில் சேமி",
  "Need something at your table?": "மேசையில் ஏதாவது வேண்டுமா?",
  "Call waiter": "பணியாளரை அழைக்க",
  "Ask for the bill": "பில் கேட்க",
  "Table number": "மேசை எண்",
  "Your server has been notified.": "உங்கள் பணியாளருக்குத் தெரிவிக்கப்பட்டது.",
  Language: "மொழி",
  "Save menu offline": "மெனுவை ஆஃப்லைனில் சேமி",
  "Text size": "எழுத்து அளவு",
  "Your order": "உங்கள் ஆர்டர்",
  "Menu total": "மெனு மொத்தம்",
  "Review & order": "சரிபார்த்து ஆர்டர் செய்",
  "Tip guide": "டிப் வழிகாட்டி",
  None: "இல்லை",
  "Split between": "பிரித்துக்கொள்ள",
  "Placed orders": "கொடுத்த ஆர்டர்கள்",
  "Completed & cancelled": "முடிந்தவை & ரத்தானவை",
  "Your orders": "உங்கள் ஆர்டர்கள்",
  "Order again": "மீண்டும் ஆர்டர் செய்",
  "Order placed · awaiting acceptance": "ஆர்டர் கொடுக்கப்பட்டது · ஏற்பு காத்திருக்கிறது",
  Accepted: "ஏற்கப்பட்டது",
  "Being prepared": "தயாராகிறது",
  "Delivered to your table": "உங்கள் மேசைக்கு வழங்கப்பட்டது",
  Cancelled: "ரத்து",
  "Order alerts on": "ஆர்டர் அறிவிப்பு இயக்கம்",
  "Order alerts off": "ஆர்டர் அறிவிப்பு நிறுத்தம்",
  "Contains an allergen you chose to avoid:": "நீங்கள் தவிர்க்க விரும்பிய ஒவ்வாமைப் பொருள் உள்ளது:",
};

const dictionaries: Record<Lang, Record<string, string>> = { en: {}, hi, ta };

const KEY = "ts-lang";
const EVENT = "ts-lang-change";

export function translate(lang: Lang, text: string) {
  return dictionaries[lang]?.[text] ?? text;
}

export function useLang() {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    function read() {
      try {
        const v = localStorage.getItem(KEY);
        if (v === "hi" || v === "ta" || v === "en") setLangState(v);
      } catch {}
    }
    read();
    window.addEventListener(EVENT, read);
    return () => window.removeEventListener(EVENT, read);
  }, []);

  function setLang(next: Lang) {
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    setLangState(next);
    window.dispatchEvent(new Event(EVENT));
  }

  const t = (text: string) => translate(lang, text);
  return { lang, setLang, t };
}
