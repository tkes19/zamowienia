import requests
import json
from bs4 import BeautifulSoup
import re

print("=== ANALIZA DANYCH PRODUKTÓW ===\n")

# 1. Analiza API
print("1. ANALIZA API: https://rezon-api.vercel.app/api/v1/products")
print("-" * 60)

try:
    api_response = requests.get("https://rezon-api.vercel.app/api/v1/products", timeout=10)
    api_response.raise_for_status()
    api_data = api_response.json()
    
    if api_data and len(api_data) > 0:
        print(f"Liczba produktów w API: {len(api_data)}")
        
        # Pola dostępne w API
        first_product = api_data[0]
        api_fields = list(first_product.keys())
        print(f"\nPola dostępne w API ({len(api_fields)}):")
        for field in sorted(api_fields):
            print(f"  - {field}")
        
        # Przykład produktu z API
        print(f"\nPrzykład produktu z API:")
        sample_product = {}
        for key, value in first_product.items():
            if isinstance(value, str) and len(value) > 100:
                sample_product[key] = value[:100] + "..."
            else:
                sample_product[key] = value
        print(json.dumps(sample_product, indent=2, ensure_ascii=False))
        
        # Analiza obrazów z API
        print(f"\nAnaliza obrazów z API:")
        image_urls = set()
        image_fields = []
        
        for product in api_data[:10]:  # Sprawdź pierwsze 10 produktów
            for key, value in product.items():
                if 'image' in key.lower() or 'photo' in key.lower() or 'picture' in key.lower():
                    if key not in image_fields:
                        image_fields.append(key)
                    
                    if isinstance(value, str) and ('http' in value or '.jpg' in value or '.png' in value):
                        image_urls.add(value)
                    elif isinstance(value, list):
                        for item in value:
                            if isinstance(item, str) and ('http' in item or '.jpg' in item or '.png' in item):
                                image_urls.add(item)
        
        print(f"Pola związane z obrazami: {image_fields}")
        print(f"Przykłady URL-i obrazów ({min(5, len(image_urls))}):")
        for i, url in enumerate(list(image_urls)[:5]):
            print(f"  {i+1}. {url}")
            
    else:
        print("API zwróciło pustą odpowiedź lub brak produktów")
        
except Exception as e:
    print(f"Błąd podczas pobierania danych z API: {e}")

print("\n" + "="*80 + "\n")

# 2. Analiza strony internetowej
print("2. ANALIZA STRONY: https://www.rezon.eu/search?search=brelok")
print("-" * 60)

try:
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    web_response = requests.get("https://www.rezon.eu/search?search=brelok", headers=headers, timeout=10)
    web_response.raise_for_status()
    
    soup = BeautifulSoup(web_response.text, 'html.parser')
    
    # Sprawdź czy są produkty w HTML
    product_cards = []
    
    # Różne selektory dla kart produktów
    selectors = [
        '.product-card', '.product-item', '.product', '[data-product]',
        '.card', '.item', '.listing-item', '.search-result'
    ]
    
    for selector in selectors:
        cards = soup.select(selector)
        if cards:
            product_cards = cards
            print(f"Znaleziono {len(cards)} produktów używając selektora: {selector}")
            break
    
    if not product_cards:
        # Sprawdź czy są jakiekolwiek elementy z ceną lub nazwą produktu
        price_elements = soup.find_all(text=re.compile(r'\d+[,.]?\d*\s*(zł|PLN|€|\$)'))
        product_links = soup.find_all('a', href=re.compile(r'product|item|brelok'))
        
        print(f"Elementy z cenami: {len(price_elements)}")
        print(f"Linki do produktów: {len(product_links)}")
        
        if len(price_elements) == 0 and len(product_links) == 0:
            print("STRONA WYMAGA JAVASCRIPT - użyję browser_console_exec")
            print("Brak statycznych danych produktów w HTML")
        else:
            print("Znaleziono niektóre elementy produktów w HTML")
    else:
        # Analiza znalezionych kart produktów
        print(f"\nAnaliza pierwszej karty produktu:")
        first_card = product_cards[0]
        
        # Wyciągnij dostępne dane
        card_data = {}
        
        # Nazwa/tytuł
        title_selectors = ['h1', 'h2', 'h3', '.title', '.name', '.product-name', '[data-name]']
        for sel in title_selectors:
            title = first_card.select_one(sel)
            if title:
                card_data['title'] = title.get_text(strip=True)
                break
        
        # Cena
        price_selectors = ['.price', '.cost', '[data-price]', '.amount']
        for sel in price_selectors:
            price = first_card.select_one(sel)
            if price:
                card_data['price'] = price.get_text(strip=True)
                break
        
        # Link
        link = first_card.find('a')
        if link and link.get('href'):
            card_data['link'] = link.get('href')
        
        # Obrazek
        img = first_card.find('img')
        if img:
            card_data['image'] = img.get('src') or img.get('data-src')
        
        # Wszystkie atrybuty data-*
        data_attrs = {k: v for k, v in first_card.attrs.items() if k.startswith('data-')}
        if data_attrs:
            card_data['data_attributes'] = data_attrs
        
        print("Dostępne pola w karcie produktu:")
        for key, value in card_data.items():
            print(f"  - {key}: {value}")
        
        # Zbierz wszystkie obrazy ze strony
        all_images = soup.find_all('img')
        image_urls_web = set()
        for img in all_images:
            src = img.get('src') or img.get('data-src')
            if src and ('product' in src.lower() or 'brelok' in src.lower() or '.jpg' in src or '.png' in src):
                if src.startswith('//'):
                    src = 'https:' + src
                elif src.startswith('/'):
                    src = 'https://www.rezon.eu' + src
                image_urls_web.add(src)
        
        print(f"\nZnalezione URL-e obrazów produktów ({len(image_urls_web)}):")
        for i, url in enumerate(list(image_urls_web)[:5]):
            print(f"  {i+1}. {url}")

except Exception as e:
    print(f"Błąd podczas analizy strony: {e}")

print("\n" + "="*80)
print("ANALIZA ZAKOŃCZONA")
