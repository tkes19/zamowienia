-- Import produktów z Access DB
-- Wygenerowano automatycznie

-- Usuń istniejące produkty testowe
DELETE FROM "Product" WHERE "description" = 'Opis testowy' OR "identifier" LIKE 'TEST-%';

INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '36ee65b3-a4fc-47a3-9ec0-5e357603d5f8',
  'MAGNES HDF ŻYWICA POLSKA',
  'HDF ŻYWICA',
  NULL,
  0,
  'MAGNESY',
  '2$5',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'a4d5f900-c861-4f96-a89d-46bbe8311293',
  'KUBEK DUŻY',
  'KUBEK DUŻY',
  NULL,
  12,
  'CERAMIKA_I_SZKLO',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '1fbfdee4-3a82-46bd-ac58-04d23d8f5739',
  'KUFEL C2 SUB',
  'KUFEL SUB CERAMIKA',
  NULL,
  0,
  'CERAMIKA_I_SZKLO',
  '10',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '3b57e15c-e7e7-4332-b2e7-09c596acc0ca',
  'KUFEL C3 SUB',
  'KUFEL SUB CERAMIKA',
  NULL,
  0,
  'CERAMIKA_I_SZKLO',
  '10',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '15b1cacf-abc8-4a9b-977f-db115abf0707',
  'DŁUGOPIS BAMBUS 2',
  'DK42-037E',
  'Metalowy długopis na którym można wygrawerować metodą laserową małą grafikę ze wzorem. Produkt dostępny w 3 kolorach, zapakowany na  kartce i wytłoczce dopasowanej do kształtu długopisu.',
  3.5,
  'DLUGOPISY',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '53f1b708-bffc-43e0-88cc-f62d2412ffeb',
  'PIERSIÓWKA 4',
  'DK42-045A3',
  NULL,
  0,
  'AKCESORIA_PODROZNE',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'e140cf98-5c26-467e-bdce-3970604ef079',
  'MAGNES HDF ŻYWICA DOWOLNY KSZTAŁT',
  'HDF ŻYWICA',
  NULL,
  0,
  'MAGNESY',
  '2$5',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '5ddaf99e-7945-4a32-9e60-6f1998c2fb03',
  'SKLEJKA DOWOLNY KSZTAŁT',
  'SKLEJKA DOWOLNY KSZTAŁT',
  NULL,
  0,
  'MAGNESY',
  '5%3',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '51415aea-194e-4196-8f2a-fae8f8ef9832',
  'TORBA PAPIEROWA D 30X25',
  'DK43-050D1-3L',
  NULL,
  0,
  'UPOMINKI_BIZNESOWE',
  '12',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'f555f6c6-e750-4a13-82e5-55062603018d',
  'TORBA PAPIEROWA B 16X24',
  'DK43-050B1-5L',
  NULL,
  0,
  'UPOMINKI_BIZNESOWE',
  '12',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '92a99aab-a22f-4904-99a6-52c3de1cc658',
  'TORBA PAPIEROWA C 19X27',
  'DK43-050C1-5L',
  NULL,
  0,
  'UPOMINKI_BIZNESOWE',
  '12',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'a4d3cc71-e239-4375-b602-d80f74d4d1aa',
  'TORBA PAPIEROWA F 12X40',
  'DK43-050F1F3L',
  NULL,
  0,
  'UPOMINKI_BIZNESOWE',
  '12',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '9d654ebc-7f7d-4b06-8631-339319848a5c',
  'TORBA PAPIEROWA A 14X17',
  'DK43-050A1-5L',
  NULL,
  0,
  'UPOMINKI_BIZNESOWE',
  '12',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'e8089476-10be-45d0-a7f4-2345c3084b1c',
  'TORBA PAPIEROWA D 30X25',
  'DK43-050D4-5L',
  NULL,
  0,
  'UPOMINKI_BIZNESOWE',
  '12',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '51511cbd-25ba-44ed-a31b-f8e8fdf7141b',
  'OTWIERACZ PLAST STOPA',
  'OTWIERACZ PLAST',
  'Otwieracz do butelek w kształcie stopy posiadający magnes. Produkt wykonany z plastiku, możliwe jest nadrukowanie dowolnej grafiki.',
  4,
  'OTWIERACZE',
  '1.4',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '174c2a2b-434d-4f6c-a935-df9bdeb8f571',
  'OTWIERACZ PLAST STOPA ŻYWICA',
  'OTWIERACZ ŻYWICA',
  'Otwieracz do butelek w kształcie stopy posiadający magnes. Produkt wykonany z plastiku, możliwe jest nadrukowanie dowolnej grafiki.',
  5,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '7c023a09-ddb1-49fe-b03f-4d680b65110d',
  'OTWIERACZ POLIRESING KAPSEL',
  'OTWIERACZ POLIRESING-1',
  'Otwieracz wykonany z tworzywa ceramicznego posiadający miejsce na wykonanie grafiki ze wzorem. Produkt posiada magnes na rewersie, zapakowany w woreczku.',
  4.5,
  'OTWIERACZE',
  '1.4',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '748b9554-7d8b-4fce-90d0-ddb0c11752d9',
  'OTWIERACZ POLIRESING KAPSEL ŻYWICA',
  'OTWIERACZ ŻYWICA',
  'Otwieracz wykonany z tworzywa ceramicznego posiadający miejsce na wykonanie grafiki ze wzorem. Produkt posiada magnes na rewersie, zapakowany w woreczku.',
  5,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'ba456dd7-93c4-428c-8f95-0d562051d982',
  'OTWIERACZ DREWNO BUTELKA',
  'OTWIERACZ DREWNO',
  'Otwieracz do butelek w kształcie butelki posiadający magnes. Produkt wykonany z płyty MDF, możliwe jest nadrukowanie dowolnej grafiki.',
  6,
  'OTWIERACZE',
  '1.5',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'a845b413-cfa9-4cf5-bdb4-9f9d3653165a',
  'OTWIERACZ DREWNO MUSZLA',
  'OTWIERACZ DREWNO',
  'Otwieracz do butelek w kształcie muszli posiadający magnes. Produkt wykonany z płyty MDF, możliwe jest nadrukowanie dowolnej grafiki.',
  6,
  'OTWIERACZE',
  '1.6',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '421e4270-3904-4420-8970-65cebc78aabc',
  'OTWIERACZ METAL 1',
  'DK41-079A',
  'Otwieracz do butelek posiadający magnes. Produkt wykonany ze stopu metali z miejscem na naklejkę żywiczną. Produkt zapakowany w woreczek.',
  8,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '9ebd5a52-d7ce-44d9-b06c-03b8115b5ff2',
  'TORBA ECO',
  'DK41-TORBA ECO',
  'Torba bawełniana, 2 kolory, naturalny i czarny. Wymiar torby 40*41 cm+uszy 33 cm, dno pełne, mocna gramatura materiału 350 gr, wzmocnione szycia, zadruk logo 1 stronny w cenie, dowolna grafika, możliwy pełny kolor',
  12,
  'TEKSTYLIA',
  '4',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '18d1fdef-3aea-43c7-b910-dd126367ba33',
  'TORBA SUB',
  'DK42-TORBA SUB',
  NULL,
  0,
  'TEKSTYLIA',
  '8',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'a65b5310-bbb7-4f20-9755-896b485a5511',
  'BRELOK KOTWICA',
  'DK42-162',
  NULL,
  0,
  'BRELOKI',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'b03b0b68-f605-4d7e-953b-8a65115868b0',
  'KUBEK SUB',
  'KUBEK SUB',
  'Kubek ceramiczny z możliwością wykonania dowolnej grafiki lub hasła w pełnym kolorze. Kubek dostępny w kolorze białym, z niebieskim uchem oraz wnętrzem kubka.',
  12,
  'CERAMIKA_I_SZKLO',
  '10',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '8cda51fe-a2b3-4df6-804d-351e7f4fd30a',
  'KIELISZEK',
  'KIELISZEK',
  'Kwadratowy kieliszek wykonany z grubego szkła pojemności 80 ml. Możliwe wykonane grafiki na dowolnej zewnętrznej ścianie kieliszka.',
  4.5,
  'CERAMIKA_I_SZKLO',
  '1.1',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '2d6543dc-d089-4aaf-8836-c4614fa4725f',
  'NAKLEJKA 3D',
  'NAKLEJKA 3D',
  NULL,
  0,
  'BRELOKI',
  '2.1',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '7cb349b1-9673-469c-9dde-ffa7c71d4aca',
  'BRELOK METALOWY Z IMITACJĄ SKÓRY',
  'DK38-003AB',
  'Elegancki brelok wykonany z metalu i imitacji skóry. Produkt dostępny w 2 kształtach: prostokąt i koło, posiada miejsce na grafikę. Możliwość wykonania dowolnej grafiki.',
  4,
  'BRELOKI',
  '2',
  false,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '276a8026-ab78-47bc-bbe3-1e22703f1f4d',
  'OTWIERACZ DZWONEK OWAL',
  'DK43-021',
  NULL,
  0,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '9e0c0e7a-7410-43a2-886e-a0577c60e8e1',
  'KOSZULKA DZIECIĘCA',
  'KOSZULKA',
  'Koszulka bawełniana dziecięca, rozmiary od 110 do 152 wzrostu, 7 kolorów: biała, czarna, szara, czerwona, błękitna, niebieska, różowa. Nadruk pełny kolor w cenie, zapakowana w woreczku i kartce usztywniającej. Oryginalne specjalnie zaprojektowane grafiki',
  15,
  'TEKSTYLIA',
  '4',
  false,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '0dd44b72-a97d-4553-b920-bceb69b81cb4',
  'SZKLANKA KWADRAT SUB',
  'SZKLANKA KWADRAT SUB',
  'Szklanka kwadratowa możliwością wykonania dowolnej grafiki. Produkt dostępny w wielu ciekawych wzorach',
  9,
  'CERAMIKA_I_SZKLO',
  '10',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '77680bc3-2543-4958-acf4-c52fa29001d8',
  'MAGNES DŁUGOPIS',
  'MAGNES DŁUGOPIS',
  'Plastikowy magnes z funkcją długopisu. Możliwe wykonanie dowolnej grafiki na wierzchniej stronie przedmiotu. Do długopisu dołączony mały notes i samoprzylepne karteczki.',
  4.5,
  'MAGNESY',
  '2',
  false,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'b0e2bd49-f0c6-4756-930d-8e850a429459',
  'BRELOK ECO',
  'DK39-EKO2',
  'Elegancki brelok wykonany z imitacji skóry z grawerem laserowym który można wykonać na obu stronach breloka. Produkt dostępny w 3 kolorach: Czarny ze srebrnym grawerem, Brązowy z czarnym grawerem i Beżowy z czarnym grawerem. Brak możliwości zmiany koloru',
  4,
  'BRELOKI',
  '3',
  false,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '88ab8ea6-3f96-4b31-a7dc-930aaf4aa9c4',
  'CHUSTA NA GŁOWĘ Z APLIKACJĄ',
  'DK27-003',
  'Chusta bawełniana z imieniem dziecka, boczki chusty kolorowe z 3 motywami (obrazkami), środek biały. Oferujemy  6 kolorów produktu, produkt zapakowany w woreczku.',
  6,
  'CZAPKI_I_NAKRYCIA_GLOWY',
  '7',
  false,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'e2d58705-1fbd-45a1-b4c7-0bca9958611e',
  'DZWONEK KOŁO',
  'DK42-130',
  NULL,
  0,
  'OZDOBY_DOMOWE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '64cbf968-9d2a-42f5-9fcd-1346741789ef',
  'DZWONEK STER',
  'DK42-132',
  NULL,
  0,
  'OZDOBY_DOMOWE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.402Z',
  '2025-08-17T14:39:10.402Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'e953cab6-03e8-4545-bd7e-3baad3904200',
  'BRELOK OBROTOWY BECZKA',
  'BRE OBROTOWY BECZKA',
  'Brelok metalowy z obrotowym i dwustronnie spersonalizowanym elementem. Na jednej stronie  logo z danego miasta, miejscowości (fotografia lub inny wzór), druga strona to  imię lub hasło. Każda sztuka zapakowana na kartoniku.',
  6,
  'BRELOKI',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.403Z',
  '2025-08-17T14:39:10.403Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '3c3d6afd-2dc2-4d5a-a9b2-c740e5cc784e',
  'DŁUGOPIS BAMBUS',
  'DK42-037C',
  'Bambusowy długopis na którym można wygrawerować metodą laserową małą grafikę ze wzorem.',
  3,
  'DLUGOPISY',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.403Z',
  '2025-08-17T14:39:10.403Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '8bb2ae94-a86a-45fa-a4fc-359df6c8cc8d',
  'DŁUGOPIS KRYSZTAŁ Z GUMKĄ',
  'DK40-025C',
  'Metalowy długopis z ozdobnymi kryształkami, na którym można wygrawerować metodą laserową małą grafikę ze wzorem. Produkt dostępny w 6 kolorach, zapakowany na  kartce i wytłoczce dopasowanej do kształtu długopisu.',
  4.5,
  'DLUGOPISY',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.403Z',
  '2025-08-17T14:39:10.403Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '43e8207b-fdd6-4003-beb0-8f6dbf1e337c',
  'DŁUGOPIS KRYSZTAŁ Z OCZKIEM',
  'DK40-025D',
  'Metalowy długopis z ozdobnymi kryształkami, na którym można wygrawerować metodą laserową małą grafikę ze wzorem. Produkt dostępny w 6 kolorach, zapakowany na  kartce i wytłoczce dopasowanej do kształtu długopisu.',
  4.5,
  'DLUGOPISY',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.403Z',
  '2025-08-17T14:39:10.403Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'ea93965f-990e-44ab-b2bd-9f373620003b',
  'DŁUGOPIS METALOWY 2',
  'DK29-037A',
  'Metalowy długopis na którym można wygrawerować metodą laserową małą grafikę ze wzorem. Produkt dostępny w 2 kolorach, zapakowany na  kartce i wytłoczce dopasowanej do kształtu długopisu.',
  4.5,
  'DLUGOPISY',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.403Z',
  '2025-08-17T14:39:10.403Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '1e7538b3-f526-453d-bc37-34679993a354',
  'MAGNES HDF ŻYWICA PROSTOKĄT MAŁY',
  'HDF ŻYWICA',
  NULL,
  0,
  'MAGNESY',
  '2$5',
  true,
  NULL,
  '2025-08-17T14:39:10.403Z',
  '2025-08-17T14:39:10.403Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '621bde75-9b17-418e-9e1b-35121529d74f',
  'DŁUGOPIS METALOWY 3',
  'DK40-025A',
  'Metalowy długopis na którym można wygrawerować metodą laserową małą grafikę ze wzorem. Produkt dostępny w 5 kolorach, zapakowany na  kartce i wytłoczce dopasowanej do kształtu długopisu.',
  3.5,
  'DLUGOPISY',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.403Z',
  '2025-08-17T14:39:10.403Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'd2196e53-46b5-4fd0-acdf-4ab69606561d',
  'MAGNES HDF ŻYWICA PROSTOKĄT DUŻY',
  'HDF ŻYWICA',
  NULL,
  0,
  'MAGNESY',
  '2$5',
  true,
  NULL,
  '2025-08-17T14:39:10.403Z',
  '2025-08-17T14:39:10.403Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '5c1301b6-3a99-429c-babc-9caf5e17e524',
  'MAGNES HDF ŻYWICA MUSZLA',
  'HDF ŻYWICA',
  NULL,
  0,
  'MAGNESY',
  '2$5',
  true,
  NULL,
  '2025-08-17T14:39:10.403Z',
  '2025-08-17T14:39:10.403Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'dc5467b0-42d3-4ca2-9848-77b547b0f0c1',
  'DŁUGOPIS METALOWY 4',
  'DK40-025E',
  'Metalowy długopis na którym można wygrawerować metodą laserową małą grafikę ze wzorem. Produkt dostępny w 6 kolorach, zapakowany na  kartce i wytłoczce dopasowanej do kształtu długopisu.',
  3,
  'DLUGOPISY',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.403Z',
  '2025-08-17T14:39:10.403Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'e12afaf7-1711-4d4f-a021-d8e797ae1792',
  'MAGNES HDF ŻYWICA I LOVE',
  'HDF ŻYWICA',
  NULL,
  0,
  'MAGNESY',
  '2$5',
  true,
  NULL,
  '2025-08-17T14:39:10.403Z',
  '2025-08-17T14:39:10.403Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '23275b54-c4d5-4980-8c59-4a7600c9db85',
  'DŁUGOPIS METALOWY CZARNY',
  'DK40-025B',
  'Metalowy długopis na którym można wygrawerować metodą laserową małą grafikę ze wzorem. Produkt dostępny w 3 kolorach, zapakowany na  kartce i wytłoczce dopasowanej do kształtu długopisu.',
  3.5,
  'DLUGOPISY',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.403Z',
  '2025-08-17T14:39:10.403Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '36a6af65-f70c-4f7e-815e-1f7dacf52175',
  'DŁUGOPIS ZMAZYWALNY',
  'DŁ ZMAZYWALNY',
  'Długopis z wkładem który posiada specjalną gumkę umieszczoną na końcówce długopisu, która ściera nie pozostawiając śladu. Długopis występuje w 8 kolorach. Jakość wykonania nie odbiega od markowych długopisów, wielokrotnie droższych. Wkład najwyższej jakoś',
  4.5,
  'DLUGOPISY',
  '1.5',
  true,
  NULL,
  '2025-08-17T14:39:10.403Z',
  '2025-08-17T14:39:10.403Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'a2d70658-1c82-4fbd-8355-97eab6425dbd',
  'BRELOK STRZAŁA',
  'BRELOK STRZAŁA',
  NULL,
  0,
  'BRELOKI',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.403Z',
  '2025-08-17T14:39:10.403Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '7024199d-7b89-4614-a467-7db057c6eb15',
  'KUBEK RETRO SUB',
  'KUBEK RETRO',
  NULL,
  0,
  'CERAMIKA_I_SZKLO',
  '10',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'bd467eda-147d-4047-a770-79593ee1e557',
  'DŁUGOPIS METAL BAMBUS',
  'DK42-205',
  NULL,
  0,
  'DLUGOPISY',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '89249491-ff20-4495-b061-07f1f043b79c',
  'CZAPKA HIP HOP',
  'DK27-NAME B/G',
  'Czapka hip hop z imieniem dziecka, rozmiar dziecięcy XS z regulowanym paskiem z tyłu głowy. Dostępne w 6 kolorach.',
  5,
  'CZAPKI_I_NAKRYCIA_GLOWY',
  '7',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'bd6b3ee1-b81c-4b77-92b1-81fe07acfdc8',
  'OPASKA NA GŁOWĘ',
  'DK30-OPASKA',
  'Dziewczęca opaska na głowę + zestaw gumek do włosów. Oferujemy 4 kolory: fiolet, różowy, jasno różowy, jasny niebieski. Produkt zapakowany na stylowej kartce w woreczku.',
  3.5,
  'CZAPKI_I_NAKRYCIA_GLOWY',
  '7',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '41946813-e4c3-490c-9721-12b19f4581b0',
  'BRANSOLETKA MUSZLA DUŻA',
  'BRANS MUSZLA D',
  'Bransoletka wykonana z miękkiego plecionego kolorowego sznurka z elementem pod grawer i naturalnymi muszelkami. Produkt personalizowany imionami damskimi. Niepowtarzalny upominek z wakacyjnego wyjazdu. Oferujemy produkt w 3 modnych kolorach.',
  4,
  'BRANSOLETKI',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '72b5366d-2364-477a-ac39-05c412a4ca35',
  'BUTELKA BURSZTYN',
  'BUTELKA BURSZTYN',
  NULL,
  0,
  'OZDOBY_DOMOWE',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '29f9a401-cbc4-4417-ac86-a4e186c7cc9c',
  'BRANSOLETKA MUSZLA MAŁA',
  'BRANS MUSZLA M',
  'Bransoletka wykonana z miękkiego plecionego kolorowego sznurka z elementem pod grawer i naturalnymi muszelkami. Produkt personalizowany imionami dziecięcymi. Niepowtarzalny upominek z wakacyjnego wyjazdu. Oferujemy produkt w 3 modnych kolorach.',
  4,
  'BRANSOLETKI',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '184b9831-0dde-42e1-b35d-f6f8091b8956',
  'BRANSOLETKA SILIKONOWA DUŻA',
  'DK29-054A',
  'Bransoletka wykonana z elastycznego silikonu z miejscem na grawer. Produkt dostępny w kolorze czerwonym, obwód 20mm.',
  2.5,
  'BRANSOLETKI',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '07175fd5-0665-42b9-bf9e-4415e3da9451',
  'KOSZULKA POLO',
  'KOSZULKA',
  NULL,
  15,
  'TEKSTYLIA',
  '4',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'ecd38cb0-a7da-4f43-a34f-380f424103d8',
  'MAGNES SKLEJKA BURSZTYN',
  'MAGNES BURSZTYN',
  NULL,
  0,
  'MAGNESY',
  '5%3$3$3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'f894b602-25c0-4386-b07c-3dc13c546274',
  'BRANSOLETKA SILIKONOWA MAŁA',
  'DK29-054B',
  'Bransoletka wykonana z elastycznego silikonu z miejscem na grawer. Produkt dostępny w 6 kolorach, obwód 18mm.',
  2.5,
  'BRANSOLETKI',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '0ed57bbf-84bd-4ade-80e1-0a3d6ea043ed',
  'BRANSOLETKA SKÓRZANA',
  'DK30-052',
  'Bransoletka wykonana ze skóry i sznurka z metalowym elementem na którym wygrawerowane zostało imię dziecka. Oferowana w 4 kolorach, produkt zapakowany na stylowej kartce w woreczku.',
  4,
  'BRANSOLETKI',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '8ca36d29-749c-4e2f-ac8b-fc87736f5ba9',
  'MAGNES PIANKA 1',
  'MAGNES PIANKA 1',
  'Magnes wykonany z lekkiej pianki z kolorową grafiką.',
  3.5,
  'MAGNESY',
  '11',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'e6567184-01db-442f-b47a-766436f6bbc4',
  'MAGNES PIANKA 2',
  'MAGNES PIANKA 2',
  'Magnes wykonany z lekkiej pianki z kolorową grafiką.',
  4.5,
  'MAGNESY',
  '11',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '38ba0a6d-a53a-4d43-955a-da1370988897',
  'ZAW SERCE',
  'ZAW SERCE',
  'Zawieszka wykonana z drewna w kształcie eleganckiego serca. Wiele dostępnych wzorów efektyeni pomoże w zdobie domu.',
  5,
  'OZDOBY_DOMOWE',
  '5.1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '03580f3b-3c5f-4ad2-a7a8-27b0dbc3c167',
  'MAGNES FOLIA 1',
  'MAGNES FOLIA 1',
  'Magnes wykonany z grubej folii z kolorową grafiką.',
  2.5,
  'MAGNESY',
  '11',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '2eec6c63-1fc4-4700-8fce-da90a8d81923',
  'MAGNES FOLIA 2',
  'MAGNES FOLIA 2',
  'Magnes wykonany z grubej folii z kolorową grafiką.',
  3,
  'MAGNESY',
  '11',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'ab50a44f-e78b-47d6-9514-b927f2a97cd2',
  'BRELOK GRAWER PROSTOKĄT',
  'DK41-108',
  'Brelok metalowy ze stylowym skórzanym wykończeniem! Metalowy element jest grawerowany laserowo.',
  6,
  'BRELOKI',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '95b681c8-24c0-474f-86ed-c078cf17bca5',
  'BRELOK GRAWER OWAL',
  'DK41-108',
  'Brelok metalowy ze stylowym skórzanym wykończeniem! Metalowy element jest grawerowany laserowo.',
  6,
  'BRELOKI',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '1c165a6c-cb13-4301-91e2-fdb6fb3b7247',
  'KUBEK M KOLOR SUB',
  'KUBEK M KOLOR SUB',
  NULL,
  0,
  'CERAMIKA_I_SZKLO',
  '10',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'd1846a24-f77d-4f0b-b373-4cece4d21882',
  'BRELOK GRAWER KOŁO',
  'DK41-108',
  'Brelok metalowy ze stylowym skórzanym wykończeniem! Metalowy element jest grawerowany laserowo.',
  6,
  'BRELOKI',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '5ec5287e-670d-4cbd-b3d3-7296045ff6f3',
  'MAGNES POCZTÓWKA 1',
  'POCZTÓWKA 1',
  NULL,
  0,
  'MAGNESY',
  '5%3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'cfc65bfb-ddf1-418a-88de-777c8c9ca776',
  'BRELOK SERCE MAŁE',
  'BRELOK SERCE MAŁE',
  NULL,
  0,
  'BRELOKI',
  '1.2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'bbfcfeee-8534-46e0-96e9-7ce9eafa4da5',
  'WOREK SPORTOWY',
  'WOREK SPORTOWY',
  NULL,
  0,
  'TEKSTYLIA',
  '4',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '9e7fb2fb-ba64-4282-af9d-3e683e5b0bee',
  'NAKLEJKI FOLIA',
  'NAKLEJKI FOLIA',
  'Produkt do wszelkiego rodzaju naklejek dowolnego kształtu',
  0,
  'MAGNESY',
  '2.1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '55b707ac-7aab-4aa4-a230-6c2242113ad8',
  'BRELOK PREMIUM',
  'BRELOK PREMIUM',
  NULL,
  0,
  'BRELOKI',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '3a6fd302-08ce-49d6-97c2-aa6f962ecd30',
  'ŁYŻECZKA 1',
  'DK42-131',
  NULL,
  0,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '462804ca-29ac-45e8-8e48-cc4c9858e670',
  'AKRYL DOWOLNY KSZTAŁT',
  'AKRYL 1',
  'Magnes wykonany z wyciętego akrylu w kształcie dowolnym. Możliwe nadrukowanie grafiki na powstałym kształcie.',
  4.5,
  'MAGNESY',
  '5.1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '5b55b306-a261-4673-b9b4-fbac5027da68',
  'MAGNES KUBEK',
  'DK42-151',
  NULL,
  0,
  'MAGNESY',
  '2.1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'ebc6189b-a167-4d04-ab0c-55213b10531a',
  'MAGNES AKRYL POLSKA',
  'MAGNES POLSKA',
  'Magnes wykonany z akrylu w kształcie mapy Polski z możliwością nadruku grafiki. Produkt w woreczku.',
  4.5,
  'MAGNESY',
  '1.4',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '25167936-7709-405b-aca8-3d9a1887da1b',
  'BRELOK OBROTOWY KOŁO',
  'BRE OBROTOWY KOŁO',
  'Brelok metalowy z obrotowym i dwustronnie spersonalizowanym elementem. Na jednej stronie  logo z danego miasta, miejscowości (fotografia lub inny wzór), druga strona to  imię lub hasło. Każda sztuka zapakowana na kartoniku.',
  6,
  'BRELOKI',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '2f31cc7d-bf6a-4ab7-9a4c-fd4ae888f197',
  'MAGNES POLIRESING ŻYWICA STER',
  'DK42-055A',
  NULL,
  0,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '141e6dd3-c135-4d79-a43c-95b7e1c68ae0',
  'MAGNES POLIRESING ŻYWICA MUSZLA',
  'DK42-055B',
  NULL,
  0,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '435d6b71-c46e-47c0-86a2-9623f6a3bd47',
  'MAGNES POLIRESING ŻYWICA STATEK',
  'DK42-055C',
  NULL,
  0,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '8902217a-3aef-4d7b-84e0-3356c9324bc4',
  'MAGNES POLIRESING RAMKA 1',
  'DK42-047A',
  NULL,
  0,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'bdd4d5c7-e6cd-427b-b19d-bb263198249d',
  'MAGNES POLIRESING RAMKA 2',
  'DK42-047B',
  NULL,
  0,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'a76b59c6-f0c5-451c-8c9e-467d2c9479a6',
  'BRELOK OBROTOWY PROSTOKĄT',
  'BRE OBROTOWY PROSTOKĄT',
  'Brelok metalowy z obrotowym i dwustronnie spersonalizowanym elementem. Na jednej stronie  logo z danego miasta, miejscowości (fotografia lub inny wzór), druga strona to  imię lub hasło. Każda sztuka zapakowana na kartoniku.',
  6,
  'BRELOKI',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '7809179f-9339-4527-8060-c71bf2b2348a',
  'BRELOK OBROTOWY SERCE',
  'BRE OBROTOWY SERCE',
  'Brelok metalowy z obrotowym i dwustronnie spersonalizowanym elementem. Na jednej stronie  logo z danego miasta, miejscowości (fotografia lub inny wzór), druga strona to  imię lub hasło. Każda sztuka zapakowana na kartoniku.',
  6,
  'BRELOKI',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '358cc1c2-2c31-452a-b271-40061afbbe20',
  'MAGNES HDF',
  'MAGNES HDF',
  'Drewniany magnes z nazwą miejscowości. Magnes wykonany w technologii full color.',
  5,
  'MAGNESY',
  '5$2.1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '21ce8c1d-7667-4777-b4a3-21e7e69ce794',
  'MAGNES DREWNO STER',
  'MAGNES DREWNO',
  'Drewniany magnes posiadający miejsce na wykonanie grafiki ze wzorem. Produkt w woreczku.',
  3.5,
  'MAGNESY',
  '1.3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'a7850ba8-0594-475f-98d8-bbc4ee7a1e66',
  'MAGNES DREWNO KOTWICA',
  'MAGNES DREWNO',
  'Drewniany magnes posiadający miejsce na wykonanie grafiki ze wzorem. Produkt w woreczku.',
  3.5,
  'MAGNESY',
  '1.3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '0eee18ae-132c-4889-9bc7-7239ae75ddfc',
  'MAGNES DREWNO OKULARY',
  'MAGNES DREWNO',
  'Drewniany magnes posiadający miejsce na wykonanie grafiki ze wzorem. Produkt w woreczku.',
  3.5,
  'MAGNESY',
  '1.3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'aa6d4c00-6cd2-48e8-8bee-4f0b90af6147',
  'MAGNES DREWNO LINA',
  'MAGNES DREWNO',
  'Drewniany magnes posiadający miejsce na wykonanie grafiki ze wzorem. Produkt w woreczku.',
  3.5,
  'MAGNESY',
  '1.3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'd8c09f82-e175-491c-b36d-0d07a0ce124c',
  'MAGNES DREWNO ZNACZEK',
  'MAGNES DREWNO',
  'Drewniany magnes posiadający miejsce na wykonanie grafiki ze wzorem. Produkt w woreczku.',
  3.5,
  'MAGNESY',
  '1.3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '0dcb6013-4395-4733-8364-872762e66f68',
  'DŁUGOPIS METAL BAMBUS GUMKA',
  'DK42-037B',
  'Metalowy długopis na którym można wygrawerować metodą laserową małą grafikę ze wzorem. Produkt dostępny w 3 kolorach, zapakowany na  kartce i wytłoczce dopasowanej do kształtu długopisu.',
  3.5,
  'DLUGOPISY',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '6b7025d5-6e62-4d76-83c3-15fd49c47137',
  'MAGNES DREWNO PROSTOKĄT',
  'MAGNES DREWNO',
  'Drewniany magnes posiadający miejsce na wykonanie grafiki ze wzorem. Produkt w woreczku.',
  3.5,
  'MAGNESY',
  '1.3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '02faae2b-f6c6-41fe-84d9-6ddabf96ddb2',
  'MAGNES POLIRESING STER',
  'POLIRESING STER',
  'Magnes wykonany z tworzywa ceramicznego posiadający miejsce na wykonanie grafiki ze wzorem. Produkt zapakowany w woreczku.',
  4.5,
  'MAGNESY',
  '1.4',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'e7ee5e99-b514-43a0-b97c-a57119af9c91',
  'MAGNES HDF GRAF',
  'MAGNES HDF GRAF',
  'Drewniany magnes z nazwą miejscowości. Magnes wykonany w technologii full color.',
  6,
  'MAGNESY',
  '5$2.1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'e74d7087-7c0e-4b53-9dea-23298fe70824',
  'OTWIERACZ OWAL SERCE',
  'DK42-144',
  NULL,
  0,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '15919d8e-a49c-4163-8db2-8358394338d9',
  'OTWIERACZ METAL LOVE',
  'DK42-145',
  NULL,
  0,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '471aa400-5a56-425e-88d4-1c11a1e8752d',
  'OTWIERACZ METAL SERCE',
  'DK42-146',
  NULL,
  0,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '042bb4e0-be06-4f15-b0f5-8dd8ebb605a1',
  'OTWIERACZ METAL LATARNIA',
  'DK42-147',
  NULL,
  0,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'fb2e73ef-3756-4dbd-a69b-289900a73f9c',
  'OTWIERACZ METAL POLSKA',
  'DK42-148',
  NULL,
  0,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '1a3cdebf-dfee-427d-914d-d113a99fffca',
  'OTWIERACZ METAL KUFEL',
  'DK42-153',
  NULL,
  0,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '47b650a7-02a2-492f-ac3a-0860381b8c75',
  'NAPARSTEK',
  'DK42-154',
  NULL,
  0,
  'OZDOBY_DOMOWE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '3f054185-d0a2-43af-9763-61cf93b97c1c',
  'BRELOK I LOVE',
  'DK42-159',
  NULL,
  0,
  'BRELOKI',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '83ebb3c0-a0f9-4c98-8205-83596aaa240e',
  'BRELOK SCYZORYK',
  'DK42-160',
  NULL,
  0,
  'BRELOKI',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '9f42678c-aa79-4632-a7a7-805890ed0c69',
  'ŁYŻECZKA 2',
  'BRAK',
  NULL,
  0,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '4e0be8f9-dcea-45bd-979e-713b8d75dadb',
  'MAGNES HDF ŻYWICA SERCE',
  'HDF ŻYWICA',
  NULL,
  0,
  'MAGNESY',
  '2$5',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'b94e42fc-2e1e-4d8a-b32a-870348723287',
  'KUBEK CERAMICZNY PRL',
  'DK40-KUBEK PRL',
  'Kubek ceramiczny z wygrawerowanym metodą laserową imieniem lub hasłem. Ciekawy produkt w sympatycznym kształcie. Grawer w kolorze białym',
  12,
  'CERAMIKA_I_SZKLO',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '573350f4-5740-407e-8748-41aae4f591ff',
  'KUBEK CERAMICZNY WIELOKOLOROWY',
  'DK37-001A',
  'Kubek ceramiczny z wygrawerowanym metodą laserową nazwą miejscowości lub hasłem. Produkt dostępny w 6 kolorach: jasno fioletowy - niebieski, ciemno fioletowy - różowy, czarno - czerwony, czarno - ciemno niebieski, jasno niebieski - czerwony, czarno - graf',
  12,
  'CERAMIKA_I_SZKLO',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '6972a6ac-7f68-4806-9524-f9504effc08a',
  'DŁUGOPIS BAMBUS GUMKA',
  'DK42-037D',
  'Bambusowy długopis na którym można wygrawerować metodą laserową małą grafikę ze wzorem.',
  3.5,
  'DLUGOPISY',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '40a28810-a2cc-4cc5-a29e-fe72d09d4ea3',
  'POPIELNICZKA METAL CZARNA',
  'DK43-053',
  NULL,
  0,
  'ZAPALNICZKI_I_POPIELNICZKI',
  '2.1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'a65700b1-6948-40c5-808a-5fd40cce1c7f',
  'POPIELNICZKA METAL GRANAT',
  'DK43-053',
  NULL,
  0,
  'ZAPALNICZKI_I_POPIELNICZKI',
  '2.1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'ab45da98-0709-4c5c-9db9-e1ec1fa110d1',
  'TORBA PAPIEROWA E 40X32',
  'DK43-050E1E3L',
  NULL,
  0,
  'UPOMINKI_BIZNESOWE',
  '12',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '506ae397-62d1-4f3c-9601-f9f7fc94ddaa',
  'BRELOK METAL MIŚ',
  'DK43-018',
  NULL,
  0,
  'BRELOKI',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '18cb9915-6417-40c4-bb84-cf24bd8e8195',
  'PODKŁADKA Z KORKA',
  'PODKŁADKA KOREK',
  'Podkładka z korka pod kubek, szklankę. Wykonana z naturalnego korka o średnicy 9,5 cm i grubości 6-7 mm. Produkt zapakowany na stylowej kartce w woreczku.',
  3.5,
  'OZDOBY_DOMOWE',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'b4ef31ce-fc5a-4b25-bd83-7d6b9d95c804',
  'BRELOK ŻYWICA KOŁO',
  'DK43-004 A1',
  NULL,
  0,
  'BRELOKI',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '25c87bb9-1ebf-4b34-b649-b6c02715011a',
  'BRELOK ŻYWICA PROSTOKĄT',
  'DK43-004 A2',
  NULL,
  0,
  'BRELOKI',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '9b3c5259-dfd6-4dc4-bac6-5b8dd0452d68',
  'BRELOK ŻYWICA OWAL',
  'DK43-004 A3',
  NULL,
  0,
  'BRELOKI',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'a2edf5b9-6037-470c-9d37-133303e61bd7',
  'TORBA Z KWADRAT B',
  'DK41-TORBA ECO-Z',
  NULL,
  0,
  'TEKSTYLIA',
  '8',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '320a4b72-b8ff-4f1e-9ce6-5240072860a2',
  'PIERSIÓWKA S2',
  'DK43-010',
  NULL,
  0,
  'AKCESORIA_PODROZNE',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'a80bdea4-3b72-46a9-a780-3cb10655ebd1',
  'PIERSIÓWKA M2',
  'DK43-011',
  NULL,
  0,
  'AKCESORIA_PODROZNE',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '98e7fa41-ce3a-41f5-b46a-565453acb653',
  'PIERSIÓWKA M1',
  'DK43-012',
  NULL,
  0,
  'AKCESORIA_PODROZNE',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '7fab9c2d-df0c-4b16-b3a8-5fc8a97480c2',
  'KIELISZEK METAL',
  'DK43-013A',
  NULL,
  0,
  'AKCESORIA_PODROZNE',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'a65bd61d-85f6-4f08-a29e-c341e9f25960',
  'OTWIERACZ METAL ROWER',
  'DK43-017',
  NULL,
  0,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '3fbbf551-f6f9-4cb3-b371-7c35e3c4d737',
  'OTWIERACZ METAL KARTKA',
  'DK43-019',
  NULL,
  0,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '745f8fd2-412a-4cad-84b1-fc25ae7f0a8e',
  'MAGNES PLAST KUBEK',
  'DK43-020',
  NULL,
  0,
  'AKCESORIA_PODROZNE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'c780d9ec-f926-463e-ac97-70c730ff9f20',
  'OTWIERACZ ŁYŻECZKA SERCE',
  'DK43-022A2',
  NULL,
  0,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '746e526b-0a4e-40fb-b535-91b6d989d786',
  'MAGNES METAL MUSZLA',
  'DK43-023',
  NULL,
  0,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'bb6ee4c6-98ae-48fd-99f8-3524b03ab701',
  'KIELISZEK PLAST SREBRO',
  'DK43-024A',
  NULL,
  0,
  'AKCESORIA_PODROZNE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'e30286db-1f34-42d5-9e66-268af5a3b631',
  'KIELISZEK PLAST ZŁOTO',
  'DK43-024B',
  NULL,
  0,
  'AKCESORIA_PODROZNE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'da0dd0ad-1c5c-47ce-9128-8ab0eab00e01',
  'TORBA Z KWADRAT C',
  'DK41-TORBA ECO-Z',
  NULL,
  0,
  'TEKSTYLIA',
  '4',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '45f9ab03-c86c-4912-b92d-1e928c0a5393',
  'MAGNES METAL KARTKA',
  'MAGNES METAL KARTKA',
  'Magnes wykonany z polerowanego stopu metali z miejscem na naklejkę żywiczną. Możliwość wykonania dowolnej grafiki na naklejce oraz zatopienie w niej elementu ozdobnego. Produkt zapakowany w stylowym woreczku.',
  6.5,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'f62c79ab-d4e5-410c-afe9-c64f95bf8ecf',
  'TORBA Z PROSTOKĄT B',
  'DK41-TORBA ECO-Z',
  NULL,
  0,
  'TEKSTYLIA',
  '8',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'c25eb1b1-0271-49f2-a0ab-3cd702e4bd99',
  'SCYZORYK WIELOFUNKCYJNY',
  'DK28-011',
  'Scyzoryk turystyczny, metalowy, posiada 5 funkcji: nóż, otwieracz do butelek, otwieracz do puszek, korkociąg, śrubokręt Oferujemy 3 kolory: czarny, niebieski, bordowy. Produkt zapakowany w estetycznym i trwałym opakowaniu z tworzywa i kartonika.',
  7,
  'AKCESORIA_PODROZNE',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '99ffe9c1-c174-4627-9bcd-4c1e104a6f6c',
  'TORBA Z PROSTOKĄT C',
  'DK41-TORBA ECO-Z',
  NULL,
  0,
  'TEKSTYLIA',
  '4',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'b2c16cb0-3918-4886-a31c-90cfca907373',
  'LUSTERKO KIESZONKOWE KOŁO',
  'LUSTERKO',
  'Lusterko kieszonkowe otwierane z zewnątrz pokryte materiałem. Produkt zapakowany w kartonik i wypraskę z tworzywa sztucznego.',
  7,
  'AKCESORIA_PODROZNE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '5782a018-22ad-418a-9d0d-4a99d0060a26',
  'LUSTERKO KIESZONKOWE KWADRAT',
  'LUSTERKO',
  'Lusterko kieszonkowe otwierane z zewnątrz pokryte materiałem. Produkt zapakowany w kartonik i wypraskę z tworzywa sztucznego.',
  7,
  'AKCESORIA_PODROZNE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'a668b69e-fdda-419a-aad9-1123b87d47ef',
  'LUSTERKO KIESZONKOWE SERCE',
  'LUSTERKO',
  'Lusterko kieszonkowe otwierane z zewnątrz pokryte materiałem. Produkt zapakowany w kartonik i wypraskę z tworzywa sztucznego.',
  7,
  'AKCESORIA_PODROZNE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '930db4f3-fe6e-4b2b-a109-3909511a7c99',
  'MAGNES METAL PAPIRUS',
  'MAGNES METAL PAPIRUS',
  'Magnes wykonany ze szczotkowanego stopu metali z miejscem na naklejkę żywiczną. Możliwość wykonania dowolnej grafiki na naklejce oraz zatopienie w niej elementu ozdobnego. Produkt zapakowany w stylowym woreczku.',
  6.5,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '9734291c-bf2e-47a1-ada9-2a9992a7d3ca',
  'MAGNES METAL TALERZYK',
  'MAGNES METAL TALERZYK',
  'Magnes wykonany ze szczotkowanego stopu metali z miejscem na naklejkę żywiczną. Możliwość wykonania dowolnej grafiki na naklejce oraz zatopienie w niej elementu ozdobnego. Produkt zapakowany w stylowym woreczku.',
  6.5,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '6e42e00e-1c39-4646-8398-c8bc6a3da815',
  'POPIELNICZKA METAL PŁASKA',
  'DK43-042',
  NULL,
  0,
  'ZAPALNICZKI_I_POPIELNICZKI',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '5d12e12f-aab6-4c64-8971-4be1f10b0b4d',
  'SCYZORYK DREWNO SURVIVAL',
  'DK43-033A',
  NULL,
  0,
  'AKCESORIA_PODROZNE',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '6d59d3c5-9060-4e65-84a1-88faff46d202',
  'MULTITOOL',
  'DK43-033B',
  NULL,
  0,
  'AKCESORIA_PODROZNE',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'b55dcf85-6f69-4399-a84b-deb51bb912e2',
  'OTWIERACZ DREWNO OWAL',
  'DK43-033C',
  NULL,
  0,
  'OTWIERACZE',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'e7043cae-27b5-4018-8bc9-3c6daf6eebe6',
  'NIEZBĘDNIK',
  'DK43-033D',
  NULL,
  0,
  'AKCESORIA_PODROZNE',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '672884d3-3828-4006-a3a9-4783e3fbb528',
  'SCYZORYK DREWNO MINI',
  'DK43-033E',
  NULL,
  0,
  'AKCESORIA_PODROZNE',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'cdc2d84e-ffba-423b-a4dc-c7253282c355',
  'ŁYŻKA DO BUTÓW',
  'DK43-041',
  NULL,
  0,
  'OZDOBY_DOMOWE',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'd2ba6149-889b-406c-a285-9bbf257fa77e',
  'PIRAMIDA SZKŁO MINI',
  'PIRAMIDA SZKŁO MINI',
  NULL,
  0,
  'UPOMINKI_BIZNESOWE',
  '1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '4649623f-6261-4c5b-8667-267d1fca7fa2',
  'KUBEK METAL MAŁY',
  'DK43-047',
  NULL,
  0,
  'AKCESORIA_PODROZNE',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '9b3490d0-fd60-4b22-9684-ec74fcec773e',
  'MAGNES METAL KAPSEL',
  'DK32-KAPSEL METAL',
  'Metalowy kapsel z magnesem o średnicy 42 mm. Grafika wykonana na zadrukowanej folia i pokryta żywicą.  Produkt zapakowany  w woreczku.',
  3,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'f0eb42c5-fb75-4fad-a289-fa4e70aa925d',
  'MAGNES METAL I LOVE',
  'MAGNES I LOVE',
  'Metalowy magnes wykonany w wysokiej jakości. Sympatyczna pamiątka  i  praktyczna ozdoba. Możliwość wykonania dowolnej grafiki klienta.',
  4.5,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '93285de1-e44e-4ab3-9eda-7d774f022531',
  'MAGNES POLIRESING ZNAK',
  'POLIRESING ZNAK',
  'Magnes wykonany z tworzywa ceramicznego posiadający miejsce na wykonanie grafiki ze wzorem. Produkt zapakowany w woreczku.',
  4.5,
  'MAGNESY',
  '1.4',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'f4ec7254-8d6b-4194-b5ce-240b59b6ba32',
  'MAGNES POLIRESING KAMIENIE',
  'POLIRESING KAMIENIE',
  'Magnes wykonany z tworzywa ceramicznego posiadający miejsce na wykonanie grafiki ze wzorem. Produkt zapakowany w woreczku.',
  4.5,
  'MAGNESY',
  '1.4',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '139106ea-3879-454e-aa76-9baadc9a1440',
  'MAGNES POLIRESING KOTWICA',
  'POLIRESING KOTWICA',
  'Magnes wykonany z tworzywa ceramicznego posiadający miejsce na wykonanie grafiki ze wzorem. Produkt zapakowany w woreczku.',
  4.5,
  'MAGNESY',
  '1.4',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '7c5fa5c6-5176-4f5b-b154-d0efdfc987b8',
  'MAGNES POLIRESING MUSZLA',
  'POLIRESING MUSZLA',
  'Magnes wykonany z tworzywa ceramicznego posiadający miejsce na wykonanie grafiki ze wzorem. Produkt zapakowany w woreczku.',
  4.5,
  'MAGNESY',
  '1.4',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'bca1c279-c4e7-4aa2-8121-a31fdfd519a3',
  'MAGNES POLIRESING SERCE',
  'POLIRESING SERCE',
  'Magnes wykonany z tworzywa ceramicznego posiadający miejsce na wykonanie grafiki ze wzorem. Produkt zapakowany w woreczku.',
  4.5,
  'MAGNESY',
  '1.4',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'd6f774de-db1a-4c22-a7f7-a480f3bdabfb',
  'MAGNES POLIRESING ŻAGLÓWKA',
  'POLIRESING ŻAGLÓWKA',
  'Magnes wykonany z tworzywa ceramicznego posiadający miejsce na wykonanie grafiki ze wzorem. Produkt zapakowany w woreczku.',
  4.5,
  'MAGNESY',
  '1.4',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '9ce32d18-097c-4c6b-be45-1b5a8195fb05',
  'MAGNES SZKŁO KOŁO',
  'MAGNES SZKŁO',
  'Magnes wykonane ze szkła z nadrukowaną grafiką. Produkt zapakowany w woreczku.',
  4,
  'MAGNESY',
  '1.1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '01d9cf3c-ba43-4fb7-9c26-6332900f77b0',
  'MAGNES SZKŁO OWAL',
  'MAGNES SZKŁO',
  'Magnes wykonane ze szkła z nadrukowaną grafiką. Produkt zapakowany w woreczku.',
  4,
  'MAGNESY',
  '1.1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'ae06070b-e26f-4117-b186-f8d385d010a2',
  'MAGNES SZKŁO SERCE',
  'MAGNES SZKŁO',
  'Magnes wykonane ze szkła z nadrukowaną grafiką. Produkt zapakowany w woreczku.',
  4,
  'MAGNESY',
  '1.1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '28a1630c-1590-46fe-8636-e2c0a28c50cf',
  'MAGNES SZKŁO MUSZLA',
  'MAGNES SZKŁO',
  'Magnes wykonane ze szkła z nadrukowaną grafiką. Produkt zapakowany w woreczku.',
  4,
  'MAGNESY',
  '1.1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '1c3824ff-0c7c-4f7a-99f8-314046160782',
  'MAGNES SZKŁO KOSZULKA',
  'MAGNES SZKŁO',
  'Magnes wykonane ze szkła z nadrukowaną grafiką. Produkt zapakowany w woreczku.',
  4,
  'MAGNESY',
  '1.1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '8e911027-8eb2-454d-a7a7-d881619e5097',
  'MAGNES SZKŁO PROSTOKĄT OBŁY',
  'MAGNES SZKŁO',
  'Magnes wykonane ze szkła z nadrukowaną grafiką. Produkt zapakowany w woreczku.',
  4,
  'MAGNESY',
  '1.1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '162a3694-1a24-4c91-b97b-320d58b4223c',
  'MAGNES SZKŁO PROSTOKĄT OSTRY',
  'MAGNES SZKŁO',
  'Magnes wykonane ze szkła z nadrukowaną grafiką. Produkt zapakowany w woreczku.',
  4,
  'MAGNESY',
  '1.1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'f92ec6e0-9c5d-48e8-a8e2-6cc7c276b5a2',
  'MAGNES SKLEJKA MAZAK',
  'SKLEJKA MAZAK',
  'Ozdobny magnes - kolorowanka wykonany ze sklejki. Możliwość wykonania dowolnej prostej grafiki w dowolnym kształcie. Do magnesu dołączony komplet 6 mazaków. Produkt zapakowany w woreczku.',
  6,
  'MAGNESY',
  '5',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'ea01f2e0-2355-4e1e-a2ff-a20eed0c91fe',
  'MAGNES SKLEJKA SZKŁO',
  'SKLEJKA SZKŁO',
  'Ozdobny magnes wykonany ze sklejki z doklejonym szklanym elementem. Możliwość wykonania dowolnej prostej grafiki w dowolnym kształcie na sklejce i dowolnej grafiki na szklanym elemencie. Produkt zapakowany w woreczku.',
  6.5,
  'MAGNESY',
  '5.1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '308c0c26-984b-47a0-ba6c-31c2fcf1af62',
  'MAGNES ECO KOŁO',
  'DK38-007B',
  'Magnes wykonany z drewna z wypaloną grafiką. Możliwość wykonania dowolnej prostej grafiki.',
  3,
  'MAGNESY',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '0e00d43b-5ec8-4ee7-a449-973763b059c4',
  'MAGNES ECO OWAL',
  'DK38-007C',
  'Magnes wykonany z drewna z wypaloną grafiką. Możliwość wykonania dowolnej prostej grafiki.',
  3,
  'MAGNESY',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '6d573ca9-e97d-4e25-a7c3-a58243cbbd58',
  'MAGNES ŻYWICA IMIĘ',
  'MAGNES ŻYWICA IMIĘ',
  'Żywicowany magnes o wysokiej wartości estetycznej. Elegancka pamiątka okolicznościowa zapakowana w stylowym woreczku. Możliwość wykonania na produkcie grafiki klienta. Planowane 6 oryginalnych wzorów ze zdjęciem miejscowości i imieniem.',
  5,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'be02714a-8081-467a-b7e8-72996f106bfe',
  'MAGNES PROSTOKĄT PAPIEROWY',
  'MAGNES',
  'Prosty i elegancki magnes upominkowy wykonany ze specjalistycznego papieru. Możliwe wykonanie dowolnej grafiki na elemencie.',
  3,
  'MAGNESY',
  '999',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '1d4899cd-90e7-4845-97fa-4d5837793fc6',
  'MAGNES OBRAZ',
  'MAGNES OBRAZ',
  'Miniaturowy obraz będący jednocześnie magnesem. Stanowi estetyczną i praktyczną pamiątkę z możliwością umieszczenia dowolnej grafiki klienta.',
  4.5,
  'MAGNESY',
  '1.3',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '23973089-0df1-481d-b581-d4abd4c6c984',
  'MAGNES PIANKA',
  'MAGNES 3D',
  'Magnesy wykonane z wytłaczanej pianki. Każdy magnes posiada miejsce na wykonanie grafiki ze wzorem. Produkt zapakowany w woreczku.',
  3.5,
  'MAGNESY',
  '1.2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '45dd0df5-8cc9-4e95-9db0-d2ae29898584',
  'ZŁOTA RYBKA',
  'DK41-077B',
  'Magnes wykonany z tworzywa ceramicznego posiadający miejsce na wykonanie grafiki ze wzorem. Produkt zapakowany w woreczku.',
  4,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '69912cb4-a6ed-4d06-8a25-f4a9510015bf',
  'MAGNES NÓŻKI',
  'DK41-077A',
  'Magnes wykonany z tworzywa ceramicznego posiadający miejsce na wykonanie grafiki ze wzorem. Produkt zapakowany w woreczku.',
  5,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'f4fbe0e5-482e-4ccc-be58-62a0de4cfa5a',
  'MAGNES MDF',
  'MAGNES MDF',
  'Drewniany magnes posiadający miejsce na wykonanie grafiki ze wzorem. Produkt w woreczku.',
  3.5,
  'MAGNESY',
  '5.1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'f798324f-032a-4462-98a5-2a36e6f5fcfe',
  'MAGNES MDF IMIĘ',
  'MAGNES MDF IMIĘ',
  'Drewniany magnes posiadający miejsce na wykonanie grafiki ze wzorem. Produkt w woreczku.',
  5,
  'MAGNESY',
  '5.1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '91cb4ee0-2488-4a43-bd9d-5867a8571b97',
  'MAGNES FOLIA',
  'MAGNES FOLIA',
  'Barwny magnes wykonany w technologii full color. Posiada miejsce na wykonanie grafiki ze wzorem. Ciekawa i elegancka pamiątka.',
  2.5,
  'MAGNESY',
  '11',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '93c15f4c-21bc-498d-a8ec-530d613584be',
  'BRELOK METALOWY GRAWEROWANY',
  'DK18-014',
  'Brelok metalowy z wygrawerowanym metodą laserową imieniem, znakiem zodiaku lub grupa krwi. Kolory breloków : czerwony, czarny. Produkt zapakowany na stylowej kartce w woreczku.',
  4.5,
  'BRELOKI',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'e5807daa-5c8a-4123-9dee-d0bef4e2db15',
  'BRELOK METALOWY Z DŻETAMI',
  'DK28-016A',
  'Brelok metalowy z dżetami z wygrawerowanym metodą laserową imieniem. Oferujemy brelok  w kształcie serca. Produkt zapakowany na stylowej kartce w woreczku.',
  5,
  'BRELOKI',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'c1f04ec8-314f-41f7-9d45-5d91ab2eef81',
  'BRELOK OBCINACZKI OTWIERACZ',
  'DK41-031C',
  'Brelok, otwieracz i obcinaczki do paznokci w jednym. Metalowe i solidne wykonanie. Na zewnątrz posiada miejsce wypełnione żywicą/logo. Produkt zapakowany w woreczek.',
  5,
  'BRELOKI',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'dd840d2f-78ff-4cfe-b854-14f8ff21cb47',
  'BRELOK OTWIERACZ METAL KAPSEL',
  'BRELOK OTWIERACZ-3',
  'Brelok  z funkcją otwieracza do butelek w kształcie kapsla. Produkt wykonany ze stopu metali z miejscem na naklejkę żywiczną. Możliwość wykonania dowolnej grafiki na naklejce. Produkt zapakowany w woreczek i karteczkę',
  5,
  'BRELOKI',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '894ab009-de6f-4dd4-85ea-b2ebf73a0052',
  'BRELOK OTWIERACZ METAL STOPA',
  'BRELOK OTWIERACZ-2',
  'Brelok  z funkcją otwieracza do butelek w kształcie stopy. Produkt wykonany ze stopu metali z miejscem na naklejkę żywiczną. Możliwość wykonania dowolnej grafiki na naklejce. Produkt zapakowany w woreczek i karteczkę',
  5,
  'BRELOKI',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '1a92da77-5cba-457f-8b6f-0835b269461a',
  'BRELOK OTWIERACZ SCYZORYK',
  'DK41-031D',
  'Metalowy brelok ze scyzorykiem, otwieraczem do butelek i korkociągiem. Na zewnątrz posiada miejsce wypełnione żywicą/logo. Możliwe wykonanie dowolnej grafiki ze wzorem. Produkt zapakowany w woreczku.',
  5,
  'BRELOKI',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'bc854d43-07ee-42a7-8134-ce2b44553f4e',
  'BRELOK OTWIERACZ SZKŁO',
  'BR OTWIERACZ 2',
  'Okrągły otwieracz na którym możliwe jest wykonanie grafiki ze wzorem wykonanym na szklanym elemencie. Produkt zapakowany w woreczku ze stylową karteczką.',
  6,
  'BRELOKI',
  '1.1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '040a8501-62f3-452e-af5f-237d0a2ebc5c',
  'BRELOK POTRÓJNY KARTKA',
  'BRELOK METAL KARTKA',
  'Brelok metalowy wykonany z polerowanej stali złożony z 3 elementów ozdobionych naklejką żywiczną. Produkt zapakowany na stylowej kartce w woreczku.',
  5,
  'BRELOKI',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'e88d7cdb-b06a-461f-905e-e5e4ca938043',
  'BRELOK POTRÓJNY SERCE',
  'BRELOK METAL SERCE',
  'Brelok metalowy wykonany z polerowanej stali złożony z 3 elementów ozdobionych naklejką żywiczną. Produkt zapakowany na stylowej kartce w woreczku.',
  5,
  'BRELOKI',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '30ccb349-0a8f-40a0-886b-2286294a121d',
  'BRELOK SERCE AKRYL',
  'DK30-BRELOK SERCE',
  'Brelok z akrylu w kształcie serca z imieniem dziewczynki. Produkt dostępny w 3 kolorach, zapakowany na stylowej kartce w woreczku.',
  5,
  'BRELOKI',
  '1.2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '7c951891-18ad-4833-9eb6-ff411c79adce',
  'BRELOK SILIKONOWY',
  'DK29-054E',
  'Brelok wykonany z elastycznego silikonu z miejscem na grawer. Produkt dostępny w 6 kolorach.',
  2.5,
  'BRELOKI',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'b41a9e6f-dbab-4fbe-9bfd-44ed5e35a12e',
  'BRELOK TABLICA',
  'BRELOK TABLICA',
  'Prostokątny, metalowy brelok z możliwością wklejenia za żywicowanej grafiki. Możliwość wykonania produktu z dowolną grafiką klienta.',
  5,
  'BRELOKI',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '4f3b3c13-faec-4482-bdd3-411e925a8358',
  'BRELOK TAŚMA',
  'BRELOK TAŚMA',
  'Brelok w formie elastycznej tasiemki z poliestru z metalowym zapięciem. Idealny przedmiot do plecaka, torby podróżnej,  kluczy lub jako wykończenie zamka błyskawicznego kurtki. Brelok posiada nadrukowane elementy z imieniem, hasłem,  grafiką lub nazwą mie',
  4.5,
  'BRELOKI',
  '4',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '59433391-d6bb-4240-83a2-2341bd483b65',
  'KORKOCIĄG BUTELKA',
  'KORKOCIĄG-1',
  'Plastikowy korkociąg w kształcie butelki z winem. Możliwe wykonanie dowolnej grafiki ze wzorem. Produkt zapakowany w stylowym woreczku.',
  6,
  'OTWIERACZE',
  '2.1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '9b501b90-a4c9-43d1-9a81-c7d460c07f2e',
  'KORKOCIĄG OTWIERACZ',
  'KORKOCIĄG-2',
  'Plastikowy korkociąg  z otwieraczem do butelek. Możliwe wykonanie dowolnej grafiki ze wzorem. Produkt zapakowany w stylowym woreczku.',
  7,
  'OTWIERACZE',
  '2.1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '8c07f93c-c2eb-4b04-9d1a-e5ed5e4337cd',
  'MAGNES OTWIERACZ BUTELKA',
  'MAGNES OTWIERACZ',
  'Otwieracz w formie butelki stylizowanej na butelkę alkoholu, dodatkowo posiada magnes. Oferujemy 8 wzorów butelek. Produkt zapakowany w woreczek i karteczkę',
  5.5,
  'OTWIERACZE',
  '2.1',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '44cc28af-52eb-4ddf-af7c-df1ea505b448',
  'OTWIERACZ KAPSEL CHROM',
  'DK32-KAPSEL CHROM',
  'Otwieracz i zatyczka do butelek w kształcie kapsla z funkcją magnesu na lodówkę. Wykonany z wysokiej jakości tworzywa sztucznego, pokryty powłoką imitującą chrom.',
  6.5,
  'OTWIERACZE',
  '1.5',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '62b5a6ea-9e4c-4f66-9b03-52e99edb64f2',
  'OTWIERACZ KAPSEL CHROM',
  'CHROM-ŻYWICA',
  'Otwieracz i zatyczka do butelek w kształcie kapsla z funkcją magnesu na lodówkę. Wykonany z wysokiej jakości tworzywa sztucznego, pokryty powłoką imitującą chrom.',
  7.5,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '95adaea0-191d-4d14-abea-75dbba0b02c4',
  'OTWIERACZ METAL KOSZULKA',
  'OTWIERACZ KOSZULKA',
  'Otwieracz do butelek posiadający magnes. Produkt wykonany ze stopu metali z miejscem na naklejkę żywiczną. Możliwość wykonania dowolnej grafiki na naklejce oraz zatopienie w niej elementu ozdobnego. Produkt zapakowany w woreczek.',
  6,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'af9a7b43-d664-41b8-ae8b-7deda9bdcb28',
  'OTWIERACZ METAL KOTWICA',
  'OTWIERACZ KOTWICA',
  'Otwieracz do butelek posiadający magnes. Produkt wykonany ze stopu metali z miejscem na naklejkę żywiczną. Możliwość wykonania dowolnej grafiki na naklejce oraz zatopienie w niej elementu ozdobnego. Produkt zapakowany w woreczek.',
  6,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '0d80c9da-0a74-4102-acc5-21d70a1b6bda',
  'OTWIERACZ METAL MOSIĄDZ',
  'OTWIERACZ METAL MOSIĄDZ',
  'Otwieracz do butelek posiadający magnes. Produkt wykonany ze stopu metali z miejscem na naklejkę żywiczną. Możliwość wykonania dowolnej grafiki na naklejce oraz zatopienie w niej elementu ozdobnego. Produkt zapakowany w woreczek.',
  6,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.404Z',
  '2025-08-17T14:39:10.404Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '2340392c-b77e-4074-b9c1-5f7ed603e68b',
  'OTWIERACZ METAL OWAL',
  'OTWIERACZ OWAL',
  'Otwieracz do butelek posiadający magnes. Produkt wykonany ze stopu metali z miejscem na naklejkę żywiczną. Możliwość wykonania dowolnej grafiki na naklejce oraz zatopienie w niej elementu ozdobnego. Produkt zapakowany w woreczek.',
  6,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'f93b3569-4ddf-435b-95ae-ebea7f89da96',
  'OTWIERACZ METAL STER',
  'OTWIERACZ STER',
  'Otwieracz do butelek posiadający magnes. Produkt wykonany ze stopu metali z miejscem na naklejkę żywiczną. Możliwość wykonania dowolnej grafiki na naklejce oraz zatopienie w niej elementu ozdobnego. Produkt zapakowany w woreczek.',
  6,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'e52e60a2-3e37-4e14-a0e3-250fbe045dcb',
  'OTWIERACZ PLAST KOŁO',
  'OTWIERACZ PLAST',
  'Otwieracz do butelek posiadający magnes. Produkt wykonany z plastiku, możliwe jest nadrukowanie dowolnej grafiki.',
  4,
  'OTWIERACZE',
  '1.4',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'ddac4cc9-a6f0-4e08-9f72-d14f8a410ad8',
  'OTWIERACZ PLAST KOŁO ŻYWICA',
  'OTWIERACZ ŻYWICA',
  'Otwieracz do butelek posiadający magnes. Produkt wykonany z plastiku, możliwe jest nadrukowanie dowolnej grafiki.',
  5,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '13b32c74-2c84-47d6-843a-42d56b481630',
  'OTWIERACZ PLAST OWAL',
  'OTWIERACZ PLAST',
  'Otwieracz do butelek posiadający magnes. Produkt wykonany z plastiku, możliwe jest nadrukowanie dowolnej grafiki.',
  4,
  'OTWIERACZE',
  '1.4',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'a21f97ae-1ab0-4e12-8956-e733d4ee5a51',
  'OTWIERACZ PLAST OWAL ŻYWICA',
  'OTWIERACZ ŻYWICA',
  'Otwieracz do butelek posiadający magnes. Produkt wykonany z plastiku, możliwe jest nadrukowanie dowolnej grafiki.',
  5,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '044e78ff-38f9-4c92-a327-28c94b1a3c8f',
  'OTWIERACZ PLAST PROSTOKĄT',
  'OTWIERACZ PLAST',
  'Otwieracz do butelek w kształcie prostokąta posiadający magnes. Produkt wykonany z plastiku, możliwe jest nadrukowanie dowolnej grafiki.',
  4,
  'OTWIERACZE',
  '1.4',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '4d1a7ff5-0b0a-473d-b591-924d45ab5d21',
  'OTWIERACZ PLAST PROSTOKĄT ŻYWICA',
  'OTWIERACZ ŻYWICA',
  'Otwieracz do butelek w kształcie prostokąta posiadający magnes. Produkt wykonany z plastiku, możliwe jest nadrukowanie dowolnej grafiki.',
  5,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '01f467ef-4151-46c8-a40c-2c1b24104696',
  'BRANSOLETKA SZKŁO IMIĘ 1',
  'BRANSOLETKA SZKŁO',
  'Bransoletka wykonana ze skóry, sznurka i elementów metalowych oraz szklanego elementu na którym wykonano grafikę. Produkt zapakowany na stylowej kartce w woreczku.',
  4,
  'BRANSOLETKI',
  '1.1',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'ed437957-fb53-4ea2-bf7f-d6a687bd2133',
  'BRANSOLETKA SZKŁO IMIĘ 2',
  'BRANSOLETKA SZKŁO',
  'Bransoletka wykonana ze skóry, sznurka i elementów metalowych oraz szklanego elementu na którym wykonano grafikę. Produkt zapakowany na stylowej kartce w woreczku.',
  4,
  'BRANSOLETKI',
  '1.1',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'b3ebbbb2-f09c-4373-b9cc-d92f9082e505',
  'BRANSOLETKA SZNURKOWA',
  'DK32-SZNUREK',
  'Bransoletka wykonana z miękkiego kolorowego sznurka z plastikowym elementem do graweru. Oferujemy 6 modnych kolorów po 3 dla dziewczynki i chłopca. Produkt zapakowany na stylowej kartce w woreczku.',
  3.5,
  'BRANSOLETKI',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '9593212b-8cf9-4be1-a5f4-48273d1cdc56',
  'CHUSTA WIELOFUNKCYJNA IMIENNA',
  'CHUSTA MULTI',
  'Chusty wielofunkcyjna w formie komina z możliwością wykonania dowolnej grafiki. Brak niewygodnych szwów, wykonana z elastycznego poliestru. Idealna na codzienne spacery, oraz aktywnego spędzania czasu, dla dorosłych jak i dzieci.(WERSJA Z IMIONAMI DZIECI)',
  5,
  'TEKSTYLIA',
  '8',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '6231fc5b-15c0-4168-867e-24120c9985e6',
  'CHUSTA WIELOFUNKCYJNA Z APLIKACJĄ',
  'CHUSTA MULTI',
  'Chusty wielofunkcyjna w formie komina z możliwością wykonania dowolnej grafiki. Brak niewygodnych szwów, wykonana z elastycznego poliestru. Idealna na codzienne spacery, oraz aktywnego spędzania czasu, dla dorosłych jak i dzieci.',
  5,
  'TEKSTYLIA',
  '8',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '225eeb24-e4c7-4ed0-bfc5-5372fa8beecc',
  'PORTFEL ETUI 2',
  'DK41-ECO PORTFEL 1',
  'Portfel / etui z zamkiem wykonany z bawełny, wymiar 9,5  x 18 cm. Produkt dostępny w 2 kolorach: czarny i naturalny eco, dodatkowo zawieszka. Możliwe wykonanie nadruku w pełnym kolorze wierzchniej strony wliczone w cenę.',
  5,
  'TEKSTYLIA',
  '4',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '407b19a6-6c5e-4cea-9d94-b67fd926bb0a',
  'SKARPETA DUŻA',
  'SKARPETA D',
  'Skarpetki - stopki dla młodzieży i dorosłych, wykonane z bawełny i domieszki poliestru. W regularnej ofercie posiadamy 240 wzorów. Wzory zostały opracowane przez naszych grafików pod kątem najnowszych trendów i oczekiwań rynkowych. Każda sztuka zapakowana',
  5.5,
  'TEKSTYLIA',
  '8',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '57f93e34-4407-4bab-bec9-47eace4f7dc1',
  'OPAKOWANIE NA BUTELKĘ BAWEŁNIANE',
  'OP BUTELKA 3 - BAWEŁNA',
  'Opakowanie prezentowe na butelkę, produkt  dostępny w wielu wzorach pasujących na różnorodne okazje. Produkt wykonany z bawełny z aplikacją.',
  5,
  'TEKSTYLIA',
  '4',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '9fb6448c-1d0c-46c3-b3af-cf06443e744f',
  'OPAKOWANIE NA BUTELKĘ LNIANE',
  'OP BUTELKA 2 - LEN',
  'Opakowanie prezentowe na butelkę, produkt  dostępny w wielu wzorach pasujących na różnorodne okazje. Produkt wykonany z lnu z aplikacją.',
  4.5,
  'TEKSTYLIA',
  '4',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'e8731101-e5dc-409f-b712-b01920c3b348',
  'OPAKOWANIE NA BUTELKĘ Z ORGANZY',
  'OP BUTELKA 1 - ORGANZA',
  'Opakowanie prezentowe na butelkę, produkt  dostępny w wielu wzorach pasujących na różnorodne okazje. Produkt wykonany z organzy z aplikacją, dostępny w 4 kolorach.',
  3.5,
  'TEKSTYLIA',
  '4',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '861771a0-f712-4f70-b53b-b6885a77f13a',
  'RAMKA DUŻA 1',
  'RAMKA FOTO',
  'Ramka do zdjęć o wymiarze zdjęcia 10 x 15 cm, możliwość ustawienia w pionie lub poziomie. Zadruk ramki oraz pola pod wypełnienie żywicą. Dostępne około 10 wzorów, lub wg. wzoru klienta. Ramka wykonana z Materiału drewnopochodnego MDF.',
  12,
  'OZDOBY_DOMOWE',
  '1.6',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'c079f2fe-48a4-4f4e-bc4b-38a9ee5e22f2',
  'RAMKA DUŻA 2',
  'RAMKA FOTO',
  'Ramka do zdjęć o wymiarze zdjęcia 10 x 15 cm, możliwość ustawienia w pionie lub poziomie. Zadruk ramki oraz pola pod wypełnienie żywicą. Dostępne około 10 wzorów, lub wg. wzoru klienta. Ramka wykonana z Materiału drewnopochodnego MDF.',
  12,
  'OZDOBY_DOMOWE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '04133e15-2cbd-418b-b15d-3d9889319469',
  'RAMKA DUŻA 3',
  'RAMKA FOTO',
  'Ramka do zdjęć o wymiarze zdjęcia 10 x 15 cm, możliwość ustawienia w pionie lub poziomie. Zadruk ramki oraz pola pod wypełnienie żywicą. Dostępne około 10 wzorów, lub wg. wzoru klienta. Ramka wykonana z Materiału drewnopochodnego MDF.',
  12,
  'OZDOBY_DOMOWE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '92a8c116-8985-4caf-916e-590b06241ffd',
  'RAMKA DUŻA 4',
  'RAMKA FOTO',
  'Ramka do zdjęć o wymiarze zdjęcia 10 x 15 cm, możliwość ustawienia w pionie lub poziomie. Zadruk ramki oraz pola pod wypełnienie żywicą. Dostępne około 10 wzorów, lub wg. wzoru klienta. Ramka wykonana z Materiału drewnopochodnego MDF.',
  12,
  'OZDOBY_DOMOWE',
  '1.6',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'b80113a3-6f63-4d10-9ffd-bc0e2c019d0f',
  'RAMKA MAŁA 1',
  'RAMKA FOTO',
  'Ramka do zdjęć o wymiarze zdjęcia 9 x 13 cm, możliwość ustawienia w pionie lub poziomie. Zadruk ramki oraz pola pod wypełnienie żywicą. Dostępne około 10 wzorów, lub wg. wzoru klienta. Ramka wykonana z Materiału drewnopochodnego MDF.',
  12,
  'OZDOBY_DOMOWE',
  '1.6',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '14090494-b4fd-4d91-9581-5dd75722b3ef',
  'RAMKA MAŁA 2',
  'RAMKA FOTO',
  'Ramka do zdjęć o wymiarze zdjęcia 9 x 13 cm, możliwość ustawienia w pionie lub poziomie. Zadruk ramki oraz pola pod wypełnienie żywicą. Dostępne około 10 wzorów, lub wg. wzoru klienta. Ramka wykonana z Materiału drewnopochodnego MDF.',
  12,
  'OZDOBY_DOMOWE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'db429dad-96dc-42c2-ba8a-90b0cd910139',
  'RAMKA MAŁA 3',
  'RAMKA FOTO',
  'Ramka do zdjęć o wymiarze zdjęcia 9 x 13 cm, możliwość ustawienia w pionie lub poziomie. Zadruk ramki oraz pola pod wypełnienie żywicą. Dostępne około 10 wzorów, lub wg. wzoru klienta. Ramka wykonana z Materiału drewnopochodnego MDF.',
  12,
  'OZDOBY_DOMOWE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'f47281f1-d8d2-422e-b98f-1f04e55ad4ff',
  'RAMKA MAŁA 4',
  'RAMKA FOTO',
  'Ramka do zdjęć o wymiarze zdjęcia 9 x 13 cm, możliwość ustawienia w pionie lub poziomie. Zadruk ramki oraz pola pod wypełnienie żywicą. Dostępne około 10 wzorów, lub wg. wzoru klienta. Ramka wykonana z Materiału drewnopochodnego MDF.',
  12,
  'OZDOBY_DOMOWE',
  '1.6',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'f7e9a266-cd60-4a15-9332-3e52c56c40ca',
  'TERMOMETR MDF',
  'DK41-TERMOMETR',
  'Termometr wykonany z drewna dostępny w wielu ciekawych wzorach. Spora skala ułatwia odczytanie temperatury.',
  8,
  'OZDOBY_DOMOWE',
  '1.6',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '9e27517f-a4c9-48a3-bda1-1d43fe191ded',
  'ETUI NA OKULARY',
  'ETUI OKULARY',
  'Kolorowe etui na okulary wykonane z twardego materiału. Możliwość nadrukowania dowolnej grafiki na wierzchniej stronie pokrowca.',
  8.5,
  'AKCESORIA_PODROZNE',
  '1.7',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'ce39457d-b6e9-450e-8276-34b05cc02c2b',
  'KŁÓDKA DUŻA',
  'DK39-017A1',
  'Pamiątkowa kłódeczka z miejscem na wykonanie grafiki. Możliwe wykonanie dowolnej grafiki, wymiar 33mm.',
  6,
  'AKCESORIA_PODROZNE',
  '1.7',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '00d41d0d-ba8e-4fd3-9d0b-d6c6d8c515ed',
  'PORTFEL SPORTOWY',
  'DK32-PORTFEL',
  'Portfele wykonane z wodoodpornego materiału i wysokiej jakość nadruku typu „hot sticker”. Każdy portfel posiada sznurek umożliwiający zamocowanie do szlufki  spodni lub na szyi, praktyczne 2 kieszenie na zamek do przechowywania banknotów oraz monet. Oferu',
  7.5,
  'AKCESORIA_PODROZNE',
  '4',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '80425267-7cba-4e2f-a67f-d7bda3ad7f43',
  'PUDEŁKO NA LEKI KOŁO',
  'DK41-031B KOŁO',
  'Pudełko kieszonkowe zawierające przegródki wewnętrzne na leki. Pudełko na zewnątrz posiada miejsce wypełnione żywicą/logo. Produkt zapakowany w woreczek.',
  7,
  'AKCESORIA_PODROZNE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'b1b8b2d5-868b-4a15-a83d-00ee1383b32b',
  'PUDEŁKO NA LEKI PROSTOKĄT',
  'DK41-031B',
  'Pudełko kieszonkowe zawierające przegródki wewnętrzne na leki. Pudełko na zewnątrz posiada miejsce wypełnione żywicą/logo. Produkt zapakowany w woreczek.',
  7,
  'AKCESORIA_PODROZNE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'bccfd3fe-c4a9-4953-a836-c5119a3a9324',
  'SCYZORYK WIELOFUNKCYJNY XL',
  'DK41-SCYZORYK',
  'Scyzoryk turystyczny, metalowy, posiada 11 funkcji. Oferujemy 3 kolory: czarny, niebieski, bordowy. Produkt zapakowany w estetycznym i trwałym opakowaniu z tworzywa i kartonika.',
  10,
  'AKCESORIA_PODROZNE',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '2f8156d4-163a-42e2-b6aa-d60a550d0494',
  'ZAWIESZKA DO WALIZKI ECO',
  'DK39-EKO5',
  'Praktyczna i funkcjonalna pamiątka z grawerem wykonanym laserowo. Skutecznie pomaga w oznakowaniu bagażu w każdej podróży. Dostępne kolory:  Czarny ze srebrnym grawerem, Brązowy z czarnym grawerem i Beżowy z czarnym grawerem. Brak możliwości zmiany koloru',
  7.5,
  'AKCESORIA_PODROZNE',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '9c6005dd-6254-4bc9-a156-7479c27f0d68',
  'ZAWIESZKA DO WALIZKI PLASTIK',
  'ZAW WALIZKA',
  'Praktyczna i funkcjonalna pamiątka z możliwością wykonania dowolnej grafiki.  Skutecznie pomaga w oznakowaniu bagażu w każdej podróży.',
  4,
  'AKCESORIA_PODROZNE',
  '1.7',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '53243e51-ea15-4573-b677-7aca2e2d8b78',
  'LUSTERKO METAL SERCE',
  'DK41-031A SERCE',
  'Lusterko kieszonkowe oferowane w 3 kształtach: serce, owal, kwadrat. Lusterko metalowe z zewnątrz miejsce wypełnione żywicą/logo. Produkt zapakowany w woreczek.',
  7.5,
  'AKCESORIA_PODROZNE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '8ae0befa-01e3-488e-8101-d7f3768df1ed',
  'LUSTERKO METAL KWADRAT',
  'DK41-031A KWADRAT',
  'Lusterko kieszonkowe oferowane w 3 kształtach: serce, owal, kwadrat. Lusterko metalowe z zewnątrz miejsce wypełnione żywicą/logo. Produkt zapakowany w woreczek.',
  7.5,
  'AKCESORIA_PODROZNE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'cb51d1b5-5991-4665-88c0-ebf1a1f595c3',
  'LUSTERKO METAL OWAL',
  'DK41-031A OWAL',
  'Lusterko kieszonkowe oferowane w 3 kształtach: serce, owal, kwadrat. Lusterko metalowe z zewnątrz miejsce wypełnione żywicą/logo. Produkt zapakowany w woreczek.',
  7.5,
  'AKCESORIA_PODROZNE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '54ae3dfc-b7d4-414b-b6e7-501e3e32d5fc',
  'WACHLARZ DREWNO',
  'WACHLARZ DREWNO',
  'Wachlarz wykonany z cienkiej sklejki. Możliwe jest wykonanie graweru laserowego z prostą grafiką.',
  6,
  'AKCESORIA_PODROZNE',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'd7e9ff82-8278-417b-bd96-fe6f7e81099a',
  'BIDON SZKLANY',
  'DK41-BIDON SZKŁO',
  'Szklana butelka 500ml z pokrowcem. Pokrowiec z neoprenu zapewnia komfort w przypadku bardzo zimnych napojów oraz wygodny chwyt. Bezpieczna zakrętka z uszczelką silikonową zapobiega wyciekaniu napoju. Na każdym pokrowcu znajduję się wysokiej jakości, nowoc',
  7.5,
  'AKCESORIA_PODROZNE',
  '4',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '56decac1-e91e-4e83-badb-f3340d0d89f5',
  'LINIJKA PUZZLE',
  'LINIJKA',
  'Linijka z tworzywa sztucznego na której możliwe jest wykonanie grafiki ze wzorem. Linijka wmontowane ma także puzzle stanowiące przyjemną rozrywkę. Produkt zapakowany w stylowym woreczku. Długość linijki to 15,5 cm.',
  4.5,
  'DLA_DZIECI',
  '1.8',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '0c4f34d1-59e1-4dd1-ad78-a41d15122a7c',
  'NASZYJNIK AKRYL SERCE',
  'DK30-NASZYJNIK SERCE',
  'Naszyjnik z akrylu w kształcie serca z imieniem dziewczynki, dostępne w 3 kolorach. Produkt zapakowany na stylowej kartce w woreczku.',
  4.5,
  'DLA_DZIECI',
  '1.2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '1b0af87f-054e-4f50-91bd-603660018659',
  'SKARBONKA MDF',
  'SKARBONKA MDF',
  'Skarbonka w formie kostki o wymiarach 9 x 9 cm, wykonana z płyty MDF, możliwy dowolny zadruk wg wzoru klienta. Posiadamy 56 wzorów ze śmiesznymi hasłami.',
  9.5,
  'DLA_DZIECI',
  '1.8',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '4f9c3df7-8737-4c46-ba9a-e302a9dbc562',
  'UKŁADANKA PUZZLE',
  'MAGNES PUZZLE',
  'Wysokiej jakości układanka z tworzywa sztucznego na której możliwe jest wykonanie grafiki ze wzorem. Produkt zapakowany w stylowym woreczku. Wymiar 75 x75 mm.',
  4.5,
  'DLA_DZIECI',
  '1.8',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '32822b6e-f90e-4534-97f5-427ecd3a9a59',
  'ZAPACH DO SAMOCHODU',
  'AUTO ZAPACH',
  'Woreczek z materiału organzy z granulkami polimerowymi nasączonymi w perfumach. Kompozycji 6 zapachów: Black, Ocean, New Car, Truskawka, Wanilia i Guma Balonowa. Każdy zapach został zapakowany w foliowy szczelnie zgrzany woreczek barierowy zabezpieczając',
  4.5,
  'AKCESORIA_PODROZNE',
  '7',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'e6b23fb9-5a8b-483d-b948-7541d93a7953',
  'ZAWIESZKA DREWNIANA',
  'ZAWIESZKA AUTO',
  'Zawieszka wykonana z drewna. Naniesione grafiki drukiem UV z obu stron, będą efektowną ozdobą każdego samochodu. Nasz produkt to 6 kształtów, każda sztuka zapakowana na kartoniku.',
  4.5,
  'AKCESORIA_PODROZNE',
  '1.3',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '299a94e2-d8f4-49b9-9ca8-69ef5e933c60',
  'POPIELNICZKA CERAMICZNA',
  'POPIELNICZKA-3',
  'Popielniczki w kształcie otwartej paczki papierosów wykonane z białej ceramiki. Ciekawy przedmiot użytkowy z możliwością wykonania dowolnej grafiki na frontowej części produktu.',
  8,
  'ZAPALNICZKI_I_POPIELNICZKI',
  '1.2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'bc30d252-d4a0-479d-8ef0-458409d4ccda',
  'POPIELNICZKA KWADRAT',
  'POPIELNICZKA -2',
  'Kwadratowa popielniczka wykonana z grubego szkła posiadająca grafikę nadrukowaną na podstawie. Możliwe wykonanie dowolnej grafiki.',
  8,
  'ZAPALNICZKI_I_POPIELNICZKI',
  '1.1',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '6c074ad5-0a3c-4992-884d-44f923d2d28f',
  'POPIELNICZKA OKRĄGŁA',
  'POPIELNICZKA -1',
  'Okrągła popielniczka wykonana z grubego szkła posiadająca grafikę nadrukowaną na podstawie. Możliwe wykonanie dowolnej grafiki.',
  8,
  'ZAPALNICZKI_I_POPIELNICZKI',
  '1.1',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'e0dd9635-e246-4490-8852-280d6bc5fd2f',
  'ZAPALNICZKA BENZYNOWA',
  'DK29-039',
  'Otwierana zapalniczka benzynowa do napełniania benzyną. Zdobienie na produkcie stylizowane na motyw retro z imieniem męskim. Produkt zapakowany w profilowanym opakowaniu i kartce.',
  10,
  'ZAPALNICZKI_I_POPIELNICZKI',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '8243563c-caf4-4206-bb03-be68e79aa965',
  'ZAPALNICZKA BENZYNOWA ŻYWICA',
  'DK29-039 ŻYWICA',
  'Otwierana zapalniczka benzynowa do napełniania benzyną. Zdobienie na produkcie stylizowane na motyw retro z imieniem męskim. Produkt zapakowany w profilowanym opakowaniu i kartce.',
  12,
  'ZAPALNICZKI_I_POPIELNICZKI',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'd95d21c4-b77a-4355-9a94-98a29e122515',
  'ZAPALNICZKA GAZOWA PŁOMIEŃ',
  'ZAPALNICZKA PŁOMIEŃ',
  'Zapalniczka gazowa z możliwością wielokrotnego napełnienia. Zapalniczka występuje w 6 kolorach. Produkt zapakowany w kartonik i wypraskę z tworzywa sztucznego.',
  3,
  'ZAPALNICZKI_I_POPIELNICZKI',
  '1.5',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '4fa3c83a-e852-4ff6-a3dc-ccc28f1473a0',
  'NOTATNIK',
  'DK38-008AB',
  'Funkcjonalny notes wykonany z komponentów biodegradowalnych. Możliwe jest wykonanie grafiki ze wzorem w technologii laserowej, dolna część okładki wykonana z korka. Produkt wyposażony w długopis umożliwiający natychmiastowe użycie notesu.',
  6.5,
  'UPOMINKI_BIZNESOWE',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'd7e12270-0204-4b5a-a908-1a0d6fe4c8e8',
  'NOTATNIK ECO',
  'DK38-008AB',
  'Funkcjonalny notes wykonany z komponentów biodegradowalnych. Możliwe jest wykonanie grafiki ze wzorem w technologii laserowej. Produkt dostępny w 3 kolorach wyposażony w długopis umożliwiający natychmiastowe użycie notesu.',
  6.5,
  'UPOMINKI_BIZNESOWE',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '91b81183-a592-4105-84a7-c278ced3703e',
  'PIRAMIDA SZKŁO',
  'PIRAMIDA SZKŁO M',
  'Ozdoba z bezbarwnego szkła w kształcie piramidy, posiadający miejsce na wykonanie grafiki ze wzorem. Produkt zapakowany w kartoniku ochronnym.',
  7,
  'UPOMINKI_BIZNESOWE',
  '1.1',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '598387e5-0986-4630-8204-4a2862920866',
  'PIRAMIDA SZKŁO DUŻA',
  'PIRAMIDA SZKŁO D',
  'Ozdoba z bezbarwnego szkła w kształcie piramidy, posiadający miejsce na wykonanie grafiki ze wzorem. Produkt zapakowany w kartoniku ochronnym.',
  9,
  'UPOMINKI_BIZNESOWE',
  '1.1',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '8675c303-83f6-47f1-a7c4-53e06f8fea36',
  'FILIŻANKA SUB',
  'FILIŻANKA SUB',
  'Stylowa i elegancka ceramiczna filiżanka. Możliwość wykonania dowolnej grafiki w pełnym kolorze. Zestaw zawiera filiżankę i spodek.',
  12,
  'CERAMIKA_I_SZKLO',
  '10',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '384b8bb4-dac2-4cc1-850b-e3a1887fd467',
  'SZKLANKA M SUB',
  'SZKLANKA M SUB',
  'Szklanka wykonana ze szkła mrożonego z możliwością wykonania dowolnej grafiki. Produkt dostępny w wielu ciekawych wzorach',
  9,
  'CERAMIKA_I_SZKLO',
  '10',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'f718a6fa-6d6a-436c-9746-b8b880cb4125',
  'KUBEK M SUB',
  'KUBEK M SUB',
  'Szklanka z uchem wykonana ze szkła mrożonego z możliwością wykonania dowolnej grafiki. Produkt dostępny w wielu ciekawych wzorach',
  9,
  'CERAMIKA_I_SZKLO',
  '10',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'ab12bc52-d261-4eb6-8844-b087f949f611',
  'KIELISZEK C SUB',
  'KIELISZEK C SUB',
  'Kieliszek wykonany z białej ceramiki z możliwością wykonania dowolnej grafiki.  Produkt dostępny w wielu ciekawych wzorach',
  5.5,
  'CERAMIKA_I_SZKLO',
  '10',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '4bc65e02-77a4-425d-a1f5-09d26d331983',
  'KIELISZEK M SUB',
  'KIELISZEK M SUB',
  'Kieliszek wykonany ze szkła mrożonego z możliwością wykonania dowolnej grafiki. Produkt dostępny w wielu ciekawych wzorach',
  5.5,
  'CERAMIKA_I_SZKLO',
  '10',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '43b71d36-659c-4829-b32a-b3d5cae1be11',
  'KUFEL SUB',
  'KUFEL SUB',
  'Kufel wykonany ze szkła mrożonego z możliwością wykonania dowolnej grafiki. Produkt dostępny w wielu ciekawych wzorach',
  17.5,
  'CERAMIKA_I_SZKLO',
  '10',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'dceabae0-2c57-495a-8106-2966e9725f91',
  'SKARBONKA SUB',
  'SKARBONKA SUB',
  'Skarbonka w formie walca wykonana z wytrzymałej ceramiki. Możliwe jest nałożenie dowolnej grafiki w pełnym kolorze. Idealny prezent dla dziecka dostępny w wielu wzorach.',
  12,
  'CERAMIKA_I_SZKLO',
  '10',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '76fa15d5-a3dc-445e-a7b2-8dfc831f3f9d',
  'KUFEL AB',
  'DK42-058AB',
  NULL,
  0,
  'CERAMIKA_I_SZKLO',
  '10',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '3e774fde-7c31-4588-9323-e0d7e10a7d26',
  'CHUSTA TRIO',
  'DK18-CHUSTA',
  'Chusty wielofunkcyjna w formie komina z możliwością wykonania dowolnej grafiki. Brak niewygodnych szwów, wykonana z elastycznego poliestru. Idealna na codzienne spacery, oraz aktywnego spędzania czasu, dla dorosłych jak i dzieci.',
  4,
  'TEKSTYLIA',
  '8',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '457acbe2-5ebb-420b-9050-e3c78be0c71e',
  'ZAPALNICZKA BENZYNA KOLOR',
  'ZAPALNICZKA BENZYNA KOLOR',
  'Otwierana zapalniczka benzynowa do napełniania benzyną. Zdobienie na produkcie stylizowane na motyw retro z imieniem męskim. Produkt zapakowany w profilowanym opakowaniu i kartce.',
  10,
  'ZAPALNICZKI_I_POPIELNICZKI',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'ecee1032-1419-440b-bde3-6032850b65ca',
  'ZAPAL ZL-12 BIAŁA',
  'ZAPAL ZL-12 BIAŁA',
  'Zapalniczka gazowa z żarowym płomieniem z możliwością wielokrotnego napełnienia. Produkt dostępny w kolorze białym.',
  12,
  'ZAPALNICZKI_I_POPIELNICZKI',
  '1.5',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '6c358c1c-370a-4db4-b786-ccafe49339b9',
  'ZAPAL ZL-12 CZARNA',
  'ZAPAL ZL-12 CZARNA',
  'Zapalniczka gazowa z żarowym płomieniem z możliwością wielokrotnego napełnienia. Produkt dostępny w kolorze czarnym.',
  12,
  'ZAPALNICZKI_I_POPIELNICZKI',
  '1.5',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '83703b70-ca1d-4f26-957d-229495656819',
  'ZAPALNICZKA ŻYWICA',
  'ZAPALNICZKA ŻYWICA',
  'Zapalniczka gazowa z możliwością wykonania dowolnej grafiki w pełnym kolorze.',
  7.5,
  'ZAPALNICZKI_I_POPIELNICZKI',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '82888471-8caa-40dd-99fb-8098365a1661',
  'ZAPALNICZKA GUMA CZARNA',
  'ZAPALNICZKA GUMA CZARNA',
  'Zapalniczka gazowa z możliwością wielokrotnego napełnienia.',
  3.5,
  'ZAPALNICZKI_I_POPIELNICZKI',
  '1.5',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'd3009010-1bb4-44ec-b97d-cf8793da6661',
  'ZAPALNICZKA JET MIX GUMA',
  'ZAPALNICZKA JET MIX GUMA',
  'Zapalniczka gazowa z żarowym płomieniem z możliwością wielokrotnego napełnienia.',
  10,
  'ZAPALNICZKI_I_POPIELNICZKI',
  '1.5',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '5afe5e3a-8212-4b4d-ae2b-43505d57ff94',
  'PODKŁADKA SUB',
  'PODKŁADKA SUB',
  'Podkładka pod myszkę z barwnym wydrukiem wykonanym w technice sublimacyjnej. Wymiary podkładki 24cm x 20cm',
  7.5,
  'OZDOBY_DOMOWE',
  '8',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'db6bec09-80ee-4d2a-8f88-054a697307d8',
  'KIELISZEK OMBRE',
  'BRAK',
  NULL,
  0,
  'CERAMIKA_I_SZKLO',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'bfb34d76-011a-441f-8de8-163a48c00020',
  'KORKOCIĄG DREWNO',
  'DK42-009A',
  NULL,
  0,
  'OTWIERACZE',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '86e6b9ff-27db-42be-ad86-ef3a7856c585',
  'SCYZORYK DREWNO',
  'DK42-009B',
  NULL,
  0,
  'AKCESORIA_PODROZNE',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'fd5cbe5e-54e9-4246-b7aa-eceafcc9a5b2',
  'OTWIERACZ DREWNO',
  'DK42-009C',
  NULL,
  0,
  'OTWIERACZE',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'a48fc2ab-dcf2-4737-8efe-19df173412d9',
  'PIERSIÓWKA 1',
  'DK42-045A1',
  NULL,
  0,
  'AKCESORIA_PODROZNE',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '12c43461-3604-4d3d-9f99-50d19c2a6ab1',
  'PIERSIÓWKA 2',
  'DK42-045A2',
  NULL,
  0,
  'AKCESORIA_PODROZNE',
  '6',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '1050d685-dc5a-407d-9a84-1fb547daa4ab',
  'PIERSIÓWKA 3',
  'DK42-045A3',
  NULL,
  0,
  'AKCESORIA_PODROZNE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '8079cf0e-f9ae-4625-8979-e073a1174c4e',
  'MAGNES NÓŻKI RYCERZ',
  'DK41-077A',
  'Magnes wykonany z tworzywa ceramicznego posiadający miejsce na wykonanie grafiki ze wzorem. Produkt zapakowany w woreczku.',
  5,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '1b9f3f0e-a338-4f64-8b95-6c6a7770dd75',
  'POPIELNICZKA METAL KWADRAT',
  'DK42-057S',
  NULL,
  0,
  'ZAPALNICZKI_I_POPIELNICZKI',
  '2.1',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '5e10b7e2-9872-44a8-ab27-d41e8583dd84',
  'POPIELNICZKA METAL KOŁO ŚREDNIA',
  'DK42-057M',
  NULL,
  0,
  'ZAPALNICZKI_I_POPIELNICZKI',
  '2.1',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '0ff5394b-355f-4d69-aa75-8147301705b3',
  'POPIELNICZKA METAL KOŁO DUŻA',
  'DK42-057L',
  NULL,
  0,
  'ZAPALNICZKI_I_POPIELNICZKI',
  '2.1',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '1797e2ae-af7b-43f3-b082-c81577686753',
  'DŁUGOPIS BAMBUS GUMKA KOLOR',
  'DK42-037A',
  NULL,
  0,
  'DLUGOPISY',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'cf2d8ab9-bdb6-47bc-89b8-9d381ed73bac',
  'MAGNES CERAMICZNY ŻYWICOWANY',
  'MAGNES CERAMICZNY ŻYWICOWANY',
  NULL,
  0,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '0ad2d2f9-16c7-42f2-bb00-4431a99e6c97',
  'BRELOK STER',
  'DK42-163',
  NULL,
  0,
  'BRELOKI',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '4fa5d234-129d-4df4-b349-e8240edb26e7',
  'MAGNES METAL KOŁO 1',
  'DK42-165A',
  NULL,
  0,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'b16574de-a1d0-4ba5-a180-364efa98a51f',
  'MAGNES METAL KOŁO 2',
  'DK42-185',
  NULL,
  0,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '598a1763-0c18-4e04-b390-b8bf746accfb',
  'MAGNES METAL KOŁO 3',
  'DK42-166',
  NULL,
  0,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '92885aaa-25eb-41a9-96e1-84721ba95145',
  'MAGNES METAL KOŁO 4',
  'DK42-165B',
  NULL,
  0,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  'feb86483-8f08-4e63-baaf-7d8dacd20b23',
  'ŁYŻECZKA',
  'ŁYŻECZKA',
  NULL,
  0,
  'MAGNESY',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '96d206ae-2960-4940-a945-9b602e557bd5',
  'KUBEK CZARNY MAT',
  'KUBEK CZARNY MAT',
  NULL,
  12,
  'CERAMIKA_I_SZKLO',
  '3',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '8b0afd31-a5f4-4324-b279-ec454c8e6f8e',
  'KUBEK DUŻY SUB',
  'KUBEK SUB DUŻY',
  NULL,
  0,
  'CERAMIKA_I_SZKLO',
  '10',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '6f849bcd-52e9-41f1-b137-0ccae34fdb31',
  'KIELISZEK M SUB WYSOKI',
  'KIELISZEK M SUB WYSOKI',
  NULL,
  0,
  'CERAMIKA_I_SZKLO',
  '10',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '1cc576fe-5931-47d2-a313-8524df1ff9ce',
  'KUBEK SUB METAL',
  'KUBEK SUB METAL',
  NULL,
  0,
  'CERAMIKA_I_SZKLO',
  '10',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '14313372-bc81-46f2-a084-c47315bf7e60',
  'KUBEK SUB METAL KOLOR',
  'KUBEK SUB METAL KOLOR',
  NULL,
  0,
  'CERAMIKA_I_SZKLO',
  '10',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '963b4005-2263-40ec-ba3e-6d1cadddf985',
  'KUFEL SUB KOLOR',
  'KUFEL SUB KOLOR',
  NULL,
  0,
  'CERAMIKA_I_SZKLO',
  '10',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '70ad07c0-09ad-48c7-9273-5572058bf452',
  'KUFEL C1 BECZKA SUB',
  'KUFEL SUB CERAMIKA',
  NULL,
  0,
  'CERAMIKA_I_SZKLO',
  '10',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '23b84dc2-2284-4b62-935a-c9659d01bad7',
  'KIELISZEK KWADRAT SUB',
  'KIELISZEK KWADRAT SUB',
  NULL,
  0,
  'CERAMIKA_I_SZKLO',
  '1.1',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);
INSERT INTO "Product" (
  "id", "identifier", "index", "description", "price", 
  "category", "productionPath", "isActive", "imageUrl", 
  "createdAt", "updatedAt"
) VALUES (
  '9a8611bc-0f37-4649-9c1e-a8325f918de4',
  'OTWIERACZ KOŁO RATUNKOWE',
  'DK42-168',
  NULL,
  0,
  'OTWIERACZE',
  '2',
  true,
  NULL,
  '2025-08-17T14:39:10.405Z',
  '2025-08-17T14:39:10.405Z'
);