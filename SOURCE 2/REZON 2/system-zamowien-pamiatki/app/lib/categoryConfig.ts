// ✅ ŁATWA EDYCJA TREŚCI I OBRAZKÓW
// Zmień tutaj opisy, obrazki i nazwy kategorii

export const categoryConfig = {
  categories: [
    {
      id: 'MAGNESY',
      name: 'Magnesy',
      slug: 'magnesy',
      description: 'Estetyczne i funkcjonalne gadżety z szerokim wyborem wzorów oraz kształtów.',
      image: '/api/r2/file/kategorie/magnesy.jpg',
    },
    {
      id: 'BRELOKI',
      name: 'Breloki',
      slug: 'breloki',
      description: 'Doskonałe rozwiązanie dla tych, którzy cenią praktyczność i personalizację.',
      image: '/api/r2/file/kategorie/breloki.jpg',
    },
    {
      id: 'OTWIERACZE',
      name: 'Otwieracze',
      slug: 'otwieracze',
      description: 'Praktyczne gadżety, które przydają się w codziennym użytku.',
      image: '/api/r2/file/kategorie/otwieracze.jpg',
    },
    {
      id: 'CERAMIKA_I_SZKLO',
      name: 'Ceramika i Szkło',
      slug: 'ceramika',
      description:
        'Oferta produktów wykonanych ze szkła i ceramiki. Kubki, Kieliszki, Kufle oraz wiele innych.',
      image: '/api/r2/file/kategorie/ceramika.jpg',
    },
    {
      id: 'DLUGOPISY',
      name: 'Długopisy',
      slug: 'dlugopisy',
      description: 'Funkcjonalne akcesoria biurowe z możliwością personalizacji.',
      image: '/api/r2/file/kategorie/dlugopisy.jpg',
    },
    {
      id: 'CZAPKI_I_NAKRYCIA_GLOWY',
      name: 'Czapki i Nakrycia Głowy',
      slug: 'czapki',
      description: 'Stylowe nakrycia głowy z możliwością nadruku logo lub wzoru.',
      image: '/api/r2/file/kategorie/czapki.jpg',
    },
    {
      id: 'BRANSOLETKI',
      name: 'Bransoletki',
      slug: 'bransoletki',
      description: 'Eleganckie bransoletki i opaski w różnych stylach i kolorach.',
      image: '/api/r2/file/kategorie/bransoletki.jpg',
    },
    {
      id: 'TEKSTYLIA',
      name: 'Tekstylia',
      slug: 'tekstylia',
      description: 'Wysokiej jakości tekstylia z możliwością personalizacji.',
      image: '/api/r2/file/kategorie/tekstylia.jpg',
    },
    {
      id: 'OZDOBY_DOMOWE',
      name: 'Ozdoby Domowe',
      slug: 'ozdoby',
      description: 'Dekoracyjne elementy do domu i biura.',
      image: '/api/r2/file/kategorie/ozdoby.jpg',
    },
    {
      id: 'AKCESORIA_PODROZNE',
      name: 'Akcesoria Podróżne',
      slug: 'akcesoria',
      description: 'Praktyczne gadżety dla podróżników i aktywnych osób.',
      image: '/api/r2/file/kategorie/akcesoria.jpg',
    },
    {
      id: 'DLA_DZIECI',
      name: 'Dla Dzieci',
      slug: 'dzieci',
      description: 'Bezpieczne i kolorowe produkty dedykowane najmłodszym.',
      image: '/api/r2/file/kategorie/dzieci.jpg',
    },
    {
      id: 'ZAPALNICZKI_I_POPIELNICZKI',
      name: 'Zapalniczki i Popielniczki',
      slug: 'zapalniczki',
      description: 'Stylowe akcesoria dla palaczy w różnych wzorach.',
      image: '/api/r2/file/kategorie/zapalniczki.jpg',
    },
    {
      id: 'UPOMINKI_BIZNESOWE',
      name: 'Upominki Biznesowe',
      slug: 'biznesowe',
      description: 'Eleganckie prezenty firmowe i gadżety promocyjne.',
      image: '/api/r2/file/kategorie/biznesowe.jpg',
    },
    {
      id: 'ZESTAWY',
      name: 'Zestawy',
      slug: 'zestawy',
      description: 'Gotowe zestawy upominkowe w atrakcyjnych opakowaniach.',
      image: '/api/r2/file/kategorie/zestawy.jpg',
    },
  ],

  // Globalne ustawienia strony
  site: {
    title: 'REZON - Katalog Produktów',
    description: 'Personalizowane upominki i akcesoria modowe',
    logo: '/logo.png', // Zmień na swoje logo
    contactPhone1: '+48 94 35 514 50',
    contactPhone2: '+48 697 716 916',
    contactEmail: 'hurtownia@rezon.eu',
    workingHours: {
      regular: 'pon - pt: 7:00 - 15:00',
      summer: '(od maja - do sierpnia): pon - pt: 7:00 - 16:00, sb: 7:00 - 13:00',
    },
  },
};

// 📝 JAK EDYTOWAĆ:
// 1. Zmień opisy w polu 'description'
// 2. Obrazki kategorii są teraz przechowywane w R2 w folderze 'kategorie/'
//    Format: kategorie/{slug}.jpg (np. kategorie/magnesy.jpg)
//    Wgraj obrazy do R2 przez panel admina lub bezpośrednio do bucket
// 3. Zmień dane kontaktowe w sekcji 'site'
// 4. Dodaj nowe kategorie kopiując istniejący obiekt
