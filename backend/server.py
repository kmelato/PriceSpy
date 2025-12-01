from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import httpx
from bs4 import BeautifulSoup
import base64
import re
import asyncio
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

# Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# Create the main app
app = FastAPI(title="Prospekt Preisvergleich API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== Models ====================

class Supermarket(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    logo_url: Optional[str] = None
    website_url: str
    prospekt_url: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class SupermarketCreate(BaseModel):
    name: str
    logo_url: Optional[str] = None
    website_url: str
    prospekt_url: str

class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    original_name: str
    price: float
    original_price: Optional[float] = None
    unit: Optional[str] = None
    price_per_unit: Optional[str] = None
    category: str
    supermarket_id: str
    supermarket_name: str
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    image_base64: Optional[str] = None
    extracted_at: datetime = Field(default_factory=datetime.utcnow)

class ShoppingListItem(BaseModel):
    product_name: str
    quantity: int = 1
    checked: bool = False
    best_price: Optional[float] = None
    best_supermarket: Optional[str] = None

class ShoppingList(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    items: List[ShoppingListItem] = []
    plz: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ShoppingListCreate(BaseModel):
    name: str
    plz: Optional[str] = None

class ShoppingListItemAdd(BaseModel):
    product_name: str
    quantity: int = 1

class PriceAlert(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_name: str
    target_price: float
    current_price: Optional[float] = None
    supermarket_ids: List[str] = []
    is_active: bool = True
    triggered: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PriceAlertCreate(BaseModel):
    product_name: str
    target_price: float
    supermarket_ids: List[str] = []

class ScanRequest(BaseModel):
    supermarket_ids: List[str] = []
    force_refresh: bool = False

class UserSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    selected_supermarkets: List[str] = []
    plz: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# ==================== Default Supermarkets ====================

DEFAULT_SUPERMARKETS = [
    {
        "name": "Aldi Nord",
        "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/AldiNordLogo.svg/1200px-AldiNordLogo.svg.png",
        "website_url": "https://www.aldi-nord.de",
        "prospekt_url": "https://www.aldi-nord.de/angebote.html"
    },
    {
        "name": "Aldi Süd",
        "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Aldi_S%C3%BCd_2017_logo.svg/1200px-Aldi_S%C3%BCd_2017_logo.svg.png",
        "website_url": "https://www.aldi-sued.de",
        "prospekt_url": "https://www.aldi-sued.de/de/angebote.html"
    },
    {
        "name": "REWE",
        "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Rewe_-_Logo.svg/1200px-Rewe_-_Logo.svg.png",
        "website_url": "https://www.rewe.de",
        "prospekt_url": "https://www.rewe.de/angebote/nationale-angebote/"
    },
    {
        "name": "Edeka",
        "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Edeka_logo.svg/1200px-Edeka_logo.svg.png",
        "website_url": "https://www.edeka.de",
        "prospekt_url": "https://www.edeka.de/eh/angebote.jsp"
    },
    {
        "name": "Lidl",
        "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Lidl-Logo.svg/1200px-Lidl-Logo.svg.png",
        "website_url": "https://www.lidl.de",
        "prospekt_url": "https://www.lidl.de/c/billiger-montag/a10006065"
    },
    {
        "name": "Kaufland",
        "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Kaufland_201x_logo.svg/1200px-Kaufland_201x_logo.svg.png",
        "website_url": "https://www.kaufland.de",
        "prospekt_url": "https://www.kaufland.de/angebote/aktuelle-woche.html"
    },
    {
        "name": "Penny",
        "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Logo_Penny.svg/1200px-Logo_Penny.svg.png",
        "website_url": "https://www.penny.de",
        "prospekt_url": "https://www.penny.de/angebote"
    },
    {
        "name": "Netto",
        "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Netto_logo.svg/1200px-Netto_logo.svg.png",
        "website_url": "https://www.netto-online.de",
        "prospekt_url": "https://www.netto-online.de/angebote"
    }
]

CATEGORIES = [
    "Obst & Gemüse",
    "Fleisch & Wurst",
    "Milchprodukte",
    "Brot & Backwaren",
    "Getränke",
    "Süßigkeiten & Snacks",
    "Tiefkühl",
    "Haushalt",
    "Drogerie",
    "Sonstiges"
]

# ==================== AI Extraction Service ====================

async def extract_products_from_image(image_base64: str, supermarket_name: str) -> List[Dict]:
    """Use AI to extract product information from a prospekt image."""
    try:
        if not EMERGENT_LLM_KEY:
            logger.error("EMERGENT_LLM_KEY not configured")
            return []
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"extract-{uuid.uuid4()}",
            system_message="""Du bist ein Experte für die Extraktion von Produktinformationen aus deutschen Supermarkt-Prospekten.
Extrahiere alle Produkte mit folgenden Informationen im JSON-Format:
- name: Produktname
- price: Preis als Zahl (nur der Aktionspreis)
- original_price: Originalpreis falls vorhanden (als Zahl)
- unit: Einheit (z.B. "kg", "Stück", "Packung", "Liter")
- price_per_unit: Preis pro Einheit falls angegeben
- category: Eine der folgenden Kategorien: "Obst & Gemüse", "Fleisch & Wurst", "Milchprodukte", "Brot & Backwaren", "Getränke", "Süßigkeiten & Snacks", "Tiefkühl", "Haushalt", "Drogerie", "Sonstiges"

Antworte NUR mit einem JSON-Array der Produkte, keine zusätzlichen Erklärungen."""
        ).with_model("openai", "gpt-4o")
        
        image_content = ImageContent(image_base64=image_base64)
        
        user_message = UserMessage(
            text=f"Extrahiere alle Produkte und Preise aus diesem {supermarket_name} Prospekt-Bild. Antworte nur mit dem JSON-Array.",
            file_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        
        # Parse the response
        json_match = re.search(r'\[.*\]', response, re.DOTALL)
        if json_match:
            import json
            products = json.loads(json_match.group())
            return products
        
        return []
    except Exception as e:
        logger.error(f"Error extracting products: {e}")
        return []

async def fetch_prospekt_page(url: str) -> Optional[str]:
    """Fetch prospekt page HTML."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "de-DE,de;q=0.9,en;q=0.8"
        }
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                return response.text
    except Exception as e:
        logger.error(f"Error fetching {url}: {e}")
    return None

# ==================== API Routes ====================

@api_router.get("/")
async def root():
    return {"message": "Prospekt Preisvergleich API", "version": "1.0.0"}

# ---- Supermarkets ----

@api_router.get("/supermarkets", response_model=List[Supermarket])
async def get_supermarkets():
    """Get all available supermarkets."""
    supermarkets = await db.supermarkets.find().to_list(100)
    if not supermarkets:
        # Initialize with default supermarkets
        for sm in DEFAULT_SUPERMARKETS:
            sm_obj = Supermarket(**sm)
            await db.supermarkets.insert_one(sm_obj.dict())
        supermarkets = await db.supermarkets.find().to_list(100)
    return [Supermarket(**sm) for sm in supermarkets]

@api_router.post("/supermarkets", response_model=Supermarket)
async def create_supermarket(supermarket: SupermarketCreate):
    """Add a new supermarket."""
    sm_obj = Supermarket(**supermarket.dict())
    await db.supermarkets.insert_one(sm_obj.dict())
    return sm_obj

@api_router.put("/supermarkets/{supermarket_id}/toggle")
async def toggle_supermarket(supermarket_id: str):
    """Toggle supermarket active status."""
    sm = await db.supermarkets.find_one({"id": supermarket_id})
    if not sm:
        raise HTTPException(status_code=404, detail="Supermarket not found")
    
    new_status = not sm.get("is_active", True)
    await db.supermarkets.update_one(
        {"id": supermarket_id},
        {"$set": {"is_active": new_status}}
    )
    return {"id": supermarket_id, "is_active": new_status}

# ---- Products ----

@api_router.get("/products", response_model=List[Product])
async def get_products(
    category: Optional[str] = None,
    supermarket_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50
):
    """Get products with optional filters."""
    query = {}
    if category:
        query["category"] = category
    if supermarket_id:
        query["supermarket_id"] = supermarket_id
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    
    products = await db.products.find(query).sort("price", 1).limit(limit).to_list(limit)
    return [Product(**p) for p in products]

@api_router.get("/products/compare")
async def compare_product(search: str):
    """Compare a product across all supermarkets."""
    query = {"name": {"$regex": search, "$options": "i"}}
    products = await db.products.find(query).to_list(100)
    
    # Group by supermarket
    comparison = {}
    for p in products:
        sm_name = p.get("supermarket_name", "Unknown")
        if sm_name not in comparison or p.get("price", float('inf')) < comparison[sm_name].get("price", float('inf')):
            comparison[sm_name] = Product(**p).dict()
    
    # Sort by price
    sorted_comparison = sorted(comparison.values(), key=lambda x: x.get("price", float('inf')))
    
    return {
        "search_term": search,
        "results": sorted_comparison,
        "cheapest": sorted_comparison[0] if sorted_comparison else None
    }

@api_router.get("/categories")
async def get_categories():
    """Get all product categories."""
    return {"categories": CATEGORIES}

# ---- Scan/Extract ----

@api_router.post("/scan")
async def scan_prospekts(request: ScanRequest, background_tasks: BackgroundTasks):
    """Trigger scanning of prospekts (returns immediately, scans in background)."""
    background_tasks.add_task(run_prospekt_scan, request.supermarket_ids, request.force_refresh)
    return {"status": "scanning", "message": "Prospekt-Scan wurde gestartet"}

async def run_prospekt_scan(supermarket_ids: List[str], force_refresh: bool):
    """Background task to scan prospekts."""
    query = {"is_active": True}
    if supermarket_ids:
        query["id"] = {"$in": supermarket_ids}
    
    supermarkets = await db.supermarkets.find(query).to_list(100)
    
    for sm in supermarkets:
        try:
            logger.info(f"Scanning {sm['name']}...")
            # This would fetch and process real prospekt data
            # For MVP, we'll create sample data
            await create_sample_products(sm)
        except Exception as e:
            logger.error(f"Error scanning {sm['name']}: {e}")

async def create_sample_products(supermarket: dict):
    """Create sample products for demo purposes."""
    import random
    
    sample_products = [
        {"name": "Bio Äpfel", "category": "Obst & Gemüse", "base_price": 1.99},
        {"name": "Bananen", "category": "Obst & Gemüse", "base_price": 1.49},
        {"name": "Tomaten", "category": "Obst & Gemüse", "base_price": 2.49},
        {"name": "Hackfleisch gemischt 500g", "category": "Fleisch & Wurst", "base_price": 4.99},
        {"name": "Hähnchenbrust 400g", "category": "Fleisch & Wurst", "base_price": 5.99},
        {"name": "Wurst Aufschnitt", "category": "Fleisch & Wurst", "base_price": 2.29},
        {"name": "Vollmilch 1L", "category": "Milchprodukte", "base_price": 1.19},
        {"name": "Butter 250g", "category": "Milchprodukte", "base_price": 2.49},
        {"name": "Gouda Käse", "category": "Milchprodukte", "base_price": 2.99},
        {"name": "Joghurt Natur", "category": "Milchprodukte", "base_price": 0.99},
        {"name": "Vollkornbrot", "category": "Brot & Backwaren", "base_price": 1.89},
        {"name": "Brötchen 6er", "category": "Brot & Backwaren", "base_price": 1.29},
        {"name": "Cola 1.5L", "category": "Getränke", "base_price": 1.29},
        {"name": "Mineralwasser 6x1.5L", "category": "Getränke", "base_price": 2.99},
        {"name": "Orangensaft 1L", "category": "Getränke", "base_price": 1.99},
        {"name": "Schokolade 100g", "category": "Süßigkeiten & Snacks", "base_price": 1.29},
        {"name": "Chips 175g", "category": "Süßigkeiten & Snacks", "base_price": 1.99},
        {"name": "Tiefkühl Pizza", "category": "Tiefkühl", "base_price": 2.49},
        {"name": "Tiefkühl Gemüse 450g", "category": "Tiefkühl", "base_price": 1.79},
        {"name": "Waschmittel 1L", "category": "Haushalt", "base_price": 4.99},
        {"name": "Toilettenpapier 8er", "category": "Haushalt", "base_price": 3.49},
        {"name": "Shampoo 250ml", "category": "Drogerie", "base_price": 2.49},
        {"name": "Zahnpasta", "category": "Drogerie", "base_price": 1.29},
    ]
    
    # Clear old products from this supermarket
    await db.products.delete_many({"supermarket_id": supermarket["id"]})
    
    valid_from = datetime.utcnow()
    valid_until = valid_from + timedelta(days=7)
    
    for sp in sample_products:
        # Add some price variation per supermarket
        price_variation = random.uniform(0.85, 1.15)
        price = round(sp["base_price"] * price_variation, 2)
        original_price = round(price * random.uniform(1.1, 1.3), 2) if random.random() > 0.5 else None
        
        product = Product(
            name=sp["name"],
            original_name=sp["name"],
            price=price,
            original_price=original_price,
            category=sp["category"],
            supermarket_id=supermarket["id"],
            supermarket_name=supermarket["name"],
            valid_from=valid_from,
            valid_until=valid_until
        )
        await db.products.insert_one(product.dict())
    
    logger.info(f"Created {len(sample_products)} sample products for {supermarket['name']}")

# ---- Extract from Image ----

class ImageExtractRequest(BaseModel):
    image_base64: str
    supermarket_id: str

@api_router.post("/extract")
async def extract_from_image(request: ImageExtractRequest):
    """Extract products from an uploaded prospekt image using AI."""
    sm = await db.supermarkets.find_one({"id": request.supermarket_id})
    if not sm:
        raise HTTPException(status_code=404, detail="Supermarket not found")
    
    products = await extract_products_from_image(request.image_base64, sm["name"])
    
    if not products:
        return {"status": "no_products", "message": "Keine Produkte gefunden", "products": []}
    
    # Save products to database
    saved_products = []
    valid_from = datetime.utcnow()
    valid_until = valid_from + timedelta(days=7)
    
    for p in products:
        try:
            product = Product(
                name=p.get("name", "Unbekannt"),
                original_name=p.get("name", "Unbekannt"),
                price=float(p.get("price", 0)),
                original_price=float(p.get("original_price")) if p.get("original_price") else None,
                unit=p.get("unit"),
                price_per_unit=p.get("price_per_unit"),
                category=p.get("category", "Sonstiges"),
                supermarket_id=request.supermarket_id,
                supermarket_name=sm["name"],
                valid_from=valid_from,
                valid_until=valid_until
            )
            await db.products.insert_one(product.dict())
            saved_products.append(product)
        except Exception as e:
            logger.error(f"Error saving product: {e}")
    
    return {
        "status": "success",
        "message": f"{len(saved_products)} Produkte extrahiert",
        "products": [p.dict() for p in saved_products]
    }

# ---- Shopping Lists ----

@api_router.get("/lists", response_model=List[ShoppingList])
async def get_shopping_lists():
    """Get all shopping lists."""
    lists = await db.shopping_lists.find().sort("updated_at", -1).to_list(100)
    return [ShoppingList(**lst) for lst in lists]

@api_router.post("/lists", response_model=ShoppingList)
async def create_shopping_list(lst: ShoppingListCreate):
    """Create a new shopping list."""
    list_obj = ShoppingList(**lst.dict())
    await db.shopping_lists.insert_one(list_obj.dict())
    return list_obj

@api_router.get("/lists/{list_id}", response_model=ShoppingList)
async def get_shopping_list(list_id: str):
    """Get a specific shopping list."""
    lst = await db.shopping_lists.find_one({"id": list_id})
    if not lst:
        raise HTTPException(status_code=404, detail="Shopping list not found")
    return ShoppingList(**lst)

@api_router.post("/lists/{list_id}/items")
async def add_item_to_list(list_id: str, item: ShoppingListItemAdd):
    """Add an item to a shopping list with best price info."""
    lst = await db.shopping_lists.find_one({"id": list_id})
    if not lst:
        raise HTTPException(status_code=404, detail="Shopping list not found")
    
    # Find best price for this product
    products = await db.products.find(
        {"name": {"$regex": item.product_name, "$options": "i"}}
    ).sort("price", 1).to_list(10)
    
    best_price = None
    best_supermarket = None
    if products:
        best_price = products[0].get("price")
        best_supermarket = products[0].get("supermarket_name")
    
    list_item = ShoppingListItem(
        product_name=item.product_name,
        quantity=item.quantity,
        best_price=best_price,
        best_supermarket=best_supermarket
    )
    
    await db.shopping_lists.update_one(
        {"id": list_id},
        {
            "$push": {"items": list_item.dict()},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    return {"status": "success", "item": list_item.dict()}

@api_router.put("/lists/{list_id}/items/{item_index}/toggle")
async def toggle_list_item(list_id: str, item_index: int):
    """Toggle checked status of a list item."""
    lst = await db.shopping_lists.find_one({"id": list_id})
    if not lst:
        raise HTTPException(status_code=404, detail="Shopping list not found")
    
    items = lst.get("items", [])
    if item_index < 0 or item_index >= len(items):
        raise HTTPException(status_code=404, detail="Item not found")
    
    items[item_index]["checked"] = not items[item_index].get("checked", False)
    
    await db.shopping_lists.update_one(
        {"id": list_id},
        {"$set": {"items": items, "updated_at": datetime.utcnow()}}
    )
    
    return {"status": "success", "checked": items[item_index]["checked"]}

@api_router.delete("/lists/{list_id}/items/{item_index}")
async def remove_list_item(list_id: str, item_index: int):
    """Remove an item from a shopping list."""
    lst = await db.shopping_lists.find_one({"id": list_id})
    if not lst:
        raise HTTPException(status_code=404, detail="Shopping list not found")
    
    items = lst.get("items", [])
    if item_index < 0 or item_index >= len(items):
        raise HTTPException(status_code=404, detail="Item not found")
    
    items.pop(item_index)
    
    await db.shopping_lists.update_one(
        {"id": list_id},
        {"$set": {"items": items, "updated_at": datetime.utcnow()}}
    )
    
    return {"status": "success"}

@api_router.delete("/lists/{list_id}")
async def delete_shopping_list(list_id: str):
    """Delete a shopping list."""
    result = await db.shopping_lists.delete_one({"id": list_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Shopping list not found")
    return {"status": "success"}

# ---- Price Alerts ----

@api_router.get("/alerts", response_model=List[PriceAlert])
async def get_price_alerts():
    """Get all price alerts."""
    alerts = await db.price_alerts.find().to_list(100)
    return [PriceAlert(**a) for a in alerts]

@api_router.post("/alerts", response_model=PriceAlert)
async def create_price_alert(alert: PriceAlertCreate):
    """Create a new price alert."""
    # Check current price
    products = await db.products.find(
        {"name": {"$regex": alert.product_name, "$options": "i"}}
    ).sort("price", 1).to_list(1)
    
    current_price = products[0].get("price") if products else None
    
    alert_obj = PriceAlert(
        **alert.dict(),
        current_price=current_price,
        triggered=current_price <= alert.target_price if current_price else False
    )
    await db.price_alerts.insert_one(alert_obj.dict())
    return alert_obj

@api_router.delete("/alerts/{alert_id}")
async def delete_price_alert(alert_id: str):
    """Delete a price alert."""
    result = await db.price_alerts.delete_one({"id": alert_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "success"}

# ---- User Settings ----

@api_router.get("/settings")
async def get_settings():
    """Get user settings."""
    settings = await db.user_settings.find_one({})
    if not settings:
        settings = UserSettings().dict()
        await db.user_settings.insert_one(settings)
    return UserSettings(**settings)

@api_router.put("/settings")
async def update_settings(settings: UserSettings):
    """Update user settings."""
    settings.updated_at = datetime.utcnow()
    await db.user_settings.update_one(
        {},
        {"$set": settings.dict()},
        upsert=True
    )
    return settings

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize database with default data on startup."""
    # Check if supermarkets exist
    count = await db.supermarkets.count_documents({})
    if count == 0:
        logger.info("Initializing default supermarkets...")
        for sm in DEFAULT_SUPERMARKETS:
            sm_obj = Supermarket(**sm)
            await db.supermarkets.insert_one(sm_obj.dict())
        logger.info(f"Created {len(DEFAULT_SUPERMARKETS)} default supermarkets")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
